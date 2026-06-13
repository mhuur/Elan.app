// Lit les identifiants intervals.icu (clé API + Athlete ID) sans avoir à les retaper.
// Ordre : variables d'environnement, puis un fichier texte du dossier (ex. « user + API.txt »).
// Le fichier est gitignoré — il ne doit jamais être committé.
//
// Formats acceptés dans le fichier (souple) :
//   API = ta_clé            (ou « clé : ta_clé », « api key: ... »)
//   user = i123456          (ou « athlete id : i123456 »)
// …ou simplement les deux valeurs en vrac (l'Athlete ID est reconnu au motif iXXXXX).
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
// On cherche dans Sport/ puis dans le dossier SPORT/ parent
const SEARCH_DIRS = [join(scriptsDir, '..'), join(scriptsDir, '..', '..')]
const NAME_RE = /(intervals|api|ident|cred|user)/i

function parse(txt) {
  const out = {}
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([^=:]+?)\s*[=:]\s*(\S.*?)\s*$/)
    if (!m) continue
    const label = m[1].toLowerCase()
    const value = m[2].trim()
    if (/(key|api|cl[eé])/.test(label) && !out.key) out.key = value
    else if (/(athlete|user|id)/.test(label) && !out.athleteId) out.athleteId = value
  }
  // Repli : valeurs en vrac (Athlete ID = iXXXXX ; clé = le plus long jeton restant)
  if (!out.key || !out.athleteId) {
    const tokens = txt.split(/[\s=:,;]+/).map((t) => t.trim()).filter(Boolean)
    for (const t of tokens) if (/^i\d{3,}$/i.test(t) && !out.athleteId) out.athleteId = t
    if (!out.key) {
      const cand = tokens.filter((t) => t !== out.athleteId && t.length >= 16 && /^[A-Za-z0-9_-]+$/.test(t))
      if (cand.length) out.key = cand.sort((a, b) => b.length - a.length)[0]
    }
  }
  return out
}

function fromFile() {
  for (const dir of SEARCH_DIRS) {
    let files = []
    try {
      files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.txt') && NAME_RE.test(f))
    } catch {
      continue
    }
    for (const f of files) {
      try {
        const c = parse(readFileSync(join(dir, f), 'utf8'))
        if (c.key && c.athleteId) return { ...c, file: f }
      } catch {
        // fichier illisible : on passe au suivant
      }
    }
  }
  return {}
}

/** { key, athleteId, file? } — file = nom du fichier utilisé (pour l'afficher) */
export function loadCreds() {
  let key = process.env.INTERVALS_API_KEY
  let athleteId = process.env.INTERVALS_ATHLETE_ID
  let file
  if (!key || !athleteId) {
    const f = fromFile()
    key = key || f.key
    athleteId = athleteId || f.athleteId
    file = f.file
  }
  return { key, athleteId, file }
}
