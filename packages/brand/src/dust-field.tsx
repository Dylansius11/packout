import { useEffect, useRef } from 'react';
import { FACE_BITS, FACE_COLUMNS, FACE_ROWS } from './face-field.ts';

export interface DustFieldProps {
  className?: string;
  /** Where the portrait sits when the canvas is wider than the artwork's ratio. */
  anchor?: 'start' | 'center' | 'end';
  /** Face brightness at rest, 0 to 1. The logo's own field sits around 0.25. */
  intensity?: number;
  /** Let the pointer push the dust and light it up. */
  interactive?: boolean;
  /** Face the portrait the other way, so copy can sit in the open side of the frame. */
  mirror?: boolean;
}

interface Layer {
  cells: Float32Array; // x, y pairs in field units (0..1)
  size: number; // relative to one face cell
  speed: number; // field widths per second
  shade: number; // 0..255
}

let faceCells: Uint16Array | undefined;

/** Set bits of the portrait as (column, row) pairs, decoded once per page. */
function decodeFace(): Uint16Array {
  if (faceCells) return faceCells;
  const bytes = Uint8Array.from(atob(FACE_BITS), (char) => char.charCodeAt(0));
  const out: number[] = [];
  for (let bit = 0; bit < FACE_COLUMNS * FACE_ROWS; bit += 1) {
    if (bytes[bit >> 3] & (0x80 >> (bit & 7)))
      out.push(bit % FACE_COLUMNS, Math.floor(bit / FACE_COLUMNS));
  }
  faceCells = Uint16Array.from(out);
  return faceCells;
}

/** Deterministic dust so every visit shows the same sky. */
function dustLayer(seed: number, count: number, size: number, speed: number, shade: number): Layer {
  let state = seed;
  const cells = new Float32Array(count * 2);
  for (let index = 0; index < cells.length; index += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    cells[index] = state / 0x100000000;
  }
  return { cells, size, speed, shade };
}

const LAYERS: Layer[] = [dustLayer(7, 90, 0.5, 0.0035, 30), dustLayer(19, 46, 0.75, 0.0017, 44)];

/**
 * The dithered portrait from the founder's artwork, rendered cell by cell on a canvas.
 * Rear dust drifts on one shared clock; the portrait holds still, flickers like a CRT
 * and parts around the pointer. Under reduced motion it renders once and stays put.
 */
export function DustField({
  className,
  anchor = 'start',
  intensity = 0.25,
  interactive = true,
  mirror = false,
}: DustFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !context) return;
    const source = decodeFace();
    const face = mirror
      ? source.map((value, index) => (index % 2 === 0 ? FACE_COLUMNS - 1 - value : value))
      : source;
    const count = face.length / 2;
    const offset = new Float32Array(count * 2);
    const velocity = new Float32Array(count * 2);
    const glow = new Float32Array(count);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0;
    let height = 0;
    let cell = 0;
    let originX = 0;
    let originY = 0;
    let pointerX = Number.NaN;
    let pointerY = Number.NaN;
    let frame = 0;
    let visible = true;
    let lastTime = 0;
    let clock = 0;

    const layout = () => {
      const box = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = box.width;
      height = box.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      cell = Math.max(width / FACE_COLUMNS, height / FACE_ROWS);
      const spare = width - cell * FACE_COLUMNS;
      originX = anchor === 'start' ? 0 : anchor === 'end' ? spare : spare / 2;
      originY = (height - cell * FACE_ROWS) / 2;
    };

    const draw = (moving: boolean) => {
      context.clearRect(0, 0, width, height);
      for (const layer of LAYERS) {
        const size = Math.max(1, Math.round(cell * layer.size));
        context.fillStyle = `rgb(${layer.shade},${layer.shade},${layer.shade})`;
        for (let index = 0; index < layer.cells.length; index += 2) {
          const x = (((layer.cells[index] + clock * layer.speed) % 1) + 1) % 1;
          // Snap to the face grid so drifting dust never blurs between pixels.
          const px = Math.round((x * width) / size) * size;
          const py = Math.round((layer.cells[index + 1] * height) / size) * size;
          context.fillRect(px, py, size - 1, size - 1);
        }
      }
      const ink = Math.max(1, cell * 0.84);
      const flickerBucket = Math.floor(clock * 6);
      for (let index = 0; index < count; index += 1) {
        // A one-percent CRT flicker: cells drop out for a sixth of a second, then return.
        if (moving && ((index * 2654435761 + flickerBucket * 40503) >>> 0) % 113 === 0) continue;
        const level = Math.min(1, intensity + glow[index] * 0.62);
        const shade = Math.round(level * 255);
        context.fillStyle = `rgb(${shade},${shade},${Math.max(0, shade - 4)})`;
        context.fillRect(
          Math.round(originX + face[index * 2] * cell + offset[index * 2]),
          Math.round(originY + face[index * 2 + 1] * cell + offset[index * 2 + 1]),
          ink,
          ink,
        );
      }
    };

    const step = (time: number) => {
      const delta = lastTime ? Math.min(0.05, (time - lastTime) / 1000) : 0;
      lastTime = time;
      clock += delta;
      const reach = cell * 9;
      for (let index = 0; index < count; index += 1) {
        const restX = originX + face[index * 2] * cell;
        const restY = originY + face[index * 2 + 1] * cell;
        let targetX = 0;
        let targetY = 0;
        let lit = 0;
        if (!Number.isNaN(pointerX)) {
          const dx = restX - pointerX;
          const dy = restY - pointerY;
          const distance = Math.hypot(dx, dy);
          if (distance < reach && distance > 0) {
            const force = (1 - distance / reach) ** 2;
            targetX = (dx / distance) * force * cell * 2.6;
            targetY = (dy / distance) * force * cell * 2.6;
            lit = force;
          }
        }
        const x = index * 2;
        velocity[x] = (velocity[x] + (targetX - offset[x]) * 0.16) * 0.74;
        velocity[x + 1] = (velocity[x + 1] + (targetY - offset[x + 1]) * 0.16) * 0.74;
        offset[x] += velocity[x];
        offset[x + 1] += velocity[x + 1];
        glow[index] = Math.max(lit, glow[index] * 0.93);
      }
      draw(true);
      if (visible) frame = requestAnimationFrame(step);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      lastTime = 0;
      if (still.matches) {
        draw(false);
        return;
      }
      if (visible) frame = requestAnimationFrame(step);
    };

    const onPointer = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      pointerX = event.clientX - box.left;
      pointerY = event.clientY - box.top;
    };
    const onLeave = () => {
      pointerX = Number.NaN;
      pointerY = Number.NaN;
    };
    const onVisibility = () => {
      visible = document.visibilityState === 'visible' && onScreen;
      start();
    };

    let onScreen = true;
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      onVisibility();
    });
    const resize = new ResizeObserver(() => {
      layout();
      start();
    });
    layout();
    start();
    resize.observe(canvas);
    intersection.observe(canvas);
    still.addEventListener('change', start);
    document.addEventListener('visibilitychange', onVisibility);
    if (interactive) {
      window.addEventListener('pointermove', onPointer, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
    }
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      still.removeEventListener('change', start);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [anchor, intensity, interactive, mirror]);

  return <canvas ref={canvasRef} className={className} />;
}
