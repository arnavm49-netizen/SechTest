import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { can_access_admin } from "@/lib/rbac";
import { get_question_bank_item, question_bank_item_schema, update_question_bank_item } from "@/lib/question-bank";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const item = await get_question_bank_item(id);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Item not found." }, { status: 404 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = question_bank_item_schema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid update payload." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const item = await update_question_bank_item({
      actor_id: user.id,
      data: parsed.data,
      item_id: id,
    });

    await log_audit_event({
      action: "EDIT_ITEM",
      ip_address: get_client_ip(request),
      metadata: { method: "PATCH", path: `/api/admin/question-bank/${id}` },
      target_entity: "item",
      target_id: id,
      user_id: user.id,
    });

    return NextResponse.json({ item, message: "Item updated successfully." });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to update item." },
      { status: 400 },
    );
  }
}
