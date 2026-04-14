import { describe, it, expect, beforeEach } from "vitest";
import {
  saveState,
  loadState,
  clearState,
  type PersistedState,
} from "../persistence";

// localStorage のモック
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

function createValidState(): PersistedState {
  return {
    version: 1,
    objects: [
      {
        id: "blob-1",
        type: "blob",
        data: { type: "blob", id: "blob-1", content: "hello" },
      },
    ],
    branches: [{ name: "main", commitId: "commit-1" }],
    head: { type: "branch", name: "main" },
    idMode: "sequential",
  };
}

describe("persistence", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe("saveState", () => {
    it("should save state to localStorage", () => {
      const state = createValidState();
      saveState(state);

      const stored = localStorageMock.getItem("git-simulator-state");
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual(state);
    });
  });

  describe("loadState", () => {
    it("should load a valid state from localStorage", () => {
      const state = createValidState();
      localStorageMock.setItem("git-simulator-state", JSON.stringify(state));

      const loaded = loadState();
      expect(loaded).toEqual(state);
    });

    it("should return null when no data exists", () => {
      expect(loadState()).toBeNull();
    });

    it("should return null for invalid JSON", () => {
      localStorageMock.setItem("git-simulator-state", "not-json{{{");
      expect(loadState()).toBeNull();
    });

    it("should return null for wrong version", () => {
      const bad = { ...createValidState(), version: 2 };
      localStorageMock.setItem("git-simulator-state", JSON.stringify(bad));
      expect(loadState()).toBeNull();
    });

    it("should return null when objects is not an array", () => {
      const bad = { ...createValidState(), objects: "not-array" };
      localStorageMock.setItem("git-simulator-state", JSON.stringify(bad));
      expect(loadState()).toBeNull();
    });

    it("should return null when branches is not an array", () => {
      const bad = { ...createValidState(), branches: "not-array" };
      localStorageMock.setItem("git-simulator-state", JSON.stringify(bad));
      expect(loadState()).toBeNull();
    });

    it("should return null for invalid head ref", () => {
      const bad = { ...createValidState(), head: { type: "unknown" } };
      localStorageMock.setItem("git-simulator-state", JSON.stringify(bad));
      expect(loadState()).toBeNull();
    });

    it("should return null for invalid idMode", () => {
      const bad = { ...createValidState(), idMode: "invalid-mode" };
      localStorageMock.setItem("git-simulator-state", JSON.stringify(bad));
      expect(loadState()).toBeNull();
    });

    it("should accept detached HEAD ref", () => {
      const state: PersistedState = {
        ...createValidState(),
        head: { type: "detached", commitId: "commit-1" },
      };
      localStorageMock.setItem("git-simulator-state", JSON.stringify(state));
      expect(loadState()).toEqual(state);
    });

    it("should accept all valid idMode values", () => {
      for (const mode of ["sequential", "pseudo-hash"] as const) {
        const state: PersistedState = { ...createValidState(), idMode: mode };
        localStorageMock.setItem("git-simulator-state", JSON.stringify(state));
        expect(loadState()).toEqual(state);
      }
    });
  });

  describe("clearState", () => {
    it("should remove state from localStorage", () => {
      const state = createValidState();
      saveState(state);
      expect(loadState()).not.toBeNull();

      clearState();
      expect(loadState()).toBeNull();
    });
  });

  describe("round-trip", () => {
    it("should preserve state through save and load", () => {
      const state = createValidState();
      saveState(state);
      const loaded = loadState();
      expect(loaded).toEqual(state);
    });
  });
});
