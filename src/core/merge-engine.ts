import type {
  ObjectId,
  Commit,
  Tree,
  TreeEntry,
  FastForwardResult,
  NormalMergeResult,
  ConflictResult,
  ConflictEntry,
  ResolveChoice,
  BlobContent,
} from "./types";
import type { ObjectStore } from "./object-store";
import type { RefStore } from "./ref-store";

type MergeResultUnion = FastForwardResult | NormalMergeResult | ConflictResult;

/**
 * 2ワード構造のBlobコンテンツに対してマージ分類を行う（純粋関数）
 *
 * - no-change:   両者ともAncestorから変更なし
 * - auto-ours:   Oursのみ変更 → 自動採用
 * - auto-theirs: Theirsのみ変更 → 自動採用
 * - conflict:    両方変更 → ユーザーが手動解決
 */
export function classifyBlobMerge(
  ancestor: BlobContent,
  ours: BlobContent,
  theirs: BlobContent
): "no-change" | "auto-ours" | "auto-theirs" | "conflict" {
  const oursChanged = ours !== ancestor;
  const theirsChanged = theirs !== ancestor;

  if (!oursChanged && !theirsChanged) return "no-change";
  if (oursChanged && !theirsChanged) return "auto-ours";
  if (!oursChanged && theirsChanged) return "auto-theirs";
  // 両方変更 → 常にConflict（ワード単位の自動合成は行わない）
  return "conflict";
}

/**
 * MergeEngine - Fast-Forward / Normal Merge / Conflict の3パターンを処理
 */
export class MergeEngine {
  private objectStore: ObjectStore;
  private refStore: RefStore;

  constructor(objectStore: ObjectStore, refStore: RefStore) {
    this.objectStore = objectStore;
    this.refStore = refStore;
  }

  /**
   * 2つのCommitの共通祖先をBFSで探索する
   */
  findAncestor(commitA: ObjectId, commitB: ObjectId): ObjectId | null {
    const ancestorsA = new Set<ObjectId>();
    const queueA: ObjectId[] = [commitA];
    while (queueA.length > 0) {
      const id = queueA.shift()!;
      if (ancestorsA.has(id)) continue;
      ancestorsA.add(id);
      const obj = this.objectStore.get(id);
      if (obj && obj.type === "commit") {
        for (const parentId of obj.parentIds) queueA.push(parentId);
      }
    }

    const visited = new Set<ObjectId>();
    const queueB: ObjectId[] = [commitB];
    while (queueB.length > 0) {
      const id = queueB.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      if (ancestorsA.has(id)) return id;
      const obj = this.objectStore.get(id);
      if (obj && obj.type === "commit") {
        for (const parentId of obj.parentIds) queueB.push(parentId);
      }
    }

    return null;
  }

  /**
   * Fast-Forward判定: targetがsourceの祖先であるかチェック
   */
  isFastForward(source: ObjectId, target: ObjectId): boolean {
    if (source === target) return true;
    const visited = new Set<ObjectId>();
    const queue: ObjectId[] = [source];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      if (id === target) return true;
      const obj = this.objectStore.get(id);
      if (obj && obj.type === "commit") {
        for (const parentId of obj.parentIds) queue.push(parentId);
      }
    }
    return false;
  }

  /**
   * 2つのBranchをマージする
   */
  merge(sourceBranch: string, targetBranch: string): MergeResultUnion {
    const sourceCommitId = this.refStore.getBranch(sourceBranch);
    const targetCommitId = this.refStore.getBranch(targetBranch);

    if (!sourceCommitId) throw new Error(`Branch "${sourceBranch}" は存在しません`);
    if (!targetCommitId) throw new Error(`Branch "${targetBranch}" は存在しません`);

    if (sourceCommitId === targetCommitId) {
      return { type: "fast-forward", targetCommitId: sourceCommitId };
    }

    if (this.isFastForward(sourceCommitId, targetCommitId)) {
      this.refStore.moveBranch(targetBranch, sourceCommitId);
      return { type: "fast-forward", targetCommitId: sourceCommitId };
    }

    const ancestorId = this.findAncestor(sourceCommitId, targetCommitId);

    const sourceTree = this.getCommitTree(sourceCommitId);
    const targetTree = this.getCommitTree(targetCommitId);
    const ancestorTree = ancestorId ? this.getCommitTree(ancestorId) : null;

    const sourceFiles = this.flattenTree(sourceTree);
    const targetFiles = this.flattenTree(targetTree);
    const ancestorFiles = ancestorTree
      ? this.flattenTree(ancestorTree)
      : new Map<string, string>();

    const conflicts: ConflictEntry[] = [];
    const mergedFiles = new Map<string, string>();

    const allPaths = new Set<string>([
      ...sourceFiles.keys(),
      ...targetFiles.keys(),
      ...ancestorFiles.keys(),
    ]);

    for (const path of allPaths) {
      const ancestorContent = ancestorFiles.get(path) ?? null;
      const sourceContent = sourceFiles.get(path) ?? null;
      const targetContent = targetFiles.get(path) ?? null;

      if (sourceContent === targetContent) {
        if (sourceContent !== null) mergedFiles.set(path, sourceContent);
        continue;
      }

      if (targetContent === ancestorContent) {
        if (sourceContent !== null) mergedFiles.set(path, sourceContent);
        continue;
      }

      if (sourceContent === ancestorContent) {
        if (targetContent !== null) mergedFiles.set(path, targetContent);
        continue;
      }

      conflicts.push({
        path,
        ancestor: ancestorContent,
        ours: targetContent ?? "",
        theirs: sourceContent ?? "",
      });
    }

    if (conflicts.length > 0) {
      return { type: "conflict", conflicts };
    }

    const treeEntries: TreeEntry[] = [];
    for (const [name, content] of mergedFiles) {
      const { blob } = this.objectStore.addBlob(content);
      treeEntries.push({ name, objectId: blob.id });
    }
    treeEntries.sort((a, b) => a.name.localeCompare(b.name));

    const mergeTree = this.objectStore.addTree(treeEntries);
    const mergeCommit = this.objectStore.addCommit(
      mergeTree.id,
      [targetCommitId, sourceCommitId],
      `Merge ${sourceBranch} into ${targetBranch}`
    );

    this.refStore.moveBranch(targetBranch, mergeCommit.id);
    return { type: "normal", mergeCommit };
  }

  /**
   * Conflict解決: ours / theirs / manual の3方式
   */
  resolveConflict(entry: ConflictEntry, choice: ResolveChoice): string {
    if (choice === "ours") return entry.ours;
    if (choice === "theirs") return entry.theirs;
    return choice.manual;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getCommitTree(commitId: ObjectId): Tree {
    const commit = this.objectStore.get(commitId);
    if (!commit || commit.type !== "commit") {
      throw new Error(`Commitが見つかりません: ${commitId}`);
    }
    const tree = this.objectStore.get((commit as Commit).treeId);
    if (!tree || tree.type !== "tree") {
      throw new Error(`CommitのTreeが見つかりません: ${commitId}`);
    }
    return tree as Tree;
  }

  private flattenTree(tree: Tree, prefix: string = ""): Map<string, string> {
    const files = new Map<string, string>();
    for (const entry of tree.entries) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const obj = this.objectStore.get(entry.objectId);
      if (!obj) continue;
      if (obj.type === "blob") {
        files.set(fullPath, obj.content);
      } else if (obj.type === "tree") {
        const subFiles = this.flattenTree(obj as Tree, fullPath);
        for (const [subPath, content] of subFiles) {
          files.set(subPath, content);
        }
      }
    }
    return files;
  }
}
