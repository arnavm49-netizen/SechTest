import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { can_access_admin } from "@/lib/rbac";
import { create_question_bank_item, list_question_bank_items, question_bank_item_schema } from "@/lib/question-bank";

export async function GET(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const items = await list_question_bank_items({
    is_active: params.get("is_active"),
    item_type: params.get("item_type"),
    layer_code: params.get("layer_code"),
    review_status: params.get("review_status"),
    role_family: params.get("role_family"),
    search: params.get("search"),
    sub_dimension_id: params.get("sub_dimension_id"),
    tag: params.get("tag"),
  });

  await log_audit_event({
    action: "API_REQUEST",
    ip_address: get_client_ip(request),
    metadata: { method: "GET", path: "/api/admin/question-bank", status: 200 },
    target_entity: "question_bank",
    user_id: user.id,
  });

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = question_bank_item_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid item payload." }, { status: 400 });
  }

  try {
    const item = await create_question_bank_item({
      actor_id: user.id,
      data: parsed.data,
    });

    await log_audit_event({
      action: "EDIT_ITEM",
      ip_address: get_client_ip(request),
      metadata: { method: "POST", path: "/api/admin/question-bank" },
      target_entity: "item",
      target_id: item.id,
      user_id: user.id,
    });

    return NextResponse.json({ item, message: "Item created successfully." }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to create item." },
      { status: 400 },
    );
  }
}
