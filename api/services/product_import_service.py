import uuid
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from exceptions.general import APIException, NotFoundException
from repositories.category_repository import CategoryRepository
from schemas.product import (
    ImportReport,
    ImportRowError,
    ProductCreate,
    ProductUpdate,
    ProductVariantCreate,
    ProductVariantUpdate,
)
from services.product_csv import CREATE_ONLY_REQUIRED, RowError, decode_and_read, map_row
from services.product_service import ProductService, _to_net_price


class _RowCtx:
    """One parsed CSV row, grouped by product slug before any DB write happens."""

    __slots__ = ("row_number", "product_fields", "variant_fields", "product_id_hint", "variant_id_hint")

    def __init__(self, row_number, product_fields, variant_fields, product_id_hint, variant_id_hint):
        self.row_number = row_number
        self.product_fields = product_fields
        self.variant_fields = variant_fields
        self.product_id_hint = product_id_hint
        self.variant_id_hint = variant_id_hint


def _dirty(obj, fields: dict) -> dict:
    """Return only the (key, value) pairs from `fields` that differ from `obj`'s
    current attributes — used so re-importing an unedited export reports 0
    updates instead of rewriting every row verbatim."""
    changed = {}
    for key, value in fields.items():
        current = getattr(obj, key)
        if key == "attributes":
            current = current or {}
            value = value or {}
        if current != value:
            changed[key] = value
    return changed


