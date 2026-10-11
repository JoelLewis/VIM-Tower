/**
 * Generate static/fonts/cp437.png from the public-domain font8x8 bitmaps.
 *
 * Output: 256x256 RGBA PNG, 16x16 grid of CP437 glyphs, each 16x16 px.
 * Each 8x8 source glyph is scaled 2x. Glyphs are white on a transparent
 * background so the renderer can tint them with 'source-in'.
 *
 * Usage: node scripts/generate-tileset.mjs
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fontDir = join(root, 'scripts', 'font8x8');
const outPath = join(root, 'static', 'fonts', 'cp437.png');

// CP437 code point → Unicode code point
// prettier-ignore
const CP437 = [
	0x0000, 0x263A, 0x263B, 0x2665, 0x2666, 0x2663, 0x2660, 0x2022, 0x25D8, 0x25CB, 0x25D9, 0x2642, 0x2640, 0x266A, 0x266B, 0x263C,
	0x25BA, 0x25C4, 0x2195, 0x203C, 0x00B6, 0x00A7, 0x25AC, 0x21A8, 0x2191, 0x2193, 0x2192, 0x2190, 0x221F, 0x2194, 0x25B2, 0x25BC,
	...Array.from({ length: 95 }, (_, i) => 0x20 + i), 0x2302,
	0x00C7, 0x00FC, 0x00E9, 0x00E2, 0x00E4, 0x00E0, 0x00E5, 0x00E7, 0x00EA, 0x00EB, 0x00E8, 0x00EF, 0x00EE, 0x00EC, 0x00C4, 0x00C5,
	0x00C9, 0x00E6, 0x00C6, 0x00F4, 0x00F6, 0x00F2, 0x00FB, 0x00F9, 0x00FF, 0x00D6, 0x00DC, 0x00A2, 0x00A3, 0x00A5, 0x20A7, 0x0192,
	0x00E1, 0x00ED, 0x00F3, 0x00FA, 0x00F1, 0x00D1, 0x00AA, 0x00BA, 0x00BF, 0x2310, 0x00AC, 0x00BD, 0x00BC, 0x00A1, 0x00AB, 0x00BB,
	0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0x2561, 0x2562, 0x2556, 0x2555, 0x2563, 0x2551, 0x2557, 0x255D, 0x255C, 0x255B, 0x2510,
	0x2514, 0x2534, 0x252C, 0x251C, 0x2500, 0x253C, 0x255E, 0x255F, 0x255A, 0x2554, 0x2569, 0x2566, 0x2560, 0x2550, 0x256C, 0x2567,
	0x2568, 0x2564, 0x2565, 0x2559, 0x2558, 0x2552, 0x2553, 0x256B, 0x256A, 0x2518, 0x250C, 0x2588, 0x2584, 0x258C, 0x2590, 0x2580,
	0x03B1, 0x00DF, 0x0393, 0x03C0, 0x03A3, 0x03C3, 0x00B5, 0x03C4, 0x03A6, 0x0398, 0x03A9, 0x03B4, 0x221E, 0x03C6, 0x03B5, 0x2229,
	0x2261, 0x00B1, 0x2265, 0x2264, 0x2320, 0x2321, 0x00F7, 0x2248, 0x00B0, 0x2219, 0x00B7, 0x221A, 0x207F, 0x00B2, 0x25A0, 0x00A0
];

// Parse every "{ 0x.., ... }, // U+XXXX" line from the vendored headers
const glyphs = new Map();
for (const file of readdirSync(fontDir).filter((f) => f.endsWith('.h'))) {
	for (const line of readFileSync(join(fontDir, file), 'utf8').split('\n')) {
		const m = line.match(/\{([^}]*)\}.*U\+([0-9A-Fa-f]{4})/);
		if (!m) continue;
		const rows = m[1].split(',').map((s) => parseInt(s.trim(), 16));
		if (rows.length === 8) glyphs.set(parseInt(m[2], 16), rows);
	}
}

const SIZE = 256;
const pixels = Buffer.alloc(SIZE * SIZE * 4); // RGBA, all transparent
const missing = [];

for (let code = 1; code < 256; code++) {
	const rows = glyphs.get(CP437[code]);
	if (!rows) {
		missing.push(code);
		continue;
	}
	const ox = (code % 16) * 16;
	const oy = Math.floor(code / 16) * 16;
	for (let y = 0; y < 8; y++) {
		for (let x = 0; x < 8; x++) {
			if (!((rows[y] >> x) & 1)) continue;
			for (let dy = 0; dy < 2; dy++) {
				for (let dx = 0; dx < 2; dx++) {
					const i = ((oy + y * 2 + dy) * SIZE + ox + x * 2 + dx) * 4;
					pixels.fill(255, i, i + 4);
				}
			}
		}
	}
}

// ─── Minimal PNG encoder ─────────────────────────────────────────

const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

function crc32(buf) {
	let c = 0xffffffff;
	for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
	pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const png = Buffer.concat([
	Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
	chunk('IHDR', ihdr),
	chunk('IDAT', deflateSync(raw, { level: 9 })),
	chunk('IEND', Buffer.alloc(0))
]);

writeFileSync(outPath, png);
console.log(`Wrote ${outPath} (${png.length} bytes)`);
if (missing.length > 0) console.log(`No glyph for CP437 codes: ${missing.join(', ')}`);
