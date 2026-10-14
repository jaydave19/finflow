import { Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

// ---------------- People ----------------

export async function getPeople(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;

  const result = await db.query(
    `SELECT * FROM people WHERE user_id = $1 AND is_deleted = false ORDER BY created_at DESC`,
    [userId]
  );

  // Calculate balances for each person
  const peopleWithBalances = await Promise.all(
    result.rows.map(async (person) => {
      const entries = await db.query(
        `SELECT type, amount, settled_amount FROM ledger_entries WHERE person_id = $1 AND is_deleted = false`,
        [person.id]
      );
      
      let balance = 0;
      for (const entry of entries.rows) {
        const remaining = Number(entry.amount) - Number(entry.settled_amount);
        if (entry.type === 'gave') balance += remaining; // They owe me (I will get)
        if (entry.type === 'took') balance -= remaining; // I owe them (I need to give)
      }

      return {
        id: person.id,
        name: person.name,
        phone: person.phone,
        photo: person.photo,
        notes: person.notes,
        balance, // positive means you get, negative means you give
        createdAt: person.created_at,
      };
    })
  );

  const totalToReceive = peopleWithBalances.filter(p => p.balance > 0).reduce((acc, p) => acc + p.balance, 0);
  const totalToPay = peopleWithBalances.filter(p => p.balance < 0).reduce((acc, p) => acc + Math.abs(p.balance), 0);
  const netPosition = totalToReceive - totalToPay;

  res.json({
    people: peopleWithBalances,
    summary: { totalToReceive, totalToPay, netPosition }
  });
}

export async function createPerson(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name, phone, photo, notes } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO people (id, user_id, name, phone, photo, notes) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, req.userId, name.trim(), phone || null, photo || null, notes || null]
  );

  res.status(201).json({ id, message: 'Person added successfully' });
}

export async function updatePerson(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name, phone, photo, notes } = req.body;
  const personId = req.params.id;

  await db.query(
    `UPDATE people SET name = COALESCE($1, name), phone = COALESCE($2, phone), photo = COALESCE($3, photo), notes = COALESCE($4, notes) WHERE id = $5 AND user_id = $6`,
    [name?.trim() || null, phone || null, photo || null, notes || null, personId, req.userId]
  );

  res.json({ message: 'Person updated successfully' });
}

export async function deletePerson(req: AuthenticatedRequest, res: Response): Promise<void> {
  const personId = req.params.id;
  await db.query(
    `UPDATE people SET is_deleted = true WHERE id = $1 AND user_id = $2`,
    [personId, req.userId]
  );
  res.json({ message: 'Person deleted successfully' });
}

// ---------------- Ledger Entries ----------------

export async function getPersonLedger(req: AuthenticatedRequest, res: Response): Promise<void> {
  const personId = req.params.id;
  const userId = req.userId;

  const personRes = await db.query(
    `SELECT * FROM people WHERE id = $1 AND user_id = $2 AND is_deleted = false`,
    [personId, userId]
  );

  if (personRes.rows.length === 0) {
    res.status(404).json({ error: 'Person not found' });
    return;
  }

  const entriesRes = await db.query(
    `SELECT * FROM ledger_entries WHERE person_id = $1 AND is_deleted = false ORDER BY date DESC, created_at DESC`,
    [personId]
  );

  const entriesWithSettlements = await Promise.all(
    entriesRes.rows.map(async (entry) => {
      const settlements = await db.query(
        `SELECT * FROM ledger_settlements WHERE entry_id = $1 AND is_deleted = false ORDER BY date ASC`,
        [entry.id]
      );
      return {
        id: entry.id,
        type: entry.type,
        amount: Number(entry.amount),
        date: entry.date,
        reason: entry.reason,
        dueDate: entry.due_date,
        paymentMethod: entry.payment_method,
        attachment: entry.attachment,
        interestRate: entry.interest_rate ? Number(entry.interest_rate) : null,
        interestType: entry.interest_type,
        isSettled: entry.is_settled,
        settledAmount: Number(entry.settled_amount),
        status: entry.status,
        createdAt: entry.created_at,
        settlements: settlements.rows.map(s => ({
          id: s.id,
          amount: Number(s.amount),
          date: s.date,
          paymentMethod: s.payment_method,
          note: s.note
        }))
      };
    })
  );

  res.json({
    person: {
      id: personRes.rows[0].id,
      name: personRes.rows[0].name,
      phone: personRes.rows[0].phone,
      photo: personRes.rows[0].photo,
      notes: personRes.rows[0].notes,
    },
    entries: entriesWithSettlements
  });
}

