import express from 'express';
import { recordRepayment } from '../controllers/repayController.js';

const router = express.Router();

router.post('/', recordRepayment);

export default router;
