import fs from 'node:fs';
const DIR=process.env.DOMAINSCAN_DIR || process.cwd();
const names = fs.readFileSync(DIR+'/available.txt','utf8').split('\n').map(s=>s.trim().replace(/\.com$/,'')).filter(Boolean);
const CONS='bcdfghjklmnpqrstvwxyz';
const PAIRS=new Set(['ae','ai','ao','au','ei','eo','ia','ie','io','oa','oe','oi','ua','ue','ui']);
const GOODEND=new Set('nklrstxmdg'.split(''));
const BADEND=new Set('fvzwqj'.split(''));
function ok(w){
  const p=w.split(''); const [c1,v1,c2,v2,c3]=p;
  if(!CONS.includes(c1)) return false;
  if(!'aeiou'.includes(v1)) return false;
  if(!CONS.includes(c2)) return false;
  if(!'aeiou'.includes(v2)) return false;
  if(!CONS.includes(c3)) return false;
  if(new Set(p).size<5) return false;
  if(!PAIRS.has(v1+v2)) return false;
  if(!GOODEND.has(c3)) return false;
  // no f/v twice, no f+v adjacent
  const fv=[c1,c2,c3].filter(c=>c==='f'||c==='v').length;
  if(fv>1) return false;
  if(w.includes('fv')||w.includes('vf')) return false;
  return true;
}
const good = names.filter(ok);
const byLetter = new Map();
for(const w of good){ const k=w[0]; if(!byLetter.has(k)) byLetter.set(k,[]); byLetter.get(k).push(w); }
const order='vxzjwqtsrplmnkhcgdfb'.split('');
const picks=[];
for(const k of order){ const arr=byLetter.get(k)||[]; picks.push(...arr.slice(0,6).map(w=>k+':'+w)); }
fs.writeFileSync(DIR+'/curated_raw.txt', picks.join('\n')+'\n');
console.log('good='+good.length+' picked='+picks.length);
console.log(picks.join(' '));
