// =============================================================================
// Core Type Definitions - 物理Gitシミュレータ
// =============================================================================

// --- Object ID ---
export type ObjectId = string;

// --- Git Objects (不変オブジェクト) ---

export interface Blob {
  readonly type: "blob";
  readonly id: ObjectId;
  readonly content: string;
}

export interface TreeEntry {
  readonly name: string;
  readonly objectId: ObjectId; // BlobまたはTreeのID
}

export interface Tree {
  readonly type: "tree";
  readonly id: ObjectId;
  readonly entries: readonly TreeEntry[];
}

export interface Commit {
  readonly type: "commit";
  readonly id: ObjectId;
  readonly treeId: ObjectId;
  readonly parentIds: readonly ObjectId[]; // 0=初期, 1=通常, 2+=Merge
  readonly message: string;
}

export type GitObject = Blob | Tree | Commit;

// --- Refs ---

export type HeadRef =
  | { type: "branch"; name: string }
  | { type: "detached"; commitId: ObjectId };

// --- Blob Content (2ワード固定語彙) ---

export const BLOB_WORD1 = ["○", "△", "□", "✕"] as const;
export const BLOB_WORD2 = ["1", "2", "3", "4"] as const;

export type BlobWord1 = typeof BLOB_WORD1[number];
export type BlobWord2 = typeof BLOB_WORD2[number];
export type BlobContent = `${BlobWord1}-${BlobWord2}`;

// --- ID Generation ---

export type IdMode = "sequential" | "pseudo-hash";

// --- Merge ---

export interface MergeResult {
  type: "fast-forward" | "normal" | "conflict";
}

export interface FastForwardResult extends MergeResult {
  type: "fast-forward";
  targetCommitId: ObjectId;
}

export interface NormalMergeResult extends MergeResult {
  type: "normal";
  mergeCommit: Commit;
}

export interface ConflictResult extends MergeResult {
  type: "conflict";
  conflicts: ConflictEntry[];
}

export interface ConflictEntry {
  path: string;
  ancestor: string | null; // Ancestorの内容
  ours: string;            // HEAD側の内容
  theirs: string;          // 相手Branch側の内容
}

export type ResolveChoice = "ours" | "theirs" | { manual: string };
