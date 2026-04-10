import { useState } from "react";
import type { AssignmentMode } from "../types";

type Props = {
  onSelect: (mode: AssignmentMode) => void;
};

const ALPHABET_GRID_8X8: string[][] = [
  ["A", "B", "C", "D", "E", "F", "G", "H"],
  ["I", "J", "K", "L", "M", "N", "O", "p"],
  ["Q", "R", "S", "T", "U", "V", "W", "X"],
  ["Y", "Z", "a", "b", "c", "d", "e", "f"],
  ["g", "h", "i", "j", "k", "l", "m", "n"],
  ["o", "p", "q", "r", "s", "t", "u", "v"],
  ["w", "x", "y", "z", "0", "1", "2", "3"],
  ["4", "5", "6", "7", "8", "9", ",", "."],
];

const CODING_SYMBOLS_6X5: string[] = [
  "!",
  "@",
  "#",
  "%",
  "^",
  "&",
  "*",
  "(",
  ")",
  "-",
  "_",
  "=",
  "+",
  "[",
  "]",
  "{",
  "}",
  ";",
  ":",
  "'",
  '"',
  "<",
  ">",
  "/",
  "?",
  "\\",
  "|",
  "`",
  "~",
  "",
];

export function AssignmentModePicker({ onSelect }: Props) {
  const [showRealAlphabet, setShowRealAlphabet] = useState(true);
  const [showRealCoding, setShowRealCoding] = useState(true);

  return (
    <div id="assignment-picker" className="mode-picker" role="dialog" aria-modal="true" aria-labelledby="mode-picker-title" aria-describedby="mode-picker-desc">
      <div className="mode-picker__inner">
        <header className="mode-picker__header">
          <div className="mode-picker__icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </div>
          <h1 id="mode-picker-title" className="mode-picker__title">
            What are you writing today?
          </h1>
          <p id="mode-picker-desc" className="mode-picker__lede">
            Choose your assignment type. This determines which glyph sets are available. You can change it anytime.
          </p>
        </header>

        <section className="mode-picker__instructions" aria-label="Mode instructions">
          <div className="mode-instructions" role="group" aria-label="Simple vs coding mode">
            <button
              type="button"
              className="mode-instructions__item mode-instructions__item--simple"
              onClick={() => onSelect("simple")}
            >
              <div className="mode-instructions__icon mode-instructions__icon--simple" aria-hidden>
                Aa
              </div>
              <div className="mode-instructions__text">
                <div className="mode-instructions__name">Simple assignments</div>
                <div className="mode-instructions__detail">
                  Essays, notes, and everyday text. Uses your alphabet datasets only.
                </div>
              </div>
            </button>

            <div className="mode-instructions__arrow" aria-hidden>
              →
            </div>

            <button
              type="button"
              className="mode-instructions__item mode-instructions__item--coding"
              onClick={() => onSelect("coding")}
            >
              <div className="mode-instructions__icon mode-instructions__icon--coding" aria-hidden>
                {"</" + ">"}
              </div>
              <div className="mode-instructions__text">
                <div className="mode-instructions__name">Coding assignments</div>
                <div className="mode-instructions__detail">
                  Code and symbols. Uses your alphabet and coding datasets.
                </div>
              </div>
            </button>
          </div>

          <div className="mode-examples" aria-label="Example grids preview">
            <div className="mode-example" aria-label="Example alphabet grid preview">
              <div className="mode-example__head">
                <div className="mode-example__title">
                  EXAMPLE GRID LAYOUT (ALPHABETS)
                </div>
                <button
                  type="button"
                  className="mode-example__toggle"
                  onClick={() => setShowRealAlphabet((v) => !v)}
                >
                  {showRealAlphabet ? "Show Digital" : "Show Real"}
                </button>
              </div>

              <div className="mode-example__subtitle">alphabets grid 8×8</div>

              <div
                className="mode-flip mode-flip--alphabet"
                role="region"
                aria-label="Alphabet grid flip preview"
              >
                <div
                  className={`mode-flip__inner ${showRealAlphabet ? "is-flipped" : ""}`}
                >
                  <div
                    className="mode-flip__face mode-flip__face--front"
                    aria-label="Digital alphabet grid"
                  >
                    <div
                      className="mode-example__digital-grid mode-example__digital-grid--alphabet"
                      role="grid"
                      aria-label="Digital alphabet grid example"
                    >
                      {ALPHABET_GRID_8X8.flatMap((row, r) =>
                        row.map((cell, c) => (
                          <div
                            key={`${r}-${c}`}
                            role="gridcell"
                            aria-label={`cell ${r + 1},${c + 1}: ${cell}`}
                            className="mode-example__digital-cell"
                          >
                            {cell}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div
                    className="mode-flip__face mode-flip__face--back"
                    aria-label="Real handwriting alphabet grid"
                  >
                    <img
                      className="mode-example__real-img"
                      src="/handwriting.jpg"
                      alt="Real handwriting alphabet grid example"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mode-example" aria-label="Example coding symbols preview">
              <div className="mode-example__head">
                <div className="mode-example__title">
                  EXAMPLE GRID LAYOUT (SYMBOLS)
                </div>
                <button
                  type="button"
                  className="mode-example__toggle"
                  onClick={() => setShowRealCoding((v) => !v)}
                >
                  {showRealCoding ? "Show Digital" : "Show Real"}
                </button>
              </div>

              <div className="mode-example__subtitle">coding grid 6×5</div>

              <div
                className="mode-flip mode-flip--coding"
                role="region"
                aria-label="Coding grid flip preview"
              >
                <div
                  className={`mode-flip__inner ${showRealCoding ? "is-flipped" : ""}`}
                >
                  <div
                    className="mode-flip__face mode-flip__face--front"
                    aria-label="Digital coding grid"
                  >
                    <div
                      className="mode-example__digital-grid mode-example__digital-grid--coding"
                      role="grid"
                      aria-label="Digital coding grid example"
                    >
                      {CODING_SYMBOLS_6X5.map((cell, idx) => {
                        const r = Math.floor(idx / 6);
                        const c = idx % 6;
                        return (
                          <div
                            key={`${r}-${c}`}
                            role="gridcell"
                            aria-label={`cell ${r + 1},${c + 1}: ${cell}`}
                            className="mode-example__digital-cell"
                          >
                            {cell}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    className="mode-flip__face mode-flip__face--back"
                    aria-label="Real coding symbols grid"
                  >
                    <img
                      className="mode-example__real-img"
                      src="/coding_symbols.jpg"
                      alt="Real coding symbols grid example"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
