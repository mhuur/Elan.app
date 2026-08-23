// Génère Plan-Semi-Rennes-2026.xlsx (vrai .xlsx, sans dépendance de tableur) à partir du plan.
//
// SOURCE UNIQUE : le plan vient de src/data/plan.ts, comme l'app Avel et comme
// scripts/push-to-intervals.mjs (→ intervals.icu → montre COROS). Ne jamais redéclarer les
// séances ici : c'est ce qui avait fait diverger le tableur de l'app d'une semaine entière.
// Seuls le journal (JOURNAL, ce qui a réellement eu lieu) et la stratégie de course (feuille
// « Jour J ») sont propres à ce fichier — ils n'existent pas dans le plan.
//
// Usage :  node scripts/gen-xlsx.mjs     (depuis la racine du projet, ou via generer-le-tableur.bat)
// Sortie :  ../Plan-Semi-Rennes-2026.xlsx  — le dossier Elan, à côté du mémo .md
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// Charge le plan (TypeScript) via Vite — même mécanisme que push-to-intervals.mjs
const root = fileURLToPath(new URL('..', import.meta.url))
const vite = await createServer({
  root,
  configFile: false,
  logLevel: 'silent',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
})
const { PLAN_SEMI, PLAN_ZONES, TYPE_META, seanceDateStr, workoutStats, isRepeat } =
  await vite.ssrLoadModule('/src/data/plan.ts')
await vite.close()

// ---------- ZIP (store, sans compression) + CRC32 ----------
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (~c) >>> 0
}
function zip(files) {
  const dosTime = (12 << 11) | (0 << 5) | 0
  const dosDate = ((2026 - 1980) << 9) | (6 << 5) | 13
  const chunks = [], central = []
  let offset = 0
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8')
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8')
    const crc = crc32(data)
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8)
    lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12)
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22)
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28)
    chunks.push(lh, name, data)
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(0, 10)
    ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14)
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24)
    ch.writeUInt16LE(name.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36)
    ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42)
    central.push(ch, name)
    offset += lh.length + name.length + data.length
  }
  const cd = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20)
  return Buffer.concat([...chunks, cd, eocd])
}

// ---------- helpers XLSX ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const colLetter = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26 } return s }
// cellule : {v, s, n} — n=true pour nombre
function sheetXml(sheet) {
  const rowsXml = sheet.rows.map((row, r) => {
    const cells = row.map((c, ci) => {
      if (c == null) return ''
      const ref = colLetter(ci) + (r + 1)
      const s = c.s ?? 0
      if (c.n) return `<c r="${ref}" s="${s}"><v>${c.v}</v></c>`
      return `<c r="${ref}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`
    }).join('')
    return `<row r="${r + 1}">${cells}</row>`
  }).join('')
  const cols = sheet.cols
    ? `<cols>${sheet.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : ''
  const filter = sheet.autoFilter ? `<autoFilter ref="${sheet.autoFilter}"/>` : ''
  const views = `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews>`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${views}${cols}<sheetData>${rowsXml}</sheetData>${filter}</worksheet>`
}

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font>
</fonts>
<fills count="7">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF36423A"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE2EBE1"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFDCE7F0"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF3E6D2"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEDEAE2"/></patternFill></fill>
</fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
</cellXfs>
</styleSheet>`

// ---------- journal : ce qui a réellement eu lieu ----------
// Le plan (src/data/plan.ts) dit le prévu ; cette table dit le réalisé et les consignes du jour.
// Clé = date YYYY-MM-DD. Le texte va dans la colonne « Suivi » de la séance de ce jour-là, ou
// sur sa propre ligne (type « Hors plan ») si le plan ne prévoit rien ce jour-là.
const JOURNAL = {
  '2026-08-03': "SEMAINE NON RÉALISÉE (mal de dos) : 0 km sur les 38 prévus. VMA 8×400 m @ 4:40, footing 7 km, seuil 20 min continu @ 5:18 et sortie longue 13 km — non rattrapés.",
  '2026-08-10': "RÉALISÉ hors plan — 6,2 km à 5:49/km pour 155 bpm par 33 °C, nuit courte, dos appréhendé. INEXPLOITABLE comme mesure de forme : ne pas en tirer de conclusion.",
  '2026-08-11': "Le footing test a été fait la veille (lundi 10). Ce jour-là : 45 min de vélo, non enregistré sur la montre (charge COROS comptée pour zéro).",
  '2026-08-12': "TÔT LE MATIN. STOP si douleur lombaire à l'échauffement (→ 6 km EF à la place) ou si la FC dépasse 172 sur la 1ʳᵉ fraction. Séance identique à celle planifiée sur la montre COROS.",
  '2026-08-16': "TÔT LE MATIN (avant 8 h), chaleur annoncée. Cadence cible 168 spm.",
}

// ---------- dérivation du plan → lignes de tableur ----------
const PHASE_STYLE = { Fondation: 5, Reconstruction: 5, 'Développement': 6, 'Spécifique': 7, 'Affûtage': 8 }
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS = ['janv', 'févr', 'mars', 'avril', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc']

const dateOf = (iso) => new Date(iso + 'T12:00:00')
const plusJours = (iso, n) => { const x = dateOf(iso); x.setDate(x.getDate() + n); return x }
const isoOf = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
const num = (x) => String(Math.round(x * 10) / 10).replace('.', ',')

/** « 15–21 juin », « 29 juin–5 juil » */
function libelleSemaine(start) {
  const a = dateOf(start), b = plusJours(start, 6)
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MOIS[b.getMonth()]}`
    : `${a.getDate()} ${MOIS[a.getMonth()]}–${b.getDate()} ${MOIS[b.getMonth()]}`
}

