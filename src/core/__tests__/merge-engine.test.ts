import { describe, it, expect, beforeEach } from 'vitest'
import { MergeEngine, classifyBlobMerge } from '../merge-engine'
import { ObjectStore } from '../object-store'
import { RefStore } from '../ref-store'
import { IDGenerator } from '../id-generator'
import type { ObjectId, Commit, ConflictEntry } from '../types'

/**
 * MergeEngine テスト
 *
 * 要件: 7.1-7.5, 8.3-8.5
 */
describe('MergeEngine', () => {
  let idGen: IDGenerator
  let objectStore: ObjectStore
  let refStore: RefStore
  let mergeEngine: MergeEngine

  beforeEach(() => {
    idGen = new IDGenerator()
    idGen.setMode('sequential')
    objectStore = new ObjectStore(idGen)
    refStore = new RefStore(objectStore)
    mergeEngine = new MergeEngine(objectStore, refStore)
  })

  // ---------------------------------------------------------------------------
  // Helper: ファイルマップからTree IDを作成する
  // ---------------------------------------------------------------------------
  function createTree(files: Record<string, string>): ObjectId {
    const entries = Object.entries(files).map(([name, content]) => {
      const { blob } = objectStore.addBlob(content)
      return { name, objectId: blob.id }
    })
    entries.sort((a, b) => a.name.localeCompare(b.name))
    return objectStore.addTree(entries).id
  }

  // ---------------------------------------------------------------------------
  // Helper: コミットチェーンを構築する
  // ---------------------------------------------------------------------------
  function makeCommit(
    files: Record<string, string>,
    parentIds: ObjectId[],
    message: string
  ): Commit {
    const treeId = createTree(files)
    return objectStore.addCommit(treeId, parentIds, message)
  }

  // ---------------------------------------------------------------------------
  // Helper: ブランチを作成してチェックアウトする
  // ---------------------------------------------------------------------------
  function setupBranch(name: string, commitId: ObjectId): void {
    refStore.createBranch(name, commitId)
  }


  // ===========================================================================
  // findAncestor - 共通祖先探索 (要件 7.1)
  // ===========================================================================
  describe('findAncestor', () => {
    it('should find the common ancestor of two diverged commits', () => {
      // A (ancestor) → B (main), A → C (feature)
      const commitA = makeCommit({ 'file.txt': 'base' }, [], 'A: initial')
      const commitB = makeCommit({ 'file.txt': 'main change' }, [commitA.id], 'B: main')
      const commitC = makeCommit({ 'file.txt': 'feature change' }, [commitA.id], 'C: feature')

      const ancestor = mergeEngine.findAncestor(commitB.id, commitC.id)
      expect(ancestor).toBe(commitA.id)
    })

    it('should return the commit itself when one is an ancestor of the other', () => {
      // A → B → C (linear)
      const commitA = makeCommit({ 'f.txt': 'v1' }, [], 'A')
      const commitB = makeCommit({ 'f.txt': 'v2' }, [commitA.id], 'B')
      const commitC = makeCommit({ 'f.txt': 'v3' }, [commitB.id], 'C')

      // A is ancestor of C
      const ancestor = mergeEngine.findAncestor(commitC.id, commitA.id)
      expect(ancestor).toBe(commitA.id)
    })

    it('should return null when commits share no common ancestor', () => {
      const commitX = makeCommit({ 'x.txt': 'x' }, [], 'X: orphan 1')
      const commitY = makeCommit({ 'y.txt': 'y' }, [], 'Y: orphan 2')

      const ancestor = mergeEngine.findAncestor(commitX.id, commitY.id)
      expect(ancestor).toBeNull()
    })

    it('should find the nearest common ancestor in a deeper history', () => {
      // A → B → D (main), A → C → E (feature)
      const commitA = makeCommit({ 'f.txt': 'base' }, [], 'A')
      const commitB = makeCommit({ 'f.txt': 'b' }, [commitA.id], 'B')
      const commitC = makeCommit({ 'f.txt': 'c' }, [commitA.id], 'C')
      const commitD = makeCommit({ 'f.txt': 'd' }, [commitB.id], 'D')
      const commitE = makeCommit({ 'f.txt': 'e' }, [commitC.id], 'E')

      const ancestor = mergeEngine.findAncestor(commitD.id, commitE.id)
      expect(ancestor).toBe(commitA.id)
    })
  })

  // ===========================================================================
  // isFastForward - Fast-Forward判定 (要件 7.2)
  // ===========================================================================
  describe('isFastForward', () => {
    it('should return true when target is an ancestor of source (linear history)', () => {
      // A → B → C
      const commitA = makeCommit({ 'f.txt': 'v1' }, [], 'A')
      const commitB = makeCommit({ 'f.txt': 'v2' }, [commitA.id], 'B')
      const commitC = makeCommit({ 'f.txt': 'v3' }, [commitB.id], 'C')

      // A is ancestor of C → fast-forward possible
      expect(mergeEngine.isFastForward(commitC.id, commitA.id)).toBe(true)
    })

    it('should return true when source and target are the same commit', () => {
      const commitA = makeCommit({ 'f.txt': 'v1' }, [], 'A')
      expect(mergeEngine.isFastForward(commitA.id, commitA.id)).toBe(true)
    })

    it('should return false when branches have diverged', () => {
      // A → B (main), A → C (feature)
      const commitA = makeCommit({ 'f.txt': 'base' }, [], 'A')
      const commitB = makeCommit({ 'f.txt': 'main' }, [commitA.id], 'B')
      const commitC = makeCommit({ 'f.txt': 'feature' }, [commitA.id], 'C')

      expect(mergeEngine.isFastForward(commitB.id, commitC.id)).toBe(false)
      expect(mergeEngine.isFastForward(commitC.id, commitB.id)).toBe(false)
    })
  })


  // ===========================================================================
  // merge - Fast-Forward (要件 7.2, 7.5)
  // ===========================================================================
  describe('merge - Fast-Forward', () => {
    it('should fast-forward when target branch is behind source branch', () => {
      // A → B → C (feature is ahead of main)
      const commitA = makeCommit({ 'f.txt': 'v1' }, [], 'A')
      setupBranch('main', commitA.id)

      const commitB = makeCommit({ 'f.txt': 'v2' }, [commitA.id], 'B')
      const commitC = makeCommit({ 'f.txt': 'v3' }, [commitB.id], 'C')
      setupBranch('feature', commitC.id)

      const result = mergeEngine.merge('feature', 'main')

      expect(result.type).toBe('fast-forward')
      expect((result as any).targetCommitId).toBe(commitC.id)
      // main branch should now point to commitC
      expect(refStore.getBranch('main')).toBe(commitC.id)
    })

    it('should return fast-forward when both branches point to the same commit', () => {
      const commitA = makeCommit({ 'f.txt': 'v1' }, [], 'A')
      setupBranch('main', commitA.id)
      setupBranch('feature', commitA.id)

      const result = mergeEngine.merge('feature', 'main')
      expect(result.type).toBe('fast-forward')
    })
  })

  // ===========================================================================
  // merge - Normal Merge (要件 7.3, 7.5)
  // ===========================================================================
  describe('merge - Normal Merge (no conflicts)', () => {
    it('should create a merge commit with 2 parents when branches diverge without conflicts', () => {
      // Base: { a.txt: "base" }
      // main: adds b.txt
      // feature: adds c.txt
      const base = makeCommit({ 'a.txt': 'base' }, [], 'base')
      setupBranch('main', base.id)
      setupBranch('feature', base.id)

      const mainCommit = makeCommit(
        { 'a.txt': 'base', 'b.txt': 'from main' },
        [base.id],
        'main: add b.txt'
      )
      refStore.moveBranch('main', mainCommit.id)

      const featureCommit = makeCommit(
        { 'a.txt': 'base', 'c.txt': 'from feature' },
        [base.id],
        'feature: add c.txt'
      )
      refStore.moveBranch('feature', featureCommit.id)

      const result = mergeEngine.merge('feature', 'main')

      expect(result.type).toBe('normal')
      const normalResult = result as any
      expect(normalResult.mergeCommit).toBeDefined()
      expect(normalResult.mergeCommit.parentIds).toHaveLength(2)
      expect(normalResult.mergeCommit.parentIds).toContain(mainCommit.id)
      expect(normalResult.mergeCommit.parentIds).toContain(featureCommit.id)
    })

    it('should include changes from both branches in the merge commit tree', () => {
      const base = makeCommit({ 'a.txt': 'base' }, [], 'base')
      setupBranch('main', base.id)
      setupBranch('feature', base.id)

      const mainCommit = makeCommit(
        { 'a.txt': 'base', 'b.txt': 'main-only' },
        [base.id],
        'main: add b'
      )
      refStore.moveBranch('main', mainCommit.id)

      const featureCommit = makeCommit(
        { 'a.txt': 'base', 'c.txt': 'feature-only' },
        [base.id],
        'feature: add c'
      )
      refStore.moveBranch('feature', featureCommit.id)

      const result = mergeEngine.merge('feature', 'main')
      expect(result.type).toBe('normal')

      // Verify the merge commit's tree contains all files
      const mergeCommit = (result as any).mergeCommit as Commit
      const tree = objectStore.get(mergeCommit.treeId)
      expect(tree).toBeDefined()
      expect(tree!.type).toBe('tree')
      if (tree!.type === 'tree') {
        const names = tree!.entries.map((e) => e.name).sort()
        expect(names).toEqual(['a.txt', 'b.txt', 'c.txt'])
      }
    })

    it('should advance the target branch to the merge commit', () => {
      const base = makeCommit({ 'a.txt': 'base' }, [], 'base')
      setupBranch('main', base.id)
      setupBranch('feature', base.id)

      const mainCommit = makeCommit(
        { 'a.txt': 'base', 'b.txt': 'main' },
        [base.id],
        'main work'
      )
      refStore.moveBranch('main', mainCommit.id)

      const featureCommit = makeCommit(
        { 'a.txt': 'base', 'c.txt': 'feature' },
        [base.id],
        'feature work'
      )
      refStore.moveBranch('feature', featureCommit.id)

      const result = mergeEngine.merge('feature', 'main')
      const mergeCommit = (result as any).mergeCommit as Commit

      expect(refStore.getBranch('main')).toBe(mergeCommit.id)
    })
  })


  // ===========================================================================
  // merge - Conflict detection (要件 7.4, 8.1, 8.2)
  // ===========================================================================
  describe('merge - Conflict detection', () => {
    it('should detect conflict when the same file is changed differently in both branches', () => {
      const base = makeCommit({ 'a.txt': 'original' }, [], 'base')
      setupBranch('main', base.id)
      setupBranch('feature', base.id)

      const mainCommit = makeCommit(
        { 'a.txt': 'changed by main' },
        [base.id],
        'main: edit a.txt'
      )
      refStore.moveBranch('main', mainCommit.id)

      const featureCommit = makeCommit(
        { 'a.txt': 'changed by feature' },
        [base.id],
        'feature: edit a.txt'
      )
      refStore.moveBranch('feature', featureCommit.id)

      const result = mergeEngine.merge('feature', 'main')

      expect(result.type).toBe('conflict')
      const conflictResult = result as any
      expect(conflictResult.conflicts).toHaveLength(1)
      expect(conflictResult.conflicts[0].path).toBe('a.txt')
      expect(conflictResult.conflicts[0].ancestor).toBe('original')
      expect(conflictResult.conflicts[0].ours).toBe('changed by main')
      expect(conflictResult.conflicts[0].theirs).toBe('changed by feature')
    })

    it('should detect multiple conflicts across different files', () => {
      const base = makeCommit(
        { 'a.txt': 'a-base', 'b.txt': 'b-base' },
        [],
        'base'
      )
      setupBranch('main', base.id)
      setupBranch('feature', base.id)

      const mainCommit = makeCommit(
        { 'a.txt': 'a-main', 'b.txt': 'b-main' },
        [base.id],
        'main changes'
      )
      refStore.moveBranch('main', mainCommit.id)

      const featureCommit = makeCommit(
        { 'a.txt': 'a-feature', 'b.txt': 'b-feature' },
        [base.id],
        'feature changes'
      )
      refStore.moveBranch('feature', featureCommit.id)

      const result = mergeEngine.merge('feature', 'main')

      expect(result.type).toBe('conflict')
      const conflictResult = result as any
      expect(conflictResult.conflicts).toHaveLength(2)
      const paths = conflictResult.conflicts.map((c: ConflictEntry) => c.path).sort()
      expect(paths).toEqual(['a.txt', 'b.txt'])
    })

    it('should not conflict when only one side changes a file', () => {
      const base = makeCommit(
        { 'a.txt': 'base', 'b.txt': 'base' },
        [],
        'base'
      )
      setupBranch('main', base.id)
      setupBranch('feature', base.id)

      // main changes a.txt, feature changes b.txt → no conflict
      const mainCommit = makeCommit(
        { 'a.txt': 'main-changed', 'b.txt': 'base' },
        [base.id],
        'main: edit a'
      )
      refStore.moveBranch('main', mainCommit.id)

      const featureCommit = makeCommit(
        { 'a.txt': 'base', 'b.txt': 'feature-changed' },
        [base.id],
        'feature: edit b'
      )
      refStore.moveBranch('feature', featureCommit.id)

      const result = mergeEngine.merge('feature', 'main')
      expect(result.type).toBe('normal')
    })
  })

  // ===========================================================================
  // merge - Error cases
  // ===========================================================================
  describe('merge - Error cases', () => {
    it('should throw when source branch does not exist', () => {
      const commitA = makeCommit({ 'f.txt': 'v1' }, [], 'A')
      setupBranch('main', commitA.id)

      expect(() => mergeEngine.merge('nonexistent', 'main')).toThrow(
        /存在しません/
      )
    })

    it('should throw when target branch does not exist', () => {
      const commitA = makeCommit({ 'f.txt': 'v1' }, [], 'A')
      setupBranch('feature', commitA.id)

      expect(() => mergeEngine.merge('feature', 'nonexistent')).toThrow(
        /存在しません/
      )
    })
  })

  // ===========================================================================
  // resolveConflict (要件 8.3, 8.4, 8.5)
  // ===========================================================================
  describe('resolveConflict', () => {
    const conflictEntry: ConflictEntry = {
      path: 'a.txt',
      ancestor: 'original content',
      ours: 'ours content',
      theirs: 'theirs content',
    }

    it('should return ours content when choice is "ours"', () => {
      const resolved = mergeEngine.resolveConflict(conflictEntry, 'ours')
      expect(resolved).toBe('ours content')
    })

    it('should return theirs content when choice is "theirs"', () => {
      const resolved = mergeEngine.resolveConflict(conflictEntry, 'theirs')
      expect(resolved).toBe('theirs content')
    })

    it('should return manual content when choice is { manual: "..." }', () => {
      const resolved = mergeEngine.resolveConflict(conflictEntry, {
        manual: 'manually resolved content',
      })
      expect(resolved).toBe('manually resolved content')
    })

    it('should handle conflict entry with null ancestor', () => {
      const entry: ConflictEntry = {
        path: 'new.txt',
        ancestor: null,
        ours: 'ours version',
        theirs: 'theirs version',
      }
      expect(mergeEngine.resolveConflict(entry, 'ours')).toBe('ours version')
      expect(mergeEngine.resolveConflict(entry, 'theirs')).toBe('theirs version')
    })
  })
})

