# 要件定義書: 物理Gitシミュレータ

## はじめに

物理Gitシミュレータは、Gitの内部構造（blob / tree / commit / branch / HEAD / merge / conflict）を視覚的に再現し、物理Gitゲームのルールを事前検証するための構造シミュレータである。一般的なGitクライアントやCLI学習ツールではなく、Gitを「再発明させる」ための教育・検証用ツールを目指す。

本ドキュメントはMVPスコープに集中し、軽量な実装を前提とする。

## 用語集

- **Simulator**: 物理Gitシミュレータ本体。Gitの内部構造を可視化・操作するWebアプリケーション
- **Blob**: Gitの不変オブジェクト。ファイル内容を保持する最小単位。本Simulatorでは「形状ワード＋数字ワード」の2ワード組み合わせで内容を表現する
- **Blob_Content**: Blobの内容を表す2ワードの組み合わせ。第1ワードは形状（○・△・□・✕）、第2ワードは数字（1・2・3・4）
- **Content_Matrix**: Blob_Contentの全16通りの組み合わせを4×4グリッドで表示するUI。コンテンツアドレッシングを視覚的に体験させるための仕組み
- **Tree**: Gitの不変オブジェクト。ファイル名とBlob/サブTreeへの参照を保持するディレクトリ構造
- **Commit**: Gitの不変オブジェクト。Tree参照・親Commit参照・メッセージを保持する履歴単位
- **Branch**: 特定のCommitを指す可変参照ラベル
- **HEAD**: 現在のチェックアウト位置を示す可変参照。BranchまたはCommitを指す
- **DAG**: 有向非巡回グラフ（Directed Acyclic Graph）。Commitの履歴構造を表現する
- **Object_Store**: Simulator内でBlob・Tree・Commitを格納する領域
- **Ref_Store**: Simulator内でBranch・HEADなどの可変参照を格納する領域
- **Ancestor**: Merge時の共通祖先Commit
- **Ours**: Merge時のHEAD側（現在のBranch側）の変更内容
- **Theirs**: Merge時の相手側Branchの変更内容
- **Detached_HEAD**: HEADがBranchではなく直接Commitを指している状態
- **Fast_Forward**: Merge時に分岐がなく、Branch参照を単純に進めるだけで済むMerge方式
- **Conflict**: Merge時にOursとTheirsの変更が競合し、自動解決できない状態
- **Resolved_Blob**: Conflict解決後にユーザーが作成する新しいBlob

## 要件

### 要件 1: Blob作成とContent_Matrix

**ユーザーストーリー:** 教育者として、Blobを作成してコンテンツアドレッシングを体験させたい。「同じ内容なら同じIDになる」というGitの原則を視覚的に理解させるためである。

#### 受け入れ基準

1. THE Simulator SHALL Blob_Contentの入力として、第1ワード（○・△・□・✕）と第2ワード（1・2・3・4）をそれぞれドロップダウンで選択させる
2. WHEN ユーザーがBlob作成ボタンを押す, THE Simulator SHALL 選択されたBlob_Contentを持つ新しいBlobをObject_Storeに追加する
3. WHEN Blobが作成される, THE Simulator SHALL そのBlobに一意のIDを割り当てる
4. THE Simulator SHALL Blob_Contentの全16通りの組み合わせを4×4のContent_Matrixとして常時表示する（行：形状、列：数字）
5. WHEN Blobが作成される, THE Simulator SHALL Content_Matrix上の対応するセルにそのBlob IDを表示する
6. WHEN ユーザーが既に登録済みのBlob_Contentを選択する, THE Simulator SHALL Blob作成ボタンを無効化し、Content_Matrix上の対応セルをハイライト表示するとともに、Blob作成UI内に「この内容のBlobはすでに登録済みです（ID: {既存BlobID}）」というメッセージを表示する
7. WHEN Blobが作成された後に内容の変更が試みられる, THE Simulator SHALL その変更を拒否し、Blobが不変オブジェクトであることを表示する

