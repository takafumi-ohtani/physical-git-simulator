# 実装計画: 物理Gitシミュレータ

## 概要

Gitの内部構造を視覚的に再現するWebアプリケーションを、React + TypeScript（Vite）で軽量に実装する。Core Engine（純粋ロジック）→ State Management → UI の順に段階的に構築し、各ステップで動作確認を行う。

## タスク

- [x] 1. プロジェクト初期セットアップとコア型定義
  - [x] 1.1 Vite + React + TypeScriptプロジェクトを作成し、Vitest を設定する
    - `npm create vite` でプロジェクト生成
    - Vitest の設定ファイルを追加
    - _要件: 全体基盤_

  - [x] 1.2 コアの型定義ファイルを作成する
    - `src/core/types.ts` に `ObjectId`, `Blob`, `TreeEntry`, `Tree`, `Commit`, `GitObject`, `HeadRef`, `IdMode` の型を定義
    - `src/core/types.ts` に `MergeResult`, `FastForwardResult`, `NormalMergeResult`, `ConflictResult`, `ConflictEntry`, `ResolveChoice` の型を定義
    - _要件: 1.2, 2.3, 3.5, 12.1_

- [x] 2. IDGenerator の実装
  - [x] 2.1 `src/core/id-generator.ts` に IDGenerator を実装する
    - `sequential` モード: `blob-1`, `tree-2`, `commit-3` 形式の連番生成
    - `pseudo-hash` モード: ランダム8文字hex生成
    - `content-hash` モード: `crypto.subtle` を使ったSHA-1先頭8文字生成
    - `setMode`, `getMode`, `remapId` メソッドを実装
    - _要件: 13.1, 13.2, 13.3_

  - [x] 2.2 IDGenerator のユニットテストを作成する
    - 3モードそれぞれでIDが生成されることを検証
    - 同一内容で content-hash モードが同一IDを返すことを検証
    - モード切替と remapId の動作を検証
    - _要件: 13.1, 13.2, 13.3_

- [x] 3. ObjectStore の実装
  - [x] 3.1 `src/core/object-store.ts` に ObjectStore を実装する
    - `addBlob`: 内容からBlobを作成、同一内容チェック付き（`findBlobByContent`）
    - `addTree`: エントリの参照先存在チェック付き
    - `addCommit`: Tree参照・親Commit参照の存在チェック付き
    - `get`, `has`, `getAllByType` メソッドを実装
    - `Object.freeze()` で不変性を保証
    - _要件: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 12.1, 12.2_

  - [x] 3.2 ObjectStore のユニットテストを作成する
    - Blob作成・同一内容検出・不変性拒否を検証
    - Tree作成・参照先チェック・不変性拒否を検証
    - Commit作成（親0/1/2個）・参照チェック・不変性拒否を検証
    - _要件: 1.1-1.4, 2.1-2.5, 3.1-3.7, 12.1-12.2_

- [x] 4. RefStore の実装
  - [x] 4.1 `src/core/ref-store.ts` に RefStore を実装する
    - `createBranch`, `moveBranch`, `deleteBranch`, `getBranch`, `getAllBranches` を実装
    - `getHead`, `checkoutBranch`, `checkoutCommit`（Detached HEAD）, `advanceHead` を実装
    - Branch名重複チェック、存在しないCommit IDチェックを実装
    - _要件: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4_

  - [x] 4.2 RefStore のユニットテストを作成する
    - Branch CRUD操作を検証
    - HEAD操作（Branch checkout, Commit checkout, advanceHead）を検証
    - エラーケース（重複Branch、存在しないCommit）を検証
    - _要件: 4.1-4.4, 5.1-5.4_

