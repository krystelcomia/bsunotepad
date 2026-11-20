import { DatabaseSync } from 'node:sqlite';
import { generateId, hashPassword } from '../utils/crypto.js';
import { countWords, extractPlainTextFromTipTap } from '../utils/sanitize.js';
import { syncNoteFts } from './database.js';

export const DEMO_EMAIL = 'alex.rivera.demo@gmail.com';
export const DEMO_PASSWORD = 'InkoraDemo2026!';
export const ADMIN_EMAIL = (process.env.INKORA_ADMIN_EMAIL || 'inkora.admin@gmail.com').trim().toLowerCase();
export const ADMIN_PASSWORD = process.env.INKORA_ADMIN_PASSWORD || 'InkoraAdmin2026!';

function isoOffset(hoursOffset: number): string {
  return new Date(Date.now() + hoursOffset * 3600 * 1000).toISOString();
}

export function ensureAdminUser(db: DatabaseSync): string {
  const existing = db
    .prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
    .get() as { id: string } | undefined;

  if (existing) {
    return existing.id;
  }

  const now = new Date().toISOString();
  const adminId = generateId();
  const passwordHash = hashPassword(ADMIN_PASSWORD);

  db.prepare(
    `INSERT INTO users (
      id, email, email_verified, password_hash, role, status, status_reason, full_name, university,
      major, academic_year, bio, theme_preference, workspace_accent, is_demo,
      last_login_at, login_count, created_at, updated_at
    ) VALUES (?, ?, 1, ?, 'admin', 'active', '', ?, ?, ?, ?, ?, 'light', 'blue', 0, ?, 0, ?, ?)`
  ).run(
    adminId,
    ADMIN_EMAIL,
    passwordHash,
    'Tagapangasiwa ng INKORA',
    'Operasyon ng Platform ng INKORA',
    'Pangangasiwa ng Sistema',
    'Kawani',
    'Tagapangasiwa ng platform na sumusubaybay sa kalagayan ng mga account ng mag-aaral, kontrol sa access, at mga alalahanin.',
    null,
    now,
    now
  );

  return adminId;
}

