import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A user can authenticate with email/password and/or Google. passwordHash is
 * absent for Google-only accounts. email is unique across both providers.
 */
const userSchema = new Schema(
  {
    name: { type: String, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: null },
    googleId: { type: String, default: null },
    provider: { type: String, enum: ['local', 'google', 'admin'], default: 'local' },
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  return { id: String(this._id), name: this.name, email: this.email, provider: this.provider };
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);