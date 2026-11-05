// Génère les icônes PWA d'OCKA (public/icones) à partir d'un SVG : carré violet arrondi,
// un « O » épais avec trois barres d'égaliseur au centre. Usage : node scripts/icones.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dossier = fileURLToPath(new URL('../public/icones/', import.meta.url));
const VIOLET = '#A855F7';
const FOND = '#0E0B14';

function motif(echelle) {
  const t = `translate(256 256) scale(${echelle}) translate(-256 -256)`;
  return `<g transform="${t}">
    <circle cx="256" cy="256" r="150" fill="none" stroke="${FOND}" stroke-width="56"/>
    <rect x="206" y="216" width="24" height="80" rx="12" fill="${FOND}"/>
    <rect x="244" y="186" width="24" height="140" rx="12" fill="${FOND}"/>
    <rect x="282" y="226" width="24" height="60" rx="12" fill="${FOND}"/>
  </g>`;
}
const normale = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect x="16" y="16" width="480" height="480" rx="112" fill="${VIOLET}"/>${motif(1)}</svg>`;
const masquable = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${VIOLET}"/>${motif(0.78)}</svg>`;

await mkdir(dossier, { recursive: true });
await sharp(Buffer.from(normale)).resize(192, 192).png().toFile(dossier + 'icone-192.png');
await sharp(Buffer.from(normale)).resize(512, 512).png().toFile(dossier + 'icone-512.png');
await sharp(Buffer.from(masquable)).resize(512, 512).png().toFile(dossier + 'icone-maskable-512.png');
console.log('Icônes écrites dans', dossier);
