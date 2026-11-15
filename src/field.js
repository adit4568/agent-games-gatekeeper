// BN128 scalar field helpers for the gatekeeper Groth16 circuit.
const crypto = require('crypto');
const P = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

function modP(x) { const r = x % P; return r >= 0n ? r : r + P; }

function toField(value) {
  if (typeof value === 'bigint') return modP(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`toField: bad number ${value}`);
    return BigInt(value);
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^0x[0-9a-fA-F]+$/.test(s)) return modP(BigInt(s));
    if (/^[0-9]+$/.test(s)) return modP(BigInt(s));
    throw new Error(`toField: unsupported ${value}`);
  }
  throw new Error(`toField: unsupported type ${typeof value}`);
}

function taskIdToField(taskId) {
  if (typeof taskId !== 'string' || !taskId) throw new Error('taskIdToField: empty');
  if (/^0x[0-9a-fA-F]+$/.test(taskId) || /^[0-9]+$/.test(taskId)) return toField(taskId);
  return modP(BigInt('0x' + crypto.createHash('sha256').update(taskId, 'utf8').digest('hex')));
}

// salt = HMAC-SHA256(secret, "gatekeeper-salt:"+task_id) mod p  (private input, deterministic)
function deriveSalt(secret, taskId) {
  if (!secret) throw new Error('deriveSalt: secret required');
  const mac = crypto.createHmac('sha256', secret).update(`gatekeeper-salt:${taskId}`, 'utf8').digest('hex');
  return modP(BigInt('0x' + mac));
}

module.exports = { P, modP, toField, taskIdToField, deriveSalt };
