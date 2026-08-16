# Migration Source

このディレクトリには、はてなブログのMTエクスポート原本を配置します。

## 重要

**export原本はGit管理対象外です。**

`migration-source/*.export.txt` は `.gitignore` により無視されます。理由:

- exportには下書き37件を含む非公開コンテンツが含まれます
- repositoryをPublicにした場合、export原本を公開してはいけません

## 配置方法

`migrate:full` を実行する前に、以下を配置してください。

```text
migration-source/sironekotoro.hateblo.jp.export.txt
```

## 想定構成

```text
migration-source/
├── README.md                          # 本ファイル
└── sironekotoro.hateblo.jp.export.txt # ローカルのみ (Git管理外)
```

## 再生成コマンド

export原本が配置されていれば、`npm run migrate:full` で記事JSONを再生成できます。