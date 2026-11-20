# INKORA — Smart Digital Notes & Student Workspace

> **"Your Thoughts. Your Space. Your Ink."**

**INKORA** is a full-stack academic digital notebook, drawing pad, and Word-like document editor built for students to write, organize, draw, edit, and store their academic work in one unified platform—with strict role-based access control and privacy-first architecture.

## Brand & Visual Identity

- **Logo & Favicon**: Bespoke SVG emblem combining an open notebook, writing pen, and subtle digital spark node ([client/public/favicon.svg](client/public/favicon.svg) & `BrandLogo` component in icon-only and full-name formats).
- **Color Palette**: Deep purple, lavender, and soft blue primary accents paired with crisp white, light gray, and smooth gradients.
- **Landing Page**: Full introduction to INKORA's studios, organization tools, privacy model, interactive Sign In / Create Student Account, and instant Demo Student & Demo Admin entry.

## Two-Role Access Control (Backend Enforced)

1. **Student (`student`)**
   - Personal dashboard, custom **Folders**, **Courses**, **Notebooks**, tags, and workspace accent customization
   - **Word-like Document Studio** (TipTap + multi-tab Ribbon, tables, checklists, KaTeX equations, Find & Replace, snapshots, PDF/HTML/Markdown export)
   - **Traditional Notebook & Cornell Paper** (College/Wide Ruled, Dot/Graph Grid, Cornell 3-zone lecture layout + live ink overlay)
   - **Digital Drawing Pad & Split Studio** (Pen, Fountain Nib, Pencil, Highlighter, Eraser, Shapes, Text, PNG/SVG export, Embed to Doc)
   - **Personal File Vault** (upload/download PDFs, images, docs) & **Study Hub** (tasks, flashcards, Pomodoro timer)
   - **Strict Isolation**: Students can only read/modify/search/download their own notes, folders, and files (`404`/`403` enforced on cross-user access).
2. **Administrator (`admin`)**
   - Dedicated **Admin Console** separate from student workspaces (`403` enforced across all student/admin route boundaries)
   - View & search registered student accounts by name, email, or university
   - Inspect registration dates, status (`active`, `deactivated`, `suspended`), last login, login count, and aggregate usage statistics
   - Activate, deactivate, suspend, or delete student accounts (revoking active sessions immediately)
   - Manage student **account-related concerns & appeals**
   - **Privacy Shield**: Admin APIs only return account metadata and aggregate counts—private student note contents and personal files are never exposed.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS v4, TipTap, KaTeX, Lucide Icons, HTML5 Canvas
- **Backend:** Node.js 24, Express 4, `node:sqlite` (SQLite + FTS5), Multer, TypeScript

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run in development (API on :3001 + Vite client on :5173)
npm run dev

# 3. Run typecheck & RBAC integration tests
npm run typecheck
npm test

# 4. Build and run production server
npm run build
npm start
```
