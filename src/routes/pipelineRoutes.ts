import express from 'express';
import pipelineController from '../controllers/pipelineController';

const router = express.Router();

/**
 * Pipeline routes for triggering and monitoring job scraper ETL pipeline
 */

// GET /api/pipeline/status - Get current pipeline status
router.get('/status', pipelineController.getStatus);

// POST /api/pipeline/trigger - Manually trigger pipeline run
router.post('/trigger', pipelineController.triggerPipeline);

export default router;
