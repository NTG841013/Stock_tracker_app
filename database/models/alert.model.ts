// database/models/alert.model.ts
import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface AlertItem extends Document {
    userId: string;
    symbol: string;
    company: string;
    alertName: string;
    currentPrice: number;
    alertType: 'price';
    condition: 'greater' | 'less';
    threshold: number;
    isActive: boolean;
    triggeredAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const AlertSchema = new Schema<AlertItem>(
    {
        userId: { type: String, required: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true },
        company: { type: String, required: true, trim: true },
        alertName: { type: String, required: true, trim: true },
        currentPrice: { type: Number, required: true },
        alertType: { type: String, enum: ['price'], required: true },
        condition: { type: String, enum: ['greater', 'less'], required: true },
        threshold: { type: Number, required: true },
        isActive: { type: Boolean, default: true },
        triggeredAt: { type: Date },
    },
    {
        timestamps: true
    }
);

// Index for efficient queries
AlertSchema.index({ userId: 1, symbol: 1 });
AlertSchema.index({ isActive: 1 });

export const Alert: Model<AlertItem> =
    (models?.Alert as Model<AlertItem>) || model<AlertItem>('Alert', AlertSchema);