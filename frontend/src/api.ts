import type { ApiError } from "./types";

const API_TIMEOUT_MS = 15000;
const SLOW_API_TIMEOUT_MS = 60000; // For uploads/renders

export class ApiRequestError extends Error {
  status: number;
  payload: ApiError | null;

  constructor(status: number, message: string, payload: ApiError | null = null) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.payload = payload;
  }
}

export type RequestOptions = RequestInit & {
  timeoutMs?: number;
  authToken?: string | null;
  workspaceSessionId?: string | null;
};

async function fetchWithTimeout(
  url: string,
  options: RequestOptions = {}
): Promise<Response> {
  const { timeoutMs = API_TIMEOUT_MS, authToken, workspaceSessionId, ...init } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(init.headers);
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }
  if (workspaceSessionId) {
    headers.set("X-Workspace-Session", workspaceSessionId);
  }

  try {
    const response = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`The request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const apiBase = ((import.meta as any).env?.VITE_API_BASE || "").replace(/\/$/, "");
  const url = `${apiBase}${path}`;

  const response = await fetchWithTimeout(url, options);

  let payload: any = null;
  const contentType = response.headers.get("Content-Type");
  if (contentType?.includes("application/json")) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message = payload?.detail || payload?.error || `Request failed with status ${response.status}`;
    throw new ApiRequestError(response.status, message, payload);
  }

  return payload as T;
}

export async function apiBlobFetch(
  path: string,
  options: RequestOptions = {}
): Promise<Blob> {
  const apiBase = ((import.meta as any).env?.VITE_API_BASE || "").replace(/\/$/, "");
  const url = `${apiBase}${path}`;

  const response = await fetchWithTimeout(url, options);

  if (!response.ok) {
    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const message = payload?.detail || payload?.error || `Blob request failed with status ${response.status}`;
    throw new ApiRequestError(response.status, message, payload);
  }

  return response.blob();
}

/**
 * Standardizes common API interactions
 */
export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => 
    apiFetch<T>(path, { ...options, method: "GET" }),
  
  post: <T>(path: string, body?: any, options?: RequestOptions) =>
    apiFetch<T>(path, {
      ...options,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers as any),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: any, options?: RequestOptions) =>
    apiFetch<T>(path, {
      ...options,
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers as any),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
    
  upload: <T>(path: string, formData: FormData, options?: RequestOptions) =>
    apiFetch<T>(path, {
      ...options,
      method: "POST",
      body: formData,
      timeoutMs: options?.timeoutMs || SLOW_API_TIMEOUT_MS,
    }),

  blob: (path: string, options?: RequestOptions) =>
    apiBlobFetch(path, { ...options, method: "GET" }),
};
