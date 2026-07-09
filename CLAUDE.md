# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

ZonaPro is a B2B ecommerce platform for solar energy products. It's a monorepo with two services:

- `api/` — FastAPI backend (Python, async, PostgreSQL via asyncpg)
- `web/` — Next.js 16 frontend (React 19, TypeScript, App Router)

All services run via Docker Compose. The `.env` file at repo root is used by `docker-compose.yml`; `api/.env.example` shows the required variables.

## Running the project

```bash
# Start all services (db, api, web)
docker compose up -d

# View logs
docker compose logs -f api
docker compose logs -f web
```

API is at `http://localhost:8000`, docs at `http://localhost:8000/docs`. Web is at `http://localhost:3000`.

## API commands

All commands run inside the container via `docker compose exec api`:

```bash
# Migrations
docker compose exec api alembic revision --autogenerate -m "description_snake_case"
docker compose exec api alembic upgrade head
docker compose exec api alembic current

# Run a Python script or shell
docker compose exec api python -c "..."
docker compose exec api bash
```

## Web commands

```bash
cd web
npm run dev     # dev server (also runs via docker compose)
npm run build   # production build
npm run lint    # ESLint
```

## API architecture

**Layer contract — never skip layers:**

```
Router → Service → Repository → DB
```

- Router: validates input, delegates to service, returns HTTP response
- Service: business logic, raises typed exceptions, never touches DB directly
- Repository: DB access only, never raises business exceptions, always `flush()` + `refresh()` after writes, never `commit()`
- `get_db()` handles commit/rollback automatically

**Models** must inherit `UUIDMixin, TimestampMixin, SoftDeleteMixin, Base`. All IDs are UUID. Soft delete sets `deleted_at` + `is_active = False`; `get_all()` always filters `deleted_at.is_(None)`.

Every new model must be imported in both `models/__init__.py` and `alembic/env.py`.

**Exceptions** — use only what's in `exceptions/general.py`: `NotFoundException`, `ConflictException`, `BadRequestException`, `ForbiddenException`, `UnauthorizedException`. Services never return `None`; they raise `NotFoundException`.

**Schemas** follow the `RecursoCreate / RecursoUpdate / RecursoResponse` pattern. Update schemas have all fields optional. Response schemas include `model_config = {"from_attributes": True}`.

**Auth** — JWT with `sub=str(user.id)` and `role=user.role.value`. Use `Depends(get_current_user)` for auth, `Depends(has_role(Permission.X))` for permission checks. Roles and their permissions are defined in `core/roles.py` (ADMIN, VENDEDOR, CLIENTE).

**Scaffolding a new resource:**
1. `models/<recurso>.py`
2. `schemas/<recurso>.py`
3. `repositories/<recurso>_repository.py` (extends `BaseRepository`)
4. `services/<recurso>_service.py`
5. `routers/<recurso>.py` (prefix `/api/v1/<plural>`)
6. Register in `models/__init__.py`, `main.py`, and `alembic/env.py`

## Web architecture

**Next.js App Router** with two route groups (not in URL):

- `(auth)/` — unauthenticated pages (login, etc.)
- `(dashboard)/` — authenticated pages; `layout.tsx` acts as auth guard

Token is stored as a cookie (7-day, SameSite=Lax). Use `getToken()`, `setToken()`, `removeToken()` from `lib/auth.ts`.

**HTTP client** — `lib/api.ts` exposes a typed `api` object with modules per resource (e.g., `api.users.list(token)`). The `request<T>()` helper adds the Bearer token, throws on HTTP errors, returns `undefined` on 204. New resource modules follow the same pattern as the existing `users` module.

**Component model** — default to Server Components (`async` function, no `"use client"`). Add `"use client"` only when state, effects, or event handlers are needed.

**Forms** use react-hook-form + zod. Define a `z.object` schema, infer the type, use `zodResolver`.

**Styles** are Tailwind-only (v4). UI text is in Spanish.
