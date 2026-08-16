# sironekotoro blog

はてなブログ (sironekotoro.hateblo.jp) から GitHub Pages への移行プロジェクト

## 技術スタック

- **Static Site Generator**: Astro 7.2.1
- **Build Output**: 静的HTML
- **Hosting**: GitHub Pages
- **Node.js**: >= 22.12.0

## 重要: export原本はGit管理対象外

はてなブログのMT export (`migration-source/*.export.txt`) は、下書き記事を含むため
**Git repositoryへcommitしません**。`.gitignore` で保護されています。

通常の `npm run build` / `npm run test` / GitHub Pages deploy は
**export原本を必要としません**。既に生成・commit済みの公開コンテンツのみで動作します。

詳細は [`migration-source/README.md`](migration-source/README.md) を参照してください。

## Commands

### 通常build / test / check (export不要)

```bash
npm run build   # 静的build (dist/ に出力)
npm run check  # Astro/TypeScript検査
npm test       # テスト実行 (fixtureベース)
```

### Migration (export原本が必要)

export原本を `migration-source/` に配置した上で実行します。

```bash
npm run migrate:full    # 全記事を変換（画像ダウンロード含む）
```

### Development

```bash
npm run dev     # Development server
npm run preview # Preview built site
```

## Deployment

GitHub Pages への自動デプロイ:
- main ブランチへの push で自動デプロイ
- workflow_dispatch で手動デプロイ可能
- 通常workflowではmigrationを実行しない (committed contentのみでbuild)

## Image Migration

はてな Fotolife から画像をローカルへダウンロード済み:

- **Downloaded**: 218 images (18.30 MB)
- **Skipped**: 24 external images (third-party)
- **Location**: `public/images/migrated/`
- **Manifest**: `reports/image-manifest.json`

## URL Preservation

旧はてなブログのURL構造を保持:
- `/entry/YYYY/MM/DD/hhmmss/`

## Project Structure

```
├── migration-source/     # Hatena export (READMEのみcommit、export原本はGit管理外)
├── scripts/               # Migration scripts
│   ├── migrate-full.mjs   # Full migration (export必須)
│   └── mt-lib.mjs        # Export parser
├── tests/
│   └── fixtures/         # 安全なテストfixture
├── src/
│   ├── data/posts/       # Converted articles (JSON, commit済み)
│   ├── layouts/          # Astro layouts
│   ├── lib/             # Utilities
│   └── pages/           # Route pages
├── public/images/migrated/ # Local images
├── docs/                 # Documentation
└── reports/             # Migration reports
```

## 詳細

- [Migration Report](docs/migration-report.md)
- [Migration Source README](migration-source/README.md)
