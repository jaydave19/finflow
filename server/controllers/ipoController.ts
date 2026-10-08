import { Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

export async function getIpos(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const search = (req.query.search as string || '').trim();
  const statusFilter = (req.query.status as string || 'ALL').trim();

  const conditions: string[] = ['user_id = $1', 'is_deleted = false'];
  const params: any[] = [userId];
  let paramIdx = 2;

  if (search) {
    conditions.push(`(ipo_name ILIKE $${paramIdx} OR note ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  if (statusFilter && statusFilter !== 'ALL') {
    conditions.push(`status = $${paramIdx++}`);
    params.push(statusFilter);
  }

  const whereClause = conditions.join(' AND ');

  const result = await db.query(
    `SELECT * FROM ipos 
     WHERE ${whereClause} 
     ORDER BY application_date DESC, created_at DESC`,
    params
  );

  // Compute all-time KPI summaries for this user across all active records
  const allRes = await db.query(
    `SELECT * FROM ipos WHERE user_id = $1 AND is_deleted = false`,
    [userId]
  );

  let totalBlockedAmount = 0;
  let blockedCount = 0;
  let totalAllottedAmount = 0;
  let allottedCount = 0;
  let totalRefundedAmount = 0;
  let refundedCount = 0;
  let totalSoldAmount = 0;

  for (const row of allRes.rows) {
    const amt = Number(row.amount || 0);
    const st = row.status || 'Blocked';
    if (st === 'Blocked' || st === 'Applied') {
      totalBlockedAmount += amt;
      blockedCount++;
    } else if (st === 'Allotted') {
      totalAllottedAmount += amt;
      allottedCount++;
    } else if (st === 'Refunded') {
      totalRefundedAmount += amt;
      refundedCount++;
    } else if (st === 'Sold') {
      totalSoldAmount += amt;
    }
  }

  const ipos = result.rows.map(row => ({
    id: row.id,
    ipoName: row.ipo_name,
    amount: Number(row.amount),
    applicationDate: row.application_date,
    paymentMethod: row.payment_method || 'UPI',
    sharesCount: row.shares_count ? parseInt(row.shares_count, 10) : undefined,
    bidPrice: row.bid_price ? Number(row.bid_price) : undefined,
    lotSize: row.lot_size ? parseInt(row.lot_size, 10) : 1,
    status: row.status || 'Blocked',
    mandateStatus: row.mandate_status || 'UPI ASBA Mandate Accepted',
    allotmentDate: row.allotment_date,
    bankName: row.bank_name,
    dematAccount: row.demat_account,
    note: row.note,
    createdAt: row.created_at,
  }));

  res.json({
    ipos,
    stats: {
      totalBlockedAmount,
      blockedCount,
      totalAllottedAmount,
      allottedCount,
      totalRefundedAmount,
      refundedCount,
      totalSoldAmount,
      totalApplications: allRes.rows.length,
    },
  });
}

export async function getIpoById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await db.query(
    'SELECT * FROM ipos WHERE id = $1 AND user_id = $2 AND is_deleted = false',
    [req.params.id, req.userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'IPO application not found' });
    return;
  }

  const row = result.rows[0];
  res.json({
    ipo: {
      id: row.id,
      ipoName: row.ipo_name,
      amount: Number(row.amount),
      applicationDate: row.application_date,
      paymentMethod: row.payment_method || 'UPI',
      sharesCount: row.shares_count ? parseInt(row.shares_count, 10) : undefined,
      bidPrice: row.bid_price ? Number(row.bid_price) : undefined,
      lotSize: row.lot_size ? parseInt(row.lot_size, 10) : 1,
      status: row.status || 'Blocked',
      mandateStatus: row.mandate_status || 'UPI ASBA Mandate Accepted',
      allotmentDate: row.allotment_date,
      bankName: row.bank_name,
      dematAccount: row.demat_account,
      note: row.note,
      createdAt: row.created_at,
    },
  });
}

export async function createIpo(req: AuthenticatedRequest, res: Response): Promise<void> {
  const {
    ipoName,
    amount,
    applicationDate,
    paymentMethod,
    sharesCount,
    bidPrice,
    lotSize,
    status,
    mandateStatus,
    allotmentDate,
    bankName,
    dematAccount,
    note,
  } = req.body;

  if (!ipoName || !ipoName.trim()) {
    res.status(400).json({ error: 'IPO / Company name is required' });
    return;
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    res.status(400).json({ error: 'Valid positive blocked amount is required' });
    return;
  }

  const date = applicationDate || new Date().toISOString().split('T')[0];
  const ipoStatus = status || 'Blocked';
  const id = crypto.randomUUID();

  await db.query(
    `INSERT INTO ipos (
      id, user_id, ipo_name, amount, application_date, payment_method,
      shares_count, bid_price, lot_size, status, mandate_status,
      allotment_date, bank_name, demat_account, note
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      id,
      req.userId,
      ipoName.trim(),
      numAmount,
      date,
      paymentMethod || 'UPI',
      sharesCount ? parseInt(sharesCount, 10) : null,
      bidPrice ? parseFloat(bidPrice) : null,
      lotSize ? parseInt(lotSize, 10) : 1,
      ipoStatus,
      mandateStatus || 'UPI ASBA Mandate Accepted',
      allotmentDate || null,
      bankName || null,
      dematAccount || null,
      note || '',
    ]
  );

  // Send in-app notification if funds are blocked
  if (ipoStatus === 'Blocked' || ipoStatus === 'Applied') {
    await db.query(
      `INSERT INTO notifications (id, user_id, type, message, link)
       VALUES ($1, $2, 'ipo_update', $3, '/ipo')`,
      [
        crypto.randomUUID(),
        req.userId,
        `₹${numAmount.toLocaleString()} ASBA capital blocked for ${ipoName.trim()}.`,
      ]
    );
  }

  res.status(201).json({ id, message: 'IPO application recorded successfully' });
}

export async function updateIpo(req: AuthenticatedRequest, res: Response): Promise<void> {
  const {
    ipoName,
    amount,
    applicationDate,
    paymentMethod,
    sharesCount,
    bidPrice,
    lotSize,
    status,
    mandateStatus,
    allotmentDate,
    bankName,
    dematAccount,
    note,
  } = req.body;

  const existing = await db.query(
    'SELECT id FROM ipos WHERE id = $1 AND user_id = $2 AND is_deleted = false',
    [req.params.id, req.userId]
  );

  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'IPO application not found' });
    return;
  }

  await db.query(
    `UPDATE ipos SET
      ipo_name = COALESCE($1, ipo_name),
      amount = COALESCE($2, amount),
      application_date = COALESCE($3, application_date),
      payment_method = COALESCE($4, payment_method),
      shares_count = COALESCE($5, shares_count),
      bid_price = COALESCE($6, bid_price),
      lot_size = COALESCE($7, lot_size),
      status = COALESCE($8, status),
      mandate_status = COALESCE($9, mandate_status),
      allotment_date = $10,
      bank_name = COALESCE($11, bank_name),
      demat_account = COALESCE($12, demat_account),
      note = COALESCE($13, note)
     WHERE id = $14 AND user_id = $15`,
    [
      ipoName ? ipoName.trim() : null,
      amount !== undefined ? parseFloat(amount) : null,
      applicationDate || null,
      paymentMethod || null,
      sharesCount !== undefined ? parseInt(sharesCount, 10) : null,
      bidPrice !== undefined ? parseFloat(bidPrice) : null,
      lotSize !== undefined ? parseInt(lotSize, 10) : null,
      status || null,
      mandateStatus || null,
      allotmentDate !== undefined ? allotmentDate : null,
      bankName || null,
      dematAccount || null,
      note !== undefined ? note : null,
      req.params.id,
      req.userId,
    ]
  );

  res.json({ message: 'IPO application updated successfully' });
}

export async function deleteIpo(req: AuthenticatedRequest, res: Response): Promise<void> {
  const existing = await db.query(
    'SELECT id, ipo_name FROM ipos WHERE id = $1 AND user_id = $2 AND is_deleted = false',
    [req.params.id, req.userId]
  );

  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'IPO application not found' });
    return;
  }

  await db.query(
    'UPDATE ipos SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );

  res.json({
    id: req.params.id,
    message: 'IPO application deleted (soft-delete). You can undo this action.',
  });
}

export async function restoreIpo(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await db.query(
    'UPDATE ipos SET is_deleted = false, deleted_at = NULL WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'IPO application not found or cannot be restored' });
    return;
  }

  res.json({ id: req.params.id, message: 'IPO application restored successfully' });
}
