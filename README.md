# FinFlow - Full-Stack PostgreSQL Expense & IPO Tracker

FinFlow is a production-grade full-stack personal finance and expense tracking web application built with **React**, **Node.js**, **Express**, and **PostgreSQL**. It includes JWT authentication, real-time recurring bill scheduling, undo-after-delete with soft deletions, monthly report generation with PDF/Excel/CSV exports, multi-currency support, and a dedicated **Stock Market & IPO Application Tracker** for tracking money blocked in ASBA/UPI mandates.

---

## Key Features

1. **Authentication & User Accounts**
   - User signup, login, logout, and token refresh.
   - Password hashing with bcrypt.
   - JWT authentication (short-lived access tokens with refresh tokens in httpOnly cookies).
   - Self-serve forgot & reset password flow with verification codes.
   - Profile management: custom avatars, name changes, password updates, and account deletion.
   - Strict data isolation: all queries are scoped by `userId`.

2. **Expense & Income Management**
   - Full CRUD for expenses (amount, category, payment method, tags, notes, recurring options).
   - Undo-after-delete: 7-second interactive toast allowing immediate restoration of soft-deleted records.
   - Duplicate any expense in one click.
   - Income tracking (Salary, Freelance, Business, Dividends, IPO refunds/profits) with Net Savings and Savings Rate % metrics.

3. **Stock Market & IPO Blocked Capital Tracker (Special Feature)**
   - Dedicated "Stock Market & IPOs" category.
   - Track IPO applications with Lot Size, Shares Count, Cut-off/Bid Price, and Mandate Status.
   - Real-time dashboard KPI for **Total IPO Blocked Capital** in ASBA mandates.
   - Instant status switcher: `Blocked` ➔ `Allotted` ➔ `Refunded` ➔ `Sold`.

4. **Budgets & Notifications**
   - Overall monthly budget and individual category spending caps.
   - Visual progress bars with 80% warning threshold and over-budget alert status.
   - In-app notification center (bell icon with unread badge count) for budget alerts, upcoming bill reminders, and IPO status changes.

5. **Monthly Financial Report Generator**
   - Filter by any month and year.
   - Category breakdown table (amount, % of total, transaction count).
   - Top 5 highest expenses and daily spending trend.
   - Interactive charts via Recharts (Donut category distribution, Daily spending trend, 6-Month Income vs Expense, Payment methods, Day-of-week patterns).
   - Exports: Formal PDF statement via `jsPDF` + `jspdf-autotable`, Excel `.xlsx` via `SheetJS`, and `.csv`.

6. **Customizable Preferences & Data Portability**
   - Multi-currency support: Default INR (₹), with live switching to USD ($), EUR (€), GBP (£), AED (د.إ), JPY (¥), CAD, AUD.
   - Dark/Light/System theme toggle.
   - One-click JSON backup export and restore with `merge` or `replace` options.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, React Router v7, Lucide Icons, Recharts, Canvas Confetti.
- **Backend Options**:
  - **Node.js + Express**: Full-stack server running with Vite middleware mounted (`server.ts`).
  - **FastAPI (Python)**: Complete, production-ready Python backend located in `/fastapi_backend` with SQLAlchemy, Pydantic v2, and JWT authentication.
- **Database**: PostgreSQL (Neon, Supabase, Render, Railway, AWS RDS, or embedded).
- **Auth & Security**: JWT (`python-jose` / `jsonwebtoken`), bcrypt password hashing, HTTP-only cookies, CORS, Zod/Pydantic validation.
- **Reporting & Exports**: jsPDF, jspdf-autotable, SheetJS (XLSX), CSV.
- **Scheduler**: Autonomous internal cron runner for recurring bill generation, reminders, and 30-day soft-delete purges.

---

## Getting Started

### 1. Installation

```bash
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env`:

```env
PORT=3000
JWT_ACCESS_SECRET=your_jwt_access_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
# Optional: Set to connect to a production PostgreSQL instance (Supabase, Neon, Render, Railway, AWS RDS):
# DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

*Note: If `DATABASE_URL` is omitted, FinFlow runs an embedded in-memory PostgreSQL engine with auto-persisted state saved to `./data/db-state.json`.*

### 3. Running the Application

To run the full-stack app (Express backend + Vite frontend):

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

### 4. Demo Account

A seed demo account is pre-populated on initial boot:
- **Email**: `demo@example.com`
- **Password**: `Password123!`

---

## REST API Documentation

### Auth
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and receive JWT access + refresh tokens
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Clear refresh tokens and session
- `POST /api/auth/forgot-password` - Request password reset code
- `POST /api/auth/reset-password` - Reset password with verification code

### User Profile
- `GET /api/user/profile` - Get authenticated profile
- `PUT /api/user/profile` - Update name, avatar, or change password
- `PUT /api/user/settings` - Update currency, theme, notification preferences
- `DELETE /api/user` - Delete user account and associated data

### Expenses & IPOs
- `GET /api/expenses` - List expenses (with search, category, date range, amount range, pagination)
- `GET /api/expenses/:id` - Get expense details
- `POST /api/expenses` - Create expense or IPO application
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Soft-delete expense (eligible for undo)
- `POST /api/expenses/:id/restore` - Restore soft-deleted expense
- `POST /api/expenses/:id/duplicate` - Duplicate expense record

### Income
- `GET /api/income` - List user income entries
- `POST /api/income` - Add new income
- `PUT /api/income/:id` - Update income
- `DELETE /api/income/:id` - Soft-delete income
- `POST /api/income/:id/restore` - Restore deleted income

### Categories & Budgets
- `GET /api/categories` - List categories
- `POST /api/categories` - Create custom category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Soft-delete category
- `GET /api/budgets?month=&year=` - Get overall budget and category utilization
- `PUT /api/budgets` - Set monthly overall budget and category budgets

### Reports & Backups
- `GET /api/reports/monthly?month=&year=` - Monthly financial analytics & breakdown
- `GET /api/reports/insights` - Automated algorithmic financial insights
- `GET /api/reports/export?format=csv|xlsx` - Export expense tables
- `GET /api/backup/export` - Export full JSON state backup
- `POST /api/backup/import` - Restore data from JSON backup (`merge` or `replace`)

### Notifications
- `GET /api/notifications` - Get user notifications & unread count
- `PUT /api/notifications/:id/read` - Mark single notification as read
- `PUT /api/notifications/read-all` - Mark all notifications read
- `DELETE /api/notifications` - Clear notifications

---

## Deployment Tips

- **Frontend & Full-Stack Deployment (Render / Railway / Fly.io)**:
  1. Add environment variables: `NODE_ENV=production`, `PORT=3000`, `DATABASE_URL=...`
  2. Build command: `npm run build`
  3. Start command: `npm start`
- **Database (Supabase / Neon / Render Postgres / Railway Postgres)**:
  - Create a new PostgreSQL database instance.
  - Copy the connection string to `DATABASE_URL`. FinFlow automatically creates all tables and constraints on first startup.

---

## Suggestions for Future Improvements

1. **Bank SMS & Email Parser**: Automatic extraction of expense debits and UPI transactions.
2. **Live IPO Allotment Scraper**: Webhook integration with registrar portals (LinkIntime, KFintech) to automatically detect and notify when an applied IPO is allotted.
3. **Split Expenses**: Group splitting for shared household bills with roommates or friends.
4. **Receipt OCR Scanner**: Extract itemized bills and receipts via vision models.
