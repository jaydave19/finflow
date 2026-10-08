import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import { newDb, DataType } from 'pg-mem';

export interface DbQueryResult<T = any> {
  rows: T[];
  rowCount?: number;
}

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<DbQueryResult<T>>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.resolve(DATA_DIR, 'db-state.json');

class DatabaseManager implements DbClient {
  private pgPool: pg.Pool | null = null;
  private memDb: any = null;
  private memPool: any = null;
  private isMemory = true;
  private saveTimeout: NodeJS.Timeout | null = null;

  async init(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl) {
      console.log('Connecting to PostgreSQL database via DATABASE_URL...');
      this.pgPool = new pg.Pool({
        connectionString: databaseUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      });
      this.isMemory = false;
      await this.runMigrations();
    } else {
      console.log('Initializing embedded PostgreSQL engine (pg-mem) with persistent JSON storage...');
      this.memDb = newDb();

      // Register custom postgres functions needed
      this.memDb.public.registerFunction({
        name: 'gen_random_uuid',
        returns: DataType.text,
        implementation: () => crypto.randomUUID(),
      });

      this.memPool = this.memDb.adapters.createPg();
      this.isMemory = true;

      await this.runMigrations();
      await this.loadPersistedState();
    }
  }

  private async runMigrations(): Promise<void> {
    const ddl = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar TEXT,
        currency TEXT DEFAULT 'INR',
        theme TEXT DEFAULT 'system',
        notification_prefs JSONB DEFAULT '{"email": true, "inApp": true, "daysBefore": 3}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        monthly_budget NUMERIC DEFAULT 0,
        is_default BOOLEAN DEFAULT false,
        is_deleted BOOLEAN DEFAULT false,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS credit_cards (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        card_name TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        card_number_last4 TEXT NOT NULL,
        card_network TEXT DEFAULT 'Visa',
        credit_limit NUMERIC NOT NULL DEFAULT 50000,
        billing_cycle_day INT DEFAULT 1,
        due_date_day INT DEFAULT 20,
        color TEXT DEFAULT '#4F46E5',
        is_deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        card_id TEXT REFERENCES credit_cards(id) ON DELETE SET NULL,
        amount NUMERIC NOT NULL,
        date TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        note TEXT,
        tags JSONB DEFAULT '[]',
        is_recurring BOOLEAN DEFAULT false,
        recurrence_type TEXT,
        next_due_date TEXT,
        is_deleted BOOLEAN DEFAULT false,
        deleted_at TIMESTAMP,
        ipo_details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS incomes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        source TEXT NOT NULL,
        date TEXT NOT NULL,
        note TEXT,
        is_deleted BOOLEAN DEFAULT false,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        month INT NOT NULL,
        year INT NOT NULL,
        overall_budget NUMERIC NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ipos (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ipo_name TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        application_date TEXT NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'UPI',
        shares_count INT,
        bid_price NUMERIC,
        lot_size INT DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'Blocked',
        mandate_status TEXT DEFAULT 'UPI ASBA Mandate Accepted',
        allotment_date TEXT,
        bank_name TEXT,
        demat_account TEXT,
        note TEXT,
        is_deleted BOOLEAN DEFAULT false,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        link TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS password_resets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    if (this.pgPool) {
      await this.pgPool.query(ddl);
      // Migration for existing expenses table if card_id does not exist
      try {
        await this.pgPool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS card_id TEXT REFERENCES credit_cards(id) ON DELETE SET NULL;`);
      } catch {
        // column may already exist
      }
    } else {
      this.memDb.public.none(ddl);
    }
  }

  private async loadPersistedState(): Promise<void> {
    try {
      if (!fs.existsSync(STATE_FILE)) return;
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      const tables = ['users', 'categories', 'credit_cards', 'expenses', 'incomes', 'budgets', 'ipos', 'notifications', 'refresh_tokens', 'password_resets'];

      for (const table of tables) {
        if (Array.isArray(data[table])) {
          for (const row of data[table]) {
            const cols = Object.keys(row);
            if (cols.length === 0) continue;
            const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
            const values = cols.map(c => {
              const val = row[c];
              if (typeof val === 'object' && val !== null) {
                return JSON.stringify(val);
              }
              return val;
            });
            const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
            await this.query(sql, values);
          }
        }
      }
      console.log('Restored persisted database state from disk successfully.');
    } catch (err) {
      console.error('Failed to load persisted database state:', err);
    }
  }

  private scheduleSave(): void {
    if (!this.isMemory) return;
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(async () => {
      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        const tables = ['users', 'categories', 'credit_cards', 'expenses', 'incomes', 'budgets', 'ipos', 'notifications', 'refresh_tokens', 'password_resets'];
        const state: Record<string, any[]> = {};
        for (const t of tables) {
          const res = await this.query(`SELECT * FROM ${t}`);
          state[t] = res.rows;
        }
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
      } catch (err) {
        console.error('Error auto-saving database state:', err);
      }
    }, 400);
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<DbQueryResult<T>> {
    if (this.pgPool) {
      const result = await this.pgPool.query(sql, params);
      return { rows: result.rows as T[], rowCount: result.rowCount ?? result.rows.length };
    }

    if (this.memPool) {
      const client = new this.memPool.Pool();
      try {
        const result = await client.query(sql, params);
        // If modifying query, schedule disk persistence
        const trimmed = sql.trim().toUpperCase();
        if (
          trimmed.startsWith('INSERT') ||
          trimmed.startsWith('UPDATE') ||
          trimmed.startsWith('DELETE') ||
          trimmed.startsWith('DROP')
        ) {
          this.scheduleSave();
        }
        return { rows: result.rows as T[], rowCount: result.rowCount ?? result.rows.length };
      } catch (err) {
        throw err;
      }
    }

    throw new Error('Database not initialized');
  }

  async rawBackup(): Promise<Record<string, any[]>> {
    const tables = ['users', 'categories', 'credit_cards', 'expenses', 'incomes', 'budgets', 'ipos', 'notifications'];
    const result: Record<string, any[]> = {};
    for (const t of tables) {
      const res = await this.query(`SELECT * FROM ${t}`);
      result[t] = res.rows;
    }
    return result;
  }
}

export const db = new DatabaseManager();
