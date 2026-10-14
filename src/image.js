import { openSync, readSync, closeSync, statSync } from 'node:fs';
/** Read width/height/format from PNG, JPEG, GIF or WebP headers. Returns { format, width, height, bytes } or { format } when unknown. */
export function imageInfo(file) {
  const bytes = statSync(file).size; const buf = Buffer.alloc(Math.min(bytes, 256 * 1024));
  const fd = openSync(file, 'r'); try { readSync(fd, buf, 0, buf.length, 0); } finally { closeSync(fd); }
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) return { format: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bytes };
  if (buf.length >= 10 && buf.toString('ascii', 0, 3) === 'GIF') return { format: 'gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8), bytes };
  if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buf.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { format: 'webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3), bytes };
    if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return { format: 'webp', width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff), bytes }; }
    if (kind === 'VP8 ') return { format: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, bytes };
    return { format: 'webp', bytes };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) { o++; continue; }
      const marker = buf[o + 1]; if (marker === 0xff) { o++; continue; }
      const len = buf.readUInt16BE(o + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { format: 'jpeg', height: buf.readUInt16BE(o + 5), width: buf.readUInt16BE(o + 7), bytes };
      o += 2 + len;
    }
    return { format: 'jpeg', bytes };
  }
  const head = buf.toString('utf8', 0, Math.min(buf.length, 512));
  if (/<svg[\s>]/i.test(head)) return { format: 'svg', bytes };
  if (buf.length > 12 && buf.toString('ascii', 4, 12) === 'ftypavif') return { format: 'avif', bytes };
  return { format: 'unknown', bytes };
}
