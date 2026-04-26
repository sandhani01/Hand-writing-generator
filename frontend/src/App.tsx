import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearStoredAssignmentMode,
  persistAssignmentMode,
  readStoredAssignmentMode,
} from "./assignmentModeStorage";
import { apiClient } from "./api";
import { AppHeader } from "./components/AppHeader";
import { AssignmentGate } from "./components/AssignmentGate";
import { ComposeSection } from "./components/ComposeSection";
import { DatasetSection } from "./components/DatasetSection";
import { DemoTour } from "./components/DemoTour";
import { PreviewSection } from "./components/PreviewSection";
import { TuningSection } from "./components/TuningSection";
import { ImportConfigModal } from "./components/ImportConfigModal";
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
  BackgroundListResponse,
  BackgroundRecord,
  CharacterOverrideKey,
  DatasetListResponse,
  DatasetRecord,
  DefaultsResponse,
  NumericOptionKey,
  RenderJobResponse,
  RenderOptions,
  UploadCounts,
  UploadType,
} from "./types";

const EMPTY_COUNTS: UploadCounts = {
  handwriting: 0,
  coding: 0,
  handwritingLimit: 5,
  codingLimit: 3,
};

const EMPTY_BACKGROUNDS: BackgroundRecord[] = [];
const DEFAULT_BACKGROUND_LIMIT = 1;


function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}



