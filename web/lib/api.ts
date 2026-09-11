const API_URL =
  typeof window === "undefined"
    ? (process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Solo poner Content-Type JSON si no es form-encoded
  if (!headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.detail ?? body.message ?? `HTTP ${res.status}`, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Enums ─────────────────────────────────────────────────────────────────────

export type PackageComplexity = "basico" | "medio" | "avanzado";
export type ConsultationType = "product" | "package" | "free_form";
export type ConsultationStatus = "pendiente" | "en_proceso" | "cerrada";
export type QuoteStatus = "borrador" | "enviada" | "aprobada" | "rechazada" | "vencida";
export type QuoteType = "productos" | "servicios";
export type QuoteItemKind = "product" | "service";
export type InstallationCostType = "fixed" | "percentage";
export type IvaRate = "0" | "10.5" | "21";

// ── Tipos base ────────────────────────────────────────────────────────────────

export type TokenResponse = { access_token: string; token_type: string };

export type UserMe = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
};

export type UserRegister = {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
};

export type RegistrationEnabled = { key: string; enabled: boolean };
export type ResendApiKeyStatus = { key: string; is_set: boolean; masked: string | null };

export type UserCreate = {
  nombre: string;
  apellido: string;
  email: string;
  role: "admin" | "vendedor";
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  attributes: Record<string, unknown> | null;
  price: string; // net
  stock_qty: number;
  final_price: string; // net + IVA, computed from the parent product's iva_rate
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iva_rate: IvaRate;
  image_url: string | null;
  made_to_order: boolean;
  category_id: string | null;
  is_active: boolean;
  variants: ProductVariant[];
};

export type ImportRowError = { row_number: number | null; identifier: string | null; message: string };
export type ImportReport = {
  dry_run: boolean;
  rows_processed: number;
  products_created: number;
  products_updated: number;
  variants_created: number;
  variants_updated: number;
  errors: ImportRowError[];
};

export type PackageOption = {
  id: string;
  group_id: string;
  label: string;
  price_delta: string;
  is_default: boolean;
  display_order: number;
};

export type PackageOptionGroup = {
  id: string;
  package_id: string;
  name: string;
  display_order: number;
  options: PackageOption[];
};

export type Package = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  complexity: PackageComplexity;
  base_price: string;
  is_active: boolean;
  option_groups: PackageOptionGroup[];
};

export type ConsultationCreate = {
  name: string;
  email: string;
  phone?: string;
  type: ConsultationType;
  message?: string;
  product_id?: string;
  package_id?: string;
  selected_options?: Record<string, string>;
};

export type ConsultationPublicResponse = {
  id: string;
  status: ConsultationStatus;
  created_at: string;
};

export type QuoteItem = {
  id: string;
  kind: QuoteItemKind;
  display_order: number;
  product_variant_id: string | null;
  product_name_snapshot: string | null;
  product_sku_snapshot: string | null;
  service_description: string | null;
  hours: string | null;
  hourly_rate_snapshot: string | null;
  quantity: number;
  unit_price: string;
  subtotal: string;
  iva_rate: string;
};

export type Quote = {
  id: string;
  title: string;
  quote_type: QuoteType;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  validity_days: number;
  notes: string | null;
  status: QuoteStatus;
  consultation_id: string | null;
  installation_cost_type: InstallationCostType | null;
  installation_cost_value: string | null;
  installation_cost_amount: string;
  contempla_iva: boolean;
  created_at: string;
  updated_at: string;
  updated_by_id: string | null;
  updated_by_name: string | null;
  items: QuoteItem[];
  total: string;
  iva_amount: string;
  // Internal fields (only present in vendor/admin responses)
  cost_notes?: string | null;
  margin_notes?: string | null;
  internal_comments?: string | null;
  created_by_id?: string;
};

