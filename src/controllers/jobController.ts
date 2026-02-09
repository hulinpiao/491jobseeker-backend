import { Request, Response } from 'express';
import jobService from '../services/jobService';
import { JobQuery } from '../models/Job';

class JobController {
  /**
   * GET /api/jobs - List jobs with pagination, search, and filter
   */
  async listJobs(req: Request, res: Response): Promise<void> {
    try {
      const query: JobQuery = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        q: req.query.q as string | undefined,
        location: req.query.location as string | undefined,
        employment_type: req.query.employment_type as string | undefined,
        work_arrangement: req.query.work_arrangement as string | undefined,
        sortBy: req.query.sortBy as string | undefined,
        sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
      };

      const result = await jobService.getJobs(query);
      res.json(result);
    } catch (error) {
      console.error('Error listing jobs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * GET /api/jobs/:id - Get a single job by ID
   */
  async getJob(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Ensure id is a string (Express params can be string[])
      const jobId = Array.isArray(id) ? id[0] : id;
      const job = await jobService.getJobById(jobId);

      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      res.json(job);
    } catch (error) {
      console.error('Error getting job:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default new JobController();
