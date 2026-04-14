// =============================================================================
// Persistence Layer - localStorage ベースの永続化
// =============================================================================

import type {
  ObjectId,
  Blob,
  Tree,
  Commit,
  HeadRef,
  IdMode,
} from "./types";

// --- PersistedState 型定義 ---

export interface PersistedState {
  version: 1;
  objects: Array<{
    id: ObjectId;
    type: "blob" | "tree" | "commit";
    data: Blob | Tree | Commit;
  }>;
  branches: Array<{ name: string; commitId: ObjectId }>;
  head: HeadRef;
  idMode: IdMode;
}

// --- localStorage キー ---

const STORAGE_KEY = "git-simulator-state";

// --- 永続化関数 ---

/**
 * PersistedState を localStorage に保存する
 */
export function saveState(state: PersistedState): void {
  const json = JSON.stringify(state);
  localStorage.setItem(STORAGE_KEY, json);
}

/**
 * localStorage から PersistedState を読み込む
 * 見つからない場合や無効なデータの場合は null を返す
 */
export function loadState(): PersistedState | null {
  const json = localStorage.getItem(STORAGE_KEY);
  if (json === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(json);
    if (isValidPersistedState(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * localStorage から永続化データを削除する
 */
export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// --- バリデーション ---

function isValidPersistedState(data: unknown): data is PersistedState {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  if (obj.version !== 1) {
    return false;
  }

  if (!Array.isArray(obj.objects)) {
    return false;
  }

  if (!Array.isArray(obj.branches)) {
    return false;
  }

  if (!isValidHeadRef(obj.head)) {
    return false;
  }

  if (!isValidIdMode(obj.idMode)) {
    return false;
  }

  return true;
}

function isValidHeadRef(head: unknown): head is HeadRef {
  if (typeof head !== "object" || head === null) {
    return false;
  }

  const ref = head as Record<string, unknown>;

  if (ref.type === "branch" && typeof ref.name === "string") {
    return true;
  }

  if (ref.type === "detached" && typeof ref.commitId === "string") {
    return true;
  }

  return false;
}

function isValidIdMode(mode: unknown): mode is IdMode {
  return mode === "sequential" || mode === "pseudo-hash";
}
