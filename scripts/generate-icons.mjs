// Generates PWA icons from an inline SVG. Run: npm run icons
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const mark = (scale = 1) => {
  // The "V" + green dot mark, centered; `scale` shrinks it for the maskable safe zone.
  const t = (512 * (1 - scale)) / 2;
  return `<g transform="translate(${t} ${t}) scale(${scale})">
    <path d="M136 152h72l48 136 48-136h72L288 368h-64z" fill="#fff"/>
    <circle cx="376" cy="360" r="40" fill="#22C55E"/>
  </g>`;
};
const bg = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8B5CF6"/><stop offset="1" stop-color="#38BDF8"/></linearGradient></defs>`;

const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}<rect width="512" height="512" rx="112" fill="url(#g)"/>${mark()}</svg>`;
// Full-bleed square (iOS and maskable icons apply their own rounding/masks).
const square = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}<rect width="512" height="512" fill="url(#g)"/>${mark(scale)}</svg>`;

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/favicon.svg', rounded);
await sharp(Buffer.from(rounded)).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(Buffer.from(rounded)).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(Buffer.from(square(0.72))).resize(512, 512).png().toFile('public/icons/maskable-512.png');
await sharp(Buffer.from(square(0.86))).resize(180, 180).flatten({ background: '#0B0F19' }).png().toFile('public/apple-touch-icon.png');
console.log('Icons written to public/');
