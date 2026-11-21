import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * One row per prediction request. Stores the model id and the exact customer
 * payload that produced the label, so predictions are auditable.
 */
const predictionSchema = new Schema(
  {
    prediction: {
      type: String,
      enum: ['Likely to churn', 'Not likely to churn'],
      required: true,
    },
    model: { type: String, default: null },
    customer: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export const Prediction =
  mongoose.models.Prediction || mongoose.model('Prediction', predictionSchema);