### 要件 2: Tree作成

**ユーザーストーリー:** 教育者として、Treeを作成してディレクトリ構造を表現したい。ファイル名と内容が分離されていることを理解させるためである。

#### 受け入れ基準

1. WHEN ユーザーがTree作成を実行する, THE Simulator SHALL エントリ一覧（名前・参照先）を持つ新しいTreeをObject_Storeに追加する
2. THE Simulator SHALL Treeのエントリ参照先としてBlobまたは別のTreeを指定可能とする
3. WHEN Treeが作成される, THE Simulator SHALL そのTreeに一意のIDを割り当てる
4. WHEN Treeが作成された後に構造の変更が試みられる, THE Simulator SHALL その変更を拒否し、Treeが不変オブジェクトであることを表示する
5. WHEN Treeのエントリに存在しないオブジェクトIDが指定される, THE Simulator SHALL エラーを表示し、Tree作成を中止する

### 要件 3: Commit作成

**ユーザーストーリー:** 学習者として、Commitを作成して履歴を積み上げたい。CommitがTreeと親Commitへの参照で構成されることを理解するためである。

#### 受け入れ基準

1. WHEN ユーザーがCommit作成を実行する, THE Simulator SHALL 指定されたTree参照・親Commit参照・メッセージを持つ新しいCommitをObject_Storeに追加する
2. THE Simulator SHALL 親Commitが0個（初期Commit）のCommit作成を許可する
3. THE Simulator SHALL 親Commitが1個（通常Commit）のCommit作成を許可する
4. THE Simulator SHALL 親Commitが2個以上（Merge Commit）のCommit作成を許可する
5. WHEN Commitが作成される, THE Simulator SHALL そのCommitに一意のIDを割り当てる
6. WHEN Commitが作成された後に内容の変更が試みられる, THE Simulator SHALL その変更を拒否し、Commitが不変オブジェクトであることを表示する
7. WHEN 存在しないTree IDがCommitに指定される, THE Simulator SHALL エラーを表示し、Commit作成を中止する


### 要件 4: Branch操作

**ユーザーストーリー:** 学習者として、Branchを作成・移動したい。Branchが単なるCommitへのラベルであることを理解するためである。

#### 受け入れ基準

1. WHEN ユーザーがBranch作成を実行する, THE Simulator SHALL 指定されたCommitを指す新しいBranchをRef_Storeに追加する
2. WHEN ユーザーがBranch移動を実行する, THE Simulator SHALL 指定されたBranchの参照先を新しいCommitに更新する
3. WHEN 存在しないCommit IDがBranch作成に指定される, THE Simulator SHALL エラーを表示し、Branch作成を中止する
4. WHEN 既に存在するBranch名で作成が試みられる, THE Simulator SHALL エラーを表示し、重複Branch作成を中止する

### 要件 5: HEAD操作とCheckout

**ユーザーストーリー:** 学習者として、HEADの向きを変更したい。「今どこにいるか」がGit操作の基準であることを理解するためである。

#### 受け入れ基準

1. WHEN ユーザーがBranchへのCheckoutを実行する, THE Simulator SHALL HEADの参照先を指定されたBranchに更新する
2. WHEN ユーザーがCommitへのCheckoutを実行する, THE Simulator SHALL HEADの参照先を指定されたCommitに直接設定し、Detached_HEAD状態であることを表示する
3. THE Simulator SHALL 現在のHEADの参照先（BranchまたはCommit）を常に画面上に表示する
4. WHEN 存在しないBranch名またはCommit IDでCheckoutが試みられる, THE Simulator SHALL エラーを表示し、Checkout操作を中止する

### 要件 6: Commit操作（高レベル）

**ユーザーストーリー:** 学習者として、現在の状態から新しいCommitを作成する一連の流れを体験したい。Blob・Tree・Commitの生成過程を理解するためである。

