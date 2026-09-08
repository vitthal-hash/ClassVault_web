import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { findResourceConfig, writableFields, nextSeq, bumpSeq } from "@/lib/db/models";
import { getUserFromRequest } from "@/lib/api/authUser";

function toPlain(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, __v, userId, ...rest } = obj;
  return rest;
}

// GET /api/data/:resource -> every record for the logged-in user
export async function GET(req: NextRequest, { params }: { params: { resource: string } }) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const cfg = findResourceConfig(params.resource);
  if (!cfg) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });

  await connectToDatabase();
  const docs = await cfg.model.find({ userId: user }).sort({ id: 1 }).lean();
  return NextResponse.json(docs.map((d: any) => toPlain(d)));
}

// POST /api/data/:resource -> upsert. Body with an `id` replaces that
// record (create-or-update, mirroring the old IndexedDB `put` semantics -
// this is also how imported backups keep their original cross-references
// like subjectId/semesterId intact). Body without an `id` gets a fresh one.
export async function POST(req: NextRequest, { params }: { params: { resource: string } }) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const cfg = findResourceConfig(params.resource);
  if (!cfg) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  await connectToDatabase();

  const allowed = writableFields(cfg);
  const update: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  const id: number = typeof body.id === "number" ? body.id : await nextSeq(user, cfg.slug);
  if (typeof body.id === "number") {
    await bumpSeq(user, cfg.slug, body.id);
  }

  const doc = await cfg.model.findOneAndUpdate(
    { userId: user, id },
    { $set: { ...update, id, userId: user } },
    { upsert: true, new: true }
  );

  return NextResponse.json(toPlain(doc));
}
