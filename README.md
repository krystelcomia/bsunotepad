# INKORA — Smart Digital Notes & Student Workspace

> **"Your Thoughts. Your Space. Your Ink."**

**INKORA** is a full-stack academic digital notebook, drawing pad, and Word-like document editor built for students to write, organize, draw, edit, and store their academic work in one unified platform—with strict role-based access control and privacy-first architecture.

## Brand & Visual Identity

- **Logo & Favicon**: Bespoke SVG emblem combining an open notebook, writing pen, and subtle digital spark node ([client/public/favicon.svg](client/public/favicon.svg) & `BrandLogo` component in icon-only and full-name formats).
- **Color Palette**: Deep purple, lavender, and soft blue primary accents paired with crisp white, light gray, and smooth gradients.
- **Landing Page**: Full introduction to INKORA's studios, organization tools, privacy model, interactive Sign In / Create Student Account, and instant Demo Student & Demo Admin entry.

## Authentication, Gmail Verification & Two-Role RBAC

1. **Student (`student`)**
   - **Gmail-Only Registration**: Requires Full Name, unique `@gmail.com` address (case-insensitive SQLite `UNIQUE COLLATE NOCASE` constraint), Password + Confirm Password, and optional Profile Picture upload.
   - **Mandatory Verification**: Unverified Gmail accounts cannot access the student workspace (`403` blocked on backend) until verified via 6-digit OTP or verification link.
   - **Password Reset & Sessions**: Forgot Password & password reset via verified Gmail OTP/link; persistent `HttpOnly` sessions with automatic refresh token rotation.
   - **Personal Workspace**: Custom **Folders**, **Courses**, **Notebooks**, tags, **Word-like Document Studio**, **Traditional/Cornell Notebook + Ink**, **Digital Drawing Pad & Split View**, **File Vault**, and **Study Hub**.
   - **Strict Isolation**: Students can only read/modify/search/download their own notes, folders, and files (`404`/`403` enforced on cross-user access).
2. **Administrator (`admin`)**
   - **Secure Setup Only**: No public Admin signup or role picker. Initial admin is provisioned securely via `npm run setup:admin` / `INKORA_ADMIN_SETUP_SECRET`, and additional admins can only be created or assigned by an existing authorized Administrator.
   - **Dedicated Admin Console**: Automatic role identification on login routes admins to the Admin Console (`403` enforced across student/admin boundaries).
   - Manage student accounts (`active`, `deactivated`, `suspended`, delete), search by name/email, monitor aggregate usage & login activity, and resolve account concerns—while keeping private student notes and files hidden by default.

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
