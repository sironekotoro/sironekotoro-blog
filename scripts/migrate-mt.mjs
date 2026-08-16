import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import sanitizeHtml from 'sanitize-html';
import { parseArgs } from 'node:util';
import { parseMt, assertCorpus, oldPath, parseJstDate, imageUrls, features, selectSamples, stableJson, shortHash } from './mt-lib.mjs';

const { values } = parseArgs({ options: { sample: { type:'string', default:'8' }, 'download-images': { type:'boolean', default:false } } });
const count = Number(values.sample);
if (!Number.isInteger(count) || count < 5 || count > 10) throw new Error('--sample must be an integer from 5 through 10');
const entries = await parseMt();
const { publish, summary } = assertCorpus(entries);
const selected = selectSamples(publish, count);
if (selected.length !== count) throw new Error(`Could only select ${selected.length} samples`);

const dataDir = path.resolve('src/data/posts');
const imageDir = path.resolve('public/images/migrated');
const reportDir = path.resolve('reports');
await mkdir(dataDir, { recursive:true }); await mkdir(imageDir, { recursive:true }); await mkdir(reportDir, { recursive:true });
for (const file of await readdir(dataDir)) if (file.endsWith('.json')) await writeFile(path.join(dataDir,file), '');

const imageManifest = {};
const generated = [];
for (const { entry, reasons } of selected) {
  let html = rewriteInternalLinks(entry.body);
  const urls = [...new Set(imageUrls(html))];
  if (values['download-images']) html = await localizeImages(html, urls, imageManifest);
  html = safeHtml(html);
  const post = { title:entry.title, basename:entry.basename, status:'Publish', publishedAt:parseJstDate(entry.date), categories:entry.categories, oldPath:oldPath(entry), sourceUrl:`https://sironekotoro.hateblo.jp${oldPath(entry)}`, html, imageUrls:urls, features:features(entry), selectionReasons:reasons };
  const filename = `${shortHash(post.oldPath)}.json`;
  await writeFile(path.join(dataDir, filename), stableJson(post));
  generated.push({ title:post.title, oldPath:post.oldPath, publishedAt:post.publishedAt, reasons, features:post.features, imageCount:urls.length });
}
for (const file of await readdir(dataDir)) { if (file.endsWith('.json')) { const content=await readFile(path.join(dataDir,file),'utf8'); if (!content) await import('node:fs/promises').then(({unlink})=>unlink(path.join(dataDir,file))); } }
await writeFile(path.join(reportDir,'sample-selection.json'), stableJson({ generatedCount:generated.length, posts:generated }));
await writeFile(path.join(reportDir,'migration-summary.json'), stableJson({ ...summary, generatedPublish:generated.length, generatedDraft:0, imageDownloadEnabled:Boolean(values['download-images']) }));
await writeFile(path.join(reportDir,'image-manifest.json'), stableJson(imageManifest));
console.log(JSON.stringify({ ...summary, generatedPublish:generated.length, generatedDraft:0, imageDownloadEnabled:Boolean(values['download-images']) }));

function rewriteInternalLinks(html) { return html.replace(/https?:\/\/sironekotoro\.hateblo\.jp(\/entry\/[^"'\s<#?]+(?:[?#][^"'\s<]*)?)/gi, '$1'); }
function safeHtml(html) {
  html = html.replace(/<script\b[^>]*src=["'](https:\/\/gist\.github\.com\/[^"']+)["'][^>]*><\/script>/gi, '<p class="embed-fallback"><a href="$1">GitHub Gistを表示</a></p>');
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','figure','figcaption','iframe','video','source','details','summary','del','ins','kbd','mark']),
    allowedAttributes: { '*':['class','id','title','data-*'], a:['href','name','target','rel'], img:['src','alt','width','height','loading'], iframe:['src','width','height','title','loading','allow','allowfullscreen','referrerpolicy','sandbox'], video:['src','controls','poster','width','height'], source:['src','type'], code:['class'], time:['datetime'] },
    allowedSchemes: ['http','https','mailto'],
    allowedIframeHostnames: ['www.youtube.com','www.youtube-nocookie.com','hatenablog.com'],
    transformTags: { a:(_tag,attrs)=>({tagName:'a',attribs:{...attrs,...(/^https?:/.test(attrs.href??'')?{rel:'noopener noreferrer'}:{})}}), img:(_tag,attrs)=>({tagName:'img',attribs:{...attrs,loading:'lazy'}}), iframe:(_tag,attrs)=>({tagName:'iframe',attribs:{...attrs,loading:'lazy',sandbox:'allow-scripts allow-same-origin allow-popups',referrerpolicy:'no-referrer'}}) }
  });
}
function isFotolife(url) { try { const host=new URL(url).hostname; return host === 'cdn-ak.f.st-hatena.com' || host.endsWith('.f.st-hatena.com'); } catch { return false; } }
async function localizeImages(html, urls, manifest) {
  for (const url of urls.filter(isFotolife)) {
    try {
      const parsed = new URL(url); const ext=(path.extname(parsed.pathname).match(/^\.[a-zA-Z0-9]{1,5}$/)?.[0] ?? '.img').toLowerCase();
      const name=`${shortHash(url)}${ext}`; const destination=path.join(imageDir,name);
      try { await readFile(destination); } catch { const response=await fetch(url,{signal:AbortSignal.timeout(20000)}); if(!response.ok) throw new Error(`HTTP ${response.status}`); await writeFile(destination,Buffer.from(await response.arrayBuffer())); }
      const local=`/images/migrated/${name}`; html=html.split(url).join(local); manifest[url]={local,status:'local'};
    } catch (error) { manifest[url]={local:null,status:'failed',error:error instanceof Error?error.message:'unknown error'}; }
  }
  return html;
}
