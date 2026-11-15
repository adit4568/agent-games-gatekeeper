// Agent Games — Proof Gatekeeper agent.
// Public HTTPS endpoint: POST /agent. HMAC verified over the RAW body before parsing.
// Every response body is signed with x-agent-games-signature (HMAC-SHA256 hex).
const http = require('http');
const hmac = require('./src/hmac');
const { decide } = require('./src/decision');
const { prove } = require('./src/prover');
const { Seen } = require('./src/seen');

const PORT = Number(process.env.PORT || 8098);
const SECRET = process.env.AGENT_GAMES_HMAC_SECRET || '';
const SOFT_DEADLINE_MS = Number(process.env.TASK_SOFT_DEADLINE_MS || 50000);
const seen = new Seen();

function signed(status, bodyObj) {
  const body = Buffer.from(JSON.stringify(bodyObj), 'utf8');
  return { status, body, signature: hmac.sign(SECRET, body) };
}

function send(res, out) {
  res.writeHead(out.status, {
    'content-type': 'application/json',
    'content-length': out.body.length,
    ...(out.signature ? { 'x-agent-games-signature': out.signature } : {}),
  });
  res.end(out.body);
}

async function processTask(rawBody, sigHeader) {
  if (!SECRET) return signed(500, { error: 'server misconfigured: AGENT_GAMES_HMAC_SECRET unset' });
  if (!hmac.verify(SECRET, rawBody, sigHeader)) {
    return { status: 401, body: Buffer.from(JSON.stringify({ error: 'unauthorized: bad signature' })), signature: null };
  }
  let env;
  try { env = JSON.parse(rawBody.toString('utf8')); }
  catch (_) { return signed(400, { decision: 'REJECT', reason_code: 'INVALID_TASK', error: 'malformed JSON' }); }

  if (env.type === 'agent-games.preflight.v1') return signed(200, { ok: true, protocolVersion: 'v1' });
  if (env.type !== 'agent-games.proof-gatekeeper.v1')
    return signed(400, { decision: 'REJECT', reason_code: 'INVALID_TASK', error: `unknown type: ${env.type}` });

  const taskId = env.task_id;
  if (typeof taskId !== 'string' || !taskId)
    return signed(400, { decision: 'REJECT', reason_code: 'INVALID_TASK', error: 'missing task_id' });

  const cached = seen.getCached(taskId);
  if (cached) return { status: cached.status, body: Buffer.from(cached.body, 'utf8'), signature: cached.signature };

  const deadline = env.deadline_at ? Date.parse(env.deadline_at) : NaN;
  if (!Number.isNaN(deadline) && Date.now() > deadline) {
    const out = signed(200, { decision: 'REJECT', reason_code: 'INVALID_TASK', proof_tx: env.input?.proof_tx ?? null, error: 'past deadline' });
    seen.setCached(taskId, { status: out.status, body: out.body.toString('utf8'), signature: out.signature });
    return out;
  }

  const started = Date.now();
  const input = env.input || {};
  const { decision, reason_code } = decide(input, seen);

  let proof = null, publicSignals = null, proofError = null;
  if (reason_code !== 'PROOF_REUSED') {
    try {
      const r = await prove(env, decision, SECRET);
      proof = r.proof; publicSignals = r.publicSignals;
    } catch (err) {
      proofError = err.message;
      console.error(`[gatekeeper] proof FAILED ${taskId} ${decision}/${reason_code}: ${err.message}`);
    }
  }

  if (input.proof_tx && reason_code !== 'PROOF_REUSED') seen.markSeen(input.proof_tx);

  const body = { decision, reason_code, proof_tx: input.proof_tx || null };
  if (proof) { body.proof = proof; body.public_signals = publicSignals; }
  if (proofError) body.proof_error = proofError;
  body.elapsed_ms = Date.now() - started;

  const out = signed(200, body);
  seen.setCached(taskId, { status: out.status, body: out.body.toString('utf8'), signature: out.signature });
  console.log(`[gatekeeper] ${taskId} -> ${decision}/${reason_code} ${proof ? 'proof-ok' : 'no-proof'} ${body.elapsed_ms}ms`);
  return out;
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET') {
    const body = Buffer.from(JSON.stringify({ ok: true, service: 'agent-games-gatekeeper', uptime: process.uptime() }));
    res.writeHead(200, { 'content-type': 'application/json', 'content-length': body.length });
    return res.end(body);
  }
  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > 1_000_000) { req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', async () => {
    const raw = Buffer.concat(chunks);
    try {
      const out = await processTask(raw, req.headers['x-agent-games-signature']);
      send(res, out);
    } catch (err) {
      console.error('[fatal]', err);
      send(res, SECRET ? signed(500, { decision: 'REJECT', reason_code: 'INVALID_TASK', error: 'internal' })
                       : { status: 500, body: Buffer.from('{"error":"internal"}'), signature: null });
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`agent-games gatekeeper listening on 127.0.0.1:${PORT} secret=${SECRET ? 'set' : 'MISSING'} soft_deadline=${SOFT_DEADLINE_MS}ms`);
});
