import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality, canEncodeVideo } from 'mediabunny';
import type { TextLayout } from '../thermal/layout';
import type { Settings } from '../thermal/settings';
import { buildSvg } from '../thermal/svg';
import { svgToImage } from './files';
import { frameScale, type Frame } from './frame';

interface ExportInput {
  layout: TextLayout;
  settings: Settings;
  frame: Frame;
  label: string;
}

// Gradients and blurs compress poorly: high quality avoids banding.
const VIDEO_QUALITY = new Quality('very-high');

const exportId = () => `thermal-${Math.random().toString(36).slice(2, 7)}`;

/** Self-contained SVG with the SMIL animation. */
export function exportSvg({ layout, settings, frame, label }: ExportInput, background: boolean): Blob {
  const svg = buildSvg({
    layout,
    settings,
    id: exportId(),
    viewBox: frame.viewBox,
    width: frame.width,
    height: frame.height,
    grainScale: frameScale(frame),
    animated: true,
    background,
    label,
  });
  return new Blob([svg], { type: 'image/svg+xml' });
}

async function renderFrame(ctx: CanvasRenderingContext2D, input: ExportInput, phase: number, background: boolean) {
  const { frame } = input;
  const img = await svgToImage(
    buildSvg({
      ...input,
      id: 'f',
      viewBox: frame.viewBox,
      width: frame.width,
      height: frame.height,
      grainScale: frameScale(frame),
      phase,
      background,
    }),
  );
  ctx.clearRect(0, 0, frame.width, frame.height);
  ctx.drawImage(img, 0, 0, frame.width, frame.height);
}

function createCanvas(frame: Frame) {
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Couldn’t create the canvas.');
  return { canvas, ctx };
}

/** A single PNG frame, at the preview's current phase. */
export async function exportPng(input: ExportInput, phase: number, background: boolean): Promise<Blob> {
  const { canvas, ctx } = createCanvas(input.frame);
  await renderFrame(ctx, input, phase, background);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Couldn’t generate the PNG.'))), 'image/png'),
  );
}

export interface Mp4Options {
  fps: number;
  cycles: number;
  onProgress?: (done: number) => void;
  signal?: AbortSignal;
}

/**
 * Renders every frame deterministically (no screen recording) and encodes it
 * to H.264 with WebCodecs. The duration is a whole number of cycles, so the
 * video loops seamlessly.
 */
export async function exportMp4(input: ExportInput, opts: Mp4Options): Promise<Blob> {
  const { frame, settings } = input;
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('This browser doesn’t support WebCodecs. Try an up-to-date Chrome, Edge or Safari.');
  }
  const encodable = await canEncodeVideo('avc', {
    width: frame.width,
    height: frame.height,
    quality: VIDEO_QUALITY,
    frameRate: opts.fps,
  });
  if (!encodable) {
    throw new Error(`This browser can’t encode H.264 at ${frame.width}×${frame.height}. Try a lower resolution.`);
  }

  const { canvas, ctx } = createCanvas(frame);
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec: 'avc', quality: VIDEO_QUALITY });
  output.addVideoTrack(source, { frameRate: opts.fps });
  await output.start();

  const total = Math.max(1, Math.round(settings.duration * opts.cycles * opts.fps));
  try {
    for (let i = 0; i < total; i++) {
      if (opts.signal?.aborted) throw new DOMException('Export canceled', 'AbortError');
      await renderFrame(ctx, input, (i / total) * opts.cycles, true);
      await source.add(i / opts.fps, 1 / opts.fps);
      opts.onProgress?.((i + 1) / total);
    }
    await output.finalize();
  } catch (err) {
    await output.cancel();
    throw err;
  }

  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new Error('Couldn’t generate the MP4.');
  return new Blob([buffer], { type: 'video/mp4' });
}
