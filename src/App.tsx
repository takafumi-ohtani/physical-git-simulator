import { SimulatorProvider, useSimulator } from "./state/context";
import { CommandPanel } from "./ui/components/CommandPanel";
import { DAGGraphView } from "./ui/components/DAGGraphView";
import { DetailPanel } from "./ui/components/DetailPanel";
import { ConflictResolver } from "./ui/components/ConflictResolver";
import type { IdMode } from "./core/types";
import "./App.css";

// =============================================================================
// Design colors
// =============================================================================

const COLORS = {
  blob: "#3B82F6",
  tree: "#10B981",
  commit: "#F59E0B",
  branch: "#8B5CF6",
  head: "#EF4444",
  bg: "#F9FAFB",
  border: "#E5E7EB",
  text: "#1F2937",
  muted: "#6B7280",
} as const;

// =============================================================================
// ID Mode labels
// =============================================================================

const ID_MODE_OPTIONS: { value: IdMode; label: string }[] = [
  { value: "sequential", label: "連番" },
  { value: "pseudo-hash", label: "疑似ハッシュ" },
];

// =============================================================================
// Header
// =============================================================================

function Header() {
  const { state, dispatch } = useSimulator();

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        height: 48,
        borderBottom: `1px solid ${COLORS.border}`,
        background: "#fff",
        flexShrink: 0,
      }}
    >
      {/* Title */}
      <h1 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, margin: 0 }}>
        物理Gitシミュレータ
      </h1>

      {/* ID Mode Selector + Notifications */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Error / Notification */}
        {state.errorMessage && (
          <span
            role="alert"
            style={{
              fontSize: 12,
              color: COLORS.head,
              background: "#FEF2F2",
              padding: "2px 8px",
              borderRadius: 4,
              maxWidth: 300,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
            title={state.errorMessage}
            onClick={() => dispatch({ type: "DISMISS_MESSAGE" })}
          >
            ⚠ {state.errorMessage}
            <span style={{ fontSize: 10, opacity: 0.6 }}>✕</span>
          </span>
        )}
        {state.notification && !state.errorMessage && (
          <span
            role="status"
            style={{
              fontSize: 12,
              color: COLORS.tree,
              background: "#F0FDF4",
              padding: "2px 8px",
              borderRadius: 4,
              maxWidth: 300,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
            title={state.notification}
            onClick={() => dispatch({ type: "DISMISS_MESSAGE" })}
          >
            ℹ {state.notification}
            <span style={{ fontSize: 10, opacity: 0.6 }}>✕</span>
          </span>
        )}

        {/* ID Mode Radio Buttons */}
        <fieldset
          style={{
            border: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <legend
            style={{
              fontSize: 11,
              color: COLORS.muted,
              fontWeight: 600,
              padding: 0,
              float: "left",
              marginRight: 8,
            }}
          >
            ID方式:
          </legend>
          {ID_MODE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              style={{
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 3,
                color: state.idMode === opt.value ? COLORS.text : COLORS.muted,
                fontWeight: state.idMode === opt.value ? 600 : 400,
              }}
            >
              <input
                type="radio"
                name="idMode"
                value={opt.value}
                checked={state.idMode === opt.value}
                onChange={() => dispatch({ type: "SET_ID_MODE", mode: opt.value })}
                style={{ margin: 0 }}
              />
              {opt.label}
            </label>
          ))}
        </fieldset>
      </div>
    </header>
  );
}

// =============================================================================
// Legend - オブジェクト種別の凡例
// =============================================================================

const LEGEND_ITEMS: { label: string; color: string; shape: string; category: string }[] = [
  { label: "Blob", color: COLORS.blob, shape: "■", category: "不変オブジェクト" },
  { label: "Tree", color: COLORS.tree, shape: "📁", category: "不変オブジェクト" },
  { label: "Commit", color: COLORS.commit, shape: "●", category: "不変オブジェクト" },
  { label: "Branch", color: COLORS.branch, shape: "🏷", category: "可変参照" },
  { label: "HEAD", color: COLORS.head, shape: "➤", category: "可変参照" },
];

function Legend() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "4px 16px",
        borderTop: `1px solid ${COLORS.border}`,
        background: "#fff",
        fontSize: 12,
        color: COLORS.muted,
        flexShrink: 0,
        height: 32,
      }}
    >
      <span style={{ fontWeight: 600, fontSize: 11 }}>凡例:</span>
      {LEGEND_ITEMS.map((item) => (
        <span
          key={item.label}
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          title={`${item.label} (${item.category})`}
        >
          <span style={{ color: item.color, fontSize: 14 }}>{item.shape}</span>
          <span style={{ color: item.color, fontWeight: 600 }}>{item.label}</span>
          <span style={{ fontSize: 10, color: COLORS.muted }}>({item.category})</span>
        </span>
      ))}
    </div>
  );
}

// =============================================================================
// MainLayout - 3-column layout
// =============================================================================

function MainLayout() {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        overflow: "hidden",
      }}
    >
      {/* Left: CommandPanel ~280px */}
      <div style={{ width: 280, flexShrink: 0, overflow: "hidden" }}>
        <CommandPanel />
      </div>

      {/* Center: DAGGraphView flexible */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          borderLeft: `1px solid ${COLORS.border}`,
          borderRight: `1px solid ${COLORS.border}`,
        }}
      >
        <DAGGraphView />
      </div>

      {/* Right: DetailPanel ~300px */}
      <div style={{ width: 300, flexShrink: 0, overflow: "hidden" }}>
        <DetailPanel />
      </div>
    </div>
  );
}

// =============================================================================
// SimulatorApp - inner app wrapped by provider
// =============================================================================

function SimulatorApp() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <Header />
      <MainLayout />
      <Legend />
      <ConflictResolver />
    </div>
  );
}

// =============================================================================
// App - top-level with SimulatorProvider
// =============================================================================

function App() {
  return (
    <SimulatorProvider>
      <SimulatorApp />
    </SimulatorProvider>
  );
}

export default App;
