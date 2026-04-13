import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const role_family_upsert_schema = z.object({
  description: z.string().min(12).max(600),
  id: z.string().min(1).optional(),
  is_active: z.boolean().default(true),
  name: z.string().min(3).max(120),
  weight_matrix: z.record(z.string(), z.number().min(0).max(100)),
});

export type RoleFamilyManagerSnapshot = {
  layers: Array<{
    code: string;
    name: string;
  }>;
  role_families: Array<{
    active_campaign_count: number;
    assessment_count: number;
    created_at: string;
    description: string;
    id: string;
    is_active: boolean;
    name: string;
    total_weight: number;
    updated_at: string;
    version: number;
    weight_matrix: Record<string, number>;
  }>;
  summary: {
    active_count: number;
    active_live_campaigns: number;
    average_weight_total: number;
    total_count: number;
  };
};

export async function get_role_family_manager_snapshot(org_id: string): Promise<RoleFamilyManagerSnapshot> {
  const [layers, role_families] = await Promise.all([
    prisma.assessmentLayer.findMany({
      where: { deleted_at: null },
      orderBy: [{ created_at: "asc" }],
      select: {
        code: true,
        name: true,
      },
    }),
    prisma.roleFamily.findMany({
      where: {
        deleted_at: null,
        org_id,
      },
      include: {
        assessments: {
          where: { deleted_at: null },
          select: { id: true },
        },
        campaigns: {
          where: { deleted_at: null },
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: [{ updated_at: "desc" }],
    }),
  ]);

  const serialized_role_families = role_families.map((role_family) => {
    const weight_matrix = normalize_weight_matrix_record(role_family.weight_matrix, layers.map((layer) => layer.code));

    return {
      active_campaign_count: role_family.campaigns.filter((campaign) => campaign.status === "ACTIVE").length,
      assessment_count: role_family.assessments.length,
      created_at: role_family.created_at.toISOString(),
      description: role_family.description,
      id: role_family.id,
      is_active: role_family.is_active,
      name: role_family.name,
      total_weight: sum_weight_matrix(weight_matrix),
      updated_at: role_family.updated_at.toISOString(),
      version: role_family.version,
      weight_matrix,
    };
  });

  return {
    layers,
    role_families: serialized_role_families,
    summary: {
      active_count: serialized_role_families.filter((role_family) => role_family.is_active).length,
      active_live_campaigns: serialized_role_families.reduce((total, role_family) => total + role_family.active_campaign_count, 0),
      average_weight_total:
        serialized_role_families.length > 0
          ? Number(
              (
                serialized_role_families.reduce((total, role_family) => total + role_family.total_weight, 0) / serialized_role_families.length
              ).toFixed(1),
            )
          : 0,
      total_count: serialized_role_families.length,
    },
  };
}

export async function upsert_role_family(input: {
  actor_id: string;
  data: z.infer<typeof role_family_upsert_schema>;
  org_id: string;
}) {
  const layers = await prisma.assessmentLayer.findMany({
    where: { deleted_at: null },
    orderBy: [{ created_at: "asc" }],
    select: { code: true },
  });
  const normalized_weight_matrix = normalize_weight_matrix_record(input.data.weight_matrix, layers.map((layer) => layer.code));

  if (sum_weight_matrix(normalized_weight_matrix) <= 0) {
    throw new Error("Add at least one non-zero layer weight.");
  }

  if (input.data.id) {
    const existing = await prisma.roleFamily.findFirst({
      where: {
        deleted_at: null,
        id: input.data.id,
        org_id: input.org_id,
      },
    });

    if (!existing) {
      throw new Error("Role family not found.");
    }

    await prisma.roleFamily.update({
      where: { id: existing.id },
      data: {
        description: input.data.description.trim(),
        is_active: input.data.is_active,
        name: input.data.name.trim(),
        version: existing.version + 1,
        weight_matrix: normalized_weight_matrix as Prisma.InputJsonValue,
      },
    });

    return "Role family updated.";
  }

  await prisma.roleFamily.create({
    data: {
      created_by: input.actor_id,
      description: input.data.description.trim(),
      is_active: input.data.is_active,
      name: input.data.name.trim(),
      org_id: input.org_id,
      weight_matrix: normalized_weight_matrix as Prisma.InputJsonValue,
    },
  });

  return "Role family created.";
}

function normalize_weight_matrix_record(value: unknown, layer_codes: string[]) {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  return Object.fromEntries(
    layer_codes.map((layer_code) => {
      const numeric_value = typeof record[layer_code] === "number" ? record[layer_code] : Number(record[layer_code] ?? 0);
      return [layer_code, Number.isFinite(numeric_value) ? numeric_value : 0];
    }),
  );
}

function sum_weight_matrix(weight_matrix: Record<string, number>) {
  return Number(Object.values(weight_matrix).reduce((total, value) => total + value, 0).toFixed(1));
}
