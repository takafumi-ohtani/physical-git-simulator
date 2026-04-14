import { useState } from "react";
import { useSimulator } from "../../state/context";
import type { ObjectId, TreeEntry, GitObject, BlobWord1, BlobWord2, BlobContent } from "../../core/types";
import { BLOB_WORD1, BLOB_WORD2 } from "../../core/types";

// =============================================================================
// CommandPanel - 操作パネル（左サイドバー）
// =============================================================================

/** Design color scheme */
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

const sectionStyle: React.CSSProperties = {
  borderBottom: `1px solid ${COLORS.border}`,
  padding: "8px 12px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  cursor: "pointer",
  userSelect: "none",
  fontWeight: 600,
  fontSize: 13,
  color: COLORS.text,
  padding: "4px 0",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "4px 6px",
  fontSize: 12,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 4,
  boxSizing: "border-box",
  fontFamily: "monospace",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  minHeight: 48,
};

const btnStyle: React.CSSProperties = {
  padding: "4px 10px",
  fontSize: 12,
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  color: "white",
  fontWeight: 600,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: COLORS.muted,
  marginBottom: 2,
  display: "block",
};

const fieldGap: React.CSSProperties = { marginTop: 6 };

// =============================================================================
// Collapsible Section wrapper
// =============================================================================

function Section({
  title,
  color,
  children,
  defaultOpen = false,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={sectionStyle}>
      <div style={headerStyle} onClick={() => setOpen(!open)}>
        <span>
          <span style={{ color, marginRight: 6 }}>●</span>
          {title}
        </span>
        <span style={{ fontSize: 10, color: COLORS.muted }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && <div style={{ padding: "6px 0" }}>{children}</div>}
    </div>
  );
}


// =============================================================================
// ContentMatrix - 4×4グリッドでBlobの登録状況を表示
// =============================================================================

