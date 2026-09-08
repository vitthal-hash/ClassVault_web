import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

// The only place the app talks to Cloudinary. Heavy binary files (lecture
// photos, syllabus/resource/assignment PDFs & docs) are stored here instead
// of MongoDB, which keeps the Atlas free tier free for the small, structured
// data (semesters, subjects, notes, chat history, etc.) that actually
// benefits from living in a real database.

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment."
    );
  }
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  configured = true;
}

export interface UploadedFile {
  url: string;
  publicId: string;
  resourceType: string;
  bytes: number;
}

/** Uploads a file buffer to Cloudinary under classvault/<username>/... and
 *  returns just what we need to store alongside the record in Mongo. */
export function uploadToCloudinary(
  buffer: Buffer,
  filename: string,
  folder: string
): Promise<UploadedFile> {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        use_filename: true,
        unique_filename: true,
        filename_override: filename,
      },
      (err, result?: UploadApiResponse) => {
        if (err || !result) return reject(err || new Error("Cloudinary upload failed"));
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          bytes: result.bytes,
        });
      }
    );
    stream.end(buffer);
  });
}

/** Best-effort delete - never throws, so a missing/already-deleted asset
 *  never blocks a record deletion in Mongo. */
export async function deleteFromCloudinary(publicId?: string | null, resourceType?: string | null) {
  if (!publicId) return;
  try {
    ensureConfigured();
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType === "raw" || resourceType === "video" ? resourceType : "image",
    });
  } catch {
    // cleanup is best-effort
  }
}

/** Deletes every asset under a user's Cloudinary folder (used when a user
 *  wipes/deletes their account data). Best-effort across resource types. */
export async function deleteUserFolder(username: string) {
  try {
    ensureConfigured();
    const prefix = `classvault/${username}/`;
    for (const resource_type of ["image", "raw", "video"] as const) {
      try {
        await cloudinary.api.delete_resources_by_prefix(prefix, { resource_type });
      } catch {
        // ignore - resource type may have no assets
      }
    }
    try {
      await cloudinary.api.delete_folder(`classvault/${username}`);
    } catch {
      // folder may not be empty/exist - fine
    }
  } catch {
    // Cloudinary not configured or account-level failure - never block wipe
  }
}
