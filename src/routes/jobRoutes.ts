import { Router } from 'express';
import jobController from '../controllers/jobController';

const router = Router();

/**
 * GET /api/jobs
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 100)
 * - q: string (keyword search)
 * - location: string (city or state)
 * - employment_type: string
 * - work_arrangement: string
 * - sortBy: string (default: created_at)
 * - sortOrder: 'asc' | 'desc' (default: desc)
 */
router.get('/jobs', jobController.listJobs.bind(jobController));

/**
 * GET /api/jobs/:id
 */
router.get('/jobs/:id', jobController.getJob.bind(jobController));

export default router;
