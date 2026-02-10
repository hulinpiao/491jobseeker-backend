import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import ResumeService from '../services/ResumeService';

// Mock mongoose connection
const mockMongodbUri = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/test-resume-service';

describe('ResumeService', () => {
  let bucket: GridFSBucket;

  beforeAll(async () => {
    await mongoose.connect(mockMongodbUri);
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Failed to connect to database');
    }
    bucket = new GridFSBucket(db, {
      bucketName: 'resumes',
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  afterEach(async () => {
    // Clean up GridFS
    const files = await bucket.find().toArray();
    for (const file of files) {
      await bucket.delete(file._id);
    }
  });

  const createMockFile = (
    name: string,
    mimeType: string,
    size: number
  ): Express.Multer.File => ({
    originalname: name,
    mimetype: mimeType,
    size,
    buffer: Buffer.from('test content'),
    fieldname: 'file',
    encoding: '7bit',
    destination: '',
    filename: name,
    path: '',
    stream: null as any,
  });

  describe('validateFile', () => {
    it('should accept valid PDF file', () => {
      const file = createMockFile('resume.pdf', 'application/pdf', 1024 * 1024);
      expect(() => ResumeService.validateFile(file)).not.toThrow();
    });

    it('should accept valid DOCX file', () => {
      const file = createMockFile(
        'resume.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        1024 * 1024
      );
      expect(() => ResumeService.validateFile(file)).not.toThrow();
    });

    it('should accept valid DOC file', () => {
      const file = createMockFile('resume.doc', 'application/msword', 1024 * 1024);
      expect(() => ResumeService.validateFile(file)).not.toThrow();
    });

    it('should accept valid TXT file', () => {
      const file = createMockFile('resume.txt', 'text/plain', 1024);
      expect(() => ResumeService.validateFile(file)).not.toThrow();
    });

    it('should reject file exceeding 5MB', () => {
      const file = createMockFile('large.pdf', 'application/pdf', 6 * 1024 * 1024);
      expect(() => ResumeService.validateFile(file)).toThrow('File size exceeds 5MB limit');
    });

    it('should reject exactly 5MB + 1 byte file', () => {
      const file = createMockFile('large.pdf', 'application/pdf', 5 * 1024 * 1024 + 1);
      expect(() => ResumeService.validateFile(file)).toThrow('File size exceeds 5MB limit');
    });

    it('should accept exactly 5MB file', () => {
      const file = createMockFile('large.pdf', 'application/pdf', 5 * 1024 * 1024);
      expect(() => ResumeService.validateFile(file)).not.toThrow();
    });

    it('should reject invalid file type (exe)', () => {
      const file = createMockFile('malware.exe', 'application/x-msdownload', 1024);
      expect(() => ResumeService.validateFile(file)).toThrow('Invalid file type');
    });

    it('should reject image file', () => {
      const file = createMockFile('image.png', 'image/png', 1024);
      expect(() => ResumeService.validateFile(file)).toThrow('Invalid file type');
    });
  });

  describe('saveResume', () => {
    it('should save file to GridFS', async () => {
      const file = createMockFile('test.pdf', 'application/pdf', 1024);
      const userId = 'user123';

      const result = await ResumeService.saveResume(file, userId);

      expect(result).toHaveProperty('resumeId');
      expect(result.fileName).toBe('test.pdf');
      expect(typeof result.resumeId).toBe('string');
    });

    it('should throw error for invalid file', async () => {
      const file = createMockFile('malware.exe', 'application/x-msdownload', 1024);

      await expect(ResumeService.saveResume(file, 'user123')).rejects.toThrow(
        'Invalid file type'
      );
    });
  });

  describe('getResumeById', () => {
    it('should retrieve file metadata', async () => {
      const file = createMockFile('test.pdf', 'application/pdf', 1024);
      const { resumeId } = await ResumeService.saveResume(file, 'user123');

      const retrieved = await ResumeService.getResumeById(resumeId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.fileName).toBe('test.pdf');
      expect(retrieved?.metadata.userId).toBe('user123');
      expect(retrieved?.metadata.mimeType).toBe('application/pdf');
    });

    it('should return null for non-existent file', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const result = await ResumeService.getResumeById(fakeId);
      expect(result).toBeNull();
    });

    it('should return null for invalid ObjectId', async () => {
      const result = await ResumeService.getResumeById('invalid-id');
      expect(result).toBeNull();
    });
  });

  describe('getResumeFile', () => {
    it('should retrieve file content', async () => {
      const content = 'test content for resume';
      const file: Express.Multer.File = {
        ...createMockFile('test.pdf', 'application/pdf', 1024),
        buffer: Buffer.from(content),
      };

      const { resumeId } = await ResumeService.saveResume(file, 'user123');
      const retrievedBuffer = await ResumeService.getResumeFile(resumeId);

      expect(retrievedBuffer.toString()).toBe(content);
    });

    it('should throw error for non-existent file', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await expect(ResumeService.getResumeFile(fakeId)).rejects.toThrow();
    });
  });

  describe('deleteResume', () => {
    it('should delete file from GridFS', async () => {
      const file = createMockFile('test.pdf', 'application/pdf', 1024);
      const { resumeId } = await ResumeService.saveResume(file, 'user123');

      await ResumeService.deleteResume(resumeId);

      const retrieved = await ResumeService.getResumeById(resumeId);
      expect(retrieved).toBeNull();
    });

    it('should handle deleting non-existent file', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      // Should not throw, just no-op
      await expect(ResumeService.deleteResume(fakeId)).resolves.not.toThrow();
    });
  });

  describe('resumeExists', () => {
    it('should return true for existing file', async () => {
      const file = createMockFile('test.pdf', 'application/pdf', 1024);
      const { resumeId } = await ResumeService.saveResume(file, 'user123');

      const exists = await ResumeService.resumeExists(resumeId);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const exists = await ResumeService.resumeExists(fakeId);
      expect(exists).toBe(false);
    });
  });
});
