// Autorisation Strava unique → récupère un refresh_token (à mettre dans les secrets du Worker).
// Zéro dépendance : petit serveur localhost + fetch natif (Node 18+).
// Usage : node scripts/strava-auth.mjs   (ou double-clic sur autoriser-strava.bat)
import http from 'node:http'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const PORT = 4571
const REDIRECT = `http://localhost:${PORT}/callback`

const rl = createInterface({ input: stdin, output: stdout })
const clientId = (process.env.STRAVA_CLIENT_ID || (await rl.question('Strava Client ID : '))).trim()
const clientSecret = (process.env.STRAVA_CLIENT_SECRET || (await rl.question('Strava Client Secret : '))).trim()
if (!clientId || !clientSecret) {
  console.error('Client ID et Client Secret requis.')
  process.exit(1)
}

const authUrl =
  `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}` +
  `&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT)}` +
  `&approval_prompt=auto&scope=activity:read_all`

console.log('\n1) Sur https://www.strava.com/settings/api, mets « Authorization Callback Domain » = localhost')
console.log('2) Ouvre cette URL dans ton navigateur et clique « Authorize » :\n')
console.log('   ' + authUrl + '\n')

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, REDIRECT)
    if (u.pathname !== '/callback') {
      res.writeHead(404)
      res.end()
      return
    }
    const c = u.searchParams.get('code')
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<h2>Autorisation reçue ✓</h2><p>Reviens au terminal, tu peux fermer cet onglet.</p>')
    server.close()
    if (c) resolve(c)
    else reject(new Error(u.searchParams.get('error') || 'pas de code'))
  })
  server.on('error', reject)
  server.listen(PORT, () => console.log(`En attente de l'autorisation sur ${REDIRECT} …`))
})

const res = await fetch('https://www.strava.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code' }),
})
const j = await res.json()
rl.close()
if (!res.ok) {
  console.error('\nÉchec de l\'échange du token :', j)
  process.exit(1)
}

console.log('\n✅ refresh_token obtenu. Pose ces 3 secrets sur le Worker (dossier worker/) :\n')
console.log('   npx wrangler secret put STRAVA_CLIENT_ID       →', clientId)
console.log('   npx wrangler secret put STRAVA_CLIENT_SECRET   →', clientSecret)
console.log('   npx wrangler secret put STRAVA_REFRESH_TOKEN   →', j.refresh_token)
console.log(`\n(athlète ${j.athlete?.id ?? '?'} · scope ${j.scope ?? 'activity:read_all'})`)
