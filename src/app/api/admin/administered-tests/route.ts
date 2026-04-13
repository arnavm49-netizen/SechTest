import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { create_administered_test, create_administered_test_schema, list_administered_tests } from "@/lib/administered-tests";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { can_access_admin, can_access_assessor_workspace } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role) && !can_access_assessor_workspace(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const administered_tests = await list_administered_tests(user.org_id, request.headers);
  return NextResponse.json({ administered_tests });
}

export async function POST(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role) && !can_access_assessor_workspace(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = create_administered_test_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide valid administered test details." }, { status: 400 });
  }

  try {
    const administered_test = await create_administered_test({
      actor_id: user.id,
      app_url: `${request.nextUrl.protocol}//${request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host}`,
      data: parsed.data,
      org_id: user.org_id,
    });

    await log_audit_event({
      action: "API_REQUEST",
      ip_address: get_client_ip(request),
      metadata: {
        candidate_email: administered_test.candidate_email,
        invite_id: administered_test.id,
        method: "POST",
        path: "/api/admin/administered-tests",
        status: 201,
      },
      target_entity: "administered_test",
      target_id: administered_test.id,
      user_id: user.id,
    });

    return NextResponse.json(
      {
        administered_test,
        message: "Administered test link generated.",
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unable to generate the administered test link.",
      },
      { status: 400 },
    );
  }
}
