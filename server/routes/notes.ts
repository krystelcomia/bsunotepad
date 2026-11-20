import { Router, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { removeNoteFts, syncNoteFts } from '../db/database.js';
import { requireRole } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types.js';
import { generateId, generateToken } from '../utils/crypto.js';
import { countWords, extractPlainTextFromTipTap, sanitizeHtmlBasic } from '../utils/sanitize.js';

interface TemplateData {
  title: string;
  mode: 'document' | 'notebook' | 'drawing';
  paper_style: string;
  content_json: string;
  cornell_cues: string;
  cornell_summary: string;
}

function getTemplatePayload(templateId: string | undefined): TemplateData {
  const emptyDoc = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] });
  switch (templateId) {
    case 'cornell':
      return {
        title: 'Cornell Lecture Notes',
        mode: 'notebook',
        paper_style: 'cornell',
        content_json: JSON.stringify({
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Lecture Key Concepts' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Capture detailed explanations, derivations, and examples during lecture.' }] },
            { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Main thesis or theorem...' }] }] }] },
          ],
        }),
        cornell_cues: 'Key Questions?\n\nVocabulary / Formulas?\n\nExam Hints?',
        cornell_summary: 'Synthesize the 2-3 core takeaways from this lecture in your own words.',
      };
    case 'lab-report':
      return {
        title: 'Academic Lab Report',
        mode: 'document',
        paper_style: 'plain',
        content_json: JSON.stringify({
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Experiment Title & Lab Report' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. Abstract & Hypothesis' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'State the scientific goal, apparatus, and testable prediction.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. Observations & Data Table' }] },
            {
              type: 'table',
              content: [
                {
                  type: 'tableRow',
                  content: [
                    { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Trial' }] }] },
                    { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Measurement' }] }] },
                    { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Notes' }] }] },
                  ],
                },
                {
                  type: 'tableRow',
                  content: [
                    { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Trial 1' }] }] },
                    { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '0.00' }] }] },
                    { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Baseline' }] }] },
                  ],
                },
              ],
            },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Conclusion & Error Analysis' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Evaluate experimental error and link back to theoretical expectations.' }] },
          ],
        }),
        cornell_cues: '',
        cornell_summary: '',
      };
    case 'essay':
      return {
        title: 'Structured Essay Draft',
        mode: 'document',
        paper_style: 'plain',
        content_json: JSON.stringify({
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Essay Title' }] },
            { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Thesis Statement: Write your central argument concisely here.' }] }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Introduction' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Context, scholarly framing, and thesis roadmap.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Body Arguments' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Evidence, citations, and critical analysis.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Conclusion & Works Cited' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Synthesis and broader academic significance.' }] },
          ],
        }),
        cornell_cues: '',
        cornell_summary: '',
      };
    case 'sketchpad':
      return {
        title: 'Visual Diagram & Sketchpad',
        mode: 'drawing',
        paper_style: 'dot',
        content_json: emptyDoc,
        cornell_cues: '',
        cornell_summary: '',
      };
    case 'lined-notebook':
      return {
        title: 'Lined Class Notebook Page',
        mode: 'notebook',
        paper_style: 'lined',
        content_json: emptyDoc,
        cornell_cues: '',
        cornell_summary: '',
      };
    default:
      return {
        title: 'Untitled Document',
        mode: 'document',
        paper_style: 'plain',
        content_json: emptyDoc,
        cornell_cues: '',
        cornell_summary: '',
      };
  }
}

const ALLOWED_PAGE_SIZES = new Set(['compact', 'a4', 'letter', 'wide', 'fluid']);

function sanitizeBgColor(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toUpperCase() : '';
}

