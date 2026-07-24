// Composes App Store marketing screenshots (iPhone 6.5" 1242x2688, iPad 13" 2048x2732)
// from raw app screenshots in attached_assets/store/, in a dark "hero" style.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const OUT = 'attached_assets/store/out';
mkdirSync(OUT, { recursive: true });

const BG = '#12101c';
const GLOW = '#4f46e5';
const BRAND = '#8b85f7';

const shots = [
  {
    file: 'attached_assets/store/shot-home.jpg',
    key: 'home',
    sv: {
      h1: ['Köp och sälj', 'begagnat – enkelt'],
      sub: ['Marknadsplatsen där AI gör jobbet', 'åt dig – helt gratis.'],
    },
    en: {
      h1: ['Buy & sell', 'second-hand, simply'],
      sub: ['The marketplace where AI does', 'the work for you — free.'],
    },
  },
  {
    file: 'attached_assets/store/shot-listing.jpg',
    key: 'listing',
    sv: {
      h1: ['Färdig annons', 'på sekunder'],
      sub: ['Fota eller prata – AI:n skriver titel,', 'beskrivning och prisförslag.'],
    },
    en: {
      h1: ['A polished listing', 'in seconds'],
      sub: ['Snap or speak — AI writes the title,', 'description and price.'],
    },
  },
  {
    file: 'attached_assets/store/shot-search.jpg',
    key: 'search',
    sv: {
      h1: ['Fynda något', 'du älskar'],
      sub: ['Sök och filtrera bland annonser', 'i hela landet.'],
    },
    en: {
      h1: ['Find something', 'you love'],
      sub: ['Search and filter listings', 'across the country.'],
    },
  },
];

const targets = [
  { name: 'iphone', W: 1242, H: 2688, phoneW: 860, brandSize: 40, h1Size: 104, subSize: 48, topPad: 150 },
  { name: 'ipad', W: 2048, H: 2732, phoneW: 830, brandSize: 46, h1Size: 118, subSize: 54, topPad: 170 },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function roundedScreenshot(file, width, radius) {
  const img = sharp(file).resize({ width });
  const { data, info } = await img.toBuffer({ resolveWithObject: true });
  const mask = Buffer.from(
    `<svg width="${info.width}" height="${info.height}"><rect x="0" y="0" width="${info.width}" height="${info.height}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`,
  );
  const out = await sharp(data)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
  return { buf: out, w: info.width, h: info.height };
}

for (const t of targets) {
  for (const shot of shots) {
    for (const lang of ['sv', 'en']) {
      const c = shot[lang];
      const screenR = Math.round(t.phoneW * 0.085);
      const bezel = Math.round(t.phoneW * 0.035);
      const shotImg = await roundedScreenshot(shot.file, t.phoneW, screenR);

      const phoneW = shotImg.w + bezel * 2;
      const phoneH = shotImg.h + bezel * 2;
      const phoneX = Math.round((t.W - phoneW) / 2);
      // text block heights
      const textBottom = t.topPad + t.brandSize + 40 + c.h1.length * (t.h1Size * 1.12) + 50 + c.sub.length * (t.subSize * 1.4);
      const phoneY = Math.round(textBottom + 90);

      const pillW = Math.round(shotImg.w * 0.28);
      const pillH = Math.round(bezel * 0.6);

      const svg = `
<svg width="${t.W}" height="${t.H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="30%" r="75%">
      <stop offset="0%" stop-color="${GLOW}" stop-opacity="0.28"/>
      <stop offset="55%" stop-color="${GLOW}" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="${GLOW}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="${BG}"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <text x="50%" y="${t.topPad + t.brandSize}" text-anchor="middle" fill="${BRAND}"
    font-family="DejaVu Sans, sans-serif" font-size="${t.brandSize}" font-weight="bold"
    letter-spacing="${Math.round(t.brandSize * 0.35)}">SELLIFY</text>
  ${c.h1
    .map(
      (line, i) =>
        `<text x="50%" y="${t.topPad + t.brandSize + 60 + (i + 1) * t.h1Size * 1.12}" text-anchor="middle" fill="#ffffff" font-family="DejaVu Sans, sans-serif" font-size="${t.h1Size}" font-weight="bold">${esc(line)}</text>`,
    )
    .join('\n')}
  ${c.sub
    .map(
      (line, i) =>
        `<text x="50%" y="${t.topPad + t.brandSize + 90 + c.h1.length * t.h1Size * 1.12 + (i + 1) * t.subSize * 1.4}" text-anchor="middle" fill="#c9c5e8" font-family="DejaVu Sans, sans-serif" font-size="${t.subSize}">${esc(line)}</text>`,
    )
    .join('\n')}
  <rect x="${phoneX}" y="${phoneY}" width="${phoneW}" height="${phoneH}"
    rx="${screenR + bezel}" ry="${screenR + bezel}" fill="#231f33" stroke="#3b3555" stroke-width="3"/>
</svg>`;

      const pillSvg = Buffer.from(
        `<svg width="${pillW}" height="${pillH}"><rect width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="#000"/></svg>`,
      );

      const outFile = `${OUT}/${t.name}-${shot.key}-${lang}.png`;
      await sharp(Buffer.from(svg))
        .composite([
          { input: shotImg.buf, left: phoneX + bezel, top: phoneY + bezel },
          {
            input: pillSvg,
            left: Math.round(t.W / 2 - pillW / 2),
            top: phoneY + bezel + Math.round(bezel * 0.5),
          },
        ])
        .flatten({ background: BG })
        .png()
        .resize(t.W, t.H)
        .toFile(outFile);
      console.log('wrote', outFile);
    }
  }
}
