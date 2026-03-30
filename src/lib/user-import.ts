import { UserRole } from "@prisma/client";
import Papa from "papaparse";
import { z } from "zod";

const import_row_schema = z.object({
  email: z.string().email(),
  is_active: z.boolean().default(true),
  name: z.string().min(2),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole),
});

export type ParsedUserImportRow = z.infer<typeof import_row_schema>;

export function parse_user_import_csv(csv_text: string) {
  const parsed = Papa.parse<Record<string, string>>(csv_text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const rows: Array<{ data: ParsedUserImportRow; line_number: number }> = [];
  const errors: Array<{ line_number: number; message: string }> = [];

  if (parsed.errors.length > 0) {
    return {
      rows,
      errors: parsed.errors.map((error) => ({
        line_number: (error.row ?? 0) + 2,
        message: error.message,
      })),
    };
  }

  parsed.data.forEach((row, index) => {
    const line_number = index + 2;
    const normalized = {
      email: (row.email ?? "").trim().toLowerCase(),
      is_active: normalize_boolean(row.is_active),
      name: (row.name ?? "").trim(),
      password: (row.password ?? "").trim(),
      role: normalize_role(row.role),
    };

    const result = import_row_schema.safeParse(normalized);

    if (!result.success) {
      errors.push({
        line_number,
        message: result.error.issues.map((issue) => issue.message).join("; "),
      });
      return;
    }

    rows.push({ data: result.data, line_number });
  });

  return { rows, errors };
}

function normalize_boolean(value?: string) {
  if (!value) {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  return !["false", "0", "no", "inactive"].includes(normalized);
}

function normalize_role(value?: string) {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replaceAll("/", "_")
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
}
