import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { get_request_session_user } from "@/lib/auth/session";
import { can_access_admin } from "@/lib/rbac";
import { list_question_bank_items } from "@/lib/question-bank";

export async function GET(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const format = request.nextUrl.searchParams.get("format") === "json" ? "json" : "csv";
  const items = await list_question_bank_items({});

  if (format === "json") {
    return NextResponse.json({ items });
  }

  const csv = Papa.unparse(
    items.map((item) => ({
      correct_answer: JSON.stringify(item.correct_answer ?? null),
      desirability_rating: item.desirability_rating ?? "",
      difficulty_b: item.difficulty_b ?? "",
      discrimination_a: item.discrimination_a ?? "",
      guessing_c: item.guessing_c ?? "",
      is_active: item.is_active,
      item_type: item.item_type,
      layer_code: item.layer_code,
      max_exposure_pct: item.max_exposure_pct,
      options: JSON.stringify(item.options ?? []),
      review_status: item.review_status,
      scoring_key: JSON.stringify(item.scoring_key ?? null),
      stem: item.stem,
      sub_dimension_id: item.sub_dimension_id ?? "",
      tags: JSON.stringify(item.tags ?? {}),
      time_limit_seconds: item.time_limit_seconds ?? "",
    })),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Disposition": 'attachment; filename="question-bank-export.csv"',
      "Content-Type": "text/csv",
    },
  });
}
