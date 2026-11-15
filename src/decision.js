// Deterministic APPROVE/REJECT policy — mirrors the gatekeeper circuit exactly.
// APPROVE only when ALL checks pass. Fail closed on anything malformed.
const REASON_CODES = [
  'VALID_CONDITION', 'VK_SUBSTITUTION', 'PROOF_REUSED', 'THRESHOLD_MISMATCH',
  'EXPIRED_CONDITION', 'RECIPIENT_MISMATCH', 'AMOUNT_OVERFLOW',
];

function asBigInt(v, f) {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') { if (!Number.isSafeInteger(v)) throw new Error(f); return BigInt(v); }
  if (typeof v === 'string') {
    const s = v.trim();
    if (/^0x[0-9a-fA-F]+$/.test(s)) return BigInt(s);
    if (/^-?[0-9]+$/.test(s)) return BigInt(s);
    throw new Error(`${f}: not numeric`);
  }
  throw new Error(`${f}: bad type`);
}

const sameAddr = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

function decide(input, seen) {
  if (!input || typeof input !== 'object') return { decision: 'REJECT', reason_code: 'INVALID_TASK' };
  try {
    const required = ['registered_vk', 'proof_vk', 'minimum', 'public_balance', 'expiry_block',
      'current_block', 'recipient', 'condition_recipient', 'amount', 'max_transfer', 'proof_tx'];
    for (const f of required) {
      if (input[f] === undefined || input[f] === null || input[f] === '') {
        return { decision: 'REJECT', reason_code: 'INVALID_TASK' };
      }
    }
    if (String(input.proof_vk).trim().toLowerCase() !== String(input.registered_vk).trim().toLowerCase())
      return { decision: 'REJECT', reason_code: 'VK_SUBSTITUTION' };
    if (seen && seen.has(String(input.proof_tx)))
      return { decision: 'REJECT', reason_code: 'PROOF_REUSED' };
    if (asBigInt(input.public_balance, 'public_balance') < asBigInt(input.minimum, 'minimum'))
      return { decision: 'REJECT', reason_code: 'THRESHOLD_MISMATCH' };
    if (asBigInt(input.current_block, 'current_block') >= asBigInt(input.expiry_block, 'expiry_block'))
      return { decision: 'REJECT', reason_code: 'EXPIRED_CONDITION' };
    if (!sameAddr(input.recipient, input.condition_recipient))
      return { decision: 'REJECT', reason_code: 'RECIPIENT_MISMATCH' };
    if (asBigInt(input.amount, 'amount') > asBigInt(input.max_transfer, 'max_transfer'))
      return { decision: 'REJECT', reason_code: 'AMOUNT_OVERFLOW' };
    return { decision: 'APPROVE', reason_code: 'VALID_CONDITION' };
  } catch (_) {
    return { decision: 'REJECT', reason_code: 'INVALID_TASK' };
  }
}

module.exports = { decide, REASON_CODES };
