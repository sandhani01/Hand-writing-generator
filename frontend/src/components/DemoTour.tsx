import React, { useEffect, useRef, useState, type CSSProperties } from "react";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onBack: (navigateToTemplates?: boolean) => void;
};

type DemoStep = {
  step: string;
  title: string;
  subtitle: string;
  imagePath: string;
  imageAlt: string;
  description: string;
  accent: CSSProperties;
  icon: React.ReactNode;
  actionLabel?: string;
};

const DEMO_STEPS: DemoStep[] = [
  {
    step: "01",
    title: "Print Your Grid",
    subtitle: "Download & print",
    imagePath: "/demo/01-Print Grid.png",
    imageAlt: "Grid template printed on paper",
    description:
      "Download the PDF grid templates from the start page and print them on A4 paper. These ArUco-marked grids let the engine precisely locate every character you write.",
    actionLabel: "Get Templates",
    accent: {
      "--step-accent": "#5fa8d3",
      "--step-accent-dim": "rgba(95, 168, 211, 0.12)",
      "--step-glow": "rgba(95, 168, 211, 0.06)",
    } as CSSProperties,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9V2h12v7" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
    ),
  },
  {
    step: "02",
    title: "Write Letters",
    subtitle: "Fill the grid by hand",
    imagePath: "/demo/02-Write Letters in the Grid.png",
    imageAlt: "Handwritten characters filled into grid boxes",
    description:
      "Write one character per box using a dark pen. Keep your letters centered — the extractor reads each cell independently. Follow the exact order shown on the start page.",
    accent: {
      "--step-accent": "#4ade80",
      "--step-accent-dim": "rgba(74, 222, 128, 0.12)",
      "--step-glow": "rgba(74, 222, 128, 0.06)",
    } as CSSProperties,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    ),
  },
  {
    step: "03",
    title: "Crop Datasets",
    subtitle: "Snap & trim cleanly",
    imagePath: "/demo/03-Crop Datasets.png",
    imageAlt: "Phone camera scanning the filled grid",
    description:
      "Take a clear, well-lit photo of each filled grid. Crop just outside the ArUco markers — the engine handles skew and perspective correction automatically.",
    accent: {
      "--step-accent": "#a78bda",
      "--step-accent-dim": "rgba(167, 139, 218, 0.12)",
      "--step-glow": "rgba(167, 139, 218, 0.06)",
    } as CSSProperties,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.13 1 6 16a2 2 0 0 0 2 2h15" />
        <path d="M1 6.13 16 6a2 2 0 0 1 2 2v15" />
      </svg>
    ),
  },
  {
    step: "04",
    title: "Upload Datasets",
    subtitle: "Feed the engine",
    imagePath: "/demo/04-Upload Datasets.png",
    imageAlt: "Dataset upload interface showing progress",
    description:
      "Upload your cropped images through the Datasets panel. The backend extracts every glyph automatically. Wait for the status badge to show 'Ready' before continuing.",
    actionLabel: "Open Panel",
    accent: {
      "--step-accent": "#f59e0b",
      "--step-accent-dim": "rgba(245, 158, 11, 0.12)",
      "--step-glow": "rgba(245, 158, 11, 0.06)",
    } as CSSProperties,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    step: "05",
    title: "Compose & Render",
    subtitle: "Type your content",
    imagePath: "/demo/05-Compose and Render.png",
    imageAlt: "Text compose area and render button",
    description:
      "Type or paste your text in the Compose panel, tweak the tuning sliders to your liking, then hit 'Render page'. The engine maps each character to your handwriting dataset.",
    accent: {
      "--step-accent": "#3d7a5c",
      "--step-accent-dim": "rgba(61, 122, 92, 0.12)",
      "--step-glow": "rgba(61, 122, 92, 0.06)",
    } as CSSProperties,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    step: "06",
    title: "Preview & Download",
    subtitle: "Export your result",
    imagePath: "/demo/06-Preview and Download.png",
    imageAlt: "Preview panel showing rendered handwritten page",
    description:
      "Your handwritten page appears in the Preview panel. Download it as a high-resolution PNG — ready to print or submit. You can tweak settings and re-render as many times as you need.",
    accent: {
      "--step-accent": "#ec4899",
      "--step-accent-dim": "rgba(236, 72, 153, 0.12)",
      "--step-glow": "rgba(236, 72, 153, 0.06)",
    } as CSSProperties,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
];

