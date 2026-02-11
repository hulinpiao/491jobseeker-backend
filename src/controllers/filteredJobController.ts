import { Request, Response } from 'express';
import filteredJobService, { FilteredJobQuery } from '../models/FilteredJob';

class FilteredJobController {
  /**
   * GET /api/jobs - List filtered jobs with pagination, search, and filter
   */
  async listJobs(req: Request, res: Response): Promise<void> {
    try {
      const query: FilteredJobQuery = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        q: req.query.q as string | undefined,
        location: req.query.location as string | undefined,
        employment_type: req.query.employmentType as string | undefined,
        work_arrangement: req.query.workArrangement as string | undefined,
        platform: req.query.platform as string | undefined,
        min_score: req.query.minScore ? parseFloat(req.query.minScore as string) : undefined,
        date: req.query.date as string | undefined,
        sortBy: req.query.sortBy as string | undefined,
        sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
      };

      const result = await filteredJobService.getJobs(query);
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
      const jobId = Array.isArray(id) ? id[0] : id;
      const job = await filteredJobService.getJobById(jobId);

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

  /**
   * GET /api/jobs/stats/platforms - Get job counts by platform
   */
  async getPlatformStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await filteredJobService.getPlatformCounts();
      res.json(stats);
    } catch (error) {
      console.error('Error getting platform stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * GET /api/jobs/stats/dates - Get available dates with job counts
   */
  async getDateStats(_req: Request, res: Response): Promise<void> {
    try {
      const dates = await filteredJobService.getAvailableDates();
      res.json(dates);
    } catch (error) {
      console.error('Error getting date stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * GET /api/jobs/stats/summary - Get overall statistics
   */
  async getStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await filteredJobService.getStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default new FilteredJobController();
