/**
 * Extrae un matiz (0–360) representativo de una imagen para acentos de UI.
 * Combina: (1) media circular ponderada por croma, (2) color medio RGB si hace falta.
 */

const FALLBACK_HUE = 38;

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      default:
        h = ((rn - gn) / d + 4) / 6;
    }
  }

  return { h: h * 360, s, l };
}

/** Crominancia0–1 (independiente de HSL en tonos muy claros). */
function chroma01(r: number, g: number, b: number): number {
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

function hueFromAverageRgb(data: Uint8ClampedArray): number | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 12) continue;
    const R = data[i];
    const G = data[i + 1];
    const B = data[i + 2];
    if (R > 252 && G > 252 && B > 252) continue;
    if (R < 4 && G < 4 && B < 4) continue;
    r += R;
    g += G;
    b += B;
    n += 1;
  }

  if (n < 4) return null;

  r /= n;
  g /= n;
  b /= n;
  const { h, s } = rgbToHsl(r, g, b);
  if (s < 0.028) return null;
  return Math.round(h) % 360;
}

/**
 * Matiz por media circular: peso alto en píxeles con croma, sin descartar pasteles claros.
 */
function chromaWeightedHue(data: Uint8ClampedArray, width: number, height: number): number | null {
  let sumSin = 0;
  let sumCos = 0;
  let wSum = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 12) continue;

      const R = data[i];
      const G = data[i + 1];
      const B = data[i + 2];
      const c = chroma01(R, G, B);

      if (c < 0.012) continue;

      const { h, s, l } = rgbToHsl(R, G, B);

      if (l < 0.02 || l > 0.995) continue;

      const nearWhite = R > 248 && G > 248 && B > 248;
      const nearBlack = R < 6 && G < 6 && B < 6;
      if (nearBlack) continue;

      let w = c ** 1.25;
      w *= 0.2 + 0.8 * s;
      w *= 1 - Math.max(0, l - 0.88) * 4;
      if (nearWhite) w *= 0.35 + c * 3;

      if (w < 1e-6) continue;

      const rad = (h * Math.PI) / 180;
      sumCos += Math.cos(rad) * w;
      sumSin += Math.sin(rad) * w;
      wSum += w;
    }
  }

  if (wSum < 0.12) return null;

  const hue = (Math.atan2(sumSin, sumCos) * 180) / Math.PI;
  return ((hue % 360) + 360) % 360;
}

function dominantHueFromImageData(data: Uint8ClampedArray, width: number, height: number): number {
  const fromChroma = chromaWeightedHue(data, width, height);
  if (fromChroma != null) return Math.round(fromChroma) % 360;

  const fromAvg = hueFromAverageRgb(data);
  if (fromAvg != null) return fromAvg;

  return FALLBACK_HUE;
}

export function accentCssFromHue(hue: number): {
  accent: string;
  accentMid: string;
  accentSoft: string;
  accentFg: string;
} {
  const h = Number.isFinite(hue) ? Math.round(hue) % 360 : FALLBACK_HUE;
  return {
    accent: `hsl(${h}, 84%, 66%)`,
    accentMid: `hsl(${h}, 62%, 52%)`,
    accentSoft: `hsl(${h}, 48%, 42%)`,
    accentFg: `hsl(${h}, 35%, 88%)`,
  };
}

function shouldUseAnonymousCors(src: string): boolean {
  try {
    if (src.startsWith('/')) return false;
    const u = new URL(src, window.location.origin);
    return u.origin !== window.location.origin;
  } catch {
    return false;
  }
}

export async function extractProgramAccentHue(imageSrc: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    if (shouldUseAnonymousCors(imageSrc)) {
      img.crossOrigin = 'anonymous';
    }
    img.decoding = 'async';

    img.onload = () => {
      try {
        const maxSide = 120;
        const scale = Math.min(maxSide / img.naturalWidth, maxSide / img.naturalHeight, 1);
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(FALLBACK_HUE);
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        resolve(dominantHueFromImageData(data, w, h));
      } catch {
        resolve(FALLBACK_HUE);
      }
    };

    img.onerror = () => resolve(FALLBACK_HUE);
    img.src = imageSrc;
  });
}
