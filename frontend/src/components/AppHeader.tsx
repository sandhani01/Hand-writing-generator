import { ThemeToggle } from "./ThemeToggle";

type Props = {
  isCodingMode: boolean;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onChangeAssignmentType: () => void;
  onRefreshLibrary: () => void;
  onResetSession: () => void;
  isLoadingDatasets: boolean;
};

export function AppHeader({
  isCodingMode,
  theme,
  onToggleTheme,
  onChangeAssignmentType,
  onRefreshLibrary,
  onResetSession,
  isLoadingDatasets,
}: Props) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <p className="app-header__eyebrow">Handwritten Notes</p>
        <div className="app-header__title-row">
          <h1 className="app-header__title" id="app-page-title">
            Render pages in your handwriting
          </h1>
          <span
            className={`mode-badge ${isCodingMode ? "mode-badge--coding" : ""}`}
          >
            {isCodingMode ? "Coding" : "Simple"}
          </span>
        </div>
        <p className="app-header__lede" id="app-page-desc">
          {isCodingMode
            ? "Use your datasets for letters and code symbols, then compose, tune, and export a PNG."
            : "Use your alphabet datasets, then compose, tune, and export a PNG."}
        </p>
      </div>
      <nav className="app-header__toolbar" aria-label="Workspace actions">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onChangeAssignmentType}
        >
          Choose mode
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onRefreshLibrary}
          disabled={isLoadingDatasets}
        >
          {isLoadingDatasets ? "Refreshing..." : "Refresh dataset counts"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onResetSession}>
          Reset workspace
        </button>
      </nav>
    </header>
  );
}
