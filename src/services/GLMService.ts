import { ZhipuAI } from 'zhipuai-sdk-nodejs-v4';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { IncomingMessage } from 'http';

/**
 * Analysis prompt for resume processing
 * Focused on objective, evidence-based analysis
 */
const RESUME_ANALYSIS_PROMPT = `You are a resume analysis engine, not a career coach.
Your task is to objectively analyze a resume using a signal-based and market-oriented approach.

Follow these strict rules:
- Do NOT use subjective praise (e.g. "strong", "excellent", "passionate") unless directly supported by evidence.
- Do NOT infer intentions, interests, or potential. Only analyze what is explicitly present.
- Treat the resume as a set of verifiable professional signals.
- Think like a hiring system, not a human reviewer.

Analysis steps:
1. Extract only factual, verifiable skills and experiences
2. Weight skills by depth (used vs designed vs owned) and scope (personal/team/production)
3. Map signals to common job market role functions
4. Infer job keywords based on how LinkedIn/Indeed/Seek would categorize this resume

Output strictly in JSON format:
{
  "skills": {
    "Programming Languages": ["skill1", "skill2"],
    "Frameworks & Libraries": ["skill1", "skill2"],
    "Tools & Platforms": ["skill1", "skill2"],
    "Databases": ["skill1", "skill2"],
    "Cloud & Infrastructure": ["skill1", "skill2"]
  },
  "summary": "A neutral, evidence-based professional summary (1-2 paragraphs)",
  "jobKeywords": ["job title 1", "job title 2", "job title 3"]
}

Do not include any text outside the JSON object.`;

/**
 * Skill category structure
 */
export interface ISkillCategory {
  category: string;
  items: string[];
}

/**
 * GLM analysis result
 */
export interface GLMAnalysisResult {
  skills: Record<string, string[]>;
  summary: string;
  jobKeywords: string[];
}

/**
 * Service error with retry information
 */
export interface GLMServiceError {
  code: string;
  message: string;
  retryable: boolean;
}

/**
 * Service for AI-powered resume analysis using Zhipu AI GLM
 */
class GLMService {
  private client: ZhipuAI | null = null;
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // 1 second