const fmtDuree = (sec) => (sec % 60 ? `${Math.floor(sec / 60)} min ${sec % 60} s` : `${Math.round(sec / 60)} min`)
const fmtCible = (s) => (s.distanceM ? (s.distanceM >= 1000 ? `${num(s.distanceM / 1000)} km` : `${s.distanceM} m`) : fmtDuree(s.durationSec ?? 0))
const fmtAllure = (p) => (!p ? null : p.to ? `${p.from}–${p.to}` : p.from)

/** Une étape en clair : « 8 min @ 5:15 », « 400 m @ 4:40 », « récup 2 min », « échauff. 20 min » */
function etape(s) {
  if (s.kind === 'recovery') return `récup ${fmtCible(s)}`
  if (s.kind === 'warmup') return `échauff. ${fmtCible(s)}`
  if (s.kind === 'cooldown') return `calme ${fmtCible(s)}`
  const allure = fmtAllure(s.pace)
  return `${fmtCible(s)}${allure ? ` @ ${allure}` : ''}`
}

/** Séance en une ligne : « échauff. 20 min + 2×(8 min @ 5:15 + récup 2 min) + calme 10 min » */
function resume(w) {
  const corps = w.parts.map((p) => (isRepeat(p) ? `${p.repeat}×(${p.steps.map(etape).join(' + ')})` : etape(p)))
  const notes = w.parts.flatMap((p) => (isRepeat(p) ? p.steps : [p])).map((s) => s.note).filter(Boolean)
  return corps.join(' + ') + (notes.length ? ` — ${notes.join(' ; ')}` : '')
}

/** Allure et FC affichées : celles des étapes de travail (à défaut, de toutes les étapes) */
function ciblesDe(w) {
  const plat = w.parts.flatMap((p) => (isRepeat(p) ? p.steps : [p]))
  const utiles = plat.filter((s) => s.kind === 'work' || s.kind === 'steady')
  const source = utiles.length ? utiles : plat
  const allures = [...new Set(source.map((s) => fmtAllure(s.pace)).filter(Boolean))]
  const fcs = [...new Set(source.map((s) => s.hr).filter(Boolean))]
  return { allure: allures.join(' / ') || '—', fc: fcs.join(' / ') || '—' }
}

// Une ligne par séance du plan, plus les entrées de journal qui ne tombent sur aucune séance
const LIGNES = PLAN_SEMI.weeks.map((w, i) => {
  const dates = libelleSemaine(w.start)
  const datesDuPlan = new Set(w.seances.map((sc) => seanceDateStr(w, sc)))
  const seances = w.seances.map((sc) => {
    const date = seanceDateStr(w, sc)
    const { allure, fc } = ciblesDe(sc.workout)
    return {
      date, jour: JOURS[sc.day], type: TYPE_META[sc.type].short, detail: resume(sc.workout),
      allure, fc, km: Math.round(workoutStats(sc.workout).distM / 100) / 10, suivi: JOURNAL[date] ?? '',
    }
  })
  for (let j = 0; j < 7; j++) {
    const date = isoOf(plusJours(w.start, j))
    if (JOURNAL[date] && !datesDuPlan.has(date)) {
      seances.push({ date, jour: JOURS[j], type: 'Hors plan', detail: '—', allure: '—', fc: '—', km: 0, suivi: JOURNAL[date] })
    }
  }
  seances.sort((a, b) => a.date.localeCompare(b.date))
  // Volume hebdo : la valeur déclarée dans le plan fait foi (c'est elle que l'app affiche) ;
  // on alerte si la somme des séances s'en écarte, signe que le plan lui-même est à recaler.
  const calcule = seances.reduce((a, s) => a + s.km, 0)
  if (Math.abs(calcule - w.km) > 1.5) {
    console.warn(`⚠ Semaine du ${w.start} : km déclaré ${w.km}, somme des séances ${num(calcule)} — à recaler dans src/data/plan.ts`)
  }
  return { n: i + 1, dates, phase: w.phase, km: w.km, seances }
})

