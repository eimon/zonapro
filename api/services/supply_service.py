import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from repositories.supply_repository import SupplyRepository, SupplyVariantRepository
from schemas.supply import SupplyCreate, SupplyUpdate, SupplyVariantCreate, SupplyVariantUpdate
from models.supply import Supply, SupplyVariant
from services.product_service import _to_net_price, _compute_final_price
from exceptions.general import NotFoundException, ConflictException, BadRequestException


def _attach_variant_final_prices(supply: Supply) -> Supply:
    for variant in supply.variants:
        variant.final_price = _compute_final_price(variant.price, supply.iva_rate)
    return supply


class SupplyService:
    def __init__(self, db: AsyncSession):
        self.repo = SupplyRepository(db)
        self.variant_repo = SupplyVariantRepository(db)

    async def _assert_sku_free(self, sku: str, exclude_id: uuid.UUID | None = None) -> None:
        clash = await self.variant_repo.get_by_sku(sku, exclude_id=exclude_id)
        if clash:
            raise ConflictException(
                f"El SKU '{sku}' ya pertenece al insumo '{clash.supply.name}'"
            )

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Supply]:
        supplies = await self.repo.get_all_with_variants(skip=skip, limit=limit)
        return [_attach_variant_final_prices(s) for s in supplies]

    async def get_by_id(self, id: uuid.UUID) -> Supply:
        obj = await self.repo.get_with_variants(id)
        if not obj:
            raise NotFoundException("Insumo no encontrado")
        return _attach_variant_final_prices(obj)

    async def create(self, data: SupplyCreate) -> Supply:
        existing = await self.repo.get_by_name(data.name)
        if existing:
            raise ConflictException("Ya existe un insumo con ese nombre")

        seen_skus: set[str] = set()
        for variant_data in data.variants:
            if variant_data.sku in seen_skus:
                raise ConflictException(f"El SKU '{variant_data.sku}' está repetido en el mismo insumo")
            seen_skus.add(variant_data.sku)
            await self._assert_sku_free(variant_data.sku)

        supply = await self.repo.create(data)

        for variant_data in data.variants:
            variant_price = _to_net_price(variant_data.price, variant_data.price_input_mode, data.iva_rate)
            await self.variant_repo.create(supply.id, variant_data, price=variant_price)

        # reload with variants
        reloaded = await self.repo.get_with_variants(supply.id)
        return _attach_variant_final_prices(reloaded)

    async def update(self, id: uuid.UUID, data: SupplyUpdate) -> Supply:
        obj = await self.get_by_id(id)
        update_data = data.model_dump(exclude_unset=True)
        if "name" in update_data and update_data["name"] != obj.name:
            existing = await self.repo.get_by_name(update_data["name"])
            if existing:
                raise ConflictException("Ya existe un insumo con ese nombre")

        await self.repo.update(obj, **update_data)
        reloaded = await self.repo.get_with_variants(obj.id)
        return _attach_variant_final_prices(reloaded)

    async def delete(self, id: uuid.UUID) -> None:
        obj = await self.get_by_id(id)
        await self.variant_repo.soft_delete_all_for_supply(obj.id)
        result = await self.repo.soft_delete(obj.id)
        if not result:
            raise NotFoundException("Insumo no encontrado")

    async def create_variant(self, supply_id: uuid.UUID, data: SupplyVariantCreate) -> SupplyVariant:
        supply = await self.get_by_id(supply_id)  # ensures supply exists
        await self._assert_sku_free(data.sku)
        price = _to_net_price(data.price, data.price_input_mode, supply.iva_rate)
        variant = await self.variant_repo.create(supply_id, data, price=price)
        variant.final_price = _compute_final_price(variant.price, supply.iva_rate)
        return variant

    async def update_variant(self, variant_id: uuid.UUID, data: SupplyVariantUpdate) -> SupplyVariant:
        obj = await self.variant_repo.get_by_id(variant_id)
        if not obj or obj.deleted_at is not None:
            raise NotFoundException("Variante no encontrada")
        update_data = data.model_dump(exclude_unset=True)
        if "stock_qty" in update_data and update_data["stock_qty"] < 0:
            raise BadRequestException("El stock no puede ser negativo")
        if "sku" in update_data and update_data["sku"] != obj.sku:
            await self._assert_sku_free(update_data["sku"], exclude_id=obj.id)

        supply = await self.repo.get_by_id(obj.supply_id)
        price_input_mode = update_data.pop("price_input_mode", "net")
        if "price" in update_data and update_data["price"] is not None:
            update_data["price"] = _to_net_price(update_data["price"], price_input_mode, supply.iva_rate)

        variant = await self.variant_repo.update(obj, **update_data)
        variant.final_price = _compute_final_price(variant.price, supply.iva_rate)
        return variant

    async def delete_variant(self, variant_id: uuid.UUID) -> None:
        variant = await self.variant_repo.get_by_id(variant_id)
        if not variant or variant.deleted_at is not None:
            raise NotFoundException("Variante no encontrada")

        active_count = await self.variant_repo.count_active_for_supply(variant.supply_id)
        if active_count <= 1:
            raise BadRequestException("No podés eliminar la única variante del insumo")

        result = await self.variant_repo.hard_delete(variant_id)
        if not result:
            raise NotFoundException("Variante no encontrada")
