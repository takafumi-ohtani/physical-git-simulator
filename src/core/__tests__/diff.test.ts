import { describe, it, expect } from 'vitest'
import { computeDiff } from '../diff'

describe('computeDiff', () => {
  // ===========================================================================
  // 基本ケース (要件 15.1, 15.2)
  // ===========================================================================

  it('should return empty array when both inputs are empty', () => {
    expect(computeDiff('', '')).toEqual([])
  })

  it('should mark all lines as added when old text is empty', () => {
    const result = computeDiff('', 'line1\nline2')
    expect(result).toEqual([
      { type: 'added', content: 'line1' },
      { type: 'added', content: 'line2' },
    ])
  })

  it('should mark all lines as deleted when new text is empty', () => {
    const result = computeDiff('line1\nline2', '')
    expect(result).toEqual([
      { type: 'deleted', content: 'line1' },
      { type: 'deleted', content: 'line2' },
    ])
  })

  it('should mark all lines as unchanged when texts are identical', () => {
    const text = 'aaa\nbbb\nccc'
    const result = computeDiff(text, text)
    expect(result).toEqual([
      { type: 'unchanged', content: 'aaa' },
      { type: 'unchanged', content: 'bbb' },
      { type: 'unchanged', content: 'ccc' },
    ])
  })

  // ===========================================================================
  // 追加・削除・混合 (要件 15.1, 15.2)
  // ===========================================================================

  it('should detect a single added line', () => {
    const result = computeDiff('a\nc', 'a\nb\nc')
    expect(result).toEqual([
      { type: 'unchanged', content: 'a' },
      { type: 'added', content: 'b' },
      { type: 'unchanged', content: 'c' },
    ])
  })

  it('should detect a single deleted line', () => {
    const result = computeDiff('a\nb\nc', 'a\nc')
    expect(result).toEqual([
      { type: 'unchanged', content: 'a' },
      { type: 'deleted', content: 'b' },
      { type: 'unchanged', content: 'c' },
    ])
  })

  it('should detect a replaced line as delete + add', () => {
    const result = computeDiff('a\nold\nc', 'a\nnew\nc')
    expect(result).toEqual([
      { type: 'unchanged', content: 'a' },
      { type: 'deleted', content: 'old' },
      { type: 'added', content: 'new' },
      { type: 'unchanged', content: 'c' },
    ])
  })

  it('should handle completely different texts', () => {
    const result = computeDiff('x\ny', 'a\nb')
    // All old lines deleted, all new lines added
    const types = result.map((l) => l.type)
    expect(types.filter((t) => t === 'deleted')).toHaveLength(2)
    expect(types.filter((t) => t === 'added')).toHaveLength(2)
  })

  // ===========================================================================
  // 単一行テキスト
  // ===========================================================================

  it('should handle single-line texts that are the same', () => {
    const result = computeDiff('hello', 'hello')
    expect(result).toEqual([{ type: 'unchanged', content: 'hello' }])
  })

  it('should handle single-line texts that differ', () => {
    const result = computeDiff('hello', 'world')
    expect(result).toEqual([
      { type: 'deleted', content: 'hello' },
      { type: 'added', content: 'world' },
    ])
  })

  // ===========================================================================
  // 結果の構造検証 (要件 15.2 - 視覚的強調表示用)
  // ===========================================================================

  it('should produce DiffLine objects with type and content fields', () => {
    const result = computeDiff('a', 'b')
    for (const line of result) {
      expect(line).toHaveProperty('type')
      expect(line).toHaveProperty('content')
      expect(['added', 'deleted', 'unchanged']).toContain(line.type)
      expect(typeof line.content).toBe('string')
    }
  })

  it('should preserve original content in each DiffLine', () => {
    const result = computeDiff('foo\nbar', 'foo\nbaz')
    const contents = result.map((l) => l.content)
    expect(contents).toContain('foo')
    expect(contents).toContain('bar')
    expect(contents).toContain('baz')
  })
})
