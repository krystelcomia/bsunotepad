import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Circle,
  Download,
  Eraser,
  Feather,
  FilePlus2,
  Grid,
  Highlighter,
  Image as ImageIcon,
  Minus,
  MousePointer2,
  Pencil,
  PenTool,
  Redo2,
  Square,
  Trash2,
  Triangle,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { DrawingData, DrawingImage, DrawingShape, DrawingStroke, DrawingText, StrokePoint } from '../../types';

export type CanvasTool =
  | 'select'
  | 'pen'
  | 'calligraphy'
  | 'pencil'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'text';

const PALETTE = [
  '#0F172A',
  '#4F46E5',
  '#0284C7',
  '#059669',
  '#D97706',
  '#E11D48',
  '#7C3AED',
  '#FDE047',
  '#FFFFFF',
];

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function drawSmoothStroke(ctx: CanvasRenderingContext2D, stroke: DrawingStroke) {
  const pts = stroke.points;
  if (pts.length === 0) return;

  ctx.save();
  ctx.lineCap = stroke.tool === 'calligraphy' ? 'square' : 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;

  if (stroke.tool === 'highlighter') {
    ctx.globalAlpha = Math.min(0.45, stroke.opacity);
  } else if (stroke.tool === 'pencil') {
    ctx.globalAlpha = stroke.opacity * 0.72;
  } else {
    ctx.globalAlpha = stroke.opacity;
  }

  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, Math.max(1, stroke.width / 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (stroke.tool === 'pen' || stroke.tool === 'calligraphy') {
    // Segment-by-segment variable pressure width
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const pressure = Math.max(0.35, Math.min(1.4, (p0.p + p1.p) * 0.5 + 0.35));
      let segWidth = stroke.width * pressure;
      if (stroke.tool === 'calligraphy') {
        const dx = Math.abs(p1.x - p0.x);
        const dy = Math.abs(p1.y - p0.y);
        const angleFactor = dx + dy > 0 ? 0.55 + 0.7 * (dy / (dx + dy)) : 1;
        segWidth *= angleFactor;
      }
      ctx.beginPath();
      ctx.lineWidth = Math.max(0.8, segWidth);
      ctx.moveTo(p0.x, p0.y);
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.lineWidth = stroke.width;
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawShape(ctx: CanvasRenderingContext2D, shape: DrawingShape, selected = false) {
  ctx.save();
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = shape.width;
  ctx.globalAlpha = shape.opacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const { x1, y1, x2, y2, kind } = shape;
  ctx.beginPath();

  if (kind === 'line' || kind === 'arrow') {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    if (kind === 'arrow') {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLen = Math.max(10, shape.width * 3.8);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
  } else if (kind === 'rect') {
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  } else if (kind === 'circle') {
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === 'triangle') {
    const topX = (x1 + x2) / 2;
    const topY = Math.min(y1, y2);
    const botY = Math.max(y1, y2);
    ctx.moveTo(topX, topY);
    ctx.lineTo(Math.max(x1, x2), botY);
    ctx.lineTo(Math.min(x1, x2), botY);
    ctx.closePath();
    ctx.stroke();
  }

  if (selected) {
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#4F46E5';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      Math.min(x1, x2) - 6,
      Math.min(y1, y2) - 6,
      Math.abs(x2 - x1) + 12,
      Math.abs(y2 - y1) + 12
    );
  }
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, bg: string, w: number, h: number) {
  if (bg === 'transparent') return;

  ctx.save();
  if (bg === 'dark_board') {
    ctx.fillStyle = '#16202A';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  ctx.fillStyle = bg === 'plain' ? '#FFFFFF' : '#FFFEF9';
  ctx.fillRect(0, 0, w, h);

  if (bg === 'grid') {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  } else if (bg === 'dot') {
    ctx.fillStyle = 'rgba(100, 116, 139, 0.38)';
    for (let x = 20; x < w; x += 20) {
      for (let y = 20; y < h; y += 20) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (bg === 'lined') {
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.18)';
    ctx.lineWidth = 1;
    for (let y = 40; y < h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.32)';
    ctx.beginPath();
    ctx.moveTo(64, 0);
    ctx.lineTo(64, h);
    ctx.stroke();
  }
  ctx.restore();
}

export function renderDrawingToCanvas(
  canvas: HTMLCanvasElement,
  data: DrawingData,
  opts?: { width?: number; height?: number; forceWhiteBg?: boolean; selectedShapeId?: string | null }
) {
  const width = opts?.width || 1100;
  const height = opts?.height || 760;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (opts?.forceWhiteBg && data.background === 'transparent') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  } else {
    drawBackground(ctx, data.background || 'plain', width, height);
  }

  // Draw inserted images if loaded
  if (data.images) {
    for (const imgItem of data.images) {
      const cached = imageCache.get(imgItem.src);
      if (cached && cached.complete) {
        ctx.drawImage(cached, imgItem.x, imgItem.y, imgItem.width, imgItem.height);
      }
    }
  }

  for (const stroke of data.strokes) {
    drawSmoothStroke(ctx, stroke);
  }

  for (const shape of data.shapes) {
    drawShape(ctx, shape, shape.id === opts?.selectedShapeId);
  }

  for (const item of data.texts) {
    ctx.save();
    ctx.fillStyle = item.color;
    ctx.font = `600 ${item.fontSize}px 'Plus Jakarta Sans', 'Inter', sans-serif`;
    ctx.textBaseline = 'alphabetic';
    const lines = item.text.split('\n');
    lines.forEach((line, idx) => {
      ctx.fillText(line, item.x, item.y + idx * (item.fontSize * 1.25));
    });
    ctx.restore();
  }
}

const imageCache = new Map<string, HTMLImageElement>();

function hitTestPointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

interface DrawingCanvasProps {
  value: DrawingData;
  onChange: (next: DrawingData, previewDataUrl?: string) => void;
  overlayMode?: boolean;
  readOnly?: boolean;
  compactToolbar?: boolean;
  onInsertIntoDocument?: (dataUrl: string) => void;
  canvasWidth?: number;
  canvasHeight?: number;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  value,
  onChange,
  overlayMode = false,
  readOnly = false,
  compactToolbar = false,
  onInsertIntoDocument,
  canvasWidth = 1100,
  canvasHeight = 760,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [tool, setTool] = useState<CanvasTool>('pen');
  const [color, setColor] = useState<string>(value.background === 'dark_board' ? '#FFFFFF' : '#0F172A');
  const [strokeWidth, setStrokeWidth] = useState<number>(3.5);
  const [opacity, setOpacity] = useState<number>(1);
  const [snapGrid, setSnapGrid] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);

  const [history, setHistory] = useState<DrawingData[]>([]);
  const [redoStack, setRedoStack] = useState<DrawingData[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

  const [draftStroke, setDraftStroke] = useState<DrawingStroke | null>(null);
  const [draftShape, setDraftShape] = useState<DrawingShape | null>(null);
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number } | null>(null);
  const [textDraft, setTextDraft] = useState('');

  const dragRef = useRef<{
    active: boolean;
    mode: 'draw' | 'shape' | 'erase' | 'move';
    lastX: number;
    lastY: number;
    moveTarget?: { kind: 'shape' | 'text' | 'image'; id: string };
  }>({ active: false, mode: 'draw', lastX: 0, lastY: 0 });

  // Preload any canvas images
  useEffect(() => {
    if (!value.images?.length) return;
    value.images.forEach((im) => {
      if (!imageCache.has(im.src)) {
        const img = new Image();
        img.onload = () => {
          if (canvasRef.current) {
            renderDrawingToCanvas(canvasRef.current, value, {
              width: canvasWidth,
              height: canvasHeight,
              selectedShapeId,
            });
          }
        };
        img.src = im.src;
        imageCache.set(im.src, img);
      }
    });
  }, [value, canvasWidth, canvasHeight, selectedShapeId]);

  const previewData: DrawingData = useMemo(() => {
    return {
      ...value,
      strokes: draftStroke ? [...value.strokes, draftStroke] : value.strokes,
      shapes: draftShape ? [...value.shapes, draftShape] : value.shapes,
    };
  }, [value, draftStroke, draftShape]);

  useEffect(() => {
    if (!canvasRef.current) return;
    renderDrawingToCanvas(canvasRef.current, previewData, {
      width: canvasWidth,
      height: canvasHeight,
      selectedShapeId,
    });
  }, [previewData, canvasWidth, canvasHeight, selectedShapeId]);

  const generateThumbnail = useCallback((data: DrawingData): string => {
    const off = document.createElement('canvas');
    renderDrawingToCanvas(off, data, {
      width: canvasWidth,
      height: canvasHeight,
      forceWhiteBg: true,
    });
    const thumb = document.createElement('canvas');
    thumb.width = 320;
    thumb.height = Math.round((320 * canvasHeight) / canvasWidth);
    const tctx = thumb.getContext('2d');
    if (tctx) {
      tctx.drawImage(off, 0, 0, thumb.width, thumb.height);
      return thumb.toDataURL('image/png');
    }
    return '';
  }, [canvasWidth, canvasHeight]);

  const commitChange = useCallback(
    (next: DrawingData) => {
      setHistory((h) => [...h.slice(-39), value]);
      setRedoStack([]);
      const previewUrl = generateThumbnail(next);
      onChange(next, previewUrl);
    },
    [value, onChange, generateThumbnail]
  );

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRedoStack((r) => [...r, value]);
    onChange(prev, generateThumbnail(prev));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setHistory((h) => [...h, value]);
    onChange(next, generateThumbnail(next));
  };

  const toCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    let x = (e.clientX - rect.left) * scaleX;
    let y = (e.clientY - rect.top) * scaleY;
    if (snapGrid && ['line', 'arrow', 'rect', 'circle', 'triangle', 'select'].includes(tool)) {
      x = Math.round(x / 12) * 12;
      y = Math.round(y / 12) * 12;
    }
    const p = e.pressure > 0 ? e.pressure : 0.5;
    return { x, y, p };
  };

  const eraseAt = (x: number, y: number) => {
    const threshold = Math.max(14, strokeWidth * 2);
    const nextStrokes = value.strokes.filter(
      (s) => !s.points.some((pt) => Math.hypot(pt.x - x, pt.y - y) <= threshold)
    );
    const nextShapes = value.shapes.filter((sh) => {
      const dist = hitTestPointToSegment(x, y, sh.x1, sh.y1, sh.x2, sh.y2);
      const minX = Math.min(sh.x1, sh.x2) - threshold;
      const maxX = Math.max(sh.x1, sh.x2) + threshold;
      const minY = Math.min(sh.y1, sh.y2) - threshold;
      const maxY = Math.max(sh.y1, sh.y2) + threshold;
      if (sh.kind === 'line' || sh.kind === 'arrow') return dist > threshold;
      return !(x >= minX && x <= maxX && y >= minY && y <= maxY);
    });
    const nextTexts = value.texts.filter(
      (t) => !(x >= t.x - 10 && x <= t.x + t.text.length * t.fontSize * 0.65 && y >= t.y - t.fontSize && y <= t.y + 12)
    );
    if (
      nextStrokes.length !== value.strokes.length ||
      nextShapes.length !== value.shapes.length ||
      nextTexts.length !== value.texts.length
    ) {
      commitChange({
        ...value,
        strokes: nextStrokes,
        shapes: nextShapes,
        texts: nextTexts,
      });
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = toCanvasCoords(e);

    if (tool === 'text') {
      setTextInputPos({ x: pt.x, y: pt.y });
      setTextDraft('');
      return;
    }

    if (tool === 'select') {
      // Check shapes first
      const foundShape = [...value.shapes].reverse().find((sh) => {
        const minX = Math.min(sh.x1, sh.x2) - 10;
        const maxX = Math.max(sh.x1, sh.x2) + 10;
        const minY = Math.min(sh.y1, sh.y2) - 10;
        const maxY = Math.max(sh.y1, sh.y2) + 10;
        return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
      });
      if (foundShape) {
        setSelectedShapeId(foundShape.id);
        dragRef.current = {
          active: true,
          mode: 'move',
          lastX: pt.x,
          lastY: pt.y,
          moveTarget: { kind: 'shape', id: foundShape.id },
        };
        return;
      }
      const foundText = [...value.texts].reverse().find(
        (t) => pt.x >= t.x - 8 && pt.x <= t.x + Math.max(60, t.text.length * t.fontSize * 0.65) && pt.y >= t.y - t.fontSize && pt.y <= t.y + 12
      );
      if (foundText) {
        dragRef.current = {
          active: true,
          mode: 'move',
          lastX: pt.x,
          lastY: pt.y,
          moveTarget: { kind: 'text', id: foundText.id },
        };
        return;
      }
      const foundImg = [...(value.images || [])].reverse().find(
        (im) => pt.x >= im.x && pt.x <= im.x + im.width && pt.y >= im.y && pt.y <= im.y + im.height
      );
      if (foundImg) {
        dragRef.current = {
          active: true,
          mode: 'move',
          lastX: pt.x,
          lastY: pt.y,
          moveTarget: { kind: 'image', id: foundImg.id },
        };
        return;
      }
      setSelectedShapeId(null);
      return;
    }

    if (tool === 'eraser') {
      dragRef.current = { active: true, mode: 'erase', lastX: pt.x, lastY: pt.y };
      eraseAt(pt.x, pt.y);
      return;
    }

    if (['line', 'arrow', 'rect', 'circle', 'triangle'].includes(tool)) {
      dragRef.current = { active: true, mode: 'shape', lastX: pt.x, lastY: pt.y };
      setDraftShape({
        id: makeId('sh'),
        kind: tool as DrawingShape['kind'],
        x1: pt.x,
        y1: pt.y,
        x2: pt.x,
        y2: pt.y,
        color,
        width: strokeWidth,
        opacity,
      });
      return;
    }

    // Freehand stroke
    dragRef.current = { active: true, mode: 'draw', lastX: pt.x, lastY: pt.y };
    setDraftStroke({
      id: makeId('st'),
      tool: tool as DrawingStroke['tool'],
      color,
      width: tool === 'highlighter' ? Math.max(14, strokeWidth * 3) : strokeWidth,
      opacity,
      points: [pt],
    });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active || readOnly) return;
    const pt = toCanvasCoords(e);

    if (dragRef.current.mode === 'erase') {
      eraseAt(pt.x, pt.y);
      return;
    }

    if (dragRef.current.mode === 'move' && dragRef.current.moveTarget) {
      const dx = pt.x - dragRef.current.lastX;
      const dy = pt.y - dragRef.current.lastY;
      dragRef.current.lastX = pt.x;
      dragRef.current.lastY = pt.y;

      const target = dragRef.current.moveTarget;
      if (target.kind === 'shape') {
        onChange({
          ...value,
          shapes: value.shapes.map((sh) =>
            sh.id === target.id ? { ...sh, x1: sh.x1 + dx, y1: sh.y1 + dy, x2: sh.x2 + dx, y2: sh.y2 + dy } : sh
          ),
        });
      } else if (target.kind === 'text') {
        onChange({
          ...value,
          texts: value.texts.map((t) => (t.id === target.id ? { ...t, x: t.x + dx, y: t.y + dy } : t)),
        });
      } else if (target.kind === 'image') {
        onChange({
          ...value,
          images: (value.images || []).map((im) =>
            im.id === target.id ? { ...im, x: im.x + dx, y: im.y + dy } : im
          ),
        });
      }
      return;
    }

    if (dragRef.current.mode === 'shape' && draftShape) {
      setDraftShape({ ...draftShape, x2: pt.x, y2: pt.y });
      return;
    }

    if (dragRef.current.mode === 'draw' && draftStroke) {
      const coalesced = (e.nativeEvent as PointerEvent).getCoalescedEvents?.();
      const extraPoints: StrokePoint[] =
        coalesced && coalesced.length > 0
          ? coalesced.map((ce) => {
              const rect = canvasRef.current!.getBoundingClientRect();
              return {
                x: ((ce.clientX - rect.left) * canvasWidth) / rect.width,
                y: ((ce.clientY - rect.top) * canvasHeight) / rect.height,
                p: ce.pressure > 0 ? ce.pressure : 0.5,
              };
            })
          : [pt];

      setDraftStroke((prev) =>
        prev ? { ...prev, points: [...prev.points, ...extraPoints] } : null
      );
    }
  };

  const onPointerUp = () => {
    if (!dragRef.current.active) return;
    const mode = dragRef.current.mode;
    dragRef.current.active = false;

    if (mode === 'draw' && draftStroke) {
      commitChange({ ...value, strokes: [...value.strokes, draftStroke] });
      setDraftStroke(null);
    } else if (mode === 'shape' && draftShape) {
      if (Math.hypot(draftShape.x2 - draftShape.x1, draftShape.y2 - draftShape.y1) > 4) {
        commitChange({ ...value, shapes: [...value.shapes, draftShape] });
      }
      setDraftShape(null);
    }
  };

  const commitText = () => {
    if (!textInputPos || !textDraft.trim()) {
      setTextInputPos(null);
      return;
    }
    const item: DrawingText = {
      id: makeId('tx'),
      x: textInputPos.x,
      y: textInputPos.y,
      text: textDraft.trim(),
      color,
      fontSize: Math.max(14, Math.round(strokeWidth * 3.2)),
    };
    commitChange({ ...value, texts: [...value.texts, item] });
    setTextInputPos(null);
    setTextDraft('');
  };

  const handleInsertImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      if (!src) return;
      const img = new Image();
      img.onload = () => {
        const maxW = 360;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const item: DrawingImage = {
          id: makeId('img'),
          x: 80,
          y: 80,
          width: Math.round(img.width * scale),
          height: Math.round(img.height * scale),
          src,
        };
        imageCache.set(src, img);
        commitChange({ ...value, images: [...(value.images || []), item] });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const exportPng = () => {
    const off = document.createElement('canvas');
    renderDrawingToCanvas(off, value, {
      width: canvasWidth,
      height: canvasHeight,
      forceWhiteBg: overlayMode,
    });
    const url = off.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `inkora-sketch-${Date.now()}.png`;
    a.click();
  };

  const exportSvg = () => {
    const bgColor =
      value.background === 'dark_board'
        ? '#16202A'
        : value.background === 'plain'
          ? '#FFFFFF'
          : '#FFFEF9';
    const parts: string[] = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">`,
      `<rect width="100%" height="100%" fill="${bgColor}"/>`,
    ];

    for (const s of value.strokes) {
      if (s.points.length < 2) continue;
      const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      const op = s.tool === 'highlighter' ? Math.min(0.45, s.opacity) : s.opacity;
      parts.push(
        `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-opacity="${op}" stroke-linecap="round" stroke-linejoin="round"/>`
      );
    }

    for (const sh of value.shapes) {
      if (sh.kind === 'rect') {
        parts.push(
          `<rect x="${Math.min(sh.x1, sh.x2)}" y="${Math.min(sh.y1, sh.y2)}" width="${Math.abs(sh.x2 - sh.x1)}" height="${Math.abs(sh.y2 - sh.y1)}" fill="none" stroke="${sh.color}" stroke-width="${sh.width}"/>`
        );
      } else if (sh.kind === 'circle') {
        parts.push(
          `<ellipse cx="${(sh.x1 + sh.x2) / 2}" cy="${(sh.y1 + sh.y2) / 2}" rx="${Math.abs(sh.x2 - sh.x1) / 2}" ry="${Math.abs(sh.y2 - sh.y1) / 2}" fill="none" stroke="${sh.color}" stroke-width="${sh.width}"/>`
        );
      } else if (sh.kind === 'line' || sh.kind === 'arrow') {
        parts.push(
          `<line x1="${sh.x1}" y1="${sh.y1}" x2="${sh.x2}" y2="${sh.y2}" stroke="${sh.color}" stroke-width="${sh.width}" stroke-linecap="round"/>`
        );
      }
    }

    for (const t of value.texts) {
      const escaped = t.text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      parts.push(
        `<text x="${t.x}" y="${t.y}" fill="${t.color}" font-size="${t.fontSize}" font-family="sans-serif" font-weight="600">${escaped}</text>`
      );
    }

    parts.push('</svg>');
    const blob = new Blob([parts.join('\n')], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inkora-sketch-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEmbedIntoDoc = () => {
    if (!onInsertIntoDocument) return;
    const off = document.createElement('canvas');
    renderDrawingToCanvas(off, value, {
      width: canvasWidth,
      height: canvasHeight,
      forceWhiteBg: true,
    });
    onInsertIntoDocument(off.toDataURL('image/png'));
  };

  const toolButtons: Array<{ id: CanvasTool; label: string; icon: React.ReactNode }> = [
    { id: 'select', label: 'Select & Move', icon: <MousePointer2 className="w-4 h-4" /> },
    { id: 'pen', label: 'Ink Pen', icon: <PenTool className="w-4 h-4" /> },
    { id: 'calligraphy', label: 'Fountain Nib', icon: <Feather className="w-4 h-4" /> },
    { id: 'pencil', label: 'Pencil', icon: <Pencil className="w-4 h-4" /> },
    { id: 'highlighter', label: 'Highlighter', icon: <Highlighter className="w-4 h-4" /> },
    { id: 'eraser', label: 'Eraser', icon: <Eraser className="w-4 h-4" /> },
    { id: 'line', label: 'Line', icon: <Minus className="w-4 h-4" /> },
    { id: 'arrow', label: 'Arrow', icon: <ArrowUpRight className="w-4 h-4" /> },
    { id: 'rect', label: 'Rectangle', icon: <Square className="w-4 h-4" /> },
    { id: 'circle', label: 'Circle / Oval', icon: <Circle className="w-4 h-4" /> },
    { id: 'triangle', label: 'Triangle', icon: <Triangle className="w-4 h-4" /> },
    { id: 'text', label: 'Text Label', icon: <Type className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-full">
      {!readOnly && (
        <div
          className={`flex flex-wrap items-center gap-2 px-3 py-2 border-b border-stone-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs ${
            compactToolbar ? 'text-xs' : ''
          }`}
        >
          {/* Tools */}
          <div className="flex flex-wrap items-center gap-0.5 p-1 rounded-xl bg-stone-100 dark:bg-slate-800">
            {toolButtons.map((tb) => (
              <button
                key={tb.id}
                type="button"
                onClick={() => setTool(tb.id)}
                title={tb.label}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  tool === tb.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                }`}
              >
                {tb.icon}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-stone-200 dark:bg-slate-700 hidden sm:block" />

          {/* Colors */}
          <div className="flex items-center gap-1">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-5 h-5 rounded-full border transition cursor-pointer ${
                  color.toLowerCase() === c.toLowerCase()
                    ? 'ring-2 ring-indigo-500 ring-offset-1 scale-110'
                    : 'border-stone-300 dark:border-slate-600'
                }`}
                style={{ backgroundColor: c }}
                title={`Color ${c}`}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
              title="Custom color"
            />
          </div>

          <div className="h-6 w-px bg-stone-200 dark:bg-slate-700 hidden sm:block" />

          {/* Size & Opacity */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <label className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium">Size</span>
              <input
                type="range"
                min={1}
                max={24}
                step={0.5}
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-16 accent-indigo-600"
              />
              <span className="font-mono text-[11px] w-5">{strokeWidth}</span>
            </label>
            <label className="hidden md:flex items-center gap-1.5">
              <span className="text-[11px] font-medium">Alpha</span>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-14 accent-indigo-600"
              />
            </label>
          </div>

          {/* Paper background (unless overlayMode) */}
          {!overlayMode && (
            <select
              value={value.background}
              onChange={(e) => commitChange({ ...value, background: e.target.value })}
              className="text-xs px-2 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              title="Canvas Paper Background"
            >
              <option value="plain">Plain Paper</option>
              <option value="grid">Graph Grid</option>
              <option value="dot">Dot Grid</option>
              <option value="lined">Ruled Paper</option>
              <option value="dark_board">Chalkboard</option>
            </select>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={() => setSnapGrid((s) => !s)}
              title="Snap shapes to 12px grid"
              className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                snapGrid
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-300'
                  : 'border-stone-200 dark:border-slate-700 text-slate-500 hover:bg-stone-100 dark:hover:bg-slate-800'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0}
              title="Undo"
              className="p-1.5 rounded-lg border border-stone-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title="Redo"
              className="p-1.5 rounded-lg border border-stone-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            {!overlayMode && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
                  title="Zoom out"
                  className="p-1.5 rounded-lg border border-stone-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono text-slate-500 w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2, Number((z + 0.15).toFixed(2))))}
                  title="Zoom in"
                  className="p-1.5 rounded-lg border border-stone-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleInsertImage(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  title="Place image on canvas"
                  className="p-1.5 rounded-lg border border-stone-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={exportPng}
              title="Export PNG"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> PNG
            </button>
            {!overlayMode && (
              <button
                type="button"
                onClick={exportSvg}
                title="Export Vector SVG"
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                SVG
              </button>
            )}

            {onInsertIntoDocument && (
              <button
                type="button"
                onClick={handleEmbedIntoDoc}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                title="Embed this drawing inside the Document editor"
              >
                <FilePlus2 className="w-3.5 h-3.5" /> Embed
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (
                  value.strokes.length + value.shapes.length + value.texts.length === 0 ||
                  window.confirm('Clear all ink and shapes on this canvas?')
                ) {
                  commitChange({ ...value, strokes: [], shapes: [], texts: [], images: [] });
                }
              }}
              title="Clear canvas"
              className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Canvas Viewport */}
      <div
        className={`relative flex-1 overflow-auto flex justify-center items-start ${
          overlayMode ? 'bg-transparent p-0' : 'bg-[#EAE6DC] dark:bg-[#0B0F17] p-4 sm:p-6'
        }`}
      >
        <div
          className={`relative ${
            overlayMode ? 'w-full h-full' : 'rounded-xl shadow-xl border border-stone-300/70 dark:border-slate-700 overflow-hidden'
          }`}
          style={
            overlayMode
              ? undefined
              : {
                  width: `${Math.round(canvasWidth * zoom)}px`,
                  height: `${Math.round(canvasHeight * zoom)}px`,
                }
          }
        >
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              width: '100%',
              height: '100%',
              touchAction: readOnly ? 'auto' : 'none',
              cursor: readOnly
                ? 'default'
                : tool === 'select'
                  ? 'grab'
                  : tool === 'text'
                    ? 'text'
                    : 'crosshair',
            }}
          />

          {textInputPos && (
            <div
              className="absolute z-20 flex items-center gap-1 bg-white dark:bg-slate-900 border border-indigo-400 rounded-lg shadow-lg p-1"
              style={{
                left: `${(textInputPos.x / canvasWidth) * 100}%`,
                top: `${(textInputPos.y / canvasHeight) * 100}%`,
              }}
            >
              <input
                autoFocus
                type="text"
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitText();
                  if (e.key === 'Escape') setTextInputPos(null);
                }}
                placeholder="Type label..."
                className="px-2 py-1 text-xs bg-transparent focus:outline-none text-slate-900 dark:text-white min-w-[140px]"
              />
              <button
                type="button"
                onClick={commitText}
                className="px-2 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-md"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
