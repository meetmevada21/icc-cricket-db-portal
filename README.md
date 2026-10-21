# ICC Cricket Database Management Portal (`icc_db`)

Full-stack **Node.js + Express + MySQL (`mysql2`)** web application and relational database system implementing all 8 ER diagram tables, 4 triggers, 2 stored procedures, and 2 SQL views, with Role-Based Access Control (**Viewer Read-Only Mode** vs. **Admin CRUD Mode**).

## Project Structure

```text
icc_portal/
├── api/
│   └── index.js                   # Vercel Serverless Function entry point
├── database/
│   └── icc_cricket_database.sql   # Complete MySQL DDL, Triggers, Procedures, Views & Seed Data
├── public/
│   └── index.html                 # Interactive ICC Web Portal (Tailwind CSS + Chart.js)
├── .env.example                   # Environment variables template (Local & Cloud MySQL)
├── package.json                   # Node.js dependencies (express, mysql2, cors, dotenv)
├── server.js                      # Express REST API & static server
└── vercel.json                    # Vercel routing configuration
```

---

## Deploying to Vercel (Step-by-Step)

Because Vercel is a serverless platform, it does not run a local MySQL server inside its containers. You have **two ways** to deploy on Vercel:

### Option A: Full-Stack Deployment on Vercel + Cloud MySQL (Recommended for Persistent Live DB)
1. **Create a Free Cloud MySQL Database**:
   - Use **Aiven** (Free MySQL), **TiDB Cloud** (Serverless Free Tier), **Railway**, or **PlanetScale**.
   - Connect to your cloud MySQL instance using MySQL Workbench, DBeaver, or CLI and run `database/icc_cricket_database.sql` to create all 8 tables, views, triggers, and seed data.
2. **Push Project to GitHub**:
   - Extract `icc_cricket_mysql_fullstack.zip` into a new folder, initialize Git, and push to a GitHub repository:
     ```bash
     git init
     git add .
     git commit -m "Initial commit: ICC Cricket DB Portal"
     git branch -M main
     git remote add origin https://github.com/<your-username>/<your-repo>.git
     git push -u origin main
     ```
3. **Import Project in Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repository.
   - Leave **Framework Preset** as `Other`.
4. **Configure Environment Variables in Vercel**:
   - Expand **Environment Variables** in the Vercel setup screen and add:
     - `DB_HOST` = your cloud MySQL hostname
     - `DB_PORT` = your cloud MySQL port (e.g., `3306` or `4000`)
     - `DB_USER` = your cloud MySQL username
     - `DB_PASSWORD` = your cloud MySQL password
     - `DB_NAME` = `icc_db`
     - `DB_SSL` = `true` (required by most cloud MySQL providers)
5. **Deploy & Connect**:
   - Click **Deploy**. Once deployed, open your `.vercel.app` URL, click **"In-Memory SQL (Ready)"** in the top-right bar, and click **"Test & Connect Local MySQL"** (the endpoint automatically defaults to `https://<your-app>.vercel.app/api`).

### Option B: Instant Static Deployment on Vercel (Zero-Config In-Memory SQL Mode)
- If you only want to host the interactive portal with its built-in browser SQL engine (no external database setup required), deploy the project directly without environment variables—the app automatically runs in **In-Browser Relational SQL Mode** with full Admin login (`admin` / `icc2026`), interactive charts, and live `.sql` export.
