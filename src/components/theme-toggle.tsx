import { useEffect, useState } from "react";
import { Crown, Moon, Sun } from "lucide-react";

const KEY = "aptiroyale:theme";
const THEMES = ["dark", "light", "pro"] as const;
type Theme = (typeof THEMES)[number];

/** Dark/light/pro toggle; persists to localStorage, defaults to dark. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const el = document.documentElement;
    setTheme(el.classList.contains("pro") ? "pro" : el.classList.contains("light") ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next);
    document.documentElement.classList.toggle("light", next === "light");
    document.documentElement.classList.toggle("pro", next === "pro");
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode */
    }
  };

  const Icon = theme === "pro" ? Crown : theme === "light" ? Moon : Sun;
  const label =
    theme === "dark" ? "Switch to light mode" : theme === "light" ? "Switch to pro mode" : "Switch to dark mode";

  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={label}
      className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition hover:bg-accent hover:text-accent-foreground"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
