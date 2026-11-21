import fs from 'node:fs';
import path from 'node:path';

const CONS = 'bcdfghjklmnpqrstvwxyz'.split('');
const VOW  = 'aeiou'.split('');
const BAD = ['fuk','fuc','dik','tik','sex','ass','cum','gay','rape','naz','kkk','piss','tit','anal','anus','fag','dyk','jap','porn','pedo','cunt','shit','crap','damn','kill','drug','meth','heroin','coca','nigg','retard'];

function gen() {
  const out = [];
  for (const c1 of CONS) for (const v1 of VOW) for (const c2 of CONS) for (const v2 of VOW) for (const c3 of CONS) {
    const w = c1+v1+c2+v2+c3;
    if (BAD.some(b => w.includes(b))) continue;
    out.push(w);
  }
  return out;
}

const SOFT = new Set('bdfgklmnprstvz'.split(''));
const HARD = new Set('qxjyw'.split(''));

function score(w) {
  const p = w.split('');
  const c1=p[0],v1=p[1],c2=p[2],v2=p[3],c3=p[4];
  let s = new Set(p).size * 2;
  if (v1 !== v2) s += 4;
  for (const c of [c1,c2,c3]) s += SOFT.has(c) ? 2 : (HARD.has(c) ? -1 : 1);
  if (c1 === c3) s -= 2;
  if (SOFT.has(c3)) s += 2;
  s += 1;
  if (new Set([c1,c2,c3]).size < 3) s -= 3;
  if (v2 === 'u') s -= 1;
  return s;
}

const DIR = process.argv[2] || process.env.DOMAINSCAN_DIR || process.cwd();
fs.mkdirSync(DIR, {recursive: true});
const limit = Number(process.argv[3] || 100);
const conc = Number(process.argv[4] || 8);
const shard = Number(process.argv[5] || 0);
const shardSize = Number(process.argv[6] || 0);

let all = gen().map(w => ({w, s: score(w)}));
all.sort((a,b) => b.s - a.s || a.w.localeCompare(b.w));
const slice = shardSize ? all.slice(shard*shardSize, shard*shardSize + shardSize) : all.slice(shard, shard + limit);
console.log('candidates_total=' + all.length + ' scanning=' + slice.length + ' conc=' + conc + ' shard=' + shard);

const story = path.join(DIR, 'results.jsonl');
const known = new Set();
if (fs.existsSync(story)) {
  for (const line of fs.readFileSync(story,'utf8').split('\n')) {
    const t = line.trim(); if (!t) continue;
    try { const o = JSON.parse(t); known.add(o.d + ':' + o.status); } catch (e) {}
  }
}

const t0 = Date.now();
let idx = 0, avail = 0, reg = 0, err = 0, done = 0;
const out = fs.createWriteStream(story, {flags: 'a'});
const found = [];

async function check(d) {
  const url = 'https://rdap.verisign.com/com/v1/domain/' + d + '.com';
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {method:'GET', headers:{'accept':'application/rdap+json','user-agent':'domainscan/1.0'}, signal: AbortSignal.timeout(12000)});
      if (res.status === 429 || res.status === 503) {
        const ra = Number(res.headers.get('retry-after') || '2');
        await new Promise(r => setTimeout(r, Math.max(1, Math.min(ra, 10))*1000));
        continue;
      }
      if (res.status === 200) return {d, status:'registered'};
      if (res.status === 404) return {d, status:'available'};
      if (res.status === 400 || res.status === 451) return {d, status:'blocked'};
      return {d, status:'http'+res.status};
    } catch (e) {
      if (attempt === 3) return {d, status:'error'};
      await new Promise(r => setTimeout(r, 800 * (attempt+1)));
    }
  }
  return {d, status:'error'};
}

async function worker() {
  while (true) {
    const i = idx++;
    if (i >= slice.length) return;
    const item = slice[i];
    const w = item.w;
    if (known.has(w + ':registered') || known.has(w + ':available')) { done++; continue; }
    const r = await check(w);
    out.write(JSON.stringify({d: r.d, status: r.status, s: item.s, t: Date.now()}) + '\n');
    done++;
    if (r.status === 'available') { avail++; found.push({w, s: item.s}); }
    else if (r.status === 'registered') reg++;
    else err++;
    if (done % 25 === 0) {
      const el = (Date.now()-t0)/1000;
      console.log('progress ' + done + '/' + slice.length + ' avail=' + avail + ' reg=' + reg + ' err=' + err + ' ' + (done/el).toFixed(1) + '/s');
    }
  }
}

await Promise.all(Array.from({length: conc}, worker));
out.end();
const el = (Date.now()-t0)/1000;
found.sort((a,b) => b.s - a.s || a.w.localeCompare(b.w));
console.log('DONE done=' + done + ' avail=' + avail + ' reg=' + reg + ' err=' + err + ' secs=' + el.toFixed(1));
console.log('AVAILABLE: ' + found.map(f => f.w + '.com').join(' '));
