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
    ) VALUES (?, ?, 1, ?, 'admin', 'active', '', ?, ?, ?, ?, ?, 'light', 'purple', 0, ?, 0, ?, ?)`
  ).run(
    adminId,
    ADMIN_EMAIL,
    passwordHash,
    'INKORA Administrator',
    'INKORA Platform Operations',
    'System Administration',
    'Staff',
    'Platform administrator overseeing student account health, access control, and account concerns.',
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
    ) VALUES (?, ?, 1, ?, 'student', 'active', '', ?, ?, ?, ?, ?, 'light', 'purple', 1, ?, 4, ?, ?)`
  ).run(
    userId,
    DEMO_EMAIL,
    passwordHash,
    'Alex Rivera',
    'Bridgewater State University',
    'Computer Science & Bioinformatics',
    'Junior (Year 3)',
    'Honors student organizing lecture notes, lab reports, and algorithm sketches in INKORA.',
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
  insertFolder.run(folderFallId, userId, null, 'Fall 2026 Lectures', '#6D28D9', 'Folder', now, now);
  insertFolder.run(folderLabsId, userId, null, 'Lab Reports & Diagrams', '#3B82F6', 'Folder', now, now);
  insertFolder.run(folderExamsId, userId, null, 'Midterm Prep', '#8B5CF6', 'Folder', now, now);

  const csId = generateId();
  const bioId = generateId();
  const histId = generateId();

  const insertSubject = db.prepare(
    `INSERT INTO subjects (id, user_id, code, name, instructor, semester, color, icon, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertSubject.run(csId, userId, 'CS 301', 'Algorithms & Data Structures', 'Dr. Elena Vance', 'Fall 2026', '#6D28D9', 'Cpu', 1, now, now);
  insertSubject.run(bioId, userId, 'BIO 204', 'Cellular & Molecular Biology', 'Prof. Marcus Thorne', 'Fall 2026', '#2563EB', 'Microscope', 2, now, now);
  insertSubject.run(histId, userId, 'HIST 210', 'History of Scientific Thought', 'Dr. Claire Bennett', 'Fall 2026', '#8B5CF6', 'Landmark', 3, now, now);

  const csNbId = generateId();
  const bioNbId = generateId();
  const histNbId = generateId();

  const insertNb = db.prepare(
    `INSERT INTO notebooks (id, user_id, subject_id, title, description, cover_color, accent_color, icon, default_paper_style, is_pinned, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertNb.run(csNbId, userId, csId, 'Algorithms Lecture Compendium', 'Cornell notes, complexity proofs, and graph diagrams', '#4C1D95', '#A78BFA', 'Code2', 'cornell', 1, now, now);
  insertNb.run(bioNbId, userId, bioId, 'Cell Bio Lab & Diagrams', 'Formal lab reports, enzyme assays, and organelle sketches', '#1E40AF', '#60A5FA', 'FlaskConical', 'lined', 1, now, now);
  insertNb.run(histNbId, userId, histId, 'Scientific Revolutions Essays', 'Draft essays, primary source quotes, and midterm review', '#5B21B6', '#C4B5FD', 'ScrollText', 'plain', 0, now, now);

  // Note 1: Word-like Lab Report
  const labContentJson = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Lab Report 04: Catalase Enzyme Kinetics Assay' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Course: ' },
          { type: 'text', text: 'BIO 204 — Cellular & Molecular Biology   |   ' },
          { type: 'text', marks: [{ type: 'bold' }], text: 'Lab Partner: ' },
          { type: 'text', text: 'Maya Lin' },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '1. Objective & Hypothesis' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Determine the initial reaction velocity (V₀) of bovine liver catalase across varying hydrogen peroxide (H₂O₂) concentrations and estimate Vmax and Km using Lineweaver-Burk double-reciprocal linearization.',
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
                text: 'Hypothesis: Reaction velocity increases hyperbolically with substrate concentration until enzyme active sites saturate at Vmax.',
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '2. Experimental Trial Data' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: '[H₂O₂] (mM)' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Trial 1 O₂ Rate (mL/s)' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Trial 2 O₂ Rate (mL/s)' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mean V₀ (mL/s)' }] }] },
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
        content: [{ type: 'text', text: '3. Lab Submission Checklist' }],
      },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: true },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Calibrate dissolved oxygen sensor before Trial 1' }] }],
          },
          {
            type: 'taskItem',
            attrs: { checked: true },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Compute Lineweaver-Burk slope (Km / Vmax)' }] }],
          },
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Attach error bar plot and export PDF for Friday submission' }] }],
          },
        ],
      },
    ],
  });

  const labHtml = `<h1>Lab Report 04: Catalase Enzyme Kinetics Assay</h1><p><strong>Course: </strong>BIO 204 — Cellular &amp; Molecular Biology | <strong>Lab Partner: </strong>Maya Lin</p><h2>1. Objective &amp; Hypothesis</h2><p>Determine the initial reaction velocity (V₀) of bovine liver catalase across varying hydrogen peroxide (H₂O₂) concentrations and estimate Vmax and Km using Lineweaver-Burk double-reciprocal linearization.</p>`;
  const labPlain = extractPlainTextFromTipTap(labContentJson);

  // Note 2: Cornell Notebook + Vector Ink Graph Sketch
  const csContentJson = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Graph Traversal: BFS vs. DFS & Dijkstra Shortest Path' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Breadth-First Search (BFS): ' },
          { type: 'text', text: 'Explores graph level-by-level using a FIFO queue. Guarantees shortest unweighted path in O(V + E) time.' },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Depth-First Search (DFS): ' },
          { type: 'text', text: 'Explores as deep as possible via recursion or stack before backtracking. Useful for topological sort, cycle detection, and strongly connected components.' },
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
  const csCues = 'BFS vs DFS?\n\nTime Complexity?\n\nWhen does Dijkstra fail?\n\nTopological Sort?';
  const csSummary = 'BFS uses a queue for unweighted shortest paths in O(V+E). DFS uses a stack/recursion for structural properties. Dijkstra uses a min-heap for non-negative edge weights in O((V+E) log V).';

  const csDrawingData = JSON.stringify({
    version: 1,
    background: 'transparent',
    strokes: [
      {
        id: 'st-1',
        tool: 'highlighter',
        color: '#DDD6FE',
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
      { id: 'sh-1', kind: 'circle', x1: 520, y1: 110, x2: 572, y2: 162, color: '#6D28D9', width: 2.5, opacity: 1 },
      { id: 'sh-2', kind: 'circle', x1: 635, y1: 75, x2: 687, y2: 127, color: '#6D28D9', width: 2.5, opacity: 1 },
      { id: 'sh-3', kind: 'circle', x1: 635, y1: 165, x2: 687, y2: 217, color: '#6D28D9', width: 2.5, opacity: 1 },
      { id: 'sh-4', kind: 'arrow', x1: 572, y1: 128, x2: 634, y2: 102, color: '#1E1B4B', width: 2.2, opacity: 1 },
      { id: 'sh-5', kind: 'arrow', x1: 572, y1: 146, x2: 634, y2: 186, color: '#1E1B4B', width: 2.2, opacity: 1 },
    ],
    texts: [
      { id: 'tx-1', x: 540, y: 142, text: 'A', color: '#6D28D9', fontSize: 16 },
      { id: 'tx-2', x: 655, y: 107, text: 'B', color: '#6D28D9', fontSize: 16 },
      { id: 'tx-3', x: 655, y: 197, text: 'C', color: '#6D28D9', fontSize: 16 },
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
      { id: 'nuc-1', kind: 'circle', x1: 310, y1: 185, x2: 430, y2: 305, color: '#6D28D9', width: 3, opacity: 1 },
      { id: 'nuc-2', kind: 'circle', x1: 350, y1: 225, x2: 390, y2: 265, color: '#8B5CF6', width: 2, opacity: 0.85 },
      { id: 'mito-1', kind: 'circle', x1: 465, y1: 175, x2: 535, y2: 220, color: '#3B82F6', width: 2.5, opacity: 1 },
      { id: 'arr-1', kind: 'arrow', x1: 115, y1: 185, x2: 195, y2: 185, color: '#334155', width: 2, opacity: 1 },
      { id: 'arr-2', kind: 'arrow', x1: 370, y1: 130, x2: 370, y2: 182, color: '#6D28D9', width: 2, opacity: 1 },
      { id: 'arr-3', kind: 'arrow', x1: 585, y1: 155, x2: 525, y2: 185, color: '#2563EB', width: 2, opacity: 1 },
    ],
    texts: [
      { id: 'lbl-0', x: 245, y: 65, text: 'Eukaryotic Cell Cross-Section', color: '#1E1B4B', fontSize: 20 },
      { id: 'lbl-1', x: 24, y: 188, text: 'Plasma Membrane', color: '#2563EB', fontSize: 14 },
      { id: 'lbl-2', x: 328, y: 122, text: 'Nucleus & Nucleolus', color: '#6D28D9', fontSize: 14 },
      { id: 'lbl-3', x: 560, y: 148, text: 'Mitochondrion (ATP)', color: '#2563EB', fontSize: 14 },
    ],
  });

  // Note 4: History Essay Draft
  const histContentJson = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'From Clockwork Mechanics to Statistical Physics' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Nineteenth-century thermodynamics challenged the strictly deterministic Newtonian cosmos by introducing irreversibility, entropy, and probabilistic ensembles.',
          },
        ],
      },
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sadi Carnot (1824): idealized heat engine efficiency limits' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rudolf Clausius (1865): formalization of entropy S and the Second Law' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ludwig Boltzmann (1877): statistical bridge S = k ln W' }] }] },
        ],
      },
    ],
  });
  const histPlain = extractPlainTextFromTipTap(histContentJson);

  const insertNote = db.prepare(
    `INSERT INTO notes (
      id, user_id, folder_id, notebook_id, subject_id, title, mode, paper_style, page_size,
      content_json, content_html, plain_text, cornell_cues, cornell_summary,
      drawing_data, tags_json, word_count, is_pinned, is_starred, is_trashed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  );

  const note1Id = generateId();
  const note2Id = generateId();
  const note3Id = generateId();
  const note4Id = generateId();

  insertNote.run(
    note1Id, userId, folderLabsId, bioNbId, bioId,
    'Lab Report 04: Catalase Enzyme Kinetics',
    'document', 'plain', 'a4',
    labContentJson, labHtml, labPlain, '', '',
    JSON.stringify({ version: 1, strokes: [], shapes: [], texts: [], background: 'transparent' }),
    JSON.stringify(['lab-report', 'biochem', 'kinetics']),
    countWords(labPlain), 1, 1, isoOffset(-18), isoOffset(-2)
  );

  insertNote.run(
    note2Id, userId, folderFallId, csNbId, csId,
    'Lecture 08: Graph Traversal (BFS, DFS & Dijkstra)',
    'notebook', 'cornell', 'a4',
    csContentJson, '', csPlain, csCues, csSummary,
    csDrawingData,
    JSON.stringify(['algorithms', 'graphs', 'midterm']),
    countWords(csPlain), 1, 1, isoOffset(-30), isoOffset(-5)
  );

  insertNote.run(
    note3Id, userId, folderLabsId, bioNbId, bioId,
    'Eukaryotic Cell Organelle Sketch',
    'drawing', 'grid', 'fluid',
    JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Visual reference sketch for Chapter 4 Organelle Structure.' }] }] }),
    '<p>Visual reference sketch for Chapter 4 Organelle Structure.</p>',
    'Visual reference sketch for Chapter 4 Organelle Structure.',
    '', '',
    cellDrawingData,
    JSON.stringify(['diagram', 'cell-biology', 'sketch']),
    8, 0, 1, isoOffset(-48), isoOffset(-10)
  );

  insertNote.run(
    note4Id, userId, folderExamsId, histNbId, histId,
    'Midterm Essay: Thermodynamics & Determinism',
    'document', 'plain', 'letter',
    histContentJson, '', histPlain, '', '',
    JSON.stringify({ version: 1, strokes: [], shapes: [], texts: [], background: 'transparent' }),
    JSON.stringify(['essay', 'thermodynamics']),
    countWords(histPlain), 0, 0, isoOffset(-72), isoOffset(-24)
  );

  syncNoteFts(db, { id: note1Id, user_id: userId, title: 'Lab Report 04: Catalase Enzyme Kinetics', plain_text: labPlain, cornell_cues: '', cornell_summary: '', tags_json: '["lab-report","biochem","kinetics"]', is_trashed: 0 });
  syncNoteFts(db, { id: note2Id, user_id: userId, title: 'Lecture 08: Graph Traversal (BFS, DFS & Dijkstra)', plain_text: csPlain, cornell_cues: csCues, cornell_summary: csSummary, tags_json: '["algorithms","graphs","midterm"]', is_trashed: 0 });
  syncNoteFts(db, { id: note3Id, user_id: userId, title: 'Eukaryotic Cell Organelle Sketch', plain_text: 'Visual reference sketch for Chapter 4 Organelle Structure.', cornell_cues: '', cornell_summary: '', tags_json: '["diagram","cell-biology","sketch"]', is_trashed: 0 });
  syncNoteFts(db, { id: note4Id, user_id: userId, title: 'Midterm Essay: Thermodynamics & Determinism', plain_text: histPlain, cornell_cues: '', cornell_summary: '', tags_json: '["essay","thermodynamics"]', is_trashed: 0 });

  db.prepare(
    `INSERT INTO note_versions (id, note_id, user_id, label, title, mode, paper_style, content_json, content_html, cornell_cues, cornell_summary, drawing_data, word_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    generateId(), note1Id, userId, 'Initial Lab Draft',
    'Lab Report 04: Catalase Enzyme Kinetics', 'document', 'plain',
    labContentJson, labHtml, '', '',
    JSON.stringify({ version: 1, strokes: [], shapes: [], texts: [], background: 'transparent' }),
    countWords(labPlain), isoOffset(-12)
  );

  const insertTask = db.prepare(
    `INSERT INTO study_tasks (id, user_id, subject_id, note_id, title, description, due_date, priority, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertTask.run(generateId(), userId, bioId, note1Id, 'Finalize Enzyme Kinetics Lab Report PDF', 'Plot Lineweaver-Burk graph and attach error analysis', isoOffset(36), 'high', 'in_progress', now, now);
  insertTask.run(generateId(), userId, csId, note2Id, 'Implement Dijkstra with Binary Min-Heap', 'Practice problem set #5 in CS 301', isoOffset(60), 'high', 'todo', now, now);
  insertTask.run(generateId(), userId, histId, note4Id, 'Outline Boltzmann Primary Source Citations', 'Check pages 112-135 of syllabus reader', isoOffset(96), 'medium', 'todo', now, now);
  insertTask.run(generateId(), userId, bioId, note3Id, 'Review Mitosis vs Meiosis Checkpoint Diagram', 'Self-quiz using organelle flashcards', isoOffset(-12), 'low', 'done', now, now);

  const insertCard = db.prepare(
    `INSERT INTO flashcards (id, user_id, subject_id, notebook_id, note_id, front, back, confidence, review_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertCard.run(generateId(), userId, csId, csNbId, note2Id, 'What is the time complexity of BFS on an adjacency-list graph?', 'O(V + E), where V is vertices and E is edges.', 4, 3, now);
  insertCard.run(generateId(), userId, csId, csNbId, note2Id, 'Why does Dijkstra’s algorithm require non-negative edge weights?', 'Once a vertex is popped from the min-heap, it assumes no later path can reduce its distance; negative edges break this greedy invariant.', 3, 2, now);
  insertCard.run(generateId(), userId, bioId, bioNbId, note1Id, 'What does Km represent in Michaelis-Menten kinetics?', 'The substrate concentration at which reaction velocity is exactly half of Vmax (1/2 Vmax); lower Km indicates higher enzyme affinity.', 4, 4, now);
  insertCard.run(generateId(), userId, bioId, bioNbId, note3Id, 'Which organelle houses the citric acid cycle and ATP synthase?', 'Mitochondrion (matrix and inner mitochondrial cristae membrane).', 5, 5, now);

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
    ) VALUES (?, ?, 1, ?, 'student', ?, ?, ?, ?, ?, ?, '', 'light', 'purple', 0, ?, ?, ?, ?)`
  );

  insertExtraStudent.run(
    samId,
    'samantha.lee.demo@gmail.com',
    hashPassword('StudentDemo2026!'),
    'active',
    '',
    'Samantha Lee',
    'Bridgewater State University',
    'Biomedical Engineering',
    'Sophomore (Year 2)',
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
    'Temporary suspension pending email verification review',
    'Jordan Patel',
    'Bridgewater State University',
    'Applied Mathematics',
    'Senior (Year 4)',
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
    'Requesting reactivation after updating student ID',
    'account_access',
    'Hello Admin, I have verified my Gmail address. Could you reactivate my INKORA account ahead of finals?',
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
     VALUES (?, ?, NULL, 'Getting Started', '#6D28D9', 'Folder', ?, ?)`
  ).run(folderId, userId, now, now);

  db.prepare(
    `INSERT INTO subjects (id, user_id, code, name, instructor, semester, color, icon, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(subjectId, userId, 'STUDY 101', 'General Academic Notes', '', 'Current Term', '#6D28D9', 'GraduationCap', now, now);

  db.prepare(
    `INSERT INTO notebooks (id, user_id, subject_id, title, description, cover_color, accent_color, icon, default_paper_style, is_pinned, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(notebookId, userId, subjectId, 'My First Notebook', 'Write documents, Cornell lecture notes, and sketches here', '#4C1D95', '#A78BFA', 'NotebookPen', 'lined', now, now);

  const welcomeJson = JSON.stringify({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Welcome to INKORA' }] },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Your Thoughts. Your Space. Your Ink. Use the studio switcher above to move smoothly between Document mode (Word-style formatting, tables, checklists), Notebook mode (Cornell cues, lined/grid paper, and ink annotations), Drawing Pad, or Split Studio.',
          },
        ],
      },
      {
        type: 'taskList',
        content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Organize notes into Folders, Courses, or Notebooks' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Try sketching diagrams in Draw Pad or Split mode' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Upload PDFs or lecture slides to your File Vault' }] }] },
        ],
      },
    ],
  });

  const plain = extractPlainTextFromTipTap(welcomeJson);

  db.prepare(
    `INSERT INTO notes (
      id, user_id, folder_id, notebook_id, subject_id, title, mode, paper_style, page_size,
      content_json, content_html, plain_text, cornell_cues, cornell_summary,
      drawing_data, tags_json, word_count, is_pinned, is_starred, is_trashed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'document', 'plain', 'a4', ?, '', ?, '', '', ?, '["getting-started"]', ?, 1, 0, 0, ?, ?)`
  ).run(
    noteId, userId, folderId, notebookId, subjectId, 'Welcome to INKORA',
    welcomeJson, plain,
    JSON.stringify({ version: 1, strokes: [], shapes: [], texts: [], background: 'transparent' }),
    countWords(plain), now, now
  );

  syncNoteFts(db, {
    id: noteId,
    user_id: userId,
    title: 'Welcome to INKORA',
    plain_text: plain,
    cornell_cues: '',
    cornell_summary: '',
    tags_json: '["getting-started"]',
    is_trashed: 0,
  });
}
