import type {
  ObjectId,
  Blob,
  TreeEntry,
  Tree,
  Commit,
  GitObject,
} from "./types";
import type { IDGenerator } from "./id-generator";

/**
 * ObjectStore - Gitオブジェクト（Blob / Tree / Commit）の不変ストア
 *
 * すべてのオブジェクトは Object.freeze() で凍結され、作成後の変更は不可。
 * 同一内容のBlobは重複作成されず、既存オブジェクトが返される。
 */
export class ObjectStore {
  private objects: Map<ObjectId, GitObject> = new Map();
  private idGenerator: IDGenerator;

  constructor(idGenerator: IDGenerator) {
    this.idGenerator = idGenerator;
  }

  /**
   * IDGeneratorインスタンスを取得する
   */
  getIdGenerator(): IDGenerator {
    return this.idGenerator;
  }

  /**
   * IDでオブジェクトを取得する
   */
  get(id: ObjectId): GitObject | undefined {
    return this.objects.get(id);
  }

  /**
   * IDのオブジェクトが存在するか確認する
   */
  has(id: ObjectId): boolean {
    return this.objects.has(id);
  }

  /**
   * 指定した型のオブジェクトをすべて取得する
   */
  getAllByType(type: "blob" | "tree" | "commit"): GitObject[] {
    const result: GitObject[] = [];
    for (const obj of this.objects.values()) {
      if (obj.type === type) {
        result.push(obj);
      }
    }
    return result;
  }

  /**
   * 同一内容のBlobを検索する
   */
  findBlobByContent(content: string): Blob | undefined {
    for (const obj of this.objects.values()) {
      if (obj.type === "blob" && obj.content === content) {
        return obj;
      }
    }
    return undefined;
  }

  /**
   * Blobを作成してストアに追加する
   *
   * 同一内容のBlobが既に存在する場合、新規作成せず既存Blobを返す。
   * 返り値の `existing` フラグで重複を判別可能。
   */
  addBlob(content: string): { blob: Blob; existing: boolean } {
    const existingBlob = this.findBlobByContent(content);
    if (existingBlob) {
      return { blob: existingBlob, existing: true };
    }

    const id = this.idGenerator.generate("blob", content);
    const blob: Blob = Object.freeze({
      type: "blob" as const,
      id,
      content,
    });
    this.objects.set(id, blob);
    return { blob, existing: false };
  }

  /**
   * Treeを作成してストアに追加する
   *
   * エントリの参照先オブジェクトがすべて存在することを検証する。
   * 存在しないオブジェクトIDが含まれる場合はエラーをスローする。
   */
  addTree(entries: TreeEntry[]): Tree {
    for (const entry of entries) {
      if (!this.has(entry.objectId)) {
        throw new Error(
          `Treeエントリ "${entry.name}" が存在しないオブジェクトを参照しています: ${entry.objectId}`
        );
      }
    }

    const content = JSON.stringify(entries);
    const id = this.idGenerator.generate("tree", content);
    const frozenEntries = Object.freeze(
      entries.map((e) => Object.freeze({ ...e }))
    );
    const tree: Tree = Object.freeze({
      type: "tree" as const,
      id,
      entries: frozenEntries,
    });
    this.objects.set(id, tree);
    return tree;
  }

  /**
   * Commitを作成してストアに追加する
   *
   * treeIdが存在するTreeを指していること、
   * parentIdsがすべて存在するCommitを指していることを検証する。
   */
  addCommit(
    treeId: ObjectId,
    parentIds: ObjectId[],
    message: string
  ): Commit {
    // Tree参照の検証
    const treeObj = this.get(treeId);
    if (!treeObj || treeObj.type !== "tree") {
      throw new Error(
        `Commitが存在しないまたは無効なTreeを参照しています: ${treeId}`
      );
    }

    // 親Commit参照の検証
    for (const parentId of parentIds) {
      const parentObj = this.get(parentId);
      if (!parentObj || parentObj.type !== "commit") {
        throw new Error(
          `Commitが存在しないまたは無効な親Commitを参照しています: ${parentId}`
        );
      }
    }

    const content = JSON.stringify({ treeId, parentIds, message });
    const id = this.idGenerator.generate("commit", content);
    const commit: Commit = Object.freeze({
      type: "commit" as const,
      id,
      treeId,
      parentIds: Object.freeze([...parentIds]),
      message,
    });
    this.objects.set(id, commit);
    return commit;
  }
}
