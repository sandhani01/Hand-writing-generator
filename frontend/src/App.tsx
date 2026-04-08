import { useCallback, useEffect, useState } from "react";
import {
  clearStoredAssignmentMode,
  persistAssignmentMode,
  readStoredAssignmentMode,
} from "./assignmentModeStorage";
import { AppHeader } from "./components/AppHeader";
import { AssignmentGate } from "./components/AssignmentGate";
import { ComposeSection } from "./components/ComposeSection";
import { DatasetSection } from "./components/DatasetSection";
import { PreviewSection } from "./components/PreviewSection";
import { TuningSection } from "./components/TuningSection";
import { useTheme } from "./useTheme";
import {
  DEFAULT_TEXT_CODING,
  DEFAULT_TEXT_SIMPLE,
  EMPTY_CHARACTER_OVERRIDE,
  FALLBACK_OPTIONS,
  getErrorMessage,
  normalizeRenderOptions,
} from "./renderControls";
import type {
  AssignmentMode,
  CharacterOverrideKey,
  DatasetResponse,
  DefaultsResponse,
  ExtractResponse,
  NumericOptionKey,
  RenderOptions,
  UploadType,
} from "./types";

export default function App() {
  const apiBase =
    ((import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env
      ?.VITE_API_BASE || "").replace(/\/$/, "");
  const apiUrl = (path: string) => `${apiBase}${path}`;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [availableCounts, setAvailableCounts] = useState({
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
  const [supportsCharacterOverrides, setSupportsCharacterOverrides] =
    useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  const canRender = availableCounts.handwriting > 0;

  const setNumericOption = (key: NumericOptionKey, value: number) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };

  const resetNumericOption = (key: NumericOptionKey) => {
    setOptions((current) => ({
      ...current,
      [key]: defaultOptions[key],
    }));
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

      const normalized = normalizeRenderOptions(data.options);
      setDefaultOptions(normalized);
      setOptions(normalized);
      setSupportsCharacterOverrides(Boolean(data.features?.charOverrides));
    } catch {
      setDefaultOptions(FALLBACK_OPTIONS);
      setOptions(FALLBACK_OPTIONS);
      setSupportsCharacterOverrides(false);
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

  const setCharacterOverride = (
    char: string,
    key: CharacterOverrideKey,
    value: number
  ) => {
    setOptions((current) => ({
      ...current,
      charOverrides: {
        ...current.charOverrides,
        [char]: {
          ...EMPTY_CHARACTER_OVERRIDE,
          ...(current.charOverrides[char] ?? {}),
          [key]: value,
        },
      },
    }));
  };

  const resetCharacterOverrideField = (
    char: string,
    key: CharacterOverrideKey
  ) => {
    setOptions((current) => {
      const existing = current.charOverrides[char];
      if (!existing) {
        return current;
      }

      const nextCharOverride = {
        ...EMPTY_CHARACTER_OVERRIDE,
        ...existing,
        [key]: EMPTY_CHARACTER_OVERRIDE[key],
      };

      const isDefault = (
        Object.keys(EMPTY_CHARACTER_OVERRIDE) as CharacterOverrideKey[]
      ).every(
        (overrideKey) =>
          nextCharOverride[overrideKey] === EMPTY_CHARACTER_OVERRIDE[overrideKey]
      );

      const nextOverrides = { ...current.charOverrides };
      if (isDefault) {
        delete nextOverrides[char];
      } else {
        nextOverrides[char] = nextCharOverride;
      }

      return {
        ...current,
        charOverrides: nextOverrides,
      };
    });
  };

  const resetCharacterOverride = (char: string) => {
    setOptions((current) => {
      if (!current.charOverrides[char]) {
        return current;
      }

      const nextOverrides = { ...current.charOverrides };
      delete nextOverrides[char];

      return {
        ...current,
        charOverrides: nextOverrides,
      };
    });
  };

  const resetSession = async () => {
    setSessionId(null);
    setUploadError(null);
    setRenderError(null);
    setOptions(defaultOptions);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    await loadDatasets();
  };

  const resetAllFilters = () => {
    setOptions(normalizeRenderOptions(defaultOptions));
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

  const isCodingMode = assignmentMode === "coding";

  if (assignmentMode === null) {
    return (
      <AssignmentGate
        theme={theme}
        onToggleTheme={toggleTheme}
        onSelectMode={selectAssignmentMode}
      />
    );
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main-workflow">
        Skip to workflow
      </a>

      <AppHeader
        isCodingMode={isCodingMode}
        theme={theme}
        onToggleTheme={toggleTheme}
        onChangeAssignmentType={openAssignmentPicker}
        onRefreshLibrary={loadDatasets}
        onResetSession={resetSession}
        isLoadingDatasets={isLoadingDatasets}
      />

      <main
        id="main-workflow"
        className="layout"
        aria-labelledby="app-page-title"
      >
        <div className="layout__stack">
          <DatasetSection
            isCodingMode={isCodingMode}
            availableCounts={availableCounts}
            uploadError={uploadError}
            isUploading={isUploading}
            onUpload={handleUpload}
          />

          <ComposeSection
            isCodingMode={isCodingMode}
            text={text}
            onTextChange={setText}
          />

          <TuningSection
            text={text}
            options={options}
            defaultOptions={defaultOptions}
            supportsCharacterOverrides={supportsCharacterOverrides}
            showAdvanced={showAdvanced}
            onToggleAdvanced={() => setShowAdvanced((v) => !v)}
            onNumericChange={setNumericOption}
            onNumericReset={resetNumericOption}
            onCharacterOverrideChange={setCharacterOverride}
            onCharacterOverrideReset={resetCharacterOverride}
            onCharacterOverrideFieldReset={resetCharacterOverrideField}
            onInkColorChange={(color) =>
              setOptions((c) => ({ ...c, inkColor: color }))
            }
            onInkColorReset={() =>
              setOptions((c) => ({ ...c, inkColor: defaultOptions.inkColor }))
            }
            onResetAllFilters={resetAllFilters}
            canRender={canRender}
            isRendering={isRendering}
            onRender={handleRender}
            renderError={renderError}
          />
        </div>

        <PreviewSection previewUrl={previewUrl} />
      </main>
    </div>
  );
}
