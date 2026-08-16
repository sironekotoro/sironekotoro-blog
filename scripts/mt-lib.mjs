import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const SOURCE = path.resolve('migration-source/sironekotoro.hateblo.jp.export.txt');
export const EXPECTED = { total: 375, publish: 338, draft: 37 };

export async function parseMt(file = SOURCE) {
  const bytes = await readFile(file);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const chunks = text.split(/^--------\r?$/m).map((value) => value.trim()).filter(Boolean);
  return chunks.map((chunk, index) => parseEntry(chunk, index));
}

function parseEntry(chunk, index) {
  const firstSeparator = chunk.search(/^-----\r?$/m);
  const header = firstSeparator >= 0 ? chunk.slice(0, firstSeparator) : chunk;
  const sections = firstSeparator >= 0 ? chunk.slice(firstSeparator + 5) : '';
  const fields = {};
  let lastKey = '';
  for (const line of header.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z ]+):\s?(.*)$/);
    if (match) {
      lastKey = match[1];
      const value = match[2] ?? '';
      if (lastKey === 'CATEGORY') (fields.CATEGORY ??= []).push(value);
      else fields[lastKey] = value;
    } else if (lastKey && typeof fields[lastKey] === 'string') fields[lastKey] += `\n${line}`;
  }
  const bodyMatch = sections.match(/(?:^|\r?\n)BODY:\r?\n([\s\S]*?)(?=\r?\n-----\r?\n[A-Z][A-Z ]+:|$)/);
  return {
    index,
    title: String(fields.TITLE ?? ''),
    basename: String(fields.BASENAME ?? ''),
    status: String(fields.STATUS ?? ''),
    date: String(fields.DATE ?? ''),
    categories: Array.isArray(fields.CATEGORY) ? fields.CATEGORY : [],
    image: String(fields.IMAGE ?? ''),
    body: bodyMatch?.[1] ?? '',
  };
}

export function assertCorpus(entries) {
  const publish = entries.filter((entry) => entry.status === 'Publish');
  const draft = entries.filter((entry) => entry.status === 'Draft');
  const missing = publish.filter((entry) => !entry.basename);
  const counts = new Map();
  for (const entry of publish) counts.set(entry.basename, (counts.get(entry.basename) ?? 0) + 1);
  const duplicates = [...counts].filter(([, count]) => count > 1);
  const actual = { total: entries.length, publish: publish.length, draft: draft.length };
  if (actual.total !== EXPECTED.total || actual.publish !== EXPECTED.publish || actual.draft !== EXPECTED.draft || missing.length || duplicates.length) {
    throw new Error(`Corpus safety check failed: ${JSON.stringify({ ...actual, publishBasenameMissing: missing.length, publishBasenameDuplicates: duplicates.length })}`);
  }
  const replacementCharacters = entries.reduce((count, entry) => count + ((`${entry.title}\n${entry.body}`.match(/\uFFFD/g) ?? []).length), 0);
  return { publish, draft, summary: { ...actual, publishBasenameMissing: 0, publishBasenameDuplicates: 0, sourceReplacementCharacters: replacementCharacters } };
}

export function oldPath(entry) {
  const value = entry.basename.startsWith('/') ? entry.basename : `/entry/${entry.basename}`;
  return value.replace(/\/+/g, '/');
}

export function parseJstDate(value) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) throw new Error(`Invalid MT date format (entry metadata index only): ${value.length ? 'present' : 'missing'}`);
  let hour = Number(match[4]);
  if (match[7]) { hour %= 12; if (match[7].toUpperCase() === 'PM') hour += 12; }
  const utc = Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2]), hour - 9, Number(match[5]), Number(match[6]));
  return new Date(utc).toISOString();
}

export function imageUrls(html) {
  return [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]);
}

export function features(entry) {
  const html = entry.body;
  const lower = html.toLowerCase();
  const images = imageUrls(html).length;
  const pre = (lower.match(/<pre\b/g) ?? []).length;
  const result = [];
  if (pre >= 3 || /\bperl\b|use strict|my \$/i.test(html)) result.push('code');
  if (images >= 3) result.push('images');
  if (/<table\b/i.test(html)) result.push('table');
  if (/hatenablog\.com\/embed|embed-card|blogcard/i.test(html)) result.push('blog-card');
  if (/twitter\.com|x\.com|gist\.github\.com|youtube\.com|youtu\.be/i.test(html)) result.push('external-embed');
  if (/https?:\/\/sironekotoro\.hateblo\.jp\/entry\//i.test(html)) result.push('internal-link');
  return result;
}

export function selectSamples(publish, count) {
  const sorted = [...publish].sort((a, b) => parseJstDate(a.date).localeCompare(parseJstDate(b.date)));
  const selected = new Map();
  const add = (entry, reason) => { if (!entry) return; const current = selected.get(entry.index); if (current) current.reasons.push(reason); else selected.set(entry.index, { entry, reasons: [reason] }); };
  add(sorted[0], '最古の公開記事');
  add(sorted.at(-1), '最新の公開記事');
  const targets = ['code','images','table','blog-card','external-embed','internal-link'];
  for (const target of targets) {
    const candidates = publish.filter((entry) => features(entry).includes(target)).sort((a,b) => score(b,target)-score(a,target));
    add(candidates[0], featureReason(target));
  }
  for (const entry of sorted) { if (selected.size >= count) break; add(entry, '年代の幅を補う記事'); }
  return [...selected.values()].slice(0, count);
}

function score(entry, target) {
  if (target === 'images') return imageUrls(entry.body).length;
  if (target === 'code') return (entry.body.match(/<pre\b/gi) ?? []).length;
  return (entry.body.match(new RegExp(target === 'table' ? '<table\\b' : target === 'internal-link' ? 'sironekotoro\\.hateblo\\.jp/entry/' : target === 'external-embed' ? 'twitter\\.com|x\\.com|gist\\.github\\.com|youtube\\.com|youtu\\.be' : 'hatenablog\\.com/embed|embed-card|blogcard','gi')) ?? []).length;
}
function featureReason(value) { return ({code:'コードブロックが多い',images:'画像が多い',table:'テーブルを含む','blog-card':'はてなブログカードを含む','external-embed':'外部サービス埋め込みを含む','internal-link':'旧ブログ内部リンクを含む'})[value]; }
export function stableJson(value) { return `${JSON.stringify(value, null, 2)}\n`; }
export function shortHash(value) { return createHash('sha256').update(value).digest('hex').slice(0, 16); }
