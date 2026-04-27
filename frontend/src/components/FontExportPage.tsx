import { useMemo, type ChangeEvent } from "react";
import { ErrorBanner } from "./ErrorBanner";
import type { DatasetRecord, UploadType } from "../types";

type Props = {
  datasets: DatasetRecord[];
  isUploading: boolean;
  uploadError: string | null;
  isExportingFont: boolean;
  fontExportError: string | null;
  onUpload: (event: ChangeEvent<HTMLInputElement>, type: UploadType) => void;
  onExportFont: (format: "ttf" | "woff") => void;
  onBack: () => void;
  onDeleteDataset: (id: string) => void;
  busyDatasetId: string | null;
};

export function FontExportPage({
  datasets,
  isUploading,
  uploadError,
  isExportingFont,
  fontExportError,
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
    <div className="font-export-page">
      <header className="font-export-page__header">
        <button className="btn btn--ghost btn--mini" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Back to Dashboard
        </button>
        <h1 className="font-export-page__title">Handwriting Font Generator</h1>
      </header>

      <main className="font-export-page__main">
        <section className="font-export-card">
          <div className="font-export-card__header">
            <div className="font-export-card__icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </div>
            <div>
              <h2 className="font-export-card__name">Step 1: Upload Handwriting Scan</h2>
              <p className="font-export-card__desc">Upload your completed alphabet grid to generate your personal font.</p>
            </div>
          </div>

          <div className="font-export-card__upload-grid">
            <label htmlFor="alphabet-upload" className="upload-tile upload-tile--featured" style={{ gridColumn: '1 / -1' }}>
              <div className="upload-tile__header">
                <span className="upload-tile__icon" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                    <path d="M8 7h6" />
                    <path d="M8 11h8" />
                    <path d="M8 15h6" />
                  </svg>
                </span>
                <span className="upload-tile__title">Alphabet Grid (8x8)</span>
              </div>
              <span className="upload-tile__hint">A-Z, a-z, 0-9, and basic punctuation</span>
              <input
                id="alphabet-upload"
                type="file"
                accept="image/*"
                onChange={(e) => onUpload(e, "alphabet")}
                disabled={isUploading}
              />
            </label>
          </div>

          {uploadError && <ErrorBanner>{uploadError}</ErrorBanner>}
          {isUploading && (
             <div className="font-export-page__status font-export-page__status--loading">
               <div className="btn__icon--spin">â—†</div>
               <span>Analyzing your handwriting patterns...</span>
             </div>
          )}
        </section>


        <section className="font-export-card">
          <div className="font-export-card__header">
            <div className="font-export-card__icon font-export-card__icon--success">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div>
              <h2 className="font-export-card__name">Step 2: Download your Font</h2>
              <p className="font-export-card__desc">Ready to install! Use it in any document editor.</p>
            </div>
          </div>

          <div className="font-export-card__actions">
            <button
              className="btn btn--primary btn--block btn--lg"
              disabled={!hasCompletedDataset || isExportingFont}
              onClick={() => onExportFont("ttf")}
            >
              {isExportingFont ? "Vectorizing..." : "Download .TTF (Installable)"}
            </button>
            <button
              className="btn btn--ghost btn--block btn--lg"
              disabled={!hasCompletedDataset || isExportingFont}
              onClick={() => onExportFont("woff")}
            >
               {isExportingFont ? "Vectorizing..." : "Download .WOFF (Web Font)"}
            </button>
          </div>

          {fontExportError && <ErrorBanner>{fontExportError}</ErrorBanner>}
          {!hasCompletedDataset && !isUploading && (
            <p className="font-export-card__note">
              Please upload and process a handwriting scan first to enable downloads.
            </p>
          )}
        </section>

        {datasets.length > 0 && (
          <section className="font-export-library">
            <h3 className="font-export-library__title">Processed Glyphs</h3>
            
            {alphabetDatasets.length > 0 && (
              <div className="font-export-library__group">
                <h4 className="font-export-library__group-title">Alphabet Grids</h4>
                <div className="dataset-card-grid">
                  {alphabetDatasets.map((d) => (
                    <div key={d.id} className="dataset-card">
                      <div className="dataset-card__header">
                        <span className={`status-badge status-badge--${d.status}`}>{d.status}</span>
                      </div>
                      <h4 className="dataset-card__title">{d.display_name}</h4>
                      <button 
                        className="btn btn--ghost btn--mini btn--danger"
                        disabled={busyDatasetId === d.id}
                        onClick={() => onDeleteDataset(d.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </section>
        )}
      </main>
    </div>
  );
}
