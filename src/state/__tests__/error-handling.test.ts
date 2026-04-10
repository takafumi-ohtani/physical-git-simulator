/**
 * エラーハンドリング統合テスト
 *
 * reducerを直接使用して、各エラーケースが正しく errorMessage / notification を
 * SimulatorState に設定することを検証する。
 *
 * Validates: Requirements 1.3, 1.4, 2.4, 2.5, 3.6, 3.7, 4.3, 4.4, 5.4
 */
import { describe, it, expect } from "vitest";
import { simulatorReducer, createInitialState } from "../reducer";
import type { SimulatorState } from "../types";

/** ヘルパー: 初期状態にBlob→Tree→Commitを作成し、ブランチ操作可能な状態を返す */
function stateWithCommit(): SimulatorState {
  let state = createInitialState();
  // Blob作成
  state = simulatorReducer(state, { type: "CREATE_BLOB", content: "hello" });
  const blob = state.objectStore.getAllByType("blob")[0];
  // Tree作成
  state = simulatorReducer(state, {
    type: "CREATE_TREE",
    entries: [{ name: "file.txt", objectId: blob.id }],
  });
  const tree = state.objectStore.getAllByType("tree")[0];
  // Commit作成（初期コミット、親なし）
  state = simulatorReducer(state, {
    type: "CREATE_COMMIT",
    treeId: tree.id,
    parentIds: [],
    message: "initial commit",
  });
  return state;
}

