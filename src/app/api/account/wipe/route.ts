import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { RESOURCES, Counter } from "@/lib/db/models";
import { getUserFromRequest } from "@/lib/api/authUser";
import { deleteUserFolder } from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  await connectToDatabase();
  await Promise.all(RESOURCES.map((cfg) => cfg.model.deleteMany({ userId: user })));
  await Counter.deleteMany({ userId: user });
  await deleteUserFolder(user);

  return NextResponse.json({ ok: true });
}
