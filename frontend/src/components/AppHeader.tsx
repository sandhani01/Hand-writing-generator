import { ThemeToggle } from "./ThemeToggle";

type Props = {
  isCodingMode: boolean;
  theme: "dark" | "light";
  userEmail: string;
  onToggleTheme: () => void;
  onChangeAssignmentType: () => void;
  onRefreshLibrary: () => void;
  onResetWorkspace: () => void;
  onLogout: () => void;
  isLoadingDatasets: boolean;
};

export function AppHeader({
  isCodingMode,
  theme,
  userEmail,
  onToggleTheme,
  onChangeAssignmentType,
  onRefreshLibrary,
  onResetWorkspace,
  onLogout,
  isLoadingDatasets,
}: Props) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <div className="app-header__logo">
          <div className="app-header__logo-mark" aria-hidden="true" />
     
        </div>
        <div className="app-header__title-row">
          <h1 className="app-header__title" id="app-page-title">
            Create handwritten pages
          </h1>
          <span
            className={`mode-badge ${isCodingMode ? "mode-badge--coding" : ""}`}
          >
            {isCodingMode ? "Coding" : "Simple"}
          </span>
        </div>
        <p className="app-header__lede" id="app-page-desc">
          Upload your handwriting samples, compose your text, and download beautifully rendered pages.
        </p>
      </div>
      <nav className="app-header__toolbar" aria-label="Workspace actions">
        <div className="app-header__user-section">
          <span className="user-chip" title={userEmail}>
            <span className="user-chip__avatar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M20 21a8 8 0 1 0-16 0" />
              </svg>
            </span>
            <span className="user-chip__email">{userEmail}</span>
          </span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onLogout}>
            Sign out
          </button>
        </div>
        <div className="app-header__actions">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <div className="app-header__divider" aria-hidden="true" />
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onRefreshLibrary}
            disabled={isLoadingDatasets}
            title={isLoadingDatasets ? "Refreshing..." : "Refresh datasets"}
            aria-label="Refresh datasets"
          >
            <svg className={`btn__icon ${isLoadingDatasets ? "btn__icon--spin" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
            <span className="btn__label">{isLoadingDatasets ? "Refreshing" : "Refresh"}</span>
          </button>
          <button 
            type="button" 
            className="btn btn--ghost btn--icon" 
            onClick={onResetWorkspace}
            title="Reset workspace"
            aria-label="Reset workspace"
          >
            <svg className="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span className="btn__label">Reset</span>
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onChangeAssignmentType}
            title="Change assignment type"
            aria-label="Change assignment type"
          >
            <svg className="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span className="btn__label">Back</span>
          </button>
        </div>
      </nav>
    </header>
  );
}
