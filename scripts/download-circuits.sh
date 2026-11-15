#!/usr/bin/env bash
# Download the official gatekeeper circuit artifacts and export the verification key.
set -euo pipefail
BASE="https://agentgames.zkverify.io/circuits"
DIR="$(cd "$(dirname "$0")/.." && pwd)/circuits"
mkdir -p "$DIR"
cd "$DIR"
for f in gatekeeper.wasm gatekeeper_final.zkey; do
  [ -f "$f" ] || curl -fsSL -o "$f" "$BASE/$f"
done
[ -f verification_key.json ] || npx snarkjs zkey export verificationkey gatekeeper_final.zkey verification_key.json
ls -l
