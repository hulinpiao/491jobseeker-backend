import request from 'supertest';
import mongoose from 'mongoose';
import app from '../index';
import { connectDatabase, disconnectDatabase } from '../config/database';

describe('Job API', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
    });
  });

  describe('GET /api/jobs', () => {
    it('should return paginated jobs with default parameters', async () => {
      const response = await request(app).get('/api/jobs');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 10);
      expect(response.body).toHaveProperty('totalPages');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should respect custom page and limit parameters', async () => {
      const response = await request(app).get('/api/jobs?page=2&limit=5');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('page', 2);
      expect(response.body).toHaveProperty('limit', 5);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should limit max results to 100', async () => {
      const response = await request(app).get('/api/jobs?limit=1000');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('limit', 100);
    });

    it('should filter by keyword search', async () => {
      const response = await request(app).get('/api/jobs?q=engineer');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter by location', async () => {
      const response = await request(app).get('/api/jobs?location=Sydney');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      if (response.body.data.length > 0) {
        const job = response.body.data[0];
        const matchesCity = new RegExp('Sydney', 'i').test(job.city);
        const matchesState = new RegExp('Sydney', 'i').test(job.state);
        expect(matchesCity || matchesState).toBe(true);
      }
    });

    it('should filter by employment_type', async () => {
      const response = await request(app).get('/api/jobs?employment_type=contract');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      if (response.body.data.length > 0) {
        expect(response.body.data[0]).toHaveProperty('employment_type', 'contract');
      }
    });

    it('should filter by work_arrangement', async () => {
      const response = await request(app).get('/api/jobs?work_arrangement=remote');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      if (response.body.data.length > 0) {
        expect(response.body.data[0]).toHaveProperty('work_arrangement', 'remote');
      }
    });

    it('should sort by created_at descending by default', async () => {
      const response = await request(app).get('/api/jobs?limit=10');
      expect(response.status).toBe(200);
      if (response.body.data.length > 1) {
        const firstDate = new Date(response.body.data[0].created_at).getTime();
        const secondDate = new Date(response.body.data[1].created_at).getTime();
        expect(firstDate).toBeGreaterThanOrEqual(secondDate);
      }
    });

    it('should handle multiple filters together', async () => {
      const response = await request(app).get('/api/jobs?employment_type=full_time&page=1&limit=5');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('should return a single job by valid ID', async () => {
      // First get a job ID from the list
      const listResponse = await request(app).get('/api/jobs?limit=1');
      if (listResponse.body.data.length > 0) {
        const jobId = listResponse.body.data[0]._id;
        const response = await request(app).get(`/api/jobs/${jobId}`);
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('_id', jobId);
        expect(response.body).toHaveProperty('job_title');
      }
    });

    it('should return 404 for non-existent ID', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app).get(`/api/jobs/${fakeId}`);
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Job not found');
    });

    it('should return 404 for invalid ID format', async () => {
      const response = await request(app).get('/api/jobs/invalid-id');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Job not found');
    });
  });
});