#### 受け入れ基準

1. WHEN ユーザーがCommit操作を実行する, THE Simulator SHALL 新しいBlob、Tree、Commitの生成過程をステップごとに表示する
2. WHEN Commit操作が完了する, THE Simulator SHALL HEADが指すBranchの参照先を新しいCommitに進める
3. WHILE HEADがDetached_HEAD状態である, WHEN ユーザーがCommit操作を実行する, THE Simulator SHALL 新しいCommitを作成し、HEADの参照先を新しいCommitに直接更新する
4. WHEN Commit操作が完了する, THE Simulator SHALL 既存のオブジェクト（Blob・Tree・Commit）が変更されていないことを確認可能な表示を提供する

### 要件 7: Merge操作

**ユーザーストーリー:** 学習者として、2つのBranchをMergeしたい。Fast_Forward・通常Merge・Conflictの違いを理解するためである。

#### 受け入れ基準

1. WHEN ユーザーがMerge操作を実行する, THE Simulator SHALL Merge元Branch、Merge先Branch、Ancestorの3つを可視化する
2. WHEN Merge対象がFast_Forward可能である, THE Simulator SHALL Fast_Forward可能であることを表示し、Branch参照の移動のみで完了する
3. WHEN Merge対象がFast_Forward不可でConflictがない, THE Simulator SHALL 新しいMerge Commitを作成し、2つの親Commitへの参照を持たせる
4. WHEN Merge対象にConflictがある, THE Simulator SHALL Conflict状態であることを表示し、Conflict解決フローに遷移する
5. WHEN Merge操作が完了する, THE Simulator SHALL HEADが指すBranchの参照先をMerge結果のCommitに進める
6. WHEN 同一ファイルについてOursのみがAncestorから変更されている, THE Simulator SHALL Oursの内容を自動採用してConflictなしとして扱う
7. WHEN 同一ファイルについてTheirsのみがAncestorから変更されている, THE Simulator SHALL Theirsの内容を自動採用してConflictなしとして扱う
8. WHEN 同一ファイルについてOursとTheirsの両方がAncestorから変更されている, THE Simulator SHALL そのファイルをConflictとして扱い、ユーザーに手動解決を求める

### 要件 8: Conflict可視化と解決

**ユーザーストーリー:** 学習者として、Conflict発生時にAncestor・Ours・Theirsの3つを比較したい。Conflictの構造を理解し、OursとTheirsの意味を体験的に学ぶためである。

#### 受け入れ基準

1. WHEN Conflictが発生する, THE Simulator SHALL Ancestor・Ours・Theirsの3行をワード単位で色分けして並べて表示する
2. THE Simulator SHALL Ancestorから変更されたワード（word1またはword2）を視覚的に強調し、どのワードが変わったかを明示する
3. THE Simulator SHALL OursをHEAD側の変更、Theirsを相手Branch側の変更として明示的にラベル表示する
4. WHEN ユーザーがConflict解決方法を選択する, THE Simulator SHALL 以下の3択をボタンとして提供する：Ours採用・Theirs採用・Content_Matrixから新規Blob選択
5. WHEN ユーザーが「Content_Matrixから新規Blob選択」を選ぶ, THE Simulator SHALL Content_Matrixを表示し、任意のBlob（登録済みまたは新規作成）を解決結果として選択させる
6. WHEN Conflict解決が完了する, THE Simulator SHALL 解決結果を含むMerge Commitの作成を許可する


### 要件 9: DAGグラフ表示

**ユーザーストーリー:** 学習者として、Commitの履歴をDAGとして視覚的に確認したい。履歴が1本線ではなく分岐・合流する構造であることを理解するためである。

#### 受け入れ基準

