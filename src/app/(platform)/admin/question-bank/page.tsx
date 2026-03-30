import { QuestionBankManager } from "@/components/question-bank-manager";
import { require_roles } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { list_question_bank_items } from "@/lib/question-bank";

export default async function QuestionBankPage() {
  await require_roles(["SUPER_ADMIN", "HR_ADMIN"]);

  const [items, layers, sub_dimensions, role_families] = await Promise.all([
    list_question_bank_items({}),
    prisma.assessmentLayer.findMany({
      where: { deleted_at: null },
      orderBy: { name: "asc" },
    }),
    prisma.subDimension.findMany({
      where: { deleted_at: null },
      include: {
        assessment_layer: true,
      },
      orderBy: [{ name: "asc" }],
    }),
    prisma.roleFamily.findMany({
      where: { deleted_at: null },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <QuestionBankManager
      initial_items={items}
      layers={layers.map((layer) => ({ code: layer.code, id: layer.id, label: layer.name }))}
      role_families={role_families.map((role_family) => ({ label: role_family.name, value: role_family.name }))}
      sub_dimensions={sub_dimensions.map((sub_dimension) => ({
        label: sub_dimension.name,
        layer_code: sub_dimension.assessment_layer.code,
        value: sub_dimension.id,
      }))}
    />
  );
}
