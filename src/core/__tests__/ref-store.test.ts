import { describe, it, expect, beforeEach } from 'vitest'
import { RefStore } from '../ref-store'
import { ObjectStore } from '../object-store'
import { IDGenerator } from '../id-generator'
import type { Commit } from '../types'

/**
 * テスト用ヘルパー: IDGenerator + ObjectStore + RefStore をセットアップし、
 * 基本的なCommitチェーンを作成する。
 */
function createTestEnv() {
  const idGen = new IDGenerator()
  idGen.setMode('sequential')
  const objectStore = new ObjectStore(idGen)
  const refStore = new RefStore(objectStore)

  // 基本的なTree（Commitに必要）
  const { blob } = objectStore.addBlob('initial content')
  const tree = objectStore.addTree([{ name: 'file.txt', objectId: blob.id }])

  // Commitチェーン: c1 ← c2 ← c3
  const c1 = objectStore.addCommit(tree.id, [], 'first commit')
  const c2 = objectStore.addCommit(tree.id, [c1.id], 'second commit')
  const c3 = objectStore.addCommit(tree.id, [c2.id], 'third commit')

  return { idGen, objectStore, refStore, tree, c1, c2, c3 }
}

describe('RefStore', () => {
  let refStore: RefStore
  let c1: Commit
  let c2: Commit

  beforeEach(() => {
    const env = createTestEnv()
    refStore = env.refStore
    c1 = env.c1
    c2 = env.c2
  })

  // ===========================================================================
  // Branch CRUD (要件 4.1, 4.2, 4.3, 4.4)
  // ===========================================================================
  describe('createBranch', () => {
    it('should create a branch pointing to the specified commit', () => {
      refStore.createBranch('main', c1.id)

      expect(refStore.getBranch('main')).toBe(c1.id)
    })

    it('should allow creating multiple branches', () => {
      refStore.createBranch('main', c1.id)
      refStore.createBranch('feature', c2.id)

      expect(refStore.getBranch('main')).toBe(c1.id)
      expect(refStore.getBranch('feature')).toBe(c2.id)
    })

    it('should throw when creating a branch with a duplicate name', () => {
      refStore.createBranch('main', c1.id)

      expect(() => refStore.createBranch('main', c2.id)).toThrow(
        /既に存在します/
      )
    })

    it('should throw when the commit ID does not exist', () => {
      expect(() => refStore.createBranch('main', 'no-such-commit')).toThrow(
        /存在しません/
      )
    })
  })

  describe('moveBranch', () => {
    it('should update the branch to point to a new commit', () => {
      refStore.createBranch('main', c1.id)
      refStore.moveBranch('main', c2.id)

      expect(refStore.getBranch('main')).toBe(c2.id)
    })

    it('should throw when the branch does not exist', () => {
      expect(() => refStore.moveBranch('ghost', c1.id)).toThrow(
        /存在しません/
      )
    })

    it('should throw when the target commit does not exist', () => {
      refStore.createBranch('main', c1.id)

      expect(() => refStore.moveBranch('main', 'bad-id')).toThrow(
        /存在しません/
      )
    })
  })

  describe('deleteBranch', () => {
    it('should remove the branch', () => {
      refStore.createBranch('temp', c1.id)
      refStore.deleteBranch('temp')

      expect(refStore.getBranch('temp')).toBeUndefined()
    })

    it('should throw when the branch does not exist', () => {
      expect(() => refStore.deleteBranch('nope')).toThrow(/存在しません/)
    })
  })

  describe('getBranch / getAllBranches', () => {
    it('should return undefined for a non-existent branch', () => {
      expect(refStore.getBranch('missing')).toBeUndefined()
    })

    it('should return all branches as a new Map', () => {
      refStore.createBranch('main', c1.id)
      refStore.createBranch('dev', c2.id)

      const all = refStore.getAllBranches()
      expect(all.size).toBe(2)
      expect(all.get('main')).toBe(c1.id)
      expect(all.get('dev')).toBe(c2.id)
    })

    it('should return a copy so external mutations do not affect internal state', () => {
      refStore.createBranch('main', c1.id)
      const copy = refStore.getAllBranches()
      copy.set('hacked', c2.id)

      expect(refStore.getBranch('hacked')).toBeUndefined()
    })
  })

  // ===========================================================================
  // HEAD操作 (要件 5.1, 5.2, 5.3, 5.4)
  // ===========================================================================
  describe('getHead (initial state)', () => {
    it('should default to branch "main"', () => {
      const head = refStore.getHead()
      expect(head).toEqual({ type: 'branch', name: 'main' })
    })
  })

  describe('checkoutBranch', () => {
    it('should set HEAD to the specified branch', () => {
      refStore.createBranch('feature', c1.id)
      refStore.checkoutBranch('feature')

      expect(refStore.getHead()).toEqual({ type: 'branch', name: 'feature' })
    })

    it('should throw when the branch does not exist', () => {
      expect(() => refStore.checkoutBranch('nonexistent')).toThrow(
        /存在しません/
      )
    })
  })

  describe('checkoutCommit (Detached HEAD)', () => {
    it('should set HEAD to detached state pointing to the commit', () => {
      refStore.checkoutCommit(c2.id)

      expect(refStore.getHead()).toEqual({ type: 'detached', commitId: c2.id })
    })

    it('should throw when the commit does not exist', () => {
      expect(() => refStore.checkoutCommit('fake-commit')).toThrow(
        /存在しません/
      )
    })
  })

  describe('advanceHead', () => {
    it('should advance the branch when HEAD points to a branch', () => {
      refStore.createBranch('main', c1.id)
      refStore.checkoutBranch('main')

      refStore.advanceHead(c2.id)

      // Branch "main" should now point to c2
      expect(refStore.getBranch('main')).toBe(c2.id)
      // HEAD still points to branch "main"
      expect(refStore.getHead()).toEqual({ type: 'branch', name: 'main' })
    })

    it('should update detached HEAD directly when in detached state', () => {
      refStore.checkoutCommit(c1.id)

      refStore.advanceHead(c2.id)

      expect(refStore.getHead()).toEqual({ type: 'detached', commitId: c2.id })
    })

    it('should throw when the new commit does not exist', () => {
      refStore.createBranch('main', c1.id)
      refStore.checkoutBranch('main')

      expect(() => refStore.advanceHead('invalid-commit')).toThrow(
        /存在しません/
      )
    })
  })
})
