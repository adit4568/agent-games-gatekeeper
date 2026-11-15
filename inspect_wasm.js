const fs = require('fs');
const w = fs.readFileSync('/root/zkverify-re/agent/circuits/gatekeeper.wasm');
const s = w.toString('latin1');
const names = [...s.matchAll(/[a-zA-Z_][a-zA-Z0-9_]{2,40}/g)].map(m => m[0]);
const uniq = [...new Set(names)];
const cand = uniq.filter(n => /^(registered_vk|proof_vk|minimum|public_balance|expiry_block|current_block|recipient|condition_recipient|amount|max_transfer|proof_tx|decision|reason|valid|ok|approve|reject|threshold|isValid|out|main)/i.test(n));
console.log('CAND:', cand.slice(0, 80).join(', '));
