# Convenciones — Frontend Next.js

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4
- App Router con grupos de rutas
- react-hook-form + zod — formularios y validación
- Token JWT en cookie (client-side)

## Estructura del proyecto

```
app/
├── layout.tsx             # Root layout: fuentes, globals.css
├── page.tsx               # Redirect a /dashboard
├── globals.css            # @import tailwindcss + tw-animate-css
├── (auth)/
│   ├── layout.tsx         # Layout centrado para login
│   └── login/
│       └── page.tsx
└── (dashboard)/
    ├── layout.tsx         # Guard de token + shell de navegación
    └── page.tsx           # Página principal del dashboard
lib/
├── api.ts                 # fetch wrapper tipado + módulos por recurso
└── auth.ts                # getToken(), setToken(), removeToken() en cookie
components/
└── ui/                    # Componentes de UI reutilizables
```

## Autenticación

El token se guarda en cookie (7 días, SameSite=Lax):

```ts
import { getToken, setToken, removeToken } from "@/lib/auth";

// En login:
setToken(res.access_token);

// En guard o peticiones:
const token = getToken();
if (!token) router.replace("/login");
```

- El `(dashboard)/layout.tsx` verifica el token en `useEffect` y redirige si no existe
- Para logout: `removeToken()` + `router.replace("/login")`

## Cliente HTTP

```ts
import { api } from "@/lib/api";
const token = getToken();

// Login — form-encoded (OAuth2PasswordRequestForm)
const res = await api.auth.login(email, password);

// Llamadas autenticadas
const users = await api.users.list(token!);
```

El helper `request<T>()` en `lib/api.ts`:
- Agrega `Authorization: Bearer <token>` si se pasa token
- Lanza `Error` con el `detail` del servidor en caso de error HTTP
- Retorna `undefined` en 204

Para agregar un módulo nuevo en `lib/api.ts`:

```ts
<recurso>: {
  list: (token: string) =>
    request<<Tipo>[]>("/api/v1/<recurso>/", {}, token),
  get: (id: string, token: string) =>
    request<<Tipo>>(`/api/v1/<recurso>/${id}`, {}, token),
  create: (data: unknown, token: string) =>
    request<<Tipo>>("/api/v1/<recurso>/", { method: "POST", body: JSON.stringify(data) }, token),
  update: (id: string, data: unknown, token: string) =>
    request<<Tipo>>(`/api/v1/<recurso>/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),
  remove: (id: string, token: string) =>
    request<void>(`/api/v1/<recurso>/${id}`, { method: "DELETE" }, token),
},
```

## Routing (App Router)

- Grupos `(auth)` y `(dashboard)` no aparecen en la URL
- `(dashboard)/layout.tsx` actúa como guard de autenticación
- Rutas dinámicas: `[id]/page.tsx` → tipar `params: { id: string }`

## Server vs Client Components

- **Server Component** por defecto — sin `"use client"`, puede ser `async`
- **Client Component** — agregar `"use client"` solo cuando sea necesario: estado, efectos, event handlers

```tsx
// Server Component (preferido)
export default async function Page() { ... }

// Client Component (solo cuando sea necesario)
"use client";
export default function Page() {
  const [data, setData] = useState(null);
  useEffect(() => { ... }, []);
}
```

## Formularios

Usar react-hook-form + zod:

```tsx
const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Requerido"),
});
type FormData = z.infer<typeof schema>;
const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });
```

## Convenciones de código

- Sin comentarios salvo WHY no obvio
- Solo español en textos de UI
- Estilos exclusivamente con Tailwind
- `"use client"` solo cuando sea necesario

---

## Scaffolding: nueva página

Para agregar una página en el dashboard (ej: `usuarios`):

1. Crear `app/(dashboard)/usuarios/page.tsx`
2. Si tiene parámetros dinámicos: `app/(dashboard)/usuarios/[id]/page.tsx`
3. Si necesita datos: agregar módulo en `lib/api.ts`
4. Usar `"use client"` solo si necesita estado o event handlers

## Scaffolding: nuevo módulo de API

Agregar en `lib/api.ts` siguiendo el patrón de `users` existente.
Siempre tipado: definir el tipo de respuesta como `type` o `interface` en el mismo archivo.
