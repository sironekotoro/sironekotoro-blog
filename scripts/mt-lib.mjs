import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sanitizeHtml from 'sanitize-html';

export const SOURCE = path.resolve(process.env.HATENA_EXPORT_PATH ?? 'migration-source/sironekotoro.hateblo.jp.export.txt');
export const EXPECTED = { total: 375, publish: 338, draft: 37 };
export const FIXTURE_EXPECTED = { total: 5, publish: 4, draft: 1 };

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

export function assertCorpus(entries, expected = EXPECTED) {
  const publish = entries.filter((entry) => entry.status === 'Publish');
  const draft = entries.filter((entry) => entry.status === 'Draft');
  const missing = publish.filter((entry) => !entry.basename);
  const counts = new Map();
  for (const entry of publish) counts.set(entry.basename, (counts.get(entry.basename) ?? 0) + 1);
  const duplicates = [...counts].filter(([, count]) => count > 1);
  const actual = { total: entries.length, publish: publish.length, draft: draft.length };
  if (actual.total !== expected.total || actual.publish !== expected.publish || actual.draft !== expected.draft || missing.length || duplicates.length) {
    throw new Error(`Corpus safety check failed: ${JSON.stringify({ ...actual, expected, publishBasenameMissing: missing.length, publishBasenameDuplicates: duplicates.length })}`);
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

const HATENA_EMBED_CARD_RE = /<iframe\b[^>]*\bclass="[^"]*\bembed-card\b[^"]*"[^>]*>[\s\S]*?<\/iframe>/gi;
const HATENA_PARTS_SRC_RE = /^https?:\/\/hatenablog-parts\.com\/embed\?(?:[^#]*)url=([^&]+)/i;

export function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function embedCardTarget(iframeTag, citeHref) {
  if (citeHref) return citeHref;
  const src = iframeTag.match(/\bsrc="([^"]*)"/i)?.[1] ?? '';
  const match = src.match(HATENA_PARTS_SRC_RE);
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * はてなブログカード/ウェブカードのiframe（移行時にsrcが剥がれ白枠になる）を、
 * 自前のリンクカードへ変換する。内部記事なら /entry/... への内部リンクカード、
 * 外部URLなら外部リンクカードになる。
 */
export function convertBlogCards(html, { titleLookup = new Map() } = {}) {
  let result = '';
  let lastIndex = 0;
  for (const match of html.matchAll(HATENA_EMBED_CARD_RE)) {
    const iframe = match[0];
    const before = html.slice(0, match.index);
    const after = html.slice(match.index + iframe.length);
    const cite = after.match(/^\s*<cite\b[^>]*>\s*<a\b[^>]*href="([^"]*)"[^>]*>[\s\S]*?<\/a>\s*<\/cite>/i);
    const citeText = cite?.[0] ?? '';
    const target = embedCardTarget(iframe, cite?.[1]);
    const card = buildLinkCard({ iframe, target, titleLookup });
    let start = match.index;
    let end = match.index + iframe.length + citeText.length;
    if (card !== iframe) {
      const openP = /(<p>\s*)$/i.exec(before);
      const closeP = /^\s*<\/p>/i.exec(after.slice(citeText.length));
      if (openP && closeP) { start -= openP[1].length; end += closeP[0].length; }
    }
    result += html.slice(lastIndex, start) + card;
    lastIndex = end;
  }
  return result + html.slice(lastIndex);
}

function buildLinkCard({ iframe, target, titleLookup }) {
  const rawTitle = (iframe.match(/\btitle="([^"]*)"/i)?.[1] ?? '').trim();
  const fallbackTitle = rawTitle.replace(/\s*-\s*sironekotoroの日記\s*$/i, '').trim();
  if (!target) return iframe;
  const internal = /^(?:https?:\/\/sironekotoro\.hateblo\.jp)?\/entry\//i.test(target);
  if (internal) {
    const path = target.replace(/^https?:\/\/sironekotoro\.hateblo\.jp/i, '');
    const title = titleLookup.get(path) ?? (fallbackTitle || path);
    return `<aside class="internal-link-card"><a href="${escapeHtml(path)}"><span class="internal-link-card__label">関連記事</span><strong class="internal-link-card__title">${escapeHtml(title)}</strong></a></aside>`;
  }
  const title = fallbackTitle || target;
  return `<aside class="external-link-card"><a href="${escapeHtml(target)}" rel="noopener noreferrer"><span class="external-link-card__label">参考リンク</span><strong class="external-link-card__title">${escapeHtml(title)}</strong></a></aside>`;
}

/**
 * 残存するiframe embedを正規化する。
 * - Speaker Deck / SlideShare のスライド埋め込み: 復元・正規化して残す
 * - YouTube: youtube-nocookie.com へ移し、title を付与して残す
 * - Amazon広告ウィジェット (rcm-fe.amazon-adsystem.com): 廃止サービス → 商品リンクカードへ
 * - OneDrive埋め込み: 403/要ログインで機能しない → 安全に除去
 * - それ以外のsrc無しiframe: 白箱を残さないため除去
 */
export function normalizeEmbeds(html) {
  return html.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, (full) => transformIframe(full));
}

function parseIframeAttrs(open) {
  const attrs = {};
  for (const m of open.matchAll(/\s([a-zA-Z][\w-]*)=(?:"([^"]*)"|'([^']*)')/g)) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? '';
  const unquoted = open.match(/\ssrc=([^\s>]+)/i);
  if (unquoted && !attrs.src) attrs.src = unquoted[1];
  return attrs;
}

function speakerdeckHash(id) {
  const m = /^talk_frame_([0-9a-f]+)$/i.exec(id ?? '');
  return m ? m[1] : null;
}

function transformIframe(full) {
  const open = full.match(/<iframe\b[^>]*>/i)?.[0];
  if (!open) return full;
  const attrs = parseIframeAttrs(open);
  const src = attrs.src ?? '';
  const speaker = speakerdeckHash(attrs.id);

  if (speaker || /speakerdeck\.com\/player\//i.test(src)) {
    const hash = speaker || src.match(/speakerdeck\.com\/player\/([0-9a-f]+)/i)?.[1];
    if (!hash) return '';
    return buildIframe({ src: `https://speakerdeck.com/player/${hash}`, title: 'Speaker Deck プレゼンテーション', width: attrs.width, height: attrs.height, id: attrs.id });
  }
  if (/slideshare\.net\/slideshow\/embed_code\/key\/([A-Za-z0-9_-]+)/i.test(src)) {
    const key = src.match(/slideshow\/embed_code\/key\/([A-Za-z0-9_-]+)/i)[1];
    return buildIframe({ src: `https://www.slideshare.net/slideshow/embed_code/key/${key}`, title: 'SlideShare プレゼンテーション', width: attrs.width, height: attrs.height });
  }
  if (/youtube\.com\/embed\/|youtube-nocookie\.com\/embed\//i.test(src)) {
    const nocookie = src
      .replace(/^https?:\/\/(?:www\.)?youtube\.com\//i, 'https://www.youtube-nocookie.com/')
      .replace(/^\/\/(?:www\.)?youtube\.com\//i, 'https://www.youtube-nocookie.com/');
    return buildIframe({ src: nocookie, title: attrs.title || 'YouTube video', width: attrs.width, height: attrs.height });
  }
  if (/rcm-fe\.amazon-adsystem\.com/i.test(src)) {
    const asin = src.match(/asins=([A-Z0-9]{10})/i)?.[1];
    if (!asin) return '';
    const tag = src.match(/[?&](?:t|tag)=([A-Za-z0-9_-]+)/i)?.[1];
    return `<aside class="external-link-card"><a href="https://www.amazon.co.jp/dp/${asin}${tag ? `?tag=${tag}` : ''}" rel="noopener noreferrer"><span class="external-link-card__label">参考リンク</span><strong class="external-link-card__title">Amazon.co.jp の商品ページ（ASIN ${asin}）</strong></a></aside>`;
  }
  if (/onedrive\.live\.com|office\.com/i.test(src)) return '';
  if (!src) return '';
  return full;
}

function buildIframe({ src, title, width, height, id }) {
  const w = /^\d+$/.test(width ?? '') ? width : '';
  const h = /^\d+$/.test(height ?? '') ? height : '';
  const ratio = w && h ? `aspect-ratio:${w}/${h}; ` : '';
  const idAttr = id ? ` id="${escapeHtml(id)}"` : '';
  const wAttr = w ? ` width="${w}"` : '';
  const hAttr = h ? ` height="${h}"` : '';
  const allow = /youtube/i.test(src) ? ' allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"' : '';
  return `<iframe${idAttr} src="${escapeHtml(src)}" title="${escapeHtml(title)}"${wAttr}${hAttr}${allow} loading="lazy" allowfullscreen="true" allowtransparency="true" frameborder="0" style="${ratio}border:0; display:block; width:100%; height:auto"></iframe>`;
}

export function rewriteInternalLinks(html) {
  return html.replace(/https?:\/\/sironekotoro\.hateblo\.jp(\/entry\/[^"'\s<#?]+(?:[?#][^"'\s<]*)?)/gi, '$1');
}

export function safeHtml(html) {
  html = html.replace(/<script\b[^>]*src=["'](https:\/\/gist\.github\.com\/[^"']+)["'][^>]*><\/script>/gi, '<p class="embed-fallback"><a href="$1">GitHub Gistを表示</a></p>');
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'figure', 'figcaption', 'iframe', 'video', 'source', 'details', 'summary', 'del', 'ins', 'kbd', 'mark']),
    allowedAttributes: { '*': ['class', 'id', 'title', 'data-*'], a: ['href', 'name', 'target', 'rel'], img: ['src', 'alt', 'width', 'height', 'loading'], iframe: ['src', 'width', 'height', 'title', 'loading', 'allow', 'allowfullscreen', 'referrerpolicy', 'sandbox', 'style', 'allowtransparency', 'frameborder'], video: ['src', 'controls', 'poster', 'width', 'height'], source: ['src', 'type'], code: ['class'], time: ['datetime'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'hatenablog.com', 'speakerdeck.com', 'www.slideshare.net'],
    transformTags: {
      a: (_tag, attrs) => ({ tagName: 'a', attribs: { ...attrs, ...(/^https?:/.test(attrs.href ?? '') ? { rel: 'noopener noreferrer' } : {}) } }),
      img: (_tag, attrs) => ({ tagName: 'img', attribs: { ...attrs, loading: 'lazy' } }),
      iframe: (_tag, attrs) => ({ tagName: 'iframe', attribs: { ...attrs, loading: 'lazy', sandbox: 'allow-scripts allow-same-origin allow-popups', referrerpolicy: 'no-referrer' } })
    }
  });
}
