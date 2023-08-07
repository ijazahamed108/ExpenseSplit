import express from 'express';
import { getBalance } from '../controllers/balanceController.js';

const router = express.Router();

router.get('/:userId', getBalance);

export default router;
