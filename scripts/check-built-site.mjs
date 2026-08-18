import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const report = JSON.parse(await readFile('reports/sample-selection.json', 'utf8'));
const failures = [];
for (const post of report.posts) {
  const file = path.join('dist', post.oldPath.replace(/^\//, ''), 'index.html');
  try {
    const html = await readFile(file, 'utf8');
    if (html.includes('\uFFFD')) failures.push(`${post.oldPath}: replacement character`);
    if (!html.includes(post.title.replaceAll('&', '&amp;'))) failures.push(`${post.oldPath}: title missing`);
    if (/sironekotoro\.hateblo\.jp\/entry\//.test(html)) failures.push(`${post.oldPath}: old internal link remains`);
    if (/<script[^>]+(?:twitter|gist)/i.test(html)) failures.push(`${post.oldPath}: unsafe external script remains`);
    if (/embed-card/.test(html)) failures.push(`${post.oldPath}: embed-card iframe remains`);
    if (/hatenablog-parts\.com/.test(html)) failures.push(`${post.oldPath}: hatenablog-parts embed remains`);
  } catch { failures.push(`${post.oldPath}: generated HTML missing`); }
}
const all = await walk('dist');
for (const file of all.filter((f) => f.endsWith('.html'))) {
  const html = await readFile(file, 'utf8');
  if (/"status"\s*:\s*"Draft"/.test(html)) failures.push(`${file}: draft marker`);
  if (/<iframe\b[^>]*\bclass="[^"]*\bembed-card\b/.test(html)) failures.push(`${file}: embed-card iframe remains`);
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  if (canonical) {
    const url = new URL(canonical);
    const idx = url.pathname.indexOf('/entry/');
    const prefix = idx === -1 ? '' : url.pathname.slice(0, idx);
    if (prefix) {
      for (const m of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
        const value = m[1];
        if (/^\/(?:entry|images|posts)\//.test(value)) {
          failures.push(`${file}: root-relative ${value} under base path ${prefix}`);
        }
      }
    }
  }
}
if (failures.length) throw new Error(`Built-site checks failed:\n${failures.join('\n')}`);
console.log(JSON.stringify({ checkedPosts: report.posts.length, htmlFiles: all.filter((f) => f.endsWith('.html')).length, failures: 0 }));
async function walk(dir) { const result = []; for (const item of await readdir(dir, { withFileTypes: true })) { const file = path.join(dir, item.name); if (item.isDirectory()) result.push(...await walk(file)); else result.push(file); } return result; }