import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import {
  getPeople,
  createPerson,
  updatePerson,
  deletePerson,
  getPersonLedger,
  createLedgerEntry,
  deleteLedgerEntry,
  createSettlement,
  deleteSettlement
} from '../controllers/ledgerController.ts';

const router = Router();

router.use(requireAuth);

// People
router.get('/people', getPeople);
router.post('/people', createPerson);
router.put('/people/:id', updatePerson);
router.delete('/people/:id', deletePerson);

// Ledger Entries per Person
router.get('/people/:id/ledger', getPersonLedger);
router.post('/people/:id/ledger', createLedgerEntry);
router.delete('/ledger/:entryId', deleteLedgerEntry);

// Settlements
router.post('/ledger/:entryId/settle', createSettlement);
router.delete('/settlement/:settlementId', deleteSettlement);

export default router;
