import { useSimulator } from "../../state/context";
import type { ObjectId, Blob, Tree, Commit, GitObject } from "../../core/types";
import type { StepRecord } from "../../state/types";

// =============================================================================
// DetailPanel - 詳細表示パネル（右サイドバー）
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

const sectionStyle: React.CSSProperties = {
  borderBottom: `1px solid ${COLORS.border}`,
  padding: "8px 12px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 13,
  color: COLORS.text,
  padding: "4px 0",
  marginBottom: 6,
};

const monoStyle: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 12,
};

const idLinkStyle: React.CSSProperties = {
  ...monoStyle,
  color: COLORS.blob,
  cursor: "pointer",
  textDecoration: "underline",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: COLORS.muted,
  marginBottom: 2,
};

// =============================================================================
// ClickableId - クリックで SELECT_OBJECT をディスパッチするID表示
// =============================================================================

function ClickableId({
  objectId,
  color,
  onClick,
}: {
  objectId: ObjectId;
  color?: string;
  onClick: (id: ObjectId) => void;
}) {
  return (
    <span
      style={{ ...idLinkStyle, color: color ?? COLORS.blob }}
      onClick={() => onClick(objectId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick(objectId);
      }}
    >
      {objectId}
    </span>
  );
}

// =============================================================================
// ObjectDetail - 選択されたBlob/Tree/Commitの詳細表示
// =============================================================================

function BlobDetail({
  blob,
  onNavigate,
}: {
  blob: Blob;
  onNavigate: (id: ObjectId) => void;
}) {
  void onNavigate; // Blob has no navigable references
  return (
    <div>
      <div style={{ ...sectionTitleStyle, color: COLORS.blob }}>
        <span style={{ marginRight: 6 }}>●</span>Blob
      </div>
      <div style={{ marginBottom: 6 }}>
        <span style={labelStyle}>ID</span>
        <div style={monoStyle}>{blob.id}</div>
      </div>
      <div>
        <span style={labelStyle}>Content</span>
        <pre
          style={{
            ...monoStyle,
            background: "#F3F4F6",
            padding: "6px 8px",
            borderRadius: 4,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            margin: 0,
          }}
        >
          {blob.content}
        </pre>
      </div>
    </div>
  );
}