  constructor() {
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      console.error('ZHIPU_API_KEY not configured');
    } else {
      this.client = new ZhipuAI({ apiKey });
    }
  }

  /**
   * Analyze resume text using GLM-4
   * @param resumeText - Extracted text from resume
   * @returns Analysis result with skills, summary, and job keywords
   */
  async analyzeResume(resumeText: string): Promise<GLMAnalysisResult> {
    if (!this.client) {
      throw {
        code: 'API_NOT_CONFIGURED',
        message: 'GLM API not configured',
        retryable: false,
      } as GLMServiceError;
    }

    if (!resumeText || resumeText.trim().length < 50) {
      throw {
        code: 'INVALID_INPUT',
        message: 'Resume text too short or empty',
        retryable: false,
      } as GLMServiceError;
    }

    return this.retryWithBackoff(async () => {
      try {
        const response = await this.client!.createCompletions({
          model: 'glm-4-flash',
          messages: [
            {
              role: 'user',
              content: `${RESUME_ANALYSIS_PROMPT}\n\nResume:\n${resumeText}`,
            },
          ],
          stream: false,
        });

        // Handle both CompletionsResponseMessage and IncomingMessage types
        let content: string | undefined;
        if ('choices' in response && response.choices) {
          content = response.choices[0]?.message?.content;
        } else if (response instanceof IncomingMessage) {
          // Stream response - need to read the body
          throw new Error('Streaming response not supported. Please set stream: false');
        }

        if (!content) {
          throw new Error('Empty response from GLM API');
        }

        return this.validateResponse(content);
      } catch (error: any) {
        if (error.retryable !== undefined) {
          throw error;
        }
        // Determine if error is retryable
        const isRetryable =
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNRESET' ||
          error.message?.includes('timeout') ||
          error.message?.includes('rate limit') ||
          error.message?.includes('network');

        throw {
          code: 'ANALYSIS_FAILED',
          message: error.message || 'GLM API call failed',
          retryable: isRetryable,
        } as GLMServiceError;
      }
    });
  }

  /**
   * Validate and parse JSON response from GLM
   * @param content - Raw response content
   * @returns Parsed analysis result
   */
  private validateResponse(content: string): GLMAnalysisResult {
    try {
      // Extract JSON from content (in case of extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!parsed.skills || typeof parsed.skills !== 'object') {
        throw new Error('Invalid or missing skills in response');
      }

      if (!parsed.summary || typeof parsed.summary !== 'string') {
        throw new Error('Invalid or missing summary in response');
      }

      // Ensure jobKeywords has at least 3 items
      if (!Array.isArray(parsed.jobKeywords) || parsed.jobKeywords.length < 3) {
        parsed.jobKeywords = [
          'Software Developer',
          'Software Engineer',
          'Full Stack Developer',
        ];
      }

      return parsed as GLMAnalysisResult;
    } catch (error: any) {
      throw {
        code: 'INVALID_RESPONSE',
        message: `Failed to parse GLM response: ${error.message}`,
        retryable: true,
      } as GLMServiceError;
    }
  }

  /**
   * Retry logic with exponential backoff
   * @param fn - Function to retry
   * @param attempt - Current attempt number
   * @returns Function result
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt >= this.maxRetries || !(error as GLMServiceError).retryable) {
        throw error;
      }

      const delay = this.baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));

      return this.retryWithBackoff(fn, attempt + 1);
    }
  }

  /**
   * Extract text from file buffer based on MIME type
   * @param buffer - File content
   * @param mimeType - File MIME type
   * @returns Extracted text
   */
  async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'application/pdf':
        return await this.extractTextFromPDF(buffer);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await this.extractTextFromDOCX(buffer);
      case 'application/msword':
        // For DOC files, we'll do basic text extraction
        // Note: Full DOC parsing requires additional libraries
        return await this.extractTextFromDOC(buffer);
      case 'text/plain':
        return buffer.toString('utf-8');
      default:
        throw {
          code: 'UNSUPPORTED_TYPE',
          message: `Unsupported MIME type: ${mimeType}`,
          retryable: false,
        } as GLMServiceError;
    }
  }

  /**
   * Extract text from PDF
   * @param buffer - PDF file buffer
   * @returns Extracted text
   */
  private async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const pdfParser = new PDFParse({ data: buffer });
      const textResult = await pdfParser.getText();
      return textResult.text;
    } catch (error: any) {
      throw {
        code: 'EXTRACTION_FAILED',
        message: `Failed to extract PDF text: ${error.message}`,
        retryable: false,
      } as GLMServiceError;
    }
  }

  /**
   * Extract text from DOCX
   * @param buffer - DOCX file buffer
   * @returns Extracted text
   */
  private async extractTextFromDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error: any) {
      throw {
        code: 'EXTRACTION_FAILED',
        message: `Failed to extract DOCX text: ${error.message}`,
        retryable: false,
      } as GLMServiceError;
    }
  }

  /**
   * Extract text from DOC (basic implementation)
   * Note: This is a placeholder. Full DOC parsing requires additional libraries
   * @param buffer - DOC file buffer
   * @returns Extracted text (or placeholder)
   */
  private async extractTextFromDOC(buffer: Buffer): Promise<string> {
    // Basic text extraction from DOC files
    // This is a simplified implementation
    // For production, consider using antiword or similar tools
    try {
      // Attempt to extract readable text
      const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 10000));
      // Filter out binary content
      const cleanedText = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
      if (cleanedText.trim().length < 100) {
        throw new Error('Could not extract meaningful text from DOC file');
      }
      return cleanedText;
    } catch (error: any) {
      throw {
        code: 'EXTRACTION_FAILED',
        message: `Failed to extract DOC text. Please convert to DOCX or PDF: ${error.message}`,
        retryable: false,
      } as GLMServiceError;
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }
}

export default new GLMService();
