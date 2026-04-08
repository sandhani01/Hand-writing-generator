import { WorkflowSection } from "./WorkflowSection";

type Props = {
  isCodingMode: boolean;
  text: string;
  onTextChange: (value: string) => void;
};

export function ComposeSection({ isCodingMode, text, onTextChange }: Props) {
  const composeId = "compose-field";
  const descId = "compose-field-desc";

  return (
    <article className="surface surface--raised">
      <WorkflowSection
        step="02"
        title="Compose"
        subtitle={
          isCodingMode
            ? "Blank lines stay blank. Use symbols that match your coding grid for best results."
            : "Blank lines in the box stay blank in the render. Edit freely."
        }
      >
        <div className="compose-field">
          <label className="compose-label" htmlFor={composeId}>
            Text to render
          </label>
          <p id={descId} className="compose-field__hint">
            {isCodingMode
              ? "Supports code-like symbols when a coding dataset is available."
              : "Line breaks in the editor are preserved in the image."}
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
      </WorkflowSection>
    </article>
  );
}
