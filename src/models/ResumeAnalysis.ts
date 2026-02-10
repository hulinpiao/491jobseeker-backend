import mongoose, { Schema, Model } from 'mongoose';

/**
 * Skill category interface
 */
export interface ISkillCategory {
  category: string;
  items: string[];
}

/**
 * Resume Analysis document interface
 */
export interface IResumeAnalysis {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  resumeId: mongoose.Types.ObjectId;
  skills: ISkillCategory[];
  summary: string;
  jobKeywords: string[];
  analyzedAt: Date;
  toResponse(): IResumeAnalysisResponse;
}

/**
 * Resume Analysis response interface (public API)
 */
export interface IResumeAnalysisResponse {
  id: string;
  userId: string;
  resumeId: string;
  skills: ISkillCategory[];
  summary: string;
  jobKeywords: string[];
  analyzedAt: Date;
}

/**
 * Resume Analysis Schema
 */
const ResumeAnalysisSchema = new Schema<IResumeAnalysis>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    resumeId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    skills: [
      {
        category: { type: String, required: true },
        items: [String],
      },
    ],
    summary: {
      type: String,
      required: true,
    },
    jobKeywords: [String],
    analyzedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'resume_analyses',
  }
);

// Compound index for user's resume lookups
ResumeAnalysisSchema.index({ userId: 1, resumeId: 1 }, { unique: true });

/**
 * Resume Analysis Model
 */
const ResumeAnalysisModel: Model<IResumeAnalysis> =
  mongoose.models.ResumeAnalysis ||
  mongoose.model<IResumeAnalysis>('ResumeAnalysis', ResumeAnalysisSchema);

/**
 * Convert analysis to response format
 */
ResumeAnalysisModel.prototype.toResponse = function (
  this: IResumeAnalysis
): IResumeAnalysisResponse {
  return {
    id: this._id.toString(),
    userId: this.userId.toString(),
    resumeId: this.resumeId.toString(),
    skills: this.skills,
    summary: this.summary,
    jobKeywords: this.jobKeywords,
    analyzedAt: this.analyzedAt,
  };
};

// Export model
const ResumeAnalysis = ResumeAnalysisModel;

export default ResumeAnalysis;
