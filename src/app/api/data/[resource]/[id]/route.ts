import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { findResourceConfig } from "@/lib/db/models";
import { getUserFromRequest } from "@/lib/api/authUser";
import { deleteFromCloudinary } from "@/lib/cloudinary";

function toPlain(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, __v, userId, ...rest } = obj;
  return rest;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { resource: string; id: string } }
) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const cfg = findResourceConfig(params.resource);
  if (!cfg) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  await connectToDatabase();
  const doc = await cfg.model.findOne({ userId: user, id });
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(toPlain(doc));
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { resource: string; id: string } }
) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const cfg = findResourceConfig(params.resource);
  if (!cfg) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  await connectToDatabase();
  const doc = await cfg.model.findOneAndDelete({ userId: user, id });

  if (doc && cfg.fileFields) {
    const obj = doc.toObject();
    for (const f of cfg.fileFields) {
      await deleteFromCloudinary(obj[f.publicIdField], obj[f.resourceTypeField]);
    }
  }

  return NextResponse.json({ deleted: Boolean(doc) });
}
