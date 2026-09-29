import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

import { db } from './server/db/database.ts';
import { seedDatabase } from './server/db/seed.ts';
import { cronService } from './server/services/cronService.ts';
import { errorHandler } from './server/middleware/errorHandler.ts';

import authRoutes from './server/routes/authRoutes.ts';
import userRoutes from './server/routes/userRoutes.ts';
import expenseRoutes from './server/routes/expenseRoutes.ts';
import incomeRoutes from './server/routes/incomeRoutes.ts';
import categoryRoutes from './server/routes/categoryRoutes.ts';
import budgetRoutes from './server/routes/budgetRoutes.ts';
import reportRoutes from './server/routes/reportRoutes.ts';
import backupRoutes from './server/routes/backupRoutes.ts';
import notificationRoutes from './server/routes/notificationRoutes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Port 3000 is required by the AI Studio environment and iframe
const PORT = 3000;
const isDev = process.env.NODE_ENV !== 'production';

// Security and utility middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// REST API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'FinFlow API', timestamp: new Date().toISOString() });
});

// Database initialization, seed and Vite integration
async function startServer() {
  try {
    await db.init();
    await seedDatabase();
    cronService.start();

    if (isDev) {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('Vite middleware mounted in development mode.');
    } else {
      const distPath = path.resolve(__dirname, 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
      console.log('Serving production static build from dist.');
    }

    // Centralized error handler
    app.use(errorHandler);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`FinFlow full-stack server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }
}

startServer();
