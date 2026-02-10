import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import resumeController from '../controllers/resumeController';
import { uploadSingle } from '../middleware/uploadMiddleware';

const router = Router();

/**
 * All resume routes require authentication
 */
router.use(authenticate);

/**
 * POST /api/resume/upload
 * Upload a new resume file
 * Body: multipart/form-data with 'file' field
 */
router.post('/upload', uploadSingle, resumeController.uploadResume.bind(resumeController));

/**
 * GET /api/resume/:id
 * Get resume metadata and analysis status
 */
router.get('/:id', resumeController.getResume.bind(resumeController));

/**
 * POST /api/resume/analyze/:id
 * Analyze resume with AI (creates new analysis or returns existing)
 */
router.post('/analyze/:id', resumeController.analyzeResume.bind(resumeController));

/**
 * DELETE /api/resume/:id
 * Delete a resume and its analysis
 */
router.delete('/:id', resumeController.deleteResume.bind(resumeController));

export default router;
