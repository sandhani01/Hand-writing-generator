import { useMemo, useState, type CSSProperties } from "react";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onBack: () => void;
};

type DemoSlide = {
  step: string;
  title: string;
  tone: string;
  imagePath: string;
  imageAlt: string;
  description: string;
  tips: string[];
};

const DEMO_THEME_STYLES = [
  {
    "--demo-accent": "#bbf7d0",
    "--demo-accent-soft": "rgba(187, 247, 208, 0.12)",
    "--demo-accent-strong": "#4ade80",
  },
  {
    "--demo-accent": "#4ade80",
    "--demo-accent-soft": "rgba(74, 222, 128, 0.12)",
    "--demo-accent-strong": "#22c55e",
  },
  {
    "--demo-accent": "#16a34a",
    "--demo-accent-soft": "rgba(22, 163, 74, 0.12)",
    "--demo-accent-strong": "#86efac",
  },
  {
    "--demo-accent": "#15803d",
    "--demo-accent-soft": "rgba(21, 128, 61, 0.12)",
    "--demo-accent-strong": "#4ade80",
  },
  {
    "--demo-accent": "#064e3b",
    "--demo-accent-soft": "rgba(6, 78, 59, 0.15)",
    "--demo-accent-strong": "#34d399",
  },
] as const;

 

const DEMO_SLIDES: DemoSlide[] = [
  {
    step: "01",
    title: "Print Grids",
    tone: "Print Grids",
    imagePath: "/demo/01-Print Grid.png",
    imageAlt: "Print Grids",
    description:
      "Start by printing the grid sheets that will be used for writing.",
    tips: [
      "Download the grid PDF before printing.",
      "Print in color or black & white based on your preference.",
      "Ensure grid lines are sharp and clearly visible.",
    ],
  },
  {
    step: "02",
    title: "Write Letters in the Grid",
    tone: "Write Letters in the Grid",
    imagePath: "/demo/02-Write Letters in the Grid.png",
    imageAlt: "Write Letters in the Grid section demo screenshot",
    description:
      "Write each letter neatly inside the printed grid boxes.",
    tips: [
      "Write one character per grid box.",
      "Keep letters aligned within the grid boundaries.",
      "Maintain consistent size and spacing for better results.",
    ],
  },
  {
    step: "03",
    title: "Crop Datasets",
    tone: "Crop Datasets",
    imagePath: "/demo/03-Crop Datasets.png",
    imageAlt: "Datasets section demo screenshot",
    description:
      "Crop each letter or symbol from the grid sheet to create datasets.",
    tips: [
      "Use your phone or editor to crop each character clearly.",
      "Avoid cutting off edges of letters while cropping.",
      "Keep all cropped images uniform in size.",
    ],
  },
  {
    step: "04",
    title: "Upload Datasets",
    tone: "Upload Datasets",
    imagePath: "/demo/04-Upload Datasets.png",
    imageAlt: "Upload Datasets section demo screenshot",
    description:
      "Upload your cropped datasets and enter the text you want to generate.",
    tips: [
      "Upload alphabet datasets (and coding datasets if needed).",
      "Verify all files are correctly uploaded before proceeding.",
      "Enter or paste the exact text you want to convert.",
    ],
  },
  {
    step: "05",
    title: "Preview and Download",
    tone: "export",
    imagePath: "/demo/05-Preview and Download.png",
    imageAlt: "Preview and Download section demo screenshot",
    description:
      "Preview the generated output and download it as an image.",
    tips: [
      "Check the preview to ensure everything looks correct.",
      "Download the final output as a PNG file.",
      "Save or reuse the generated image without reprocessing.",
    ],
  },
];

export function DemoTour({ theme, onToggleTheme, onBack }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const activeSlide = DEMO_SLIDES[activeIndex];
  const activeThemeStyle = useMemo(
    () => DEMO_THEME_STYLES[activeIndex % DEMO_THEME_STYLES.length] as CSSProperties,
    [activeIndex]
  );
  const progressLabel = useMemo(
    () => `${activeIndex + 1} / ${DEMO_SLIDES.length}`,
    [activeIndex]
  );

  const goToSlide = (index: number) => {
    if (index < 0) {
      setActiveIndex(DEMO_SLIDES.length - 1);
      return;
    }
    if (index >= DEMO_SLIDES.length) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex(index);
  };

  return (
    <div className="app app--gate app--demo">
      <a className="skip-link" href="#demo-tour">
        Skip to demo
      </a>

      <div className="gate-topbar">
        <span className="gate-brand">Handwritten Notes</span>
        <div className="demo-topbar__actions">
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            Back
          </button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>

      <main id="demo-tour" className="demo-tour" aria-labelledby="demo-tour-title">
       

        <section className="demo-stage" style={activeThemeStyle}>
          <div 
            className="demo-progress-bar" 
            style={{ width: `${((activeIndex + 1) / DEMO_SLIDES.length) * 100}%` }} 
            aria-hidden="true"
          />
          <div className="demo-stage__top">
            <div className="demo-stage__meta">
              <span className="demo-stage__step">{activeSlide.step}</span>
              <div>
                <h2 className="demo-stage__title">{activeSlide.title}</h2>
                <p className="demo-stage__count">{progressLabel}</p>
              </div>
            </div>

            <div className="demo-stage__controls">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => goToSlide(activeIndex - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => goToSlide(activeIndex + 1)}
              >
                Next
              </button>
            </div>
          </div>

          <div className="demo-screen">
            {failedImages[activeSlide.imagePath] ? (
              <div className="demo-screen__placeholder" role="img" aria-label={activeSlide.imageAlt}>
                <span className="demo-screen__placeholder-step">{activeSlide.step}</span>
                <h3 className="demo-screen__placeholder-title">
                  Add your screenshot for {activeSlide.title}
                </h3>
                <p className="demo-screen__placeholder-text">
                  Place the image at <code>{activeSlide.imagePath}</code> and this slide
                  will render it automatically.
                </p>
              </div>
            ) : (
              <img
                src={activeSlide.imagePath}
                alt={activeSlide.imageAlt}
                className="demo-screen__image"
                loading="lazy"
                decoding="async"
                onError={() =>
                  setFailedImages((current) => ({
                    ...current,
                    [activeSlide.imagePath]: true,
                  }))
                }
              />
            )}
          </div>

          <div className="demo-dots" role="tablist" aria-label="Demo slides">
            {DEMO_SLIDES.map((slide, index) => (
              <button
                key={slide.step}
                type="button"
                className={`demo-dot ${index === activeIndex ? "is-active" : ""}`}
                onClick={() => goToSlide(index)}
                aria-label={`Open demo step ${slide.step}: ${slide.title}`}
                aria-selected={index === activeIndex}
                role="tab"
              />
            ))}
          </div>

          <div className="demo-details">
            <div className="demo-details__summary">
              <span className="demo-details__badge">{activeSlide.step}</span>
              <p className="demo-details__text">{activeSlide.description}</p>
            </div>

            {activeSlide.tips.length ? (
              <div className="demo-details__tips">
                {activeSlide.tips.map((tip) => (
                  <article key={tip} className="demo-tip">
                    <span className="demo-tip__marker" aria-hidden>
                      {activeSlide.step}
                    </span>
                    <p className="demo-tip__text">{tip}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