export function createNotesRouter(
  db: DatabaseSync,
  requireAuth: (req: AuthenticatedRequest, res: Response, next: () => void) => void
): { notesRouter: Router; sharedRouter: Router } {
  const notesRouter = Router();
  notesRouter.use(requireAuth);
  notesRouter.use(requireRole('student'));

  notesRouter.get('/', (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const trashed = req.query.trashed === '1' ? 1 : 0;
    const starred = req.query.starred === '1';
    const folderId = req.query.folderId ? String(req.query.folderId) : null;
    const notebookId = req.query.notebookId ? String(req.query.notebookId) : null;
    const subjectId = req.query.subjectId ? String(req.query.subjectId) : null;
    const mode = req.query.mode ? String(req.query.mode) : null;
    const category = req.query.category ? String(req.query.category).trim() : null;
    const q = req.query.q ? String(req.query.q).trim() : '';
    const sort = req.query.sort ? String(req.query.sort) : '';

    let sql = `
      SELECT n.id, n.folder_id, n.notebook_id, n.subject_id, n.title, n.description, n.category,
             n.mode, n.paper_style, n.paper_bg_color, n.page_size,
             substr(n.plain_text, 1, 220) as excerpt, n.drawing_preview, n.tags_json,
             n.word_count, n.is_pinned, n.is_starred, n.is_trashed, n.trashed_at, n.share_token,
             n.last_opened_at, n.created_at, n.updated_at,
             f.name as folder_name, f.color as folder_color,
             nb.title as notebook_title, s.code as subject_code, s.name as subject_name, s.color as subject_color
      FROM notes n
      LEFT JOIN folders f ON f.id = n.folder_id
      LEFT JOIN notebooks nb ON nb.id = n.notebook_id
      LEFT JOIN subjects s ON s.id = n.subject_id
      WHERE n.user_id = ? AND n.is_trashed = ?
    `;
    const params: (string | number)[] = [userId, trashed];

    if (starred) {
      sql += ' AND n.is_starred = 1';
    }
    if (folderId) {
      sql += ' AND n.folder_id = ?';
      params.push(folderId);
    }
    if (notebookId) {
      sql += ' AND n.notebook_id = ?';
      params.push(notebookId);
    }
    if (subjectId) {
      sql += ' AND n.subject_id = ?';
      params.push(subjectId);
    }
    if (mode && ['document', 'notebook', 'drawing'].includes(mode)) {
      sql += ' AND n.mode = ?';
      params.push(mode);
    }
    if (category && category !== 'all') {
      sql += ' AND n.category = ?';
      params.push(category);
    }
    if (q) {
      const like = `%${q}%`;
      sql +=
        ' AND (n.title LIKE ? OR n.description LIKE ? OR n.plain_text LIKE ? OR n.cornell_cues LIKE ? OR n.cornell_summary LIKE ? OR n.tags_json LIKE ? OR n.category LIKE ?)';
      params.push(like, like, like, like, like, like, like);
    }

    switch (sort) {
      case 'updated_asc':
        sql += ' ORDER BY n.updated_at ASC';
        break;
      case 'created_desc':
        sql += ' ORDER BY n.created_at DESC';
        break;
      case 'created_asc':
        sql += ' ORDER BY n.created_at ASC';
        break;
      case 'title_asc':
        sql += ' ORDER BY n.title COLLATE NOCASE ASC, n.updated_at DESC';
        break;
      case 'title_desc':
        sql += ' ORDER BY n.title COLLATE NOCASE DESC, n.updated_at DESC';
        break;
      case 'updated_desc':
        sql += ' ORDER BY n.updated_at DESC';
        break;
      default:
        sql += ' ORDER BY n.is_pinned DESC, n.updated_at DESC';
        break;
    }

    const notes = db.prepare(sql).all(...params);
    res.json({ notes });
  });

  notesRouter.get('/:id', (req: AuthenticatedRequest, res) => {
    const existing = db
      .prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id);

    if (!existing) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    db.prepare('UPDATE notes SET last_opened_at = ? WHERE id = ? AND user_id = ?').run(
      new Date().toISOString(),
      req.params.id,
      req.user!.id
    );

    const note = db
      .prepare(
        `SELECT n.*, f.name as folder_name, f.color as folder_color,
                nb.title as notebook_title, s.code as subject_code, s.name as subject_name, s.color as subject_color
         FROM notes n
         LEFT JOIN folders f ON f.id = n.folder_id
         LEFT JOIN notebooks nb ON nb.id = n.notebook_id
         LEFT JOIN subjects s ON s.id = n.subject_id
         WHERE n.id = ? AND n.user_id = ?`
      )
      .get(req.params.id, req.user!.id);

    const attachments = db
      .prepare('SELECT * FROM attachments WHERE note_id = ? AND user_id = ? ORDER BY created_at DESC')
      .all(req.params.id, req.user!.id);

    const versionCountRow = db
      .prepare('SELECT COUNT(*) as c FROM note_versions WHERE note_id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id) as { c: number };

    res.json({
      note,
      attachments,
      versionCount: Number(versionCountRow?.c || 0),
    });
  });

  notesRouter.post('/', (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const tpl = getTemplatePayload(req.body?.template ? String(req.body.template) : undefined);

    const title = req.body?.title ? String(req.body.title).trim() : tpl.title;
    const description =
      req.body?.description !== undefined ? String(req.body.description).trim().slice(0, 500) : '';
    const category =
      req.body?.category !== undefined
        ? String(req.body.category).trim().slice(0, 60) || 'General'
        : 'General';
    const mode = req.body?.mode && ['document', 'notebook', 'drawing'].includes(String(req.body.mode))
      ? String(req.body.mode)
      : tpl.mode;
    const paperStyle = req.body?.paper_style ? String(req.body.paper_style) : tpl.paper_style;
    const paperBgColor = sanitizeBgColor(req.body?.paper_bg_color);
    const reqPageSize = req.body?.page_size ? String(req.body.page_size) : '';
    const pageSize = ALLOWED_PAGE_SIZES.has(reqPageSize)
      ? reqPageSize
      : (mode === 'drawing' ? 'fluid' : 'a4');

    let folderId = req.body?.folder_id ? String(req.body.folder_id) : null;
    let notebookId = req.body?.notebook_id ? String(req.body.notebook_id) : null;
    let subjectId = req.body?.subject_id ? String(req.body.subject_id) : null;

    if (folderId) {
      const f = db.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?').get(folderId, userId);
      if (!f) folderId = null;
    }

    if (notebookId) {
      const nb = db
        .prepare('SELECT id, subject_id, default_paper_style FROM notebooks WHERE id = ? AND user_id = ?')
        .get(notebookId, userId) as { id: string; subject_id: string | null; default_paper_style: string } | undefined;
      if (!nb) {
        notebookId = null;
      } else if (!subjectId && nb.subject_id) {
        subjectId = nb.subject_id;
      }
    }

    if (subjectId) {
      const sub = db.prepare('SELECT id FROM subjects WHERE id = ? AND user_id = ?').get(subjectId, userId);
      if (!sub) subjectId = null;
    }

    const contentJson = req.body?.content_json ? String(req.body.content_json) : tpl.content_json;
    const contentHtml = req.body?.content_html ? sanitizeHtmlBasic(String(req.body.content_html)) : '';
    const cornellCues = req.body?.cornell_cues !== undefined ? String(req.body.cornell_cues) : tpl.cornell_cues;
    const cornellSummary = req.body?.cornell_summary !== undefined ? String(req.body.cornell_summary) : tpl.cornell_summary;
    const drawingData = req.body?.drawing_data
      ? String(req.body.drawing_data)
      : JSON.stringify({
          version: 1,
          background: mode === 'drawing' ? paperStyle : 'transparent',
          strokes: [],
          shapes: [],
          texts: [],
        });

    const plainText = extractPlainTextFromTipTap(contentJson);
    const wordCount = countWords(plainText);
    const tagsJson = Array.isArray(req.body?.tags) ? JSON.stringify(req.body.tags.map(String)) : '[]';
    const now = new Date().toISOString();
    const id = generateId();

    db.prepare(
      `INSERT INTO notes (
        id, user_id, folder_id, notebook_id, subject_id, title, description, category,
        mode, paper_style, paper_bg_color, page_size,
        content_json, content_html, plain_text, cornell_cues, cornell_summary,
        drawing_data, tags_json, word_count, is_pinned, is_starred, is_trashed, last_opened_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?)`
    ).run(
      id, userId, folderId, notebookId, subjectId, title || 'Untitled Note', description, category,
      mode, paperStyle, paperBgColor, pageSize,
      contentJson, contentHtml, plainText, cornellCues, cornellSummary,
      drawingData, tagsJson, wordCount, req.body?.is_starred ? 1 : 0, now, now, now
    );

    syncNoteFts(db, {
      id,
      user_id: userId,
      title: title || 'Untitled Note',
      description,
      category,
      plain_text: plainText,
      cornell_cues: cornellCues,
      cornell_summary: cornellSummary,
      tags_json: tagsJson,
      is_trashed: 0,
    });

    const note = db
      .prepare(
        `SELECT n.*, f.name as folder_name, f.color as folder_color,
                nb.title as notebook_title, s.code as subject_code, s.name as subject_name, s.color as subject_color
         FROM notes n
         LEFT JOIN folders f ON f.id = n.folder_id
         LEFT JOIN notebooks nb ON nb.id = n.notebook_id
         LEFT JOIN subjects s ON s.id = n.subject_id
         WHERE n.id = ?`
      )
      .get(id);

    res.status(201).json({ note });
  });

  notesRouter.patch('/:id', (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const existing = db
      .prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?')
      .get(req.params.id, userId) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const title = req.body?.title !== undefined ? String(req.body.title).trim() || 'Untitled Note' : String(existing.title);
    const description =
      req.body?.description !== undefined
        ? String(req.body.description).trim().slice(0, 500)
        : String(existing.description || '');
    const category =
      req.body?.category !== undefined
        ? String(req.body.category).trim().slice(0, 60) || 'General'
        : String(existing.category || 'General');
    const mode = req.body?.mode && ['document', 'notebook', 'drawing'].includes(String(req.body.mode))
      ? String(req.body.mode)
      : String(existing.mode);
    const paperStyle = req.body?.paper_style !== undefined ? String(req.body.paper_style) : String(existing.paper_style);
    const paperBgColor =
      req.body?.paper_bg_color !== undefined
        ? sanitizeBgColor(req.body.paper_bg_color)
        : String(existing.paper_bg_color || '');
    const reqPageSize = req.body?.page_size ? String(req.body.page_size) : '';
    const pageSize = ALLOWED_PAGE_SIZES.has(reqPageSize)
      ? reqPageSize
      : String(existing.page_size);

    let folderId = req.body?.folder_id !== undefined
      ? (req.body.folder_id ? String(req.body.folder_id) : null)
      : (existing.folder_id as string | null);
    let notebookId = req.body?.notebook_id !== undefined
      ? (req.body.notebook_id ? String(req.body.notebook_id) : null)
      : (existing.notebook_id as string | null);
    let subjectId = req.body?.subject_id !== undefined
      ? (req.body.subject_id ? String(req.body.subject_id) : null)
      : (existing.subject_id as string | null);

    if (folderId && !db.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?').get(folderId, userId)) {
      folderId = null;
    }
    if (notebookId && !db.prepare('SELECT id FROM notebooks WHERE id = ? AND user_id = ?').get(notebookId, userId)) {
      notebookId = null;
    }
    if (subjectId && !db.prepare('SELECT id FROM subjects WHERE id = ? AND user_id = ?').get(subjectId, userId)) {
      subjectId = null;
    }

    const contentJson = req.body?.content_json !== undefined ? String(req.body.content_json) : String(existing.content_json);
    const contentHtml = req.body?.content_html !== undefined
      ? sanitizeHtmlBasic(String(req.body.content_html))
      : String(existing.content_html);
    const cornellCues = req.body?.cornell_cues !== undefined ? String(req.body.cornell_cues) : String(existing.cornell_cues);
    const cornellSummary = req.body?.cornell_summary !== undefined ? String(req.body.cornell_summary) : String(existing.cornell_summary);
    const drawingData = req.body?.drawing_data !== undefined ? String(req.body.drawing_data) : String(existing.drawing_data);
    const drawingPreview = req.body?.drawing_preview !== undefined ? String(req.body.drawing_preview) : String(existing.drawing_preview || '');
    const tagsJson = req.body?.tags !== undefined
      ? JSON.stringify(Array.isArray(req.body.tags) ? req.body.tags.map(String) : [])
      : String(existing.tags_json);
    const isPinned = req.body?.is_pinned !== undefined ? (req.body.is_pinned ? 1 : 0) : Number(existing.is_pinned);
    const isStarred = req.body?.is_starred !== undefined ? (req.body.is_starred ? 1 : 0) : Number(existing.is_starred);

    const plainText = extractPlainTextFromTipTap(contentJson);
    const wordCount = countWords(plainText);
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE notes
       SET folder_id = ?, notebook_id = ?, subject_id = ?, title = ?, description = ?, category = ?,
           mode = ?, paper_style = ?, paper_bg_color = ?, page_size = ?,
           content_json = ?, content_html = ?, plain_text = ?, cornell_cues = ?, cornell_summary = ?,
           drawing_data = ?, drawing_preview = ?, tags_json = ?, word_count = ?,
           is_pinned = ?, is_starred = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      folderId, notebookId, subjectId, title, description, category,
      mode, paperStyle, paperBgColor, pageSize,
      contentJson, contentHtml, plainText, cornellCues, cornellSummary,
      drawingData, drawingPreview, tagsJson, wordCount,
      isPinned, isStarred, now, req.params.id, userId
    );

    syncNoteFts(db, {
      id: req.params.id,
      user_id: userId,
      title,
      description,
      category,
      plain_text: plainText,
      cornell_cues: cornellCues,
      cornell_summary: cornellSummary,
      tags_json: tagsJson,
      is_trashed: Number(existing.is_trashed),
    });

    const note = db
      .prepare(
        `SELECT n.*, f.name as folder_name, f.color as folder_color,
                nb.title as notebook_title, s.code as subject_code, s.name as subject_name, s.color as subject_color
         FROM notes n
         LEFT JOIN folders f ON f.id = n.folder_id
         LEFT JOIN notebooks nb ON nb.id = n.notebook_id
         LEFT JOIN subjects s ON s.id = n.subject_id
         WHERE n.id = ?`
      )
      .get(req.params.id);

    res.json({ note });
  });

  notesRouter.post('/:id/trash', (req: AuthenticatedRequest, res) => {
    const now = new Date().toISOString();
    const info = db
      .prepare('UPDATE notes SET is_trashed = 1, trashed_at = ?, is_pinned = 0 WHERE id = ? AND user_id = ?')
      .run(now, req.params.id, req.user!.id);

    if (info.changes === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    removeNoteFts(db, req.params.id);
    res.json({ ok: true });
  });

  notesRouter.post('/:id/restore', (req: AuthenticatedRequest, res) => {
    const info = db
      .prepare('UPDATE notes SET is_trashed = 0, trashed_at = NULL, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(new Date().toISOString(), req.params.id, req.user!.id);

    if (info.changes === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const row = db
      .prepare('SELECT id, user_id, title, description, category, plain_text, cornell_cues, cornell_summary, tags_json, is_trashed FROM notes WHERE id = ?')
      .get(req.params.id) as {
      id: string;
      user_id: string;
      title: string;
      description: string;
      category: string;
      plain_text: string;
      cornell_cues: string;
      cornell_summary: string;
      tags_json: string;
      is_trashed: number;
    };

    syncNoteFts(db, row);
    res.json({ ok: true });
  });

  notesRouter.delete('/:id', (req: AuthenticatedRequest, res) => {
    const info = db
      .prepare('DELETE FROM notes WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    removeNoteFts(db, req.params.id);
    res.json({ ok: true });
  });

  notesRouter.post('/:id/duplicate', (req: AuthenticatedRequest, res) => {
    const src = db
      .prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

    if (!src) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const newId = generateId();
    const now = new Date().toISOString();
    const newTitle = `${String(src.title)} (Copy)`;
    const description = String(src.description || '');
    const category = String(src.category || 'General');
    const paperBgColor = String(src.paper_bg_color || '');

    db.prepare(
      `INSERT INTO notes (
        id, user_id, folder_id, notebook_id, subject_id, title, description, category,
        mode, paper_style, paper_bg_color, page_size,
        content_json, content_html, plain_text, cornell_cues, cornell_summary,
        drawing_data, drawing_preview, tags_json, word_count, is_pinned, is_starred, is_trashed, last_opened_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?)`
    ).run(
      newId,
      req.user!.id,
      src.folder_id as string | null,
      src.notebook_id as string | null,
      src.subject_id as string | null,
      newTitle,
      description,
      category,
      String(src.mode),
      String(src.paper_style),
      paperBgColor,
      String(src.page_size),
      String(src.content_json),
      String(src.content_html),
      String(src.plain_text),
      String(src.cornell_cues),
      String(src.cornell_summary),
      String(src.drawing_data),
      String(src.drawing_preview || ''),
      String(src.tags_json),
      Number(src.word_count),
      Number(src.is_starred),
      now,
      now,
      now
    );

    syncNoteFts(db, {
      id: newId,
      user_id: req.user!.id,
      title: newTitle,
      description,
      category,
      plain_text: String(src.plain_text),
      cornell_cues: String(src.cornell_cues),
      cornell_summary: String(src.cornell_summary),
      tags_json: String(src.tags_json),
      is_trashed: 0,
    });

    const note = db
      .prepare(
        `SELECT n.*, f.name as folder_name, f.color as folder_color,
                nb.title as notebook_title, s.code as subject_code, s.name as subject_name, s.color as subject_color
         FROM notes n
         LEFT JOIN folders f ON f.id = n.folder_id
         LEFT JOIN notebooks nb ON nb.id = n.notebook_id
         LEFT JOIN subjects s ON s.id = n.subject_id
         WHERE n.id = ?`
      )
      .get(newId);
    res.status(201).json({ note });
  });

  // Version History
  notesRouter.get('/:id/versions', (req: AuthenticatedRequest, res) => {
    const versions = db
      .prepare(
        `SELECT id, note_id, label, title, mode, paper_style, word_count, created_at
         FROM note_versions
         WHERE note_id = ? AND user_id = ?
         ORDER BY created_at DESC
         LIMIT 30`
      )
      .all(req.params.id, req.user!.id);
    res.json({ versions });
  });

  notesRouter.post('/:id/versions', (req: AuthenticatedRequest, res) => {
    const note = db
      .prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const versionId = generateId();
    const label = String(req.body?.label || '').trim() || `Snapshot ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO note_versions (
        id, note_id, user_id, label, title, mode, paper_style,
        content_json, content_html, cornell_cues, cornell_summary, drawing_data, word_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      versionId,
      req.params.id,
      req.user!.id,
      label,
      String(note.title),
      String(note.mode),
      String(note.paper_style),
      String(note.content_json),
      String(note.content_html),
      String(note.cornell_cues),
      String(note.cornell_summary),
      String(note.drawing_data),
      Number(note.word_count),
      now
    );

    const version = db.prepare('SELECT id, note_id, label, title, mode, paper_style, word_count, created_at FROM note_versions WHERE id = ?').get(versionId);
    res.status(201).json({ version });
  });

  notesRouter.post('/:id/versions/:versionId/restore', (req: AuthenticatedRequest, res) => {
    const version = db
      .prepare('SELECT * FROM note_versions WHERE id = ? AND note_id = ? AND user_id = ?')
      .get(req.params.versionId, req.params.id, req.user!.id) as Record<string, unknown> | undefined;

    if (!version) {
      res.status(404).json({ error: 'Version snapshot not found' });
      return;
    }

    const plainText = extractPlainTextFromTipTap(String(version.content_json));
    const wordCount = countWords(plainText);
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE notes
       SET title = ?, mode = ?, paper_style = ?, content_json = ?, content_html = ?,
           plain_text = ?, cornell_cues = ?, cornell_summary = ?, drawing_data = ?,
           word_count = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      String(version.title),
      String(version.mode),
      String(version.paper_style),
      String(version.content_json),
      String(version.content_html),
      plainText,
      String(version.cornell_cues),
      String(version.cornell_summary),
      String(version.drawing_data),
      wordCount,
      now,
      req.params.id,
      req.user!.id
    );

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    syncNoteFts(db, {
      id: String(note.id),
      user_id: req.user!.id,
      title: String(note.title),
      plain_text: plainText,
      cornell_cues: String(note.cornell_cues),
      cornell_summary: String(note.cornell_summary),
      tags_json: String(note.tags_json),
      is_trashed: Number(note.is_trashed),
    });

    res.json({ note });
  });

  // Share link toggle
  notesRouter.post('/:id/share', (req: AuthenticatedRequest, res) => {
    const existing = db
      .prepare('SELECT id, share_token FROM notes WHERE id = ? AND user_id = ? AND is_trashed = 0')
      .get(req.params.id, req.user!.id) as { id: string; share_token: string | null } | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const enabled = req.body?.enabled !== undefined ? Boolean(req.body.enabled) : !existing.share_token;
    const token = enabled ? (existing.share_token || generateToken(16)) : null;

    db.prepare('UPDATE notes SET share_token = ?, updated_at = ? WHERE id = ?').run(
      token,
      new Date().toISOString(),
      existing.id
    );

    res.json({ share_token: token });
  });

  // Public shared note router
  const sharedRouter = Router();
  sharedRouter.get('/:token', (req, res) => {
    const note = db
      .prepare(
        `SELECT n.id, n.title, n.mode, n.paper_style, n.page_size, n.content_json, n.content_html,
                n.cornell_cues, n.cornell_summary, n.drawing_data, n.tags_json, n.word_count, n.updated_at,
                u.full_name as author_name, u.university as author_university,
                s.code as subject_code, s.name as subject_name, s.color as subject_color
         FROM notes n
         JOIN users u ON u.id = n.user_id
         LEFT JOIN subjects s ON s.id = n.subject_id
         WHERE n.share_token = ? AND n.is_trashed = 0`
      )
      .get(req.params.token);

    if (!note) {
      res.status(404).json({ error: 'Shared note link is invalid or has been revoked.' });
      return;
    }

    res.json({ note });
  });

  return { notesRouter, sharedRouter };
}
