import mongoose, { Schema, Model } from 'mongoose';
import { COLLECTION_NAME } from '../config/database';

// Job document interface
export interface IJob {
  _id: mongoose.Types.ObjectId;
  dedup_key: string;
  apply_link: string;
  city: string;
  company_name_normalized: string;
  country: string;
  created_at: Date;
  employment_type: string;
  job_description: string;
  job_location: string;
  job_title: string;
  sources: string[];
  state: string;
  updated_at: Date;
  work_arrangement: string;
}

// Job query interface for API
export interface JobQuery {
  page?: number;
  limit?: number;
  q?: string; // Keyword search
  location?: string;
  employment_type?: string;
  work_arrangement?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Paginated result interface
export interface PaginatedJobs {
  data: IJob[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Create the schema
const jobSchema = new Schema<IJob>(
  {
    dedup_key: { type: String, required: true },
    apply_link: { type: String, default: '' },
    city: { type: String, required: true },
    company_name_normalized: { type: String, required: true },
    country: { type: String, required: true },
    created_at: { type: Date, required: true },
    employment_type: { type: String, required: true },
    job_description: { type: String, required: true },
    job_location: { type: String, required: true },
    job_title: { type: String, required: true },
    sources: { type: [String], default: [] },
    state: { type: String, required: true },
    updated_at: { type: Date, required: true },
    work_arrangement: { type: String, required: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: false,
  }
);

// Add indexes for common queries
jobSchema.index({ job_title: 'text', job_description: 'text', company_name_normalized: 'text' });
jobSchema.index({ created_at: -1 });
jobSchema.index({ city: 1, state: 1 });
jobSchema.index({ employment_type: 1 });
jobSchema.index({ work_arrangement: 1 });

// Create or get the model
const JobModel: Model<IJob> = mongoose.models.Job || mongoose.model<IJob>('Job', jobSchema);

export default JobModel;
