/**
 * Regenerates every CPBoard icon from the monogram in `src/lib/brand-mark.ts`.
 * Run from the repository root with `npm run brand:icons`.
 *
 * Browser-tab favicons (`icon.svg`) stay transparent and switch ink colour with
 * the browser's colour scheme. Raster icons sit on the site's dark tile,
 * because app launchers and old favicon slots need an opaque background.
 * `sharp` ships with Next.js, so it needs no extra install.
 */
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { BRAND_COLORS, BRAND_MARK_PATHS } from "../src/lib/brand-mark";

const TILE_TOP = "#161a23";
const TILE_BOTTOM = "#090b10";

function markGroup(ink: string, scale: number) {
  const transform =
    scale === 1 ? "" : ` transform="translate(256 256) scale(${scale}) translate(-256 -256)"`;
  return (
    `<g${transform} fill-rule="evenodd">` +
    `<path fill="${ink}" d="${BRAND_MARK_PATHS.c}"/>` +
    `<path fill="${BRAND_COLORS.red}" d="${BRAND_MARK_PATHS.p}"/>` +
    `<path fill="${ink}" d="${BRAND_MARK_PATHS.b}"/>` +
    `</g>`
  );
}

/** Transparent mark whose ink follows the viewer's light/dark preference. */
function adaptiveSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <title>CPBoard</title>
  <style>
    .ink { fill: ${BRAND_COLORS.inkOnLight}; }
    @media (prefers-color-scheme: dark) { .ink { fill: ${BRAND_COLORS.ink}; } }
  </style>
  <g fill-rule="evenodd">
    <path class="ink" d="${BRAND_MARK_PATHS.c}"/>
    <path fill="${BRAND_COLORS.red}" d="${BRAND_MARK_PATHS.p}"/>
    <path class="ink" d="${BRAND_MARK_PATHS.b}"/>
  </g>
</svg>
`;
}

/** The mark on the dark tile: rounded for regular icons, full-bleed for maskable/iOS. */
function tileSvg({ rounded, scale }: { rounded: boolean; scale: number }) {
  const radius = rounded ? ` rx="116"` : "";
  const border = rounded
    ? `<rect x="4" y="4" width="504" height="504" rx="112" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="8"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${TILE_TOP}"/>
      <stop offset="1" stop-color="${TILE_BOTTOM}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512"${radius} fill="url(#tile)"/>${border}
  ${markGroup(BRAND_COLORS.ink, scale)}
</svg>`;
}

async function png(svg: string, size: number) {
  return sharp(Buffer.from(svg), { density: 300 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Packs PNG images into a .ico container (PNG-compressed entries). */
function ico(images: { size: number; data: Buffer }[]) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

async function main() {
  const adaptive = adaptiveSvg();
  const regular = tileSvg({ rounded: true, scale: 0.76 });
  const maskable = tileSvg({ rounded: false, scale: 0.6 });
  const apple = tileSvg({ rounded: false, scale: 0.72 });
  const favicon = tileSvg({ rounded: true, scale: 0.8 });

  const outputs: [string, Buffer | string][] = [
    ["src/app/icon.svg", adaptive],
    ["public/cpboard-app-icon.svg", adaptive],
    ["src/app/apple-icon.png", await png(apple, 180)],
    ["public/icon-192x192.png", await png(regular, 192)],
    ["public/icon-512x512.png", await png(regular, 512)],
    ["public/icon-maskable-192x192.png", await png(maskable, 192)],
    ["public/icon-maskable-512x512.png", await png(maskable, 512)],
    [
      "src/app/favicon.ico",
      ico(
        await Promise.all(
          [16, 32, 48].map(async (size) => ({ size, data: await png(favicon, size) })),
        ),
      ),
    ],
  ];

  for (const [file, content] of outputs) {
    await writeFile(file, content);
    console.log(`wrote ${file}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
