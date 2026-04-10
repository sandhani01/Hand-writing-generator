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
        title="Compose"
        headerExtra={
          <div className="workflow-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={onRender}
              disabled={!canRender || isRendering}
              aria-busy={isRendering}
            >
              {isRendering ? "Rendering..." : "Render page"}
            </button>
          </div>
        }
      >
        <div className="compose-field">
          <label className="compose-label" htmlFor={composeId}>
            {isCodingMode ? "Code :" : "Text :"}
          </label>
          <p id={descId} className="compose-field__hint">
            
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