1. THE Simulator SHALL Commitの履歴をDAGとしてグラフ表示する
2. THE Simulator SHALL グラフ上でBranchの分岐とMergeの合流を視覚的に区別可能に表示する
3. THE Simulator SHALL グラフ上で各Commitの親Commit参照を矢印または線で表示する
4. THE Simulator SHALL グラフ上でBranch名とHEADの位置をラベルとして表示する
5. THE Simulator SHALL HEADの現在位置を他のBranchと視覚的に区別して強調表示する

### 要件 10: オブジェクト・参照表示

**ユーザーストーリー:** 学習者として、選択したオブジェクトの詳細を確認したい。Blob・Tree・Commitの内部構造を理解するためである。

#### 受け入れ基準

1. WHEN ユーザーがCommitを選択する, THE Simulator SHALL そのCommitのID・Tree参照・親Commit参照・メッセージを表示する
2. WHEN ユーザーがTreeを選択する, THE Simulator SHALL そのTreeのID・エントリ一覧（名前・種別・参照先ID）を表示する
3. WHEN ユーザーがBlobを選択する, THE Simulator SHALL そのBlobのID・内容を表示する
4. THE Simulator SHALL 現在のすべてのBranch名とその参照先Commit IDを一覧表示する
5. THE Simulator SHALL 現在のHEADの参照先（Branch名またはCommit ID）を表示する

### 要件 11: オブジェクト種別の視覚的区別

**ユーザーストーリー:** 学習者として、Blob・Tree・Commit・Branch・HEADを視覚的に区別したい。初見でもオブジェクトの種別を直感的に把握するためである。

#### 受け入れ基準

1. THE Simulator SHALL Blob・Tree・Commit・Branch・HEADをそれぞれ異なる色または形状で表示する
2. THE Simulator SHALL 不変オブジェクト（Blob・Tree・Commit）と可変参照（Branch・HEAD）を視覚的に区別可能に表示する
3. THE Simulator SHALL 初回利用時に各色・形状とオブジェクト種別の対応を確認できる凡例を提供する

### 要件 12: 不変オブジェクトの整合性

**ユーザーストーリー:** 教育者として、一度作成されたオブジェクトが変更されないことを学習者に示したい。Gitの不変性の原則を理解させるためである。

#### 受け入れ基準

1. THE Simulator SHALL Blob・Tree・Commitを作成後に変更不可として扱う
2. WHEN 不変オブジェクトへの変更操作が試みられる, THE Simulator SHALL 変更を拒否し、不変オブジェクトである旨のメッセージを表示する
3. WHEN 新しいCommitが作成される, THE Simulator SHALL 既存のオブジェクトが変更されていないことを検証可能な手段を提供する

### 要件 13: ID方式切替

**ユーザーストーリー:** 教育者として、オブジェクトIDの表示方式を切り替えたい。学習段階に応じて連番・疑似ハッシュを使い分けるためである。

#### 受け入れ基準

1. THE Simulator SHALL オブジェクトIDの表示方式として連番モード・疑似ハッシュモードの2つを提供する
2. WHEN ユーザーがID表示方式を切り替える, THE Simulator SHALL すべてのオブジェクトのID表示を選択された方式に即座に更新する
3. THE Simulator SHALL BlobのコンテンツアドレッシングはContent_Matrixによって視覚的に体験させる（IDモードに関わらず同一内容のBlobは同一セルに対応する）

### 要件 14: Fix操作（履歴を書き換えない修正）

**ユーザーストーリー:** 学習者として、過去の変更に対する修正を新しいCommitとして積み上げたい。履歴を書き換えずに修正する方法を理解するためである。

#### 受け入れ基準

1. WHEN ユーザーがFix操作を実行する, THE Simulator SHALL 過去の変更に対する修正を新しいCommitとしてObject_Storeに追加する
2. WHEN Fix操作が完了する, THE Simulator SHALL 既存のCommit履歴が変更されていないことを確認可能に表示する
3. THE Simulator SHALL Fix用Branchの作成と運用をサポートする

