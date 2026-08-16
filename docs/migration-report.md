# Migration Report

## Source

- **Hatena Blog**: sironekotoro.hateblo.jp
- **Export File**: `migration-source/sironekotoro.hateblo.jp.export.txt`
- **Export Date**: 2026-08-17
- **Total Articles**: 375 (338 published, 37 drafts)

## Date Range

- **Oldest Published**: 2013-09-23
- **Newest Published**: 2026-04-20

## Converter

- **Script**: `scripts/migrate-full.mjs`
- **Language**: Node.js (ESM)
- **Output**: JSON files in `src/data/posts/`

### Features

- Parses Movable Type export format
- Extracts title, date, categories, basename
- Converts internal links from full URLs to relative paths
- Sanitizes HTML for security
- Downloads Hatena Fotolife images locally
- Maintains idempotent manifest for image downloads

## URL Preservation

- **Strategy**: Preserve original path structure
- **Output Pattern**: `/entry/YYYY/MM/DD/hhmmss/`
- **Redirects**: None required (all paths preserved exactly)

## Image Migration

- **Total Image References**: 242
- **Fotolife Images**: 218 (successfully downloaded)
- **External Images**: 24 (third-party, kept original URLs)
- **Download Success Rate**: 100%
- **Total Downloaded Size**: 18.30 MB
- **Local Image Directory**: `public/images/migrated/`
- **Manifest**: `reports/image-manifest.json`

### Image Manifest Format

```json
{
  "https://cdn-ak.f.st-hatena.com/...": {
    "local": "/images/migrated/abc123.png",
    "status": "success",
    "size": 12345
  }
}
```

## Migration Statistics

- **Articles Converted**: 338
- **Articles Skipped**: 37 (drafts)
- **Internal Links Processed**: Yes (rewritten to relative paths)
- **Image References**: 242 total, 218 local

## Site Architecture

- **Static Site Generator**: Astro 7.2.1
- **Output**: Static HTML
- **Build Output**: `dist/`
- **Hosting**: GitHub Pages

### Directory Structure

```
src/
├── data/posts/       # Converted article JSON files
├── layouts/          # Astro layouts
├── lib/              # Post loading utilities
├── pages/            # Route pages
│   ├── entry/[...path].astro  # Dynamic article pages
│   ├── index.astro            # Homepage
│   └── posts/index.astro      # Archive
public/
└── images/migrated/  # Downloaded Fotolife images
```

## Build & Validation

- **Astro Check**: PASS
- **Tests**: 3 tests, all passing
- **Build**: 341 pages generated
- **Broken Images**: 0

## Known Limitations

- Draft articles not published (excluded from build)
- Third-party images kept at original URLs
- Hatena-specific syntax (keywords, blog cards) kept as-is
- Comments not migrated (not in export)

## Re-run Instructions

```bash
# Full migration with image download
npm run migrate:full

# Build the site
npm run build

# Run tests
npm test

# Check types
npm run check
```

## GitHub Pages Deployment

- **Workflow**: `.github/workflows/deploy.yml`
- **Trigger**: Push to main branch
- **Manual Trigger**: workflow_dispatch available

## Last Migration

- **Date**: 2026-08-17
- **Status**: Complete
