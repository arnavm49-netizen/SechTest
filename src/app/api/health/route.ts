import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    service: "enterprise-psychometric-system",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
