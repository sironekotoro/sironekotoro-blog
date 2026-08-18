import { mkdir, writeFile, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseMt, assertCorpus, oldPath, parseJstDate, imageUrls, features, convertBlogCards, normalizeEmbeds, rewriteInternalLinks, safeHtml, stableJson, shortHash } from './mt-lib.mjs';

const IMAGE_DIR = path.resolve('public/images/migrated');
const MANIFEST_PATH = path.resolve('reports/image-manifest.json');
const IMAGE_STATS_PATH = path.resolve('reports/image-stats.json');

function isFotolife(url) {
  try {
    const host = new URL(url).hostname;
    return host === 'cdn-ak.f.st-hatena.com' || host.endsWith('.f.st-hatena.com');
  } catch {
    return false;
  }
}

async function downloadImage(url, manifest) {
  if (manifest[url]?.local && manifest[url].status === 'success') {
    return manifest[url].local;
  }
  
  const parsed = new URL(url);
  const ext = (path.extname(parsed.pathname).match(/^\.[a-zA-Z0-9]{1,5}$/)?.[0] ?? '.img').toLowerCase();
  const name = `${shortHash(url)}${ext}`;
  const destination = path.join(IMAGE_DIR, name);
  
  try {
    const existingStat = await stat(destination);
    const localPath = `/images/migrated/${name}`;
    manifest[url] = { local: localPath, status: 'success', size: existingStat.size };
    return localPath;
  } catch {
    // File doesn't exist, download it
  }
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    await writeFile(destination, Buffer.from(buffer));
    const size = buffer.byteLength;
    
    const localPath = `/images/migrated/${name}`;
    manifest[url] = { local: localPath, status: 'success', size };
    return localPath;
  } catch (error) {
    manifest[url] = { local: null, status: 'failed', error: error instanceof Error ? error.message : 'unknown error' };
    return null;
  }
}

async function main() {
  const entries = await parseMt();
  const { publish } = assertCorpus(entries);
  console.log(`Processing ${publish.length} published articles...`);

  await mkdir(IMAGE_DIR, { recursive: true });
  
  let manifest = {};
  try {
    const existingManifest = await readFile(MANIFEST_PATH, 'utf8');
    manifest = JSON.parse(existingManifest);
    console.log(`Loaded existing manifest with ${Object.keys(manifest).length} entries`);
  } catch {
    console.log('No existing manifest, starting fresh');
  }

  const dataDir = path.resolve('src/data/posts');
  await mkdir(dataDir, { recursive: true });
  const titleLookup = new Map(publish.map((entry) => [oldPath(entry), entry.title]));
  
  const existingFiles = await readdir(dataDir);
  for (const file of existingFiles) {
    if (file.endsWith('.json')) {
      await rm(path.join(dataDir, file), { force: true });
    }
  }

  const imageStats = { total: 0, fotolife: 0, external: 0, success: 0, failed: 0, skipped: 0, totalSize: 0 };
  const generated = [];
  
  for (const entry of publish) {
    let html = convertBlogCards(entry.body, { titleLookup });
    html = normalizeEmbeds(html);
    html = rewriteInternalLinks(html);
    const urls = [...new Set(imageUrls(html))];
    
    imageStats.total += urls.length;
    const fotolifeUrls = urls.filter(isFotolife);
    const externalUrls = urls.filter(u => !isFotolife(u));
    imageStats.fotolife += fotolifeUrls.length;
    imageStats.external += externalUrls.length;
    
    for (const url of fotolifeUrls) {
      const localPath = await downloadImage(url, manifest);
      if (localPath) {
        html = html.split(url).join(localPath);
        imageStats.success++;
        if (manifest[url]?.size) {
          imageStats.totalSize += manifest[url].size;
        }
      } else {
        imageStats.failed++;
      }
    }
    
    for (const _url of externalUrls) {
      imageStats.skipped++;
    }
    
    html = safeHtml(html);
    const post = {
      title: entry.title,
      basename: entry.basename,
      status: 'Publish',
      publishedAt: parseJstDate(entry.date),
      categories: entry.categories,
      oldPath: oldPath(entry),
      sourceUrl: `https://sironekotoro.hateblo.jp${oldPath(entry)}`,
      html,
      imageUrls: urls,
      features: features(entry)
    };
    const filename = `${shortHash(post.oldPath)}.json`;
    await writeFile(path.join(dataDir, filename), stableJson(post));
    generated.push({ title: post.title, oldPath: post.oldPath, publishedAt: post.publishedAt });
  }

  await writeFile(MANIFEST_PATH, stableJson(manifest));
  await writeFile(IMAGE_STATS_PATH, stableJson(imageStats));
  
  console.log(`\nImage Migration Stats:`);
  console.log(`  Total image references: ${imageStats.total}`);
  console.log(`  Fotolife images: ${imageStats.fotolife}`);
  console.log(`  External images: ${imageStats.external}`);
  console.log(`  Successfully downloaded: ${imageStats.success}`);
  console.log(`  Failed to download: ${imageStats.failed}`);
  console.log(`  Skipped (external): ${imageStats.skipped}`);
  console.log(`  Total downloaded size: ${(imageStats.totalSize / 1024 / 1024).toFixed(2)} MB`);
  
  console.log(`\nGenerated ${generated.length} articles`);
  await writeFile(path.resolve('reports/migration-full.json'), stableJson({ generated: generated.length, posts: generated, imageStats }));
}

main().catch(console.error);