function ContentMatrix({
  selectedWord1,
  selectedWord2,
  existingBlobId,
}: {
  selectedWord1: BlobWord1;
  selectedWord2: BlobWord2;
  existingBlobId: string | null;
}) {
  const { state } = useSimulator();

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>
        Content Matrix（コンテンツアドレス空間）
      </div>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 10 }}>
        <thead>
          <tr>
            <th style={{ padding: "2px 4px", color: COLORS.muted, fontWeight: 400 }}></th>
            {BLOB_WORD2.map((w2) => (
              <th key={w2} style={{ padding: "2px 4px", color: COLORS.muted, fontWeight: 600, textAlign: "center" }}>
                {w2}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BLOB_WORD1.map((w1) => (
            <tr key={w1}>
              <td style={{ padding: "2px 4px", color: COLORS.muted, fontWeight: 600, whiteSpace: "nowrap" }}>
                {w1}
              </td>
              {BLOB_WORD2.map((w2) => {
                const content = `${w1}-${w2}`;
                const blob = state.objectStore.findBlobByContent(content);
                const isSelected = w1 === selectedWord1 && w2 === selectedWord2;
                const isExisting = isSelected && existingBlobId !== null;

                let bg = "#F9FAFB";
                let border = `1px solid ${COLORS.border}`;
                if (blob) bg = "#DBEAFE"; // 登録済み: 薄青
                if (isSelected && !isExisting) bg = "#FEF9C3"; // 選択中（未登録）: 薄黄
                if (isExisting) {
                  bg = "#FEE2E2"; // 重複選択: 薄赤
                  border = `2px solid #EF4444`;
                }

                return (
                  <td
                    key={w2}
                    style={{
                      padding: "3px 2px",
                      border,
                      background: bg,
                      textAlign: "center",
                      minWidth: 36,
                      fontFamily: "monospace",
                      color: blob ? COLORS.blob : COLORS.muted,
                      fontWeight: blob ? 600 : 400,
                    }}
                    title={blob ? `ID: ${blob.id}` : content}
                  >
                    {blob ? blob.id : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// BlobCreator - 2ワード選択 → CREATE_BLOB
// =============================================================================

function BlobCreator() {
  const { state, dispatch } = useSimulator();
  const [word1, setWord1] = useState<BlobWord1>(BLOB_WORD1[0]);
  const [word2, setWord2] = useState<BlobWord2>(BLOB_WORD2[0]);

  const content: BlobContent = `${word1}-${word2}`;
  const existingBlob = state.objectStore.findBlobByContent(content);

  const handleCreate = () => {
    if (existingBlob) return;
    dispatch({ type: "CREATE_BLOB", content });
  };

  return (
    <Section title="Blob 作成" color={COLORS.blob}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>形状（1ワード目）</label>
          <select
            style={inputStyle}
            value={word1}
            onChange={(e) => setWord1(e.target.value as BlobWord1)}
          >
            {BLOB_WORD1.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>数字（2ワード目）</label>
          <select
            style={inputStyle}
            value={word2}
            onChange={(e) => setWord2(e.target.value as BlobWord2)}
          >
            {BLOB_WORD2.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
      </div>

      {existingBlob && (
        <div style={{
          marginTop: 6,
          padding: "4px 8px",
          background: "#FEE2E2",
          border: "1px solid #FCA5A5",
          borderRadius: 4,
          fontSize: 11,
          color: "#DC2626",
        }}>
          この内容のBlobはすでに登録済みです（ID: {existingBlob.id}）
        </div>
      )}

      <ContentMatrix
        selectedWord1={word1}
        selectedWord2={word2}
        existingBlobId={existingBlob?.id ?? null}
      />

      <div style={{ ...fieldGap, textAlign: "right" }}>
        <button
          style={{ ...btnStyle, background: existingBlob ? COLORS.muted : COLORS.blob }}
          onClick={handleCreate}
          disabled={!!existingBlob}
        >
          Blob 作成
        </button>
      </div>
    </Section>
  );
}

// =============================================================================
// TreeCreator - エントリ追加UI → CREATE_TREE
// =============================================================================

function TreeCreator() {
  const { state, dispatch } = useSimulator();
  const [entries, setEntries] = useState<{ name: string; objectId: string }[]>([
    { name: "", objectId: "" },
  ]);

  const updateEntry = (idx: number, field: "name" | "objectId", value: string) => {
    const next = entries.map((e, i) => (i === idx ? { ...e, [field]: value } : e));
    setEntries(next);
  };

  const addEntry = () => setEntries([...entries, { name: "", objectId: "" }]);

  const removeEntry = (idx: number) => {
    if (entries.length <= 1) return;
    setEntries(entries.filter((_, i) => i !== idx));
  };

  const handleCreate = () => {
    const valid = entries.filter((e) => e.name && e.objectId);
    if (valid.length === 0) return;
    const treeEntries: TreeEntry[] = valid.map((e) => ({
      name: e.name,
      objectId: e.objectId,
    }));
    dispatch({ type: "CREATE_TREE", entries: treeEntries });
    setEntries([{ name: "", objectId: "" }]);
  };

  // Collect available objects (blobs + trees) for reference
  const availableObjects: GitObject[] = [
    ...state.objectStore.getAllByType("blob"),
    ...state.objectStore.getAllByType("tree"),
  ];

  const canCreate = entries.some((e) => e.name && e.objectId);

  return (
    <Section title="Tree 作成" color={COLORS.tree}>
      {entries.map((entry, idx) => (
        <div key={idx} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
          <input
            style={{ ...inputStyle, width: "40%" }}
            value={entry.name}
            onChange={(e) => updateEntry(idx, "name", e.target.value)}
            placeholder="ファイル名"
          />
          <select
            style={{ ...inputStyle, width: "50%" }}
            value={entry.objectId}
            onChange={(e) => updateEntry(idx, "objectId", e.target.value)}
          >
            <option value="">-- 参照先 --</option>
            {availableObjects.map((obj) => (
              <option key={obj.id} value={obj.id}>
                {obj.type}:{obj.id.slice(0, 10)}
              </option>
            ))}
          </select>
          <button
            style={{ ...btnStyle, background: "#DC2626", padding: "4px 6px", fontSize: 10 }}
            onClick={() => removeEntry(idx)}
            disabled={entries.length <= 1}
            title="削除"
          >
            ✕
          </button>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", ...fieldGap }}>
        <button
          style={{ ...btnStyle, background: COLORS.muted }}
          onClick={addEntry}
        >
          + エントリ追加
        </button>
        <button
          style={{ ...btnStyle, background: COLORS.tree }}
          onClick={handleCreate}
          disabled={!canCreate}
        >
          Tree 作成
        </button>
      </div>
    </Section>
  );
}


// =============================================================================
// CommitCreator (低レベル) - Tree ID・親ID・メッセージ → CREATE_COMMIT
// =============================================================================

function CommitCreator() {
  const { state, dispatch } = useSimulator();
  const [treeId, setTreeId] = useState("");
  const [parentIdsStr, setParentIdsStr] = useState("");
  const [message, setMessage] = useState("");

  const trees = state.objectStore.getAllByType("tree");
  const commits = state.objectStore.getAllByType("commit");

  const handleCreate = () => {
    if (!treeId || !message) return;
    const parentIds: ObjectId[] = parentIdsStr
      ? parentIdsStr.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    dispatch({ type: "CREATE_COMMIT", treeId, parentIds, message });
    setTreeId("");
    setParentIdsStr("");
    setMessage("");
  };

  return (
    <Section title="Commit 作成 (低レベル)" color={COLORS.commit}>
      <label style={labelStyle}>Tree ID</label>
      <select style={inputStyle} value={treeId} onChange={(e) => setTreeId(e.target.value)}>
        <option value="">-- Tree を選択 --</option>
        {trees.map((t) => (
          <option key={t.id} value={t.id}>
            {t.id}
          </option>
        ))}
      </select>

      <div style={fieldGap}>
        <label style={labelStyle}>親 Commit IDs (カンマ区切り)</label>
        <select
          style={inputStyle}
          value=""
          onChange={(e) => {
            if (!e.target.value) return;
            const current = parentIdsStr ? parentIdsStr + ", " : "";
            setParentIdsStr(current + e.target.value);
          }}
        >
          <option value="">-- 親 Commit を追加 --</option>
          {commits.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id}
            </option>
          ))}
        </select>
        <input
          style={{ ...inputStyle, marginTop: 4 }}
          value={parentIdsStr}
          onChange={(e) => setParentIdsStr(e.target.value)}
          placeholder="例: commit-1, commit-2"
        />
      </div>

      <div style={fieldGap}>
        <label style={labelStyle}>メッセージ</label>
        <input
          style={inputStyle}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Commitメッセージ"
        />
      </div>

      <div style={{ ...fieldGap, textAlign: "right" }}>
        <button
          style={{ ...btnStyle, background: COLORS.commit, color: COLORS.text }}
          onClick={handleCreate}
          disabled={!treeId || !message}
        >
          Commit 作成
        </button>
      </div>
    </Section>
  );
}

// =============================================================================
// HighLevelCommit - ファイル名+内容 → HIGH_LEVEL_COMMIT
// =============================================================================

function HighLevelCommit() {
  const { dispatch } = useSimulator();
  const [files, setFiles] = useState<{ name: string; content: string }[]>([
    { name: "", content: "" },
  ]);
  const [message, setMessage] = useState("");

  const updateFile = (idx: number, field: "name" | "content", value: string) => {
    const next = files.map((f, i) => (i === idx ? { ...f, [field]: value } : f));
    setFiles(next);
  };

  const addFile = () => setFiles([...files, { name: "", content: "" }]);

  const removeFile = (idx: number) => {
    if (files.length <= 1) return;
    setFiles(files.filter((_, i) => i !== idx));
  };

  const handleCommit = () => {
    const valid = files.filter((f) => f.name && f.content);
    if (valid.length === 0 || !message) return;
    dispatch({ type: "HIGH_LEVEL_COMMIT", files: valid, message });
    setFiles([{ name: "", content: "" }]);
    setMessage("");
  };

  const canCommit = files.some((f) => f.name && f.content) && message;

  return (
    <Section title="Commit (高レベル)" color={COLORS.commit} defaultOpen>
      {files.map((file, idx) => (
        <div key={idx} style={{ marginBottom: 6, padding: 4, background: "#F3F4F6", borderRadius: 4 }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              style={{ ...inputStyle, width: "70%" }}
              value={file.name}
              onChange={(e) => updateFile(idx, "name", e.target.value)}
              placeholder="ファイル名"
            />
            <button
              style={{ ...btnStyle, background: "#DC2626", padding: "4px 6px", fontSize: 10 }}
              onClick={() => removeFile(idx)}
              disabled={files.length <= 1}
              title="削除"
            >
              ✕
            </button>
          </div>
          <textarea
            style={{ ...textareaStyle, marginTop: 4 }}
            value={file.content}
            onChange={(e) => updateFile(idx, "content", e.target.value)}
            placeholder="ファイル内容"
          />
        </div>
      ))}
      <button style={{ ...btnStyle, background: COLORS.muted, marginBottom: 6 }} onClick={addFile}>
        + ファイル追加
      </button>

      <div style={fieldGap}>
        <label style={labelStyle}>メッセージ</label>
        <input
          style={inputStyle}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Commitメッセージ"
        />
      </div>

      <div style={{ ...fieldGap, textAlign: "right" }}>
        <button
          style={{ ...btnStyle, background: COLORS.commit, color: COLORS.text }}
          onClick={handleCommit}
          disabled={!canCommit}
        >
          Commit
        </button>
      </div>
    </Section>
  );
}


// =============================================================================
// BranchManager - Branch作成・移動UI
// =============================================================================

function BranchManager() {
  const { state, dispatch } = useSimulator();
  const [branchName, setBranchName] = useState("");
  const [commitId, setCommitId] = useState("");
  const [moveBranch, setMoveBranch] = useState("");
  const [moveCommitId, setMoveCommitId] = useState("");

  const commits = state.objectStore.getAllByType("commit");
  const branches = state.refStore.getAllBranches();

  const handleCreate = () => {
    if (!branchName || !commitId) return;
    dispatch({ type: "CREATE_BRANCH", name: branchName, commitId });
    setBranchName("");
    setCommitId("");
  };

  const handleMove = () => {
    if (!moveBranch || !moveCommitId) return;
    dispatch({ type: "MOVE_BRANCH", name: moveBranch, commitId: moveCommitId });
    setMoveBranch("");
    setMoveCommitId("");
  };

  return (
    <Section title="Branch 管理" color={COLORS.branch}>
      {/* Create */}
      <label style={labelStyle}>新規 Branch 名</label>
      <input
        style={inputStyle}
        value={branchName}
        onChange={(e) => setBranchName(e.target.value)}
        placeholder="feature-x"
      />
      <div style={fieldGap}>
        <label style={labelStyle}>参照先 Commit</label>
        <select style={inputStyle} value={commitId} onChange={(e) => setCommitId(e.target.value)}>
          <option value="">-- Commit を選択 --</option>
          {commits.map((c) => (
            <option key={c.id} value={c.id}>{c.id}</option>
          ))}
        </select>
      </div>
      <div style={{ ...fieldGap, textAlign: "right" }}>
        <button
          style={{ ...btnStyle, background: COLORS.branch }}
          onClick={handleCreate}
          disabled={!branchName || !commitId}
        >
          Branch 作成
        </button>
      </div>

      {/* Move */}
      <hr style={{ border: "none", borderTop: `1px dashed ${COLORS.border}`, margin: "8px 0" }} />
      <label style={labelStyle}>移動する Branch</label>
      <select style={inputStyle} value={moveBranch} onChange={(e) => setMoveBranch(e.target.value)}>
        <option value="">-- Branch を選択 --</option>
        {Array.from(branches.keys()).map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
      <div style={fieldGap}>
        <label style={labelStyle}>移動先 Commit</label>
        <select style={inputStyle} value={moveCommitId} onChange={(e) => setMoveCommitId(e.target.value)}>
          <option value="">-- Commit を選択 --</option>
          {commits.map((c) => (
            <option key={c.id} value={c.id}>{c.id}</option>
          ))}
        </select>
      </div>
      <div style={{ ...fieldGap, textAlign: "right" }}>
        <button
          style={{ ...btnStyle, background: COLORS.branch }}
          onClick={handleMove}
          disabled={!moveBranch || !moveCommitId}
        >
          Branch 移動
        </button>
      </div>
    </Section>
  );
}

// =============================================================================
// CheckoutPanel - Branch/Commit checkout UI
// =============================================================================

function CheckoutPanel() {
  const { state, dispatch } = useSimulator();
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedCommit, setSelectedCommit] = useState("");

  const branches = state.refStore.getAllBranches();
  const commits = state.objectStore.getAllByType("commit");
  const head = state.refStore.getHead();

  const handleBranchCheckout = () => {
    if (!selectedBranch) return;
    dispatch({ type: "CHECKOUT_BRANCH", name: selectedBranch });
    setSelectedBranch("");
  };

  const handleCommitCheckout = () => {
    if (!selectedCommit) return;
    dispatch({ type: "CHECKOUT_COMMIT", commitId: selectedCommit });
    setSelectedCommit("");
  };

  return (
    <Section title="Checkout" color={COLORS.head}>
      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6 }}>
        HEAD: {head.type === "branch" ? `🔗 ${head.name}` : `⚠️ Detached (${head.commitId})`}
      </div>

      <label style={labelStyle}>Branch Checkout</label>
      <div style={{ display: "flex", gap: 4 }}>
        <select
          style={{ ...inputStyle, flex: 1 }}
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
        >
          <option value="">-- Branch --</option>
          {Array.from(branches.keys()).map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <button
          style={{ ...btnStyle, background: COLORS.head }}
          onClick={handleBranchCheckout}
          disabled={!selectedBranch}
        >
          Checkout
        </button>
      </div>

      <hr style={{ border: "none", borderTop: `1px dashed ${COLORS.border}`, margin: "8px 0" }} />

      <label style={labelStyle}>Commit Checkout (Detached HEAD)</label>
      <div style={{ display: "flex", gap: 4 }}>
        <select
          style={{ ...inputStyle, flex: 1 }}
          value={selectedCommit}
          onChange={(e) => setSelectedCommit(e.target.value)}
        >
          <option value="">-- Commit --</option>
          {commits.map((c) => (
            <option key={c.id} value={c.id}>{c.id}</option>
          ))}
        </select>
        <button
          style={{ ...btnStyle, background: COLORS.head }}
          onClick={handleCommitCheckout}
          disabled={!selectedCommit}
        >
          Checkout
        </button>
      </div>
    </Section>
  );
}


// =============================================================================
// MergePanel - Merge元Branch選択 → START_MERGE
// =============================================================================

function MergePanel() {
  const { state, dispatch } = useSimulator();
  const [sourceBranch, setSourceBranch] = useState("");

  const branches = state.refStore.getAllBranches();
  const head = state.refStore.getHead();
  const isMerging = state.mergeState !== null;

  const handleMerge = () => {
    if (!sourceBranch) return;
    dispatch({ type: "START_MERGE", sourceBranch });
    setSourceBranch("");
  };

  // Filter out current branch from source options
  const availableBranches = Array.from(branches.keys()).filter(
    (name) => !(head.type === "branch" && head.name === name)
  );

  return (
    <Section title="Merge" color={COLORS.commit}>
      {head.type !== "branch" && (
        <div style={{ fontSize: 11, color: COLORS.head, marginBottom: 6 }}>
          ⚠️ Detached HEAD 状態ではMergeできません
        </div>
      )}
      {isMerging && (
        <div style={{ fontSize: 11, color: COLORS.commit, marginBottom: 6 }}>
          ⚠️ Merge進行中 — Conflict解決パネルで解決してください
        </div>
      )}
      <label style={labelStyle}>
        Merge元 Branch → {head.type === "branch" ? head.name : "(detached)"}
      </label>
      <div style={{ display: "flex", gap: 4 }}>
        <select
          style={{ ...inputStyle, flex: 1 }}
          value={sourceBranch}
          onChange={(e) => setSourceBranch(e.target.value)}
          disabled={head.type !== "branch" || isMerging}
        >
          <option value="">-- Branch を選択 --</option>
          {availableBranches.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <button
          style={{ ...btnStyle, background: COLORS.commit, color: COLORS.text }}
          onClick={handleMerge}
          disabled={!sourceBranch || head.type !== "branch" || isMerging}
        >
          Merge
        </button>
      </div>
    </Section>
  );
}

// =============================================================================
// FixPanel - Fix操作UI → FIX_COMMIT
// =============================================================================

function FixPanel() {
  const { dispatch } = useSimulator();
  const [files, setFiles] = useState<{ name: string; content: string }[]>([
    { name: "", content: "" },
  ]);
  const [message, setMessage] = useState("");

  const updateFile = (idx: number, field: "name" | "content", value: string) => {
    const next = files.map((f, i) => (i === idx ? { ...f, [field]: value } : f));
    setFiles(next);
  };

  const addFile = () => setFiles([...files, { name: "", content: "" }]);

  const removeFile = (idx: number) => {
    if (files.length <= 1) return;
    setFiles(files.filter((_, i) => i !== idx));
  };

  const handleFix = () => {
    const valid = files.filter((f) => f.name && f.content);
    if (valid.length === 0 || !message) return;
    dispatch({ type: "FIX_COMMIT", files: valid, message });
    setFiles([{ name: "", content: "" }]);
    setMessage("");
  };

  const canFix = files.some((f) => f.name && f.content) && message;

  return (
    <Section title="Fix (修正Commit)" color={COLORS.head}>
      {files.map((file, idx) => (
        <div key={idx} style={{ marginBottom: 6, padding: 4, background: "#FEF2F2", borderRadius: 4 }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              style={{ ...inputStyle, width: "70%" }}
              value={file.name}
              onChange={(e) => updateFile(idx, "name", e.target.value)}
              placeholder="ファイル名"
            />
            <button
              style={{ ...btnStyle, background: "#DC2626", padding: "4px 6px", fontSize: 10 }}
              onClick={() => removeFile(idx)}
              disabled={files.length <= 1}
              title="削除"
            >
              ✕
            </button>
          </div>
          <textarea
            style={{ ...textareaStyle, marginTop: 4 }}
            value={file.content}
            onChange={(e) => updateFile(idx, "content", e.target.value)}
            placeholder="修正後の内容"
          />
        </div>
      ))}
      <button style={{ ...btnStyle, background: COLORS.muted, marginBottom: 6 }} onClick={addFile}>
        + ファイル追加
      </button>

      <div style={fieldGap}>
        <label style={labelStyle}>修正メッセージ</label>
        <input
          style={inputStyle}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="修正内容の説明"
        />
      </div>

      <div style={{ ...fieldGap, textAlign: "right" }}>
        <button
          style={{ ...btnStyle, background: COLORS.head }}
          onClick={handleFix}
          disabled={!canFix}
        >
          Fix Commit
        </button>
      </div>
    </Section>
  );
}

// =============================================================================
// CommandPanel - メインエクスポート
// =============================================================================

export function CommandPanel() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflowY: "auto",
        background: COLORS.bg,
        borderRight: `1px solid ${COLORS.border}`,
        fontSize: 13,
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          fontWeight: 700,
          fontSize: 14,
          borderBottom: `1px solid ${COLORS.border}`,
          color: COLORS.text,
        }}
      >
        操作パネル
      </div>
      <HighLevelCommit />
      <BlobCreator />
      <TreeCreator />
      <CommitCreator />
      <BranchManager />
      <CheckoutPanel />
      <MergePanel />
      <FixPanel />
    </div>
  );
}
