import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { scoring_model_update_schema, update_scoring_model } from "@/lib/scoring-service";
import { can_access_admin } from "@/lib/rbac";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = scoring_model_update_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid scoring model payload." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const model = await update_scoring_model({
      data: parsed.data,
      model_id: id,
      org_id: user.org_id,
    });

    await log_audit_event({
      action: "CHANGE_WEIGHT",
      ip_address: get_client_ip(request),
      metadata: { method: "PATCH", path: `/api/admin/scoring/${id}`, status: 200 },
      target_entity: "scoring_model",
      target_id: model.id,
      user_id: user.id,
    });

    return NextResponse.json({ message: "Scoring model updated.", model });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to update the scoring model." },
      { status: 400 },
    );
  }
}
