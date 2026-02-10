import request from 'supertest';
import mongoose from 'mongoose';
import app from '../index';
import { authenticate } from '../middleware/authMiddleware';
import ResumeService from '../services/ResumeService';

// Mock auth middleware
jest.mock('../middleware/authMiddleware');
jest.mock('../services/ResumeService');
jest.mock('../services/GLMService');
jest.mock('../models/User');
jest.mock('../models/ResumeAnalysis');

import ResumeAnalysis from '../models/ResumeAnalysis';
import User from '../models/User';
import GLMService from '../services/GLMService';

describe('Resume API Integration Tests', () => {
  const mockUserId = '507f1f77bcf86cd799439011';

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/test-resume-api');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (authenticate as jest.Mock).mockImplementation((req, _res, next) => {
      req.user = { id: mockUserId, email: 'test@example.com' };
      next();
    });
  });

  describe('POST /api/resume/upload', () => {
    it('should upload a PDF file', async () => {
      const mockUploadResult = {
        resumeId: '507f1f77bcf86cd799439012',
        fileName: 'resume.pdf',
      };

      (ResumeService.saveResume as jest.Mock).mockResolvedValue(mockUploadResult);
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/resume/upload')
        .attach('file', Buffer.from('test pdf content'), 'resume.pdf')
        .set('Content-Type', 'multipart/form-data');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('resumeId');
      expect(response.body.data.fileName).toBe('resume.pdf');
    });

    it('should reject when no file is provided', async () => {
      const response = await request(app)
        .post('/api/resume/upload')
        .set('Content-Type', 'multipart/form-data');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_FILE');
    });

    it('should handle upload errors', async () => {
      (ResumeService.saveResume as jest.Mock).mockRejectedValue(
        new Error('File size exceeds 5MB limit')
      );

      const response = await request(app)
        .post('/api/resume/upload')
        .attach('file', Buffer.from('test content'), 'resume.pdf')
        .set('Content-Type', 'multipart/form-data');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/resume/:id', () => {
    it('should retrieve resume metadata', async () => {
      const mockResume = {
        id: '507f1f77bcf86cd799439012',
        fileName: 'resume.pdf',
        uploadDate: new Date(),
        metadata: {
          userId: mockUserId,
          mimeType: 'application/pdf',
          uploadDate: new Date(),
        },
      };

      (ResumeService.getResumeById as jest.Mock).mockResolvedValue(mockResume);
      (ResumeAnalysis.findOne as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/resume/507f1f77bcf86cd799439012');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.resumeId).toBe('507f1f77bcf86cd799439012');
    });

    it('should return 404 for non-existent resume', async () => {
      (ResumeService.getResumeById as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/resume/507f1f77bcf86cd799439011');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 403 for unauthorized access', async () => {
      const mockResume = {
        id: '507f1f77bcf86cd799439012',
        fileName: 'resume.pdf',
        uploadDate: new Date(),
        metadata: {
          userId: '507f1f77bcf86cd799439099', // Different user
          mimeType: 'application/pdf',
          uploadDate: new Date(),
        },
      };

      (ResumeService.getResumeById as jest.Mock).mockResolvedValue(mockResume);

      const response = await request(app).get('/api/resume/507f1f77bcf86cd799439012');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /api/resume/analyze/:id', () => {
    it('should analyze resume and return results', async () => {
      const mockResume = {
        id: '507f1f77bcf86cd799439012',
        fileName: 'resume.pdf',
        uploadDate: new Date(),
        metadata: {
          userId: mockUserId,
          mimeType: 'application/pdf',
          uploadDate: new Date(),
        },
      };

      const mockAnalysisResult = {
        skills: {
          'Programming Languages': ['JavaScript', 'Python'],
          'Frameworks & Libraries': ['React', 'Express'],
        },
        summary: 'A skilled software developer...',
        jobKeywords: ['Full Stack Developer', 'Software Engineer'],
      };

      const mockFileBuffer = Buffer.from('resume text content');

      (ResumeService.getResumeById as jest.Mock).mockResolvedValue(mockResume);
      (ResumeAnalysis.findOne as jest.Mock).mockResolvedValue(null);
      (ResumeService.getResumeFile as jest.Mock).mockResolvedValue(mockFileBuffer);
      (GLMService.extractText as jest.Mock).mockResolvedValue('extracted resume text');
      (GLMService.analyzeResume as jest.Mock).mockResolvedValue(mockAnalysisResult);
      (ResumeAnalysis.create as jest.Mock).mockResolvedValue({});

      const response = await request(app).post('/api/resume/analyze/507f1f77bcf86cd799439012');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('skills');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('jobKeywords');
    });

    it('should return existing analysis if already performed', async () => {
      const mockResume = {
        id: '507f1f77bcf86cd799439012',
        fileName: 'resume.pdf',
        uploadDate: new Date(),
        metadata: {
          userId: mockUserId,
          mimeType: 'application/pdf',
          uploadDate: new Date(),
        },
      };

      const mockExistingAnalysis = {
        skills: [
          { category: 'Programming Languages', items: ['JavaScript'] },
        ],
        summary: 'Existing summary',
        jobKeywords: ['Developer'],
      };

      (ResumeService.getResumeById as jest.Mock).mockResolvedValue(mockResume);
      (ResumeAnalysis.findOne as jest.Mock).mockResolvedValue(mockExistingAnalysis);

      const response = await request(app).post('/api/resume/analyze/507f1f77bcf86cd799439012');

      expect(response.status).toBe(200);
      expect(response.body.data.summary).toBe('Existing summary');
      expect(GLMService.analyzeResume).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent resume', async () => {
      (ResumeService.getResumeById as jest.Mock).mockResolvedValue(null);

      const response = await request(app).post('/api/resume/analyze/507f1f77bcf86cd799439011');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/resume/:id', () => {
    it('should delete resume successfully', async () => {
      const mockResume = {
        id: '507f1f77bcf86cd799439012',
        fileName: 'resume.pdf',
        uploadDate: new Date(),
        metadata: {
          userId: mockUserId,
          mimeType: 'application/pdf',
          uploadDate: new Date(),
        },
      };

      (ResumeService.getResumeById as jest.Mock).mockResolvedValue(mockResume);
      (ResumeService.deleteResume as jest.Mock).mockResolvedValue(undefined);
      (ResumeAnalysis.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      const response = await request(app).delete('/api/resume/507f1f77bcf86cd799439012');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent resume', async () => {
      (ResumeService.getResumeById as jest.Mock).mockResolvedValue(null);

      const response = await request(app).delete('/api/resume/507f1f77bcf86cd799439011');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 403 for unauthorized access', async () => {
      const mockResume = {
        id: '507f1f77bcf86cd799439012',
        fileName: 'resume.pdf',
        uploadDate: new Date(),
        metadata: {
          userId: '507f1f77bcf86cd799439099', // Different user
          mimeType: 'application/pdf',
          uploadDate: new Date(),
        },
      };

      (ResumeService.getResumeById as jest.Mock).mockResolvedValue(mockResume);

      const response = await request(app).delete('/api/resume/507f1f77bcf86cd799439012');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      (authenticate as jest.Mock).mockImplementation((_req, res, _next) => {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      });

      const response = await request(app).get('/api/resume/507f1f77bcf86cd799439012');

      expect(response.status).toBe(401);
    });
  });
});