export function ensureDemoUser(db: DatabaseSync): string {
  ensureAdminUser(db);

  const existing = db
    .prepare('SELECT id FROM users WHERE LOWER(email) = ?')
    .get(DEMO_EMAIL) as { id: string } | undefined;

  if (existing) {
    return existing.id;
  }

  const now = new Date().toISOString();
  const userId = generateId();
  const passwordHash = hashPassword(DEMO_PASSWORD);

  db.prepare(
    `INSERT INTO users (
      id, email, email_verified, password_hash, role, status, status_reason, full_name, university,
      major, academic_year, bio, theme_preference, workspace_accent, is_demo,
      last_login_at, login_count, created_at, updated_at
    ) VALUES (?, ?, 1, ?, 'student', 'active', '', ?, ?, ?, ?, ?, 'light', 'blue', 1, ?, 4, ?, ?)`
  ).run(
    userId,
    DEMO_EMAIL,
    passwordHash,
    'Alex Rivera',
    'Bridgewater State University',
    'Agham Pangkompyuter at Bioinformatika',
    'Ikatlong Taon (Junior)',
    'Mag-aaral na nag-aayos ng mga tala sa klase, ulat sa laboratoryo, at mga guhit ng algoritmo sa INKORA.',
    isoOffset(-1),
    isoOffset(-240),
    now
  );

  // Folders for organizing notes
  const folderFallId = generateId();
  const folderLabsId = generateId();
  const folderExamsId = generateId();

  const insertFolder = db.prepare(
    `INSERT INTO folders (id, user_id, parent_id, name, color, icon, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertFolder.run(folderFallId, userId, null, 'Mga Lektura sa Taglagas 2026', '#1D4ED8', 'Folder', now, now);
  insertFolder.run(folderLabsId, userId, null, 'Mga Ulat sa Lab at Dayagram', '#2563EB', 'Folder', now, now);
  insertFolder.run(folderExamsId, userId, null, 'Paghahanda sa Midterm', '#0284C7', 'Folder', now, now);

  const csId = generateId();
  const bioId = generateId();
  const histId = generateId();

  const insertSubject = db.prepare(
    `INSERT INTO subjects (id, user_id, code, name, instructor, semester, color, icon, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertSubject.run(csId, userId, 'CS 301', 'Mga Algoritmo at Estruktura ng Datos', 'Dr. Elena Vance', 'Unang Semestre 2026', '#1D4ED8', 'Cpu', 1, now, now);
  insertSubject.run(bioId, userId, 'BIO 204', 'Biyolohiyang Selular at Molekular', 'Prof. Marcus Thorne', 'Unang Semestre 2026', '#2563EB', 'Microscope', 2, now, now);
  insertSubject.run(histId, userId, 'HIST 210', 'Kasaysayan ng Kaisipang Siyentipiko', 'Dr. Claire Bennett', 'Unang Semestre 2026', '#0284C7', 'Landmark', 3, now, now);

  const csNbId = generateId();
  const bioNbId = generateId();
  const histNbId = generateId();

  const insertNb = db.prepare(
    `INSERT INTO notebooks (id, user_id, subject_id, title, description, cover_color, accent_color, icon, default_paper_style, is_pinned, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertNb.run(csNbId, userId, csId, 'Kompendyo sa Lektura ng Algoritmo', 'Mga talang Cornell, patunay ng kompleksidad, at dayagram ng grapo', '#1E3A8A', '#60A5FA', 'Code2', 'cornell', 1, now, now);
  insertNb.run(bioNbId, userId, bioId, 'Lab at Dayagram sa Selula', 'Pormal na ulat sa lab, pagsusuri ng ensaym, at mga guhit ng organel', '#1E40AF', '#93C5FD', 'FlaskConical', 'lined', 1, now, now);
  insertNb.run(histNbId, userId, histId, 'Mga Sanaysay sa Rebolusyong Siyentipiko', 'Mga burador ng sanaysay, sipi mula sa pangunahing sanggunian, at balik-aral', '#0369A1', '#7DD3FC', 'ScrollText', 'plain', 0, now, now);

  // Note 1: Word-like Lab Report
  const labContentJson = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Ulat sa Laboratoryo 04: Kinetika ng Ensaym na Katalase' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Asignatura: ' },
          { type: 'text', text: 'BIO 204 — Biyolohiyang Selular at Molekular   |   ' },
          { type: 'text', marks: [{ type: 'bold' }], text: 'Katuwang sa Lab: ' },
          { type: 'text', text: 'Maya Lin' },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '1. Layunin at Hipotesis' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Tukuyin ang paunang bilis ng reaksyon (V₀) ng katalase sa iba’t ibang konsentrasyon ng hydrogen peroxide (H₂O₂) at tantiyahin ang Vmax at Km gamit ang pagguhit ng Lineweaver-Burk.',
          },
        ],
      },
      {
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                marks: [{ type: 'italic' }],
                text: 'Hipotesis: Tumataas ang bilis ng reaksyon kasabay ng konsentrasyon ng substrate hanggang mapuno ang mga aktibong bahagi ng ensaym sa Vmax.',
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '2. Datos ng Eksperimental na Pagsubok' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: '[H₂O₂] (mM)' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pagsubok 1 Bilis ng O₂ (mL/s)' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pagsubok 2 Bilis ng O₂ (mL/s)' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Katamtamang V₀ (mL/s)' }] }] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '5.0' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '0.41' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '0.43' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '0.42' }] }] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '15.0' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '0.96' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1.00' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '0.98' }] }] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '40.0' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1.48' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1.52' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1.50' }] }] },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '3. Talaan ng Isusumite sa Laboratoryo' }],
      },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: true },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'I-calibrate ang dissolved oxygen sensor bago ang Pagsubok 1' }] }],
          },
          {
            type: 'taskItem',
            attrs: { checked: true },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Kuwentahin ang slope ng Lineweaver-Burk (Km / Vmax)' }] }],
          },
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ilakip ang graph ng error bar at i-export ang PDF para sa pasahan sa Biyernes' }] }],
          },
        ],
      },
    ],
  });

  const labHtml = `<h1>Ulat sa Laboratoryo 04: Kinetika ng Ensaym na Katalase</h1><p><strong>Asignatura: </strong>BIO 204 — Biyolohiyang Selular at Molekular | <strong>Katuwang sa Lab: </strong>Maya Lin</p><h2>1. Layunin at Hipotesis</h2><p>Tukuyin ang paunang bilis ng reaksyon (V₀) ng katalase sa iba’t ibang konsentrasyon ng hydrogen peroxide (H₂O₂) at tantiyahin ang Vmax at Km gamit ang pagguhit ng Lineweaver-Burk.</p>`;
  const labPlain = extractPlainTextFromTipTap(labContentJson);

  // Note 2: Cornell Notebook + Vector Ink Graph Sketch
  const csContentJson = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Paglalakbay sa Grapo: BFS kumpara sa DFS at Pinakamaikling Daan ni Dijkstra' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Breadth-First Search (BFS): ' },
          { type: 'text', text: 'Sinusuri ang grapo nang bawat antas gamit ang FIFO queue. Tinitiyak nito ang pinakamaikling daang walang timbang sa oras na O(V + E).' },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Depth-First Search (DFS): ' },
          { type: 'text', text: 'Pumapasok nang pinakamalalim hangga’t maaari gamit ang recursion o stack bago bumalik. Kapaki-pakinabang sa topological sort at pagtuklas ng cycle.' },
        ],
      },
      {
        type: 'codeBlock',
        content: [
          {
            type: 'text',
            text: 'function bfs(adj, start) {\n  const dist = new Map([[start, 0]]);\n  const q = [start];\n  while (q.length) {\n    const u = q.shift();\n    for (const v of adj.get(u) ?? []) {\n      if (!dist.has(v)) {\n        dist.set(v, dist.get(u) + 1);\n        q.push(v);\n      }\n    }\n  }\n  return dist;\n}',
          },
        ],
      },
    ],
  });
  const csPlain = extractPlainTextFromTipTap(csContentJson);
  const csCues = 'BFS kumpara sa DFS?\n\nKompleksidad sa Oras?\n\nKailan nabibigo si Dijkstra?\n\nTopological Sort?';
  const csSummary = 'Gumagamit ang BFS ng queue para sa pinakamaikling daan sa O(V+E). Ang DFS ay gumagamit ng stack/recursion. Ang Dijkstra ay gumagamit ng min-heap para sa hindi negatibong timbang sa O((V+E) log V).';

  const csDrawingData = JSON.stringify({
    version: 1,
    background: 'transparent',
    strokes: [
      {
        id: 'st-1',
        tool: 'highlighter',
        color: '#BFDBFE',
        width: 14,
        opacity: 0.5,
        points: [
          { x: 90, y: 156, p: 0.5 },
          { x: 260, y: 156, p: 0.5 },
          { x: 430, y: 156, p: 0.5 },
        ],
      },
    ],
    shapes: [
      { id: 'sh-1', kind: 'circle', x1: 520, y1: 110, x2: 572, y2: 162, color: '#1D4ED8', width: 2.5, opacity: 1 },
      { id: 'sh-2', kind: 'circle', x1: 635, y1: 75, x2: 687, y2: 127, color: '#2563EB', width: 2.5, opacity: 1 },
      { id: 'sh-3', kind: 'circle', x1: 635, y1: 165, x2: 687, y2: 217, color: '#0284C7', width: 2.5, opacity: 1 },
      { id: 'sh-4', kind: 'arrow', x1: 572, y1: 128, x2: 634, y2: 102, color: '#1E3A8A', width: 2.2, opacity: 1 },
      { id: 'sh-5', kind: 'arrow', x1: 572, y1: 146, x2: 634, y2: 186, color: '#1E3A8A', width: 2.2, opacity: 1 },
    ],
    texts: [
      { id: 'tx-1', x: 540, y: 142, text: 'A', color: '#1D4ED8', fontSize: 16 },
      { id: 'tx-2', x: 655, y: 107, text: 'B', color: '#1D4ED8', fontSize: 16 },
      { id: 'tx-3', x: 655, y: 197, text: 'C', color: '#1D4ED8', fontSize: 16 },
    ],
  });

  // Note 3: Drawing Pad Cell Diagram
  const cellDrawingData = JSON.stringify({
    version: 1,
    background: 'grid',
    strokes: [
      {
        id: 'cell-mem-1',
        tool: 'pen',
        color: '#2563EB',
        width: 3,
        opacity: 1,
        points: [
          { x: 180, y: 240, p: 0.6 },
          { x: 210, y: 130, p: 0.6 },
          { x: 350, y: 95, p: 0.6 },
          { x: 520, y: 115, p: 0.6 },
          { x: 600, y: 230, p: 0.6 },
          { x: 560, y: 360, p: 0.6 },
          { x: 410, y: 405, p: 0.6 },
          { x: 240, y: 375, p: 0.6 },
          { x: 180, y: 240, p: 0.6 },
        ],
      },
    ],
    shapes: [
      { id: 'nuc-1', kind: 'circle', x1: 310, y1: 185, x2: 430, y2: 305, color: '#1D4ED8', width: 3, opacity: 1 },
      { id: 'nuc-2', kind: 'circle', x1: 350, y1: 225, x2: 390, y2: 265, color: '#3B82F6', width: 2, opacity: 0.85 },
      { id: 'mito-1', kind: 'circle', x1: 465, y1: 175, x2: 535, y2: 220, color: '#0284C7', width: 2.5, opacity: 1 },
      { id: 'arr-1', kind: 'arrow', x1: 115, y1: 185, x2: 195, y2: 185, color: '#334155', width: 2, opacity: 1 },
      { id: 'arr-2', kind: 'arrow', x1: 370, y1: 130, x2: 370, y2: 182, color: '#1D4ED8', width: 2, opacity: 1 },
      { id: 'arr-3', kind: 'arrow', x1: 585, y1: 155, x2: 525, y2: 185, color: '#2563EB', width: 2, opacity: 1 },
    ],
    texts: [
      { id: 'lbl-0', x: 225, y: 65, text: 'Estruktura ng Selulang Eukaryotiko', color: '#1E3A8A', fontSize: 20 },
      { id: 'lbl-1', x: 24, y: 188, text: 'Lamad ng Plasma', color: '#2563EB', fontSize: 14 },
      { id: 'lbl-2', x: 322, y: 122, text: 'Nukleus at Nukleolus', color: '#1D4ED8', fontSize: 14 },
      { id: 'lbl-3', x: 560, y: 148, text: 'Mitokondriya (ATP)', color: '#2563EB', fontSize: 14 },
    ],
  });

  // Note 4: History Essay Draft
  const histContentJson = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Mula sa Mekanikang Relos Patungong Estadistikal na Pisika' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Hinamon ng termodinamika noong ikalabinsiyam na siglo ang mahigpit na deterministikong pananaw ni Newton sa pamamagitan ng pagpapakilala ng entropiya at probabilidad.',
          },
        ],
      },
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sadi Carnot (1824): hangganan ng kahusayan ng makina ng init' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rudolf Clausius (1865): pormalisasyon ng entropiya S at Ikalawang Batas' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ludwig Boltzmann (1877): ugnayang estadistikal na S = k ln W' }] }] },
        ],
      },
    ],
  });
  const histPlain = extractPlainTextFromTipTap(histContentJson);

  const insertNote = db.prepare(
    `INSERT INTO notes (
      id, user_id, folder_id, notebook_id, subject_id, title, description, category, mode, paper_style, paper_bg_color, page_size,
      content_json, content_html, plain_text, cornell_cues, cornell_summary,
      drawing_data, tags_json, word_count, is_pinned, is_starred, is_trashed, last_opened_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
  );

  const note1Id = generateId();
  const note2Id = generateId();
  const note3Id = generateId();
  const note4Id = generateId();

  insertNote.run(
    note1Id, userId, folderLabsId, bioNbId, bioId,
    'Ulat sa Lab 04: Kinetika ng Ensaym na Katalase',
    'Mga sukat ng bilis ng reaksyon at pagsusuring Lineweaver-Burk para sa BIO 204.',
    'Ulat sa Lab',
    'document', 'plain', '', 'a4',
    labContentJson, labHtml, labPlain, '', '',
    JSON.stringify({ version: 1, strokes: [], shapes: [], texts: [], background: 'transparent' }),
    JSON.stringify(['ulat-sa-lab', 'biokimika', 'kinetika']),
    countWords(labPlain), 1, 1, isoOffset(-1), isoOffset(-18), isoOffset(-2)
  );

  insertNote.run(
    note2Id, userId, folderFallId, csNbId, csId,
    'Lektura 08: Paglalakbay sa Grapo (BFS, DFS at Dijkstra)',
    'Mga gabay na tanong sa Cornell, pseudocode, at guhit ng grapo para sa CS 301.',
    'Mga Tala sa Lektura',
    'notebook', 'cornell', '#F8FAFC', 'a4',
    csContentJson, '', csPlain, csCues, csSummary,
    csDrawingData,
    JSON.stringify(['algoritmo', 'grapo', 'midterm']),
    countWords(csPlain), 1, 1, isoOffset(-3), isoOffset(-30), isoOffset(-5)
  );

  insertNote.run(
    note3Id, userId, folderLabsId, bioNbId, bioId,
    'Guhit ng mga Organel ng Selulang Eukaryotiko',
    'Guhit-kamay na sanggunian para sa lamad, nukleus, at mitokondriya.',
    'Gabay sa Pag-aaral',
    'drawing', 'grid', '#EFF6FF', 'fluid',
    JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Biswal na sanggunian para sa Kabanata 4: Estruktura ng Organel.' }] }] }),
    '<p>Biswal na sanggunian para sa Kabanata 4: Estruktura ng Organel.</p>',
    'Biswal na sanggunian para sa Kabanata 4: Estruktura ng Organel.',
    '', '',
    cellDrawingData,
    JSON.stringify(['dayagram', 'biyolohiya', 'guhit']),
    8, 0, 1, isoOffset(-4), isoOffset(-48), isoOffset(-10)
  );

  insertNote.run(
    note4Id, userId, folderExamsId, histNbId, histId,
    'Sanaysay sa Midterm: Termodinamika at Determinismo',
    'Balangkas at mga pangunahing sanggunian mula kay Carnot hanggang kay Boltzmann.',
    'Sanaysay',
    'document', 'plain', '#FFFFFF', 'letter',
    histContentJson, '', histPlain, '', '',
    JSON.stringify({ version: 1, strokes: [], shapes: [], texts: [], background: 'transparent' }),
    JSON.stringify(['sanaysay', 'termodinamika']),
    countWords(histPlain), 0, 0, isoOffset(-12), isoOffset(-72), isoOffset(-24)
  );

  syncNoteFts(db, { id: note1Id, user_id: userId, title: 'Ulat sa Lab 04: Kinetika ng Ensaym na Katalase', description: 'Mga sukat ng bilis ng reaksyon at pagsusuring Lineweaver-Burk para sa BIO 204.', category: 'Ulat sa Lab', plain_text: labPlain, cornell_cues: '', cornell_summary: '', tags_json: '["ulat-sa-lab","biokimika","kinetika"]', is_trashed: 0 });
  syncNoteFts(db, { id: note2Id, user_id: userId, title: 'Lektura 08: Paglalakbay sa Grapo (BFS, DFS at Dijkstra)', description: 'Mga gabay na tanong sa Cornell, pseudocode, at guhit ng grapo para sa CS 301.', category: 'Mga Tala sa Lektura', plain_text: csPlain, cornell_cues: csCues, cornell_summary: csSummary, tags_json: '["algoritmo","grapo","midterm"]', is_trashed: 0 });
  syncNoteFts(db, { id: note3Id, user_id: userId, title: 'Guhit ng mga Organel ng Selulang Eukaryotiko', description: 'Guhit-kamay na sanggunian para sa lamad, nukleus, at mitokondriya.', category: 'Gabay sa Pag-aaral', plain_text: 'Biswal na sanggunian para sa Kabanata 4: Estruktura ng Organel.', cornell_cues: '', cornell_summary: '', tags_json: '["dayagram","biyolohiya","guhit"]', is_trashed: 0 });
  syncNoteFts(db, { id: note4Id, user_id: userId, title: 'Sanaysay sa Midterm: Termodinamika at Determinismo', description: 'Balangkas at mga pangunahing sanggunian mula kay Carnot hanggang kay Boltzmann.', category: 'Sanaysay', plain_text: histPlain, cornell_cues: '', cornell_summary: '', tags_json: '["sanaysay","termodinamika"]', is_trashed: 0 });

  db.prepare(
    `INSERT INTO note_versions (id, note_id, user_id, label, title, mode, paper_style, content_json, content_html, cornell_cues, cornell_summary, drawing_data, word_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    generateId(), note1Id, userId, 'Paunang Burador sa Lab',
    'Ulat sa Lab 04: Kinetika ng Ensaym na Katalase', 'document', 'plain',
    labContentJson, labHtml, '', '',
    JSON.stringify({ version: 1, strokes: [], shapes: [], texts: [], background: 'transparent' }),
    countWords(labPlain), isoOffset(-12)
  );

  const insertTask = db.prepare(
    `INSERT INTO study_tasks (id, user_id, subject_id, note_id, title, description, due_date, priority, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertTask.run(generateId(), userId, bioId, note1Id, 'Tapusin ang PDF ng Ulat sa Kinetika ng Ensaym', 'Iguhit ang graph ng Lineweaver-Burk at ilakip ang pagsusuri ng error', isoOffset(36), 'high', 'in_progress', now, now);
  insertTask.run(generateId(), userId, csId, note2Id, 'Ipatupad ang Dijkstra gamit ang Binary Min-Heap', 'Pagsasanay #5 sa CS 301', isoOffset(60), 'high', 'todo', now, now);
  insertTask.run(generateId(), userId, histId, note4Id, 'Balangkasin ang mga Sipi mula kay Boltzmann', 'Suriin ang mga pahina 112–135 ng babasahin sa kurso', isoOffset(96), 'medium', 'todo', now, now);
  insertTask.run(generateId(), userId, bioId, note3Id, 'Balik-aralin ang Dayagram ng Mitosis at Meiosis', 'Magsanay gamit ang mga flashcard ng organel', isoOffset(-12), 'low', 'done', now, now);

  const insertCard = db.prepare(
    `INSERT INTO flashcards (id, user_id, subject_id, notebook_id, note_id, front, back, confidence, review_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertCard.run(generateId(), userId, csId, csNbId, note2Id, 'Ano ang time complexity ng BFS sa isang adjacency-list graph?', 'O(V + E), kung saan V ang mga vertex at E ang mga edge.', 4, 3, now);
  insertCard.run(generateId(), userId, csId, csNbId, note2Id, 'Bakit nangangailangan ang algoritmo ni Dijkstra ng mga hindi negatibong timbang?', 'Kapag nailabas na ang isang vertex sa min-heap, ipinapalagay na wala nang mas maikling daan; sinisira ito ng mga negatibong edge.', 3, 2, now);
  insertCard.run(generateId(), userId, bioId, bioNbId, note1Id, 'Ano ang kinakatawan ng Km sa kinetika ng Michaelis-Menten?', 'Ang konsentrasyon ng substrate kung saan kalahati ng Vmax ang bilis ng reaksyon; ang mas mababang Km ay nangangahulugang mas malakas ang pagkapit ng ensaym.', 4, 4, now);
  insertCard.run(generateId(), userId, bioId, bioNbId, note3Id, 'Aling organel ang naglalaman ng citric acid cycle at ATP synthase?', 'Mitokondriya (matrix at panloob na lamad ng cristae).', 5, 5, now);

  const insertSession = db.prepare(
    `INSERT INTO study_sessions (id, user_id, subject_id, note_id, duration_minutes, mode, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  insertSession.run(generateId(), userId, csId, note2Id, 25, 'focus', isoOffset(-6));
  insertSession.run(generateId(), userId, bioId, note1Id, 45, 'focus', isoOffset(-2));

  // Sample realistic additional student accounts (active & suspended) + an open concern so the Admin Dashboard shows rich realistic data out of the box!
  const samId = generateId();
  const jordanId = generateId();
  const insertExtraStudent = db.prepare(
    `INSERT INTO users (
      id, email, email_verified, password_hash, role, status, status_reason, full_name, university,
      major, academic_year, bio, theme_preference, workspace_accent, is_demo,
      last_login_at, login_count, created_at, updated_at
    ) VALUES (?, ?, 1, ?, 'student', ?, ?, ?, ?, ?, ?, '', 'light', 'blue', 0, ?, ?, ?, ?)`
  );

  insertExtraStudent.run(
    samId,
    'samantha.lee.demo@gmail.com',
    hashPassword('StudentDemo2026!'),
    'active',
    '',
    'Samantha Lee',
    'Bridgewater State University',
    'Inhinyeriyang Biyomedikal',
    'Ikalawang Taon (Sophomore)',
    isoOffset(-8),
    12,
    isoOffset(-190),
    now
  );

  insertExtraStudent.run(
    jordanId,
    'jordan.patel.demo@gmail.com',
    hashPassword('StudentDemo2026!'),
    'suspended',
    'Pansamantalang suspensyon habang hinihintay ang beripikasyon ng email',
    'Jordan Patel',
    'Bridgewater State University',
    'Aplikadong Matematika',
    'Ikaapat na Taon (Senior)',
    isoOffset(-96),
    3,
    isoOffset(-310),
    now
  );

  db.prepare(
    `INSERT INTO account_concerns (id, user_id, email, subject, category, message, status, admin_note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', '', ?, ?)`
  ).run(
    generateId(),
    jordanId,
    'jordan.patel.demo@gmail.com',
    'Kahilingan para sa muling pag-aktibo matapos mag-update ng ID ng mag-aaral',
    'account_access',
    'Magandang araw Admin, naberipika ko na ang aking Gmail address. Maaari bang paki-activate muli ang aking INKORA account bago ang finals?',
    isoOffset(-14),
    isoOffset(-14)
  );

  return userId;
}

export function seedStarterWorkspaceForNewUser(db: DatabaseSync, userId: string): void {
  const now = new Date().toISOString();
  const folderId = generateId();
  const subjectId = generateId();
  const notebookId = generateId();
  const noteId = generateId();

  db.prepare(
    `INSERT INTO folders (id, user_id, parent_id, name, color, icon, created_at, updated_at)
     VALUES (?, ?, NULL, 'Pagsisimula', '#2563EB', 'Folder', ?, ?)`
  ).run(folderId, userId, now, now);

  db.prepare(
    `INSERT INTO subjects (id, user_id, code, name, instructor, semester, color, icon, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(subjectId, userId, 'STUDY 101', 'Pangkalahatang mga Tala', '', 'Kasalukuyang Semestre', '#1D4ED8', 'GraduationCap', now, now);

  db.prepare(
    `INSERT INTO notebooks (id, user_id, subject_id, title, description, cover_color, accent_color, icon, default_paper_style, is_pinned, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(notebookId, userId, subjectId, 'Aking Unang Kuwaderno', 'Magsulat ng mga dokumento, talang Cornell, at mga guhit dito', '#1E3A8A', '#60A5FA', 'NotebookPen', 'lined', now, now);

  const welcomeJson = JSON.stringify({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Maligayang Pagdating sa INKORA' }] },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Iyong mga Ideya. Iyong Espasyo. Iyong Tinta. Gamitin ang tagapagpalit ng studio sa itaas upang lumipat sa Dokumento (pag-format na parang Word, mga talahanayan, checklist), Kuwaderno (gabay na Cornell, linyado o grid na papel, at tinta), Guhit-kamay, o Hatiing Studio.',
          },
        ],
      },
      {
        type: 'taskList',
        content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ayusin ang mga tala sa mga Folder, Asignatura, o Kuwaderno' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Subukang gumuhit ng mga dayagram sa Guhit-kamay o Split mode' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mag-upload ng mga PDF o slide ng klase sa iyong Baul ng File' }] }] },
        ],
      },
    ],
  });

  const plain = extractPlainTextFromTipTap(welcomeJson);

  db.prepare(
    `INSERT INTO notes (
      id, user_id, folder_id, notebook_id, subject_id, title, description, category, mode, paper_style, paper_bg_color, page_size,
      content_json, content_html, plain_text, cornell_cues, cornell_summary,
      drawing_data, tags_json, word_count, is_pinned, is_starred, is_trashed, last_opened_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pagsisimula', 'document', 'plain', '', 'a4', ?, '', ?, '', '', ?, '["pagsisimula"]', ?, 1, 0, 0, ?, ?, ?)`
  ).run(
    noteId, userId, folderId, notebookId, subjectId, 'Maligayang Pagdating sa INKORA',
    'Maikling gabay tungkol sa mga dokumento, digital na kuwaderno, pagguhit, at lagayan ng file.',
    welcomeJson, plain,
    JSON.stringify({ version: 1, strokes: [], shapes: [], texts: [], background: 'transparent' }),
    countWords(plain), now, now, now
  );

  syncNoteFts(db, {
    id: noteId,
    user_id: userId,
    title: 'Maligayang Pagdating sa INKORA',
    description: 'Maikling gabay tungkol sa mga dokumento, digital na kuwaderno, pagguhit, at lagayan ng file.',
    category: 'Pagsisimula',
    plain_text: plain,
    cornell_cues: '',
    cornell_summary: '',
    tags_json: '["pagsisimula"]',
    is_trashed: 0,
  });
}
