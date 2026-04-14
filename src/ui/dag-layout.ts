import type { ObjectId, Commit } from "../core/types";
import type { ObjectStore } from "../core/object-store";
import type { RefStore } from "../core/ref-store";

// =============================================================================
// DAG Layout Calculation - Commitの履歴をDAGとしてレイアウト計算
// =============================================================================

/** Layout spacing constants */
export const NODE_SPACING_X = 100;
export const NODE_SPACING_Y = 80;

/** DAGグラフ上の1ノード（Commit） */
export interface DAGNode {
  commitId: ObjectId;
  x: number; // 水平位置（Branch列）
  y: number; // 垂直位置（時系列）
  parentIds: ObjectId[];
  branchNames: string[];
  isHead: boolean;
}

/** DAGグラフ全体のレイアウト */
export interface DAGLayout {
  nodes: DAGNode[];
  edges: Array<{ from: ObjectId; to: ObjectId }>;
  width: number;
  height: number;
}

/**
 * ObjectStore と RefStore からDAGレイアウトを計算する。
 *
 * 1. 全Commitを取得
 * 2. トポロジカルソート（新しい順 = 子が先）
 * 3. Branch列に基づくx位置の割り当て
 * 4. トポロジカル順序に基づくy位置の割り当て
 * 5. 親子間のエッジ計算
 * 6. Branch名・HEAD情報の付与
 */
