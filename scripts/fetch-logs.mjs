// Lit les logs Avel depuis Firestore via les identifiants firebase-tools déjà connectés.
// Usage : node scripts/fetch-logs.mjs
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PROJECT = 'routine-sport-ca440'
// Client OAuth public du CLI firebase-tools (constantes publiques du dépôt open source)
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'

const cfg = JSON.parse(readFileSync(join(homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'))

async function accessToken() {
  const t = cfg.tokens
  if (t.access_token && t.expires_at && t.expires_at > Date.now() + 60_000) return t.access_token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: t.refresh_token,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  })
  if (!res.ok) throw new Error(`refresh failed: ${res.status} ${await res.text()}`)
  return (await res.json()).access_token
}

const token = await accessToken()
const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)`

async function api(path, init) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`${path}: ${res.status} ${JSON.stringify(body)}`)
  return body
}

// Valeur Firestore → JS
function val(v) {
  if (v == null) return null
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('nullValue' in v) return null
  if ('timestampValue' in v) return v.timestampValue
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, val(x)]))
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(val)
  return v
}
const doc2obj = (d) => ({ _id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, val(v)])) })

// Requête collection group sur les logs (tous les uid)
async function collectionGroup(colId) {
  const out = []
  let q = {
    structuredQuery: { from: [{ collectionId: colId, allDescendants: true }], limit: 2000 },
  }
  const rows = await api(`/documents:runQuery`, { method: 'POST', body: JSON.stringify(q) })
  for (const r of rows) if (r.document) out.push(doc2obj(r.document))
  return out
}

const logs = await collectionGroup('logs')
const sessions = await collectionGroup('sessions')
console.log(JSON.stringify({ nLogs: logs.length, nSessions: sessions.length, logs, sessions }, null, 1))
