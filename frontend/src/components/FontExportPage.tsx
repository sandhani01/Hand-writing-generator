import { useMemo, type ChangeEvent } from "react";
import { FontTuningSection } from "./FontTuningSection";
import type { DatasetRecord, UploadType, FontMetricsOptions } from "../types";

type Props = {
  datasets: DatasetRecord[];
  isUploading: boolean;
  uploadError: string | null;
  isExportingFont: boolean;
  fontExportError: string | null;
  metrics: FontMetricsOptions;
  onMetricsChange: (metrics: FontMetricsOptions) => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>, type: UploadType) => void;
  onExportFont: (format: "ttf" | "woff") => void;
  onBack: () => void;
  onDeleteDataset: (id: string) => void;
  busyDatasetId: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function FontExportPage({
  datasets,
  isUploading,
  uploadError,
  isExportingFont,
  fontExportError,
  metrics,
  onMetricsChange,
  onUpload,
  onExportFont,
  onBack,
  onDeleteDataset,
  busyDatasetId,
}: Props) {
  const alphabetDatasets = useMemo(
    () => datasets.filter((d) => d.dataset_type === "alphabet"),
    [datasets]
  );

  
  const hasCompletedDataset = datasets.some((d) => d.status === "completed");

  return (
    <>
      <div className="gate-background">
        <div className="gate-background__glow" />
      </div>
      <div className="font-export-page app--gate">
        <header className="font-export-page__header">
          <button className="font-export-page__back" onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            <span>Dashboard</span>
          </button>
          <div className="font-export-page__title-area">
            <h1 className="font-export-page__title">Handwriting Font Generator</h1>
            <p className="font-export-page__subtitle">Convert your scans into professional TrueType fonts</p>
          </div>
        </header>

        <main className="font-export-page__main">
          <div className="font-export-grid">
            <section className="font-export-card">
              <div className="font-export-card__header">
                <div className="font-export-card__icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-export-card__name">Step 1: Upload Grid</h2>
                  <p className="font-export-card__desc">Upload your 8x8 alphabet grid</p>
                </div>
              </div>

              <div className="font-export-card__content">
                <label htmlFor="alphabet-upload" className="font-upload-dropzone">
                  <div className="font-upload-dropzone__inner">
                    <div className="font-upload-dropzone__icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <div className="font-upload-dropzone__text">
                      <strong>Click to upload</strong> or drag and drop
                    </div>
                    <div className="font-upload-dropzone__hint">PNG, JPG or JPEG (Max 10MB)</div>
                  </div>
                  <input
                    id="alphabet-upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => onUpload(e, "alphabet")}
                    disabled={isUploading}
                    className="visually-hidden"
                  />
                </label>

                {isUploading && (
                  <div className="font-export-status">
                    <div className="loader-dots">
                      <span></span><span></span><span></span>
                    </div>
                    <p>Processing your handwriting...</p>
                  </div>
                )}
                {uploadError && <div className="font-export-error">{uploadError}</div>}
              </div>
            </section>

            <section className="font-export-card">
              <div className="font-export-card__header">
                <div className="font-export-card__icon font-export-card__icon--success">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-export-card__name">Step 3: Download</h2>
                  <p className="font-export-card__desc">Get your custom font files</p>
                </div>
              </div>

              <div className="font-export-card__content">
                <div className="font-download-actions">
                  <button
                    className="btn-premium btn-premium--primary"
                    disabled={!hasCompletedDataset || isExportingFont}
                    onClick={() => onExportFont("ttf")}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>{isExportingFont ? "Vectorizing..." : "Download .TTF"}</span>
                  </button>
                  <button
                    className="btn-premium btn-premium--ghost"
                    disabled={!hasCompletedDataset || isExportingFont}
                    onClick={() => onExportFont("woff")}
                  >
                    <span>Download .WOFF</span>
                  </button>
                </div>

                {!hasCompletedDataset && !isUploading && (
                  <div className="font-export-note">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>Upload a scan first to enable downloads</span>
                  </div>
                )}
                {fontExportError && <div className="font-export-error">{fontExportError}</div>}
              </div>
            </section>
          </div>

          <div style={{ marginTop: "2rem" }}>
            <FontTuningSection metrics={metrics} onChange={onMetricsChange} />
          </div>

          {datasets.length > 0 && (
            <section className="font-library-section">
              <h3 className="font-library-section__title">
                <span>Recent Uploads</span>
              </h3>
              <div className="font-library-grid">
                {alphabetDatasets.map((d) => (
                  <div key={d.id} className="font-library-card">
                    <div className="font-library-card__info">
                      <span className={`status-dot status-dot--${d.status}`} />
                      <div className="font-library-card__details">
                        <span className="font-library-card__name">{d.display_name}</span>
                        <span className="font-library-card__meta">Added {formatDate(d.created_at)}</span>
                      </div>
                    </div>
                    <button 
                      className="font-library-card__delete"
                      disabled={busyDatasetId === d.id}
                      onClick={() => onDeleteDataset(d.id)}
                      aria-label="Delete"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </>
  );
}
