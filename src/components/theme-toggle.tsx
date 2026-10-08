import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "aptiroyale:theme";

/** Dark/light toggle; persists to localStorage, defaults to dark. */
export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  const toggle = () => {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem(KEY, next ? "light" : "dark");
    } catch {
      /* private mode */
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition hover:bg-accent hover:text-accent-foreground"
    >
      {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
