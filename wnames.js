const fs=require('fs');
const path='/root/zkverify-re/agent/circuits/gatekeeper.wasm';
const buf=fs.readFileSync(path);
// circom wasm embeds signal name table; search printable strings near 'main'
const s=buf.toString('latin1');
const idxs=[];
let i=-1;
while((i=s.indexOf('main',i+1))!==-1) idxs.push(i);
console.log('main occurrences:', idxs.length);
for(const k of idxs.slice(0,6)){
  const seg=buf.slice(Math.max(0,k-200), k+400);
  const str=seg.toString('utf8').replace(/[^\x20-\x7e]+/g,'|');
  console.log('---@'+k, str.slice(0,400));
}
