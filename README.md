# INKORA — Smart Digital Notes & Student Workspace

**INKORA** is a full-stack academic digital notebook, drawing pad, and Word-style document editor built for students to write, organize, draw, edit, and store their academic work in one unified workspace.

## Core Capabilities

- **Word-Class Document Studio (TipTap)**
  - Multi-tab Ribbon (`Home`, `Insert`, `Page & Paper`, `Review & Export`)
  - Rich formatting: headings, fonts, bold/italic/underline/strike, sub/superscript, colors, highlighters, alignment, bulleted/numbered/task lists, resizable tables (`+Row`, `+Col`, delete), callout quotes, syntax code blocks, hyperlinks, embedded images, and **KaTeX mathematical equations**
  - Page widths (`A4`, `US Letter`, `Fluid`), zoom slider, Find & Replace, Print/Save PDF, HTML export, and Markdown export
- **Traditional Notebook & Ink Layer**
  - Realistic paper templates: **College Ruled**, **Wide Ruled**, **Dot Grid**, **Graph Grid**, **Cornell Notes** (Cues/Questions, Lecture Notes, Summary), **Blank Cream**, and **Chalkboard Grid**
  - Live transparent **Ink Annotation Layer** directly over notebook pages (annotate, circle, and highlight over typed notes)
- **Digital Drawing Pad & Split Studio**
  - Pressure-sensitive vector/canvas drawing engine: Ink Pen, Fountain Nib, Pencil, Highlighter, Eraser, Select & Move, Shapes (Line, Arrow, Rectangle, Circle, Triangle), Text Labels, Grid Snap, Image Placement, Undo/Redo, Zoom, PNG/SVG Export
  - **Split Studio Mode**: write notes on the left and sketch diagrams on the right with one-click **Embed into Document**
- **Persistent SQLite Database & Full-Text Search**
  - Powered by Node.js 24 built-in `node:sqlite` (`WAL` mode + `FTS5` full-text search)
  - Courses/Subjects, Notebooks, Notes, Tags, Starred, Pinned, Version History Snapshots, Soft Trash & Restore, and Public Read-Only Share Links
- **Authentication, File Storage & Account Management**
  - Salted `crypto.scrypt` password hashing, `HttpOnly` SHA-256 hashed session tokens, active device session management, avatar upload, password change, JSON workspace export, and account deletion
  - Local disk **Academic File Vault** (`storage/uploads/`) with drag-and-drop upload, MIME safety filtering, per-user storage quota enforcement, and inline image/PDF preview
  - Built-in **Study Hub** (assignments/deadlines tracker, active-recall flashcards with flip-card quiz, and Pomodoro focus timer)
  - Pre-seeded **Demo Student Account** (`alex.rivera@university.edu` / `InkoraDemo2026!`)

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS v4, TipTap, KaTeX, Lucide Icons, HTML5 Canvas
- **Backend:** Node.js 24, Express 4, `node:sqlite` (SQLite + FTS5), Multer, TypeScript

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run in development (API on :3001 + Vite client on :5173)
npm run dev

# 3. Run typecheck & automated integration tests
npm run typecheck
npm test

# 4. Build and run production server
npm run build
npm start
```
