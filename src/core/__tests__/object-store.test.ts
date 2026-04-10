import { describe, it, expect, beforeEach } from 'vitest'
import { ObjectStore } from '../object-store'
import { IDGenerator } from '../id-generator'

describe('ObjectStore', () => {
  let store: ObjectStore
  let idGen: IDGenerator

  beforeEach(() => {
    idGen = new IDGenerator()
    idGen.setMode('sequential')
    store = new ObjectStore(idGen)
  })

  // ===========================================================================
  // Blob (要件 1.1, 1.2, 1.3, 1.4, 12.1, 12.2)
  // ===========================================================================
  describe('addBlob', () => {
    it('should create a Blob with the given content and a unique ID', () => {
      const { blob, existing } = store.addBlob('hello')

      expect(existing).toBe(false)
      expect(blob.type).toBe('blob')
      expect(blob.id).toBe('blob-1')
      expect(blob.content).toBe('hello')
    })

    it('should assign different IDs to Blobs with different content', () => {
      const { blob: b1 } = store.addBlob('aaa')
      const { blob: b2 } = store.addBlob('bbb')

      expect(b1.id).not.toBe(b2.id)
    })

    it('should return the existing Blob when the same content is added again', () => {
      const { blob: first } = store.addBlob('duplicate')
      const { blob: second, existing } = store.addBlob('duplicate')

      expect(existing).toBe(true)
      expect(second.id).toBe(first.id)
      expect(second).toBe(first)
    })

    it('should freeze the Blob so mutations are rejected', () => {
      const { blob } = store.addBlob('frozen')

      expect(Object.isFrozen(blob)).toBe(true)
      expect(() => {
        ;(blob as any).content = 'changed'
      }).toThrow()
    })
  })

  // ===========================================================================
  // Tree (要件 2.1, 2.2, 2.3, 2.4, 2.5, 12.1, 12.2)
  // ===========================================================================
  describe('addTree', () => {
    it('should create a Tree with entries referencing existing objects', () => {
      const { blob } = store.addBlob('file content')
      const tree = store.addTree([{ name: 'file.txt', objectId: blob.id }])

      expect(tree.type).toBe('tree')
      expect(tree.entries).toHaveLength(1)
      expect(tree.entries[0].name).toBe('file.txt')
      expect(tree.entries[0].objectId).toBe(blob.id)
    })

    it('should allow entries referencing another Tree (sub-tree)', () => {
      const { blob } = store.addBlob('nested')
      const subTree = store.addTree([{ name: 'inner.txt', objectId: blob.id }])
      const rootTree = store.addTree([{ name: 'subdir', objectId: subTree.id }])

      expect(rootTree.entries[0].objectId).toBe(subTree.id)
    })

    it('should assign a unique ID to each Tree', () => {
      const { blob } = store.addBlob('x')
      const t1 = store.addTree([{ name: 'a', objectId: blob.id }])
      const t2 = store.addTree([{ name: 'b', objectId: blob.id }])

      expect(t1.id).not.toBe(t2.id)
    })

    it('should throw when an entry references a non-existent object', () => {
      expect(() => {
        store.addTree([{ name: 'ghost.txt', objectId: 'no-such-id' }])
      }).toThrow(/存在しないオブジェクトを参照/)
    })

    it('should freeze the Tree so mutations are rejected', () => {
      const { blob } = store.addBlob('data')
      const tree = store.addTree([{ name: 'f.txt', objectId: blob.id }])

      expect(Object.isFrozen(tree)).toBe(true)
      expect(Object.isFrozen(tree.entries)).toBe(true)
      expect(() => {
        ;(tree as any).entries = []
      }).toThrow()
    })
  })

  // ===========================================================================
  // Commit (要件 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 12.1, 12.2)
  // ===========================================================================
  describe('addCommit', () => {
    function createSimpleTree(): string {
      const { blob } = store.addBlob('content')
      const tree = store.addTree([{ name: 'file.txt', objectId: blob.id }])
      return tree.id
    }

    it('should create a Commit with 0 parents (initial commit)', () => {
      const treeId = createSimpleTree()
      const commit = store.addCommit(treeId, [], 'initial')

      expect(commit.type).toBe('commit')
      expect(commit.treeId).toBe(treeId)
      expect(commit.parentIds).toHaveLength(0)
      expect(commit.message).toBe('initial')
    })

    it('should create a Commit with 1 parent (normal commit)', () => {
      const treeId = createSimpleTree()
      const parent = store.addCommit(treeId, [], 'first')
      const child = store.addCommit(treeId, [parent.id], 'second')

      expect(child.parentIds).toHaveLength(1)
      expect(child.parentIds[0]).toBe(parent.id)
    })

    it('should create a Commit with 2+ parents (merge commit)', () => {
      const treeId = createSimpleTree()
      const p1 = store.addCommit(treeId, [], 'branch A')
      const p2 = store.addCommit(treeId, [], 'branch B')
      const merge = store.addCommit(treeId, [p1.id, p2.id], 'merge')

      expect(merge.parentIds).toHaveLength(2)
      expect(merge.parentIds).toContain(p1.id)
      expect(merge.parentIds).toContain(p2.id)
    })

    it('should assign a unique ID to each Commit', () => {
      const treeId = createSimpleTree()
      const c1 = store.addCommit(treeId, [], 'a')
      const c2 = store.addCommit(treeId, [], 'b')

      expect(c1.id).not.toBe(c2.id)
    })

    it('should throw when treeId references a non-existent object', () => {
      expect(() => {
        store.addCommit('bad-tree-id', [], 'fail')
      }).toThrow(/存在しないまたは無効なTree/)
    })

    it('should throw when treeId references a Blob instead of a Tree', () => {
      const { blob } = store.addBlob('not a tree')
      expect(() => {
        store.addCommit(blob.id, [], 'fail')
      }).toThrow(/存在しないまたは無効なTree/)
    })

    it('should throw when a parentId references a non-existent object', () => {
      const treeId = createSimpleTree()
      expect(() => {
        store.addCommit(treeId, ['ghost-commit'], 'fail')
      }).toThrow(/存在しないまたは無効な親Commit/)
    })

    it('should throw when a parentId references a Tree instead of a Commit', () => {
      const { blob } = store.addBlob('x')
      const tree = store.addTree([{ name: 'x', objectId: blob.id }])
      expect(() => {
        store.addCommit(tree.id, [tree.id], 'fail')
      }).toThrow(/存在しないまたは無効な親Commit/)
    })

    it('should freeze the Commit so mutations are rejected', () => {
      const treeId = createSimpleTree()
      const commit = store.addCommit(treeId, [], 'frozen')

      expect(Object.isFrozen(commit)).toBe(true)
      expect(Object.isFrozen(commit.parentIds)).toBe(true)
      expect(() => {
        ;(commit as any).message = 'changed'
      }).toThrow()
    })
  })

  // ===========================================================================
  // Query methods (get, has, getAllByType, findBlobByContent)
  // ===========================================================================
  describe('get / has', () => {
    it('should return the stored object by ID', () => {
      const { blob } = store.addBlob('lookup')
      expect(store.get(blob.id)).toBe(blob)
    })

    it('should return undefined for unknown IDs', () => {
      expect(store.get('nope')).toBeUndefined()
    })

    it('should report existence correctly', () => {
      const { blob } = store.addBlob('exists')
      expect(store.has(blob.id)).toBe(true)
      expect(store.has('missing')).toBe(false)
    })
  })

  describe('getAllByType', () => {
    it('should return only objects of the requested type', () => {
      const { blob } = store.addBlob('b')
      const tree = store.addTree([{ name: 'f', objectId: blob.id }])
      store.addCommit(tree.id, [], 'c')

      expect(store.getAllByType('blob')).toHaveLength(1)
      expect(store.getAllByType('tree')).toHaveLength(1)
      expect(store.getAllByType('commit')).toHaveLength(1)
    })

    it('should return an empty array when no objects of that type exist', () => {
      expect(store.getAllByType('commit')).toEqual([])
    })
  })

  describe('findBlobByContent', () => {
    it('should find a Blob matching the given content', () => {
      const { blob } = store.addBlob('needle')
      expect(store.findBlobByContent('needle')).toBe(blob)
    })

    it('should return undefined when no Blob matches', () => {
      store.addBlob('other')
      expect(store.findBlobByContent('missing')).toBeUndefined()
    })
  })
})
