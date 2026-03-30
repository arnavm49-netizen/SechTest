import { AuditAction, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type AuditInput = {
  action: AuditAction;
  target_entity: string;
  target_id?: string | null;
  user_id?: string | null;
  ip_address?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function log_audit_event(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        target_entity: input.target_entity,
        target_id: input.target_id ?? null,
        user_id: input.user_id ?? null,
        ip_address: input.ip_address ?? null,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}
