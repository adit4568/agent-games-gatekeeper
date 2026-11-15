# Agent Games — Proof Gatekeeper agent

Deterministic agent endpoint for **zkVerify Agent Games · Proof Gatekeeper**.

The platform POSTs signed task envelopes to a public HTTPS endpoint. This
agent verifies the HMAC over the **raw** body, applies a deterministic
APPROVE/REJECT policy that mirrors the official gatekeeper circuit, generates
a Groth16 proof of that decision locally with snarkjs, and returns a signed
response. A wrong decision cannot be proven — the circuit is the referee.

## Protocol implemented

| Element | Value |
|---|---|
| Endpoint | `POST /agent` (HTTPS, public) |
| Inbound auth | `x-agent-games-signature` = HMAC-SHA256(secret, raw body), hex |
| Outbound auth | same header over the raw response body |
| Preflight | `{ "ok": true, "protocolVersion": "v1" }`, signed |
| Circuit | Groth16 / BN128, Circom 2.x |
| vk_hash | `0x6b79c6012a6d8651f3e13bc4d2a20370280ab49700c90c5316d4168bfbad77b0` |
| Public signals | 13 |
| Hard deadline | 60 s (soft deadline 50 s) |

### Circuit inputs (13)

`taskId, registeredVkHash, proofVkHash, minimum, publicBalance, expiryBlock,
currentBlock, recipient, conditionRecipient, amount, maxTransfer, decision,
salt` — `salt` is private and derived as
`HMAC-SHA256(secret, "gatekeeper-salt:" + task_id) mod p`, so a redelivered
task reproduces identical proof inputs.

### Decision policy (fail closed)

APPROVE only when **all** hold, otherwise REJECT with the matching code:

1. `proof_vk == registered_vk` → else `VK_SUBSTITUTION`
2. `proof_tx` unseen → else `PROOF_REUSED`
3. `public_balance >= minimum` → else `THRESHOLD_MISMATCH`
4. `current_block < expiry_block` → else `EXPIRED_CONDITION`
5. `recipient == condition_recipient` → else `RECIPIENT_MISMATCH`
6. `amount <= max_transfer` → else `AMOUNT_OVERFLOW`

Anything malformed, past deadline, or unprovable → `REJECT` (`INVALID_TASK`).
Never an unproven APPROVE.

## Run

```bash
npm install
cp .env.example .env          # set AGENT_GAMES_HMAC_SECRET
bash scripts/download-circuits.sh
node server.js
node test/run.js              # 25 assertions: preflight, 7 trap varieties,
                              # signature checks, local proof verification,
                              # reuse + idempotency, unprovability of wrong decisions
```

## Layout

```
server.js          HTTP server, raw-body HMAC gate, signed responses
src/hmac.js        HMAC-SHA256 sign/verify (hex, base64, sha256= prefix)
src/field.js       BN128 field helpers, task_id → field, salt derivation
src/decision.js    deterministic policy + reason codes
src/prover.js      snarkjs Groth16 fullProve against the official artifacts
src/seen.js        persistent seen-proof set + per-task response cache
test/run.js        local harness (no network, no secrets)
scripts/          circuit downloader
```

## Secrets

`AGENT_GAMES_HMAC_SECRET` comes from the platform dashboard (Rotate Secret) and
is never committed. `KURIER_API_KEY` is optional: proofs are returned inline in
the response, so scoring does not depend on an on-chain submission.
