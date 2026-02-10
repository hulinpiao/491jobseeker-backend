import { Response } from 'express';
import ResumeService from '../services/ResumeService';
import GLMService from '../services/GLMService';
import ResumeAnalysis from '../models/ResumeAnalysis';
import User from '../models/User';
import { AuthRequest } from '../middleware/authMiddleware';

/**
 * Upload response
 */
interface UploadResponse {
  success: true;
  data: {
    resumeId: string;
    fileName: string;
    uploadDate: string;
  };
}

/**
 * Analysis response
 */
interface AnalysisResponse {
  success: true;
  data: {
    skills: { category: string; items: string[] }[];
    summary: string;
    jobKeywords: string[];
  };
}

/**
 * Error response
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

/**
 * Helper function to safely get string from route params
 */
function getRouteParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

/**
 * Controller for resume operations
 */
class ResumeController {
  /**
   * POST /api/resume/upload
   * Upload a resume file
   */
  async uploadResume(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
            retryable: false,
          },
        } as ErrorResponse);
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE',
            message: 'No file uploaded',
            retryable: false,
          },
        } as ErrorResponse);
        return;
      }

      // Save to GridFS
      const { resumeId, fileName } = await ResumeService.saveResume(
        req.file,
        userId
      );

      // Update user with resume info
      await User.findByIdAndUpdate(userId, {
        'profile.resumeId': resumeId,
        'profile.resumeFileName': fileName,
        'profile.resumeUploadDate': new Date(),
      });

      const response: UploadResponse = {
        success: true,
        data: {
          resumeId,
          fileName,
          uploadDate: new Date().toISOString(),
        },
      };

      res.status(201).json(response);
    } catch (error: any) {
      const isRetryable =
        error.message?.includes('timeout') ||
        error.message?.includes('network') ||
        error.retryable;

      res.status(500).json({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: error.message || 'Failed to upload resume',
          retryable: isRetryable ?? false,
        },
      } as ErrorResponse);
    }
  }

  /**
   * GET /api/resume/:id
   * Get resume metadata and analysis status
   */
  async getResume(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
            retryable: false,
          },
        } as ErrorResponse);
        return;
      }

      // Get resume metadata
      const resumeId = getRouteParam(id);
      const resume = await ResumeService.getResumeById(resumeId);

      if (!resume) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Resume not found',
            retryable: false,
          },
        } as ErrorResponse);
        return;
      }

      // Check ownership
      if (resume.metadata.userId !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
            retryable: false,
          },
        } as ErrorResponse);
        return;
      }

      // Check for existing analysis
      const analysis = await ResumeAnalysis.findOne({ resumeId: resumeId });

      res.status(200).json({
        success: true,
        data: {
          resumeId,
          fileName: resume.fileName,
          uploadDate: resume.uploadDate,
          hasAnalysis: !!analysis,
          analysis: analysis
            ? {
                skills: analysis.skills,
                summary: analysis.summary,
                jobKeywords: analysis.jobKeywords,
              }
            : null,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_FAILED',
          message: error.message || 'Failed to retrieve resume',
          retryable: false,
        },
      } as ErrorResponse);
    }
  }

  /**
   * POST /api/resume/analyze/:id
   * Analyze resume with AI
   */
  async analyzeResume(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
            retryable: false,
          },
        } as ErrorResponse);
        return;
      }

      // Get resume
      const resumeId = getRouteParam(id);
      const resume = await ResumeService.getResumeById(resumeId);

      if (!resume) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Resume not found',
            retryable: false,
          },
        } as ErrorResponse);
        return;
      }

      // Check ownership
      if (resume.metadata.userId !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
            retryable: false,
          },
        } as ErrorResponse);
        return;
      }

      // Check for existing analysis
      const existing = await ResumeAnalysis.findOne({ resumeId: resumeId });
      if (existing) {
        res.status(200).json({
          success: true,
          data: {
            skills: existing.skills,
            summary: existing.summary,
            jobKeywords: existing.jobKeywords,
          },
        } as AnalysisResponse);
        return;
      }

      // Get file buffer from GridFS
      const fileBuffer = await ResumeService.getResumeFile(resumeId);

      // Extract text from file
      const resumeText = await GLMService.extractText(
        fileBuffer,
        resume.metadata.mimeType
      );

      // Analyze with GLM
      const analysisResult = await GLMService.analyzeResume(resumeText);

      // Convert skills to array format
      const skills = Object.entries(analysisResult.skills).map(
        ([category, items]) => ({ category, items })
      );

      // Save analysis to database
      await ResumeAnalysis.create({
        userId,
        resumeId: resumeId,
        skills,
        summary: analysisResult.summary,
        jobKeywords: analysisResult.jobKeywords,
      });

      res.status(200).json({
        success: true,
        data: {
          skills,
          summary: analysisResult.summary,
          jobKeywords: analysisResult.jobKeywords,
        },
      } as AnalysisResponse);
    } catch (error: any) {
      const isRetryable =
        error.code === 'ANALYSIS_FAILED' && error.retryable;

      res.status(isRetryable ? 503 : 500).json({
        success: false,
        error: {
          code: error.code || 'ANALYSIS_FAILED',
          message: error.message || 'Failed to analyze resume',
          retryable: isRetryable ?? false,
        },
      } as ErrorResponse);
    }
  }

  /**
   * DELETE /api/resume/:id
   * Delete a resume
   */
  async deleteResume(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
            retryable: false,
          },
        } as ErrorResponse);
        return;
      }

      // Get resume to check ownership
      const resumeId = getRouteParam(id);
      const resume = await ResumeService.getResumeById(resumeId);

      if (!resume) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Resume not found',
            retryable: false,
          },
        } as ErrorResponse);
        return;
      }

      if (resume.metadata.userId !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
            retryable: false,
          },
        } as ErrorResponse);
        return;
      }

      // Delete from GridFS
      await ResumeService.deleteResume(resumeId);

      // Delete analysis
      await ResumeAnalysis.deleteOne({ resumeId: resumeId });

      // Update user
      await User.findByIdAndUpdate(userId, {
        $unset: {
          'profile.resumeId': '',
          'profile.resumeFileName': '',
          'profile.resumeUploadDate': '',
        },
      });

      res.status(200).json({
        success: true,
        message: 'Resume deleted successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: error.message || 'Failed to delete resume',
          retryable: false,
        },
      } as ErrorResponse);
    }
  }
}

export default new ResumeController();
