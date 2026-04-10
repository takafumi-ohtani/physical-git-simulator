import { useSimulator } from "../../state/context";
import { calculateDAGLayout, NODE_SPACING_X } from "../dag-layout";
import type { DAGNode, DAGLayout } from "../dag-layout";
import type { ObjectId } from "../../core/types";

// =============================================================================
// DAGGraphView - Commit履歴のDAGグラフをSVG描画
// =============================================================================

/** Design colors */
const COLORS = {
  commit: "#F59E0B",
  branch: "#8B5CF6",
  head: "#EF4444",
  edge: "#6B7280",
  text: "#1F2937",
  bg: "#FAFAFA",
} as const;

const NODE_RADIUS = 30;
const PADDING = 60;
const BRANCH_LABEL_OFFSET_X = 30;
const HEAD_LABEL_OFFSET_Y = -16;

// =============================================================================
// Sub-components
// =============================================================================

function EdgeLine({
  fromNode,
  toNode,
}: {
  fromNode: DAGNode;
  toNode: DAGNode;
}) {
  const x1 = fromNode.x + PADDING;
  const y1 = fromNode.y + PADDING;
  const x2 = toNode.x + PADDING;
  const y2 = toNode.y + PADDING;

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={COLORS.edge}
      strokeWidth={2}
      markerEnd="url(#arrowhead)"
    />
  );
}

function CommitNode({
  node,
  onClick,
}: {
  node: DAGNode;
  onClick: (id: ObjectId) => void;
}) {
  const cx = node.x + PADDING;
  const cy = node.y + PADDING;
  const label = node.commitId.length > 10 ? node.commitId.slice(0, 10) : node.commitId;

  // monospace の1文字幅はおよそ fontSize * 0.6。ノード内径に収まるフォントサイズを算出
  const innerWidth = NODE_RADIUS * 2 * 0.75; // 直径の75%を使う
  const charWidthRatio = 0.6;
  const fontSize = Math.min(11, innerWidth / (label.length * charWidthRatio));

  return (
    <g
      style={{ cursor: "pointer" }}
      onClick={() => onClick(node.commitId)}
      role="button"
      aria-label={`Commit ${node.commitId}`}
    >
      <circle
        cx={cx}
        cy={cy}
        r={NODE_RADIUS}
        fill={COLORS.commit}
        stroke={node.isHead ? COLORS.head : "#D97706"}
        strokeWidth={node.isHead ? 3 : 2}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontFamily="monospace"
        fill={COLORS.text}
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );
}

function BranchLabel({ node }: { node: DAGNode }) {
  if (node.branchNames.length === 0) return null;

  const cx = node.x + PADDING;
  const cy = node.y + PADDING;

  return (
    <>
      {node.branchNames.map((name, i) => {
        const labelX = cx + NODE_RADIUS + BRANCH_LABEL_OFFSET_X;
        const labelY = cy - 8 + i * 20;
        return (
          <g key={name}>
            <rect
              x={labelX - 4}
              y={labelY - 10}
              width={name.length * 7.5 + 8}
              height={18}
              rx={4}
              fill={COLORS.branch}
              opacity={0.9}
            />
            <text
              x={labelX}
              y={labelY}
              fontSize={11}
              fontFamily="monospace"
              fontWeight="bold"
              fill="white"
              dominantBaseline="middle"
            >
              {name}
            </text>
          </g>
        );
      })}
    </>
  );
}

function HeadIndicator({ node }: { node: DAGNode }) {
  if (!node.isHead) return null;

  const cx = node.x + PADDING;
  const cy = node.y + PADDING;
  const labelY = cy - NODE_RADIUS + HEAD_LABEL_OFFSET_Y;

  return (
    <g>
      <text
        x={cx}
        y={labelY}
        textAnchor="middle"
        fontSize={12}
        fontFamily="monospace"
        fontWeight="bold"
        fill={COLORS.head}
      >
        HEAD
      </text>
      <line
        x1={cx}
        y1={labelY + 4}
        x2={cx}
        y2={cy - NODE_RADIUS}
        stroke={COLORS.head}
        strokeWidth={2}
        markerEnd="url(#head-arrow)"
      />
    </g>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function DAGGraphView() {
  const { state, dispatch } = useSimulator();
  const layout: DAGLayout = calculateDAGLayout(state.objectStore, state.refStore);

  const handleNodeClick = (objectId: ObjectId) => {
    dispatch({ type: "SELECT_OBJECT", objectId });
  };

  if (layout.nodes.length === 0) {
    return (
      <div style={{ padding: 24, color: "#9CA3AF", textAlign: "center" }}>
        No commits yet. Create a commit to see the DAG graph.
      </div>
    );
  }

  // Build a lookup map for node positions
  const nodeMap = new Map<ObjectId, DAGNode>();
  for (const node of layout.nodes) {
    nodeMap.set(node.commitId, node);
  }

  const svgWidth = layout.width + PADDING * 2 + NODE_SPACING_X;
  const svgHeight = layout.height + PADDING * 2;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      style={{ background: COLORS.bg, display: "block" }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth={8}
          markerHeight={6}
          refX={8}
          refY={3}
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill={COLORS.edge} />
        </marker>
        <marker
          id="head-arrow"
          markerWidth={8}
          markerHeight={6}
          refX={4}
          refY={3}
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill={COLORS.head} />
        </marker>
      </defs>

      {/* Edges */}
      {layout.edges.map((edge) => {
        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);
        if (!fromNode || !toNode) return null;
        return (
          <EdgeLine
            key={`${edge.from}-${edge.to}`}
            fromNode={fromNode}
            toNode={toNode}
          />
        );
      })}

      {/* Commit nodes */}
      {layout.nodes.map((node) => (
        <CommitNode key={node.commitId} node={node} onClick={handleNodeClick} />
      ))}

      {/* Branch labels */}
      {layout.nodes.map((node) => (
        <BranchLabel key={`branch-${node.commitId}`} node={node} />
      ))}

      {/* HEAD indicator */}
      {layout.nodes.map((node) => (
        <HeadIndicator key={`head-${node.commitId}`} node={node} />
      ))}
    </svg>
  );
}
