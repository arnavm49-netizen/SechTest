import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { can_access_admin } from "@/lib/rbac";
import { norm_group_recompute_schema, recompute_norm_group } from "@/lib/scoring-service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = norm_group_recompute_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid recompute request." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    await recompute_norm_group({
      model_id: parsed.data.model_id,
      norm_group_id: id,
      org_id: user.org_id,
    });

    await log_audit_event({
      action: "API_REQUEST",
      ip_address: get_client_ip(request),
      metadata: { method: "POST", path: `/api/admin/scoring/norm-groups/${id}/recompute`, status: 200 },
      target_entity: "norm_group.recompute",
      target_id: id,
      user_id: user.id,
    });

    return NextResponse.json({ message: "Norm statistics recomputed." });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to recompute norm statistics." },
      { status: 400 },
    );
  }
}
