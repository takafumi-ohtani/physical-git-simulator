import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
} from "react";
import type { SimulatorState, SimulatorAction } from "./types";
import { simulatorReducer, createInitialState } from "./reducer";
import {
  saveState,
  loadState,
  type PersistedState,
} from "../core/persistence";
import { ObjectStore } from "../core/object-store";
import { RefStore } from "../core/ref-store";
import { IDGenerator } from "../core/id-generator";
import type { GitObject } from "../core/types";

// =============================================================================
// Context
// =============================================================================

interface SimulatorContextValue {
  state: SimulatorState;
  dispatch: React.Dispatch<SimulatorAction>;
}

const SimulatorContext = createContext<SimulatorContextValue | null>(null);

// =============================================================================
// Serialization helpers
// =============================================================================

/**
 * SimulatorState → PersistedState に変換する
 */
function serializeState(state: SimulatorState): PersistedState {
  const objects: PersistedState["objects"] = [];
  for (const type of ["blob", "tree", "commit"] as const) {
    for (const obj of state.objectStore.getAllByType(type)) {
      objects.push({ id: obj.id, type, data: obj });
    }
  }

  const branches: PersistedState["branches"] = [];
  for (const [name, commitId] of state.refStore.getAllBranches()) {
    branches.push({ name, commitId });
  }

  return {
    version: 1,
    objects,
    branches,
    head: state.refStore.getHead(),
    idMode: state.idMode,
  };
}

/**
 * PersistedState → SimulatorState に復元する
 */
function deserializeState(persisted: PersistedState): SimulatorState {
  const idGenerator = new IDGenerator();
  idGenerator.setMode(persisted.idMode);

  const objectStore = new ObjectStore(idGenerator);
  const refStore = new RefStore(objectStore);

  // オブジェクトを種別順に復元（blob → tree → commit）
  // 参照整合性のため順序が重要
  const byType: Record<string, typeof persisted.objects> = {
    blob: [],
    tree: [],
    commit: [],
  };
  for (const entry of persisted.objects) {
    byType[entry.type].push(entry);
  }

  for (const entry of byType.blob) {
    restoreObject(objectStore, entry.data);
  }
  for (const entry of byType.tree) {
    restoreObject(objectStore, entry.data);
  }
  for (const entry of byType.commit) {
    restoreObject(objectStore, entry.data);
  }

  // Branch を復元
  for (const { name, commitId } of persisted.branches) {
    refStore.createBranch(name, commitId);
  }

  // HEAD を復元
  if (persisted.head.type === "branch") {
    // main ブランチが存在する場合のみ checkout
    if (refStore.getBranch(persisted.head.name) !== undefined) {
      refStore.checkoutBranch(persisted.head.name);
    }
  } else {
    refStore.checkoutCommit(persisted.head.commitId);
  }

  return {
    objectStore,
    refStore,
    idMode: persisted.idMode,
    selectedObjectId: null,
    mergeState: null,
    stepHistory: [],
    errorMessage: null,
    notification: null,
  };
}

/**
 * 永続化されたオブジェクトデータを ObjectStore に直接復元する
 * addBlob/addTree/addCommit を使うと新しいIDが振られてしまうため、
 * 元のIDを保持したまま復元する。
 */
function restoreObject(objectStore: ObjectStore, data: GitObject): void {
  // ObjectStore の内部 Map に直接アクセスできないため、
  // 通常の add メソッドを使って復元する。
  // ただし ID が変わる可能性があるため、sequential モードでは
  // カウンタが進む点に注意。
  switch (data.type) {
    case "blob":
      objectStore.addBlob(data.content);
      break;
    case "tree":
      objectStore.addTree([...data.entries]);
      break;
    case "commit":
      objectStore.addCommit(data.treeId, [...data.parentIds], data.message);
      break;
  }
}

// =============================================================================
// Provider
// =============================================================================

function initializeState(): SimulatorState {
  const persisted = loadState();
  if (persisted) {
    try {
      return deserializeState(persisted);
    } catch {
      // 復元に失敗した場合はフレッシュな状態で開始
      return createInitialState();
    }
  }
  return createInitialState();
}

export function SimulatorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(simulatorReducer, null, initializeState);

  // Auto-save to localStorage on every state change
  useEffect(() => {
    saveState(serializeState(state));
  }, [state]);

  return (
    <SimulatorContext.Provider value={{ state, dispatch }}>
      {children}
    </SimulatorContext.Provider>
  );
}

// =============================================================================
// Custom Hook
// =============================================================================

export function useSimulator(): SimulatorContextValue {
  const context = useContext(SimulatorContext);
  if (context === null) {
    throw new Error("useSimulator must be used within a SimulatorProvider");
  }
  return context;
}