export async function createLedgerEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
  const personId = req.params.id;
  const { type, amount, date, reason, dueDate, paymentMethod, attachment, interestRate, interestType } = req.body;

  if (!type || !amount || !date) {
    res.status(400).json({ error: 'Type, amount, and date are required' });
    return;
  }

  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO ledger_entries (id, user_id, person_id, type, amount, date, reason, due_date, payment_method, attachment, interest_rate, interest_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [id, req.userId, personId, type, parseFloat(amount), date, reason || null, dueDate || null, paymentMethod || null, attachment || null, interestRate ? parseFloat(interestRate) : null, interestType || null]
  );

  // Link to bank account -> Add an expense or income entry
  const createLinkedTransaction = req.body.linkToBank;
  if (createLinkedTransaction) {
    const txId = crypto.randomUUID();
    if (type === 'gave') {
      await db.query(
        `INSERT INTO expenses (id, user_id, amount, date, payment_method, note) VALUES ($1, $2, $3, $4, $5, $6)`,
        [txId, req.userId, parseFloat(amount), date, paymentMethod || 'Bank', `Gave to ${req.body.personName}`]
      );
    } else {
      await db.query(
        `INSERT INTO incomes (id, user_id, amount, date, source, note) VALUES ($1, $2, $3, $4, $5, $6)`,
        [txId, req.userId, parseFloat(amount), date, 'Ledger', `Took from ${req.body.personName}`]
      );
    }
  }

  res.status(201).json({ id, message: 'Ledger entry added' });
}

export async function deleteLedgerEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
  const entryId = req.params.entryId;
  await db.query(
    `UPDATE ledger_entries SET is_deleted = true WHERE id = $1 AND user_id = $2`,
    [entryId, req.userId]
  );
  res.json({ message: 'Ledger entry deleted' });
}

// ---------------- Settlements ----------------

export async function createSettlement(req: AuthenticatedRequest, res: Response): Promise<void> {
  const entryId = req.params.entryId;
  const { amount, date, paymentMethod, note, linkToBank, personName } = req.body;

  if (!amount || !date) {
    res.status(400).json({ error: 'Amount and date are required' });
    return;
  }

  const entryRes = await db.query(
    `SELECT amount, settled_amount, type FROM ledger_entries WHERE id = $1 AND user_id = $2 AND is_deleted = false`,
    [entryId, req.userId]
  );

  if (entryRes.rows.length === 0) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }

  const entry = entryRes.rows[0];
  const newSettledAmount = Number(entry.settled_amount) + parseFloat(amount);
  const isSettled = newSettledAmount >= Number(entry.amount);
  let status = 'Partially paid';
  if (isSettled) status = 'Settled';

  const settlementId = crypto.randomUUID();
  
  await db.query(
    `INSERT INTO ledger_settlements (id, user_id, entry_id, amount, date, payment_method, note) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [settlementId, req.userId, entryId, parseFloat(amount), date, paymentMethod || null, note || null]
  );

  await db.query(
    `UPDATE ledger_entries SET settled_amount = $1, is_settled = $2, status = $3 WHERE id = $4`,
    [newSettledAmount, isSettled, status, entryId]
  );

  if (linkToBank) {
    const txId = crypto.randomUUID();
    // If I gave money, a settlement means I received money -> Income
    if (entry.type === 'gave') {
       await db.query(
        `INSERT INTO incomes (id, user_id, amount, date, source, note) VALUES ($1, $2, $3, $4, $5, $6)`,
        [txId, req.userId, parseFloat(amount), date, 'Ledger Settlement', `Repayment from ${personName}`]
      );
    } else {
       await db.query(
        `INSERT INTO expenses (id, user_id, amount, date, payment_method, note) VALUES ($1, $2, $3, $4, $5, $6)`,
        [txId, req.userId, parseFloat(amount), date, paymentMethod || 'Bank', `Repayment to ${personName}`]
      );
    }
  }

  res.status(201).json({ id: settlementId, message: 'Settlement recorded' });
}

export async function deleteSettlement(req: AuthenticatedRequest, res: Response): Promise<void> {
  const settlementId = req.params.settlementId;
  const settlementRes = await db.query(
    `SELECT * FROM ledger_settlements WHERE id = $1 AND user_id = $2 AND is_deleted = false`,
    [settlementId, req.userId]
  );

  if (settlementRes.rows.length === 0) {
    res.status(404).json({ error: 'Settlement not found' });
    return;
  }

  const settlement = settlementRes.rows[0];
  const entryId = settlement.entry_id;

  const entryRes = await db.query(`SELECT amount, settled_amount FROM ledger_entries WHERE id = $1`, [entryId]);
  if (entryRes.rows.length > 0) {
    const entry = entryRes.rows[0];
    const newSettledAmount = Math.max(0, Number(entry.settled_amount) - Number(settlement.amount));
    const isSettled = newSettledAmount >= Number(entry.amount);
    let status = 'Partially paid';
    if (newSettledAmount === 0) status = 'Pending';
    if (isSettled) status = 'Settled';

    await db.query(
      `UPDATE ledger_entries SET settled_amount = $1, is_settled = $2, status = $3 WHERE id = $4`,
      [newSettledAmount, isSettled, status, entryId]
    );
  }

  await db.query(
    `UPDATE ledger_settlements SET is_deleted = true WHERE id = $1`,
    [settlementId]
  );

  res.json({ message: 'Settlement undone successfully' });
}
