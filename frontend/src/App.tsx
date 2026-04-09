import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearStoredAssignmentMode,
  persistAssignmentMode,
  readStoredAssignmentMode,
} from "./assignmentModeStorage";
import {
  clearStoredAuthSession,
  persistAuthSession,
  readStoredAuthToken,
  readStoredAuthUser,
} from "./authStorage";
import { AuthScreen } from "./components/AuthScreen";
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
  ApiError,
  AssignmentMode,
  AuthResponse,
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
  UserProfile,
} from "./types";

const EMPTY_COUNTS: UploadCounts = {
  handwriting: 0,
  coding: 0,
  handwritingLimit: 5,
  codingLimit: 3,
};

const EMPTY_BACKGROUNDS: BackgroundRecord[] = [];
const DEFAULT_BACKGROUND_LIMIT = 1;

function extractApiErrorMessage(payload: ApiError | null, fallback: string) {
  return payload?.detail || payload?.details || payload?.error || fallback;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const apiBase =
    ((import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env
      ?.VITE_API_BASE || "").replace(/\/$/, "");
  const apiUrl = useCallback((path: string) => `${apiBase}${path}`, [apiBase]);

  const [authToken, setAuthToken] = useState<string | null>(() =>
    readStoredAuthToken()
  );
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() =>
    readStoredAuthUser()
  );
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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
  const [isUploading, setIsUploading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);
  const [isLoadingRenders, setIsLoadingRenders] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [defaultOptions, setDefaultOptions] =
    useState<RenderOptions>(FALLBACK_OPTIONS);
  const [options, setOptions] = useState<RenderOptions>(FALLBACK_OPTIONS);
  const [supportsCharacterOverrides, setSupportsCharacterOverrides] =
    useState(false);
  const [busyDatasetId, setBusyDatasetId] = useState<string | null>(null);
  const [busyBackgroundId, setBusyBackgroundId] = useState<string | null>(null);
  const [busyRenderId, setBusyRenderId] = useState<string | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();

  const selectedRender = useMemo(
    () => renderHistory.find((item) => item.id === selectedRenderId) ?? null,
    [renderHistory, selectedRenderId]
  );
  const canRender = Boolean(
    authToken &&
      datasets.some(
        (dataset) =>
          dataset.dataset_type === "alphabet" && dataset.status === "completed"
      )
  );

  const authHeaders = useCallback(
    (tokenOverride?: string): Record<string, string> => {
      const token = tokenOverride ?? authToken;
      if (!token) {
        return {};
      }
      return {
        Authorization: `Bearer ${token}`,
      };
    },
    [authToken]
  );

  const clearPreview = useCallback(() => {
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }, []);

  const clearAuthState = useCallback(() => {
    clearStoredAuthSession();
    setAuthToken(null);
    setCurrentUser(null);
    setAvailableCounts(EMPTY_COUNTS);
    setDatasets([]);
    setBackgrounds(EMPTY_BACKGROUNDS);
    setBackgroundLimit(DEFAULT_BACKGROUND_LIMIT);
    setBackgroundCustomCount(0);
    setRenderHistory([]);
    setSelectedRenderId(null);
    clearPreview();
  }, [clearPreview]);

  const handleExpiredSession = useCallback(
    (message = "Your session expired. Please sign in again.") => {
      clearAuthState();
      setAuthError(message);
    },
    [clearAuthState]
  );

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
      const response = await fetch(apiUrl("/api/v1/defaults"));
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
  }, [apiUrl]);

  const loadDatasets = useCallback(
    async (tokenOverride?: string) => {
      const token = tokenOverride ?? authToken;
      if (!token) {
        setAvailableCounts(EMPTY_COUNTS);
        setDatasets([]);
        return;
      }

      setIsLoadingDatasets(true);
      try {
        const response = await fetch(apiUrl("/api/v1/datasets"), {
          headers: authHeaders(token),
        });
        let data: DatasetListResponse | ApiError | null = null;
        try {
          data = (await response.json()) as DatasetListResponse | ApiError;
        } catch {
          data = null;
        }

        if (response.status === 401) {
          handleExpiredSession(
            extractApiErrorMessage(data as ApiError, "Please sign in again.")
          );
          return;
        }

        if (!response.ok || !data || !("items" in data)) {
          throw new Error(
            extractApiErrorMessage(data as ApiError, "Could not load datasets.")
          );
        }

        setAvailableCounts({
          handwriting: data.alphabet_count,
          coding: data.coding_count,
          handwritingLimit: data.alphabet_limit,
          codingLimit: data.coding_limit,
        });
        setDatasets(data.items);
      } catch (error) {
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
    [apiUrl, authHeaders, authToken, handleExpiredSession]
  );

  const loadBackgrounds = useCallback(
    async (tokenOverride?: string) => {
      const token = tokenOverride ?? authToken;
      if (!token) {
        setBackgrounds(EMPTY_BACKGROUNDS);
        setBackgroundLimit(DEFAULT_BACKGROUND_LIMIT);
        setBackgroundCustomCount(0);
        return;
      }

      try {
        const response = await fetch(apiUrl("/api/v1/backgrounds"), {
          headers: authHeaders(token),
        });
        let data: BackgroundListResponse | ApiError | null = null;
        try {
          data = (await response.json()) as BackgroundListResponse | ApiError;
        } catch {
          data = null;
        }

        if (response.status === 401) {
          handleExpiredSession(
            extractApiErrorMessage(data as ApiError, "Please sign in again.")
          );
          return;
        }

        if (!response.ok || !data || !("items" in data)) {
          throw new Error(
            extractApiErrorMessage(
              data as ApiError,
              "Could not load page backgrounds."
            )
          );
        }

        setBackgrounds(data.items);
        setBackgroundLimit(data.background_limit);
        setBackgroundCustomCount(data.custom_count);
      } catch (error) {
        setUploadError(
          getErrorMessage(error, "Could not load your page backgrounds.")
        );
      }
    },
    [apiUrl, authHeaders, authToken, handleExpiredSession]
  );

  const loadRenders = useCallback(
    async (tokenOverride?: string) => {
      const token = tokenOverride ?? authToken;
      if (!token) {
        setRenderHistory([]);
        setSelectedRenderId(null);
        return;
      }

      setIsLoadingRenders(true);
      try {
        const response = await fetch(apiUrl("/api/v1/renders"), {
          headers: authHeaders(token),
        });
        let data: { items: RenderJobResponse[] } | ApiError | null = null;
        try {
          data = (await response.json()) as { items: RenderJobResponse[] } | ApiError;
        } catch {
          data = null;
        }

        if (response.status === 401) {
          handleExpiredSession(
            extractApiErrorMessage(data as ApiError, "Please sign in again.")
          );
          return;
        }

        if (!response.ok || !data || !("items" in data)) {
          throw new Error(
            extractApiErrorMessage(data as ApiError, "Could not load render history.")
          );
        }

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
        setPreviewError(
          getErrorMessage(error, "Could not load render history from the backend.")
        );
      } finally {
        setIsLoadingRenders(false);
      }
    },
    [apiUrl, authHeaders, authToken, clearPreview, handleExpiredSession]
  );

  const fetchRenderPreview = useCallback(
    async (renderId: string, tokenOverride?: string) => {
      const token = tokenOverride ?? authToken;
      if (!token) {
        return;
      }

      setIsPreviewLoading(true);
      setPreviewError(null);
      try {
        const response = await fetch(apiUrl(`/api/v1/renders/${renderId}/file`), {
          headers: authHeaders(token),
        });

        if (response.status === 401) {
          handleExpiredSession("Please sign in again.");
          return;
        }

        if (!response.ok) {
          let payload: ApiError | null = null;
          try {
            payload = (await response.json()) as ApiError;
          } catch {
            payload = null;
          }
          throw new Error(
            extractApiErrorMessage(payload, "The PNG could not be loaded.")
          );
        }

        const blob = await response.blob();
        clearPreview();
        setPreviewUrl(URL.createObjectURL(blob));
      } catch (error) {
        clearPreview();
        setPreviewError(getErrorMessage(error, "The PNG could not be loaded."));
      } finally {
        setIsPreviewLoading(false);
      }
    },
    [apiUrl, authHeaders, authToken, clearPreview, handleExpiredSession]
  );

  useEffect(() => {
    loadRendererDefaults();
  }, [loadRendererDefaults]);

  useEffect(() => {
    let cancelled = false;

    const verifySession = async () => {
      if (!authToken) {
        if (!cancelled) {
          setIsAuthChecking(false);
          setAvailableCounts(EMPTY_COUNTS);
        }
        return;
      }

      setIsAuthChecking(true);
      try {
        const response = await fetch(apiUrl("/api/v1/me"), {
          headers: authHeaders(authToken),
        });
        let data: UserProfile | ApiError | null = null;
        try {
          data = (await response.json()) as UserProfile | ApiError;
        } catch {
          data = null;
        }

        if (response.status === 401) {
          if (!cancelled) {
            handleExpiredSession(
              extractApiErrorMessage(
                data as ApiError,
                "Your session expired. Please sign in again."
              )
            );
          }
          return;
        }

        if (!response.ok || !data || !("email" in data)) {
          throw new Error(
            extractApiErrorMessage(data as ApiError, "Could not verify session.")
          );
        }

        if (!cancelled) {
          setCurrentUser(data);
          setAuthError(null);
          await Promise.all([
            loadDatasets(authToken),
            loadBackgrounds(authToken),
            loadRenders(authToken),
          ]);
        }
      } catch (error) {
        if (!cancelled) {
          handleExpiredSession(
            getErrorMessage(error, "Could not verify your saved session.")
          );
        }
      } finally {
        if (!cancelled) {
          setIsAuthChecking(false);
        }
      }
    };

    void verifySession();
    return () => {
      cancelled = true;
    };
  }, [
    apiUrl,
    authHeaders,
    authToken,
    handleExpiredSession,
    loadBackgrounds,
    loadDatasets,
    loadRenders,
  ]);

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
    if (!authToken || !selectedRender) {
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
    if (!authToken || !hasPendingJobs) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadDatasets();
      void loadRenders();
    }, 2500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authToken, hasPendingJobs, loadDatasets, loadRenders]);

  const handleAuthenticate = async (
    mode: "login" | "signup",
    email: string,
    password: string
  ) => {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const response = await fetch(apiUrl(`/api/v1/auth/${mode}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as AuthResponse | ApiError;
      if (!response.ok || !("access_token" in data)) {
        throw new Error(
          extractApiErrorMessage(
            data as ApiError,
            mode === "login" ? "Sign in failed." : "Account creation failed."
          )
        );
      }

      persistAuthSession(data.access_token, data.user);
      setAuthToken(data.access_token);
      setCurrentUser(data.user);
      setAuthError(null);
      await Promise.all([
        loadDatasets(data.access_token),
        loadBackgrounds(data.access_token),
        loadRenders(data.access_token),
      ]);
    } catch (error) {
      setAuthError(getErrorMessage(error, "Authentication failed."));
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: UploadType
  ) => {
    const file = event.target.files?.[0];
    if (!file || !authToken) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("grid", file);
    formData.append("type", type);

    try {
      const response = await fetch(apiUrl("/api/v1/datasets/upload"), {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      let data: DatasetRecord | ApiError | null = null;
      try {
        data = (await response.json()) as DatasetRecord | ApiError;
      } catch {
        data = null;
      }

      if (response.status === 401) {
        handleExpiredSession(
          extractApiErrorMessage(data as ApiError, "Please sign in again.")
        );
        return;
      }

      if (!response.ok || !data || !("id" in data)) {
        throw new Error(extractApiErrorMessage(data as ApiError, "Upload failed."));
      }

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
    if (!file || !authToken) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("background", file);

    try {
      const response = await fetch(apiUrl("/api/v1/backgrounds/upload"), {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      let data: BackgroundRecord | ApiError | null = null;
      try {
        data = (await response.json()) as BackgroundRecord | ApiError;
      } catch {
        data = null;
      }

      if (response.status === 401) {
        handleExpiredSession(
          extractApiErrorMessage(data as ApiError, "Please sign in again.")
        );
        return;
      }

      if (!response.ok || !data || !("id" in data)) {
        throw new Error(
          extractApiErrorMessage(data as ApiError, "Background upload failed.")
        );
      }

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
      const response = await fetch(apiUrl(`/api/v1/datasets/${datasetId}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ display_name: displayName }),
      });
      let data: DatasetRecord | ApiError | null = null;
      try {
        data = (await response.json()) as DatasetRecord | ApiError;
      } catch {
        data = null;
      }

      if (response.status === 401) {
        handleExpiredSession(
          extractApiErrorMessage(data as ApiError, "Please sign in again.")
        );
        return;
      }

      if (!response.ok || !data || !("id" in data)) {
        throw new Error(
          extractApiErrorMessage(data as ApiError, "Dataset rename failed.")
        );
      }

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
      const response = await fetch(apiUrl(`/api/v1/datasets/${datasetId}`), {
        method: "DELETE",
        headers: authHeaders(),
      });
      let data: ApiError | null = null;
      try {
        data = (await response.json()) as ApiError;
      } catch {
        data = null;
      }

      if (response.status === 401) {
        handleExpiredSession(
          extractApiErrorMessage(data, "Please sign in again.")
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          extractApiErrorMessage(data, "Dataset delete failed.")
        );
      }

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
      const response = await fetch(apiUrl("/api/v1/backgrounds/select"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ background_id: backgroundId }),
      });
      let data: BackgroundListResponse | ApiError | null = null;
      try {
        data = (await response.json()) as BackgroundListResponse | ApiError;
      } catch {
        data = null;
      }

      if (response.status === 401) {
        handleExpiredSession(
          extractApiErrorMessage(data as ApiError, "Please sign in again.")
        );
        return;
      }

      if (!response.ok || !data || !("items" in data)) {
        throw new Error(
          extractApiErrorMessage(data as ApiError, "Background update failed.")
        );
      }

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
      const response = await fetch(
        apiUrl(`/api/v1/backgrounds/${backgroundId}`),
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );
      let data: ApiError | null = null;
      try {
        data = (await response.json()) as ApiError;
      } catch {
        data = null;
      }

      if (response.status === 401) {
        handleExpiredSession(
          extractApiErrorMessage(data, "Please sign in again.")
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          extractApiErrorMessage(data, "Background delete failed.")
        );
      }

      await loadBackgrounds();
    } catch (error) {
      setUploadError(getErrorMessage(error, "Background delete failed."));
    } finally {
      setBusyBackgroundId(null);
    }
  };

  const handleRender = async () => {
    if (!canRender) {
      setRenderError("Add at least one completed alphabet dataset before rendering.");
      return;
    }

    setIsRendering(true);
    setRenderError(null);
    setPreviewError(null);

    try {
      const renderResponse = await fetch(apiUrl("/api/v1/renders"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ text, options }),
      });

      let renderPayload: RenderJobResponse | ApiError | null = null;
      try {
        renderPayload = (await renderResponse.json()) as RenderJobResponse | ApiError;
      } catch {
        renderPayload = null;
      }

      if (renderResponse.status === 401) {
        handleExpiredSession(
          extractApiErrorMessage(renderPayload as ApiError, "Please sign in again.")
        );
        return;
      }

      if (!renderResponse.ok || !renderPayload || !("id" in renderPayload)) {
        throw new Error(
          extractApiErrorMessage(renderPayload as ApiError, "Render failed.")
        );
      }

      clearPreview();
      setSelectedRenderId(renderPayload.id);
      await loadRenders();
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
      const response = await fetch(apiUrl(`/api/v1/renders/${renderId}/file`), {
        headers: authHeaders(),
      });

      if (response.status === 401) {
        handleExpiredSession("Please sign in again.");
        return;
      }

      if (!response.ok) {
        let payload: ApiError | null = null;
        try {
          payload = (await response.json()) as ApiError;
        } catch {
          payload = null;
        }
        throw new Error(
          extractApiErrorMessage(payload, "The PNG could not be downloaded.")
        );
      }

      const blob = await response.blob();
      downloadBlob(blob, `handwritten-render-${renderId}.png`);
    } catch (error) {
      setPreviewError(getErrorMessage(error, "The PNG could not be downloaded."));
    } finally {
      setBusyRenderId(null);
    }
  };

  const handleDeleteRender = async (renderId: string) => {
    setBusyRenderId(renderId);
    try {
      const response = await fetch(apiUrl(`/api/v1/renders/${renderId}`), {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (response.status === 401) {
        handleExpiredSession("Please sign in again.");
        return;
      }

      if (!response.ok) {
        let payload: ApiError | null = null;
        try {
          payload = (await response.json()) as ApiError;
        } catch {
          payload = null;
        }
        throw new Error(
          extractApiErrorMessage(payload, "Render delete failed.")
        );
      }

      if (selectedRenderId === renderId) {
        clearPreview();
      }
      await loadRenders();
    } catch (error) {
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

  const resetWorkspace = async () => {
    setUploadError(null);
    setRenderError(null);
    setPreviewError(null);
    setOptions(defaultOptions);
    clearPreview();
    await Promise.all([loadDatasets(), loadBackgrounds(), loadRenders()]);
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

  const handleLogout = useCallback(async () => {
    if (authToken) {
      try {
        await fetch(apiUrl("/api/v1/auth/logout"), {
          method: "POST",
          headers: authHeaders(),
        });
      } catch {
        // Ignore logout network failures and still clear local state.
      }
    }

    clearAuthState();
    setAuthError(null);
    setAssignmentMode(null);
    clearStoredAssignmentMode();
    setUploadError(null);
    setRenderError(null);
    setPreviewError(null);
  }, [apiUrl, authHeaders, authToken, clearAuthState]);

  const isCodingMode = assignmentMode === "coding";
  const userForAuth = useMemo(() => currentUser ?? readStoredAuthUser(), [currentUser]);
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

  if (isAuthChecking) {
    return (
      <div className="app app--gate">
        <div className="gate-topbar">
          <span className="gate-brand">Handwritten Notes</span>
        </div>
        <section className="auth-shell">
          <div className="auth-panel surface surface--raised">
            <p className="auth-panel__title">Checking your workspace...</p>
          </div>
        </section>
      </div>
    );
  }

  if (!authToken || !currentUser) {
    return (
      <AuthScreen
        theme={theme}
        isSubmitting={isAuthenticating}
        error={authError}
        lastUser={userForAuth}
        onToggleTheme={toggleTheme}
        onSubmit={handleAuthenticate}
      />
    );
  }

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
        userEmail={currentUser.email}
        onToggleTheme={toggleTheme}
        onChangeAssignmentType={openAssignmentPicker}
        onRefreshLibrary={() =>
          void Promise.all([loadDatasets(), loadBackgrounds(), loadRenders()])
        }
        onResetWorkspace={() => void resetWorkspace()}
        onLogout={handleLogout}
        isLoadingDatasets={isLoadingDatasets || isLoadingRenders}
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
            onTextChange={setText}
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
            onResetAllFilters={resetAllFilters}
            canRender={canRender}
            isRendering={isRendering}
            onRender={handleRender}
            renderError={renderError}
          />

          <DatasetSection
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
    </div>
  );
}
