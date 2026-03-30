import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { log_audit_event } from "@/lib/audit";
import { hash_password } from "@/lib/auth/password";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { can_access_admin, can_manage_super_admins } from "@/lib/rbac";
import { parse_user_import_csv } from "@/lib/user-import";

const bulk_import_schema = z.object({
  csv_text: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const user = await get_request_session_user(request);
  const ip_address = get_client_ip(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed_body = bulk_import_schema.safeParse(body);

  if (!parsed_body.success) {
    return NextResponse.json({ message: "Please provide CSV text to import." }, { status: 400 });
  }

  const parsed_csv = parse_user_import_csv(parsed_body.data.csv_text);
  const emails = parsed_csv.rows.map((row) => row.data.email);
  const seen_emails = new Set<string>();
  const errors = [...parsed_csv.errors];

  parsed_csv.rows.forEach((row) => {
    if (seen_emails.has(row.data.email)) {
      errors.push({
        line_number: row.line_number,
        message: "Duplicate email detected within import file.",
      });
      return;
    }

    seen_emails.add(row.data.email);

    if (row.data.role === "SUPER_ADMIN" && !can_manage_super_admins(user.role)) {
      errors.push({
        line_number: row.line_number,
        message: "Only Super Admin can bulk import Super Admin users.",
      });
    }
  });

  const existing_users = emails.length
    ? await prisma.user.findMany({
        where: {
          email: { in: emails },
        },
        select: {
          email: true,
        },
      })
    : [];

  const existing_email_set = new Set(existing_users.map((entry) => entry.email));
  const valid_rows = parsed_csv.rows.filter((row) => {
    if (existing_email_set.has(row.data.email)) {
      errors.push({
        line_number: row.line_number,
        message: "A user with this email already exists.",
      });
      return false;
    }

    return !errors.some((error) => error.line_number === row.line_number);
  });

  if (valid_rows.length === 0) {
    return NextResponse.json(
      {
        errors,
        message: "No rows were imported.",
      },
      { status: 400 },
    );
  }

  const payload = await Promise.all(
    valid_rows.map(async (row) => ({
      email: row.data.email,
      is_active: row.data.is_active,
      name: row.data.name,
      org_id: user.org_id,
      password_hash: await hash_password(row.data.password),
      role: row.data.role,
    })),
  );

  await prisma.user.createMany({
    data: payload,
  });

  await log_audit_event({
    action: "BULK_IMPORT_USERS",
    ip_address,
    metadata: {
      created_count: payload.length,
      error_count: errors.length,
      method: "POST",
      path: "/api/admin/users/bulk-import",
    },
    target_entity: "user_import",
    user_id: user.id,
  });

  await log_audit_event({
    action: "API_REQUEST",
    ip_address,
    metadata: { method: "POST", path: "/api/admin/users/bulk-import", status: 200 },
    target_entity: "admin.users.bulk_import",
    user_id: user.id,
  });

  return NextResponse.json({
    errors,
    message: `Imported ${payload.length} user${payload.length === 1 ? "" : "s"} successfully.`,
  });
}
