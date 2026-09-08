import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

// This is the ONLY place the app talks to MongoDB Atlas. It stores user
// accounts plus all structured app data (semesters, subjects, notes,
// assignments, chat history, syllabus text, etc.) - small, text-based
// records that sync cheaply and give every user cross-device access with
// real backups. Heavy binary files (lecture photos, PDFs, resource docs)
// are NOT stored here - they go to Cloudinary (see src/lib/cloudinary.ts)
// so the Atlas free tier isn't eaten up by file bytes.

declare global {
  // eslint-disable-next-line no-var
  var _mongooseConn: Promise<typeof mongoose> | undefined;
}

export async function connectToDatabase() {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. Add it to your .env.local (or hosting provider's env vars) with your MongoDB Atlas connection string."
    );
  }

  if (global._mongooseConn) {
    return global._mongooseConn;
  }

  global._mongooseConn = mongoose.connect(MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || "classvault",
  });

  return global._mongooseConn;
}
