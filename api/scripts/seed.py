"""
Seed script — runs on every container start (idempotent via upsert).
Creates: admin user, categories, sample products with variants.
"""

import asyncio
import sys
import os

# Ensure the api/ directory is on the path when run from the container root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from core.database import AsyncSessionLocal
from core.security import get_password_hash
from models.user import User, UserRole
from models.category import Category
from models.product import Product, ProductVariant


# ── Data ──────────────────────────────────────────────────────────────────────

ADMIN = {
    "nombre": "Admin",
    "apellido": "ZonaPro",
    "email": "admin@zonapro.com",
    "password": "Admin1234!",
    "role": UserRole.ADMIN,
}

CATEGORIES = [
    {"name": "Climatización",     "slug": "climatizacion",     "description": "Equipos de frío y calor"},
    {"name": "Domótica",          "slug": "domotica",          "description": "Control inteligente del hogar"},
    {"name": "Eficiencia Térmica","slug": "eficiencia-termica","description": "Aislación y ahorro energético"},
    {"name": "Energía Solar",     "slug": "energia-solar",     "description": "Paneles y sistemas fotovoltaicos"},
]

# Each entry: product dict + list of variants
PRODUCTS = [
    {
        "product": {
            "name": "Split Inverter 3000 Frig",
            "slug": "split-inverter-3000",
            "description": "Equipo de aire acondicionado inverter frío/calor de alta eficiencia.",
            "base_price": 0,
            "made_to_order": False,
            "category_slug": "climatizacion",
        },
        "variants": [
            {"sku": "SPLIT-3000-BL", "name": "Blanco", "price": 850000, "stock_qty": 5},
            {"sku": "SPLIT-3000-GR", "name": "Gris",   "price": 870000, "stock_qty": 3},
        ],
    },
    {
        "product": {
            "name": "Kit Domótica Starter",
            "slug": "kit-domotica-starter",
            "description": "Hub central + 2 enchufes inteligentes + 1 tira LED RGBW.",
            "base_price": 0,
            "made_to_order": False,
            "category_slug": "domotica",
        },
        "variants": [
            {"sku": "KIT-DOM-STD", "name": "Estándar", "price": 320000, "stock_qty": 10},
        ],
    },
    {
        "product": {
            "name": "Panel Solar 400W Monocristalino",
            "slug": "panel-solar-400w",
            "description": "Panel fotovoltaico monocristalino de 400W, alta eficiencia.",
            "base_price": 0,
            "made_to_order": False,
            "category_slug": "energia-solar",
        },
        "variants": [
            {"sku": "PS-400W-UN",  "name": "Único", "price": 210000, "stock_qty": 20},
        ],
    },
    {
        "product": {
            "name": "Instalación Solar Residencial",
            "slug": "instalacion-solar-residencial",
            "description": "Sistema fotovoltaico on-grid a medida para viviendas. Incluye proyecto e instalación.",
            "base_price": 0,
            "made_to_order": True,
            "category_slug": "energia-solar",
        },
        "variants": [
            {"sku": "INST-SOL-3KW",  "name": "3 kWp",  "price": 4500000, "stock_qty": 0},
            {"sku": "INST-SOL-6KW",  "name": "6 kWp",  "price": 7800000, "stock_qty": 0},
            {"sku": "INST-SOL-10KW", "name": "10 kWp", "price": 11500000,"stock_qty": 0},
        ],
    },
    {
        "product": {
            "name": "Cámara IP Exterior 4MP",
            "slug": "camara-ip-exterior-4mp",
            "description": "Cámara de seguridad IP para exteriores, visión nocturna, PoE.",
            "base_price": 0,
            "made_to_order": False,
            "category_slug": "domotica",
        },
        "variants": [
            {"sku": "CAM-4MP-BL", "name": "Blanca", "price": 95000, "stock_qty": 8},
            {"sku": "CAM-4MP-NG", "name": "Negra",  "price": 95000, "stock_qty": 6},
        ],
    },
]


# ── Helpers ───────────────────────────────────────────────────────────────────

async def upsert_admin(db) -> None:
    result = await db.execute(select(User).where(User.email == ADMIN["email"]))
    user = result.scalar_one_or_none()
    if user:
        print(f"  [skip] usuario {ADMIN['email']} ya existe")
        return
    db.add(User(
        nombre=ADMIN["nombre"],
        apellido=ADMIN["apellido"],
        email=ADMIN["email"],
        hashed_password=get_password_hash(ADMIN["password"]),
        role=ADMIN["role"],
        is_active=True,
    ))
    print(f"  [ok]   usuario {ADMIN['email']} creado  (pass: {ADMIN['password']})")


async def upsert_categories(db) -> dict[str, object]:
    slug_to_obj = {}
    for data in CATEGORIES:
        result = await db.execute(select(Category).where(Category.slug == data["slug"]))
        cat = result.scalar_one_or_none()
        if cat:
            print(f"  [skip] categoría '{data['slug']}' ya existe")
        else:
            cat = Category(**data)
            db.add(cat)
            print(f"  [ok]   categoría '{data['slug']}' creada")
        slug_to_obj[data["slug"]] = cat
    await db.flush()
    return slug_to_obj


async def upsert_products(db, categories: dict) -> None:
    for entry in PRODUCTS:
        p_data = entry["product"]
        result = await db.execute(select(Product).where(Product.slug == p_data["slug"]))
        product = result.scalar_one_or_none()
        if product:
            print(f"  [skip] producto '{p_data['slug']}' ya existe")
            continue

        cat = categories.get(p_data.pop("category_slug"))
        product = Product(**p_data, category_id=cat.id if cat else None)
        db.add(product)
        await db.flush()

        for v in entry["variants"]:
            db.add(ProductVariant(product_id=product.id, **v))

        print(f"  [ok]   producto '{product.slug}' creado ({len(entry['variants'])} variante/s)")


# ── Main ──────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("\n── Seed ZonaPro ─────────────────────────────────")
    async with AsyncSessionLocal() as db:
        print("Usuarios:")
        await upsert_admin(db)

        print("Categorías:")
        categories = await upsert_categories(db)

        print("Productos:")
        await upsert_products(db, categories)

        await db.commit()
    print("── Listo ────────────────────────────────────────\n")


if __name__ == "__main__":
    asyncio.run(main())