// ---------- feuille « Plan » ----------
const planHeader = ['Sem.', 'Dates', 'Phase', 'Jour', 'Type', 'Détail de la séance', 'Allure /km', 'FC cible (bpm)', 'Dist. (km)', 'Volume sem. (km)', 'Suivi']
const planRows = [planHeader.map((h) => ({ v: h, s: 1 }))]
for (const w of LIGNES) {
  const ps = PHASE_STYLE[w.phase]
  for (const s of w.seances) {
    planRows.push([
      { v: w.n, n: true, s: 3 },
      { v: w.dates, s: 3 },
      { v: w.phase, s: ps },
      { v: s.jour, s: 3 },
      { v: s.type, s: 3 },
      { v: s.detail, s: 2 },
      { v: s.allure, s: 3 },
      { v: s.fc, s: 3 },
      { v: s.km, n: true, s: 3 },
      { v: w.km, n: true, s: 4 },
      { v: s.suivi, s: 2 },
    ])
  }
}
const planSheet = { name: 'Plan', cols: [6, 15, 15, 6, 14, 56, 13, 14, 10, 14, 60], autoFilter: `A1:K${planRows.length}`, rows: planRows }

// ---------- feuille « Allures & FC » ----------
// Les 5 zones viennent de PLAN_ZONES (src/data/plan.ts) — mêmes bornes que l'app et la montre ;
// seul le commentaire « à quoi ça sert » est propre au tableur.
const ROLE_ZONE = {
  'Endurance fondamentale': 'Zone contiguë. 70 % du plan, tu dois pouvoir parler en phrases (FC ≤ 150).',
  'Endurance active': 'Fins de sorties longues. Soutenu mais confortable.',
  Seuil: 'Repousser le seuil = la clé du chrono. Tenable ~1 h.',
  'Allure semi (cible)': "L'allure du jour J. Contrôlé mais exigeant.",
  VMA: 'Cylindrée. Fractions de 30 s à 3 min.',
}
const ah = ['Zone', 'Allure /km', 'FC cible (bpm)', 'À quoi ça sert / ressenti']
const allureRows = [ah.map((h) => ({ v: h, s: 1 }))]
;[
  ...PLAN_ZONES.map((z) => [z.label, z.pace, z.hr, ROLE_ZONE[z.label] ?? '']),
  ['', '', '', ''],
  ['Repères perso (COROS)', '', '', ''],
  ['FC de repos', '', '≈ 55', 'Juillet : 55–58 bpm (52 en juin). Zones calculées sur 52, écart négligeable.'],
  ['FC max estimée', '', '≈ 186', 'Estimée (non mesurée) — à confirmer par un test. Max vue au fartlek du 22/07 : 176.'],
  ['FC au seuil', '5:22–5:27', '≈ 168', "Croisé sur tes courses : 5:22/km = 168 bpm = seuil. Seuil COROS au 26/07 : 5:27."],
  ['', '', '', ''],
  ['Point d\'étape — 26/07/2026', '', '', 'Fin de reconstruction (R1–R3). EF à 5:37/km pour 148 bpm (contre 6:12 le 07/07).'],
  ['Fartlek du 22/07 (8×1 min)', '4:29–4:49', 'max 176', 'Moyenne 4:42 pour une cible à 4:55 → allures VMA du plan validées.'],
].forEach((r) => allureRows.push(r.map((v, i) => ({ v, s: i === 0 ? 4 : 2 }))))
const allureSheet = { name: 'Allures & FC', cols: [28, 14, 16, 52], autoFilter: 'A1:D1', rows: allureRows }

// ---------- feuille « Jour J » ----------
// Recalibré le 23/08 (analyse Strava) : seuil réel 5:15–5:20, cible ramenée de 1h50 à 1h53 (5:21/km).
const jh = ['Passage', 'Temps cible (5:21 /km)', 'Consigne']
const jourRows = [jh.map((h) => ({ v: h, s: 1 }))]
;[
  ['5 km', '27:00', 'Se caler à 5:25–5:27. Surtout pas plus vite.'],
  ['10 km', '53:45', 'Revenir vers 5:21, rester relâché, boire au ravito.'],
  ['15 km', '1:20:30', 'Tenir. Gel vers 45 min puis 1 h 20 (testés à la rép. générale).'],
  ['20 km', '1:47:15', 'Si les jambes répondent, accélérer progressivement.'],
  ['Arrivée — 21,1 km', '1:52:55', 'Objectif < 1h53 (négatif split).'],
].forEach((r) => jourRows.push(r.map((v, i) => ({ v, s: i === 0 ? 4 : 2 }))))
const jourSheet = { name: 'Jour J', cols: [22, 22, 56], autoFilter: 'A1:C1', rows: jourRows }

// ---------- assemblage du classeur ----------
const sheets = [planSheet, allureSheet, jourSheet]
const files = [
  { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>` },
  { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>` },
  { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>` },
  { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>` },
  { name: 'xl/styles.xml', data: stylesXml },
  ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
]

// Le tableur vit à côté du mémo, dans le dossier Elan — hors app, comme le master de la photo
const sortie = fileURLToPath(new URL('../../Plan-Semi-Rennes-2026.xlsx', import.meta.url))
writeFileSync(sortie, zip(files))
console.log(`OK — ${sortie}`)
console.log(`   ${planRows.length - 1} séances sur ${LIGNES.length} semaines, ${sheets.length} feuilles — source : src/data/plan.ts`)
