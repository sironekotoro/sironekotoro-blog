import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parseMt, assertCorpus, oldPath, selectSamples } from '../scripts/mt-lib.mjs';

test('corpus counts and publish basename invariants', async()=>{const entries=await parseMt();const {publish,draft,summary}=assertCorpus(entries);assert.equal(summary.total,375);assert.equal(summary.publish,338);assert.equal(summary.draft,37);assert.equal(summary.publishBasenameMissing,0);assert.equal(summary.publishBasenameDuplicates,0);assert.ok(summary.sourceReplacementCharacters >= 0);assert.equal(publish.length,338);assert.equal(draft.length,37);});
test('sample selection contains Publish only and expected routes', async()=>{const {publish}=assertCorpus(await parseMt());const samples=selectSamples(publish,8);assert.equal(samples.length,8);for(const {entry} of samples){assert.equal(entry.status,'Publish');assert.match(oldPath(entry),/^\/entry\//);}});
test('generated data has all published posts',async()=>{const files=(await readdir('src/data/posts')).filter(f=>f.endsWith('.json'));assert.equal(files.length,338);const snapshot=[];for(const file of files){const raw=await readFile(`src/data/posts/${file}`,'utf8');const post=JSON.parse(raw);assert.equal(post.status,'Publish');snapshot.push([file,post.oldPath]);}assert.deepEqual(snapshot,[...snapshot].sort((a,b)=>a[0].localeCompare(b[0])));});
