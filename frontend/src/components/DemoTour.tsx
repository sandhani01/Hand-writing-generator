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
    "--demo-accent": "#24b7aa",
    "--demo-accent-soft": "rgba(36, 183, 170, 0.14)",
    "--demo-accent-strong": "#7be3d9",
  },
  {
    "--demo-accent": "#d8902f",
    "--demo-accent-soft": "rgba(216, 144, 47, 0.14)",
    "--demo-accent-strong": "#f1c980",
  },
  {
    "--demo-accent": "#4f8cff",
    "--demo-accent-soft": "rgba(79, 140, 255, 0.14)",
    "--demo-accent-strong": "#a9c7ff",
  },
  {
    "--demo-accent": "#dd6f9e",
    "--demo-accent-soft": "rgba(221, 111, 158, 0.14)",
    "--demo-accent-strong": "#f2abc8",
  },
  {
    "--demo-accent": "#8d78f6",
    "--demo-accent-soft": "rgba(141, 120, 246, 0.14)",
    "--demo-accent-strong": "#c8bcff",
  },
] as const;

const DEMO_SLIDES: DemoSlide[] = [
  {
    step: "01",
    title: "Create Datasets",
    tone: "Create Datasets",
    imagePath: "/demo/01-Create Datasets.png",
    imageAlt: "Create Datasets section demo screenshot",
    description:
      "Write this on your Book first !",
    tips: [
      "Write exactly as shown in image for better Extraction of your hand-writing",
      "Write on a neat paper",
      "Give spaces , Like shown in image",
    ],
  },
  {
    step: "02",
    title: "Crop Dataset",
    tone: "Crop Dataset",
    imagePath: "/demo/02-Crop Dataset.png",
    imageAlt: "Crop Dataset section demo screenshot",
    description:
      "Crop the images (Easy-Peasy)",
    tips: [
      "Use edit in your photos for crop(mobile)",
      "Open advanced controls when you need deeper styling.",
      "Character fixes let you move or resize one glyph without changing the whole style.",
    ],
  },
  {
    step: "03",
    title: "Upload Datasets",
    tone: "Upload Datasets",
    imagePath: "/demo/03-Upload Datasets.png",
    imageAlt: "Datasets section demo screenshot",
    description:
      "Upload alphabet sheets, coding symbol sheets, and one background(Optional).",
    tips: [
      "Simple mode: Only alphabet datasets needed.",
      "Coding mode: Both alphabet and coding datasets needed.",
      "Background datasets control the paper look behind the writing.",
    ],
  },
  {
    step: "04",
    title: "Compose and Render",
    tone: "Compose and Render",
    imagePath: "/demo/04-Compose and Render.png",
    imageAlt: "Compose and Render section demo screenshot",
    description:
      "Just insert the text you want in compose and Render !!",
    tips: [
     
    ],
  },
  {
    step: "05",
    title: "Preview and Download",
    tone: "export",
    imagePath: "/demo/05-Preview and Download.png",
    imageAlt: "Preview and Download section demo screenshot",
    description:
      "Once the Compose and Render looks right, Preview and Download the PNG and reuse that exact render without generating it again.",
    tips: [
      "Preview and Download preserves the current rendered page exactly as shown.",
      "Recent renders make it easy to revisit the last few exports.",
      "This is the final step for assignments, notes, and presentation shots.",
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
