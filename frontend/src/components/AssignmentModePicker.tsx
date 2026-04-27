import { useState } from "react";
import type { AssignmentMode } from "../types";

type Props = {
  onSelect: (mode: AssignmentMode) => void;
  onOpenDemo: () => void;
  initialTemplatesView?: boolean;
};

export function AssignmentModePicker({
  onSelect,
  onOpenDemo,
  initialTemplatesView = false,
}: Props) {
  const [showTemplates, setShowTemplates] = useState(initialTemplatesView);

  return (
    <div
      id="notes-picker"
      className="mode-picker"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mode-picker-title"
      aria-describedby="mode-picker-desc"
    >
      <div className="mode-picker__inner">
        <header className="mode-picker__header">
          {showTemplates && (
            <button
              className="mode-picker__back"
              onClick={() => setShowTemplates(false)}
              aria-label="Back to modes"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h1 id="mode-picker-title" className="mode-picker__title">
            {showTemplates ? "Download Templates" : "What's Your Note Type?"}
          </h1>
        </header>

        <section className="mode-picker__instructions" aria-label="Mode instructions">
          {!showTemplates ? (
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
                <div className="mode-instructions__icon mode-instructions__icon--simple" aria-hidden>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </div>
                <div className="mode-instructions__text">
                  <div className="mode-instructions__name">Theory Notes</div>
                  <div className="mode-instructions__detail">Essays, notes, and general handwriting. Upload alphabet datasets only.</div>
                </div>
                <div className="mode-instructions__arrow">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              <button
                type="button"
                className="mode-instructions__item mode-instructions__item--coding"
                onClick={() => onSelect("coding")}
              >
                <div className="mode-instructions__icon mode-instructions__icon--coding" aria-hidden>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                </div>
                <div className="mode-instructions__text">
                  <div className="mode-instructions__name">Coding Notes</div>
                  <div className="mode-instructions__detail">Code with special characters. Upload both alphabet and coding symbol datasets.</div>
                </div>
                <div className="mode-instructions__arrow">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              <div className="mode-instructions__divider">
                <span>Need a helping hand? Start here →</span>
              </div>

              <button
                type="button"
                className="mode-instructions__item mode-instructions__item--demo"
                onClick={onOpenDemo}
              >
                <div className="mode-instructions__icon mode-instructions__icon--demo" aria-hidden>
                   <div className="demo-pulse-ring" />
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
                  </svg>
                </div>
                <div className="mode-instructions__text">
                  <div className="mode-instructions__name">Demo Tour</div>
                  <div className="mode-instructions__detail">Learn how the app works with a guided walkthrough of all features.</div>
                </div>
                <div className="mode-instructions__arrow">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              <button
                type="button"
                className="mode-instructions__item mode-instructions__item--templates"
                onClick={() => {
                  // Show the preview page
                  setShowTemplates(true);
                }}
              >
                <div className="mode-instructions__icon mode-instructions__icon--templates" aria-hidden>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <div className="mode-instructions__text">
                  <div className="mode-instructions__name">Download Templates</div>
                  <div className="mode-instructions__detail">Get the printable PDF grids needed to create your handwriting font.</div>
                </div>
                <div className="mode-instructions__arrow">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </button>




            </div>
          ) : (
            <div className="mode-examples" aria-label="Example grids preview" style={{ marginTop: 0 }}>
              <div className="mode-example" aria-label="Example alphabet grid preview">
                <div style={{ marginBottom: "1rem" }}>
                  <a
                    href="/alphabet_grid.pdf"
                    download="Handwriting_Template_Alphabets.pdf"
                    className="mode-template-card"
                  >
                    <div className="mode-template-card__icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <polyline points="9 15 12 12 15 15" />
                      </svg>
                    </div>
                    <div className="mode-template-card__content" style={{ textAlign: "left" }}>
                      <div className="mode-template-card__name">Handwriting Font Grid</div>
                      <div className="mode-template-card__size">PDF Template (8×8)</div>
                    </div>
                  </a>
                </div>

                <div className="mode-example__img-container">
                  <img className="mode-example__real-img" src="/handwriting.jpg" alt="Handwriting alphabet grid" loading="lazy" />
                </div>

                <div className="mode-example__head" style={{ marginTop: "1rem", textAlign: "center" }}>
                  <div className="mode-example__title">ALPHABET GRID TEMPLATE (8×8)</div>
                </div>
              </div>

              <div className="mode-example" aria-label="Example coding symbols preview">
                <div style={{ marginBottom: "1rem" }}>
                  <a
                    href="/symbols_grid.pdf"
                    download="Handwriting_Template_Symbols.pdf"
                    className="mode-template-card"
                  >
                    <div className="mode-template-card__icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <polyline points="9 15 12 12 15 15" />
                      </svg>
                    </div>
                    <div className="mode-template-card__content" style={{ textAlign: "left" }}>
                      <div className="mode-template-card__name">Symbol Font Grid</div>
                      <div className="mode-template-card__size">PDF Template (6×5)</div>
                    </div>
                  </a>
                </div>

                <div className="mode-example__img-container">
                  <img className="mode-example__real-img" src="/coding_symbols.jpg" alt="Symbols grid" loading="lazy" />
                </div>

                <div className="mode-example__head" style={{ marginTop: "1rem", textAlign: "center" }}>
                  <div className="mode-example__title">SYMBOLS GRID TEMPLATE (6×5)</div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
