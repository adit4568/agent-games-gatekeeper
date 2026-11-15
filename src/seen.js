// Persistent state: seen proof_tx set (PROOF_REUSED detection) + per-task
// response cache (idempotent redelivery). Backed by a JSON file so a restart
// does not lose reuse history.
const fs = require('fs');
const path = require('path');

const FILE = process.env.SEEN_FILE || path.join(__dirname, '..', 'data', 'seen.json');

class Seen {
  constructor(file = FILE) {
    this.file = file;
    this.seen = new Set();
    this.cache = new Map();
    this._load();
  }
  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      (raw.seen || []).forEach((t) => this.seen.add(t));
      Object.entries(raw.cache || {}).forEach(([k, v]) => this.cache.set(k, v));
    } catch (_) { /* fresh start */ }
  }
  _save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const data = { seen: [...this.seen].slice(-5000), cache: Object.fromEntries([...this.cache].slice(-500)) };
      fs.writeFileSync(this.file, JSON.stringify(data));
    } catch (e) { console.error('[seen] save failed:', e.message); }
  }
  has(tx) { return this.seen.has(String(tx)); }
  markSeen(tx) { if (tx) { this.seen.add(String(tx)); this._save(); } }
  getCached(taskId) { return this.cache.get(taskId) || null; }
  setCached(taskId, value) { this.cache.set(taskId, value); this._save(); }
}

module.exports = { Seen };
