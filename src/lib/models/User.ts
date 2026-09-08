import { Schema, models, model } from "mongoose";

export interface IUser {
  _id: string;
  username: string;
  passwordHash: string;
  displayName?: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  displayName: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default models.User || model<IUser>("User", UserSchema);