// =============================================================================
// classifyBlobMerge - 2ワード構造のConflict判定 (要件 7.6, 7.7, 7.8)
// =============================================================================
describe('classifyBlobMerge', () => {
  it('should return no-change when both sides are unchanged', () => {
    expect(classifyBlobMerge('○-1', '○-1', '○-1')).toBe('no-change')
  })

  it('should return auto-ours when only Ours changed', () => {
    expect(classifyBlobMerge('○-1', '△-1', '○-1')).toBe('auto-ours')
    expect(classifyBlobMerge('○-1', '○-2', '○-1')).toBe('auto-ours')
    expect(classifyBlobMerge('○-1', '□-3', '○-1')).toBe('auto-ours')
  })

  it('should return auto-theirs when only Theirs changed', () => {
    expect(classifyBlobMerge('○-1', '○-1', '△-1')).toBe('auto-theirs')
    expect(classifyBlobMerge('○-1', '○-1', '○-2')).toBe('auto-theirs')
    expect(classifyBlobMerge('○-1', '○-1', '✕-4')).toBe('auto-theirs')
  })

  it('should return conflict when both sides changed (both words)', () => {
    expect(classifyBlobMerge('○-1', '△-1', '○-2')).toBe('conflict')
    expect(classifyBlobMerge('○-1', '△-2', '○-2')).toBe('conflict')
  })

  it('should return conflict when both sides changed to different values', () => {
    expect(classifyBlobMerge('○-1', '△-1', '□-1')).toBe('conflict')
    expect(classifyBlobMerge('○-1', '○-2', '○-3')).toBe('conflict')
  })

  it('should cover all 16 BlobContent combinations as ancestor', () => {
    const words1 = ['○', '△', '□', '✕'] as const
    const words2 = ['1', '2', '3', '4'] as const
    for (const w1 of words1) {
      for (const w2 of words2) {
        const ancestor = `${w1}-${w2}` as const
        expect(classifyBlobMerge(ancestor, ancestor, ancestor)).toBe('no-change')
      }
    }
  })
})
