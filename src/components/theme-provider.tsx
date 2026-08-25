import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

export type AccentPreset = {
  id: string;
  label: string;
  accent: string; // hex
  gradient: string; // CSS linear-gradient value
};

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: "gold",
    label: "Preto & Dourado",
    accent: "#C8A96A",
    gradient:
      "linear-gradient(90deg,#8A7346 0%,#A88848 18%,#C8A96A 40%,#D8BA82 55%,#C8A96A 72%,#A88848 88%,#7A6640 100%)",
  },
];

type Ctx = {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
  accentId: string;
  setAccent: (id: string) => void;
  accentPresets: AccentPreset[];
};

const ThemeContext = createContext<Ctx | null>(null);
const THEME_KEY = "ym-theme";
const ACCENT_KEY = "ym-accent";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [accentId, setAccentIdState] = useState<string>("gold");

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    const storedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    if (storedTheme === "light" || storedTheme === "dark") setThemeState(storedTheme);
    const storedAccent = localStorage.getItem(ACCENT_KEY);
    if (storedAccent) setAccentIdState(storedAccent);
  }, []);

  useEffect(() => {
    // Apenas o conteúdo alterna entre light/dark. Sidebar e topbar
    // permanecem sempre em preto (tokens de sidebar hardcoded em styles.css).
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    const preset = ACCENT_PRESETS.find((p) => p.id === accentId) ?? ACCENT_PRESETS[0];
    const root = document.documentElement;
    const a = preset.accent;

    // Apenas destaques recebem a cor de personalização. Superfícies
    // (background, card, sidebar) mantêm os tokens definidos em styles.css
    // para preservar a identidade black da navegação e neutra do conteúdo.
    root.style.setProperty("--accent", a);
    root.style.setProperty("--primary", a);
    root.style.setProperty("--ring", a);
    root.style.setProperty("--chart-1", a);
    root.style.setProperty("--gradient-gold", preset.gradient);
    root.style.setProperty("--sidebar-primary", a);
    root.style.setProperty("--sidebar-ring", a);
    root.style.setProperty("--sidebar-accent", `color-mix(in srgb, ${a} 12%, #131314)`);
    root.style.setProperty("--sidebar-border", `color-mix(in srgb, ${a} 18%, transparent)`);

    try {
      localStorage.setItem(ACCENT_KEY, accentId);
    } catch {
      // ignore
    }
  }, [accentId]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: setThemeState,
        toggle: () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
        accentId,
        setAccent: setAccentIdState,
        accentPresets: ACCENT_PRESETS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
