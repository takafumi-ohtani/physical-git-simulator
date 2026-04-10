import type {
  ObjectId,
  TreeEntry,
  IdMode,
  ConflictEntry,
  ResolveChoice,
} from "../core/types";
import type { ObjectStore } from "../core/object-store";
import type { RefStore } from "../core/ref-store";

// =============================================================================
// State Management 型定義 - 物理Gitシミュレータ
// =============================================================================

/**
 * Merge進行中の状態
 */
export type MergeState = {
  sourceBranch: string;
  targetBranch: string;
  conflicts: ConflictEntry[];
  resolved: Map<string, string>; // path -> resolved content
};

/**
 * 操作ステップ記録（要件6: ステップごと表示用）
 */
export interface StepRecord {
  action: string;
  description: string;
  objectsCreated: ObjectId[];
  refsUpdated: string[];
}

/**
 * Simulator全体の状態
 */
export interface SimulatorState {
  objectStore: ObjectStore;
  refStore: RefStore;
  idMode: IdMode;
  selectedObjectId: ObjectId | null;
  mergeState: MergeState | null;
  stepHistory: StepRecord[];
  errorMessage: string | null;
  notification: string | null;
}

/**
 * Reducer Actions（ユーザー操作をCore Engineのアクションに変換）
 */
export type SimulatorAction =
  | { type: "CREATE_BLOB"; content: string }
  | { type: "CREATE_TREE"; entries: TreeEntry[] }
  | { type: "CREATE_COMMIT"; treeId: ObjectId; parentIds: ObjectId[]; message: string }
  | { type: "HIGH_LEVEL_COMMIT"; files: { name: string; content: string }[]; message: string }
  | { type: "CREATE_BRANCH"; name: string; commitId: ObjectId }
  | { type: "MOVE_BRANCH"; name: string; commitId: ObjectId }
  | { type: "CHECKOUT_BRANCH"; name: string }
  | { type: "CHECKOUT_COMMIT"; commitId: ObjectId }
  | { type: "START_MERGE"; sourceBranch: string }
  | { type: "RESOLVE_CONFLICT"; path: string; choice: ResolveChoice }
  | { type: "COMPLETE_MERGE"; message: string }
  | { type: "FIX_COMMIT"; files: { name: string; content: string }[]; message: string }
  | { type: "SET_ID_MODE"; mode: IdMode }
  | { type: "SELECT_OBJECT"; objectId: ObjectId | null }
  | { type: "DISMISS_MESSAGE" };
