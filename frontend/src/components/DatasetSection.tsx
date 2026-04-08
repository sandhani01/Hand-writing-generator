import type { ChangeEvent } from "react";
import { WorkflowSection } from "./WorkflowSection";
import { ErrorBanner } from "./ErrorBanner";
import type { UploadCounts, UploadType } from "../types";

type Props = {
  isCodingMode: boolean;
  availableCounts: UploadCounts;
  uploadError: string | null;
  isUploading: boolean;
  onUpload: (event: ChangeEvent<HTMLInputElement>, type: UploadType) => void;
};

export function DatasetSection({
  isCodingMode,
  availableCounts,
  uploadError,
  isUploading,
  onUpload,
}: Props) {
  return (
    <article className="surface surface--raised">
      <WorkflowSection
        step="01"
        title="Datasets"
        subtitle={
          isCodingMode
            ? "These are the alphabet and coding datasets in your personal database. Uploading a new grid adds another dataset."
            : "These are the alphabet datasets in your personal database. Uploading a new grid adds another dataset."
        }
      >
        <div
          className={`library-metrics ${
            isCodingMode ? "library-metrics--coding" : "library-metrics--simple"
          }`}
          role="group"
          aria-label="Dataset counts"
        >
          <div className="metric-pill metric-pill--accent">
            <span className="metric-pill__label">Alphabet datasets</span>
            <strong className="metric-pill__value" aria-live="polite">
              {availableCounts.handwriting}
            </strong>
          </div>
          {isCodingMode ? (
            <div className="metric-pill metric-pill--accent">
              <span className="metric-pill__label">Coding datasets</span>
              <strong className="metric-pill__value" aria-live="polite">
                {availableCounts.coding}
              </strong>
            </div>
          ) : null}
        </div>

        <div
          className={`upload-grid ${isCodingMode ? "" : "upload-grid--single"}`}
        >
          <label className="upload-tile">
            <span className="upload-tile__title">Alphabet grid (8x8)</span>
            <span className="upload-tile__hint">
              Add a new alphabet dataset from handwritten letters and digits.
            </span>
            <input
              type="file"
              accept="image/*"
              aria-label="Upload alphabet handwriting grid image"
              onChange={(event) => onUpload(event, "alphabet")}
              disabled={isUploading}
            />
          </label>
          {isCodingMode ? (
            <label className="upload-tile">
              <span className="upload-tile__title">Coding grid (6x5)</span>
              <span className="upload-tile__hint">
                Add a new coding-symbol dataset for brackets, operators, and punctuation.
              </span>
              <input
                type="file"
                accept="image/*"
                aria-label="Upload coding symbols grid image"
                onChange={(event) => onUpload(event, "coding")}
                disabled={isUploading}
              />
            </label>
          ) : null}
        </div>

        {uploadError ? <ErrorBanner>{uploadError}</ErrorBanner> : null}
        {isUploading ? (
          <p className="status-line" role="status" aria-live="polite">
            Processing upload...
          </p>
        ) : null}
      </WorkflowSection>
    </article>
  );
}
