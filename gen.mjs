import fs from 'node:fs';

const CONS = 'bcdfghjklmnpqrstvwxyz'.split('');
const VOW  = 'aeiou'.split('');
const BAD = ['fuk','fuc','dik','tik','sex','ass','cum','gay','rape','naz','kkk','piss','tit','anal','anus','fag','dyk','jap','porn','pedo','cunt','shit','crap','damn','kill','drug','meth','heroin','coca','nigg','retard'];
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

export function candidates() {
  const out = [];
  for (const c1 of CONS) for (const v1 of VOW) for (const c2 of CONS) for (const v2 of VOW) for (const c3 of CONS) {
    const w = c1+v1+c2+v2+c3;
    if (BAD.some(b => w.includes(b))) continue;
    out.push(w);
  }
  return out.map(w => ({w, s: score(w)})).sort((a,b) => b.s - a.s || a.w.localeCompare(b.w));
}
