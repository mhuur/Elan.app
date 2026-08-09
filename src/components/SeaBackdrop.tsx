import photo from '../assets/bord-de-mer.webp'

/**
 * Le fond de l'app : la photo de bord de mer, son scrim et ses deux animations.
 *
 * Monté UNE FOIS dans `App` (pas par écran) et posé en `fixed` derrière tout le
 * reste : les écrans défilent, la photo ne bouge pas — c'est ce qui donne la
 * profondeur de la maquette. Les cartes en `bg-glass` la laissent voir au travers,
 * d'où l'ordre indissociable photo → scrim → verre.
 *
 * Le scrim n'est pas décoratif, il est la condition de lisibilité : il monte de 35 %
 * en haut (là où il n'y a que le titre, en très gros) à 88 % en bas (là où
 * s'empilent des lignes de 10 px). Ne pas l'alléger sans revérifier les contrastes.
 *
 * `background-position: 64% 30%` cadre le phare : c'est la position pour laquelle
 * `scripts/make-photo.mjs` a recadré le master, les deux vont ensemble.
 */
export default function SeaBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-cream">
      {/* La photo est désaturée et assombrie AVANT le scrim : le master est une image
          de vente, très contrastée, et l'écume des vagues remontait par-dessus le
          dégradé jusqu'à concurrencer le texte. */}
      <div
        className="absolute inset-0 bg-cover brightness-[0.62] saturate-[0.78]"
        style={{ backgroundImage: `url(${photo})`, backgroundPosition: '64% 30%' }}
      />
      {/* Scrim de lisibilité — cf. plus haut, il tient tout l'écran */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(7_26_38/0.5)_0%,rgb(7_26_38/0.72)_45%,rgb(7_26_38/0.94)_100%)]" />
      {/* Reflet qui balaie lentement l'image, comme un pinceau de phare */}
      <div className="absolute -inset-x-[30%] -inset-y-[30%] animate-[sweep_13s_linear_infinite] bg-[linear-gradient(100deg,transparent_44%,rgb(255_244_214/0.13)_50%,transparent_56%)]" />
      {/* Grain argentique : trame de 3 px qui vibre, casse le lissé du dégradé */}
      <div className="absolute -inset-1 animate-[grain_1.4s_steps(2)_infinite] bg-[radial-gradient(rgb(255_255_255/0.14)_1px,transparent_1px)] bg-[length:3px_3px] opacity-30" />
    </div>
  )
}
