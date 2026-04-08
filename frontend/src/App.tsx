import { useCallback, useEffect, useState } from "react";
import {
  clearStoredAssignmentMode,
  persistAssignmentMode,
  readStoredAssignmentMode,
} from "./assignmentModeStorage";
import { AssignmentModePicker } from "./components/AssignmentModePicker";
import { SliderControl } from "./components/SliderControl";
import { ThemeToggle } from "./components/ThemeToggle";
import { WorkflowSection } from "./components/WorkflowSection";
import { useTheme } from "./useTheme";
import {
  ADVANCED_GROUPS,
  BASIC_CONTROLS,
  DEFAULT_TEXT_CODING,
  DEFAULT_TEXT_SIMPLE,
  FALLBACK_OPTIONS,
  getErrorMessage,
} from "./renderControls";
import type {
  AssignmentMode,
  DatasetResponse,
  DefaultsResponse,
  ExtractResponse,
  NumericOptionKey,
  RenderOptions,
  UploadCounts,
  UploadType,
} from "./types";

export default function App() {
  const apiBase =
    ((import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env
      ?.VITE_API_BASE || "").replace(/\/$/, "");
  const apiUrl = (path: string) => `${apiBase}${path}`;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploadCounts, setUploadCounts] = useState<UploadCounts>({
    handwriting: 0,
    coding: 0,
  });
  const [availableCounts, setAvailableCounts] = useState<UploadCounts>({
    handwriting: 0,
    coding: 0,
  });
  const [text, setText] = useState(() => {
    const m = readStoredAssignmentMode();
    return m === "coding" ? DEFAULT_TEXT_CODING : DEFAULT_TEXT_SIMPLE;
  });
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode | null>(
    () => readStoredAssignmentMode()
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [defaultOptions, setDefaultOptions] =
    useState<RenderOptions>(FALLBACK_OPTIONS);
  const [options, setOptions] = useState<RenderOptions>(FALLBACK_OPTIONS);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();

  const canRender =
    uploadCounts.handwriting > 0 || availableCounts.handwriting > 0;

  const setNumericOption = (key: NumericOptionKey, value: number) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };

  const loadDatasets = useCallback(async () => {
    setIsLoadingDatasets(true);
    try {
      const response = await fetch(`${apiBase}/api/datasets`);
      const data: DatasetResponse = await response.json();
      if (!response.ok) {
        throw new Error("Could not load datasets");
      }
      setAvailableCounts({
        handwriting: data.handwriting?.length || 0,
        coding: data.coding?.length || 0,
      });
    } catch (error) {
      setRenderError(
        getErrorMessage(
          error,
          "Could not reach the backend. Start api_server.py first."
        )
      );
    } finally {
      setIsLoadingDatasets(false);
    }
  }, [apiBase]);

  const loadRendererDefaults = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/api/defaults`);
      const data: DefaultsResponse = await response.json();
      if (!response.ok || !data.options) {
        throw new Error("Could not load renderer defaults");
      }

      setDefaultOptions(data.options);
      setOptions(data.options);
    } catch {
      setDefaultOptions(FALLBACK_OPTIONS);
      setOptions(FALLBACK_OPTIONS);
    }
  }, [apiBase]);

  useEffect(() => {
    loadRendererDefaults();
    loadDatasets();
  }, [loadDatasets, loadRendererDefaults]);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        "content",
        theme === "dark" ? "#0b0d11" : "#eceae4"
      );
    }
  }, [theme]);

  const handleUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: UploadType
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("grid", file);
    formData.append("type", type);
    if (sessionId) {
      formData.append("sessionId", sessionId);
    }

    try {
      const response = await fetch(apiUrl("/api/extract"), {
        method: "POST",
        body: formData,
      });
      const data: ExtractResponse = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || "Upload failed");
      }

      if (data.sessionId) {
        setSessionId(data.sessionId);
      }
      setUploadCounts({
        handwriting: data.datasets?.handwriting?.length || 0,
        coding: data.datasets?.coding?.length || 0,
      });
      await loadDatasets();
    } catch (error) {
      setUploadError(
        getErrorMessage(
          error,
          "Upload failed. Check whether the Python API is running."
        )
      );
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleRender = async () => {
    if (!canRender) {
      setRenderError(
        "No handwriting dataset is available yet. Upload one or keep a sample in handwriting_samples."
      );
      return;
    }

    setIsRendering(true);
    setRenderError(null);

    try {
      const response = await fetch(apiUrl("/api/render"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, text, options }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.details || data.error || "Render failed");
      }

      const blob = await response.blob();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (error) {
      setRenderError(getErrorMessage(error, "Render failed"));
    } finally {
      setIsRendering(false);
    }
  };

  const resetSession = async () => {
    setSessionId(null);
    setUploadCounts({ handwriting: 0, coding: 0 });
    setUploadError(null);
    setRenderError(null);
    setOptions(defaultOptions);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    await loadDatasets();
  };

  const selectAssignmentMode = (mode: AssignmentMode) => {
    setAssignmentMode(mode);
    setText(mode === "coding" ? DEFAULT_TEXT_CODING : DEFAULT_TEXT_SIMPLE);
    persistAssignmentMode(mode);
  };

  const openAssignmentPicker = () => {
    setAssignmentMode(null);
    clearStoredAssignmentMode();
  };

  const copySessionId = async () => {
    if (!sessionId) {
      return;
    }
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopyHint("Copied");
      window.setTimeout(() => setCopyHint(null), 2000);
    } catch {
      setCopyHint("Copy failed");
      window.setTimeout(() => setCopyHint(null), 2000);
    }
  };

  const isCodingMode = assignmentMode === "coding";

  if (assignmentMode === null) {
    return (
      <div className="app app--gate">
        <a className="skip-link" href="#assignment-picker">
          Skip to choices
        </a>
        <div className="gate-topbar">
          <span className="gate-brand">Handwritten Notes</span>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <AssignmentModePicker onSelect={selectAssignmentMode} />
      </div>
    );
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main-workflow">
        Skip to workflow
      </a>

      <header className="app-header">
        <div className="app-header__brand">
          <p className="app-header__eyebrow">Handwritten Notes</p>
          <div className="app-header__title-row">
            <h1 className="app-header__title">Render pages in your handwriting</h1>
            <span
              className={`mode-badge ${isCodingMode ? "mode-badge--coding" : ""}`}
            >
              {isCodingMode ? "Coding" : "Simple"}
            </span>
          </div>
          <p className="app-header__lede">
            {isCodingMode
              ? "Alphabet and coding grids, compose, tune, then export a PNG."
              : "Alphabet grids only in this mode. Compose, tune, then export a PNG."}
          </p>
        </div>
        <div className="app-header__toolbar">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button
            type="button"
            className="btn btn--ghost"
            onClick={openAssignmentPicker}
          >
            Change type
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={loadDatasets}
            disabled={isLoadingDatasets}
          >
            {isLoadingDatasets ? "Refreshing…" : "Refresh library"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={resetSession}>
            Reset session
          </button>
        </div>
      </header>

      <main id="main-workflow" className="layout">
        <div className="layout__stack">
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
                      onClick={copySessionId}
                    >
                      Copy
                    </button>
                    {copyHint ? (
                      <span className="session-chip__hint">{copyHint}</span>
                    ) : null}
                  </div>
                ) : null
              }
            >
              <div
                className={`library-metrics ${isCodingMode ? "library-metrics--coding" : "library-metrics--simple"}`}
                role="group"
                aria-label="Dataset counts"
              >
                <div className="metric-pill">
                  <span className="metric-pill__label">Session · alphabet</span>
                  <strong className="metric-pill__value">
                    {uploadCounts.handwriting}
                  </strong>
                </div>
                {isCodingMode ? (
                  <div className="metric-pill">
                    <span className="metric-pill__label">Session · coding</span>
                    <strong className="metric-pill__value">
                      {uploadCounts.coding}
                    </strong>
                  </div>
                ) : null}
                <div className="metric-pill metric-pill--accent">
                  <span className="metric-pill__label">Library · alphabet</span>
                  <strong className="metric-pill__value">
                    {availableCounts.handwriting}
                  </strong>
                </div>
                {isCodingMode ? (
                  <div className="metric-pill metric-pill--accent">
                    <span className="metric-pill__label">Library · coding</span>
                    <strong className="metric-pill__value">
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
                    onChange={(event) => handleUpload(event, "alphabet")}
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
                      onChange={(event) => handleUpload(event, "coding")}
                      disabled={isUploading}
                    />
                  </label>
                ) : null}
              </div>

              {uploadError ? <div className="alert">{uploadError}</div> : null}
              {isUploading ? (
                <p className="status-line">Processing upload…</p>
              ) : null}
            </WorkflowSection>
          </article>

          <article className="surface surface--raised">
            <WorkflowSection
              step="02"
              title="Compose"
              subtitle={
                isCodingMode
                  ? "Blank lines stay blank. Use symbols that match your coding grid for best results."
                  : "Blank lines in the box stay blank in the render. Edit freely."
              }
            >
              <textarea
                className="compose-input"
                value={text}
                onChange={(event) => setText(event.target.value)}
                spellCheck={false}
                aria-label="Text to render"
              />
            </WorkflowSection>
          </article>

          <article className="surface surface--raised">
            <WorkflowSection
              step="03"
              title="Tuning"
              subtitle="Core spacing controls are always visible. Open advanced for ink, margins, and glyph families."
              headerExtra={
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleRender}
                  disabled={!canRender || isRendering}
                >
                  {isRendering ? "Rendering…" : "Render page"}
                </button>
              }
            >
              <div className="controls controls--basic">
                {BASIC_CONTROLS.map((control) => (
                  <SliderControl
                    key={control.key}
                    config={control}
                    options={options}
                    onChange={setNumericOption}
                  />
                ))}
              </div>

              <div className="advanced-bar">
                <div>
                  <h3 className="advanced-bar__title">Advanced</h3>
                  <p className="advanced-bar__text">
                    Letter classes, page margins, drift, and ink texture.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--collapse"
                  onClick={() => setShowAdvanced((value) => !value)}
                  aria-expanded={showAdvanced}
                >
                  <span className="btn__chevron" data-open={showAdvanced} aria-hidden />
                  {showAdvanced ? "Hide advanced" : "Show advanced"}
                </button>
              </div>

              <div className={`advanced-panel ${showAdvanced ? "is-open" : ""}`}>
                <label className="color-control">
                  <span className="color-control__label">Ink color</span>
                  <div className="color-control__row">
                    <input
                      type="color"
                      value={options.inkColor}
                      onChange={(event) =>
                        setOptions((current) => ({
                          ...current,
                          inkColor: event.target.value,
                        }))
                      }
                    />
                    <code>{options.inkColor}</code>
                  </div>
                </label>

                {ADVANCED_GROUPS.map((group) => (
                  <section className="control-group" key={group.title}>
                    <div className="control-group__header">
                      <h3 className="control-group__title">{group.title}</h3>
                      <p className="control-group__desc">{group.description}</p>
                    </div>
                    <div className="controls controls--advanced">
                      {group.controls.map((control) => (
                        <SliderControl
                          key={control.key}
                          config={control}
                          options={options}
                          onChange={setNumericOption}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              {renderError ? <div className="alert">{renderError}</div> : null}
            </WorkflowSection>
          </article>
        </div>

        <aside className="layout__preview" aria-label="Preview and export">
          <article className="surface surface--preview">
            <WorkflowSection
              step="04"
              title="Preview"
              subtitle="Latest render. Regenerate after you change text or controls."
              className="workflow-section--tight"
            >
              <div className="preview-frame">
                {previewUrl ? (
                  <img src={previewUrl} alt="Rendered handwritten page" />
                ) : (
                  <div className="preview-empty">
                    <p className="preview-empty__title">No preview yet</p>
                    <p className="preview-empty__text">
                      Add text, tune options if you like, then use{" "}
                      <strong>Render page</strong> in the tuning step.
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
                      Saves the current PNG to your device (same image as above).
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
      </main>
    </div>
  );
}
