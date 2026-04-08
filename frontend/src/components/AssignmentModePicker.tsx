import type { AssignmentMode } from "../types";

type Props = {
  onSelect: (mode: AssignmentMode) => void;
};

export function AssignmentModePicker({ onSelect }: Props) {
  return (
    <div id="assignment-picker" className="mode-picker" role="dialog" aria-modal="true" aria-labelledby="mode-picker-title" aria-describedby="mode-picker-desc">
      <div className="mode-picker__inner">
        <header className="mode-picker__header">
          <h1 id="mode-picker-title" className="mode-picker__title">
            What are you writing?
          </h1>
          <p id="mode-picker-desc" className="mode-picker__lede">
            This sets which glyph sets you will see. You can change it anytime.
          </p>
        </header>

        <div className="mode-picker__choices">
          <button
            type="button"
            className="mode-choice"
            onClick={() => onSelect("simple")}
          >
            <span className="mode-choice__icon mode-choice__icon--simple" aria-hidden>
              Aa
            </span>
            <span className="mode-choice__text">
              <span className="mode-choice__name">Simple assignments</span>
              <span className="mode-choice__hint">
                Essays, notes, and everyday text. Alphabet grid session and
                library only.
              </span>
            </span>
            <span className="mode-choice__arrow" aria-hidden>
              →
            </span>
          </button>

          <button
            type="button"
            className="mode-choice"
            onClick={() => onSelect("coding")}
          >
            <span className="mode-choice__icon mode-choice__icon--code" aria-hidden>
              {"</" + ">"}
            </span>
            <span className="mode-choice__text">
              <span className="mode-choice__name">Coding assignments</span>
              <span className="mode-choice__hint">
                Code and symbols. Alphabet and coding grids (session and
                library).
              </span>
            </span>
            <span className="mode-choice__arrow" aria-hidden>
              →
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