class ProductImportService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.service = ProductService(db)
        self.category_repo = CategoryRepository(db)

    async def run(self, raw: bytes, dry_run: bool) -> ImportReport:
        report = ImportReport(
            dry_run=dry_run,
            rows_processed=0,
            products_created=0,
            products_updated=0,
            variants_created=0,
            variants_updated=0,
            errors=[],
        )

        try:
            reader, present = decode_and_read(raw)
        except UnicodeDecodeError:
            report.errors.append(
                ImportRowError(row_number=None, identifier=None, message="No se pudo decodificar el archivo (¿es un CSV válido?)")
            )
            return report

        groups: dict[str, list[_RowCtx]] = {}
        group_order: list[str] = []

        for row in reader:
            report.rows_processed += 1
            row_number = reader.line_num

            slug = (row.get("slug") or "").strip() or None
            product_id_hint = (row.get("product_id") or "").strip() or None
            variant_id_hint = (row.get("variant_id") or "").strip() or None
            sku_hint = (row.get("sku") or "").strip() or None

            # A row identifies its product via product_id > slug > (sku lookup,
            # since sku is now globally unique) — this is what lets a pure
            # update file carry only 'sku'/'product_id' + the field being
            # changed, with no 'slug' column at all. Only a genuinely NEW
            # product (no existing match found) still needs 'slug'.
            group_key = product_id_hint or slug
            if group_key is None and sku_hint:
                existing_variant = await self.service.variant_repo.get_by_sku(sku_hint)
                if existing_variant is not None:
                    product_id_hint = str(existing_variant.product_id)
                    group_key = product_id_hint

            if group_key is None:
                message = (
                    f"el sku '{sku_hint}' no existe — para crear un producto nuevo también necesitás la columna 'slug'"
                    if sku_hint
                    else "la fila necesita 'product_id', 'slug' o 'sku' para poder identificarse"
                )
                report.errors.append(ImportRowError(row_number=row_number, identifier=sku_hint, message=message))
                continue

            try:
                product_fields, variant_fields = map_row(row, present)
            except RowError as exc:
                report.errors.append(ImportRowError(row_number=row_number, identifier=slug or sku_hint, message=str(exc)))
                continue

            ctx = _RowCtx(row_number, product_fields, variant_fields, product_id_hint, variant_id_hint)
            if group_key not in groups:
                groups[group_key] = []
                group_order.append(group_key)
            groups[group_key].append(ctx)

        for slug in group_order:
            rows = groups[slug]
            try:
                async with self.db.begin_nested():
                    tally = await self._write_group(slug, rows)
            except (APIException, RowError) as exc:
                row_number = getattr(exc, "row_number", None) or rows[0].row_number
                message = getattr(exc, "message", None) or str(exc)
                report.errors.append(ImportRowError(row_number=row_number, identifier=slug, message=message))
            except IntegrityError:
                report.errors.append(
                    ImportRowError(row_number=None, identifier=slug, message=f"Conflicto de integridad en '{slug}' — grupo descartado")
                )
            else:
                report.products_created += tally["products_created"]
                report.products_updated += tally["products_updated"]
                report.variants_created += tally["variants_created"]
                report.variants_updated += tally["variants_updated"]

        return report

    async def _write_group(self, slug: str, rows: list[_RowCtx]) -> dict:
        tally = {"products_created": 0, "products_updated": 0, "variants_created": 0, "variants_updated": 0}

        merged_product_fields: dict = {}
        for ctx in rows:
            for key, value in ctx.product_fields.items():
                if key in merged_product_fields and merged_product_fields[key] != value:
                    raise RowError(f"valores distintos para '{key}' entre filas del producto '{slug}'", row_number=ctx.row_number)
                merged_product_fields[key] = value

        if "category_slug" in merged_product_fields:
            cat_slug = merged_product_fields.pop("category_slug")
            if cat_slug is None:
                merged_product_fields["category_id"] = None
            else:
                category = await self.category_repo.get_by_slug(cat_slug)
                if not category:
                    raise RowError(f"category_slug '{cat_slug}' no existe")
                merged_product_fields["category_id"] = category.id

        hints = {c.product_id_hint for c in rows if c.product_id_hint}
        if len(hints) > 1:
            raise RowError(f"product_id inconsistente entre filas del producto '{slug}'")
        product_id_hint = next(iter(hints), None)

        existing_product = None
        if product_id_hint:
            try:
                pid = uuid.UUID(product_id_hint)
            except ValueError:
                raise RowError(f"product_id inválido: '{product_id_hint}'")
            try:
                existing_product = await self.service.get_by_id(pid)
            except NotFoundException:
                raise RowError(f"product_id '{product_id_hint}' no encontrado")
        else:
            found = await self.service.repo.get_by_slug(slug)
            if found:
                existing_product = await self.service.get_by_id(found.id)

        if existing_product is None:
            return await self._create_group(slug, merged_product_fields, rows, tally)
        return await self._update_group(existing_product, merged_product_fields, rows, tally)

    async def _create_group(self, slug: str, merged_product_fields: dict, rows: list, tally: dict) -> dict:
        for col in CREATE_ONLY_REQUIRED:
            if col not in merged_product_fields:
                raise RowError(f"'{col}' es obligatorio para crear un producto nuevo (producto '{slug}')")
        if "name" not in merged_product_fields:
            raise RowError(f"'name' es obligatorio para crear un producto nuevo (producto '{slug}')")

        merged_product_fields.pop("slug", None)
        is_active = merged_product_fields.pop("is_active", True)
        made_to_order = merged_product_fields.pop("made_to_order", False)

        variants_payload = []
        for ctx in rows:
            vf = dict(ctx.variant_fields)
            if "sku" not in vf or "name" not in vf or "price" not in vf:
                raise RowError(f"faltan campos obligatorios de variante en la fila {ctx.row_number}", row_number=ctx.row_number)
            variants_payload.append(ProductVariantCreate(**vf))

        create_data = ProductCreate(
            slug=slug,
            is_active=is_active,
            made_to_order=made_to_order,
            variants=variants_payload,
            **merged_product_fields,
        )
        await self.service.create(create_data)
        tally["products_created"] += 1
        tally["variants_created"] += len(variants_payload)
        return tally

    async def _update_group(self, existing_product, merged_product_fields: dict, rows: list, tally: dict) -> dict:
        changed_product_fields = _dirty(existing_product, merged_product_fields)
        if changed_product_fields:
            await self.service.update(existing_product.id, ProductUpdate(**changed_product_fields))

        # reload so `product.iva_rate` reflects the update above before any
        # variant price is converted with it (D-note: product before variants)
        product = await self.service.get_by_id(existing_product.id)
        if changed_product_fields:
            tally["products_updated"] += 1

        for ctx in rows:
            variant = self._resolve_variant(product, ctx)
            vf = dict(ctx.variant_fields)

            if variant is not None:
                mode = vf.pop("price_input_mode", "net")
                if "price" in vf:
                    vf["price"] = _to_net_price(vf["price"], mode, product.iva_rate)
                changed = _dirty(variant, vf)
                if changed:
                    await self.service.update_variant(variant.id, ProductVariantUpdate(**changed, price_input_mode="net"))
                    tally["variants_updated"] += 1
            else:
                if "sku" not in vf or "name" not in vf or "price" not in vf:
                    raise RowError(f"faltan campos obligatorios de variante en la fila {ctx.row_number}", row_number=ctx.row_number)
                await self.service.create_variant(product.id, ProductVariantCreate(**vf))
                tally["variants_created"] += 1

        return tally

    def _resolve_variant(self, product, ctx: _RowCtx):
        if ctx.variant_id_hint:
            try:
                v_id = uuid.UUID(ctx.variant_id_hint)
            except ValueError:
                raise RowError(f"variant_id inválido: '{ctx.variant_id_hint}'", row_number=ctx.row_number)
            variant = next((v for v in product.variants if v.id == v_id and v.deleted_at is None), None)
            if variant is None:
                raise RowError(
                    f"variant_id '{ctx.variant_id_hint}' no pertenece al producto '{product.slug}'", row_number=ctx.row_number
                )
            return variant

        sku = ctx.variant_fields.get("sku")
        if sku:
            return next((v for v in product.variants if v.sku == sku and v.deleted_at is None), None)
        return None
