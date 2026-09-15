import mongoose from 'mongoose';
import { Pattern, IPattern, IPatternDocument } from '../models/Pattern.model.js';

export interface IPatternRepository {
  findAll(): Promise<IPatternDocument[]>;
  findById(id: string): Promise<IPatternDocument | null>;
  findBySlug(slug: string): Promise<IPatternDocument | null>;
  create(data: Partial<IPattern>): Promise<IPatternDocument>;
}

export class PatternRepository implements IPatternRepository {
  async findAll(): Promise<IPatternDocument[]> {
    return Pattern.find().sort({ name: 1 });
  }

  async findById(id: string): Promise<IPatternDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return Pattern.findById(id);
  }

  async findBySlug(slug: string): Promise<IPatternDocument | null> {
    return Pattern.findOne({ slug: slug.toLowerCase().trim() });
  }

  async create(data: Partial<IPattern>): Promise<IPatternDocument> {
    return Pattern.create(data);
  }
}

export const patternRepository = new PatternRepository();
