// =============================================================================
// Line-Level Diff Utility - 物理Gitシミュレータ
// =============================================================================
// LCS (Longest Common Subsequence) ベースの行単位diff実装。
// Conflict解決UIでの差分強調表示に使用する。
// 要件: 15.1, 15.2

export type DiffLineType = 'added' | 'deleted' | 'unchanged';

export interface DiffLine {
  readonly type: DiffLineType;
  readonly content: string;
}

/**
 * 2つの文字列を行単位で比較し、差分結果を返す。
 *
 * LCSアルゴリズムで共通行を特定し、追加・削除・変更なしの行を識別する。
 */
export function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);

  const lcsTable = buildLCSTable(oldLines, newLines);
  return backtrack(lcsTable, oldLines, newLines);
}

/** テキストを行に分割する。空文字列は空配列を返す。 */
function splitLines(text: string): string[] {
  if (text === '') return [];
  return text.split('\n');
}

/** LCS用のDPテーブルを構築する */
function buildLCSTable(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;

  // (m+1) x (n+1) のテーブルを0で初期化
  const table: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  return table;
}

/** LCSテーブルをバックトラックしてDiffLine配列を生成する */
function backtrack(
  table: number[][],
  oldLines: string[],
  newLines: string[]
): DiffLine[] {
  const result: DiffLine[] = [];
  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: 'unchanged', content: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      result.push({ type: 'added', content: newLines[j - 1] });
      j--;
    } else {
      result.push({ type: 'deleted', content: oldLines[i - 1] });
      i--;
    }
  }

  return result.reverse();
}
