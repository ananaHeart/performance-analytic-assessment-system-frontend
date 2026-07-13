# Performance Analytics Assessment System - Web Dashboard

This repository contains the React + Vite web dashboard for the Performance Analytics Assessment System. It is the browser-based frontend used by principals and teachers to manage teacher approval, class assignments, student records, assessment setup, analytics, intervention recommendations, and report exports.

## Current Production Backend

The deployed Spring Boot backend is hosted on Render:

```text
https://performance-analytics-assessment-system.onrender.com
```

The frontend reads the backend base URL from a Vite environment variable:

```env
VITE_API_BASE_URL=https://performance-analytics-assessment-system.onrender.com
```

For local development, use:

```env
VITE_API_BASE_URL=http://localhost:8080
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local `.env` file based on `.env.example`.

3. Start the development server:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
```

## Render Static Site Settings

Use these settings when deploying the Vite frontend as a Render Static Site:

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_API_BASE_URL`
- Production value: `https://performance-analytics-assessment-system.onrender.com`

The backend must allow the deployed frontend URL through CORS.

## Main Documentation

The documentation files for panel review are in the `docs` folder:

- `docs/WEB_DASHBOARD_DOCUMENTATION.md`
- `docs/demo-checklist.md`
- `docs/frontend-documentation-status.md`

## Documentation Timeline

- July 9, 2026: Initial frontend repository documentation was present in the first frontend commit.
- July 12, 2026: README was rewritten from the default Vite template into this project-specific frontend README.
- July 12, 2026: Production backend configuration using `VITE_API_BASE_URL` was documented for local and Render deployment.
- July 12, 2026: Current web dashboard features, demo flow, and documentation status were refreshed for panel presentation.

## Main Frontend Capabilities

- Role-based login for principal and teacher users
- Principal dashboard and teacher approval
- Teacher/class/subject/section assignment flow
- Student records through manual input and SF1 import
- Teacher assessment setup with test parts and competency mappings
- Teacher analytics based on synced mobile checking results
- Student score export for selected assessments
- Student profile skill mastery display
- Teacher-facing intervention recommendation panel
- Production backend configuration through `VITE_API_BASE_URL`
