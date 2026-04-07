import { useEffect, useState } from "react";
import "./index.css";

type UploadType = "alphabet" | "coding";

type RenderOptions = {
  lineHeight: number;
  charSpacing: number;
  wordSpacing: number;
  jitter: number;
  inkColor: string;
  overallScale: number;
  marginLeft: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  baselineJitter: number;
  lineDriftPerWord: number;
  wordSpacingJitter: number;
  rotation: number;
  pressureMin: number;
  pressureMax: number;
  strokeGain: number;
  edgeRoughness: number;
  textureBlend: number;
  upperScale: number;
  ascenderScale: number;
  xHeightScale: number;
  descenderScale: number;
  descenderShift: number;
  digitScale: number;
  symbolScale: number;
  commaScale: number;
  commaShift: number;
  dotScale: number;
};

type UploadCounts = {
  handwriting: number;
  coding: number;
};

type DatasetResponse = {
  handwriting?: string[];
  coding?: string[];
};

type ExtractResponse = {
  sessionId?: string;
  datasets?: DatasetResponse;
  error?: string;
  details?: string;
};

type NumericOptionKey = Exclude<keyof RenderOptions, "inkColor">;

type SliderConfig = {
  key: NumericOptionKey;
  label: string;
  min: number;
  max: number;
  step: number;
  description: string;
  format?: (value: number) => string;
};

type ControlGroup = {
  title: string;
  description: string;
  controls: SliderConfig[];
};

const DEFAULT_TEXT = `Every brave cat danced eagerly for gentle heroes.

Middle letters stay compact, tall letters rise up, and descenders drop lower.
0123456789 !@#%^&*()_-=+[]{};:'"<>/?\\|\`~`;

const DEFAULT_OPTIONS: RenderOptions = {
  lineHeight: 82,
  charSpacing: 1,
  wordSpacing: 26,
  jitter: 3,
  inkColor: "#0f1e50",
  overallScale: 1.42,
  marginLeft: 100,
  marginTop: 180,
  marginRight: 30,
  marginBottom: 180,
  baselineJitter: 0.25,
  lineDriftPerWord: 0.18,
  wordSpacingJitter: 3,
  rotation: 2,
  pressureMin: 0.9,
  pressureMax: 0.98,
  strokeGain: 1.28,
  edgeRoughness: 0,
  textureBlend: 0.08,
  upperScale: 1,
  ascenderScale: 1,
  xHeightScale: 1,
  descenderScale: 1,
  descenderShift: 0,
  digitScale: 1,
  symbolScale: 1,
  commaScale: 1,
  commaShift: 0,
  dotScale: 1,
};

const BASIC_CONTROLS: SliderConfig[] = [
  {
    key: "lineHeight",
    label: "Line height",
    min: 40,
    max: 180,
    step: 1,
    description: "Vertical distance between rendered lines.",
  },
  {
    key: "charSpacing",
    label: "Letter spacing",
    min: -12,
    max: 30,
    step: 1,
    description: "Space between neighboring letters inside words.",
  },
  {
    key: "wordSpacing",
    label: "Word spacing",
    min: 8,
    max: 70,
    step: 1,
    description: "Gap inserted for spaces in the compose box.",
  },
  {
    key: "jitter",
    label: "Jitter",
    min: 0,
    max: 12,
    step: 0.5,
    description: "Overall natural wobble for spacing, drift, and rotation.",
    format: (value) => value.toFixed(1),
  },
];

