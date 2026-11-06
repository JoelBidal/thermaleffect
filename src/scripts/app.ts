import 'vanilla-colorful/hex-color-picker.js';
import { fileName, saveBlob } from '../lib/export/files';
import { computeFrame, type Format, type Resolution } from '../lib/export/frame';
import { fromQuery, toQuery } from '../lib/state';
import { loadFont, registerUploadedFont } from '../lib/thermal/fontLoader';
import { layoutText, type TextLayout } from '../lib/thermal/layout';
import { PALETTES, isHex, normalizeHex } from '../lib/thermal/palettes';
import { ThermalPreview } from '../lib/thermal/preview';
import { DEFAULTS, MAX_LINES, PLACEHOLDER, displayText, type Settings } from '../lib/thermal/settings';

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;
const $$ = <T extends Element>(sel: string) => [...document.querySelectorAll<T>(sel)];

const stage = $<HTMLElement>('#stage');
const textarea = $<HTMLTextAreaElement>('#text');
const fontSelect = $<HTMLSelectElement>('select[data-key="fontId"]');
const status = $<HTMLElement>('#status');
const preview = new ThermalPreview($<HTMLElement>('#preview'));

let settings: Settings = fromQuery(location.search);
if (!location.search && matchMedia('(prefers-reduced-motion: reduce)').matches) settings.duration = 12;

const exportOptions = {
  format: 'auto' as Format,
  resolution: 1080 as Resolution,
  fps: 30,
  cycles: 1,
  background: true,
};

let layout: TextLayout | null = null;
let renderId = 0;

async function render() {
  const id = ++renderId;
  let font;
  try {
    font = await loadFont(settings.fontId);
  } catch (err) {
    showStatus((err as Error).message, true);
    return;
  }
  if (id !== renderId) return;

  const text = displayText(settings);
  layout = layoutText(font, text, settings) ?? layoutText(font, PLACEHOLDER, settings);
  if (!layout) return;

  preview.update(layout, settings, text);
  stage.style.setProperty('--paper', settings.palette[6]);
  scheduleUrlSync();
}

/** Coalesces bursts of input (sliders, color dragging) into one render per frame. */
let renderQueued = false;
function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

// ——— Controls ↔ settings ———

function format(value: number, el: HTMLOutputElement) {
  const decimals = Number(el.dataset.decimals ?? 1);
  return `${value.toFixed(decimals)}${el.dataset.unit ?? ''}`;
}

function syncControls() {
  for (const el of $$<HTMLInputElement | HTMLSelectElement>('[data-key]')) {
    const key = el.dataset.key as keyof Settings;
    const value = settings[key];
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = Boolean(value);
    else if (el instanceof HTMLInputElement && el.type === 'radio') el.checked = el.value === String(value);
    else el.value = String(value);
  }
  for (const out of $$<HTMLOutputElement>('[data-output]')) {
    out.value = format(settings[out.dataset.output as keyof Settings] as number, out);
  }
  syncPalette();
  textarea.value = settings.text;
  autosize();
}

for (const el of $$<HTMLInputElement | HTMLSelectElement>('[data-key]')) {
  el.addEventListener('input', () => {
    const key = el.dataset.key as keyof Settings;
    const target = settings as unknown as Record<string, unknown>;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') target[key] = el.checked;
    else if (typeof DEFAULTS[key] === 'number') target[key] = parseFloat(el.value);
    else target[key] = el.value;

    const out = document.querySelector<HTMLOutputElement>(`[data-output="${key}"]`);
    if (out) out.value = format(settings[key] as number, out);
    requestRender();
  });
}

// ——— Text ———

function autosize() {
  textarea.rows = Math.min(MAX_LINES, Math.max(1, textarea.value.split('\n').length));
}

textarea.addEventListener('input', () => {
  const lines = textarea.value.split('\n');
  if (lines.length > MAX_LINES) {
    const pos = textarea.selectionStart;
    textarea.value = lines.slice(0, MAX_LINES).join('\n');
    textarea.setSelectionRange(pos, pos);
  }
  settings.text = textarea.value;
  autosize();
  render();
});

// ——— Uploaded font ———

