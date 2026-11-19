import path from 'node:path';

interface TipTapNode {
  type?: string;
  text?: string;
  content?: TipTapNode[];
  attrs?: Record<string, unknown>;
}

export function extractPlainTextFromTipTap(jsonStr: string | null | undefined): string {
  if (!jsonStr) return '';
  try {
    const root = JSON.parse(jsonStr) as TipTapNode;
    const chunks: string[] = [];

    const walk = (node: TipTapNode | undefined) => {
      if (!node) return;
      if (typeof node.text === 'string') {
        chunks.push(node.text);
      }
      if (node.type === 'hardBreak') {
        chunks.push('\n');
      }
      if (Array.isArray(node.content)) {
        for (const child of node.content) {
          walk(child);
        }
      }
      if (
        node.type === 'paragraph' ||
        node.type === 'heading' ||
        node.type === 'listItem' ||
        node.type === 'taskItem' ||
        node.type === 'blockquote' ||
        node.type === 'codeBlock' ||
        node.type === 'tableRow'
      ) {
        chunks.push('\n');
      }
    };

    walk(root);
    return chunks.join(' ').replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
  } catch {
    return '';
  }
}

export function countWords(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

export function sanitizeFilename(filename: string): string {
  const base = path.basename(filename || 'untitled');
  const cleaned = base.replace(/[^a-zA-Z0-9._\-\s()]/g, '_').replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, 140) || 'file';
}

export function sanitizeHtmlBasic(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, 'blocked:');
}

export function categorizeMime(mime: string, filename: string): 'image' | 'pdf' | 'document' | 'other' {
  const lowerMime = (mime || '').toLowerCase();
  const ext = path.extname(filename || '').toLowerCase();
  if (lowerMime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
    return 'image';
  }
  if (lowerMime === 'application/pdf' || ext === '.pdf') {
    return 'pdf';
  }
  if (
    lowerMime.startsWith('text/') ||
    lowerMime.includes('word') ||
    lowerMime.includes('document') ||
    lowerMime.includes('spreadsheet') ||
    lowerMime.includes('presentation') ||
    ['.txt', '.md', '.csv', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.json'].includes(ext)
  ) {
    return 'document';
  }
  return 'other';
}
