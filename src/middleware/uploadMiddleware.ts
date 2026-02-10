import { RequestHandler } from 'express';
import multer, { FileFilterCallback } from 'multer';

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
 * Configure storage in memory (will be streamed to GridFS)
 */
const storage = multer.memoryStorage();

/**
 * File filter function
 * Validates file type before upload
 */
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  callback: FileFilterCallback
): void => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
    callback(null, true);
  } else {
    callback(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, TXT'));
  }
};

/**
 * Multer instance for file uploads
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

/**
 * Single file upload middleware
 * Expects field name: 'file'
 */
export const uploadSingle: RequestHandler = upload.single('file');

/**
 * Get allowed MIME types
 */
export const getAllowedMimeTypes = (): readonly string[] => ALLOWED_MIME_TYPES;

/**
 * Get max file size
 */
export const getMaxFileSize = (): number => MAX_FILE_SIZE;

export default upload;