const fontUpload = $<HTMLInputElement>('#font-upload');
$('#font-upload-btn').addEventListener('click', () => fontUpload.click());
fontUpload.addEventListener('change', async () => {
  const file = fontUpload.files?.[0];
  fontUpload.value = '';
  if (!file) return;
  try {
    const entry = await registerUploadedFont(file);
    fontSelect.append(new Option(entry.name, entry.id));
    settings.fontId = entry.id;
    fontSelect.value = entry.id;
    showStatus(`Font loaded: ${entry.name}`);
    render();
  } catch (err) {
    showStatus((err as Error).message || 'Couldn’t read the font.', true);
  }
});

// ——— Palette ———

const presetButtons = $$<HTMLButtonElement>('[data-palette]');
const rampStops = $$<HTMLButtonElement>('[data-stop]');

function syncPalette() {
  for (const btn of presetButtons) {
    btn.setAttribute('aria-checked', String(btn.dataset.palette === settings.paletteId));
  }
  $('#palette-name').textContent = PALETTES.find((p) => p.id === settings.paletteId)?.name ?? 'Custom';
  rampStops.forEach((stop, i) => (stop.style.background = settings.palette[i]));
}

for (const btn of presetButtons) {
  btn.addEventListener('click', () => {
    const palette = PALETTES.find((p) => p.id === btn.dataset.palette)!;
    settings.paletteId = palette.id;
    settings.palette = [...palette.stops];
    closePicker();
    syncPalette();
    render();
  });
}

// ——— Color picker ———

const picker = $<HTMLElement>('#picker');
const colorPicker = picker.querySelector('hex-color-picker') as HTMLElement & { color: string };
const hexInput = $<HTMLInputElement>('#picker-hex');
let activeStop = -1;

function setStop(i: number, hex: string) {
  settings.palette = settings.palette.map((c, j) => (j === i ? hex : c));
  settings.paletteId = 'custom';
  syncPalette();
  requestRender();
}

function positionPicker(anchor: HTMLElement) {
  const r = anchor.getBoundingClientRect();
  const { offsetWidth: w, offsetHeight: h } = picker;
  const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
  const below = r.bottom + 8;
  const top = below + h > innerHeight - 8 ? Math.max(8, r.top - h - 8) : below;
  picker.style.left = `${left}px`;
  picker.style.top = `${top}px`;
}

function openPicker(i: number) {
  activeStop = i;
  colorPicker.color = settings.palette[i];
  hexInput.value = settings.palette[i].slice(1);
  picker.hidden = false;
  positionPicker(rampStops[i]);
  rampStops.forEach((s, j) => s.classList.toggle('is-active', j === i));
}

function closePicker() {
  if (picker.hidden) return;
  picker.hidden = true;
  rampStops.forEach((s) => s.classList.remove('is-active'));
  activeStop = -1;
}

rampStops.forEach((stop, i) =>
  stop.addEventListener('click', () => (activeStop === i ? closePicker() : openPicker(i))),
);

colorPicker.addEventListener('color-changed', (e) => {
  const hex = normalizeHex((e as CustomEvent<{ value: string }>).detail.value);
  if (activeStop < 0 || hex === settings.palette[activeStop]) return;
  if (document.activeElement !== hexInput) hexInput.value = hex.slice(1);
  setStop(activeStop, hex);
});

hexInput.addEventListener('input', () => {
  if (activeStop < 0 || !isHex(hexInput.value)) return;
  const hex = normalizeHex(hexInput.value);
  colorPicker.color = hex;
  setStop(activeStop, hex);
});

document.addEventListener('pointerdown', (e) => {
  const target = e.target as Element;
  if (!picker.contains(target) && !target.closest('[data-stop]')) closePicker();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !picker.hidden) {
    const anchor = rampStops[activeStop];
    closePicker();
    anchor?.focus();
  }
});

addEventListener('resize', closePicker);
$('.panel-scroll').addEventListener('scroll', closePicker, { passive: true });

// ——— URL, copy link and reset ———

let urlTimer = 0;
function scheduleUrlSync() {
  clearTimeout(urlTimer);
  urlTimer = window.setTimeout(() => history.replaceState(null, '', location.pathname + toQuery(settings)), 300);
}

$('#copy-link').addEventListener('click', async () => {
  const url = location.origin + location.pathname + toQuery(settings);
  try {
    await navigator.clipboard.writeText(url);
    showStatus(settings.fontId.startsWith('custom-') ? 'Link copied (without the uploaded font).' : 'Link copied.');
  } catch {
    showStatus('Couldn’t copy the link.', true);
  }
});

