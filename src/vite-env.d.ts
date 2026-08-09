/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/* Les feuilles de @fontsource s'importent sans extension (leur champ `exports` mappe
 * `./*` vers `./*.css`, cf. le commentaire de `main.tsx`). TypeScript ne sait pas
 * typer un tel spécificateur — d'où cette déclaration ambiante. */
declare module '@fontsource/*'
