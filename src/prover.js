// Groth16 proof generation for the official gatekeeper circuit.
// 13 inputs: taskId, registeredVkHash, proofVkHash, minimum, publicBalance,
// expiryBlock, currentBlock, recipient, conditionRecipient, amount,
// maxTransfer, decision, salt(private).
// Circuit asserts decision == (all five field checks): a wrong decision
// cannot produce a witness — proof failure is a fail-closed REJECT signal.
const path = require('path');
const fs = require('fs');
const snarkjs = require('snarkjs');
const { toField, taskIdToField, deriveSalt } = require('./field');

const DIR = process.env.CIRCUITS_DIR || path.join(__dirname, '..', 'circuits');
const WASM = path.join(DIR, 'gatekeeper.wasm');
const ZKEY = path.join(DIR, 'gatekeeper_final.zkey');
const VK = path.join(DIR, 'verification_key.json');

let vkCache = null;
function loadVk() { if (!vkCache) vkCache = JSON.parse(fs.readFileSync(VK, 'utf8')); return vkCache; }

function buildInputs(envelope, decision, secret) {
  const i = envelope.input;
  return {
    taskId: taskIdToField(envelope.task_id).toString(),
    registeredVkHash: toField(i.registered_vk).toString(),
    proofVkHash: toField(i.proof_vk).toString(),
    minimum: toField(i.minimum).toString(),
    publicBalance: toField(i.public_balance).toString(),
    expiryBlock: toField(i.expiry_block).toString(),
    currentBlock: toField(i.current_block).toString(),
    recipient: toField(i.recipient).toString(),
    conditionRecipient: toField(i.condition_recipient).toString(),
    amount: toField(i.amount).toString(),
    maxTransfer: toField(i.max_transfer).toString(),
    decision: decision === 'APPROVE' ? '1' : '0',
    salt: deriveSalt(secret, envelope.task_id).toString(),
  };
}

async function prove(envelope, decision, secret) {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(buildInputs(envelope, decision, secret), WASM, ZKEY);
  return { proof, publicSignals: publicSignals.map(String) };
}

async function verifyLocal(proof, publicSignals) {
  return snarkjs.groth16.verify(loadVk(), publicSignals, proof);
}

module.exports = { prove, verifyLocal, buildInputs, loadVk };
