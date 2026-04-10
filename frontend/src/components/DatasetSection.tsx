import { useMemo, useState, type ChangeEvent } from "react";
import { WorkflowSection } from "./WorkflowSection";
import { ErrorBanner } from "./ErrorBanner";
import type {
  BackgroundRecord,
  DatasetRecord,
  UploadCounts,
  UploadType,
} from "../types";

type Props = {
  isCodingMode: boolean;
  availableCounts: UploadCounts;
  datasets: DatasetRecord[];
  backgrounds: BackgroundRecord[];
  backgroundLimit: number;
  backgroundCustomCount: number;
  uploadError: string | null;
  isUploading: boolean;
  busyDatasetId: string | null;
  busyBackgroundId: string | null;
  onUpload: (event: ChangeEvent<HTMLInputElement>, type: UploadType) => void;
  onUploadBackground: (event: ChangeEvent<HTMLInputElement>) => void;
  onRenameDataset: (datasetId: string, displayName: string) => Promise<void>;
  onDeleteDataset: (datasetId: string) => Promise<void>;
  onSelectBackground: (backgroundId: string) => Promise<void>;
  onDeleteBackground: (backgroundId: string) => Promise<void>;
};

const statusLabel: Record<DatasetRecord["status"], string> = {
  queued: "Queued",
  processing: "Processing",
  completed: "Ready",
  failed: "Failed",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function DatasetGroup({
  title,
  helper,
  datasets,
  busyDatasetId,
  onRenameDataset,
  onDeleteDataset,
}: {
  title: string;
  helper: string;
  datasets: DatasetRecord[];
  busyDatasetId: string | null;
  onRenameDataset: (datasetId: string, displayName: string) => Promise<void>;
  onDeleteDataset: (datasetId: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const startEditing = (dataset: DatasetRecord) => {
    setEditingId(dataset.id);
    setDraftName(dataset.display_name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraftName("");
  };

  return (
    <section className="dataset-group">
      <div className="dataset-group__header">
        <div>
          <h3 className="dataset-group__title">{title}</h3>
          <p className="dataset-group__helper">{helper}</p>
        </div>
      </div>

      {datasets.length === 0 ? (
        <div className="dataset-empty">
          <p className="dataset-empty__title">No datasets yet</p>
          <p className="dataset-empty__text">
            Upload a grid to add it to the current signed-in workspace session.
          </p>
        </div>
      ) : (
        <div className="dataset-card-grid">
          {datasets.map((dataset) => {
            const isBusy = busyDatasetId === dataset.id;
            const isEditing = editingId === dataset.id;
            return (
              <article className="dataset-card" key={dataset.id}>
                <div className="dataset-card__header">
                  <span
                    className={`status-badge status-badge--${dataset.status}`}
                  >
                    {statusLabel[dataset.status]}
                  </span>
                  <span className="dataset-card__meta">
                    Added {formatDate(dataset.created_at)}
                  </span>
                </div>

                {isEditing ? (
                  <div className="dataset-card__edit">
                    <label className="visually-hidden" htmlFor={`dataset-${dataset.id}`}>
                      Dataset name
                    </label>
                    <input
                      id={`dataset-${dataset.id}`}
                      className="dataset-card__input"
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      maxLength={120}
                      disabled={isBusy}
                    />
                    <div className="dataset-card__actions">
                      <button
                        type="button"
                        className="btn btn--primary btn--mini"
                        disabled={isBusy || !draftName.trim()}
                        onClick={() =>
                          void onRenameDataset(dataset.id, draftName.trim()).then(() => {
                            cancelEditing();
                          })
                        }
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--mini"
                        disabled={isBusy}
                        onClick={cancelEditing}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h4 className="dataset-card__title">{dataset.display_name}</h4>
                    <div className="dataset-card__details">
                      <span className="dataset-pill">
                        {dataset.dataset_type === "alphabet" ? "Alphabet" : "Coding"}
                      </span>
                      <span className="dataset-card__meta">
                        Updated {formatDate(dataset.updated_at || dataset.created_at)}
                      </span>
                    </div>

                    {dataset.error_message ? (
                      <p className="dataset-card__error">{dataset.error_message}</p>
                    ) : null}

                    <div className="dataset-card__actions">
                      <button
                        type="button"
                        className="btn btn--ghost btn--mini"
                        disabled={isBusy}
                        onClick={() => startEditing(dataset)}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--mini btn--danger"
                        disabled={isBusy}
                        onClick={() => void onDeleteDataset(dataset.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function BackgroundGroup({
  backgrounds,
  busyBackgroundId,
  onSelectBackground,
  onDeleteBackground,
}: {
  backgrounds: BackgroundRecord[];
  busyBackgroundId: string | null;
  onSelectBackground: (backgroundId: string) => Promise<void>;
  onDeleteBackground: (backgroundId: string) => Promise<void>;
}) {
  return (
    <section className="dataset-group">
      <div className="dataset-group__header">
        <div>
          <h3 className="dataset-group__title">Background datasets</h3>
           
        </div>
      </div>

      <div className="dataset-card-grid">
        {backgrounds.map((background) => {
          const isBusy = busyBackgroundId === background.id;
          return (
            <article className="dataset-card" key={background.id}>
              <div className="dataset-card__header">
                <span
                  className={`status-badge status-badge--${background.status}`}
                >
                  {statusLabel[background.status]}
                </span>
                <span className="dataset-card__meta">
                  {background.is_default ? "Built in" : `Added ${formatDate(background.created_at)}`}
                </span>
              </div>

              <h4 className="dataset-card__title">{background.display_name}</h4>
              <div className="dataset-card__details">
                <span className="dataset-pill">
                  {background.is_default ? "Default" : "Custom"}
                </span>
                <span className="dataset-card__meta">
                  {background.is_selected ? "Currently selected" : "Available"}
                </span>
              </div>

              {background.error_message ? (
                <p className="dataset-card__error">{background.error_message}</p>
              ) : null}

              <div className="dataset-card__actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--mini"
                  disabled={isBusy || background.is_selected}
                  onClick={() => void onSelectBackground(background.id)}
                >
                  {background.is_selected ? "In use" : "Use background"}
                </button>
                {!background.is_default ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--mini btn--danger"
                    disabled={isBusy}
                    onClick={() => void onDeleteBackground(background.id)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function DatasetSection({
  isCodingMode,
  availableCounts,
  datasets,
  backgrounds,
  backgroundLimit,
  backgroundCustomCount,
  uploadError,
  isUploading,
  busyDatasetId,
  busyBackgroundId,
  onUpload,
  onUploadBackground,
  onRenameDataset,
  onDeleteDataset,
  onSelectBackground,
  onDeleteBackground,
}: Props) {
  const alphabetDatasets = useMemo(
    () => datasets.filter((dataset) => dataset.dataset_type === "alphabet"),
    [datasets]
  );
  const codingDatasets = useMemo(
    () => datasets.filter((dataset) => dataset.dataset_type === "coding"),
    [datasets]
  );

  return (
    <article className="surface surface--raised">
      <WorkflowSection
        step="03"
        title="Datasets"
        subtitle={
          "More Datasets -> More Human-Written !"
        }
      >
        <div className="library-metrics library-metrics--wide" role="group" aria-label="Dataset quotas">
          <div className="metric-pill metric-pill--accent">
            <span className="metric-pill__label">Alphabet Datasets</span>
            <strong className="metric-pill__value" aria-live="polite">
              {availableCounts.handwriting} / {availableCounts.handwritingLimit}
            </strong>
          </div>
          <div className="metric-pill metric-pill--accent">
            <span className="metric-pill__label">Coding Datasets</span>
            <strong className="metric-pill__value" aria-live="polite">
              {availableCounts.coding} / {availableCounts.codingLimit}
            </strong>
          </div>
          <div className="metric-pill metric-pill--accent">
            <span className="metric-pill__label">Background Datasets</span>
            <strong className="metric-pill__value" aria-live="polite">
              {backgroundCustomCount} / {backgroundLimit}
            </strong>
          </div>
        </div>

        {uploadError ? <ErrorBanner>{uploadError}</ErrorBanner> : null}
        {isUploading ? (
          <p className="status-line" role="status" aria-live="polite">
            Upload received. The backend is saving your new asset now.
          </p>
        ) : null}

        <div className="dataset-groups">
          <section className="dataset-group">
            <div className="dataset-group__header">
              <div>
                <h3 className="dataset-group__title">Upload handwriting datasets</h3>
                
              </div>
            </div>

            <div className="dataset-upload-stack">
              <div className="upload-grid">
                <label className="upload-tile">
                  <div className="upload-tile__header">
                    <span className="upload-tile__icon" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </span>
                    <span className="upload-tile__title">Alphabet Dataset (8x8)</span>
                  </div>
                  <span className="upload-tile__hint">A-Z, a-z, 0-9, comma, period</span>
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Upload alphabet handwriting grid image"
                    onChange={(event) => onUpload(event, "alphabet")}
                    disabled={isUploading}
                  />
                </label>
                <label className="upload-tile">
                  <div className="upload-tile__header">
                    <span className="upload-tile__icon upload-tile__icon--coding" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                      </svg>
                    </span>
                    <span className="upload-tile__title">Coding Dataset (6x5)</span>
                  </div>
                  <span className="upload-tile__hint">Special characters and symbols</span>
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Upload coding symbols grid image"
                    onChange={(event) => onUpload(event, "coding")}
                    disabled={isUploading}
                  />
                </label>
              </div>

              <div className="upload-grid upload-grid--single">
                <label className="upload-tile">
                  <div className="upload-tile__header">
                    <span className="upload-tile__icon upload-tile__icon--bg" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                    </span>
                    <span className="upload-tile__title">Custom Background</span>
                  </div>
                  <span className="upload-tile__hint">
                    Upload a custom page background image (optional)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Upload personal page background"
                    onChange={onUploadBackground}
                    disabled={isUploading || backgroundCustomCount >= backgroundLimit}
                  />
                </label>
              </div>
            </div>
          </section>

          <DatasetGroup
            title="Alphabet datasets"
            helper=""
            datasets={alphabetDatasets}
            busyDatasetId={busyDatasetId}
            onRenameDataset={onRenameDataset}
            onDeleteDataset={onDeleteDataset}
          />

          <DatasetGroup
            title="Coding datasets"
            helper=""
            datasets={codingDatasets}
            busyDatasetId={busyDatasetId}
            onRenameDataset={onRenameDataset}
            onDeleteDataset={onDeleteDataset}
          />

          <BackgroundGroup
            backgrounds={backgrounds}
            busyBackgroundId={busyBackgroundId}
            onSelectBackground={onSelectBackground}
            onDeleteBackground={onDeleteBackground}
          />
        </div>
      </WorkflowSection>
    </article>
  );
}
