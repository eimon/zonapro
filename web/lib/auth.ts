const COOKIE = "app_token";

type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeAuth(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAuthServerSnapshot() {
  return null;
}

export function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setToken(token: string, days = 7): void {
  const maxAge = 60 * 60 * 24 * days;
  document.cookie = `${COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  listeners.forEach((listener) => listener());
}

export function removeToken(): void {
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
  listeners.forEach((listener) => listener());
}

export function getRole(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role ? String(payload.role).toUpperCase() : null;
  } catch {
    return null;
  }
}
