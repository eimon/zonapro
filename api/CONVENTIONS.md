# Convenciones — FastAPI Template

## Estructura del proyecto

```
api/
├── main.py                    # App FastAPI, registro de routers y middleware
├── alembic.ini
├── alembic/
│   ├── env.py                 # Async con async_engine_from_config
│   └── versions/
├── core/
│   ├── config.py              # Settings con pydantic-settings
│   ├── database.py            # AsyncSession, get_db()
│   ├── security.py            # JWT, argon2, refresh tokens
│   └── roles.py               # Jerarquía de permisos por rol
├── exceptions/
│   ├── general.py             # NotFoundException, ForbiddenException, etc.
│   └── handlers.py            # register_exception_handlers(app)
├── dependencies/
│   └── auth.py                # get_current_user, has_role()
├── models/
│   ├── base.py                # UUIDMixin, TimestampMixin, SoftDeleteMixin
│   └── __init__.py            # Importa todos los modelos (necesario para Alembic)
├── repositories/
│   └── base.py                # BaseRepository[T] con get_by_id, get_all, soft_delete
├── schemas/                   # Pydantic: Create, Update, Response
├── services/                  # Lógica de negocio, lanza excepciones
└── routers/                   # Endpoints FastAPI
```

## Patrón de capas

```
Router → Service → Repository → DB
```

- El **router** solo recibe/valida request y delega al service
- El **service** contiene la lógica de negocio y lanza excepciones
- El **repository** accede a la DB, nunca lanza excepciones de negocio
- **Nunca saltar capas**: el router no toca el repository directamente

## Base de datos

- `get_db()` hace auto-commit en éxito y auto-rollback en excepción — el repository nunca llama a `commit()`
- Repository: siempre `flush()` + `refresh()` después de modificar, nunca `commit()`
- Soft delete: `deleted_at = datetime.now(timezone.utc)` + `is_active = False`
- `get_all()` siempre filtra `deleted_at.is_(None)`
- IDs: UUID en todos los modelos, nunca enteros

## Modelos

```python
class MiModelo(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "mis_modelos"
    # campos del dominio
```

- Heredar siempre de `UUIDMixin`, `TimestampMixin`, `SoftDeleteMixin`, `Base`
- `__tablename__` en plural snake_case
- Todo modelo nuevo debe importarse en `models/__init__.py` y en `alembic/env.py`

## Schemas

```python
class RecursoCreate(BaseModel):
    campo: tipo

class RecursoUpdate(BaseModel):
    campo: tipo | None = None   # todos opcionales

class RecursoResponse(BaseModel):
    id: uuid.UUID
    # campos del modelo
    model_config = {"from_attributes": True}
```

## Excepciones

Solo usar las del módulo `exceptions.general`:

| Excepción | Cuándo |
|-----------|--------|
| `NotFoundException` | Recurso no existe por ID |
| `ConflictException` | Violación de unicidad o estado inválido |
| `BadRequestException` | Input inválido de negocio |
| `ForbiddenException` | Sin permisos para la acción |
| `UnauthorizedException` | Sin sesión o token inválido |

El service nunca devuelve `None` — lanza `NotFoundException` si no encuentra.

## Autenticación y roles

- JWT: `sub=str(user.id)`, `role=user.role.value`
- `get_current_user` → valida token y carga usuario de DB
- `has_role(Permission.X)` → verifica permiso en el rol del usuario
- Los roles y sus permisos viven en `core/roles.py`

```python
# En router:
_: User = Depends(has_role(Permission.USER_MANAGE))
```

## Alembic (migraciones)

- `alembic/env.py` usa `async_engine_from_config` — no sincrónico
- Para generar migración: `alembic revision --autogenerate -m "descripcion"`
- Para aplicar: `alembic upgrade head`
- Si la migración autogenerada está vacía: verificar que el modelo esté importado en `alembic/env.py`
- **Nunca modificar migraciones ya aplicadas en producción**

## Convenciones de código

- Sin comentarios salvo que el WHY sea no obvio
- Sin docstrings multi-línea
- Sin manejo de errores para escenarios imposibles
- Validación solo en boundaries del sistema (input del usuario, APIs externas)

---

## Scaffolding: nuevo recurso

Para agregar un recurso nuevo (ej: `Producto`), crear en orden:

1. **`models/<recurso>.py`** — modelo SQLAlchemy con los mixins
2. **`schemas/<recurso>.py`** — Create, Update, Response
3. **`repositories/<recurso>_repository.py`** — hereda `BaseRepository`, agrega métodos específicos
4. **`services/<recurso>_service.py`** — lógica, lanza excepciones, nunca toca DB directamente
5. **`routers/<recurso>.py`** — endpoints con prefix `/api/v1/<plural>`, status codes correctos
6. Registrar en **`models/__init__.py`**, **`main.py`** y **`alembic/env.py`**

## Scaffolding: migración

1. Verificar que el modelo esté importado en `alembic/env.py`
2. `docker compose exec api alembic revision --autogenerate -m "<descripcion_snake_case>"`
3. Revisar el archivo generado en `alembic/versions/`
4. `docker compose exec api alembic upgrade head`
5. `docker compose exec api alembic current` para verificar
