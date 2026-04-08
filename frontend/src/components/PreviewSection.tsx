import { WorkflowSection } from "./WorkflowSection";

type Props = {
  previewUrl: string | null;
};

export function PreviewSection({ previewUrl }: Props) {
  return (
    <aside className="layout__preview" aria-label="Preview and export">
      <article className="surface surface--preview">
        <WorkflowSection
          step="04"
          title="Preview"
          subtitle="Your most recent render. Re-run after you change text or tuning."
          className="workflow-section--tight"
        >
          <div
            className="preview-frame"
            role="region"
            aria-label="Rendered image output"
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Handwritten page rendered from your text and settings"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="preview-empty">
                <p className="preview-empty__title">No preview yet</p>
                <p className="preview-empty__text">
                  Add text, then click <strong>Render page</strong> to generate your image.
                </p>
              </div>
            )}
          </div>

          {previewUrl ? (
            <div className="export-row">
              <span className="export-row__step" aria-hidden>
                05
              </span>
              <div className="export-row__content">
                <p className="export-row__title">Export</p>
                <p className="export-row__text">
                  Download the current PNG to your device.
                </p>
                <a
                  className="btn btn--primary btn--block"
                  href={previewUrl}
                  download="handwritten-page.png"
                >
                  Download PNG
                </a>
              </div>
            </div>
          ) : null}
        </WorkflowSection>
      </article>
    </aside>
  );
}
