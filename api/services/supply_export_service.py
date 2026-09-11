from sqlalchemy.ext.asyncio import AsyncSession
from repositories.supply_repository import SupplyRepository
from services.product_export_service import _compute_final_price
from services.supply_csv import serialize_row, write_csv


class SupplyExportService:
    def __init__(self, db: AsyncSession):
        self.repo = SupplyRepository(db)

    async def build_csv(self, delimiter: str = ",") -> str:
        supplies = await self.repo.get_all_for_export()

        rows: list[list[str]] = []
        for supply in supplies:
            for variant in supply.variants:
                if variant.deleted_at is not None:
                    continue  # the relationship has no deleted_at filter — skip soft-deleted variants
                final_price = _compute_final_price(variant.price, supply.iva_rate)
                rows.append(serialize_row(supply, variant, final_price))

        return write_csv(rows, delimiter=delimiter)
