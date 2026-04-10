import { describe, it, expect } from "vitest";
import {
  calculateDAGLayout,
  NODE_SPACING_X,
  NODE_SPACING_Y,
} from "../dag-layout";
import { ObjectStore } from "../../core/object-store";
import { RefStore } from "../../core/ref-store";
import { IDGenerator } from "../../core/id-generator";

function createStores() {
  const idGen = new IDGenerator();
  const objectStore = new ObjectStore(idGen);
  const refStore = new RefStore(objectStore);
  return { objectStore, refStore };
}

describe("calculateDAGLayout", () => {
  it("returns empty layout when no commits exist", () => {
    const { objectStore, refStore } = createStores();
    const layout = calculateDAGLayout(objectStore, refStore);

    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.width).toBe(0);
    expect(layout.height).toBe(0);
  });

  it("lays out a single commit", () => {
    const { objectStore, refStore } = createStores();
    const { blob } = objectStore.addBlob("hello");
    const tree = objectStore.addTree([{ name: "file.txt", objectId: blob.id }]);
    const commit = objectStore.addCommit(tree.id, [], "initial");
    refStore.createBranch("main", commit.id);
    refStore.checkoutBranch("main");

    const layout = calculateDAGLayout(objectStore, refStore);

    expect(layout.nodes).toHaveLength(1);
    expect(layout.nodes[0].commitId).toBe(commit.id);
    expect(layout.nodes[0].x).toBe(0);
    expect(layout.nodes[0].y).toBe(0);
    expect(layout.nodes[0].branchNames).toContain("main");
    expect(layout.nodes[0].isHead).toBe(true);
    expect(layout.edges).toHaveLength(0);
  });

  it("lays out a linear chain (child before parent)", () => {
    const { objectStore, refStore } = createStores();
    const { blob } = objectStore.addBlob("v1");
    const tree = objectStore.addTree([{ name: "f.txt", objectId: blob.id }]);
    const c1 = objectStore.addCommit(tree.id, [], "first");
    const c2 = objectStore.addCommit(tree.id, [c1.id], "second");
    const c3 = objectStore.addCommit(tree.id, [c2.id], "third");
    refStore.createBranch("main", c3.id);
    refStore.checkoutBranch("main");

    const layout = calculateDAGLayout(objectStore, refStore);

    expect(layout.nodes).toHaveLength(3);

    // Topological order: newest first (c3, c2, c1)
    expect(layout.nodes[0].commitId).toBe(c3.id);
    expect(layout.nodes[1].commitId).toBe(c2.id);
    expect(layout.nodes[2].commitId).toBe(c1.id);

    // All on same column (linear chain)
    expect(layout.nodes[0].x).toBe(layout.nodes[1].x);
    expect(layout.nodes[1].x).toBe(layout.nodes[2].x);

    // y increases with index
    expect(layout.nodes[0].y).toBe(0);
    expect(layout.nodes[1].y).toBe(NODE_SPACING_Y);
    expect(layout.nodes[2].y).toBe(2 * NODE_SPACING_Y);
  });

  it("calculates parent-child edges", () => {
    const { objectStore, refStore } = createStores();
    const { blob } = objectStore.addBlob("data");
    const tree = objectStore.addTree([{ name: "a.txt", objectId: blob.id }]);
    const c1 = objectStore.addCommit(tree.id, [], "root");
    const c2 = objectStore.addCommit(tree.id, [c1.id], "child");
    refStore.createBranch("main", c2.id);

    const layout = calculateDAGLayout(objectStore, refStore);

    expect(layout.edges).toHaveLength(1);
    expect(layout.edges[0]).toEqual({ from: c2.id, to: c1.id });
  });

  it("assigns different columns for branches", () => {
    const { objectStore, refStore } = createStores();
    const { blob } = objectStore.addBlob("base");
    const tree = objectStore.addTree([{ name: "f.txt", objectId: blob.id }]);
    const root = objectStore.addCommit(tree.id, [], "root");

    // Two branches diverging from root
    const left = objectStore.addCommit(tree.id, [root.id], "left");
    const right = objectStore.addCommit(tree.id, [root.id], "right");

    refStore.createBranch("main", left.id);
    refStore.createBranch("feature", right.id);

    const layout = calculateDAGLayout(objectStore, refStore);

    expect(layout.nodes).toHaveLength(3);

    const leftNode = layout.nodes.find((n) => n.commitId === left.id)!;
    const rightNode = layout.nodes.find((n) => n.commitId === right.id)!;

    // Diverging commits should be on different columns
    expect(leftNode.x).not.toBe(rightNode.x);
  });

  it("marks HEAD commit correctly", () => {
    const { objectStore, refStore } = createStores();
    const { blob } = objectStore.addBlob("x");
    const tree = objectStore.addTree([{ name: "x.txt", objectId: blob.id }]);
    const c1 = objectStore.addCommit(tree.id, [], "first");
    const c2 = objectStore.addCommit(tree.id, [c1.id], "second");
    refStore.createBranch("main", c2.id);
    refStore.checkoutBranch("main");

    const layout = calculateDAGLayout(objectStore, refStore);

    const headNode = layout.nodes.find((n) => n.isHead);
    expect(headNode).toBeDefined();
    expect(headNode!.commitId).toBe(c2.id);

    const nonHeadNode = layout.nodes.find((n) => !n.isHead);
    expect(nonHeadNode).toBeDefined();
    expect(nonHeadNode!.commitId).toBe(c1.id);
  });

  it("handles detached HEAD", () => {
    const { objectStore, refStore } = createStores();
    const { blob } = objectStore.addBlob("d");
    const tree = objectStore.addTree([{ name: "d.txt", objectId: blob.id }]);
    const c1 = objectStore.addCommit(tree.id, [], "first");
    const c2 = objectStore.addCommit(tree.id, [c1.id], "second");
    refStore.createBranch("main", c2.id);
    refStore.checkoutCommit(c1.id); // Detached HEAD at c1

    const layout = calculateDAGLayout(objectStore, refStore);

    const headNode = layout.nodes.find((n) => n.isHead);
    expect(headNode).toBeDefined();
    expect(headNode!.commitId).toBe(c1.id);
  });

  it("attaches branch names to correct nodes", () => {
    const { objectStore, refStore } = createStores();
    const { blob } = objectStore.addBlob("b");
    const tree = objectStore.addTree([{ name: "b.txt", objectId: blob.id }]);
    const c1 = objectStore.addCommit(tree.id, [], "root");
    const c2 = objectStore.addCommit(tree.id, [c1.id], "tip");
    refStore.createBranch("main", c2.id);
    refStore.createBranch("dev", c1.id);

    const layout = calculateDAGLayout(objectStore, refStore);

    const c1Node = layout.nodes.find((n) => n.commitId === c1.id)!;
    const c2Node = layout.nodes.find((n) => n.commitId === c2.id)!;

    expect(c2Node.branchNames).toContain("main");
    expect(c1Node.branchNames).toContain("dev");
  });

  it("handles merge commit with two parents", () => {
    const { objectStore, refStore } = createStores();
    const { blob } = objectStore.addBlob("m");
    const tree = objectStore.addTree([{ name: "m.txt", objectId: blob.id }]);
    const root = objectStore.addCommit(tree.id, [], "root");
    const left = objectStore.addCommit(tree.id, [root.id], "left");
    const right = objectStore.addCommit(tree.id, [root.id], "right");
    const merge = objectStore.addCommit(tree.id, [left.id, right.id], "merge");
    refStore.createBranch("main", merge.id);

    const layout = calculateDAGLayout(objectStore, refStore);

    expect(layout.nodes).toHaveLength(4);

    // Merge commit should have edges to both parents
    const mergeEdges = layout.edges.filter((e) => e.from === merge.id);
    expect(mergeEdges).toHaveLength(2);
    const targets = mergeEdges.map((e) => e.to).sort();
    expect(targets).toEqual([left.id, right.id].sort());
  });

  it("calculates correct width and height", () => {
    const { objectStore, refStore } = createStores();
    const { blob } = objectStore.addBlob("s");
    const tree = objectStore.addTree([{ name: "s.txt", objectId: blob.id }]);
    const c1 = objectStore.addCommit(tree.id, [], "root");
    const c2 = objectStore.addCommit(tree.id, [c1.id], "child");
    refStore.createBranch("main", c2.id);

    const layout = calculateDAGLayout(objectStore, refStore);

    // 2 nodes, single column
    expect(layout.height).toBe(2 * NODE_SPACING_Y);
    expect(layout.width).toBe(NODE_SPACING_X);
  });
});
