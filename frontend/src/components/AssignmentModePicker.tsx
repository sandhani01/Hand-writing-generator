import { useState } from "react";
import type { AssignmentMode } from "../types";

type Props = {
  onSelect: (mode: AssignmentMode) => void;
  onOpenDemo: () => void;
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

export function AssignmentModePicker({ onSelect, onOpenDemo }: Props) {
  const [showRealAlphabet, setShowRealAlphabet] = useState(true);
  const [showRealCoding, setShowRealCoding] = useState(true);

  return (
    <div
      id="assignment-picker"
      className="mode-picker"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mode-picker-title"
      aria-describedby="mode-picker-desc"
    >
      <div className="mode-picker__inner">
        <header className="mode-picker__header">
     
          <h1 id="mode-picker-title" className="mode-picker__title">
            What's Your Assignment ?<br />
            
          </h1>
          
        </header>

        <section className="mode-picker__instructions" aria-label="Mode instructions">
          <div
            className="mode-instructions mode-instructions--triad"
            role="group"
            aria-label="Simple, demo, and coding modes"
          >
            <button
              type="button"
              className="mode-instructions__item mode-instructions__item--simple"
              onClick={() => onSelect("simple")}
            >
            
              <div
                className="mode-instructions__icon mode-instructions__icon--simple"
                aria-hidden
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </div>
              <div className="mode-instructions__text">
                <div className="mode-instructions__name">Simple Assignments</div>
                <div className="mode-instructions__detail">Essays, notes, and general handwriting. Upload alphabet datasets only.</div>
              </div>
              <div className="mode-instructions__arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </button>

            <button
              type="button"
              className="mode-instructions__item mode-instructions__item--demo"
              onClick={onOpenDemo}
            >
        
              <div
                className="mode-instructions__icon mode-instructions__icon--demo"
                aria-hidden
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/>
                </svg>
              </div>
              <div className="mode-instructions__text">
                <div className="mode-instructions__name">Demo Tour</div>
                <div className="mode-instructions__detail">Learn how the app works with a guided walkthrough of all features.</div>
              </div>
              <div className="mode-instructions__arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </button>

            <button
              type="button"
              className="mode-instructions__item mode-instructions__item--coding"
              onClick={() => onSelect("coding")}
            >
 
              <div
                className="mode-instructions__icon mode-instructions__icon--coding"
                aria-hidden
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </div>
              <div className="mode-instructions__text">
                <div className="mode-instructions__name">Coding Assignments</div>
                <div className="mode-instructions__detail">Code with special characters. Upload both alphabet and coding symbol datasets.</div>
              </div>
              <div className="mode-instructions__arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </button>
          </div>

          <div className="mode-examples" aria-label="Example grids preview">
            <div className="mode-example" aria-label="Example alphabet grid preview">
              <div className="mode-example__head">
                <div className="mode-example__title">
                  DRAW THIS BEFOR YOU START(ALPHABETS)
                </div>
                <button
                  type="button"
                  className="mode-example__toggle"
                  onClick={() => setShowRealAlphabet((value) => !value)}
                >
                  {showRealAlphabet ? "Show Digital" : "Show Real"}
                </button>
              </div>

              <div className="mode-example__subtitle">alphabets grid 8x8</div>

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
                  DRAW THIS BEFOR YOU START(SYMBOLS)
                </div>
                <button
                  type="button"
                  className="mode-example__toggle"
                  onClick={() => setShowRealCoding((value) => !value)}
                >
                  {showRealCoding ? "Show Digital" : "Show Real"}
                </button>
              </div>

              <div className="mode-example__subtitle">coding grid 6x5</div>

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
                      {CODING_SYMBOLS_6X5.map((cell, index) => {
                        const r = Math.floor(index / 6);
                        const c = index % 6;
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
