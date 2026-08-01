/**
 * 主题 Provider - 自动跟随系统深浅 + 强调色切换
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AccentColor, ThemeMode } from "../types";

interface ThemeContextValue {
  mode: ThemeMode;
  accent: AccentColor;
  resolved: "light" | "dark";
  setMode: (m: ThemeMode) => void;
  setAccent: (a: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const ACCENT_CLASSES: Record<AccentColor, { root: string; tag: string }> = {
  qingwu: {
    root: "--tw-accent: 14 184 166",
    tag: "bg-qingwu-50 text-qingwu-700 dark:bg-qingwu-900/40 dark:text-qingwu-300",
  },
  dracula: {
    root: "--tw-accent: 189 147 249",
    tag: "bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  },
  violet: {
    root: "--tw-accent: 139 92 246",
    tag: "bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  amber: {
    root: "--tw-accent: 245 158 11",
    tag: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
};

export function ThemeProvider({
  initialMode = "auto",
  initialAccent = "qingwu",
  children,
  onModeChange,
  onAccentChange,
}: {
  initialMode?: ThemeMode;
  initialAccent?: AccentColor;
  children: ReactNode;
  onModeChange?: (m: ThemeMode) => void;
  onAccentChange?: (a: AccentColor) => void;
}) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const [accent, setAccentState] = useState<AccentColor>(initialAccent);

  const resolved = useResolvedTheme(mode);

  useEffect(() => {
    const root = document.documentElement;
    if (resolved === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    root.style.setProperty("color-scheme", resolved);
  }, [resolved]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--tw-accent-rgb",
      ACCENT_CLASSES[accent].root.split(":")[1].trim(),
    );
  }, [accent]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      accent,
      resolved,
      setMode: (m) => {
        setModeState(m);
        onModeChange?.(m);
      },
      setAccent: (a) => {
        setAccentState(a);
        onAccentChange?.(a);
      },
    }),
    [mode, accent, resolved, onModeChange, onAccentChange],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const v = useContext(ThemeContext);
  if (!v) throw new Error("useTheme 必须在 ThemeProvider 内使用");
  return v;
}

export function useAccentTagClass(): string {
  const { accent } = useTheme();
  return ACCENT_CLASSES[accent].tag;
}

function useResolvedTheme(mode: ThemeMode): "light" | "dark" {
  const [sys, setSys] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const handler = (e: MediaQueryListEvent) => setSys(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mode === "auto" ? sys : mode;
}
