import { NextRequest, NextResponse } from "next/server";
import { create_governance_request, governance_request_create_schema } from "@/lib/compliance-service";
import { get_request_session_user } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const requests = await prisma.governanceRequest.findMany({
    where: {
      deleted_at: null,
      org_id: user.org_id,
      user_id: user.id,
    },
    orderBy: [{ created_at: "desc" }],
  });

  return NextResponse.json({
    requests: requests.map((entry) => ({
      created_at: entry.created_at.toISOString(),
      id: entry.id,
      request_note: entry.request_note,
      request_type: entry.request_type,
      resolution_note: entry.resolution_note,
      status: entry.status,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = governance_request_create_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid self-service request payload." }, { status: 400 });
  }

  await create_governance_request({
    assessment_id: parsed.data.assessment_id,
    org_id: user.org_id,
    request_note: parsed.data.request_note,
    request_type: parsed.data.request_type,
    user_id: user.id,
  });

  return NextResponse.json({ message: "Request submitted successfully." }, { status: 201 });
}
