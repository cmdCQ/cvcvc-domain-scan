import fs from 'node:fs';
import path from 'node:path';
import { candidates } from './gen.mjs';

const DIR = process.env.DOMAINSCAN_DIR || path.resolve('.');
const conc = Number(process.argv[2] || 30);
const start = Number(process.argv[3] || 0);
const count = Number(process.argv[4] || 300);
const all = candidates();
const mode = process.argv[5] || 'slice';
let slice;
if (mode === 'balanced') {
  // top `count` per initial consonant => alphabetical variety
  const per = count;
  const buckets = new Map();
  for (const o of all) {
    const k = o.w[0];
    if (!buckets.has(k)) buckets.set(k, []);
    const arr = buckets.get(k);
    if (arr.length < per) arr.push(o);
  }
  slice = [...buckets.values()].flat();
} else {
  slice = all.slice(start, start + count);
}

const outFile = path.join(DIR, 'dns.jsonl');
const known = new Set();
if (fs.existsSync(outFile)) {
  for (const l of fs.readFileSync(outFile,'utf8').split('\n')) {
    const t = l.trim(); if (!t) continue;
    try { const o = JSON.parse(t); known.add(o.d); } catch(e) {}
  }
}
const out = fs.createWriteStream(outFile, {flags:'a'});
const HOSTS = ['https://dns.alidns.com/resolve','https://doh.pub/dns-query'];
let idx = 0, nx = 0, ex = 0, er = 0, done = 0;
const t0 = Date.now();
const availList = [];

async function q(d, hostIdx) {
  const url = HOSTS[hostIdx] + '?name=' + d + '.com&type=NS';
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch(url, {headers:{'accept':'application/dns-json'}, signal: AbortSignal.timeout(6000)});
      if (res.status === 429 || res.status >= 500) { await new Promise(r=>setTimeout(r,1200*(a+1))); continue; }
      const j = await res.json();
      const st = j.Status;
      if (st === 3) return 'nx';
      if (st === 0) {
        const hasAns = Array.isArray(j.Answer) && j.Answer.some(x => x.type === 2 || x.type === 6);
        return hasAns ? 'exists' : 'nx';
      }
      if (st === 2) return 'err';
      return 'err';
    } catch (e) {
      await new Promise(r=>setTimeout(r,600*(a+1)));
    }
  }
  return 'err';
}

async function worker(id) {
  while (true) {
    const i = idx++;
    if (i >= slice.length) return;
    const item = slice[i];
    if (known.has(item.w)) { done++; continue; }
    let r = await q(item.w, id % 2);
    if (r === 'err') {
      // cross-check on the other resolver before giving up
      await new Promise(x=>setTimeout(x,400));
      r = await q(item.w, (id+1) % 2);
    }
    out.write(JSON.stringify({d:item.w, s:item.s, status:r}) + '\n');
    known.add(item.w);
    done++;
    if (r === 'nx') { nx++; availList.push(item.w); } else if (r === 'exists') ex++; else er++;
    if (done % 50 === 0) {
      const el=(Date.now()-t0)/1000;
      console.log('prog ' + done + '/' + slice.length + ' nx=' + nx + ' ex=' + ex + ' err=' + er + ' ' + (done/el).toFixed(1) + '/s');
    }
  }
}

await Promise.all(Array.from({length: conc}, (_,i) => worker(i)));
out.end();
const el=(Date.now()-t0)/1000;
console.log('DONE ' + done + ' nx=' + nx + ' ex=' + ex + ' err=' + er + ' ' + (done/el).toFixed(1) + 'q/s');
console.log('NX_SAMPLE: ' + availList.slice(0,40).join(' '));
