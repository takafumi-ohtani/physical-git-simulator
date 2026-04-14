import type { IdMode, ObjectId } from "./types";

/**
 * IDGenerator - 2モードのID生成器
 *
 * - sequential: `blob-1`, `tree-2`, `commit-3` 形式の連番
 * - pseudo-hash: ランダム8文字hex
 *
 * Note: content-hash モードは廃止。BlobのコンテンツアドレッシングはContent_Matrixで体験させる。
 */
export class IDGenerator {
  private mode: IdMode = "sequential";
  private counters: Record<string, number> = { blob: 0, tree: 0, commit: 0 };

  getMode(): IdMode {
    return this.mode;
  }

  getCounter(objectType: "blob" | "tree" | "commit" = "blob"): number {
    return this.counters[objectType] ?? 0;
  }

  setMode(mode: IdMode): void {
    this.mode = mode;
  }

  clone(): IDGenerator {
    const copy = new IDGenerator();
    copy.mode = this.mode;
    copy.counters = { ...this.counters };
    return copy;
  }

  generate(objectType: "blob" | "tree" | "commit", _content: string): ObjectId {
    switch (this.mode) {
      case "sequential":
        return this.generateSequential(objectType);
      case "pseudo-hash":
        return this.generatePseudoHash();
    }
  }

  remapId(
    _oldId: ObjectId,
    content: string,
    objectType: "blob" | "tree" | "commit" = "blob"
  ): ObjectId {
    return this.generate(objectType, content);
  }

  private generateSequential(objectType: string): ObjectId {
    this.counters[objectType] = (this.counters[objectType] ?? 0) + 1;
    return `${objectType}-${this.counters[objectType]}`;
  }

  private generatePseudoHash(): ObjectId {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
