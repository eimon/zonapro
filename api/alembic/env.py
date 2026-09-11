import asyncio
import sys
from pathlib import Path
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.config import settings
from core.database import Base
from models.user import User  # noqa: F401 — registrar todos los modelos aquí
from models.password_reset_token import PasswordResetToken  # noqa: F401
from models.category import Category  # noqa: F401
from models.product import Product, ProductVariant  # noqa: F401
from models.supply import Supply, SupplyVariant  # noqa: F401
from models.package import Package, PackageOptionGroup, PackageOption  # noqa: F401
from models.consultation import Consultation  # noqa: F401
from models.app_setting import AppSetting  # noqa: F401
from models.quote import Quote, QuoteItem  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
