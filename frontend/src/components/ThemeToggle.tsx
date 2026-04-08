type Props = {
  theme: "dark" | "light";
  onToggle: () => void;
};

export function ThemeToggle({ theme, onToggle }: Props) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-pressed={isDark}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="theme-toggle__track" aria-hidden>
        <span className={`theme-toggle__thumb ${isDark ? "is-dark" : ""}`} />
        <span className="theme-toggle__icon theme-toggle__icon--moon" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 14.5A8.5 8.5 0 019.5 3 8.5 8.5 0 0012 21a8.5 8.5 0 009-6.5z" />
          </svg>
        </span>
        <span className="theme-toggle__icon theme-toggle__icon--sun" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 18a6 6 0 100-12 6 6 0 000 12zm0-16a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zm0 18a1 1 0 01-1-1v-2a1 1 0 112 0v2a1 1 0 01-1 1zM5.64 5.64a1 1 0 011.41 0l1.42 1.42a1 1 0 01-1.41 1.41L5.64 7.05a1 1 0 010-1.41zm12.73 12.73a1 1 0 01-1.41 0l-1.42-1.42a1 1 0 011.41-1.41l1.42 1.42a1 1 0 010 1.41zM4 13a1 1 0 011-1h2a1 1 0 110 2H5a1 1 0 01-1-1zm14 0a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1zM7.05 18.36a1 1 0 010-1.41l1.42-1.42a1 1 0 111.41 1.41l-1.42 1.42a1 1 0 01-1.41 0zm9.9-12.72a1 1 0 010 1.41l-1.42 1.42a1 1 0 11-1.41-1.41l1.42-1.42a1 1 0 011.41 0z" />
          </svg>
        </span>
      </span>
      <span className="visually-hidden">
        {isDark ? "Switch to light mode" : "Switch to dark mode"}
      </span>
    </button>
  );
}
