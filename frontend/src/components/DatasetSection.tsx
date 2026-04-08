import type { ChangeEvent } from "react";
import { WorkflowSection } from "./WorkflowSection";
import { ErrorBanner } from "./ErrorBanner";
import type { UploadCounts, UploadType } from "../types";

type Props = {
  isCodingMode: boolean;
  sessionId: string | null;
  uploadCounts: UploadCounts;
  availableCounts: UploadCounts;
  uploadError: string | null;
  isUploading: boolean;
  copyHint: string | null;
  onCopySession: () => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>, type: UploadType) => void;
};

export function DatasetSection({
  isCodingMode,
  sessionId,
  uploadCounts,
  availableCounts,
  uploadError,
  isUploading,
  copyHint,
  onCopySession,
  onUpload,
}: Props) {
  return (
    <article className="surface surface--raised">
      <WorkflowSection
        step="01"
        title="Dataset library"
        subtitle={
          isCodingMode
            ? "Upload alphabet and coding grids, or use server library sets. Session stacks with the library at render time."
            : "Alphabet handwriting only in this mode. Upload a grid or use the library. Session stacks with the library at render time."
        }
        headerExtra={
          sessionId ? (
            <div className="session-chip">
              <span className="session-chip__label">Session</span>
              <code className="session-chip__id" title={sessionId}>
                {sessionId.length > 14
                  ? `${sessionId.slice(0, 8)}…${sessionId.slice(-4)}`
                  : sessionId}
              </code>
              <button
                type="button"
                className="btn btn--mini"
                onClick={onCopySession}
              >
                Copy ID
              </button>
              {copyHint ? (
                <span className="session-chip__hint" role="status" aria-live="polite">
                  {copyHint}
                </span>
              ) : null}
            </div>
          ) : null
        }
      >
        <div
          className={`library-metrics ${isCodingMode ? "library-metrics--coding" : "library-metrics--simple"}`}
          role="group"
          aria-label="Glyph counts by source"
        >
          <div className="metric-pill">
            <span className="metric-pill__label">Session · alphabet</span>
            <strong className="metric-pill__value" aria-live="polite">
              {uploadCounts.handwriting}
            </strong>
          </div>
          {isCodingMode ? (
            <div className="metric-pill">
              <span className="metric-pill__label">Session · coding</span>
              <strong className="metric-pill__value" aria-live="polite">
                {uploadCounts.coding}
              </strong>
            </div>
          ) : null}
          <div className="metric-pill metric-pill--accent">
            <span className="metric-pill__label">Library · alphabet</span>
            <strong className="metric-pill__value" aria-live="polite">
              {availableCounts.handwriting}
            </strong>
          </div>
          {isCodingMode ? (
            <div className="metric-pill metric-pill--accent">
              <span className="metric-pill__label">Library · coding</span>
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
            <span className="upload-tile__title">Alphabet grid (8×8)</span>
            <span className="upload-tile__hint">
              Handwriting cells mapped to letters and digits.
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
              <span className="upload-tile__title">Coding grid (6×5)</span>
              <span className="upload-tile__hint">
                Symbols for brackets, operators, and punctuation.
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
            Processing upload…
          </p>
        ) : null}
      </WorkflowSection>
    </article>
  );
}
