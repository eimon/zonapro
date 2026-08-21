import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from models.enums import IvaRate
from repositories.product_repository import ProductRepository
from services.product_csv import serialize_row, write_csv


def _compute_final_price(price: Decimal, iva_rate: IvaRate) -> Decimal:
    rate = Decimal(iva_rate.value)
    return (price * (1 + rate / Decimal("100"))).quantize(Decimal("0.01"))


class ProductExportService:
    def __init__(self, db: AsyncSession):
        self.repo = ProductRepository(db)

    async def build_csv(
        self,
        category_id: uuid.UUID | None = None,
        made_to_order: bool | None = None,
    ) -> str:
        products = await self.repo.get_all_for_export(
            category_id=category_id,
            made_to_order=made_to_order,
        )

        rows: list[list[str]] = []
        for product in products:
            for variant in product.variants:
                if variant.deleted_at is not None:
                    continue  # the relationship has no deleted_at filter — skip soft-deleted variants
                final_price = _compute_final_price(variant.price, product.iva_rate)
                rows.append(serialize_row(product, variant, final_price))

        return write_csv(rows)
