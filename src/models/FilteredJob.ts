import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';
import { MONGODB_URI } from '../config/database';

// Filtered job document interface (matches job_scraper_filtered.filtered_jobs)
export interface IFilteredJob {
  _id: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD format
  platform: 'linkedin' | 'indeed' | 'seek';
  job_posting_id: string;
  company_name_normalized: string;
  city: string;
  state: string;
  country: string;
  employment_type: string;
  work_arrangement: string;
  job_title: string;
  job_description: string;
  job_location: string;
  apply_link: string;
  analysis: {
    passed: boolean;
    match_score: number;
    match_reason: string;
    matching_skills: string[];
    missing_skills: string[];
    exclusion_stage?: 'visa' | 'security' | null;
    exclusion_reason?: string;
  };
  updated_at: Date;
  created_at?: Date;
}

// Job query interface for API
export interface FilteredJobQuery {
  page?: number;
  limit?: number;
  q?: string; // Keyword search
  location?: string;
  employment_type?: string;
  work_arrangement?: string;
  platform?: string;
  min_score?: number;
  date?: string; // YYYY-MM-DD format
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Paginated result interface
export interface PaginatedFilteredJobs {
  data: IFilteredJob[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Direct MongoDB access for filtered jobs
const DB_NAME = 'job_scraper_filtered';
const COLLECTION_NAME = 'filtered_jobs';

let mongoClient: MongoClient | null = null;

function getMongoClient(): MongoClient {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI);
  }
  return mongoClient;
}

/**
 * FilteredJobService using direct MongoDB access
 * This bypasses Mongoose since the data comes from Python ETL pipeline
 */
class FilteredJobService {
  /**
   * Get paginated filtered jobs with filtering and search
   */
  async getJobs(query: FilteredJobQuery): Promise<PaginatedFilteredJobs> {
    const client = getMongoClient();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    // Build filter
    const filter: { [key: string]: any } = {};

    // Only show passed jobs by default
    filter['analysis.passed'] = true;

    // Date filter
    if (query.date) {
      filter.date = query.date;
    }

    // Platform filter
    if (query.platform) {
      filter.platform = query.platform;
    }

    // Minimum score filter
    if (query.min_score !== undefined) {
      filter['analysis.match_score'] = { $gte: query.min_score };
    }

    // Location filter (city or state)
    if (query.location) {
      filter.$or = [
        { city: new RegExp(query.location, 'i') },
        { state: new RegExp(query.location, 'i') },
        { job_location: new RegExp(query.location, 'i') },
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

    // Keyword search (search in title, description, company)
    if (query.q) {
      filter.$or = [
        { job_title: new RegExp(query.q, 'i') },
        { job_description: new RegExp(query.q, 'i') },
        { company_name_normalized: new RegExp(query.q, 'i') },
      ];
    }

    // Build sort
    const sortBy = query.sortBy || 'updated_at';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const sort: { [key: string]: 1 | -1 } = { [sortBy]: sortOrder };

    // Execute queries
    const [data, total] = await Promise.all([
      collection
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    return {
      data: data as unknown as IFilteredJob[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single job by ID (using _id)
   */
  async getJobById(id: string): Promise<IFilteredJob | null> {
    const client = getMongoClient();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    try {
      const doc = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
      return doc as unknown as IFilteredJob | null;
    } catch {
      return null;
    }
  }

  /**
   * Get platforms with job counts
   */
  async getPlatformCounts(): Promise<{ platform: string; count: number }[]> {
    const client = getMongoClient();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const pipeline = [
      { $match: { 'analysis.passed': true } },
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ];

    const results = await collection.aggregate(pipeline).toArray();
    return results.map((r: any) => ({ platform: r._id, count: r.count }));
  }

  /**
   * Get available dates
   */
  async getAvailableDates(): Promise<string[]> {
    const client = getMongoClient();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const pipeline = [
      {
        $group: {
          _id: '$date',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ];

    const results = await collection.aggregate(pipeline).toArray();
    return results.map((r: any) => r._id);
  }

  /**
   * Get statistics summary
   */
  async getStats(): Promise<{
    total: number;
    byPlatform: { platform: string; count: number }[];
    avgScore: number;
    byDate: { date: string; count: number }[];
  }> {
    const client = getMongoClient();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const [total, platformStats, dateStats, scoreStats] = await Promise.all([
      collection.countDocuments({ 'analysis.passed': true }),
      this.getPlatformCounts(),
      this.getAvailableDates().then(dates =>
        Promise.all(
          dates.map(async date => ({
            date,
            count: await collection.countDocuments({ date, 'analysis.passed': true }),
          }))
        )
      ),
      collection
        .aggregate([
          { $match: { 'analysis.passed': true } },
          {
            $group: {
              _id: null,
              avgScore: { $avg: '$analysis.match_score' },
            },
          },
        ])
        .toArray(),
    ]);

    return {
      total,
      byPlatform: platformStats,
      avgScore: scoreStats[0]?.avgScore || 0,
      byDate: dateStats.sort((a, b) => b.date.localeCompare(a.date)),
    };
  }
}

export default new FilteredJobService();
