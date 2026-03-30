import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { get_reports_admin_snapshot, report_template_update_schema, update_report_template } from "@/lib/reporting-service";
import { can_access_admin } from "@/lib/rbac";

const report_template_patch_schema = report_template_update_schema.extend({
  template_id: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const snapshot = await get_reports_admin_snapshot(user.org_id);

  await log_audit_event({
    action: "API_REQUEST",
    ip_address: get_client_ip(request),
    metadata: { method: "GET", path: "/api/admin/reports", status: 200 },
    target_entity: "reports.admin_snapshot",
    user_id: user.id,
  });

  return NextResponse.json({ snapshot });
}

export async function PATCH(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = report_template_patch_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid report template update." }, { status: 400 });
  }

  try {
    const template = await update_report_template({
      data: parsed.data,
      org_id: user.org_id,
      template_id: parsed.data.template_id,
    });

    await log_audit_event({
      action: "PUBLISH_VERSION",
      ip_address: get_client_ip(request),
      metadata: { method: "PATCH", path: "/api/admin/reports", status: 200 },
      target_entity: "report_template",
      target_id: template.id,
      user_id: user.id,
    });

    return NextResponse.json({ message: "Report template updated.", template });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to update the report template." },
      { status: 400 },
    );
  }
}
