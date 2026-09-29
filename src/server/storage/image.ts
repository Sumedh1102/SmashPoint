/**
 * Identifies an uploaded image from its bytes (never the client's declared type) and reads
 * its pixel size from the header. Supports JPEG, PNG and WebP.
 */
export type SniffedImage = { contentType: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp"; width: number | null; height: number | null };

function pngSize(b: Uint8Array) {
  // IHDR is the first chunk: width/height are big-endian at bytes 16–23.
  if (b.length < 24) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

function jpegSize(b: Uint8Array) {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    // SOF0–SOF15 carry the frame size (excluding DHT/JPG/DAC markers).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: (b[i + 5]! << 8) | b[i + 6]!, width: (b[i + 7]! << 8) | b[i + 8]! };
    }
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

function webpSize(b: Uint8Array) {
  if (b.length < 30) return null;
  const chunk = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);
  if (chunk === "VP8X") return { width: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)), height: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)) };
  if (chunk === "VP8 ") return { width: (b[26]! | (b[27]! << 8)) & 0x3fff, height: (b[28]! | (b[29]! << 8)) & 0x3fff };
  if (chunk === "VP8L") {
    const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return null;
}

export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    const size = pngSize(b);
    return { contentType: "image/png", ext: "png", width: size?.width ?? null, height: size?.height ?? null };
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    const size = jpegSize(b);
    return { contentType: "image/jpeg", ext: "jpg", width: size?.width ?? null, height: size?.height ?? null };
  }
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") {
    const size = webpSize(b);
    return { contentType: "image/webp", ext: "webp", width: size?.width ?? null, height: size?.height ?? null };
  }
  return null;
}
