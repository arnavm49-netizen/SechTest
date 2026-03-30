import { describe, expect, it } from "vitest";
import { parse_user_import_csv } from "../../lib/user-import";

describe("parse_user_import_csv", () => {
  it("parses valid rows", () => {
    const result = parse_user_import_csv(
      "name,email,role,password,is_active\nAsha Singh,asha@example.com,MANAGER,Password@123,true",
    );

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.data.role).toBe("MANAGER");
  });

  it("reports line-level validation errors", () => {
    const result = parse_user_import_csv(
      "name,email,role,password,is_active\nAsha Singh,asha@example.com,MANAGER,short,true\nBad Email,not-an-email,CANDIDATE,Password@123,true",
    );

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]?.line_number).toBe(2);
    expect(result.errors[1]?.line_number).toBe(3);
  });
});
