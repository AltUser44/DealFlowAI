import mongoose, { Schema, type InferSchemaType } from "mongoose";

const companySchema = new Schema(
  {
    symbol: { type: String, required: true, unique: true, uppercase: true, index: true },
    name: { type: String, required: true },
    sector: { type: String },
    industry: { type: String },
    description: { type: String },
    country: { type: String },
    exchange: { type: String },
    marketCap: { type: Number },
    peRatio: { type: Number },
    evToEbitda: { type: Number },
    revenue: { type: Number },
    ebitda: { type: Number },
    /** Annual revenue growth as decimal, e.g. 0.12 = 12% */
    growthRate: { type: Number },
    /** Net profit margin as decimal */
    profitMargin: { type: Number },
    /** Normalized debt burden 0–1 (higher = more leverage risk) */
    debtScore: { type: Number },
    /** Raw debt-to-equity from source, for transparency */
    debtToEquity: { type: Number },
    /** Acquisition attractiveness score */
    score: { type: Number, index: true },
    lastSyncedAt: { type: Date },
    /** Fields that were missing / null in the Alpha Vantage response */
    nullFields: { type: [String], default: [] },
    rawOverview: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export type CompanyDoc = InferSchemaType<typeof companySchema> & { _id: mongoose.Types.ObjectId };
export const Company = mongoose.model("Company", companySchema);
