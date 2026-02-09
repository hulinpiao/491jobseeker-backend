import { Types } from 'mongoose';
import JobModel, { IJob, JobQuery, PaginatedJobs } from '../models/Job';

type FilterQuery = {
  $text?: { $search: string };
  $or?: Array<{ city?: RegExp; state?: RegExp }>;
  employment_type?: string;
  work_arrangement?: string;
};

class JobService {
  /**
   * Get paginated jobs with filtering and search
   */
  async getJobs(query: JobQuery): Promise<PaginatedJobs> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    // Build filter
    const filter: FilterQuery = {};

    // Keyword search (search in title, description, company)
    if (query.q) {
      filter.$text = { $search: query.q };
    }

    // Location filter (city or state)
    if (query.location) {
      filter.$or = [
        { city: new RegExp(query.location, 'i') },
        { state: new RegExp(query.location, 'i') },
      ];
    }

    // Employment type filter
    if (query.employment_type) {
      filter.employment_type = query.employment_type;
    }

    // Work arrangement filter
    if (query.work_arrangement) {
      filter.work_arrangement = query.work_arrangement;
    }

    // Build sort
    const sortBy = query.sortBy || 'created_at';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const sort: { [key: string]: 1 | -1 } = { [sortBy]: sortOrder };

    // Execute queries
    const [data, total] = await Promise.all([
      JobModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      JobModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single job by ID
   */
  async getJobById(id: string): Promise<IJob | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return JobModel.findById(id).lean().exec();
  }
}

export default new JobService();
