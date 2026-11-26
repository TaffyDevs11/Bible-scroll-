// Share a verse as a 1080×1350 image. Three styles; Web Share API with download fallback.
import { R } from './bible.js';
import { h, sheet, toast } from './ui.js';

const W = 1080, H = 1350;
export const STYLES = {
  parchment: { label: 'Parchment', bg: '#F5EFE3', bg2: '#EADFC8', ink: '#2B2622', jesus: '#8C2F39', ref: '#7A5C17', mark: '#C9A44C', brand: '#6B645B' },
  navy: { label: 'Navy', bg: '#1B2A3A', bg2: '#22344A', ink: '#F5EFE3', jesus: '#F5EFE3', ref: '#C9A44C', mark: '#C9A44C', brand: '#B7AFA3' },
  olive: { label: 'Olive', bg: '#5F6D42', bg2: '#6B7A4B', ink: '#F7F2E6', jesus: '#F7F2E6', ref: '#EAD9A6', mark: '#EAD9A6', brand: '#E4DDCB' },
};

function tokens(text) {
  // -> [{w, red}] keeping words of Jesus (‹ ›) marked
  const out = [];
  let red = false;
  for (const part of text.split(/([‹›])/)) {
    if (part === '‹') { red = true; continue; }
    if (part === '›') { red = false; continue; }
    for (const w of part.split(/\s+/)) if (w) out.push({ w, red });
  }
  return out;
}

function layout(ctx, toks, size, maxW) {
  ctx.font = `400 ${size}px "EB Garamond", Georgia, serif`;
  const space = ctx.measureText(' ').width;
  const lines = [[]];
  let x = 0;
  for (const t of toks) {
    const w = ctx.measureText(t.w).width;
    if (x + w > maxW && lines.at(-1).length) { lines.push([]); x = 0; }
    lines.at(-1).push({ ...t, width: w });
    x += w + space;
  }
  return { lines, space };
}

export async function drawVerse(canvas, text, r, tr, styleId = 'parchment') {
  const s = STYLES[styleId];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  try {
    await Promise.all([document.fonts.load('400 60px "EB Garamond"'), document.fonts.load('600 32px Inter'), document.fonts.load('500 28px Inter')]);
  } catch { /* fall back to system fonts */ }

  // background: flat colour with a very soft vignette
  ctx.fillStyle = s.bg; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.45, 200, W / 2, H / 2, 900);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, styleId === 'parchment' ? 'rgba(120,96,60,0.10)' : 'rgba(0,0,0,0.18)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // paper grain on parchment
  if (styleId === 'parchment') {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    ctx.fillStyle = 'rgba(110,90,60,0.035)';
    for (let i = 0; i < 9000; i++) ctx.fillRect(rnd() * W, rnd() * H, 1.6, 1.6);
  }
  // thin inner frame
  ctx.strokeStyle = s.mark; ctx.globalAlpha = 0.35; ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, W - 96, H - 96); ctx.globalAlpha = 1;

  // subtle cross mark
  ctx.fillStyle = s.mark; ctx.globalAlpha = 0.9;
  ctx.fillRect(W / 2 - 4, 150, 8, 70); ctx.fillRect(W / 2 - 24, 168, 48, 8);
  ctx.globalAlpha = 1;

  // verse text, auto-fitted
  const toks = tokens(text);
  const maxW = W - 220, top = 280, bottom = H - 300;
  let size = 78, L;
  for (; size >= 30; size -= 2) {
    L = layout(ctx, toks, size, maxW);
    if (L.lines.length * size * 1.42 <= bottom - top) break;
  }
  const lh = size * 1.42;
  const blockH = L.lines.length * lh;
  let y = top + (bottom - top - blockH) / 2 + size;
  ctx.textBaseline = 'alphabetic';
  for (const line of L.lines) {
    const lw = line.reduce((n, t) => n + t.width, 0) + L.space * (line.length - 1);
    let x = (W - lw) / 2;
    for (const t of line) {
      ctx.fillStyle = t.red ? s.jesus : s.ink;
      ctx.fillText(t.w, x, y);
      x += t.width + L.space;
    }
    y += lh;
  }

  // reference
  const refText = `${R().format(r)} · ${tr === 'web' ? 'WEB' : 'KJV'}`.toUpperCase();
  ctx.font = '600 32px Inter, system-ui, sans-serif';
  ctx.fillStyle = s.ref;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
  ctx.textAlign = 'center';
  ctx.fillText(refText, W / 2, H - 210);
  // brand
  ctx.font = '500 26px Inter, system-ui, sans-serif';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
  ctx.fillStyle = s.brand;
  ctx.fillText('BIBLE ADVISOR', W / 2, H - 110);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.textAlign = 'start';
}

const toBlob = (canvas) => new Promise((res) => canvas.toBlob(res, 'image/png'));

export function openShareSheet(text, r, tr) {
  let style = 'parchment';
  const canvas = h('canvas', { class: 'share-preview', role: 'img', 'aria-label': `Image of ${R().format(r)}` });
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Image style' });
  const redraw = () => drawVerse(canvas, text, r, tr, style);
  for (const [id, st] of Object.entries(STYLES)) {
    seg.append(h('button', { type: 'button', 'aria-pressed': String(id === style), onclick: () => {
      style = id; seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.s === id))); redraw();
    }, 'data-s': id }, st.label));
  }
  const fileName = `${R().key(r)}-${style}.png`.replace(/[^\w.-]/g, '_');
  const share = async () => {
    const blob = await toBlob(canvas);
    const file = new File([blob], fileName, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: R().format(r), text: `${R().format(r)} — shared from Bible Advisor` });
        return;
      }
    } catch (e) { if (e.name === 'AbortError') return; }
    download(blob);
  };
  const download = async (blob) => {
    blob ??= await toBlob(canvas);
    const a = h('a', { href: URL.createObjectURL(blob), download: fileName });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Image saved');
  };
  sheet('Share as image', h('div', { class: 'stack' },
    canvas,
    seg,
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary', type: 'button', onclick: share }, 'Share'),
      h('button', { class: 'btn', type: 'button', onclick: () => download() }, 'Download'))));
  redraw();
}
