import { DrawingData, Note } from '../types';

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exp = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, exp);
  return `${value.toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`;
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 45) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDueDate(iso: string | null): { label: string; urgent: boolean } {
  if (!iso) return { label: 'No due date', urgent: false };
  const target = new Date(iso);
  const diffHours = (target.getTime() - Date.now()) / 3600000;
  if (diffHours < 0) return { label: `Overdue (${target.toLocaleDateString()})`, urgent: true };
  if (diffHours < 24) return { label: 'Due within 24h', urgent: true };
  if (diffHours < 72) return { label: `Due in ${Math.ceil(diffHours / 24)}d`, urgent: true };
  return { label: target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), urgent: false };
}

export function parseTags(tagsJson: string | undefined): string[] {
  if (!tagsJson) return [];
  try {
    const parsed = JSON.parse(tagsJson);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function parseDrawingData(json: string | undefined): DrawingData {
  const fallback: DrawingData = {
    version: 1,
    background: 'transparent',
    strokes: [],
    shapes: [],
    texts: [],
    images: [],
  };
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json) as Partial<DrawingData>;
    return {
      version: parsed.version || 1,
      background: parsed.background || 'transparent',
      strokes: Array.isArray(parsed.strokes) ? parsed.strokes : [],
      shapes: Array.isArray(parsed.shapes) ? parsed.shapes : [],
      texts: Array.isArray(parsed.texts) ? parsed.texts : [],
      images: Array.isArray(parsed.images) ? parsed.images : [],
    };
  } catch {
    return fallback;
  }
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportNoteAsHtml(note: Note, renderedHtml: string): void {
  const safeTitle = (note.title || 'note').replace(/[<>]/g, '');
  const cornellSection =
    note.paper_style === 'cornell' && (note.cornell_cues || note.cornell_summary)
      ? `<div style="display:grid;grid-template-columns:220px 1fr;gap:24px;border-top:2px solid #cbd5e1;padding-top:16px;margin-top:16px;">
          <div style="border-right:2px solid #e11d48;padding-right:16px;">
            <h4 style="font-size:12px;text-transform:uppercase;color:#64748b;margin:0 0 8px;">Cues & Questions</h4>
            <pre style="white-space:pre-wrap;font-family:inherit;margin:0;">${note.cornell_cues}</pre>
          </div>
          <div>${renderedHtml}</div>
        </div>
        <div style="border-top:2px solid #cbd5e1;margin-top:20px;padding-top:12px;">
          <h4 style="font-size:12px;text-transform:uppercase;color:#64748b;margin:0 0 6px;">Summary</h4>
          <p style="margin:0;">${note.cornell_summary}</p>
        </div>`
      : renderedHtml;

  const doc = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safeTitle} — INKORA</title>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; max-width: 820px; margin: 40px auto; padding: 0 24px; color: #161925; line-height: 1.7; }
    h1,h2,h3 { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    td, th { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
    th { background: #f1f5f9; }
    blockquote { border-left: 4px solid #4f46e5; padding: 8px 16px; background: #eef2ff; margin: 16px 0; }
    pre { background: #0f172a; color: #e2e8f0; padding: 14px; border-radius: 8px; overflow-x: auto; }
  </style>
</head>
<body>
  <header style="border-bottom:1px solid #e2e8f0;padding-bottom:12px;margin-bottom:24px;">
    <div style="font-size:12px;color:#4f46e5;font-weight:700;letter-spacing:0.08em;">INKORA ACADEMIC DOCUMENT</div>
    <h1 style="margin:6px 0 4px;">${safeTitle}</h1>
    <div style="font-size:13px;color:#64748b;">Exported ${new Date().toLocaleString()}</div>
  </header>
  ${cornellSection}
</body>
</html>`;

  const slug = safeTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'inkora-note';
  downloadTextFile(`${slug}.html`, doc, 'text/html;charset=utf-8');
}

export function htmlToMarkdownApprox(note: Note, plainText: string): string {
  const lines: string[] = [`# ${note.title || 'Untitled Note'}`, ''];
  if (note.subject_code || note.subject_name) {
    lines.push(`**Course:** ${[note.subject_code, note.subject_name].filter(Boolean).join(' — ')}`);
    lines.push('');
  }
  if (note.cornell_cues) {
    lines.push('## Cues & Questions', '', note.cornell_cues, '');
  }
  lines.push('## Notes', '', plainText || '');
  if (note.cornell_summary) {
    lines.push('', '## Summary', '', note.cornell_summary);
  }
  return lines.join('\n');
}
