# sironekotoro blog

はてなブログ (sironekotoro.hateblo.jp) から GitHub Pages への移行プロジェクト

## 技術スタック

- **Static Site Generator**: Astro 7.2.1
- **Build Output**: 静的HTML
- **Hosting**: GitHub Pages
- **Node.js**: >= 22.12.0

## 移行元

- **Source**: Hatena Blog MT Export
- **File**: `migration-source/sironekotoro.hateblo.jp.export.txt`
- **Articles**: 338 published, 37 drafts

## Commands

### Migration

```bash
npm run migrate:full    # 全記事を変換（画像ダウンロード含む）
```

### Development

```bash
npm run dev     # Development server
npm run preview # Preview built site
```

### Build & Test

```bash
npm run build   # 静的build (dist/ に出力)
npm run check  # Astro/TypeScript検査
npm test       # テスト実行
```

### Deployment

GitHub Pages への自動デプロイ:
- main ブランチへの push で自動デプロイ
- workflow_dispatch で手動デプロイ可能

## Image Migration

はてな Fotolife から画像をローカルへダウンロード:

- **Downloaded**: 218 images (18.30 MB)
- **Skipped**: 24 external images (third-party)
- **Location**: `public/images/migrated/`
- **Manifest**: `reports/image-manifest.json`

再実行時は 이미 존재하는 이미지를 다시 다운로드하지 않습니다.

## URL Preservation

旧はてなブログのURL構造を保持:
- `/entry/YYYY/MM/DD/hhmmss/`

## Project Structure

```
├── migration-source/     # Hatena export (read-only)
├── scripts/               # Migration scripts
│   ├── migrate-full.mjs   # Full migration
│   └── mt-lib.mjs        # Export parser
├── src/
│   ├── data/posts/       # Converted articles (JSON)
│   ├── layouts/          # Astro layouts
│   ├── lib/             # Utilities
│   └── pages/           # Route pages
├── public/images/migrated/ # Local images
├── docs/                 # Documentation
└── reports/             # Migration reports
```

## 詳細

- [Migration Report](docs/migration-report.md)
