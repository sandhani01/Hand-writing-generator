import type { AssignmentMode } from "./types";

const STORAGE_KEY = "hn-assignment-mode";

export function readStoredAssignmentMode(): AssignmentMode | null {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    if (v === "simple" || v === "coding") {
      return v;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function persistAssignmentMode(mode: AssignmentMode) {
  try {
    sessionStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function clearStoredAssignmentMode() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
