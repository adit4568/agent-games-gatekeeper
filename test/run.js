// Local test harness: replays every trap variety against the running agent,
// verifies the response signature, verifies the Groth16 proof locally, and
// asserts that a wrong decision cannot be proven.
const crypto = require('crypto');
const snarkjs = require('snarkjs');
const hmac = require('../src/hmac');
const { prove, loadVk } = require('../src/prover');

const PORT = process.env.PORT || 8098;
const SECRET = process.env.AGENT_GAMES_HMAC_SECRET || 'test-secret';
const URL = `http://127.0.0.1:${PORT}/agent`;

const base = {
  registered_vk: '0x7d1f9c3a5b2e4f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e91',
  proof_vk: '0x7d1f9c3a5b2e4f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e91',
  minimum: '1000', public_balance: '1460',
  expiry_block: 8430000, current_block: 8420000,
  recipient: '0xDe429f01aA0a11Bb22Cc33Dd44Ee55Ff66778899',
  condition_recipient: '0xde429f01aa0a11bb22cc33dd44ee55ff66778899',
  amount: '500', max_transfer: '1000',
  proof_tx: '0xa8b9c0d1e2f3a4b5c6d7e8f90123456789abcdef0123456789abcdef01234567',
};

function task(id, over = {}) {
  const now = Date.now();
  return {
    type: 'agent-games.proof-gatekeeper.v1', task_id: id, mode: 'practice',
    issued_at: new Date(now).toISOString(), deadline_at: new Date(now + 60000).toISOString(),
    input: { ...base, proof_tx: '0x' + crypto.randomBytes(32).toString('hex'), ...over },
  };
}

const cases = [
  ['valid', task('gk_test_valid'), 'APPROVE', 'VALID_CONDITION'],
  ['vk_substitution', task('gk_test_vk', { proof_vk: '0x13aa' + '0'.repeat(60) }), 'REJECT', 'VK_SUBSTITUTION'],
  ['threshold', task('gk_test_thr', { public_balance: '999' }), 'REJECT', 'THRESHOLD_MISMATCH'],
  ['expired', task('gk_test_exp', { current_block: 8430000 }), 'REJECT', 'EXPIRED_CONDITION'],
  ['recipient', task('gk_test_rcp', { recipient: '0x0000000000000000000000000000000000000001' }), 'REJECT', 'RECIPIENT_MISMATCH'],
  ['amount', task('gk_test_amt', { amount: '1001' }), 'REJECT', 'AMOUNT_OVERFLOW'],
];

async function post(envelope) {
  const raw = Buffer.from(JSON.stringify(envelope));
  const res = await fetch(URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-agent-games-signature': hmac.sign(SECRET, raw) }, body: raw });
  const text = await res.text();
  return { status: res.status, text, sig: res.headers.get('x-agent-games-signature') };
}

(async () => {
  const vk = loadVk();
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };

  // preflight
  const pf = await post({ type: 'agent-games.preflight.v1', agent_id: 'agt_test', issued_at: new Date().toISOString(), nonce: 'abc123' });
  const pfBody = JSON.parse(pf.text);
  ok(pf.status === 200 && pfBody.ok === true && pfBody.protocolVersion === 'v1', 'preflight {ok:true,protocolVersion:v1}');
  ok(hmac.verify(SECRET, Buffer.from(pf.text), pf.sig), 'preflight response signature valid');

  // bad signature must be rejected
  const bad = await fetch(URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-agent-games-signature': 'deadbeef' }, body: JSON.stringify(task('gk_test_badsig')) });
  ok(bad.status === 401, 'bad HMAC -> 401, no processing');

  for (const [name, env, wantD, wantR] of cases) {
    const r = await post(env);
    const body = JSON.parse(r.text);
    ok(r.status === 200 && body.decision === wantD && body.reason_code === wantR, `${name}: ${body.decision}/${body.reason_code} (want ${wantD}/${wantR})`);
    ok(hmac.verify(SECRET, Buffer.from(r.text), r.sig), `${name}: response signature valid`);
    if (body.proof) {
      const verified = await snarkjs.groth16.verify(vk, body.public_signals, body.proof);
      ok(verified, `${name}: Groth16 proof verifies locally (${body.public_signals.length} public signals)`);
    } else {
      ok(false, `${name}: missing proof`);
    }
  }

  // reuse: same proof_tx as the valid case
  const reused = task('gk_test_reuse', { proof_tx: cases[0][1].input.proof_tx });
  const rr = await post(reused);
  const rb = JSON.parse(rr.text);
  ok(rb.decision === 'REJECT' && rb.reason_code === 'PROOF_REUSED', `reuse: ${rb.decision}/${rb.reason_code}`);

  // idempotent redelivery -> identical body
  const r1 = await post(cases[0][1]);
  ok(r1.text === (await post(cases[0][1])).text, 'redelivery returns cached identical response');

  // wrong decision cannot be proven (circuit is the referee)
  let threw = false;
  try { await prove(cases[0][1], 'REJECT', SECRET); } catch (_) { threw = true; }
  ok(threw, 'wrong decision on valid task -> witness generation fails (unprovable)');
  let threw2 = false;
  try { await prove(cases[1][1], 'APPROVE', SECRET); } catch (_) { threw2 = true; }
  ok(threw2, 'APPROVE on trapped task -> witness generation fails (unprovable)');

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  process.exit(fail ? 1 : 0);
})();