export function DemoTour({ theme, onToggleTheme, onBack }: Props) {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [visibleSteps, setVisibleSteps] = useState<Set<number>>(new Set());
  const stageRefs = useRef<(HTMLElement | null)[]>([]);

  /* Intersection-observer: reveal cards as they scroll into view */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number(entry.target.getAttribute("data-step-index"));
          if (!Number.isNaN(index) && entry.isIntersecting) {
            setVisibleSteps((prev) => new Set(prev).add(index));
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );

    stageRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="app app--gate app--demo">
      <a className="skip-link" href="#demo-tour">
        Skip to demo
      </a>

      {/* ── Topbar ── */}
      <div className="gate-topbar">
        <span className="gate-brand">Handwritten-Notes</span>
        <div className="demo-topbar__actions">
          <button type="button" className="btn btn--ghost" onClick={() => onBack()}>
            ← Back
          </button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>

      <main id="demo-tour" className="demo-tour" aria-labelledby="demo-tour-title">

        {/* ── Hero ── */}
        <header className="dtour-hero">
          <div className="dtour-hero__glow" aria-hidden />
          <span className="dtour-hero__eyebrow">Getting Started</span>
          <h1 id="demo-tour-title" className="dtour-hero__title">
            How It Works
          </h1>
          <p className="dtour-hero__lede">
            Six simple steps to turn your handwriting into a digital font.
            Scroll down to explore every stage of the process.
          </p>
          <div className="dtour-hero__cta">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                stageRefs.current[0]?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Start walkthrough
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => onBack()}>
              Skip, I know this
            </button>
          </div>
        </header>

        {/* ── Timeline ── */}
        <div className="dtour-timeline" aria-label="Demo steps timeline">
          <div className="dtour-timeline__rail" aria-hidden />

          {DEMO_STEPS.map((step, index) => {
            const isVisible = visibleSteps.has(index);
            const isEven = index % 2 === 0;

            return (
              <section
                key={step.step}
                ref={(el) => { stageRefs.current[index] = el; }}
                className={`dtour-card ${isVisible ? "is-visible" : ""} ${isEven ? "dtour-card--left" : "dtour-card--right"}`}
                style={step.accent}
                data-step-index={index}
                aria-label={`Step ${step.step}: ${step.title}`}
              >
                {/* Timeline node */}
                <div className="dtour-card__node" aria-hidden>
                  <span className="dtour-card__node-dot" />
                  <span className="dtour-card__node-num">{step.step}</span>
                </div>

                <div className="dtour-card__body">
                  {/* Action callout line + button */}
                  {step.actionLabel && (
                    <div className="dtour-card__action">
                      <div className="dtour-card__action-line" aria-hidden />
                      <button
                        type="button"
                        className="dtour-card__action-btn"
                        onClick={() => {
                          if (step.step === "01") {
                            onBack(true); // Navigate to templates page without force-downloading
                          } else if (step.step === "04") {
                            // If they click 'Open Panel', exit tour to main app
                            onBack();
                          }
                        }}
                      >
                        {step.actionLabel}
                      </button>
                    </div>
                  )}

                  {/* Header row */}
                  <div className="dtour-card__header">
                    <div className="dtour-card__icon">{step.icon}</div>
                    <div>
                      <h2 className="dtour-card__title">{step.title}</h2>
                      <p className="dtour-card__subtitle">{step.subtitle}</p>
                    </div>
                  </div>

                  {/* Image / placeholder */}
                  <div className="dtour-card__media">
                    {failedImages[step.imagePath] ? (
                      <div className="dtour-card__placeholder" role="img" aria-label={step.imageAlt}>
                        <span className="dtour-card__placeholder-step">{step.step}</span>
                        <p className="dtour-card__placeholder-label">
                          Screenshot for <strong>{step.title}</strong>
                        </p>
                      </div>
                    ) : (
                      <img
                        src={step.imagePath}
                        alt={step.imageAlt}
                        className="dtour-card__image"
                        loading="lazy"
                        decoding="async"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [step.imagePath]: true }))
                        }
                      />
                    )}
                  </div>

                  {/* Description */}
                  <p className="dtour-card__desc">{step.description}</p>
                </div>
              </section>
            );
          })}
        </div>

        {/* ── Outro ── */}
        <footer className="dtour-outro">
          <div className="dtour-outro__badge" aria-hidden>✓</div>
          <h2 className="dtour-outro__title">You're all set!</h2>
          <p className="dtour-outro__text">
            Head back, pick your assignment type, and create your first handwritten page.
          </p>
          <button type="button" className="btn btn--primary dtour-outro__btn" onClick={() => onBack()}>
            Let's go →
          </button>
        </footer>
      </main>
    </div>
  );
}
