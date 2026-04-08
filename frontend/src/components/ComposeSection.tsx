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
            ? "Keep blank lines. Use symbols from your coding dataset for best results."
            : "Blank lines in the box stay blank in the output."
        }
      >
        <div className="compose-field">
          <label className="compose-label" htmlFor={composeId}>
            {isCodingMode ? "Text / code" : "Text"}
          </label>
          <p id={descId} className="compose-field__hint">
            {isCodingMode
              ? "Supports brackets, operators, and punctuation when you have a coding dataset."
              : "Line breaks in your editor are preserved in the image."}
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
