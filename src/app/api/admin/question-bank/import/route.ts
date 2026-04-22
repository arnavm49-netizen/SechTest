import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { parse_question_bank_import } from "@/lib/question-bank-import";
import { can_access_admin } from "@/lib/rbac";
import { create_question_bank_item } from "@/lib/question-bank";

const import_schema = z.object({
  content: z.string().min(1),
  format: z.enum(["csv", "json"]),
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
  const parsed_body = import_schema.safeParse(body);

  if (!parsed_body.success) {
    return NextResponse.json({ message: "Please provide import content and format." }, { status: 400 });
  }

  const parsed = parse_question_bank_import(parsed_body.data);
  const errors = [...parsed.errors];

  for (const row of parsed.rows) {
    const layer = await prisma.assessmentLayer.findFirst({
      where: {
        code: row.data.layer_code as import("@prisma/client").AssessmentLayerCode,
      },
    });

    const sub_dimension = row.data.sub_dimension_code
      ? await prisma.subDimension.findFirst({
          where: {
            code: row.data.sub_dimension_code,
            layer_id: layer?.id,
          },
        })
      : null;

    if (!layer) {
      errors.push({ line_number: row.line_number, message: "Unknown layer code." });
      continue;
    }

    if (row.data.sub_dimension_code && !sub_dimension) {
      errors.push({ line_number: row.line_number, message: "Unknown sub-dimension code." });
      continue;
    }

    try {
      await create_question_bank_item({
        actor_id: user.id,
        data: {
          correct_answer: row.data.correct_answer,
          desirability_rating: row.data.desirability_rating,
          difficulty_b: row.data.difficulty_b,
          discrimination_a: row.data.discrimination_a,
          guessing_c: row.data.guessing_c,
          is_active: row.data.is_active,
          item_type: row.data.item_type,
          layer_id: layer.id,
          max_exposure_pct: row.data.max_exposure_pct,
          options: row.data.options,
          review_status: row.data.review_status,
          scoring_key: row.data.scoring_key,
          stem: row.data.stem,
          sub_dimension_id: sub_dimension?.id ?? null,
          tags: row.data.tags,
          time_limit_seconds: row.data.time_limit_seconds,
        },
      });
    } catch (error) {
      errors.push({
        line_number: row.line_number,
        message: error instanceof Error ? error.message : "Unable to import row.",
      });
    }
  }

  await log_audit_event({
    action: "EDIT_ITEM",
    ip_address: get_client_ip(request),
    metadata: {
      error_count: errors.length,
      format: parsed_body.data.format,
      imported_count: parsed.rows.length - errors.length,
      method: "POST",
      path: "/api/admin/question-bank/import",
    },
    target_entity: "question_bank_import",
    user_id: user.id,
  });

  return NextResponse.json({
    errors,
    message: `Imported ${Math.max(0, parsed.rows.length - errors.length)} item(s).`,
  });
}
