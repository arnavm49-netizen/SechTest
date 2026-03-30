import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { can_access_admin } from "@/lib/rbac";
import { bulk_update_question_bank_status } from "@/lib/question-bank";

const bulk_status_schema = z.object({
  item_ids: z.array(z.string()).min(1),
  review_status: z.enum(["DRAFT", "REVIEWED", "APPROVED", "RETIRED"]),
});

export async function POST(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bulk_status_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please choose at least one item and a review status." }, { status: 400 });
  }

  await bulk_update_question_bank_status({
    actor_id: user.id,
    item_ids: parsed.data.item_ids,
    review_status: parsed.data.review_status,
  });

  await log_audit_event({
    action: "EDIT_ITEM",
    ip_address: get_client_ip(request),
    metadata: { count: parsed.data.item_ids.length, method: "POST", path: "/api/admin/question-bank/bulk-status" },
    target_entity: "question_bank_bulk_status",
    user_id: user.id,
  });

  return NextResponse.json({ message: "Question bank items updated." });
}
