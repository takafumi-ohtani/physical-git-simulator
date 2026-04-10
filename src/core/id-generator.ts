import type { IdMode, ObjectId } from "./types";

/**
 * IDGenerator - 3モードのID生成器
 *
 * - sequential: `blob-1`, `tree-2`, `commit-3` 形式の連番
 * - pseudo-hash: ランダム8文字hex
 * - content-hash: SHA-1先頭8文字（同期フォールバック付き）
 */
export class IDGenerator {
  private mode: IdMode = "sequential";
  private counter = 0;

  /** 現在のモードを取得 */
  getMode(): IdMode {
    return this.mode;
  }

  /** カウンターの現在値を取得 */
  getCounter(): number {
    return this.counter;
  }

  /** モードを切り替える */
  setMode(mode: IdMode): void {
    this.mode = mode;
  }

  /** 現在の状態をクローンする */
  clone(): IDGenerator {
    const copy = new IDGenerator();
    copy.mode = this.mode;
    copy.counter = this.counter;
    return copy;
  }

  /**
   * IDを生成する
   * @param objectType - オブジェクト種別 (blob/tree/commit) — sequential モードで使用
   * @param content - オブジェクトの内容 — content-hash モードで使用
   */
  generate(objectType: "blob" | "tree" | "commit", content: string): ObjectId {
    switch (this.mode) {
      case "sequential":
        return this.generateSequential(objectType);
      case "pseudo-hash":
        return this.generatePseudoHash();
      case "content-hash":
        return this.generateContentHash(content);
    }
  }

  /**
   * 既存IDを現在のモードで再マッピングする
   * @param _oldId - 旧ID（参照用、実際には content から再生成）
   * @param content - オブジェクトの内容
   * @param objectType - オブジェクト種別
   */
  remapId(
    _oldId: ObjectId,
    content: string,
    objectType: "blob" | "tree" | "commit" = "blob"
  ): ObjectId {
    return this.generate(objectType, content);
  }

  /** sequential: type-N 形式 */
  private generateSequential(objectType: string): ObjectId {
    this.counter++;
    return `${objectType}-${this.counter}`;
  }

  /** pseudo-hash: ランダム8文字hex */
  private generatePseudoHash(): ObjectId {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /** content-hash: 同期的な簡易ハッシュ（SHA-1ライク、先頭8文字） */
  private generateContentHash(content: string): ObjectId {
    return simpleHash(content).slice(0, 8);
  }
}

/**
 * 同期的な簡易ハッシュ関数
 * FNV-1a ベースで十分な分散を持つ hex 文字列を生成する。
 * ブラウザ互換性のため crypto.subtle (async) ではなく同期実装を採用。
 */
function simpleHash(input: string): string {
  // FNV-1a 64-bit をエミュレート（32-bit × 2 で十分な長さを確保）
  let h1 = 0x811c9dc5 >>> 0; // FNV offset basis (32-bit)
  let h2 = 0x01000193 >>> 0; // second seed

  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c;
    h2 = Math.imul(h2, 0x0100019d) >>> 0;
  }

  // 8 hex chars from h1 + 8 hex chars from h2 = 16 chars total
  return (
    h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")
  );
}
