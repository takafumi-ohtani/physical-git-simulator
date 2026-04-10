import type { ObjectId, HeadRef } from "./types";
import type { ObjectStore } from "./object-store";

/**
 * RefStore - Branch・HEADの可変参照管理
 *
 * Gitの参照（Branch, HEAD）を管理する。
 * ObjectStoreを参照してCommitの存在チェックを行う。
 */
export class RefStore {
  private branches: Map<string, ObjectId> = new Map();
  private head: HeadRef;
  private objectStore: ObjectStore;

  constructor(objectStore: ObjectStore) {
    this.objectStore = objectStore;
    // 初期状態: mainブランチを指すが、まだブランチは存在しない
    // HEADはブランチ "main" を指す（初期状態）
    this.head = { type: "branch", name: "main" };
  }

  // ---------------------------------------------------------------------------
  // Branch操作
  // ---------------------------------------------------------------------------

  /**
   * 新しいBranchを作成する
   *
   * @throws Branch名が既に存在する場合
   * @throws commitIdが存在しないCommitを指す場合
   */
  createBranch(name: string, commitId: ObjectId): void {
    if (this.branches.has(name)) {
      throw new Error(`Branch "${name}" は既に存在します`);
    }
    this.validateCommitExists(commitId);
    this.branches.set(name, commitId);
  }

  /**
   * Branchの参照先を新しいCommitに移動する
   *
   * @throws Branch名が存在しない場合
   * @throws commitIdが存在しないCommitを指す場合
   */
  moveBranch(name: string, commitId: ObjectId): void {
    if (!this.branches.has(name)) {
      throw new Error(`Branch "${name}" は存在しません`);
    }
    this.validateCommitExists(commitId);
    this.branches.set(name, commitId);
  }

  /**
   * Branchを削除する
   *
   * @throws Branch名が存在しない場合
   */
  deleteBranch(name: string): void {
    if (!this.branches.has(name)) {
      throw new Error(`Branch "${name}" は存在しません`);
    }
    this.branches.delete(name);
  }

  /**
   * Branch名からCommit IDを取得する
   */
  getBranch(name: string): ObjectId | undefined {
    return this.branches.get(name);
  }

  /**
   * すべてのBranchを取得する
   */
  getAllBranches(): Map<string, ObjectId> {
    return new Map(this.branches);
  }

  // ---------------------------------------------------------------------------
  // HEAD操作
  // ---------------------------------------------------------------------------

  /**
   * 現在のHEAD参照を取得する
   */
  getHead(): HeadRef {
    return this.head;
  }

  /**
   * BranchへのCheckoutを実行する
   *
   * @throws Branch名が存在しない場合
   */
  checkoutBranch(name: string): void {
    if (!this.branches.has(name)) {
      throw new Error(`Branch "${name}" は存在しません`);
    }
    this.head = { type: "branch", name };
  }

  /**
   * CommitへのCheckout（Detached HEAD）を実行する
   *
   * @throws commitIdが存在しないCommitを指す場合
   */
  checkoutCommit(commitId: ObjectId): void {
    this.validateCommitExists(commitId);
    this.head = { type: "detached", commitId };
  }

  /**
   * HEADを新しいCommitに進める
   *
   * - HEADがBranchを指している場合: そのBranchの参照先を新しいCommitに更新
   * - HEADがDetached状態の場合: HEADの参照先を新しいCommitに直接更新
   *
   * @throws newCommitIdが存在しないCommitを指す場合
   */
  advanceHead(newCommitId: ObjectId): void {
    this.validateCommitExists(newCommitId);

    if (this.head.type === "branch") {
      this.branches.set(this.head.name, newCommitId);
    } else {
      this.head = { type: "detached", commitId: newCommitId };
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * 指定されたIDがObjectStore内に存在するCommitであることを検証する
   */
  private validateCommitExists(commitId: ObjectId): void {
    const obj = this.objectStore.get(commitId);
    if (!obj || obj.type !== "commit") {
      throw new Error(
        `参照先のCommitが存在しません: ${commitId}`
      );
    }
  }
}
