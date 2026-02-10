import GLMService, { GLMAnalysisResult, GLMServiceError } from '../services/GLMService';
import { ZhipuAI } from 'zhipuai-sdk-nodejs-v4';

// Mock the SDK
jest.mock('zhipuai-sdk-nodejs-v4');
jest.mock('pdf-parse');
jest.mock('mammoth');

import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

describe('GLMService', () => {
  const mockCreateCompletions = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (ZhipuAI as jest.MockedClass<typeof ZhipuAI>).mockImplementation(() => ({
      createCompletions: mockCreateCompletions,
    } as any));
    process.env.ZHIPU_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.ZHIPU_API_KEY;
  });

  const createMockAnalysis = (overrides?: Partial<GLMAnalysisResult>): string => {
    const analysis: GLMAnalysisResult = {
      skills: {
        'Programming Languages': ['JavaScript', 'Python', 'TypeScript'],
        'Frameworks & Libraries': ['React', 'Express', 'Node.js'],
        'Tools & Platforms': ['Git', 'Docker', 'AWS'],
        'Databases': ['MongoDB', 'PostgreSQL'],
        'Cloud & Infrastructure': ['AWS', 'Vercel'],
      },
      summary: 'A software developer with 3+ years of experience in full-stack development...',
      jobKeywords: ['Full Stack Developer', 'Software Engineer', 'Backend Developer'],
      ...overrides,
    };
    return JSON.stringify(analysis);
  };

  describe('isConfigured', () => {
    it('should return true when API key is set', () => {
      expect(GLMService.isConfigured()).toBe(true);
    });

    it('should return false when API key is not set', () => {
      delete process.env.ZHIPU_API_KEY;
      // Re-create service instance
      const { default: FreshGLMService } = require('../services/GLMService');
      expect(FreshGLMService.isConfigured()).toBe(false);
    });
  });

  describe('analyzeResume', () => {
    it('should return parsed analysis on success', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: createMockAnalysis(),
            },
          },
        ],
      };

      mockCreateCompletions.mockResolvedValue(mockResponse);

      const result = await GLMService.analyzeResume('Sample resume text with sufficient content');

      expect(result).toHaveProperty('skills');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('jobKeywords');
      expect(result.jobKeywords.length).toBeGreaterThanOrEqual(3);
      expect(mockCreateCompletions).toHaveBeenCalledTimes(1);
    });

    it('should retry on timeout error', async () => {
      mockCreateCompletions
        .mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'timeout' })
        .mockResolvedValueOnce({
          choices: [{ message: { content: createMockAnalysis() } }],
        });

      const result = await GLMService.analyzeResume('Sample resume text with sufficient content');

      expect(result).toHaveProperty('skills');
      expect(mockCreateCompletions).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const error: GLMServiceError = {
        code: 'ANALYSIS_FAILED',
        message: 'timeout',
        retryable: true,
      };

      mockCreateCompletions.mockRejectedValue(error);

      await expect(GLMService.analyzeResume('Sample resume text')).rejects.toMatchObject({
        code: 'ANALYSIS_FAILED',
      });

      expect(mockCreateCompletions).toHaveBeenCalledTimes(3); // maxRetries
    });

    it('should throw on empty resume text', async () => {
      await expect(GLMService.analyzeResume('')).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    });

    it('should throw on short resume text', async () => {
      await expect(GLMService.analyzeResume('abc')).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    });

    it('should provide default keywords if insufficient', async () => {
      const partialAnalysis = createMockAnalysis({
        jobKeywords: ['Only One'],
      });

      mockCreateCompletions.mockResolvedValue({
        choices: [{ message: { content: partialAnalysis } }],
      });

      const result = await GLMService.analyzeResume('Sample resume text with sufficient content');

      expect(result.jobKeywords.length).toBeGreaterThanOrEqual(3);
    });

    it('should extract JSON from text with extra content', async () => {
      const responseWithExtra = `Here is the analysis:
${createMockAnalysis()}
End of analysis.`;

      mockCreateCompletions.mockResolvedValue({
        choices: [{ message: { content: responseWithExtra } }],
      });

      const result = await GLMService.analyzeResume('Sample resume text with sufficient content');

      expect(result).toHaveProperty('skills');
      expect(result).toHaveProperty('summary');
    });

    it('should throw on malformed JSON response', async () => {
      mockCreateCompletions.mockResolvedValue({
        choices: [{ message: { content: 'Not valid JSON at all' } }],
      });

      await expect(GLMService.analyzeResume('Sample resume text')).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      });
    });

    it('should throw on missing skills in response', async () => {
      const invalidAnalysis = JSON.stringify({
        summary: 'A summary',
        jobKeywords: ['Developer'],
      });

      mockCreateCompletions.mockResolvedValue({
        choices: [{ message: { content: invalidAnalysis } }],
      });

      await expect(GLMService.analyzeResume('Sample resume text')).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      });
    });

    it('should throw on empty response content', async () => {
      mockCreateCompletions.mockResolvedValue({
        choices: [{}],
      });

      await expect(GLMService.analyzeResume('Sample resume text')).rejects.toThrow();
    });
  });

  describe('extractText', () => {
    it('should extract text from plain text buffer', async () => {
      const buffer = Buffer.from('Sample text content', 'utf-8');

      const result = await GLMService.extractText(buffer, 'text/plain');

      expect(result).toBe('Sample text content');
    });

    it('should extract text from PDF', async () => {
      const buffer = Buffer.from('pdf content');

      const result = await GLMService.extractText(buffer, 'application/pdf');

      // PDF parsing should work (using actual pdf-parse)
      expect(result).toBeTruthy();
    });

    it('should extract text from DOCX', async () => {
      const buffer = Buffer.from('docx content');
      const mockResult = { value: 'Extracted DOCX text' };
      (mammoth.extractRawText as jest.Mock).mockResolvedValue(mockResult);

      const result = await GLMService.extractText(buffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

      expect(result).toBe('Extracted DOCX text');
      expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer });
    });

    it('should throw on unsupported MIME type', async () => {
      await expect(
        GLMService.extractText(Buffer.from(''), 'application/unsupported')
      ).rejects.toMatchObject({
        code: 'UNSUPPORTED_TYPE',
      });
    });

    it('should throw on DOCX extraction failure', async () => {
      const buffer = Buffer.from('docx content');
      (mammoth.extractRawText as jest.Mock).mockRejectedValue(new Error('DOCX parsing failed'));

      await expect(
        GLMService.extractText(buffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      ).rejects.toMatchObject({
        code: 'EXTRACTION_FAILED',
      });
    });
  });

  describe('extractTextFromDOC', () => {
    it('should extract readable text from DOC', async () => {
      const readableContent = 'This is readable text from a DOC file More readable text here';
      const buffer = Buffer.from(readableContent, 'utf-8');

      const result = await GLMService.extractText(buffer, 'application/msword');

      // Should contain some readable characters
      expect(result.length).toBeGreaterThan(50);
    });
  });
});
