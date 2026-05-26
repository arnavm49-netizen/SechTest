import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { export_report_asset } from "@/lib/reporting-service";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const invite = await prisma.campaignInvite.findUnique({
      where: { invite_token: token },
      include: {
        assessment: {
          select: {
            candidate_id: true,
            id: true,
            org_id: true,
            status: true,
          },
        },
      },
    });

    if (!invite?.assessment) {
      return NextResponse.json({ message: "Assessment not found for this link." }, { status: 404 });
    }

    if (invite.assessment.status !== "COMPLETED") {
      return NextResponse.json(
        { message: "Feedback report becomes available once the assessment is fully submitted and scored." },
        { status: 409 },
      );
    }

    const asset = await export_report_asset({
      actor_id: null,
      assessment_id: invite.assessment.id,
      format: "pdf",
      report_type: "CANDIDATE_FEEDBACK",
      viewer: {
        id: invite.assessment.candidate_id,
        org_id: invite.assessment.org_id,
        role: UserRole.CANDIDATE,
      },
    });

    return new NextResponse(asset.buffer, {
      headers: {
        "Content-Disposition": `attachment; filename=\"${asset.file_name}\"`,
        "Content-Type": asset.content_type,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to export feedback report." },
      { status: 400 },
    );
  }
}
