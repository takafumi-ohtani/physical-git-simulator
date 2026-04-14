import { useState } from "react";
import { useSimulator } from "../../state/context";
import type { ConflictEntry, ResolveChoice, BlobContent, BlobWord1, BlobWord2 } from "../../core/types";
import { BLOB_WORD1, BLOB_WORD2 } from "../../core/types";

// =============================================================================
// ConflictResolver - Conflict解決UI（2ワード構造対応）
// 要件: 8.1, 8.2, 8.3, 8.4, 8.5
// =============================================================================

// ---------------------------------------------------------------------------
// BlobWordDisplay - 1ワードを色付きスパンで表示
// ---------------------------------------------------------------------------

function BlobWordDisplay({
  word,
  changed,
}: {
  word: string;
  changed: boolean;
}) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span
        style={{
          padding: "3px 8px",
          borderRadius: 4,
          background: changed ? "#FEE2E2" : "#F3F4F6",
          color: changed ? "#DC2626" : "#374151",
          fontWeight: changed ? 700 : 400,
          fontFamily: "monospace",
          fontSize: 14,
          border: changed ? "1px solid #FCA5A5" : "1px solid #E5E7EB",
        }}
      >
        {word}
      </span>
      {changed && (
        <span style={{ fontSize: 9, color: "#DC2626", fontWeight: 600 }}>↑変更</span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// BlobContentDisplay - "形状-数字" を2ワード分解して表示
// ---------------------------------------------------------------------------

function BlobContentDisplay({
  content,
  ancestor,
  label,
  labelColor,
  borderColor,
  bgColor,
}: {
  content: string;
  ancestor: string;
  label: string;
  labelColor: string;
  borderColor: string;
  bgColor: string;
}) {
  const [w1, w2] = content.split("-");
  const [aw1, aw2] = ancestor.split("-");
  const word1Changed = w1 !== aw1;
  const word2Changed = w2 !== aw2;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: labelColor, marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          border: `1px solid ${borderColor}`,
          borderRadius: 6,
          padding: "10px 8px",
          background: bgColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          minHeight: 56,
        }}
      >
        <BlobWordDisplay word={w1 ?? "?"} changed={word1Changed} />
        <span style={{ color: "#9CA3AF", fontSize: 16 }}>-</span>
        <BlobWordDisplay word={w2 ?? "?"} changed={word2Changed} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContentMatrixPicker - 別のBlobを選ぶ用のContent_Matrix
// ---------------------------------------------------------------------------

function ContentMatrixPicker({
  onSelect,
  onCancel,
}: {
  onSelect: (content: BlobContent) => void;
  onCancel: () => void;
}) {
  const { state, dispatch } = useSimulator();
  const [hoveredContent, setHoveredContent] = useState<BlobContent | null>(null);

  const handleCellClick = (w1: BlobWord1, w2: BlobWord2) => {
    const content: BlobContent = `${w1}-${w2}`;
    const existing = state.objectStore.findBlobByContent(content);
    if (!existing) {
      // 未登録なら先に作成
      dispatch({ type: "CREATE_BLOB", content });
    }
    onSelect(content);
  };

  return (
    <div style={{ marginTop: 8, padding: 10, background: "#F9FAFB", borderRadius: 6, border: "1px solid #E5E7EB" }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
        解決に使うBlobを選んでください
      </div>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ padding: "2px 6px", color: "#6B7280", fontWeight: 400 }}></th>
            {BLOB_WORD2.map((w2) => (
              <th key={w2} style={{ padding: "2px 6px", color: "#6B7280", fontWeight: 600, textAlign: "center" }}>{w2}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BLOB_WORD1.map((w1) => (
            <tr key={w1}>
              <td style={{ padding: "2px 6px", color: "#6B7280", fontWeight: 600, whiteSpace: "nowrap" }}>{w1}</td>
              {BLOB_WORD2.map((w2) => {
                const content: BlobContent = `${w1}-${w2}`;
                const blob = state.objectStore.findBlobByContent(content);
                const isHovered = hoveredContent === content;
                return (
                  <td
                    key={w2}
                    onClick={() => handleCellClick(w1, w2)}
                    onMouseEnter={() => setHoveredContent(content)}
                    onMouseLeave={() => setHoveredContent(null)}
                    style={{
                      padding: "4px 2px",
                      border: "1px solid #E5E7EB",
                      background: isHovered ? "#DBEAFE" : blob ? "#EFF6FF" : "#fff",
                      textAlign: "center",
                      minWidth: 40,
                      cursor: "pointer",
                      fontFamily: "monospace",
                      fontSize: 10,
                      color: blob ? "#2563EB" : "#9CA3AF",
                      fontWeight: blob ? 600 : 400,
                      transition: "background 0.1s",
                    }}
                    title={blob ? `ID: ${blob.id}` : `${content}（新規作成）`}
                  >
                    {blob ? blob.id : content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={onCancel}
        style={{ marginTop: 8, fontSize: 11, padding: "3px 10px", border: "1px solid #E5E7EB", borderRadius: 4, cursor: "pointer", background: "#fff" }}
      >
        キャンセル
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResolveActions - Ours / Theirs / 別のBlobを選ぶ 3択ボタン
// ---------------------------------------------------------------------------

function ResolveActions({
  onResolve,
  resolved,
}: {
  onResolve: (choice: ResolveChoice) => void;
  resolved: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);

  if (resolved) {
    return (
      <span style={{ color: "#16a34a", fontWeight: "bold", fontSize: 13 }}>
        ✓ 解決済み
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          onClick={() => onResolve("ours")}
          style={{ padding: "5px 14px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
        >
          Ours を採用
        </button>
        <button
          onClick={() => onResolve("theirs")}
          style={{ padding: "5px 14px", background: "#D97706", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
        >
          Theirs を採用
        </button>
        <button
          onClick={() => setShowPicker((v) => !v)}
          style={{ padding: "5px 14px", background: showPicker ? "#6B7280" : "#4B5563", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
        >
          別のBlobを選ぶ
        </button>
      </div>
      {showPicker && (
        <ContentMatrixPicker
          onSelect={(content) => {
            onResolve({ manual: content });
            setShowPicker(false);
          }}
          onCancel={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConflictItem - 個別Conflictの表示（ワード単位色分け）
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
  const ancestorText = conflict.ancestor ?? "";

  return (
    <div
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 6,
        padding: 12,
        marginBottom: 12,
        background: isResolved ? "#F0FDF4" : "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <strong style={{ fontSize: 14 }}>{conflict.path}</strong>
      </div>

      {/* 3列並置 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <BlobContentDisplay
          content={ancestorText || "（なし）"}
          ancestor={ancestorText}
          label="Ancestor（共通祖先）"
          labelColor="#6B7280"
          borderColor="#E5E7EB"
          bgColor="#F9FAFB"
        />
        <BlobContentDisplay
          content={conflict.ours}
          ancestor={ancestorText}
          label="Ours（HEAD側）"
          labelColor="#2563EB"
          borderColor="#93C5FD"
          bgColor="#EFF6FF"
        />
        <BlobContentDisplay
          content={conflict.theirs}
          ancestor={ancestorText}
          label="Theirs（相手Branch側）"
          labelColor="#D97706"
          borderColor="#FCD34D"
          bgColor="#FFFBEB"
        />
      </div>

      <ResolveActions onResolve={onResolve} resolved={isResolved} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConflictResolver - メインコンポーネント
// ---------------------------------------------------------------------------

export function ConflictResolver() {
  const { state, dispatch } = useSimulator();
  const [mergeMessage, setMergeMessage] = useState("");

  if (!state.mergeState || state.mergeState.conflicts.length === 0) {
    return null;
  }

  const { conflicts, resolved, sourceBranch, targetBranch } = state.mergeState;
  const allResolved = conflicts.every((c) => resolved.has(c.path));

  const handleResolve = (path: string, choice: ResolveChoice) => {
    dispatch({ type: "RESOLVE_CONFLICT", path, choice });
  };

  const handleCompleteMerge = () => {
    const msg = mergeMessage.trim() || `Merge branch '${sourceBranch}' into ${targetBranch}`;
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
          maxWidth: 900,
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        }}
      >
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Conflict 解決</h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6B7280" }}>
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
              border: "1px solid #86EFAC",
              borderRadius: 6,
              background: "#F0FDF4",
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
              style={{ flex: 1, padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 13 }}
            />
            <button
              onClick={handleCompleteMerge}
              style={{
                padding: "6px 16px",
                background: "#16A34A",
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