// ── API client ────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    // Login usa OAuth2PasswordRequestForm → form-encoded
    login: (email: string, password: string) => {
      const clientId = process.env.NEXT_PUBLIC_CLIENT_ID ?? "";
      const clientSecret = process.env.NEXT_PUBLIC_CLIENT_SECRET ?? "";
      const body = new URLSearchParams({
        grant_type: "password",
        username: email,
        password,
        client_id: clientId,
        client_secret: clientSecret,
      });
      return request<TokenResponse>("/api/v1/auth/login", {
        method: "POST",
        body: body.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    },

    me: (token: string) =>
      request<UserMe>("/api/v1/users/me", {}, token),

    setPassword: (token: string, new_password: string) =>
      request<void>("/api/v1/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ token, new_password }),
      }),

    refresh: (token: string) =>
      request<TokenResponse>("/api/v1/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),

    register: (data: UserRegister) =>
      request<TokenResponse>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  users: {
    list: (token: string) =>
      request<UserMe[]>("/api/v1/users/", {}, token),
    get: (id: string, token: string) =>
      request<UserMe>(`/api/v1/users/${id}`, {}, token),
    create: (data: UserCreate, token: string) =>
      request<UserMe>("/api/v1/users/", {
        method: "POST",
        body: JSON.stringify(data),
      }, token),
    update: (id: string, data: unknown, token: string) =>
      request<UserMe>(`/api/v1/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }, token),
    remove: (id: string, token: string) =>
      request<void>(`/api/v1/users/${id}`, { method: "DELETE" }, token),
  },

  categories: {
    list: () => request<Category[]>("/api/v1/categories/"),
    get: (id: string) => request<Category>(`/api/v1/categories/${id}`),
    create: (data: unknown, token: string) =>
      request<Category>("/api/v1/categories/", { method: "POST", body: JSON.stringify(data) }, token),
    update: (id: string, data: unknown, token: string) =>
      request<Category>(`/api/v1/categories/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),
    remove: (id: string, token: string) =>
      request<void>(`/api/v1/categories/${id}`, { method: "DELETE" }, token),
  },

  products: {
    list: (params?: { category_id?: string; made_to_order?: boolean }) => {
      const qs = new URLSearchParams();
      if (params?.category_id) qs.set("category_id", params.category_id);
      if (params?.made_to_order !== undefined) qs.set("made_to_order", String(params.made_to_order));
      const query = qs.toString() ? `?${qs.toString()}` : "";
      return request<Product[]>(`/api/v1/products/${query}`);
    },
    get: (id: string) => request<Product>(`/api/v1/products/${id}`),
    create: (data: unknown, token: string) =>
      request<Product>("/api/v1/products/", { method: "POST", body: JSON.stringify(data) }, token),
    update: (id: string, data: unknown, token: string) =>
      request<Product>(`/api/v1/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),
    remove: (id: string, token: string) =>
      request<void>(`/api/v1/products/${id}`, { method: "DELETE" }, token),
    uploadImage: async (file: File, token: string): Promise<{ url: string }> => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/api/v1/products/upload-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(body.detail ?? "Error al subir la imagen", res.status);
      }
      return res.json();
    },
    variants: {
      create: (productId: string, data: unknown, token: string) =>
        request<ProductVariant>(`/api/v1/products/${productId}/variants`, { method: "POST", body: JSON.stringify(data) }, token),
      update: (variantId: string, data: unknown, token: string) =>
        request<ProductVariant>(`/api/v1/products/variants/${variantId}`, { method: "PATCH", body: JSON.stringify(data) }, token),
      remove: (variantId: string, token: string) =>
        request<void>(`/api/v1/products/variants/${variantId}`, { method: "DELETE" }, token),
    },
    importCsv: async (file: File, dryRun: boolean, token: string): Promise<ImportReport> => {
      const formData = new FormData();
      formData.append("file", file);
      const qs = dryRun ? "?dry_run=true" : "?dry_run=false";
      const res = await fetch(`${API_URL}/api/v1/products/import${qs}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(body.detail ?? "Error al importar el CSV", res.status);
      }
      return res.json();
    },
    exportCsv: async (token: string, delimiter: "," | ";" = ","): Promise<string> => {
      const res = await fetch(`${API_URL}/api/v1/products/export?delimiter=${encodeURIComponent(delimiter)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al exportar el catálogo");
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
  },

  packages: {
    list: () => request<Package[]>("/api/v1/packages/"),
    get: (id: string) => request<Package>(`/api/v1/packages/${id}`),
    create: (data: unknown, token: string) =>
      request<Package>("/api/v1/packages/", { method: "POST", body: JSON.stringify(data) }, token),
    update: (id: string, data: unknown, token: string) =>
      request<Package>(`/api/v1/packages/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),
    remove: (id: string, token: string) =>
      request<void>(`/api/v1/packages/${id}`, { method: "DELETE" }, token),
  },

  consultations: {
    create: (data: ConsultationCreate) =>
      request<ConsultationPublicResponse>("/api/v1/consultations/", { method: "POST", body: JSON.stringify(data) }),
    list: (token: string) => request<unknown[]>("/api/v1/consultations/", {}, token),
    get: (id: string, token: string) => request<unknown>(`/api/v1/consultations/${id}`, {}, token),
    updateStatus: (id: string, data: unknown, token: string) =>
      request<unknown>(`/api/v1/consultations/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),
  },

  quotes: {
    list: (token: string, quoteType: QuoteType = "productos") =>
      request<Quote[]>(`/api/v1/quotes/?quote_type=${quoteType}`, {}, token),
    get: (id: string, token: string) => request<Quote>(`/api/v1/quotes/${id}`, {}, token),
    create: (data: unknown, token: string) =>
      request<Quote>("/api/v1/quotes/", { method: "POST", body: JSON.stringify(data) }, token),
    update: (id: string, data: unknown, token: string) =>
      request<Quote>(`/api/v1/quotes/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),
    remove: (id: string, token: string) =>
      request<void>(`/api/v1/quotes/${id}`, { method: "DELETE" }, token),
    addItem: (id: string, data: unknown, token: string) =>
      request<Quote>(`/api/v1/quotes/${id}/items`, { method: "POST", body: JSON.stringify(data) }, token),
    removeItem: (id: string, itemId: string, token: string) =>
      request<void>(`/api/v1/quotes/${id}/items/${itemId}`, { method: "DELETE" }, token),
    exportPdf: async (id: string, token: string): Promise<string> => {
      const res = await fetch(`${API_URL}/api/v1/quotes/${id}/export/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al generar PDF");
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
    exportJpg: async (id: string, token: string): Promise<string> => {
      const res = await fetch(`${API_URL}/api/v1/quotes/${id}/export/jpg`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al generar la imagen");
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
  },

  settings: {
    getHourlyRate: () =>
      request<{ key: string; value: string }>("/api/v1/settings/hourly-rate"),
    setHourlyRate: (value: string, token: string) =>
      request<{ key: string; value: string }>(
        "/api/v1/settings/hourly-rate",
        { method: "PATCH", body: JSON.stringify({ value }) },
        token,
      ),

    getRegistrationEnabled: () =>
      request<RegistrationEnabled>("/api/v1/settings/registration-enabled"),
    setRegistrationEnabled: (enabled: boolean, token: string) =>
      request<RegistrationEnabled>(
        "/api/v1/settings/registration-enabled",
        { method: "PATCH", body: JSON.stringify({ enabled }) },
        token,
      ),

    getResendApiKey: (token: string) =>
      request<ResendApiKeyStatus>("/api/v1/settings/resend-api-key", {}, token),
    setResendApiKey: (value: string, token: string) =>
      request<ResendApiKeyStatus>(
        "/api/v1/settings/resend-api-key",
        { method: "PATCH", body: JSON.stringify({ value }) },
        token,
      ),
  },
};
