import { NextRequest, NextResponse } from "next/server";
import { get_request_session_user } from "@/lib/auth/session";
import { get_role_family_manager_snapshot, role_family_upsert_schema, upsert_role_family } from "@/lib/role-families";
import { can_access_admin } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  return NextResponse.json({ snapshot: await get_role_family_manager_snapshot(user.org_id) });
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
  const parsed = role_family_upsert_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid role family payload." }, { status: 400 });
  }

  try {
    const message = await upsert_role_family({
      actor_id: user.id,
      data: parsed.data,
      org_id: user.org_id,
    });

    return NextResponse.json({ message, snapshot: await get_role_family_manager_snapshot(user.org_id) }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unable to save the role family.",
      },
      { status: 400 },
    );
  }
}
