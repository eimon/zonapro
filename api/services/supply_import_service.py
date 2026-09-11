import uuid
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from exceptions.general import APIException, NotFoundException
from schemas.supply import (
    ImportRowError,
    SupplyCreate,
    SupplyImportReport,
    SupplyUpdate,
    SupplyVariantCreate,
    SupplyVariantUpdate,
)
from services.csv_common import RowError
from services.supply_csv import CREATE_ONLY_REQUIRED, decode_and_read, map_row
from services.product_service import _to_net_price
from services.supply_service import SupplyService


class _RowCtx:
    """One parsed CSV row, grouped by supply name before any DB write happens."""

    __slots__ = ("row_number", "supply_fields", "variant_fields", "supply_id_hint", "variant_id_hint")

    def __init__(self, row_number, supply_fields, variant_fields, supply_id_hint, variant_id_hint):
        self.row_number = row_number
        self.supply_fields = supply_fields
        self.variant_fields = variant_fields
        self.supply_id_hint = supply_id_hint
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


class SupplyImportService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.service = SupplyService(db)

    async def run(self, raw: bytes, dry_run: bool) -> SupplyImportReport:
        report = SupplyImportReport(
            dry_run=dry_run,
            rows_processed=0,
            supplies_created=0,
            supplies_updated=0,
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

            name = (row.get("name") or "").strip() or None
            supply_id_hint = (row.get("supply_id") or "").strip() or None
            variant_id_hint = (row.get("variant_id") or "").strip() or None
            sku_hint = (row.get("sku") or "").strip() or None

            # A row identifies its supply via supply_id > name (since Supply has
            # no slug, its own unique-active-name index plays that role) >
            # (sku lookup, since sku is globally unique among active supply
            # variants) — this lets a pure update file carry only
            # 'sku'/'supply_id' + the field being changed, with no 'name'
            # column at all. Only a genuinely NEW supply (no existing match
            # found) still needs 'name'.
            group_key = supply_id_hint or name
            if group_key is None and sku_hint:
                existing_variant = await self.service.variant_repo.get_by_sku(sku_hint)
                if existing_variant is not None:
                    supply_id_hint = str(existing_variant.supply_id)
                    group_key = supply_id_hint

            if group_key is None:
                message = (
                    f"el sku '{sku_hint}' no existe — para crear un insumo nuevo también necesitás la columna 'name'"
                    if sku_hint
                    else "la fila necesita 'supply_id', 'name' o 'sku' para poder identificarse"
                )
                report.errors.append(ImportRowError(row_number=row_number, identifier=sku_hint, message=message))
                continue

            try:
                supply_fields, variant_fields = map_row(row, present)
            except RowError as exc:
                report.errors.append(ImportRowError(row_number=row_number, identifier=name or sku_hint, message=str(exc)))
                continue

            ctx = _RowCtx(row_number, supply_fields, variant_fields, supply_id_hint, variant_id_hint)
            if group_key not in groups:
                groups[group_key] = []
                group_order.append(group_key)
            groups[group_key].append(ctx)

        for name in group_order:
            rows = groups[name]
            try:
                async with self.db.begin_nested():
                    tally = await self._write_group(name, rows)
            except (APIException, RowError) as exc:
                row_number = getattr(exc, "row_number", None) or rows[0].row_number
                message = getattr(exc, "message", None) or str(exc)
                report.errors.append(ImportRowError(row_number=row_number, identifier=name, message=message))
            except IntegrityError:
                report.errors.append(
                    ImportRowError(row_number=None, identifier=name, message=f"Conflicto de integridad en '{name}' — grupo descartado")
                )
            else:
                report.supplies_created += tally["supplies_created"]
                report.supplies_updated += tally["supplies_updated"]
                report.variants_created += tally["variants_created"]
                report.variants_updated += tally["variants_updated"]

        return report

    async def _write_group(self, name: str, rows: list[_RowCtx]) -> dict:
        tally = {"supplies_created": 0, "supplies_updated": 0, "variants_created": 0, "variants_updated": 0}

        merged_supply_fields: dict = {}
        for ctx in rows:
            for key, value in ctx.supply_fields.items():
                if key in merged_supply_fields and merged_supply_fields[key] != value:
                    raise RowError(f"valores distintos para '{key}' entre filas del insumo '{name}'", row_number=ctx.row_number)
                merged_supply_fields[key] = value

        hints = {c.supply_id_hint for c in rows if c.supply_id_hint}
        if len(hints) > 1:
            raise RowError(f"supply_id inconsistente entre filas del insumo '{name}'")
        supply_id_hint = next(iter(hints), None)

        existing_supply = None
        if supply_id_hint:
            try:
                sid = uuid.UUID(supply_id_hint)
            except ValueError:
                raise RowError(f"supply_id inválido: '{supply_id_hint}'")
            try:
                existing_supply = await self.service.get_by_id(sid)
            except NotFoundException:
                raise RowError(f"supply_id '{supply_id_hint}' no encontrado")
        else:
            found = await self.service.repo.get_by_name(name)
            if found:
                existing_supply = await self.service.get_by_id(found.id)

        if existing_supply is None:
            return await self._create_group(name, merged_supply_fields, rows, tally)
        return await self._update_group(existing_supply, merged_supply_fields, rows, tally)

    async def _create_group(self, name: str, merged_supply_fields: dict, rows: list, tally: dict) -> dict:
        for col in CREATE_ONLY_REQUIRED:
            if col not in merged_supply_fields:
                raise RowError(f"'{col}' es obligatorio para crear un insumo nuevo (insumo '{name}')")

        merged_supply_fields.pop("name", None)
        is_active = merged_supply_fields.pop("is_active", True)

        variants_payload = []
        for ctx in rows:
            vf = dict(ctx.variant_fields)
            if "sku" not in vf or "name" not in vf or "price" not in vf:
                raise RowError(f"faltan campos obligatorios de variante en la fila {ctx.row_number}", row_number=ctx.row_number)
            variants_payload.append(SupplyVariantCreate(**vf))

        create_data = SupplyCreate(
            name=name,
            is_active=is_active,
            variants=variants_payload,
            **merged_supply_fields,
        )
        await self.service.create(create_data)
        tally["supplies_created"] += 1
        tally["variants_created"] += len(variants_payload)
        return tally

    async def _update_group(self, existing_supply, merged_supply_fields: dict, rows: list, tally: dict) -> dict:
        changed_supply_fields = _dirty(existing_supply, merged_supply_fields)
        if changed_supply_fields:
            await self.service.update(existing_supply.id, SupplyUpdate(**changed_supply_fields))

        # reload so `supply.iva_rate` reflects the update above before any
        # variant price is converted with it (mirrors product_import_service:
        # supply before variants)
        supply = await self.service.get_by_id(existing_supply.id)
        if changed_supply_fields:
            tally["supplies_updated"] += 1

        for ctx in rows:
            variant = self._resolve_variant(supply, ctx)
            vf = dict(ctx.variant_fields)

            if variant is not None:
                mode = vf.pop("price_input_mode", "net")
                if "price" in vf:
                    vf["price"] = _to_net_price(vf["price"], mode, supply.iva_rate)
                changed = _dirty(variant, vf)
                if changed:
                    await self.service.update_variant(variant.id, SupplyVariantUpdate(**changed, price_input_mode="net"))
                    tally["variants_updated"] += 1
            else:
                if "sku" not in vf or "name" not in vf or "price" not in vf:
                    raise RowError(f"faltan campos obligatorios de variante en la fila {ctx.row_number}", row_number=ctx.row_number)
                await self.service.create_variant(supply.id, SupplyVariantCreate(**vf))
                tally["variants_created"] += 1

        return tally

    def _resolve_variant(self, supply, ctx: _RowCtx):
        if ctx.variant_id_hint:
            try:
                v_id = uuid.UUID(ctx.variant_id_hint)
            except ValueError:
                raise RowError(f"variant_id inválido: '{ctx.variant_id_hint}'", row_number=ctx.row_number)
            variant = next((v for v in supply.variants if v.id == v_id and v.deleted_at is None), None)
            if variant is None:
                raise RowError(
                    f"variant_id '{ctx.variant_id_hint}' no pertenece al insumo '{supply.name}'", row_number=ctx.row_number
                )
            return variant

        sku = ctx.variant_fields.get("sku")
        if sku:
            return next((v for v in supply.variants if v.sku == sku and v.deleted_at is None), None)
        return None
