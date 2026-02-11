import { Router } from 'express';
import filteredJobController from '../controllers/filteredJobController';

const router = Router();

/**
 * GET /api/jobs
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 100)
 * - q: string (keyword search in title, description, company)
 * - location: string (city or state)
 * - employmentType: string (employment_type filter)
 * - workArrangement: string (work_arrangement filter)
 * - platform: string (linkedin|indeed|seek)
 * - minScore: number (minimum match_score)
 * - date: string (YYYY-MM-DD format)
 * - sortBy: string (default: updated_at)
 * - sortOrder: 'asc' | 'desc' (default: desc)
 */
router.get('/jobs', filteredJobController.listJobs.bind(filteredJobController));

/**
 * GET /api/jobs/stats/summary
 * Returns overall statistics including platform breakdown and average score
 */
router.get('/jobs/stats/summary', filteredJobController.getStats.bind(filteredJobController));

/**
 * GET /api/jobs/stats/platforms
 * Returns job counts grouped by platform
 */
router.get('/jobs/stats/platforms', filteredJobController.getPlatformStats.bind(filteredJobController));

/**
 * GET /api/jobs/stats/dates
 * Returns available dates with job data
 */
router.get('/jobs/stats/dates', filteredJobController.getDateStats.bind(filteredJobController));

/**
 * GET /api/jobs/:id
 */
router.get('/jobs/:id', filteredJobController.getJob.bind(filteredJobController));

export default router;
