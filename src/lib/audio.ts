/** Joue un bip doux via WebAudio (le contexte doit être créé sur un geste utilisateur) */
export function tone(ctx: AudioContext, freq: number, durSec: number, vol = 0.2): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(vol, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durSec)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + durSec)
}
