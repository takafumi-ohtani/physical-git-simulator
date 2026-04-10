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
} from "./types";
import type { ObjectStore } from "./object-store";
import type { RefStore } from "./ref-store";

type MergeResultUnion = FastForwardResult | NormalMergeResult | ConflictResult;

/**
 * MergeEngine - Fast-Forward / Normal Merge / Conflict の3パターンを処理
 *
 * ObjectStore と RefStore を利用して、2つのBranchのマージを実行する。
 * - 共通祖先（Ancestor）の探索（BFS）
 * - Fast-Forward判定
 * - Tree差分比較によるConflict検出
 * - Conflict解決（ours / theirs / manual）
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
    // Collect all ancestors of commitA (including commitA itself)
    const ancestorsA = new Set<ObjectId>();
    const queueA: ObjectId[] = [commitA];
    while (queueA.length > 0) {
      const id = queueA.shift()!;
      if (ancestorsA.has(id)) continue;
      ancestorsA.add(id);
      const obj = this.objectStore.get(id);
      if (obj && obj.type === "commit") {
        for (const parentId of obj.parentIds) {
          queueA.push(parentId);
        }
      }
    }

    // BFS from commitB, find the first commit that is also an ancestor of A
    const visited = new Set<ObjectId>();
    const queueB: ObjectId[] = [commitB];
    while (queueB.length > 0) {
      const id = queueB.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      if (ancestorsA.has(id)) {
        return id;
      }
      const obj = this.objectStore.get(id);
      if (obj && obj.type === "commit") {
        for (const parentId of obj.parentIds) {
          queueB.push(parentId);
        }
      }
    }

    return null;
  }

  /**
   * Fast-Forward判定: targetがsourceの祖先であるかチェック
   *
   * targetがsourceの祖先 → sourceまでBranch参照を進めるだけでマージ完了
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
        for (const parentId of obj.parentIds) {
          queue.push(parentId);
        }
      }
    }
    return false;
  }

  /**
   * 2つのBranchをマージする
   *
   * sourceBranch を targetBranch にマージする。
   * - Fast-Forward: targetがsourceの祖先 → Branch参照を移動
   * - Normal Merge: Conflictなし → 新しいMerge Commitを作成
   * - Conflict: 同一ファイルが両方で異なる変更 → ConflictResultを返す
   */
  merge(sourceBranch: string, targetBranch: string): MergeResultUnion {
    const sourceCommitId = this.refStore.getBranch(sourceBranch);
    const targetCommitId = this.refStore.getBranch(targetBranch);

    if (!sourceCommitId) {
      throw new Error(`Branch "${sourceBranch}" は存在しません`);
    }
    if (!targetCommitId) {
      throw new Error(`Branch "${targetBranch}" は存在しません`);
    }

    // Same commit — nothing to do, treat as fast-forward
    if (sourceCommitId === targetCommitId) {
      return { type: "fast-forward", targetCommitId: sourceCommitId };
    }

    // Fast-Forward check: is target an ancestor of source?
    if (this.isFastForward(sourceCommitId, targetCommitId)) {
      // Move target branch pointer to source commit
      this.refStore.moveBranch(targetBranch, sourceCommitId);
      return { type: "fast-forward", targetCommitId: sourceCommitId };
    }

    // Find common ancestor
    const ancestorId = this.findAncestor(sourceCommitId, targetCommitId);

    // Get trees for comparison
    const sourceTree = this.getCommitTree(sourceCommitId);
    const targetTree = this.getCommitTree(targetCommitId);
    const ancestorTree = ancestorId ? this.getCommitTree(ancestorId) : null;

    // Build file maps from trees
    const sourceFiles = this.flattenTree(sourceTree);
    const targetFiles = this.flattenTree(targetTree);
    const ancestorFiles = ancestorTree
      ? this.flattenTree(ancestorTree)
      : new Map<string, string>();

    // Detect conflicts and auto-merge
    const conflicts: ConflictEntry[] = [];
    const mergedFiles = new Map<string, string>();

    // Collect all file paths
    const allPaths = new Set<string>([
      ...sourceFiles.keys(),
      ...targetFiles.keys(),
      ...ancestorFiles.keys(),
    ]);

    for (const path of allPaths) {
      const ancestorContent = ancestorFiles.get(path) ?? null;
      const sourceContent = sourceFiles.get(path) ?? null;
      const targetContent = targetFiles.get(path) ?? null;

      // Both sides have the same content — no conflict
      if (sourceContent === targetContent) {
        if (sourceContent !== null) {
          mergedFiles.set(path, sourceContent);
        }
        continue;
      }

      // Only source changed from ancestor (or file added only in source)
      if (targetContent === ancestorContent) {
        if (sourceContent !== null) {
          mergedFiles.set(path, sourceContent);
        }
        // else: source deleted the file — omit from merged
        continue;
      }

      // Only target changed from ancestor (or file added only in target)
      if (sourceContent === ancestorContent) {
        if (targetContent !== null) {
          mergedFiles.set(path, targetContent);
        }
        // else: target deleted the file — omit from merged
        continue;
      }

      // Both changed differently from ancestor → conflict
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

    // No conflicts — create merge commit
    // Build tree entries from merged files
    const treeEntries: TreeEntry[] = [];
    for (const [name, content] of mergedFiles) {
      const { blob } = this.objectStore.addBlob(content);
      treeEntries.push({ name, objectId: blob.id });
    }

    // Sort entries by name for consistency
    treeEntries.sort((a, b) => a.name.localeCompare(b.name));

    const mergeTree = this.objectStore.addTree(treeEntries);
    const mergeCommit = this.objectStore.addCommit(
      mergeTree.id,
      [targetCommitId, sourceCommitId],
      `Merge ${sourceBranch} into ${targetBranch}`
    );

    // Advance target branch to merge commit
    this.refStore.moveBranch(targetBranch, mergeCommit.id);

    return { type: "normal", mergeCommit };
  }

  /**
   * Conflict解決: ours / theirs / manual の3方式
   *
   * 解決結果の文字列を返す。
   */
  resolveConflict(entry: ConflictEntry, choice: ResolveChoice): string {
    if (choice === "ours") {
      return entry.ours;
    }
    if (choice === "theirs") {
      return entry.theirs;
    }
    // manual resolution
    return choice.manual;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * CommitのTreeオブジェクトを取得する
   */
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

  /**
   * Treeのエントリをフラットなファイルマップに変換する
   *
   * name → content のMapを返す。
   * Blobエントリのみを対象とし、サブTreeは再帰的に展開する。
   */
  private flattenTree(
    tree: Tree,
    prefix: string = ""
  ): Map<string, string> {
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
