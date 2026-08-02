type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeTheme(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getThemeSnapshot() {
  return document.documentElement.classList.contains("dark");
}

export function getThemeServerSnapshot() {
  return false;
}

export function setTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("theme", dark ? "dark" : "light");
  listeners.forEach((listener) => listener());
}
