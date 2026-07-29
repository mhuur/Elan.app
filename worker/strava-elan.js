// Cloudflare Worker — pont Strava → Avel
//
// Détient les identifiants Strava (en secrets, jamais dans l'app). À chaque appel il
// rafraîchit le token Strava côté serveur (l'étape que le navigateur ne peut PAS faire :
// Strava bloque le CORS sur /oauth/token), récupère les courses récentes et les renvoie
// au format Avel. Le navigateur (app Avel) ne voit jamais le secret ni le token Strava.
//
// Secrets attendus (wrangler secret put …) :
//   STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN
// Optionnel : ELAN_SYNC_KEY (clé partagée anti-abus léger ; non secrète car embarquée dans l'app)

const ALLOWED_ORIGINS = [
  'https://avel.web.app',
  'https://routine-sport-ca440.web.app',
  'https://routine-sport-ca440.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:5174',
]

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

/** Rafraîchit le token d'accès Strava depuis le refresh_token (le refresh_token Strava est stable). */
async function stravaAccessToken(env) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: env.STRAVA_REFRESH_TOKEN,
    }),
  })
  if (!res.ok) throw new Error('strava token ' + res.status)
  const j = await res.json()
  return j.access_token
}

// Disciplines « course à pied » Strava qu'on importe
const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun'])

/** Mappe une activité Strava vers le format Activity d'Avel */
function toActivity(a) {
  const distanceKm = (a.distance ?? 0) / 1000
  const durationSec = a.moving_time ?? a.elapsed_time ?? 0
  const out = {
    externalId: 'strava-' + a.id,
    date: String(a.start_date_local ?? a.start_date ?? '').slice(0, 10),
    name: a.name ?? 'Course',
    distanceKm: Math.round(distanceKm * 100) / 100,
    durationSec,
    source: 'strava',
  }
  if (distanceKm > 0) out.paceSec = Math.round(durationSec / distanceKm)
  if (a.average_heartrate) out.avgHr = Math.round(a.average_heartrate)
  return out
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? ''
    const cors = corsHeaders(origin)
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
    if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

    // Clé partagée optionnelle (relève légèrement la barre ; pas un vrai secret)
    if (env.ELAN_SYNC_KEY) {
      const auth = request.headers.get('Authorization') ?? ''
      if (auth !== 'Bearer ' + env.ELAN_SYNC_KEY) return json({ error: 'unauthorized' }, 401)
    }

    try {
      const url = new URL(request.url)
      const days = Math.min(60, Math.max(1, Number(url.searchParams.get('days') ?? 30)))
      const after = Math.floor(Date.now() / 1000) - days * 86400
      const token = await stravaAccessToken(env)
      const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=50`, {
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!res.ok) throw new Error('strava activities ' + res.status)
      const list = await res.json()
      const activities = (Array.isArray(list) ? list : [])
        .filter((a) => RUN_TYPES.has(a.sport_type ?? a.type))
        .map(toActivity)
        .filter((a) => a.date)
      return json({ activities })
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 502)
    }
  },
}
