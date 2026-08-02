const KEY = "sidebar-collapsed";

type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeSidebarCollapsed(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSidebarCollapsedSnapshot() {
  return localStorage.getItem(KEY) === "true";
}

export function getSidebarCollapsedServerSnapshot() {
  return false;
}

export function setSidebarCollapsed(next: boolean) {
  localStorage.setItem(KEY, String(next));
  listeners.forEach((listener) => listener());
}
