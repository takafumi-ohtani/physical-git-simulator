import { describe, it, expect } from 'vitest'
import { IDGenerator } from '../id-generator'

describe('IDGenerator', () => {
  // =========================================================================
  // sequential モード (要件 13.1)
  // =========================================================================
  describe('sequential mode', () => {
    it('should generate IDs in type-N format with per-type counters', () => {
      const gen = new IDGenerator()
      gen.setMode('sequential')

      const blobId = gen.generate('blob', 'hello')
      const treeId = gen.generate('tree', '')
      const commitId = gen.generate('commit', '')

      expect(blobId).toBe('blob-1')
      expect(treeId).toBe('tree-1')
      expect(commitId).toBe('commit-1')
    })

    it('should increment counter independently per type', () => {
      const gen = new IDGenerator()
      gen.setMode('sequential')

      const blob1 = gen.generate('blob', '')
      const commit1 = gen.generate('commit', '')
      const blob2 = gen.generate('blob', '')
      const tree1 = gen.generate('tree', '')
      const commit2 = gen.generate('commit', '')

      expect(blob1).toBe('blob-1')
      expect(commit1).toBe('commit-1')
      expect(blob2).toBe('blob-2')
      expect(tree1).toBe('tree-1')
      expect(commit2).toBe('commit-2')
    })
  })

  // =========================================================================
  // pseudo-hash モード (要件 13.1)
  // =========================================================================
  describe('pseudo-hash mode', () => {
    it('should generate 8-char hex strings', () => {
      const gen = new IDGenerator()
      gen.setMode('pseudo-hash')

      const id = gen.generate('blob', 'content')

      expect(id).toHaveLength(8)
      expect(id).toMatch(/^[0-9a-f]{8}$/)
    })

    it('should generate different IDs on successive calls', () => {
      const gen = new IDGenerator()
      gen.setMode('pseudo-hash')

      const ids = new Set<string>()
      for (let i = 0; i < 10; i++) {
        ids.add(gen.generate('blob', `content-${i}`))
      }
      expect(ids.size).toBe(10)
    })
  })

  // =========================================================================
  // setMode / getMode (要件 13.2)
  // =========================================================================
  describe('setMode / getMode', () => {
    it('should default to sequential mode', () => {
      const gen = new IDGenerator()
      expect(gen.getMode()).toBe('sequential')
    })

    it('should switch between sequential and pseudo-hash', () => {
      const gen = new IDGenerator()

      gen.setMode('pseudo-hash')
      expect(gen.getMode()).toBe('pseudo-hash')

      gen.setMode('sequential')
      expect(gen.getMode()).toBe('sequential')
    })

    it('should generate IDs according to the current mode after switching', () => {
      const gen = new IDGenerator()

      gen.setMode('sequential')
      const seqId = gen.generate('blob', '')
      expect(seqId).toBe('blob-1')

      gen.setMode('pseudo-hash')
      const hashId = gen.generate('blob', '')
      expect(hashId).toMatch(/^[0-9a-f]{8}$/)
    })
  })

  // =========================================================================
  // remapId (要件 13.2)
  // =========================================================================
  describe('remapId', () => {
    it('should generate a new ID using the current mode', () => {
      const gen = new IDGenerator()
      gen.setMode('sequential')

      const oldId = gen.generate('blob', 'hello')
      expect(oldId).toBe('blob-1')

      const newId = gen.remapId(oldId, 'hello', 'blob')
      expect(newId).toBe('blob-2')
    })

    it('should use the objectType parameter for sequential mode', () => {
      const gen = new IDGenerator()
      gen.setMode('sequential')

      const id = gen.remapId('old-id', 'content', 'tree')
      expect(id).toBe('tree-1')
    })
  })
})
