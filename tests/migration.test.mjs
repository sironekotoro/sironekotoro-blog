import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseMt, assertCorpus, oldPath, parseJstDate, imageUrls, FIXTURE_EXPECTED } from '../scripts/mt-lib.mjs';

const FIXTURE = path.resolve('tests/fixtures/sample-export.txt');

test('fixture: parses all entries with correct publish/draft split', async () => {
  const entries = await parseMt(FIXTURE);
  const { publish, draft, summary } = assertCorpus(entries, FIXTURE_EXPECTED);
  assert.equal(summary.total, 5);
  assert.equal(summary.publish, 4);
  assert.equal(summary.draft, 1);
  assert.equal(publish.length, 4);
  assert.equal(draft.length, 1);
  assert.equal(summary.publishBasenameMissing, 0);
  assert.equal(summary.publishBasenameDuplicates, 0);
});

test('fixture: metadata extraction (title, date, category, basename)', async () => {
  const entries = await parseMt(FIXTURE);
  const byBasename = new Map(entries.map((e) => [e.basename, e]));

  const en = byBasename.get('2024/01/15/120000');
  assert.ok(en);
  assert.equal(en.title, 'Hello Astro Migration');
  assert.equal(en.status, 'Publish');
  assert.match(en.body, /public sample article/);

  const jp = byBasename.get('2024/02/01/080000');
  assert.ok(jp);
  assert.equal(jp.title, '日本語のタイトル');
  assert.deepEqual(jp.categories, ['perl', '技術']);
  assert.match(jp.body, /日本語本文/);

  const draft = byBasename.get('2024/03/01/100000');
  assert.ok(draft);
  assert.equal(draft.status, 'Draft');
  assert.match(draft.body, /draft body/);
});

test('fixture: date parsing produces valid JST ISO timestamps', async () => {
  const entries = await parseMt(FIXTURE);
  for (const entry of entries) {
    const iso = parseJstDate(entry.date);
    assert.ok(!Number.isNaN(Date.parse(iso)), `invalid date for ${entry.basename}`);
    assert.match(iso, /T\d{2}:\d{2}:\d{2}\.000Z$/);
  }
  const first = parseJstDate('01/15/2024 12:00:00');
  assert.equal(first, '2024-01-15T03:00:00.000Z');
});

test('fixture: oldPath preserves basename under /entry/', async () => {
  const entries = await parseMt(FIXTURE);
  for (const entry of entries) {
    assert.match(oldPath(entry), /^\/entry\//);
  }
  assert.equal(oldPath(entries[0]), '/entry/2024/01/15/120000');
});

test('fixture: image URL extraction finds fotolife and keeps srcs', async () => {
  const entries = await parseMt(FIXTURE);
  const withImage = entries.find((e) => e.basename === '2024/01/15/120000');
  assert.ok(withImage);
  const urls = imageUrls(withImage.body);
  assert.ok(urls.length >= 1);
  assert.match(urls[0], /cdn-ak\.f\.st-hatena\.com/);
});

test('fixture: body preservation keeps html, code, table, multiline', async () => {
  const entries = await parseMt(FIXTURE);
  const byBasename = new Map(entries.map((e) => [e.basename, e]));
  assert.match(byBasename.get('2024/01/15/120000').body, /<pre class="code/);
  assert.match(byBasename.get('2024/02/01/080000').body, /<table>/);
  assert.match(byBasename.get('2024/05/01/140000').body, /line3/);
  assert.match(byBasename.get('2024/04/01/090000').body, /<iframe/);
});

test('fixture: idempotent parse (same input yields same structure)', async () => {
  const a = await parseMt(FIXTURE);
  const b = await parseMt(FIXTURE);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('generated data: all published posts present and no drafts', async () => {
  const files = (await readdir('src/data/posts')).filter((f) => f.endsWith('.json'));
  assert.equal(files.length, 338);
  for (const file of files) {
    const raw = await readFile(`src/data/posts/${file}`, 'utf8');
    const post = JSON.parse(raw);
    assert.equal(post.status, 'Publish');
    assert.ok(post.title.length > 0, `empty title in ${file}`);
    assert.ok(post.html.length > 0, `empty body in ${file}`);
    assert.ok(post.publishedAt, `missing date in ${file}`);
    assert.match(post.oldPath, /^\/entry\//);
  }
});

test('generated data: no duplicate output paths', async () => {
  const files = (await readdir('src/data/posts')).filter((f) => f.endsWith('.json'));
  const paths = new Set();
  for (const file of files) {
    const post = JSON.parse(await readFile(`src/data/posts/${file}`, 'utf8'));
    assert.ok(!paths.has(post.oldPath), `duplicate path ${post.oldPath}`);
    paths.add(post.oldPath);
  }
});

test('generated data: no draft markers or draft titles leaked', async () => {
  const files = (await readdir('src/data/posts')).filter((f) => f.endsWith('.json'));
  const draftMarkers = ['（ボツ）', 'VSCodeから日本語でChromeを操作する', '簿記の勉強をやり直してみた', 'secret-draft-marker-fragment'];
  for (const file of files) {
    const raw = await readFile(`src/data/posts/${file}`, 'utf8');
    const post = JSON.parse(raw);
    for (const marker of draftMarkers) {
      assert.ok(!post.title.includes(marker), `draft title leak ${marker} in ${file}`);
      assert.ok(!post.html.includes(marker), `draft body leak ${marker} in ${file}`);
    }
  }
});
