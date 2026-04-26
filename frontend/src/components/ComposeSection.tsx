import { ErrorBanner } from "./ErrorBanner";
import { WorkflowSection } from "./WorkflowSection";

type Props = {
  isCodingMode: boolean;
  text: string;
  canRender: boolean;
  isRendering: boolean;
  renderError: string | null;
  onTextChange: (value: string) => void;
  onRender: () => void;
};

export function ComposeSection({
  isCodingMode,
  text,
  canRender,
  isRendering,
  renderError,
  onTextChange,
  onRender,
}: Props) {
  const composeId = "compose-field";
  const descId = "compose-field-desc";

  return (
    <article className="surface surface--raised">
      <WorkflowSection
        step="01"
        title="Write Text"
        headerExtra={
          <div className="workflow-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={onRender}
              disabled={isRendering}
              aria-busy={isRendering}
            >
              {isRendering ? "Rendering..." : "Render page"}
            </button>
          </div>
        }
      >
        <div className="compose-field">
          <label className="compose-label" htmlFor={composeId}>
            {isCodingMode ? (
              <svg className="compose-label__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            ) : (
              <svg className="compose-label__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            )}
            {isCodingMode ? "Your Code" : "Your Text"}
          </label>
          <p id={descId} className="compose-field__hint">
            Enter the text you want to render in your handwriting style.
          </p>
          <textarea
            id={composeId}
            className="compose-input"
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            spellCheck={false}
            aria-describedby={descId}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize={isCodingMode ? "off" : "sentences"}
          />
        </div>
        {renderError ? <ErrorBanner>{renderError}</ErrorBanner> : null}
      </WorkflowSection>
    </article>
  );
}
