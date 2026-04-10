import { describe, it, expect } from 'vitest'
import { IDGenerator } from '../id-generator'

describe('IDGenerator', () => {
  // =========================================================================
  // sequential モード (要件 13.1)
  // =========================================================================
  describe('sequential mode', () => {
    it('should generate IDs in type-N format', () => {
      const gen = new IDGenerator()
      gen.setMode('sequential')

      const blobId = gen.generate('blob', 'hello')
      const treeId = gen.generate('tree', '')
      const commitId = gen.generate('commit', '')

      expect(blobId).toBe('blob-1')
      expect(treeId).toBe('tree-2')
      expect(commitId).toBe('commit-3')
    })

    it('should increment counter across calls', () => {
      const gen = new IDGenerator()
      gen.setMode('sequential')

      const id1 = gen.generate('blob', '')
      const id2 = gen.generate('blob', '')

      expect(id1).toBe('blob-1')
      expect(id2).toBe('blob-2')
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
      // ランダムなので全て異なるはず（衝突確率は極めて低い）
      expect(ids.size).toBe(10)
    })
  })

  // =========================================================================
  // content-hash モード (要件 13.1, 13.3)
  // =========================================================================
  describe('content-hash mode', () => {
    it('should generate 8-char hex strings', () => {
      const gen = new IDGenerator()
      gen.setMode('content-hash')

      const id = gen.generate('blob', 'hello world')

      expect(id).toHaveLength(8)
      expect(id).toMatch(/^[0-9a-f]{8}$/)
    })

    it('should return the same ID for the same content', () => {
      const gen = new IDGenerator()
      gen.setMode('content-hash')

      const id1 = gen.generate('blob', 'same content')
      const id2 = gen.generate('blob', 'same content')

      expect(id1).toBe(id2)
    })

    it('should return different IDs for different content', () => {
      const gen = new IDGenerator()
      gen.setMode('content-hash')

      const id1 = gen.generate('blob', 'content A')
      const id2 = gen.generate('blob', 'content B')

      expect(id1).not.toBe(id2)
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

    it('should switch modes correctly', () => {
      const gen = new IDGenerator()

      gen.setMode('pseudo-hash')
      expect(gen.getMode()).toBe('pseudo-hash')

      gen.setMode('content-hash')
      expect(gen.getMode()).toBe('content-hash')

      gen.setMode('sequential')
      expect(gen.getMode()).toBe('sequential')
    })

    it('should generate IDs according to the current mode after switching', () => {
      const gen = new IDGenerator()

      // sequential
      gen.setMode('sequential')
      const seqId = gen.generate('blob', '')
      expect(seqId).toBe('blob-1')

      // pseudo-hash
      gen.setMode('pseudo-hash')
      const hashId = gen.generate('blob', '')
      expect(hashId).toMatch(/^[0-9a-f]{8}$/)

      // content-hash
      gen.setMode('content-hash')
      const contentId = gen.generate('blob', 'test')
      expect(contentId).toMatch(/^[0-9a-f]{8}$/)
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
      // sequential mode: counter increments, so next is blob-2
      expect(newId).toBe('blob-2')
    })

    it('should produce content-hash based ID when in content-hash mode', () => {
      const gen = new IDGenerator()
      gen.setMode('content-hash')

      const originalId = gen.generate('blob', 'my content')
      const remappedId = gen.remapId('old-id', 'my content', 'blob')

      // Same content → same content-hash
      expect(remappedId).toBe(originalId)
    })

    it('should use the objectType parameter for sequential mode', () => {
      const gen = new IDGenerator()
      gen.setMode('sequential')

      const id = gen.remapId('old-id', 'content', 'tree')
      expect(id).toBe('tree-1')
    })
  })
})