const ADVANCED_GROUPS: ControlGroup[] = [
  {
    title: "Letter Families",
    description:
      "Tune each family separately: middle letters, ascenders, descenders, numbers, and punctuation.",
    controls: [
      {
        key: "xHeightScale",
        label: "Middle letters",
        min: 0.6,
        max: 1.6,
        step: 0.01,
        description: "a c e m n o r s u v w x z",
        format: (value) => `${value.toFixed(2)}x`,
      },
      {
        key: "ascenderScale",
        label: "Tall letters",
        min: 0.6,
        max: 1.7,
        step: 0.01,
        description: "b d f h k l t",
        format: (value) => `${value.toFixed(2)}x`,
      },
      {
        key: "descenderScale",
        label: "Descenders",
        min: 0.6,
        max: 1.8,
        step: 0.01,
        description: "g j p q y",
        format: (value) => `${value.toFixed(2)}x`,
      },
      {
        key: "descenderShift",
        label: "Descender drop",
        min: -8,
        max: 28,
        step: 1,
        description: "Moves descenders farther below the baseline.",
      },
      {
        key: "upperScale",
        label: "Uppercase size",
        min: 0.6,
        max: 1.6,
        step: 0.01,
        description: "Scale for A-Z.",
        format: (value) => `${value.toFixed(2)}x`,
      },
      {
        key: "digitScale",
        label: "Digit size",
        min: 0.6,
        max: 1.6,
        step: 0.01,
        description: "Scale for 0-9.",
        format: (value) => `${value.toFixed(2)}x`,
      },
      {
        key: "symbolScale",
        label: "Symbol size",
        min: 0.6,
        max: 1.9,
        step: 0.01,
        description: "Scale for coding symbols and punctuation marks.",
        format: (value) => `${value.toFixed(2)}x`,
      },
      {
        key: "commaScale",
        label: "Comma size",
        min: 0.5,
        max: 1.8,
        step: 0.01,
        description: "Useful when commas feel too small compared to letters.",
        format: (value) => `${value.toFixed(2)}x`,
      },
      {
        key: "commaShift",
        label: "Comma drop",
        min: -12,
        max: 18,
        step: 1,
        description: "Moves commas lower or higher relative to the baseline.",
      },
      {
        key: "dotScale",
        label: "Dot size",
        min: 0.5,
        max: 1.8,
        step: 0.01,
        description: "Scale for periods and dot-like punctuation.",
        format: (value) => `${value.toFixed(2)}x`,
      },
    ],
  },
  {
    title: "Flow And Layout",
    description:
      "These controls affect how lines breathe and how the page is laid out.",
    controls: [
      {
        key: "overallScale",
        label: "Overall size",
        min: 0.8,
        max: 2.2,
        step: 0.01,
        description: "Scales the whole handwriting system up or down.",
        format: (value) => `${value.toFixed(2)}x`,
      },
      {
        key: "marginLeft",
        label: "Left margin",
        min: 20,
        max: 220,
        step: 1,
        description: "Page start position from the left edge.",
      },
      {
        key: "marginTop",
        label: "Top margin",
        min: 40,
        max: 300,
        step: 1,
        description: "Baseline position of the first line.",
      },
      {
        key: "marginRight",
        label: "Right margin",
        min: 10,
        max: 180,
        step: 1,
        description: "Padding kept before the page edge.",
      },
      {
        key: "marginBottom",
        label: "Bottom margin",
        min: 40,
        max: 260,
        step: 1,
        description: "Padding kept before the bottom of the page.",
      },
      {
        key: "baselineJitter",
        label: "Baseline wobble",
        min: 0,
        max: 5,
        step: 0.05,
        description: "Tiny up and down movement of individual glyphs.",
        format: (value) => value.toFixed(2),
      },
      {
        key: "lineDriftPerWord",
        label: "Line drift",
        min: 0,
        max: 3,
        step: 0.05,
        description: "Gentle rising or dipping motion across each line.",
        format: (value) => value.toFixed(2),
      },
      {
        key: "wordSpacingJitter",
        label: "Word spacing variance",
        min: 0,
        max: 20,
        step: 0.25,
        description: "How much each word gap can vary from the slider above.",
        format: (value) => value.toFixed(2),
      },
      {
        key: "rotation",
        label: "Rotation range",
        min: 0,
        max: 8,
        step: 0.1,
        description: "Maximum rotation in degrees in either direction.",
        format: (value) => `${value.toFixed(1)}°`,
      },
    ],
  },
  {
    title: "Ink And Texture",
    description:
      "Use these when you want the letters to feel darker, rougher, or more scan-like.",
    controls: [
      {
        key: "pressureMin",
        label: "Pressure minimum",
        min: 0.4,
        max: 1.2,
        step: 0.01,
        description: "Lower bound for ink pressure.",
        format: (value) => value.toFixed(2),
      },
      {
        key: "pressureMax",
        label: "Pressure maximum",
        min: 0.5,
        max: 1.5,
        step: 0.01,
        description: "Upper bound for ink pressure.",
        format: (value) => value.toFixed(2),
      },
      {
        key: "strokeGain",
        label: "Stroke thickness",
        min: 0.6,
        max: 2.4,
        step: 0.01,
        description: "Makes the handwriting look lighter or thicker.",
        format: (value) => value.toFixed(2),
      },
      {
        key: "edgeRoughness",
        label: "Edge roughness",
        min: 0,
        max: 0.3,
        step: 0.01,
        description: "Adds slight edge breakup so strokes look less perfect.",
        format: (value) => value.toFixed(2),
      },
      {
        key: "textureBlend",
        label: "Paper blend",
        min: 0,
        max: 0.4,
        step: 0.01,
        description: "Blends ink more into the page texture.",
        format: (value) => value.toFixed(2),
      },
    ],
  },
];

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatControlValue(config: SliderConfig, value: number) {
  if (config.format) {
    return config.format(value);
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

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
  const [text, setText] = useState(DEFAULT_TEXT);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [options, setOptions] = useState<RenderOptions>(DEFAULT_OPTIONS);

  const canRender =
    uploadCounts.handwriting > 0 || availableCounts.handwriting > 0;

  const setNumericOption = (key: NumericOptionKey, value: number) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };

  const loadDatasets = async () => {
    setIsLoadingDatasets(true);
    try {
      const response = await fetch(apiUrl("/api/datasets"));
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
  };

  useEffect(() => {
    loadDatasets();
  }, []);

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
    setOptions(DEFAULT_OPTIONS);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    await loadDatasets();
  };

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <div className="app__dot" />
          <div>
            <p className="app__kicker">Handwritten Notes Generator</p>
            <h1 className="app__title">Upload - Render - Download</h1>
          </div>
        </div>
        <button className="ghost" onClick={resetSession}>
          Reset Session
        </button>
      </header>

      <main className="app__main">
        <section className="card">
          <div className="card__header">
            <div>
              <h2>Upload Datasets</h2>
              <p className="muted">
                Session uploads: {uploadCounts.handwriting} alphabet set(s),{" "}
                {uploadCounts.coding} coding set(s)
              </p>
            </div>
            <button
              className="ghost"
              onClick={loadDatasets}
              disabled={isLoadingDatasets}
            >
              {isLoadingDatasets ? "Refreshing..." : "Refresh Library"}
            </button>
          </div>

          <p className="muted">
            Available in backend: {availableCounts.handwriting} alphabet set(s),{" "}
            {availableCounts.coding} coding set(s)
          </p>

          <div className="upload-grid">
            <label className="upload">
              <span>Alphabet Grid (8x8)</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleUpload(event, "alphabet")}
                disabled={isUploading}
              />
            </label>
            <label className="upload">
              <span>Coding Symbols Grid (6x5)</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleUpload(event, "coding")}
                disabled={isUploading}
              />
            </label>
          </div>

          {uploadError && <div className="alert">{uploadError}</div>}
          {isUploading && <p className="muted">Processing upload...</p>}
        </section>

        <section className="card">
          <div className="card__header card__header--start">
            <div>
              <h2>Compose</h2>
              <p className="muted">
                Empty lines are preserved now, so a blank line in the box becomes
                a blank line on the page.
              </p>
            </div>
            <button
              className="primary"
              onClick={handleRender}
              disabled={!canRender || isRendering}
            >
              {isRendering ? "Rendering..." : "Render Page"}
            </button>
          </div>

          <textarea
            className="textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />

          <div className="controls controls--basic">
            {BASIC_CONTROLS.map((control) => (
              <label className="slider-card" key={control.key}>
                <div className="slider-card__header">
                  <span>{control.label}</span>
                  <strong>{formatControlValue(control, options[control.key])}</strong>
                </div>
                <input
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={options[control.key]}
                  onChange={(event) =>
                    setNumericOption(control.key, Number(event.target.value))
                  }
                />
                <small>{control.description}</small>
              </label>
            ))}
          </div>

          <div className="advanced-bar">
            <div>
              <h3>Advanced Filters</h3>
              <p className="muted">
                Expand to fine-tune letter families, page flow, and ink behavior.
              </p>
            </div>
            <button
              className="ghost"
              onClick={() => setShowAdvanced((value) => !value)}
            >
              {showAdvanced ? "Hide Advanced Filters" : "Show All Filters"}
            </button>
          </div>

          {showAdvanced && (
            <div className="advanced-panel">
              <label className="color-control">
                <span>Ink color</span>
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
                    <h3>{group.title}</h3>
                    <p className="muted">{group.description}</p>
                  </div>
                  <div className="controls controls--advanced">
                    {group.controls.map((control) => (
                      <label className="slider-card" key={control.key}>
                        <div className="slider-card__header">
                          <span>{control.label}</span>
                          <strong>
                            {formatControlValue(control, options[control.key])}
                          </strong>
                        </div>
                        <input
                          type="range"
                          min={control.min}
                          max={control.max}
                          step={control.step}
                          value={options[control.key]}
                          onChange={(event) =>
                            setNumericOption(control.key, Number(event.target.value))
                          }
                        />
                        <small>{control.description}</small>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {renderError && <div className="alert">{renderError}</div>}
        </section>

        <section className="card preview">
          <div className="card__header">
            <h2>Preview</h2>
            {previewUrl && (
              <a className="ghost" href={previewUrl} download="handwritten-page.png">
                Download PNG
              </a>
            )}
          </div>
          <div className="preview__body">
            {previewUrl ? (
              <img src={previewUrl} alt="Rendered preview" />
            ) : (
              <p className="muted">Render to see output.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
