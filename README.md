# PySizer
A local-first web application that scans software project directories, calculates storage sizes, and visualizes growth trends. The tool helps developers monitor their project's disk space usage over time.

![PySizer Homepage](/img/py-sizer-scrnsht.png)

## Stack

- Backend: FastAPI, SQLAlchemy, Alembic, SQLite
- Frontend: Vite, React, TypeScript, Tailwind CSS, Recharts

## Local setup

Install backend dependencies:

```bash
uv sync
```

Apply the initial database schema:

```bash
uv run alembic -c backend/alembic.ini upgrade head
```

Run the API:

```bash
uv run uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

Run the frontend:

```bash
npm run dev
```

The Vite dev server proxies `/projects` and `/health` to `http://127.0.0.1:8000`.

## Start both servers

After completing the setup above, use the launcher for your operating system to
start the backend and frontend together.

Windows PowerShell:

```powershell
.\start.ps1
```

Linux:

```bash
chmod +x start.sh
./start.sh
```

Press `Ctrl+C` to stop both servers. The launchers do not install dependencies
or apply database migrations.

## Tests

```bash
uv run pytest
```