export default function App() {

  const authToken = "anonymous-token";
  const [workspaceSessionId, setWorkspaceSessionId] = useState<string | null>(
    null
  );

  const createWorkspaceSessionId = () => {
    return `ws_${Math.random()
      .toString(36)
      .substring(2, 11)}_${Date.now().toString(36)}`;
  };


  const [availableCounts, setAvailableCounts] = useState<UploadCounts>(EMPTY_COUNTS);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [backgrounds, setBackgrounds] =
    useState<BackgroundRecord[]>(EMPTY_BACKGROUNDS);
  const [backgroundLimit, setBackgroundLimit] =
    useState(DEFAULT_BACKGROUND_LIMIT);
  const [backgroundCustomCount, setBackgroundCustomCount] = useState(0);
  const [renderHistory, setRenderHistory] = useState<RenderJobResponse[]>([]);
  const [selectedRenderId, setSelectedRenderId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [text, setText] = useState(() => {
    const mode = readStoredAssignmentMode();
    return mode === "coding" ? DEFAULT_TEXT_CODING : DEFAULT_TEXT_SIMPLE;
  });
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode | null>(
    () => readStoredAssignmentMode()
  );
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [initialTemplatesView, setInitialTemplatesView] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);
  const [isLoadingRenders, setIsLoadingRenders] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [highlightUpload, setHighlightUpload] = useState(false);
  const [defaultOptions, setDefaultOptions] =
    useState<RenderOptions>(FALLBACK_OPTIONS);
  const [options, setOptions] = useState<RenderOptions>(FALLBACK_OPTIONS);
  const [supportsCharacterOverrides, setSupportsCharacterOverrides] =
    useState(false);
  const [busyDatasetId, setBusyDatasetId] = useState<string | null>(null);
  const [busyBackgroundId, setBusyBackgroundId] = useState<string | null>(null);
  const [busyRenderId, setBusyRenderId] = useState<string | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [fontSource, setFontSource] = useState<"personal" | "default">("personal");
  const [defaultFonts, setDefaultFonts] = useState<string[]>([]);
  const [selectedDefaultFont, setSelectedDefaultFont] = useState<string>("");
  const workspaceBootKeyRef = useRef<string | null>(null);

  const handleCopyConfig = useCallback(() => {
    try {
      const configStr = JSON.stringify(options, null, 2);
      navigator.clipboard.writeText(configStr);
    } catch {
      // Ignore copy failures
    }
  }, [options]);

  const handleApplyConfig = useCallback(() => {
    setIsImportModalOpen(true);
  }, []);

  const selectedRender = useMemo(
    () => renderHistory.find((item) => item.id === selectedRenderId) ?? null,
    [renderHistory, selectedRenderId]
  );
  const canRender = Boolean(
    authToken &&
      workspaceSessionId &&
      ((fontSource === "default" && selectedDefaultFont !== "") ||
        datasets.some(
          (dataset) =>
            dataset.dataset_type === "alphabet" && dataset.status === "completed"
        ))
  );


  const clearPreview = useCallback(() => {
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }, []);

  const setNumericOption = (key: NumericOptionKey, value: number) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };

  const resetNumericOption = (key: NumericOptionKey) => {
    setOptions((current) => ({
      ...current,
      [key]: defaultOptions[key],
    }));
  };

  const loadRendererDefaults = useCallback(async () => {
    try {
      const data = await apiClient.get<DefaultsResponse>("/api/v1/defaults");
      if (!data.options) {
        throw new Error("Could not load renderer defaults");
      }

      const normalized = normalizeRenderOptions(data.options);
      setDefaultOptions(normalized);
      setOptions(normalized);
      setSupportsCharacterOverrides(Boolean(data.features?.charOverrides));
      setDefaultFonts(data.fonts || []);
      if (data.fonts && data.fonts.length > 0) {
        setSelectedDefaultFont(data.fonts[0]);
      }
    } catch {
      setDefaultOptions(FALLBACK_OPTIONS);
      setOptions(FALLBACK_OPTIONS);
      setSupportsCharacterOverrides(false);
      setDefaultFonts([]);
    }
  }, []);

  const loadDatasets = useCallback(
    async (tokenOverride?: string, workspaceOverride?: string) => {
      const token = tokenOverride ?? authToken;
      const activeWorkspaceSessionId = workspaceOverride ?? workspaceSessionId;
      if (!token || !activeWorkspaceSessionId) {
        setAvailableCounts(EMPTY_COUNTS);
        setDatasets([]);
        return;
      }

      setIsLoadingDatasets(true);
      try {
        const data = await apiClient.get<DatasetListResponse>(
          "/api/v1/datasets",
          { authToken: token, workspaceSessionId: activeWorkspaceSessionId }
        );

        setAvailableCounts({
          handwriting: data.alphabet_count,
          coding: data.coding_count,
          handwritingLimit: data.alphabet_limit,
          codingLimit: data.coding_limit,
        });
        setDatasets(data.items);
      } catch (error) {
        if (error instanceof Error && (error as any).status === 401) {
          // Silent catch
          return;
        }
        setUploadError(
          getErrorMessage(
            error,
            "Could not load your datasets from the backend."
          )
        );
      } finally {
        setIsLoadingDatasets(false);
      }
    },
    [authToken, workspaceSessionId]
  );

  const loadBackgrounds = useCallback(
    async (tokenOverride?: string, workspaceOverride?: string) => {
      const token = tokenOverride ?? authToken;
      const activeWorkspaceSessionId = workspaceOverride ?? workspaceSessionId;
      if (!token || !activeWorkspaceSessionId) {
        setBackgrounds(EMPTY_BACKGROUNDS);
        setBackgroundLimit(DEFAULT_BACKGROUND_LIMIT);
        setBackgroundCustomCount(0);
        return;
      }

      try {
        const data = await apiClient.get<BackgroundListResponse>(
          "/api/v1/backgrounds",
          { authToken: token, workspaceSessionId: activeWorkspaceSessionId }
        );

        setBackgrounds(data.items);
        setBackgroundLimit(data.background_limit);
        setBackgroundCustomCount(data.custom_count);
      } catch (error) {
        if (error instanceof Error && (error as any).status === 401) {
          // Silent catch
          return;
        }
        setUploadError(
          getErrorMessage(error, "Could not load your page backgrounds.")
        );
      }
    },
    [authToken, workspaceSessionId]
  );

  const loadRenders = useCallback(
    async (tokenOverride?: string, workspaceOverride?: string) => {
      const token = tokenOverride ?? authToken;
      const activeWorkspaceSessionId = workspaceOverride ?? workspaceSessionId;
      if (!token || !activeWorkspaceSessionId) {
        setRenderHistory([]);
        setSelectedRenderId(null);
        return;
      }

      setIsLoadingRenders(true);
      try {
        const data = await apiClient.get<{ items: RenderJobResponse[] }>(
          "/api/v1/renders",
          { authToken: token, workspaceSessionId: activeWorkspaceSessionId }
        );

        setRenderHistory(data.items);
        if (!data.items.length) {
          clearPreview();
        }
        setSelectedRenderId((current) => {
          if (current && data.items.some((item) => item.id === current)) {
            return current;
          }
          return data.items[0]?.id ?? null;
        });
      } catch (error) {
        if (error instanceof Error && (error as any).status === 401) {
          // Silent catch
          return;
        }
        setPreviewError(
          getErrorMessage(
            error,
            "Could not load render history from the backend."
          )
        );
      } finally {
        setIsLoadingRenders(false);
      }
    },
    [authToken, clearPreview, workspaceSessionId]
  );


  const fetchRenderPreview = useCallback(
    async (renderId: string, tokenOverride?: string) => {
      const token = tokenOverride ?? authToken;
      if (!token || !workspaceSessionId) {
        return;
      }

      setIsPreviewLoading(true);
      setPreviewError(null);
      try {
        const blob = await apiClient.blob(`/api/v1/renders/${renderId}/file`, {
          authToken: token,
          workspaceSessionId,
        });
        clearPreview();
        setPreviewUrl(URL.createObjectURL(blob));
      } catch (error) {
        if (error instanceof Error && (error as any).status === 401) {
          // Silent catch
          return;
        }
        clearPreview();
        setPreviewError(getErrorMessage(error, "The PNG could not be loaded."));
      } finally {
        setIsPreviewLoading(false);
      }
    },
    [authToken, clearPreview, workspaceSessionId]
  );

  useEffect(() => {
    loadRendererDefaults();
  }, [loadRendererDefaults]);


  useEffect(() => {

    const bootWorkspace = async () => {
      const activeWorkspaceSessionId =
        workspaceSessionId ?? createWorkspaceSessionId();
      
      if (!workspaceSessionId) {
        setWorkspaceSessionId(activeWorkspaceSessionId);
      }

      if (workspaceBootKeyRef.current === activeWorkspaceSessionId) {
        return;
      }
      workspaceBootKeyRef.current = activeWorkspaceSessionId;

      try {
        await Promise.allSettled([
          loadRendererDefaults(),
          loadDatasets(authToken!, activeWorkspaceSessionId),
          loadBackgrounds(authToken!, activeWorkspaceSessionId),
          loadRenders(authToken!, activeWorkspaceSessionId),
        ]);
      } finally {
        // Done loading
      }
    };

    void bootWorkspace();
    return () => {
    };
  }, [authToken, loadBackgrounds, loadDatasets, loadRenders, workspaceSessionId]);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", theme === "dark" ? "#0b0d11" : "#eceae4");
    }
  }, [theme]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!authToken || !workspaceSessionId || !selectedRender) {
      if (!selectedRender) {
        clearPreview();
        setPreviewError(null);
      }
      return;
    }

    if (selectedRender.status !== "completed") {
      clearPreview();
      setPreviewError(null);
      return;
    }

    void fetchRenderPreview(selectedRender.id);
  }, [
    authToken,
    clearPreview,
    fetchRenderPreview,
    selectedRender?.id,
    selectedRender?.status,
    selectedRender?.updated_at,
    workspaceSessionId,
  ]);

  const hasPendingJobs = useMemo(
    () =>
      datasets.some((dataset) =>
        dataset.status === "queued" || dataset.status === "processing"
      ) ||
      renderHistory.some(
        (job) => job.status === "queued" || job.status === "processing"
      ),
    [datasets, renderHistory]
  );

  useEffect(() => {
    if (!authToken || !workspaceSessionId || !hasPendingJobs) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadDatasets();
      void loadRenders();
    }, 2500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authToken, hasPendingJobs, loadDatasets, loadRenders, workspaceSessionId]);


  const handleUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: UploadType
  ) => {
    const file = event.target.files?.[0];
    if (!file || !authToken || !workspaceSessionId) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("grid", file);
    formData.append("type", type);

    try {
      await apiClient.upload("/api/v1/datasets/upload", formData, {
        authToken,
        workspaceSessionId,
      });
      await loadDatasets();
    } catch (error) {
      setUploadError(
        getErrorMessage(
          error,
          "Upload failed. Check whether the hosted backend is running."
        )
      );
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleUploadBackground = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !authToken || !workspaceSessionId) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("background", file);

    try {
      await apiClient.upload("/api/v1/backgrounds/upload", formData, {
        authToken,
        workspaceSessionId,
      });
      await loadBackgrounds();
    } catch (error) {
      setUploadError(getErrorMessage(error, "Background upload failed."));
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleRenameDataset = async (datasetId: string, displayName: string) => {
    setBusyDatasetId(datasetId);
    setUploadError(null);
    try {
      await apiClient.patch(
        `/api/v1/datasets/${datasetId}`,
        { display_name: displayName },
        { authToken, workspaceSessionId }
      );
      await loadDatasets();
    } catch (error) {
      setUploadError(getErrorMessage(error, "Dataset rename failed."));
    } finally {
      setBusyDatasetId(null);
    }
  };

  const handleDeleteDataset = async (datasetId: string) => {
    setBusyDatasetId(datasetId);
    setUploadError(null);
    try {
      await apiClient.delete(`/api/v1/datasets/${datasetId}`, {
        authToken,
        workspaceSessionId,
      });
      await loadDatasets();
    } catch (error) {
      setUploadError(getErrorMessage(error, "Dataset delete failed."));
    } finally {
      setBusyDatasetId(null);
    }
  };

  const handleSelectBackground = async (backgroundId: string) => {
    setBusyBackgroundId(backgroundId);
    setUploadError(null);
    try {
      const data = await apiClient.patch<BackgroundListResponse>(
        "/api/v1/backgrounds/select",
        { background_id: backgroundId },
        { authToken, workspaceSessionId }
      );
      setBackgrounds(data.items);
      setBackgroundLimit(data.background_limit);
      setBackgroundCustomCount(data.custom_count);
    } catch (error) {
      setUploadError(getErrorMessage(error, "Background update failed."));
    } finally {
      setBusyBackgroundId(null);
    }
  };

  const handleDeleteBackground = async (backgroundId: string) => {
    setBusyBackgroundId(backgroundId);
    setUploadError(null);
    try {
      await apiClient.delete(`/api/v1/backgrounds/${backgroundId}`, {
        authToken,
        workspaceSessionId,
      });
      await loadBackgrounds();
    } catch (error) {
      setUploadError(getErrorMessage(error, "Background delete failed."));
    } finally {
      setBusyBackgroundId(null);
    }
  };

  const handleRender = async () => {
    if (!canRender) {
      setRenderError(
        "Add at least one completed alphabet dataset before rendering."
      );
      setHighlightUpload(true);
      setTimeout(() => setHighlightUpload(false), 3000);
      setTimeout(() => {
        document.getElementById("dataset-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
      return;
    }

    setIsRendering(true);
    setRenderError(null);
    setPreviewError(null);

    try {
      const renderPayload = await apiClient.post<RenderJobResponse>(
        "/api/v1/renders",
        {
          text,
          options,
          font_source: fontSource === "default" ? ("default:" + selectedDefaultFont) : "personal"
        },
        { authToken, workspaceSessionId }
      );

      clearPreview();
      setSelectedRenderId(renderPayload.id);
      await loadRenders();

      // Smoothly scroll to preview section on mobile/desktop after initiating render
      setTimeout(() => {
        document.getElementById("preview-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (error) {
      setRenderError(getErrorMessage(error, "Render failed."));
    } finally {
      setIsRendering(false);
    }
  };

  const handlePreviewRender = (renderId: string) => {
    setSelectedRenderId(renderId);
    setPreviewError(null);
  };

  const handleDownloadRender = async (renderId: string) => {
    setBusyRenderId(renderId);
    try {
      const blob = await apiClient.blob(`/api/v1/renders/${renderId}/file`, {
        authToken,
        workspaceSessionId,
      });
      downloadBlob(blob, `handwritten-render-${renderId}.png`);
    } catch (error) {
      setPreviewError(
        getErrorMessage(error, "The PNG could not be downloaded.")
      );
    } finally {
      setBusyRenderId(null);
    }
  };

  const handleDeleteRender = async (renderId: string) => {
    setBusyRenderId(renderId);
    try {
      await apiClient.delete(`/api/v1/renders/${renderId}`, {
        authToken,
        workspaceSessionId,
      });
      if (selectedRenderId === renderId) {
        clearPreview();
      }
      await loadRenders();
    } catch (error) {
      if (error instanceof Error && (error as any).status === 401) {
        
        return;
      }
      setPreviewError(getErrorMessage(error, "Render delete failed."));
    } finally {
      setBusyRenderId(null);
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
        [key]: EMPTY_CHARACTER_OVERRIDE[key as CharacterOverrideKey],
      };

      const isDefault = (
        Object.keys(EMPTY_CHARACTER_OVERRIDE) as CharacterOverrideKey[]
      ).every(
        (overrideKey) =>
          nextCharOverride[overrideKey as CharacterOverrideKey] === EMPTY_CHARACTER_OVERRIDE[overrideKey as CharacterOverrideKey]
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

  const resetWorkspace = async () => {
    setUploadError(null);
    setRenderError(null);
    setPreviewError(null);
    setOptions(defaultOptions);
    clearPreview();

    if (!authToken || !workspaceSessionId) {
      await Promise.all([loadDatasets(), loadBackgrounds(), loadRenders()]);
      return;
    }

    try {
      void apiClient
        .post(
          "/api/v1/auth/logout",
          {},
          { authToken, workspaceSessionId }
        )
        .catch(() => {});
    } catch {
      // Ignore workspace cleanup failures and still rotate the client workspace id.
    }

    const nextWorkspaceSessionId = createWorkspaceSessionId();
    setWorkspaceSessionId(nextWorkspaceSessionId);
    setAvailableCounts(EMPTY_COUNTS);
    setDatasets([]);
    setBackgrounds(EMPTY_BACKGROUNDS);
    setBackgroundLimit(DEFAULT_BACKGROUND_LIMIT);
    setBackgroundCustomCount(0);
    setRenderHistory([]);
    setSelectedRenderId(null);

    await Promise.all([
      loadDatasets(authToken, nextWorkspaceSessionId),
      loadBackgrounds(authToken, nextWorkspaceSessionId),
      loadRenders(authToken, nextWorkspaceSessionId),
    ]);
  };

  const resetAllFilters = () => {
    setOptions(normalizeRenderOptions(defaultOptions));
  };

  const applyTuningPreset = (preset: "neat" | "natural" | "compact") => {
    const base = normalizeRenderOptions(defaultOptions);

    if (preset === "neat") {
      setOptions({
        ...base,
        lineHeight: Math.max(base.lineHeight, 88),
        charSpacing: Math.max(base.charSpacing, 0),
        wordSpacing: Math.max(20, base.wordSpacing - 2),
        jitter: 0.6,
        baselineJitter: 0.12,
        lineDriftPerWord: 0.08,
        wordSpacingJitter: 1.2,
        rotation: 1.2,
        strokeGain: Math.max(1.1, base.strokeGain * 0.96),
        textureBlend: Math.max(0.04, base.textureBlend * 0.8),
        edgeRoughness: 0,
      });
      return;
    }

    if (preset === "natural") {
      setOptions({
        ...base,
        jitter: 1.8,
        baselineJitter: 0.45,
        lineDriftPerWord: 0.32,
        wordSpacingJitter: 4.5,
        rotation: 2.6,
        edgeRoughness: 0.05,
        textureBlend: Math.max(0.1, base.textureBlend),
      });
      return;
    }

    setOptions({
      ...base,
      lineHeight: Math.max(60, base.lineHeight - 8),
      charSpacing: base.charSpacing - 1,
      wordSpacing: Math.max(14, base.wordSpacing - 6),
      overallScale: Math.max(0.9, base.overallScale * 0.96),
      marginRight: Math.max(18, base.marginRight - 4),
      jitter: 0.9,
      baselineJitter: 0.2,
      lineDriftPerWord: 0.12,
      wordSpacingJitter: 2.5,
      rotation: 1.6,
      strokeGain: Math.max(1.08, base.strokeGain * 0.95),
    });
  };

  const selectAssignmentMode = (mode: AssignmentMode) => {
    setIsDemoOpen(false);
    setAssignmentMode(mode);
    setText(mode === "coding" ? DEFAULT_TEXT_CODING : DEFAULT_TEXT_SIMPLE);
    persistAssignmentMode(mode);
  };

  const openAssignmentPicker = () => {
    setIsDemoOpen(false);
    setAssignmentMode(null);
    clearStoredAssignmentMode();
  };


  const isCodingMode = assignmentMode === "coding";
  const previewStatusLabel = selectedRender
    ? selectedRender.status === "completed"
      ? `Ready since ${new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(selectedRender.updated_at || selectedRender.created_at))}`
      : selectedRender.status === "failed"
      ? "This render failed"
      : isLoadingRenders
      ? "Checking queue status..."
      : "The backend is still processing this render."
    : "Render a page to start your history.";




  if (assignmentMode === null) {
    if (isDemoOpen) {
      return (
        <DemoTour
          theme={theme}
          onToggleTheme={toggleTheme}
          onBack={(options) => {
            setIsDemoOpen(false);
            if (options?.selectMode) {
              selectAssignmentMode(options.selectMode);
              setFontSource("personal");
              if (options.highlightUpload) {
                setHighlightUpload(true);
                setTimeout(() => setHighlightUpload(false), 5000);
                setTimeout(() => {
                  document.getElementById("handwriting-upload-zone")?.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                  });
                }, 150);
              }
            } else {
              setInitialTemplatesView(Boolean(options?.navigateToTemplates));
            }
          }}
        />
      );
    }

    return (
      <AssignmentGate
        theme={theme}
        onToggleTheme={toggleTheme}
        onSelectMode={selectAssignmentMode}
        onOpenDemo={() => {
          setInitialTemplatesView(false); // Reset when opening demo
          setIsDemoOpen(true);
        }}
        initialTemplatesView={initialTemplatesView}
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
        onRefreshLibrary={() =>
          void Promise.all([loadDatasets(), loadBackgrounds(), loadRenders()])
        }
        onResetWorkspace={() => void resetWorkspace()}
        onRender={handleRender}
        isRendering={isRendering}
        isLoadingDatasets={isLoadingDatasets || isLoadingRenders}
        fontSource={fontSource}
        onToggleFontSource={setFontSource}
      />

      <main
        id="main-workflow"
        className="layout"
        aria-labelledby="app-page-title"
      >
        <div className="layout__stack">
          <ComposeSection
            isCodingMode={isCodingMode}
            text={text}
            isRendering={isRendering}
            renderError={renderError}
            onTextChange={setText}
            onRender={handleRender}
          />

          <TuningSection
            text={text}
            options={options}
            defaultOptions={defaultOptions}
            supportsCharacterOverrides={supportsCharacterOverrides}
            showAdvanced={showAdvanced}
            onToggleAdvanced={() => setShowAdvanced((value) => !value)}
            onNumericChange={setNumericOption}
            onNumericReset={resetNumericOption}
            onCharacterOverrideChange={setCharacterOverride}
            onCharacterOverrideReset={resetCharacterOverride}
            onCharacterOverrideFieldReset={resetCharacterOverrideField}
            onInkColorChange={(color) =>
              setOptions((current) => ({ ...current, inkColor: color }))
            }
            onInkColorReset={() =>
              setOptions((current) => ({
                ...current,
                inkColor: defaultOptions.inkColor,
              }))
            }
            onApplyPreset={applyTuningPreset}
            onCopyConfig={handleCopyConfig}
            onApplyConfig={handleApplyConfig}
            onResetAllFilters={resetAllFilters}
          />

          <DatasetSection
            fontSource={fontSource}
            defaultFonts={defaultFonts}
            selectedDefaultFont={selectedDefaultFont}
            onSelectDefaultFont={setSelectedDefaultFont}
            isCodingMode={isCodingMode}
            availableCounts={availableCounts}
            datasets={datasets}
            backgrounds={backgrounds}
            backgroundLimit={backgroundLimit}
            backgroundCustomCount={backgroundCustomCount}
            uploadError={uploadError}
            isUploading={isUploading}
            busyDatasetId={busyDatasetId}
            busyBackgroundId={busyBackgroundId}
            highlightUpload={highlightUpload}
            onUpload={handleUpload}
            onUploadBackground={handleUploadBackground}
            onRenameDataset={handleRenameDataset}
            onDeleteDataset={handleDeleteDataset}
            onSelectBackground={handleSelectBackground}
            onDeleteBackground={handleDeleteBackground}
          />
        </div>

        <PreviewSection
          previewUrl={previewUrl}
          previewError={previewError}
          previewStatusLabel={previewStatusLabel}
          isPreviewLoading={isPreviewLoading}
          selectedRender={selectedRender}
          renderHistory={renderHistory}
          busyRenderId={busyRenderId}
          onPreviewRender={handlePreviewRender}
          onDownloadRender={(renderId) => void handleDownloadRender(renderId)}
          onDeleteRender={(renderId) => void handleDeleteRender(renderId)}
        />
      </main>

      <ImportConfigModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onApply={(newOptions) => setOptions(newOptions)}
        normalizeRenderOptions={normalizeRenderOptions}
      />
    </div>
  );
}
