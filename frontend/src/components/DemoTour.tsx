import { useMemo, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onBack: () => void;
};

type DemoSlide = {
  step: string;
  title: string;
  tone: "Create Datasets" | "Crop Dataset" | "Upload Datasets" | "Compose and Render" | "export";
  imagePath: string;
  imageAlt: string;
  description: string;
  tips: string[];
};

const DEMO_SLIDES: DemoSlide[] = [
  {
    step: "01",
    title: "Create Datasets",
    tone: "Create Datasets",
    imagePath: "/demo/01-Create Datasets.png",
    imageAlt: "Create Datasets section demo screenshot",
    description:
      "Start by pasting text or code into Create Datasets. Empty lines are preserved so the Compose and Render matches your intended page layout.",
    tips: [
      "Use this area for the final text you want rendered.",
      "Blank lines stay blank in the output page.",
      "Render page lives at the top right for quick access.",
    ],
  },
  {
    step: "02",
    title: "Crop Dataset",
    tone: "Crop Dataset",
    imagePath: "/demo/02-Crop Dataset.png",
    imageAlt: "Crop Dataset section demo screenshot",
    description:
      "Adjust realism and handwriting behavior with quick presets first, then refine spacing, scale, jitter, or exact character overrides.",
    tips: [
      "Use presets for a fast starting point.",
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
      "Upload alphabet sheets, coding symbol sheets, and one background. The renderer uses these Upload Datasets to build your handwriting output.",
    tips: [
      "Simple mode uses alphabet datasets.",
      "Coding mode uses both alphabet and coding datasets.",
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
      "Compose and Render shows the latest rendered page and keeps a short recent history so you can compare outputs without losing momentum.",
    tips: [
      "Select older renders from history to compare versions.",
      "Compose and Render updates after each completed render.",
      "Use this area to check spacing, realism, and page balance before exporting.",
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
        <section className={`demo-hero demo-hero--${activeSlide.tone}`}>
          <p className="demo-hero__eyebrow">Interactive Product Tour</p>
          <h1 id="demo-tour-title" className="demo-hero__title">
            Learn the full workflow before you start rendering
          </h1>
          
        </section>

        <section className={`demo-stage demo-stage--${activeSlide.tone}`}>
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

          <div className={`demo-details demo-details--${activeSlide.tone}`}>
            <div className="demo-details__summary">
              <span className="demo-details__badge">{activeSlide.step}</span>
              <p className="demo-details__text">{activeSlide.description}</p>
            </div>

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
          </div>
        </section>
      </main>
    </div>
  );
}
