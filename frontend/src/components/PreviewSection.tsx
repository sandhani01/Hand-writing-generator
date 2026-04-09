import { WorkflowSection } from "./WorkflowSection";
import type { RenderJobResponse } from "../types";

type Props = {
  previewUrl: string | null;
  previewError: string | null;
  previewStatusLabel: string;
  isPreviewLoading: boolean;
  selectedRender: RenderJobResponse | null;
  renderHistory: RenderJobResponse[];
  busyRenderId: string | null;
  onPreviewRender: (renderId: string) => void;
  onDownloadRender: (renderId: string) => void;
  onDeleteRender: (renderId: string) => void;
};

const statusLabel: Record<RenderJobResponse["status"], string> = {
  queued: "Queued",
  processing: "Rendering",
  completed: "Ready",
  failed: "Failed",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function trimText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 72) || "Untitled render";
}

export function PreviewSection({
  previewUrl,
  previewError,
  previewStatusLabel,
  isPreviewLoading,
  selectedRender,
  renderHistory,
  busyRenderId,
  onPreviewRender,
  onDownloadRender,
  onDeleteRender,
}: Props) {
  return (
    <aside className="layout__preview" aria-label="Preview and export">
      <article className="surface surface--preview">
        <WorkflowSection
          step="04"
          title="Preview"
          subtitle="Your latest or selected render. Saved history keeps only the newest three."
          className="workflow-section--tight"
        >
          {selectedRender ? (
            <div className="preview-toolbar">
              <span className={`status-badge status-badge--${selectedRender.status}`}>
                {statusLabel[selectedRender.status]}
              </span>
              <span className="preview-toolbar__meta">
                {previewStatusLabel}
              </span>
            </div>
          ) : null}

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
                <p className="preview-empty__title">
                  {selectedRender && selectedRender.status !== "completed"
                    ? "Render in progress"
                    : "No preview yet"}
                </p>
                <p className="preview-empty__text">
                  {previewError
                    ? previewError
                    : selectedRender && selectedRender.status === "failed"
                    ? selectedRender.error_message || "This render failed."
                    : isPreviewLoading
                    ? "Loading the latest PNG from storage..."
                    : "Render a page or choose an older render from history."}
                </p>
              </div>
            )}
          </div>

          {previewUrl && selectedRender ? (
            <div className="export-row">
              <span className="export-row__step" aria-hidden>
                05
              </span>
              <div className="export-row__content">
                <p className="export-row__title">Download current PNG</p>
                <p className="export-row__text">
                  Reuse the same output without rendering again.
                </p>
                <button
                  type="button"
                  className="btn btn--primary btn--block"
                  onClick={() => onDownloadRender(selectedRender.id)}
                >
                  Download PNG
                </button>
              </div>
            </div>
          ) : null}

          <section className="history-panel">
            <div className="history-panel__header">
              <div>
                <h3 className="history-panel__title">Recent renders</h3>
                <p className="history-panel__text">
                  Old renders stay here until they fall out of the newest-three limit.
                </p>
              </div>
            </div>

            {renderHistory.length === 0 ? (
              <div className="dataset-empty">
                <p className="dataset-empty__title">No saved renders yet</p>
                <p className="dataset-empty__text">
                  Render a page once and it will appear here with quick preview, download, and delete actions.
                </p>
              </div>
            ) : (
              <div className="history-list">
                {renderHistory.map((job) => {
                  const isBusy = busyRenderId === job.id;
                  const isSelected = selectedRender?.id === job.id;
                  return (
                    <article
                      key={job.id}
                      className={`history-card ${isSelected ? "history-card--selected" : ""}`}
                    >
                      <div className="history-card__header">
                        <span className={`status-badge status-badge--${job.status}`}>
                          {statusLabel[job.status]}
                        </span>
                        <span className="history-card__meta">
                          {formatDate(job.created_at)}
                        </span>
                      </div>
                      <p className="history-card__title">{trimText(job.text_content)}</p>
                      {job.error_message ? (
                        <p className="history-card__error">{job.error_message}</p>
                      ) : null}
                      <div className="history-card__actions">
                        <button
                          type="button"
                          className="btn btn--ghost btn--mini"
                          disabled={isBusy}
                          onClick={() => onPreviewRender(job.id)}
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--mini"
                          disabled={isBusy || job.status !== "completed"}
                          onClick={() => onDownloadRender(job.id)}
                        >
                          Download
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--mini btn--danger"
                          disabled={isBusy}
                          onClick={() => onDeleteRender(job.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </WorkflowSection>
      </article>
    </aside>
  );
}