export function calculateDAGLayout(
  objectStore: ObjectStore,
  refStore: RefStore
): DAGLayout {
  const commits = objectStore.getAllByType("commit") as Commit[];

  if (commits.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  // Build commit lookup map
  const commitMap = new Map<ObjectId, Commit>();
  for (const c of commits) {
    commitMap.set(c.id, c);
  }

  // --- Step 1: Topological sort (newest first / children before parents) ---
  const sorted = topologicalSort(commits, commitMap);

  // --- Step 2: Build branch-name and HEAD mappings ---
  const branchMap = buildBranchMap(refStore);
  const head = refStore.getHead();
  const headCommitId = resolveHeadCommitId(head, refStore);

  // --- Step 3: Assign x positions (branch columns) ---
  const columnAssignment = assignColumns(sorted, commitMap);

  // --- Step 4: Build nodes and edges ---
  const nodes: DAGNode[] = [];
  const edges: Array<{ from: ObjectId; to: ObjectId }> = [];

  for (let i = 0; i < sorted.length; i++) {
    const commit = sorted[i];
    const col = columnAssignment.get(commit.id) ?? 0;

    nodes.push({
      commitId: commit.id,
      x: col * NODE_SPACING_X,
      y: i * NODE_SPACING_Y,
      parentIds: [...commit.parentIds],
      branchNames: branchMap.get(commit.id) ?? [],
      isHead: commit.id === headCommitId,
    });

    for (const parentId of commit.parentIds) {
      if (commitMap.has(parentId)) {
        edges.push({ from: commit.id, to: parentId });
      }
    }
  }

  // --- Step 5: Calculate overall dimensions ---
  const maxCol = Math.max(0, ...Array.from(columnAssignment.values()));
  const width = (maxCol + 1) * NODE_SPACING_X;
  const height = sorted.length * NODE_SPACING_Y;

  return { nodes, edges, width, height };
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Kahn's algorithm でトポロジカルソート。
 * 子ノード（parentIdsで参照される側ではなく、参照する側）を先に出力する。
 * つまり新しいCommitが上（先）に来る。
 */
function topologicalSort(
  commits: Commit[],
  commitMap: Map<ObjectId, Commit>
): Commit[] {
  // Build child→parent adjacency and in-degree (number of children pointing to this commit)
  // We want children first, so we reverse the DAG direction:
  // "in-degree" = number of children that reference this commit as parent
  const childrenOf = new Map<ObjectId, ObjectId[]>(); // parent → children
  const inDegree = new Map<ObjectId, number>(); // how many children point to this node

  for (const c of commits) {
    if (!childrenOf.has(c.id)) childrenOf.set(c.id, []);
    if (!inDegree.has(c.id)) inDegree.set(c.id, 0);

    for (const pid of c.parentIds) {
      if (!commitMap.has(pid)) continue;
      if (!childrenOf.has(pid)) childrenOf.set(pid, []);
      childrenOf.get(pid)!.push(c.id);
      inDegree.set(c.id, (inDegree.get(c.id) ?? 0) + 1);
    }
  }

  // Start with root commits (no parents in the graph → in-degree 0 from reversed perspective)
  // Actually we want LEAF commits first (commits with no children).
  // Leaf = commits that no other commit references as parent = in-degree 0 in childrenOf sense.
  // Wait, let me reconsider. We want newest first (children before parents).
  // In the original DAG: child → parent (child has parentIds).
  // We want topological order where children come before parents.
  // So we use the original direction: edges go from child to parent.
  // In-degree in original direction = number of parents a commit has.
  // Nodes with in-degree 0 = root commits (no parents).
  // But we want REVERSE topological order (children first), so we need to
  // reverse: use edges from parent to child, and start from leaves.

  // Let me redo this properly:
  // We want children before parents. So treat edges as parent→child.
  // In-degree = number of parents pointing to this child = number of children this commit has.
  // Hmm, let's think differently.

  // Original DAG edges: child --parentOf--> parent
  // We want order: children first, parents later.
  // This is reverse topological order of the original DAG.
  // Equivalently, topological order of the reversed DAG (parent→child).

  // Reversed DAG: parent --childOf--> child
  // In reversed DAG, in-degree of a node = number of parents it has (= parentIds.length within graph)
  // Nodes with in-degree 0 in reversed DAG = root commits (no parents)

  // But that gives parents first! We want children first.
  // So: topological order of original DAG (child→parent), in-degree = # children pointing to you.

  // Reset and redo properly
  const inDeg = new Map<ObjectId, number>();
  for (const c of commits) {
    if (!inDeg.has(c.id)) inDeg.set(c.id, 0);
  }

  // Original edges: child → parent. In-degree = number of children.
  for (const c of commits) {
    for (const pid of c.parentIds) {
      if (!commitMap.has(pid)) continue;
      inDeg.set(pid, (inDeg.get(pid) ?? 0) + 1);
    }
  }

  // Queue starts with nodes that have no children (leaf commits) = in-degree 0
  const queue: Commit[] = [];
  for (const c of commits) {
    if (inDeg.get(c.id) === 0) {
      queue.push(c);
    }
  }

  const result: Commit[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    // "Remove" this node: decrement in-degree of its parents
    for (const pid of node.parentIds) {
      if (!commitMap.has(pid)) continue;
      const newDeg = (inDeg.get(pid) ?? 1) - 1;
      inDeg.set(pid, newDeg);
      if (newDeg === 0) {
        queue.push(commitMap.get(pid)!);
      }
    }
  }

  return result;
}

/**
 * Branch列の水平位置を割り当てる。
 *
 * 戦略（トポロジカル順 = 子が先に処理される）:
 * - 最初の子から継承した親は同じ列
 * - Merge Commitの2番目以降の親は新しい列を割り当て（分岐を表現）
 */
function assignColumns(
  sorted: Commit[],
  commitMap: Map<ObjectId, Commit>
): Map<ObjectId, number> {
  const columnOf = new Map<ObjectId, number>();
  // 各親に対して「最初に列を継承させた子」を記録
  const parentClaimedBy = new Map<ObjectId, ObjectId>();
  let nextColumn = 0;

  for (const commit of sorted) {
    // まだ列が割り当てられていなければ新しい列を確保
    if (!columnOf.has(commit.id)) {
      columnOf.set(commit.id, nextColumn++);
    }

    const myCol = columnOf.get(commit.id)!;

    commit.parentIds.forEach((pid, idx) => {
      if (!commitMap.has(pid)) return;

      if (!columnOf.has(pid)) {
        if (idx === 0 && !parentClaimedBy.has(pid)) {
          // 最初の親 → 自分の列を継承させる（直線チェーン）
          columnOf.set(pid, myCol);
          parentClaimedBy.set(pid, commit.id);
        } else {
          // 2番目以降の親（Merge Commitの場合）→ 新しい列
          columnOf.set(pid, nextColumn++);
          parentClaimedBy.set(pid, commit.id);
        }
      }
    });
  }

  return columnOf;
}

/**
 * RefStore から commitId → branchNames[] のマッピングを構築する
 */
function buildBranchMap(refStore: RefStore): Map<ObjectId, string[]> {
  const map = new Map<ObjectId, string[]>();
  const branches = refStore.getAllBranches();

  for (const [name, commitId] of branches) {
    if (!map.has(commitId)) {
      map.set(commitId, []);
    }
    map.get(commitId)!.push(name);
  }

  return map;
}

/**
 * HEAD が指す Commit ID を解決する
 */
function resolveHeadCommitId(
  head: ReturnType<RefStore["getHead"]>,
  refStore: RefStore
): ObjectId | null {
  if (head.type === "detached") {
    return head.commitId;
  }
  return refStore.getBranch(head.name) ?? null;
}
