import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearStoredAssignmentMode,
  persistAssignmentMode,
  readStoredAssignmentMode,
} from "./assignmentModeStorage";
import {
  clearStoredAuthSession,
  clearStoredWorkspaceSessionId,
  persistAuthSession,
  persistWorkspaceSessionId,
  readStoredAuthSession,
  readStoredAuthUser,
  readStoredWorkspaceSessionId,
} from "./authStorage";
import { authProvider, authProviderLabel } from "./authConfig";
import { AuthScreen } from "./components/AuthScreen";
import { AppHeader } from "./components/AppHeader";
import { AssignmentGate } from "./components/AssignmentGate";
import { ComposeSection } from "./components/ComposeSection";
import { DatasetSection } from "./components/DatasetSection";
import { PreviewSection } from "./components/PreviewSection";
import { ThemeToggle } from "./components/ThemeToggle";
import { TuningSection } from "./components/TuningSection";
import {
  logoutSupabaseSession,
  refreshSupabaseSession,
  signInWithSupabasePassword,
  signUpWithSupabasePassword,
} from "./providerAuth";
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
  AuthProviderMode,
  BackgroundListResponse,
  BackgroundRecord,
  CharacterOverrideKey,
  DatasetListResponse,
  DatasetRecord,
  DefaultsResponse,
  NumericOptionKey,
  RenderJobResponse,
  RenderOptions,
  StoredAuthSession,
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

function createWorkspaceSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ws-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export default function App() {
  const apiBase =
    ((import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env
      ?.VITE_API_BASE || "").replace(/\/$/, "");
  const apiUrl = useCallback((path: string) => `${apiBase}${path}`, [apiBase]);
  const isHostedAuth = authProvider === "supabase";
  const initialStoredSession = readStoredAuthSession();
  const hasStoredProviderMismatch = Boolean(
    initialStoredSession && initialStoredSession.provider !== authProvider
  );
  const initialSession =
    hasStoredProviderMismatch ? null : initialStoredSession;

  const [authToken, setAuthToken] = useState<string | null>(() =>
    initialSession?.accessToken ?? null
  );
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() =>
    initialSession?.user ?? readStoredAuthUser()
  );
  const [refreshToken, setRefreshToken] = useState<string | null>(() =>
    initialSession?.refreshToken ?? null
  );
  const [workspaceSessionId, setWorkspaceSessionId] = useState<string | null>(() =>
    readStoredWorkspaceSessionId()
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
      workspaceSessionId &&
      datasets.some(
        (dataset) =>
          dataset.dataset_type === "alphabet" && dataset.status === "completed"
      )
  );

  const authHeaders = useCallback(
    (
      tokenOverride?: string,
      workspaceOverride?: string
    ): Record<string, string> => {
      const token = tokenOverride ?? authToken;
      const activeWorkspaceSessionId = workspaceOverride ?? workspaceSessionId;
      if (!token || !activeWorkspaceSessionId) {
        return {};
      }
      return {
        Authorization: `Bearer ${token}`,
        "X-Workspace-Session": activeWorkspaceSessionId,
      };
    },
    [authToken, workspaceSessionId]
  );

  const persistSession = useCallback(
    (
      accessToken: string,
      user: UserProfile,
      provider: AuthProviderMode,
      refreshTokenValue: string | null = null
    ) => {
      const session: StoredAuthSession = {
        accessToken,
        refreshToken: refreshTokenValue,
        provider,
        user,
      };
      persistAuthSession(session);
      setAuthToken(accessToken);
      setCurrentUser(user);
      setRefreshToken(refreshTokenValue);
    },
    []
  );

  const persistWorkspaceSession = useCallback((nextWorkspaceSessionId: string) => {
    persistWorkspaceSessionId(nextWorkspaceSessionId);
    setWorkspaceSessionId(nextWorkspaceSessionId);
  }, []);

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
    clearStoredWorkspaceSessionId();
    setAuthToken(null);
    setCurrentUser(null);
    setRefreshToken(null);
    setWorkspaceSessionId(null);
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

  const fetchCurrentUser = useCallback(
    async (token: string, workspaceOverride?: string) => {
      const response = await fetch(apiUrl("/api/v1/me"), {
        headers: authHeaders(token, workspaceOverride),
      });
      let data: UserProfile | ApiError | null = null;
      try {
        data = (await response.json()) as UserProfile | ApiError;
      } catch {
        data = null;
      }

      return { response, data };
    },
    [apiUrl, authHeaders]
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
        const response = await fetch(apiUrl("/api/v1/datasets"), {
          headers: authHeaders(token, activeWorkspaceSessionId),
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
    [apiUrl, authHeaders, authToken, handleExpiredSession, workspaceSessionId]
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
        const response = await fetch(apiUrl("/api/v1/backgrounds"), {
          headers: authHeaders(token, activeWorkspaceSessionId),
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
    [apiUrl, authHeaders, authToken, handleExpiredSession, workspaceSessionId]
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
        const response = await fetch(apiUrl("/api/v1/renders"), {
          headers: authHeaders(token, activeWorkspaceSessionId),
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
    [
      apiUrl,
      authHeaders,
      authToken,
      clearPreview,
      handleExpiredSession,
      workspaceSessionId,
    ]
  );

  const bootstrapAuthenticatedWorkspace = useCallback(
    async (
      accessToken: string,
      provider: AuthProviderMode,
      refreshTokenValue: string | null = null,
      workspaceOverride?: string
    ) => {
      const attemptVerification = async (token: string) => {
        const { response, data } = await fetchCurrentUser(token, workspaceOverride);
        if (!response.ok || !data || !("email" in data)) {
          throw new Error(
            extractApiErrorMessage(
              data as ApiError,
              "Could not verify the authenticated user."
            )
          );
        }
        return data;
      };

      let verifiedToken = accessToken;
      let verifiedRefreshToken = refreshTokenValue;

      try {
        const user = await attemptVerification(verifiedToken);
        persistSession(verifiedToken, user, provider, verifiedRefreshToken);
        setAuthError(null);
        await Promise.all([
          loadDatasets(verifiedToken, workspaceOverride),
          loadBackgrounds(verifiedToken, workspaceOverride),
          loadRenders(verifiedToken, workspaceOverride),
        ]);
        return;
      } catch (error) {
        const message = getErrorMessage(error, "Could not verify the authenticated user.");
        if (provider !== "supabase" || !verifiedRefreshToken) {
          throw new Error(message);
        }
      }

      const refreshed = await refreshSupabaseSession(verifiedRefreshToken);
      verifiedToken = refreshed.accessToken;
      verifiedRefreshToken = refreshed.refreshToken ?? verifiedRefreshToken;

      const refreshedUser = await attemptVerification(verifiedToken);
      persistSession(verifiedToken, refreshedUser, provider, verifiedRefreshToken);
      setAuthError(null);
      await Promise.all([
        loadDatasets(verifiedToken, workspaceOverride),
        loadBackgrounds(verifiedToken, workspaceOverride),
        loadRenders(verifiedToken, workspaceOverride),
      ]);
    },
    [
      fetchCurrentUser,
      loadBackgrounds,
      loadDatasets,
      loadRenders,
      persistSession,
    ]
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
    if (hasStoredProviderMismatch) {
      clearStoredAuthSession();
    }
  }, [hasStoredProviderMismatch]);

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
      const activeWorkspaceSessionId =
        workspaceSessionId ?? createWorkspaceSessionId();
      if (!workspaceSessionId) {
        persistWorkspaceSession(activeWorkspaceSessionId);
      }
      try {
        await bootstrapAuthenticatedWorkspace(
          authToken,
          authProvider,
          refreshToken,
          activeWorkspaceSessionId
        );
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
    authToken,
    bootstrapAuthenticatedWorkspace,
    persistWorkspaceSession,
    refreshToken,
    handleExpiredSession,
    workspaceSessionId,
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

  const handleAuthenticate = async (
    mode: "login" | "signup",
    email: string,
    password: string
  ) => {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const nextWorkspaceSessionId = createWorkspaceSessionId();
      persistWorkspaceSession(nextWorkspaceSessionId);

      if (isHostedAuth) {
        const session =
          mode === "login"
            ? await signInWithSupabasePassword(email, password)
            : await signUpWithSupabasePassword(email, password);

        await bootstrapAuthenticatedWorkspace(
          session.accessToken,
          "supabase",
          session.refreshToken,
          nextWorkspaceSessionId
        );
      } else {
        const response = await fetch(apiUrl(`/api/v1/auth/${mode}`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        let data: AuthResponse | ApiError | null = null;
        try {
          data = (await response.json()) as AuthResponse | ApiError;
        } catch {
          data = null;
        }
        if (!response.ok || !data || !("access_token" in data)) {
          throw new Error(
            extractApiErrorMessage(
              data as ApiError,
              mode === "login" ? "Sign in failed." : "Account creation failed."
            )
          );
        }

        persistSession(data.access_token, data.user, "local", null);
        setAuthError(null);
        await Promise.all([
          loadDatasets(data.access_token, nextWorkspaceSessionId),
          loadBackgrounds(data.access_token, nextWorkspaceSessionId),
          loadRenders(data.access_token, nextWorkspaceSessionId),
        ]);
      }
    } catch (error) {
      clearStoredWorkspaceSessionId();
      setWorkspaceSessionId(null);
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
    if (!file || !authToken || !workspaceSessionId) {
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
    if (!file || !authToken || !workspaceSessionId) {
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

    if (!authToken || !workspaceSessionId) {
      await Promise.all([loadDatasets(), loadBackgrounds(), loadRenders()]);
      return;
    }

    try {
      await fetch(apiUrl("/api/v1/auth/logout"), {
        method: "POST",
        headers: authHeaders(),
      });
    } catch {
      // Ignore workspace cleanup failures and still rotate the client workspace id.
    }

    const nextWorkspaceSessionId = createWorkspaceSessionId();
    persistWorkspaceSession(nextWorkspaceSessionId);
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
    setAssignmentMode(mode);
    setText(mode === "coding" ? DEFAULT_TEXT_CODING : DEFAULT_TEXT_SIMPLE);
    persistAssignmentMode(mode);
  };

  const openAssignmentPicker = () => {
    setAssignmentMode(null);
    clearStoredAssignmentMode();
  };

  const handleLogout = useCallback(async () => {
    if (authToken && workspaceSessionId) {
      try {
        await fetch(apiUrl("/api/v1/auth/logout"), {
          method: "POST",
          headers: authHeaders(),
        });
      } catch {
        // Ignore backend cleanup failures and still clear local state.
      }
    }

    if (authToken && isHostedAuth) {
      try {
        await logoutSupabaseSession(authToken);
      } catch {
        // Ignore provider logout failures and still clear local state.
      }
    }

    clearAuthState();
    setAuthError(null);
    setAssignmentMode(null);
    clearStoredAssignmentMode();
    setUploadError(null);
    setRenderError(null);
    setPreviewError(null);
  }, [
    apiUrl,
    authHeaders,
    authToken,
    clearAuthState,
    isHostedAuth,
    workspaceSessionId,
  ]);

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
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <section
          className="workspace-loader-shell"
          aria-labelledby="workspace-loader-title"
        >
          <div className="workspace-loader surface surface--raised">
            <div className="workspace-loader__hero">
              <p className="app-header__eyebrow">Opening Workspace</p>
              <h1 className="workspace-loader__title" id="workspace-loader-title">
                Preparing your handwriting engine
              </h1>
              <p className="workspace-loader__lede">
                We&apos;re checking your session, restoring this workspace, and
                getting the renderer ready for uploads and preview.
              </p>
            </div>

            <div
              className="workspace-loader__status"
              role="status"
              aria-live="polite"
            >
              <div className="workspace-loader__pulse" aria-hidden>
                <span />
                <span />
                <span />
              </div>
              <div className="workspace-loader__status-copy">
                <p className="workspace-loader__status-label">
                  Checking your workspace
                </p>
                <p className="workspace-loader__status-text">
                  This usually takes just a moment.
                </p>
              </div>
            </div>

            <div className="workspace-loader__grid" aria-hidden>
              <article className="workspace-loader__card">
                <span className="workspace-loader__card-step">01</span>
                <h2 className="workspace-loader__card-title">Verify session</h2>
                <p className="workspace-loader__card-text">
                  Confirming your sign-in and workspace access.
                </p>
              </article>
              <article className="workspace-loader__card">
                <span className="workspace-loader__card-step">02</span>
                <h2 className="workspace-loader__card-title">Load assets</h2>
                <p className="workspace-loader__card-text">
                  Restoring datasets, backgrounds, and recent renders.
                </p>
              </article>
              <article className="workspace-loader__card">
                <span className="workspace-loader__card-step">03</span>
                <h2 className="workspace-loader__card-title">Warm renderer</h2>
                <p className="workspace-loader__card-text">
                  Pulling in defaults so Compose opens ready to use.
                </p>
              </article>
            </div>
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
        providerLabel={authProviderLabel}
        providerMode={authProvider}
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
            canRender={canRender}
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
            onResetAllFilters={resetAllFilters}
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
