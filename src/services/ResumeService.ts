import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';

/**
 * Allowed MIME types for resume upload
 */
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

/**
 * Maximum file size: 5MB
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Resume metadata result from GridFS
 */
export interface ResumeMetadata {
  id: string;
  fileName: string;
  uploadDate: Date;
  metadata: {
    userId: string;
    mimeType: string;
    uploadDate: Date;
  };
}

/**
 * Resume upload result
 */
export interface ResumeUploadResult {
  resumeId: string;
  fileName: string;
}

/**
 * Service for handling resume storage operations using GridFS
 */
class ResumeService {
  private bucket: GridFSBucket | null = null;

  constructor() {
    this.initBucket();
  }

  /**
   * Initialize GridFS bucket
   */
  private initBucket(): void {
    const db = mongoose.connection.db;
    if (db) {
      this.bucket = new GridFSBucket(db, {
        bucketName: 'resumes',
      });
    }
  }

  /**
   * Get the GridFS bucket (lazy initialization)
   */
  private getBucket(): GridFSBucket {
    if (!this.bucket) {
      this.initBucket();
    }
    if (!this.bucket) {
      throw new Error('GridFS bucket not initialized. Database not connected.');
    }
    return this.bucket;
  }

  /**
   * Save resume file to GridFS
   * @param file - Uploaded file from multer
   * @param userId - User ID who owns the resume
   * @returns Upload result with resume ID and filename
   */
  async saveResume(
    file: Express.Multer.File,
    userId: string
  ): Promise<ResumeUploadResult> {
    // Validate file
    this.validateFile(file);

    const bucket = this.getBucket();

    // Upload to GridFS
    const uploadStream = bucket.openUploadStream(file.originalname, {
      metadata: {
        userId,
        mimeType: file.mimetype,
        uploadDate: new Date(),
      },
    });

    return new Promise((resolve, reject) => {
      uploadStream.end(file.buffer);
      uploadStream.on('finish', () => {
        resolve({
          resumeId: uploadStream.id.toString(),
          fileName: file.originalname,
        });
      });
      uploadStream.on('error', reject);
    });
  }

  /**
   * Get resume metadata by ID
   * @param resumeId - Resume file ID
   * @returns Resume metadata or null if not found
   */
  async getResumeById(resumeId: string): Promise<ResumeMetadata | null> {
    const bucket = this.getBucket();

    const files = await bucket
      .find({ _id: new ObjectId(resumeId) })
      .toArray();

    if (files.length === 0) {
      return null;
    }

    const file = files[0];
    return {
      id: file._id.toString(),
      fileName: file.filename,
      uploadDate: file.uploadDate,
      metadata: file.metadata as ResumeMetadata['metadata'],
    };
  }

  /**
   * Get resume file content by ID
   * @param resumeId - Resume file ID
   * @returns File buffer
   */
  async getResumeFile(resumeId: string): Promise<Buffer> {
    const bucket = this.getBucket();

    return new Promise((resolve, reject) => {
      const downloadStream = bucket.openDownloadStream(
        new ObjectId(resumeId)
      );
      const chunks: Buffer[] = [];

      downloadStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      downloadStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      downloadStream.on('error', reject);
    });
  }

  /**
   * Delete resume from GridFS
   * @param resumeId - Resume file ID
   */
  async deleteResume(resumeId: string): Promise<void> {
    const bucket = this.getBucket();
    await bucket.delete(new ObjectId(resumeId));
  }

  /**
   * Validate file type and size
   * @param file - File to validate
   * @throws Error if validation fails
   */
  validateFile(file: Express.Multer.File): void {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds 5MB limit');
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
      throw new Error(
        'Invalid file type. Allowed: PDF, DOC, DOCX, TXT'
      );
    }
  }

  /**
   * Check if a file exists in GridFS
   * @param resumeId - Resume file ID
   * @returns True if file exists
   */
  async resumeExists(resumeId: string): Promise<boolean> {
    const bucket = this.getBucket();
    const files = await bucket
      .find({ _id: new ObjectId(resumeId) })
      .limit(1)
      .toArray();
    return files.length > 0;
  }
}

export default new ResumeService();