- [x] 5. チェックポイント - Core Engine基盤の確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 6. MergeEngine の実装
  - [x] 6.1 `src/core/merge-engine.ts` に MergeEngine を実装する
    - `findAncestor`: 2つのCommitの共通祖先を探索（BFS）
    - `isFastForward`: Fast-Forward判定
    - `merge`: Fast-Forward / Normal / Conflict の3パターンを処理
    - `resolveConflict`: Ours採用・Theirs採用・手動解決の3方式
    - _要件: 7.1, 7.2, 7.3, 7.4, 7.5, 8.3, 8.4, 8.5_

  - [x] 6.2 MergeEngine のユニットテストを作成する
    - Fast-Forward判定・Normal Merge・Conflict検出を検証
    - Ancestor探索の正確性を検証
    - Conflict解決（ours/theirs/manual）を検証
    - _要件: 7.1-7.5, 8.3-8.5_

- [x] 7. 差分表示ユーティリティの実装
  - [x] 7.1 `src/core/diff.ts` に行単位diffユーティリティを実装する
    - 2つの文字列の行単位差分を計算
    - 追加・削除・変更行の識別
    - _要件: 15.1, 15.2_

- [x] 8. 永続化レイヤーの実装
  - [x] 8.1 `src/core/persistence.ts` に localStorage ベースの永続化を実装する
    - `PersistedState` 形式でのシリアライズ・デシリアライズ
    - 保存・読み込み・クリア機能
    - _要件: 全体基盤_

- [x] 9. State Management（useReducer + Context）の実装
  - [x] 9.1 `src/state/types.ts` に SimulatorState, SimulatorAction, StepRecord の型を定義する
    - _要件: 6.1, 6.4_

  - [x] 9.2 `src/state/reducer.ts` に simulatorReducer を実装する
    - `CREATE_BLOB`, `CREATE_TREE`, `CREATE_COMMIT` アクション
    - `HIGH_LEVEL_COMMIT` アクション（Blob→Tree→Commit のステップ記録付き）
    - `CREATE_BRANCH`, `MOVE_BRANCH`, `CHECKOUT_BRANCH`, `CHECKOUT_COMMIT` アクション
    - `START_MERGE`, `RESOLVE_CONFLICT`, `COMPLETE_MERGE` アクション
    - `FIX_COMMIT`, `SET_ID_MODE`, `SELECT_OBJECT` アクション
    - 各アクションで StepRecord を stepHistory に追加
    - _要件: 1.1, 2.1, 3.1, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2, 6.3, 7.2, 7.3, 7.4, 7.5, 13.2, 14.1_

  - [x] 9.3 `src/state/context.tsx` に SimulatorContext と SimulatorProvider を実装する
    - useReducer でステート管理
    - localStorage への自動保存（useEffect）
    - _要件: 全体基盤_

- [x] 10. チェックポイント - ロジック層の確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 11. DAGレイアウト計算の実装
  - [x] 11.1 `src/ui/dag-layout.ts` に DAGLayout 計算ロジックを実装する
    - トポロジカルソートに基づくノード配置
    - Branch列の水平位置割り当て
    - 親子間のエッジ計算
    - _要件: 9.1, 9.2, 9.3_

- [x] 12. DAGグラフ表示コンポーネントの実装
  - [x] 12.1 `src/ui/components/DAGGraphView.tsx` を実装する
    - SVG直接描画でCommitノード（黄色円）、エッジ（矢印線）を描画
    - BranchLabel（紫ラベル）、HeadIndicator（赤矢印ラベル）を描画
    - ノードクリックで `SELECT_OBJECT` アクションをディスパッチ
    - _要件: 9.1, 9.2, 9.3, 9.4, 9.5, 11.1, 11.2_

