import fs from 'node:fs';
import { candidates } from './gen.mjs';

const DIR = process.env.DOMAINSCAN_DIR || process.cwd();
const scoreMap = new Map(candidates().map(o => [o.w, o.s]));

const avail = new Map();
if (fs.existsSync(DIR + '/verified.jsonl')) {
  for (const l of fs.readFileSync(DIR + '/verified.jsonl','utf8').split('\n')) {
    const t = l.trim(); if (!t) continue;
    try { const o = JSON.parse(t); if (o.status === 'available') avail.set(o.d, {src:'rdap-node'}); } catch(e){}
  }
}
if (fs.existsSync(DIR + '/curl_verify.txt')) {
  for (const l of fs.readFileSync(DIR + '/curl_verify.txt','utf8').split('\n')) {
    const m = l.trim().match(/^([a-z]{5}) (\d{3})$/);
    if (!m) continue;
    if (m[2] === '404') avail.set(m[1], {src:'rdap-curl'});
    else if (m[2] === '200') avail.delete(m[1]);
  }
}

const list = [...avail.entries()].map(([d, v]) => ({d, s: scoreMap.get(d) ?? 0, src: v.src}));
list.sort((a,b) => b.s - a.s || a.d.localeCompare(b.d));

const soft = new Set('bdfgklmnprstvz'.split(''));
function tier(o) {
  const [c1,v1,c2,v2,c3] = o.d.split('');
  let t = 0;
  if (soft.has(c1)) t++;
  if (soft.has(c2)) t++;
  if (soft.has(c3)) t++;
  if (v1 !== v2) t++;
  if (new Set(o.d.split('')).size === 5) t++;
  return t;
}
const strong = list.filter(o => tier(o) >= 4);
const normal = list.filter(o => tier(o) < 4);

const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
fs.writeFileSync(DIR + '/available.txt', list.map(o => o.d + '.com').join('\n') + '\n');
fs.writeFileSync(DIR + '/available.csv', 'domain,score,tier,source\n' + list.map(o => o.d + '.com,' + o.s + ',' + (tier(o)>=4?'strong':'ok') + ',' + o.src).join('\n') + '\n');

let md = '# 5-letter CVCVC .com scan — ' + stamp + '\n\n';
md += 'Total available (RDAP-confirmed): ' + list.length + '  (strong aesthetic: ' + strong.length + ')\n\n';
md += '## Strong tier\n\n';
for (const o of strong) md += '- ' + o.d + '.com  (score ' + o.s + ')\n';
md += '\n## Rest\n\n';
md += normal.map(o => o.d + '.com').join(', ') + '\n';
fs.writeFileSync(DIR + '/report.md', md);

console.log('available=' + list.length + ' strong=' + strong.length);
console.log('STRONG: ' + strong.map(o => o.d).join(' '));
console.log('LIST: ' + list.slice(0,120).map(o => o.d).join(' '));
