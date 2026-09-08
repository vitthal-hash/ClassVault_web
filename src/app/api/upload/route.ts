import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api/authUser";
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024; // 25MB per file - plenty for lecture photos/PDFs

// POST /api/upload - multipart form with a `file` field. Used for lecture
// photos, syllabus/resource/assignment files - the "heavy" stuff that
// shouldn't eat into the Mongo Atlas free tier.
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (25MB max)." }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadToCloudinary(buffer, file.name, `classvault/${user}`);
    return NextResponse.json({
      url: uploaded.url,
      publicId: uploaded.publicId,
      resourceType: uploaded.resourceType,
      name: file.name,
      type: file.type,
      bytes: uploaded.bytes,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Upload failed." }, { status: 500 });
  }
}

// DELETE /api/upload - cleans up an orphaned asset, e.g. when a syllabus
// file is replaced with a new one. Body: { publicId, resourceType }.
export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { publicId, resourceType } = await req.json();
    await deleteFromCloudinary(publicId, resourceType);
  } catch {
    // best-effort
  }
  return NextResponse.json({ ok: true });
}
