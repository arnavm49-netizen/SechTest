import { NextRequest, NextResponse } from "next/server";
import { get_request_session_user } from "@/lib/auth/session";
import { can_access_admin } from "@/lib/rbac";
import {
  create_development_recommendation,
  development_recommendation_schema,
  get_development_snapshot,
} from "@/lib/development-service";

export async function GET(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  return NextResponse.json({ snapshot: await get_development_snapshot(user.org_id) });
}

export async function POST(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = development_recommendation_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid development recommendation payload." }, { status: 400 });
  }

  await create_development_recommendation({
    data: parsed.data,
  });

  return NextResponse.json({ message: "Development recommendation created.", snapshot: await get_development_snapshot(user.org_id) }, { status: 201 });
}
