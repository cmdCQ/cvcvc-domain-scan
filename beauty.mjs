import fs from 'node:fs';
const DIR=process.env.DOMAINSCAN_DIR || process.cwd();
const list = fs.readFileSync(DIR+'/available.txt','utf8').split('\n').map(s=>s.trim().replace(/\.com$/,'')).filter(Boolean);
const PAIRS = new Set(['ae','ai','ao','au','ei','eo','ia','ie','io','oa','oe','oi','ua','ue','ui','ei']);
const GOODEND = new Set('nklrstxmgd'.split(''));
const BADEND = new Set('fvzw'.split(''));
const WEIRD = ['fv','vf','vv','ff','zz','zz','q','y','j','w'];
function beauty(w){
  const p=w.split(''); const [c1,v1,c2,v2,c3]=p;
  let s=0;
  if(new Set(p).size===5) s+=6;
  if(PAIRS.has(v1+v2)) s+=5;
  if(GOODEND.has(c3)) s+=3;
  if(BADEND.has(c3)) s-=4;
  const vc = p.filter(x=>'aeiou'.includes(x)).length;
  s+= 2;
  const counts={}; for(const c of p) counts[c]=(counts[c]||0)+1;
  for(const k in counts) if(counts[k]>1) s-=4;
  if(p.some(x=>x==='q'||x==='y')) s-=3;
  if(p.some(x=>x==='j')) s-=2;
  // consonant variety among c1,c2,c3
  if(new Set([c1,c2,c3]).size===3) s+=3;
  // avoid 'f' or 'v' in more than one place
  const fv=[c1,c2,c3].filter(c=>c==='f'||c==='v').length; if(fv>1) s-=5;
  // prefer softer start
  if('bdklmnprstvzcg'.includes(c1)) s+=2;
  if(c1==='g'||c1==='k'||c1==='l'||c1==='m'||c1==='n'||c1==='r'||c1==='s'||c1==='t'||c1==='v'||c1==='z') s+=1;
  if(w.includes('uo')||w.includes('ou')) s-=4;
  if(w.includes('uu')) s-=3;
  return s;
}
const ranked = list.map(w=>({w,s:beauty(w)})).sort((a,b)=>b.s-a.s||a.w.localeCompare(b.w));
fs.writeFileSync(DIR+'/ranked.txt', ranked.map(o=>o.w+'.com').join('\n'));
console.log(ranked.slice(0,80).map(o=>o.w+'('+o.s+')').join(' '));