describe("エラーハンドリング統合テスト", () => {
  // -------------------------------------------------------------------------
  // 1. CREATE_TREE: 存在しないオブジェクト参照 → errorMessage (要件 2.5)
  // -------------------------------------------------------------------------
  it("CREATE_TREE with non-existent object reference sets errorMessage", () => {
    const state = createInitialState();
    const next = simulatorReducer(state, {
      type: "CREATE_TREE",
      entries: [{ name: "ghost.txt", objectId: "non-existent-id" }],
    });
    expect(next.errorMessage).toBeTruthy();
    expect(next.notification).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 2. CREATE_COMMIT: 存在しないTree ID → errorMessage (要件 3.7)
  // -------------------------------------------------------------------------
  it("CREATE_COMMIT with non-existent tree ID sets errorMessage", () => {
    const state = createInitialState();
    const next = simulatorReducer(state, {
      type: "CREATE_COMMIT",
      treeId: "non-existent-tree",
      parentIds: [],
      message: "bad commit",
    });
    expect(next.errorMessage).toBeTruthy();
    expect(next.notification).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 3. CREATE_COMMIT: 存在しない親Commit ID → errorMessage (要件 3.6)
  // -------------------------------------------------------------------------
  it("CREATE_COMMIT with non-existent parent ID sets errorMessage", () => {
    let state = createInitialState();
    // 有効なTreeを作成
    state = simulatorReducer(state, { type: "CREATE_BLOB", content: "data" });
    const blob = state.objectStore.getAllByType("blob")[0];
    state = simulatorReducer(state, {
      type: "CREATE_TREE",
      entries: [{ name: "f.txt", objectId: blob.id }],
    });
    const tree = state.objectStore.getAllByType("tree")[0];

    const next = simulatorReducer(state, {
      type: "CREATE_COMMIT",
      treeId: tree.id,
      parentIds: ["non-existent-parent"],
      message: "bad parent",
    });
    expect(next.errorMessage).toBeTruthy();
    expect(next.notification).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 4. CREATE_BRANCH: 重複名 → errorMessage (要件 4.4)
  // -------------------------------------------------------------------------
  it("CREATE_BRANCH with duplicate name sets errorMessage", () => {
    let state = stateWithCommit();
    const commit = state.objectStore.getAllByType("commit")[0];
    // ブランチ作成
    state = simulatorReducer(state, {
      type: "CREATE_BRANCH",
      name: "feature",
      commitId: commit.id,
    });
    // 同名で再作成 → エラー
    const next = simulatorReducer(state, {
      type: "CREATE_BRANCH",
      name: "feature",
      commitId: commit.id,
    });
    expect(next.errorMessage).toBeTruthy();
    expect(next.notification).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 5. CREATE_BRANCH: 存在しないCommit → errorMessage (要件 4.3)
  // -------------------------------------------------------------------------
  it("CREATE_BRANCH with non-existent commit sets errorMessage", () => {
    const state = createInitialState();
    const next = simulatorReducer(state, {
      type: "CREATE_BRANCH",
      name: "ghost-branch",
      commitId: "non-existent-commit",
    });
    expect(next.errorMessage).toBeTruthy();
    expect(next.notification).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 6. CHECKOUT_BRANCH: 存在しないブランチ → errorMessage (要件 5.4)
  // -------------------------------------------------------------------------
  it("CHECKOUT_BRANCH with non-existent branch sets errorMessage", () => {
    const state = createInitialState();
    const next = simulatorReducer(state, {
      type: "CHECKOUT_BRANCH",
      name: "no-such-branch",
    });
    expect(next.errorMessage).toBeTruthy();
    expect(next.notification).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 7. CHECKOUT_COMMIT: 存在しないCommit → errorMessage (要件 5.4)
  // -------------------------------------------------------------------------
  it("CHECKOUT_COMMIT with non-existent commit sets errorMessage", () => {
    const state = createInitialState();
    const next = simulatorReducer(state, {
      type: "CHECKOUT_COMMIT",
      commitId: "non-existent-commit",
    });
    expect(next.errorMessage).toBeTruthy();
    expect(next.notification).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 8. CREATE_BLOB: 同一内容 → notification（エラーではない）(要件 1.3)
  // -------------------------------------------------------------------------
  it("CREATE_BLOB with duplicate content sets notification (not error)", () => {
    let state = createInitialState();
    state = simulatorReducer(state, { type: "CREATE_BLOB", content: "dup" });
    // 同一内容で再作成
    const next = simulatorReducer(state, { type: "CREATE_BLOB", content: "dup" });
    expect(next.notification).toBeTruthy();
    expect(next.errorMessage).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 9. CHECKOUT_COMMIT → Detached HEAD notification (要件 5.2)
  // -------------------------------------------------------------------------
  it("CHECKOUT_COMMIT sets Detached HEAD notification", () => {
    let state = stateWithCommit();
    const commit = state.objectStore.getAllByType("commit")[0];
    const next = simulatorReducer(state, {
      type: "CHECKOUT_COMMIT",
      commitId: commit.id,
    });
    expect(next.notification).toMatch(/Detached HEAD/);
    expect(next.errorMessage).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 10. エラー/通知は次のアクションでクリアされる
  // -------------------------------------------------------------------------
  it("error/notification cleared on next action", () => {
    let state = createInitialState();
    // エラーを発生させる
    state = simulatorReducer(state, {
      type: "CREATE_TREE",
      entries: [{ name: "x", objectId: "bad-id" }],
    });
    expect(state.errorMessage).toBeTruthy();

    // 次の正常アクションでクリアされる
    state = simulatorReducer(state, { type: "CREATE_BLOB", content: "clear" });
    expect(state.errorMessage).toBeNull();

    // 通知も同様にクリアされる
    state = simulatorReducer(state, { type: "CREATE_BLOB", content: "dup-content" });
    state = simulatorReducer(state, { type: "CREATE_BLOB", content: "dup-content" });
    expect(state.notification).toBeTruthy();

    state = simulatorReducer(state, { type: "CREATE_BLOB", content: "new-content" });
    expect(state.notification).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 11. DISMISS_MESSAGE: エラーと通知をクリアする
  // -------------------------------------------------------------------------
  it("DISMISS_MESSAGE clears error and notification", () => {
    let state = createInitialState();
    // エラーを発生させる
    state = simulatorReducer(state, {
      type: "CREATE_TREE",
      entries: [{ name: "x", objectId: "bad-id" }],
    });
    expect(state.errorMessage).toBeTruthy();
    state = simulatorReducer(state, { type: "DISMISS_MESSAGE" });
    expect(state.errorMessage).toBeNull();
    expect(state.notification).toBeNull();

    // 通知を発生させる
    state = createInitialState();
    state = simulatorReducer(state, { type: "CREATE_BLOB", content: "n" });
    state = simulatorReducer(state, { type: "CREATE_BLOB", content: "n" });
    expect(state.notification).toBeTruthy();
    state = simulatorReducer(state, { type: "DISMISS_MESSAGE" });
    expect(state.errorMessage).toBeNull();
    expect(state.notification).toBeNull();
  });
});