function TreeDetail({
  tree,
  objectStore,
  onNavigate,
}: {
  tree: Tree;
  objectStore: { get(id: ObjectId): GitObject | undefined };
  onNavigate: (id: ObjectId) => void;
}) {
  return (
    <div>
      <div style={{ ...sectionTitleStyle, color: COLORS.tree }}>
        <span style={{ marginRight: 6 }}>●</span>Tree
      </div>
      <div style={{ marginBottom: 6 }}>
        <span style={labelStyle}>ID</span>
        <div style={monoStyle}>{tree.id}</div>
      </div>
      <div>
        <span style={labelStyle}>Entries ({tree.entries.length})</span>
        {tree.entries.length === 0 ? (
          <div style={{ ...monoStyle, color: COLORS.muted }}>No entries</div>
        ) : (
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: COLORS.muted, fontSize: 11 }}>
                <th style={{ padding: "2px 4px" }}>Name</th>
                <th style={{ padding: "2px 4px" }}>Type</th>
                <th style={{ padding: "2px 4px" }}>ID</th>
              </tr>
            </thead>
            <tbody>
              {tree.entries.map((entry) => {
                const refObj = objectStore.get(entry.objectId);
                const entryType = refObj?.type ?? "?";
                const entryColor =
                  entryType === "blob"
                    ? COLORS.blob
                    : entryType === "tree"
                      ? COLORS.tree
                      : COLORS.muted;
                return (
                  <tr key={entry.name} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: "3px 4px", fontFamily: "monospace" }}>
                      {entry.name}
                    </td>
                    <td style={{ padding: "3px 4px", color: entryColor, fontWeight: 600 }}>
                      {entryType}
                    </td>
                    <td style={{ padding: "3px 4px" }}>
                      <ClickableId
                        objectId={entry.objectId}
                        color={entryColor}
                        onClick={onNavigate}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CommitDetail({
  commit,
  onNavigate,
}: {
  commit: Commit;
  onNavigate: (id: ObjectId) => void;
}) {
  return (
    <div>
      <div style={{ ...sectionTitleStyle, color: COLORS.commit }}>
        <span style={{ marginRight: 6 }}>●</span>Commit
      </div>
      <div style={{ marginBottom: 6 }}>
        <span style={labelStyle}>ID</span>
        <div style={monoStyle}>{commit.id}</div>
      </div>
      <div style={{ marginBottom: 6 }}>
        <span style={labelStyle}>Message</span>
        <div style={monoStyle}>{commit.message}</div>
      </div>
      <div style={{ marginBottom: 6 }}>
        <span style={labelStyle}>Tree</span>
        <div>
          <ClickableId objectId={commit.treeId} color={COLORS.tree} onClick={onNavigate} />
        </div>
      </div>
      <div>
        <span style={labelStyle}>
          Parents ({commit.parentIds.length})
        </span>
        {commit.parentIds.length === 0 ? (
          <div style={{ ...monoStyle, color: COLORS.muted }}>Initial commit (no parents)</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {commit.parentIds.map((pid) => (
              <ClickableId
                key={pid}
                objectId={pid}
                color={COLORS.commit}
                onClick={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ObjectDetail({
  objectId,
  objectStore,
  onNavigate,
}: {
  objectId: ObjectId;
  objectStore: { get(id: ObjectId): GitObject | undefined };
  onNavigate: (id: ObjectId) => void;
}) {
  const obj = objectStore.get(objectId);
  if (!obj) {
    return (
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Object Detail</div>
        <div style={{ ...monoStyle, color: COLORS.muted }}>
          Object not found: {objectId}
        </div>
      </div>
    );
  }

  return (
    <div style={sectionStyle}>
      {obj.type === "blob" && (
        <BlobDetail blob={obj} onNavigate={onNavigate} />
      )}
      {obj.type === "tree" && (
        <TreeDetail tree={obj} objectStore={objectStore} onNavigate={onNavigate} />
      )}
      {obj.type === "commit" && (
        <CommitDetail commit={obj} onNavigate={onNavigate} />
      )}
    </div>
  );
}

// =============================================================================
// RefList - 全Branch名と参照先Commit ID一覧、HEAD表示
// =============================================================================

function RefList({
  refStore,
  onNavigate,
}: {
  refStore: {
    getAllBranches(): Map<string, ObjectId>;
    getHead(): { type: "branch"; name: string } | { type: "detached"; commitId: ObjectId };
  };
  onNavigate: (id: ObjectId) => void;
}) {
  const branches = refStore.getAllBranches();
  const head = refStore.getHead();

  return (
    <div style={sectionStyle}>
      <div style={sectionTitleStyle}>
        <span style={{ color: COLORS.branch, marginRight: 6 }}>●</span>
        Refs
      </div>

      {/* HEAD */}
      <div style={{ marginBottom: 8 }}>
        <span
          style={{
            display: "inline-block",
            background: COLORS.head,
            color: "white",
            padding: "1px 6px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            marginRight: 6,
          }}
        >
          HEAD
        </span>
        {head.type === "branch" ? (
          <span style={monoStyle}>
            → branch: <strong>{head.name}</strong>
          </span>
        ) : (
          <span style={monoStyle}>
            → detached:{" "}
            <ClickableId objectId={head.commitId} color={COLORS.commit} onClick={onNavigate} />
          </span>
        )}
      </div>

      {/* Branches */}
      {branches.size === 0 ? (
        <div style={{ ...monoStyle, color: COLORS.muted }}>No branches</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {Array.from(branches.entries()).map(([name, commitId]) => {
            const isCurrent = head.type === "branch" && head.name === name;
            return (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    display: "inline-block",
                    background: COLORS.branch,
                    color: "white",
                    padding: "1px 6px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {name}
                </span>
                {isCurrent && (
                  <span style={{ fontSize: 10, color: COLORS.head, fontWeight: 700 }}>
                    (HEAD)
                  </span>
                )}
                <span style={{ fontSize: 11, color: COLORS.muted }}>→</span>
                <ClickableId objectId={commitId} color={COLORS.commit} onClick={onNavigate} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// StepHistory - 操作ステップの履歴表示
// =============================================================================

function StepHistory({ steps }: { steps: StepRecord[] }) {
  if (steps.length === 0) {
    return (
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Step History</div>
        <div style={{ ...monoStyle, color: COLORS.muted }}>No operations yet</div>
      </div>
    );
  }

  return (
    <div style={{ ...sectionStyle, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={sectionTitleStyle}>Step History</div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minHeight: 0,
        }}
      >
        {[...steps].reverse().map((step, i) => {
          const actionColor = getActionColor(step.action);
          return (
            <div
              key={steps.length - 1 - i}
              style={{
                padding: "4px 6px",
                background: "#F3F4F6",
                borderRadius: 4,
                borderLeft: `3px solid ${actionColor}`,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: actionColor }}>
                {step.action}
              </div>
              <div style={{ fontSize: 11, color: COLORS.text }}>{step.description}</div>
              {step.objectsCreated.length > 0 && (
                <div style={{ fontSize: 10, color: COLORS.muted }}>
                  Created: {step.objectsCreated.join(", ")}
                </div>
              )}
              {step.refsUpdated.length > 0 && (
                <div style={{ fontSize: 10, color: COLORS.muted }}>
                  Refs: {step.refsUpdated.join(", ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getActionColor(action: string): string {
  if (action.includes("BLOB")) return COLORS.blob;
  if (action.includes("TREE")) return COLORS.tree;
  if (action.includes("COMMIT")) return COLORS.commit;
  if (action.includes("BRANCH")) return COLORS.branch;
  if (action.includes("CHECKOUT")) return COLORS.head;
  if (action.includes("MERGE") || action.includes("CONFLICT")) return COLORS.branch;
  return COLORS.muted;
}

// =============================================================================
// DetailPanel - メインコンポーネント
// =============================================================================

export function DetailPanel() {
  const { state, dispatch } = useSimulator();

  const handleNavigate = (objectId: ObjectId) => {
    dispatch({ type: "SELECT_OBJECT", objectId });
  };

  return (
    <div
      style={{
        background: COLORS.bg,
        borderLeft: `1px solid ${COLORS.border}`,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Object Detail (shown when an object is selected) */}
      <div style={{ overflowY: "auto", flexShrink: 0 }}>
        {state.selectedObjectId ? (
          <ObjectDetail
            objectId={state.selectedObjectId}
            objectStore={state.objectStore}
            onNavigate={handleNavigate}
          />
        ) : (
          <div style={{ ...sectionStyle, color: COLORS.muted, fontSize: 12 }}>
            Click an object or commit node to view details.
          </div>
        )}

        {/* Ref List */}
        <RefList refStore={state.refStore} onNavigate={handleNavigate} />
      </div>

      {/* Step History - 残りの高さを使い切る */}
      <StepHistory steps={state.stepHistory} />
    </div>
  );
}