$('#reset').addEventListener('click', () => {
  settings = { ...DEFAULTS, palette: [...DEFAULTS.palette], text: settings.text };
  closePicker();
  syncControls();
  render();
});

// ——— Export ———

for (const el of $$<HTMLInputElement | HTMLSelectElement>('[data-export]')) {
  const key = el.dataset.export as keyof typeof exportOptions;
  const value = exportOptions[key];
  if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = Boolean(value);
  else if (el instanceof HTMLInputElement && el.type === 'radio') el.checked = el.value === String(value);
  else el.value = String(value);

  el.addEventListener('input', () => {
    const target = exportOptions as Record<string, unknown>;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') target[key] = el.checked;
    else if (typeof value === 'number') target[key] = Number(el.value);
    else target[key] = el.value;
  });
}

const exportButtons = $$<HTMLButtonElement>('[data-download]');
const progress = $<HTMLElement>('#progress');
const progressFill = $<HTMLElement>('#progress-fill');
const progressLabel = $<HTMLElement>('#progress-label');
let abort: AbortController | null = null;

function setBusy(busy: boolean) {
  exportButtons.forEach((b) => (b.disabled = busy));
  progress.hidden = !busy;
  $('#download').toggleAttribute('hidden', busy);
}

// Download menu
const downloadBtn = $<HTMLButtonElement>('#download-btn');
const downloadMenu = $<HTMLElement>('#download-menu');

function toggleMenu(open: boolean) {
  downloadMenu.hidden = !open;
  downloadBtn.setAttribute('aria-expanded', String(open));
  if (open) exportButtons[0].focus();
}

downloadBtn.addEventListener('click', () => toggleMenu(downloadMenu.hasAttribute('hidden')));

downloadMenu.addEventListener('keydown', (e) => {
  const i = exportButtons.indexOf(document.activeElement as HTMLButtonElement);
  const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
  if (!step) return;
  e.preventDefault();
  exportButtons[(i + step + exportButtons.length) % exportButtons.length].focus();
});

document.addEventListener('pointerdown', (e) => {
  if (!downloadMenu.hidden && !(e.target as Element).closest('#download')) toggleMenu(false);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !downloadMenu.hidden) {
    toggleMenu(false);
    downloadBtn.focus();
  }
});

function setProgress(p: number) {
  progressFill.style.transform = `scaleX(${p})`;
  progressLabel.textContent = `${Math.round(p * 100)}%`;
}

let statusTimer = 0;
function showStatus(message: string, isError = false) {
  status.textContent = message;
  status.classList.toggle('is-error', isError);
  clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => (status.textContent = ''), isError ? 8000 : 3000);
}

$('#cancel').addEventListener('click', () => abort?.abort());

for (const btn of exportButtons) {
  btn.addEventListener('click', async () => {
    toggleMenu(false);
    if (!layout) return;
    const kind = btn.dataset.download as 'svg' | 'png' | 'mp4';
    const text = displayText(settings);
    const input = {
      layout,
      settings: { ...settings, palette: [...settings.palette] },
      frame: computeFrame(layout, settings, exportOptions.format, exportOptions.resolution),
      label: text,
    };

    try {
      // Mediabunny is only needed for exporting, so it's loaded on demand.
      const { exportMp4, exportPng, exportSvg } = await import('../lib/export/exporters');
      if (kind === 'svg') {
        saveBlob(exportSvg(input, exportOptions.background), fileName(text, 'svg'));
        return;
      }
      setBusy(true);
      setProgress(0);
      if (kind === 'png') {
        saveBlob(await exportPng(input, preview.phase, exportOptions.background), fileName(text, 'png'));
      } else {
        abort = new AbortController();
        const blob = await exportMp4(input, {
          fps: exportOptions.fps,
          cycles: exportOptions.cycles,
          signal: abort.signal,
          onProgress: setProgress,
        });
        saveBlob(blob, fileName(text, 'mp4'));
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') showStatus('Export canceled.');
      else {
        console.error(err);
        showStatus((err as Error).message || 'Couldn’t export.', true);
      }
    } finally {
      abort = null;
      setBusy(false);
    }
  });
}

syncControls();
render();
