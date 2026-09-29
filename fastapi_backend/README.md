# FinFlow FastAPI Backend

A production-ready **FastAPI** backend for the FinFlow Expense & Stock/IPO Tracking application.

## Tech Stack
- **Framework**: FastAPI (Python 3.10+)
- **ORM & DB**: SQLAlchemy 2.0 (PostgreSQL via `psycopg2` / `asyncpg` or SQLite)
- **Validation**: Pydantic v2
- **Auth**: JWT authentication via `python-jose` with `passlib[bcrypt]` password hashing
- **Data Export**: Pandas & OpenPyXL for Excel and CSV reporting

---

## Quick Setup & Run

### 1. Create a virtual environment
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Environment Variables (.env)
```env
# Database URL (Neon / Supabase / Render / Railway PostgreSQL):
DATABASE_URL=postgresql://user:password@localhost:5432/finflow

# If DATABASE_URL is not set, it defaults to a local SQLite database: sqlite:///./finflow.db
JWT_ACCESS_SECRET=your-jwt-access-secret-2026
JWT_REFRESH_SECRET=your-jwt-refresh-secret-2026
```

### 4. Start the Server
```bash
uvicorn main:app --reload --port 8000
```
Interactive Swagger API documentation will be available at:
👉 **http://localhost:8000/docs**

---

## Pre-seeded Demo Account
- **Email**: `demo@example.com`
- **Password**: `Password123!`

---

## Running with Docker
```bash
docker build -t finflow-fastapi .
docker run -p 8000:8000 -e DATABASE_URL="postgresql://..." finflow-fastapi
```
