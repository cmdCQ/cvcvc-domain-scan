import fs from 'node:fs';
import path from 'node:path';

const DIR = process.env.DOMAINSCAN_DIR || path.resolve('.');
const topN = Number(process.argv[2] || 400);
const conc = Number(process.argv[3] || 2);

const dnsFile = path.join(DIR, 'dns.jsonl');
const vFile = path.join(DIR, 'verified.jsonl');

const nx = [];
const seen = new Set();
for (const l of fs.readFileSync(dnsFile,'utf8').split('\n')) {
  const t = l.trim(); if (!t) continue;
  try { const o = JSON.parse(t); if (o.status === 'nx') nx.push(o); } catch(e) {}
}
nx.sort((a,b) => b.s - a.s || a.d.localeCompare(b.d));
const doneSet = new Set();
if (fs.existsSync(vFile)) {
  for (const l of fs.readFileSync(vFile,'utf8').split('\n')) {
    const t=l.trim(); if(!t) continue;
    try { doneSet.add(JSON.parse(t).d); } catch(e) {}
  }
}
const todo = nx.filter(o => !doneSet.has(o.d)).slice(0, topN);
console.log('nx_total=' + nx.length + ' todo=' + todo.length + ' conc=' + conc);

const out = fs.createWriteStream(vFile, {flags:'a'});
let idx = 0, av = 0, reg = 0, er = 0, done = 0;
const t0 = Date.now();
const avail = [];

async function check(d) {
  const url = 'https://rdap.verisign.com/com/v1/domain/' + d + '.com';
  for (let a = 0; a < 4; a++) {
    try {
      const res = await fetch(url, {headers:{'accept':'application/rdap+json','user-agent':'domainscan/1.0'}, signal: AbortSignal.timeout(15000)});
      if (res.status === 429) { await new Promise(r=>setTimeout(r,2500)); continue; }
      if (res.status === 200) return 'registered';
      if (res.status === 404) return 'available';
      await new Promise(r=>setTimeout(r,1500));
    } catch (e) {
      await new Promise(r=>setTimeout(r,1000));
    }
  }
  return 'error';
}

async function worker() {
  while (true) {
    const i = idx++;
    if (i >= todo.length) return;
    const o = todo[i];
    const st = await check(o.d);
    out.write(JSON.stringify({d:o.d, s:o.s, status:st}) + '\n');
    done++;
    if (st === 'available') { av++; avail.push(o.d); } else if (st === 'registered') reg++; else er++;
    await new Promise(r=>setTimeout(r, 700));
    if (done % 20 === 0) {
      const el=(Date.now()-t0)/1000;
      console.log('prog ' + done + '/' + todo.length + ' avail=' + av + ' reg=' + reg + ' err=' + er + ' ' + (done/el).toFixed(2) + '/s');
    }
  }
}
await Promise.all(Array.from({length: conc}, worker));
out.end();
const el=(Date.now()-t0)/1000;
avail.sort();
console.log('DONE ' + done + ' avail=' + av + ' reg=' + reg + ' err=' + er + ' ' + el.toFixed(0) + 's');
console.log('AVAIL: ' + avail.join(' '));
