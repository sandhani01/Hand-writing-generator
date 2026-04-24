import { ThemeToggle } from "./ThemeToggle";

type Props = {
  isCodingMode: boolean;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onChangeAssignmentType: () => void;
  onRefreshLibrary: () => void;
  onResetWorkspace: () => void;
  onRender: () => void;
  isLoadingDatasets: boolean;
  isRendering: boolean;
  canRender: boolean;
};

export function AppHeader({
  isCodingMode,
  theme,
  onToggleTheme,
  onChangeAssignmentType,
  onRefreshLibrary,
  onResetWorkspace,
  onRender,
  isLoadingDatasets,
  isRendering,
  canRender,
}: Props) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <div className="app-header__logo-group" onClick={onRefreshLibrary} title="Refresh Workspace">
          <div className="app-header__logo-mark" aria-hidden="true" />
          <span className="app-header__brand-name">Handwritten Notes Generator</span>
        </div>
        <div className="app-header__separator" aria-hidden="true" />
        <span className={`mode-badge ${isCodingMode ? "mode-badge--coding" : ""}`}>
          {isCodingMode ? "Coding" : "Simple"}
        </span>
      </div>

      <nav className="app-header__toolbar" aria-label="Workspace actions">
        <div className="app-header__actions-group">
          <button
            type="button"
            className="btn btn--primary btn--render"
            onClick={onRender}
            disabled={!canRender || isRendering}
            aria-busy={isRendering}
          >
            {isRendering ? (
              <>
                <svg className="btn__icon btn__icon--spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span>Rendering</span>
              </>
            ) : (
              <>
                <svg className="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
                <span>Render page</span>
              </>
            )}
          </button>

          <div className="toolbar-group">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <div className="toolbar-group__divider" aria-hidden="true" />
            <button
              type="button"
              className="btn btn--toolbar"
              onClick={onRefreshLibrary}
              disabled={isLoadingDatasets}
              title="Refresh datasets"
            >
              <svg className={`btn__icon ${isLoadingDatasets ? "btn__icon--spin" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
            </button>
            <button 
              type="button" 
              className="btn btn--toolbar" 
              onClick={onResetWorkspace}
              title="Reset workspace"
            >
              <svg className="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
            <button
              type="button"
              className="btn btn--toolbar"
              onClick={onChangeAssignmentType}
              title="Back to mode selection"
            >
              <svg className="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Authentication disabled - User group removed */}
      </nav>
    </header>
  );
}