- [x] 13. CommandPanel（操作パネル）の実装
  - [x] 13.1 `src/ui/components/CommandPanel.tsx` と各サブコンポーネントを実装する
    - BlobCreator: テキスト入力 → CREATE_BLOB ディスパッチ
    - TreeCreator: エントリ追加UI → CREATE_TREE ディスパッチ
    - CommitCreator（低レベル）: Tree ID・親ID・メッセージ入力 → CREATE_COMMIT ディスパッチ
    - HighLevelCommit: ファイル名+内容入力 → HIGH_LEVEL_COMMIT ディスパッチ
    - BranchManager: Branch作成・移動UI
    - CheckoutPanel: Branch/Commit checkout UI
    - MergePanel: Merge元Branch選択 → START_MERGE ディスパッチ
    - FixPanel: Fix操作UI → FIX_COMMIT ディスパッチ
    - _要件: 1.1, 2.1, 3.1, 4.1, 4.2, 5.1, 5.2, 6.1, 7.1, 14.1, 14.3_

- [x] 14. DetailPanel（詳細表示パネル）の実装
  - [x] 14.1 `src/ui/components/DetailPanel.tsx` と各サブコンポーネントを実装する
    - ObjectDetail: 選択されたBlob/Tree/Commitの詳細表示
    - RefList: 全Branch名と参照先Commit ID一覧、HEAD表示
    - StepHistory: 操作ステップの履歴表示
    - _要件: 10.1, 10.2, 10.3, 10.4, 10.5, 6.1, 6.4_

- [x] 15. ConflictResolver（Conflict解決UI）の実装
  - [x] 15.1 `src/ui/components/ConflictResolver.tsx` を実装する
    - ThreeWayView: Ancestor・Ours・Theirsの3カラム並列表示
    - DiffHighlight: 差分行の色分け強調表示（diffユーティリティ利用）
    - ResolveActions: Ours採用・Theirs採用・手動解決の3ボタン
    - 手動解決時のテキストエディタ
    - 解決完了で RESOLVE_CONFLICT → COMPLETE_MERGE ディスパッチ
    - _要件: 8.1, 8.2, 8.3, 8.4, 8.5, 15.1, 15.2_

- [x] 16. App全体レイアウトと統合
  - [x] 16.1 `src/App.tsx` にメインレイアウトを実装する
    - Header: タイトル、IDモード切替（SET_ID_MODE）
    - MainLayout: CommandPanel（左）+ DAGGraphView（中央）+ DetailPanel（右）の3カラム
    - ConflictResolver: Merge中のConflict時にモーダル表示
    - Legend: オブジェクト種別の凡例（色・形状の対応表）
    - SimulatorProvider でアプリ全体をラップ
    - _要件: 5.3, 11.1, 11.2, 11.3, 13.2_

  - [x] 16.2 基本的なCSSスタイルを実装する
    - オブジェクト種別ごとの色分け（Blob:青, Tree:緑, Commit:黄, Branch:紫, HEAD:赤）
    - 不変オブジェクトと可変参照の視覚的区別
    - シンプルで軽量なレイアウト
    - _要件: 11.1, 11.2, 11.3_

- [x] 17. チェックポイント - 全体統合の確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 18. エラーハンドリングとバリデーション強化
  - [x] 18.1 各操作のエラーメッセージとバリデーションを統合する
    - 同一内容Blob作成時の通知メッセージ
    - 不変オブジェクト変更試行時の拒否メッセージ
    - 存在しないID参照時のエラーメッセージ
    - Branch名重複時のエラーメッセージ
    - Detached HEAD状態の警告表示
    - _要件: 1.3, 1.4, 2.4, 2.5, 3.6, 3.7, 4.3, 4.4, 5.4, 12.2, 12.3_

  - [x] 18.2 エラーハンドリングの統合テストを作成する
    - 各エラーケースが正しくメッセージ表示されることを検証
    - _要件: 1.3, 1.4, 2.4, 2.5, 3.6, 3.7, 4.3, 4.4, 5.4_

- [x] 19. 最終チェックポイント - 全テスト通過確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- `*` マーク付きタスクはオプションであり、MVP優先時はスキップ可能
- 各タスクは対応する要件番号を参照しトレーサビリティを確保
- チェックポイントで段階的に動作確認を実施
- ユーザー要望に基づき、GUIはシンプル・軽量に実装する
