"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  THEME_COOKIE,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme";

// Self-contained theme provider. Renders no <script> (React 19 / Next.js 16
// disallow that inside the component tree). The no-flash behaviour comes from
// a cookie: the resolved theme is written here and read by the server layout,
// which sets the `.dark` class on <html> on the next render.

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** Applies the theme to <html>, mirrors it to the cookie, returns the mode. */
function applyTheme(theme: Theme): ResolvedTheme {
  const resolved: ResolvedTheme =
    theme === "dark" || (theme === "system" && prefersDark())
      ? "dark"
      : "light";
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.cookie = `${THEME_COOKIE}=${resolved}; path=/; max-age=31536000; samesite=lax`;
  return resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  // Read the persisted choice on mount (localStorage is client-only).
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    const initial: Theme =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
    /* eslint-disable react-hooks/set-state-in-effect */
    setThemeState(initial);
    setResolvedTheme(applyTheme(initial));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Follow OS changes while in "system" mode.
  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolvedTheme(applyTheme("system"));
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage failures (e.g. private browsing).
    }
    setThemeState(next);
    setResolvedTheme(applyTheme(next));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Reads and updates the current theme. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within <ThemeProvider>.");
  }
  return context;
}
