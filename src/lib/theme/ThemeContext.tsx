"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Settings } from "@/lib/local/repo";
import type { ThemePreference } from "@/lib/local/types";

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: async () => {},
});

function applyTheme(t: ThemePreference) {
  if (typeof document === "undefined") return;
  const dark =
    t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * Wraps the whole app (see root layout) so the saved theme preference is
 * applied as soon as we know who's logged in - not only while the Settings
 * page happens to be mounted, and not only after visiting it once. Also
 * exposes setTheme so anything - Settings, or the global assistant's
 * "change the theme to dark" action - can flip it immediately and have it
 * actually stick (persisted to the account, applied to the page).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const username = user?.username ?? null;
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!username || loadedFor.current === username) return;
    loadedFor.current = username;
    Settings.get(username).then((s) => {
      setThemeState(s.themePreference);
      applyTheme(s.themePreference);
    });
  }, [username]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback(
    async (t: ThemePreference) => {
      setThemeState(t);
      applyTheme(t);
      if (username) await Settings.update(username, { themePreference: t });
    },
    [username]
  );

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}