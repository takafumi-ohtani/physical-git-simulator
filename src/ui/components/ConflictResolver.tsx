import { useState } from "react";
import { useSimulator } from "../../state/context";
import { computeDiff, type DiffLine } from "../../core/diff";
import type { ConflictEntry, ResolveChoice } from "../../core/types";

// =============================================================================
// ConflictResolver - Conflict解決UI（モーダル/オーバーレイ）
// 要件: 8.1, 8.2, 8.3, 8.4, 8.5, 15.1, 15.2
// =============================================================================

/** 差分行の背景色を返す */
function diffBgColor(type: DiffLine["type"]): string {
  switch (type) {
    case "added":
      return "#dcfce7"; // green bg
    case "deleted":
      return "#fee2e2"; // red bg
    default:
      return "transparent";
  }
}

// ---------------------------------------------------------------------------
// DiffHighlight - 差分行の色分け強調表示
// ---------------------------------------------------------------------------

function DiffHighlight({ oldText, newText }: { oldText: string; newText: string }) {
  const lines = computeDiff(oldText, newText);
  return (
    <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: "1.6" }}>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            backgroundColor: diffBgColor(line.type),
            padding: "0 4px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {line.type === "added" ? "+ " : line.type === "deleted" ? "- " : "  "}
          {line.content}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThreeWayView - Ancestor / Ours / Theirs 3カラム並列表示
// ---------------------------------------------------------------------------

function ThreeWayView({ conflict }: { conflict: ConflictEntry }) {
  const ancestorText = conflict.ancestor ?? "";
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{ margin: "0 0 4px", fontSize: 13 }}>Ancestor</h4>
        <div
          style={{
            border: "1px solid #ccc",
            borderRadius: 4,
            padding: 6,
            maxHeight: 200,
            overflow: "auto",
            background: "#fafafa",
          }}
        >
          <DiffHighlight oldText="" newText={ancestorText} />
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{ margin: "0 0 4px", fontSize: 13, color: "#2563eb" }}>
          Ours (HEAD)
        </h4>
        <div
          style={{
            border: "1px solid #93c5fd",
            borderRadius: 4,
            padding: 6,
            maxHeight: 200,
            overflow: "auto",
            background: "#eff6ff",
          }}
        >
          <DiffHighlight oldText={ancestorText} newText={conflict.ours} />
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{ margin: "0 0 4px", fontSize: 13, color: "#d97706" }}>
          Theirs (Source)
        </h4>
        <div
          style={{
            border: "1px solid #fcd34d",
            borderRadius: 4,
            padding: 6,
            maxHeight: 200,
            overflow: "auto",
            background: "#fffbeb",
          }}
        >
          <DiffHighlight oldText={ancestorText} newText={conflict.theirs} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResolveActions - Ours / Theirs / Manual 解決ボタン
// ---------------------------------------------------------------------------

function ResolveActions({
  onResolve,
  resolved,
}: {
  onResolve: (choice: ResolveChoice) => void;
  resolved: boolean;
}) {
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState("");

  if (resolved) {
    return (
      <span style={{ color: "#16a34a", fontWeight: "bold", fontSize: 13 }}>
        ✓ 解決済み
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={() => onResolve("ours")}
          style={{
            padding: "4px 12px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Ours 採用
        </button>
        <button
          onClick={() => onResolve("theirs")}
          style={{
            padding: "4px 12px",
            background: "#d97706",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Theirs 採用
        </button>
        <button
          onClick={() => setManualMode((v) => !v)}
          style={{
            padding: "4px 12px",
            background: manualMode ? "#6b7280" : "#4b5563",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          手動解決
        </button>
      </div>

      {manualMode && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="解決後の内容を入力..."
            rows={5}
            style={{
              fontFamily: "monospace",
              fontSize: 12,
              padding: 6,
              border: "1px solid #ccc",
              borderRadius: 4,
              resize: "vertical",
            }}
          />
          <button
            onClick={() => {
              if (manualText.trim()) {
                onResolve({ manual: manualText });
              }
            }}
            disabled={!manualText.trim()}
            style={{
              alignSelf: "flex-start",
              padding: "4px 12px",
              background: manualText.trim() ? "#16a34a" : "#d1d5db",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: manualText.trim() ? "pointer" : "not-allowed",
              fontSize: 12,
            }}
          >
            手動解決を適用
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConflictItem - 個別Conflictの表示
// ---------------------------------------------------------------------------

function ConflictItem({
  conflict,
  isResolved,
  onResolve,
}: {
  conflict: ConflictEntry;
  isResolved: boolean;
  onResolve: (choice: ResolveChoice) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        padding: 12,
        marginBottom: 12,
        background: isResolved ? "#f0fdf4" : "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <strong style={{ fontSize: 14 }}>{conflict.path}</strong>
        <ResolveActions onResolve={onResolve} resolved={isResolved} />
      </div>
      <ThreeWayView conflict={conflict} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConflictResolver - メインコンポーネント（モーダル/オーバーレイ）
// ---------------------------------------------------------------------------

export function ConflictResolver() {
  const { state, dispatch } = useSimulator();
  const [mergeMessage, setMergeMessage] = useState("");

  // mergeState が null または conflicts が空なら表示しない
  if (!state.mergeState || state.mergeState.conflicts.length === 0) {
    return null;
  }

  const { conflicts, resolved, sourceBranch, targetBranch } = state.mergeState;
  const allResolved = conflicts.every((c) => resolved.has(c.path));

  const handleResolve = (path: string, choice: ResolveChoice) => {
    dispatch({ type: "RESOLVE_CONFLICT", path, choice });
  };

  const handleCompleteMerge = () => {
    const msg =
      mergeMessage.trim() ||
      `Merge branch '${sourceBranch}' into ${targetBranch}`;
    dispatch({ type: "COMPLETE_MERGE", message: msg });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: 20,
          width: "90vw",
          maxWidth: 960,
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        }}
      >
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Conflict 解決</h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>
          {sourceBranch} → {targetBranch} ・ {conflicts.length} 件の Conflict
          （{resolved.size} / {conflicts.length} 解決済み）
        </p>

        {conflicts.map((conflict) => (
          <ConflictItem
            key={conflict.path}
            conflict={conflict}
            isResolved={resolved.has(conflict.path)}
            onResolve={(choice) => handleResolve(conflict.path, choice)}
          />
        ))}

        {allResolved && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              border: "1px solid #86efac",
              borderRadius: 6,
              background: "#f0fdf4",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              type="text"
              value={mergeMessage}
              onChange={(e) => setMergeMessage(e.target.value)}
              placeholder={`Merge branch '${sourceBranch}' into ${targetBranch}`}
              style={{
                flex: 1,
                padding: "6px 8px",
                border: "1px solid #ccc",
                borderRadius: 4,
                fontSize: 13,
              }}
            />
            <button
              onClick={handleCompleteMerge}
              style={{
                padding: "6px 16px",
                background: "#16a34a",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              Complete Merge
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
