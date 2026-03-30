import { z } from "zod";
import { prisma } from "@/lib/db";

export const development_recommendation_schema = z.object({
  recommendation_text: z.string().min(10).max(4000),
  reassessment_trigger: z.string().min(3).max(240),
  score_range_max: z.number().min(0).max(100),
  score_range_min: z.number().min(0).max(100),
  sub_dimension_id: z.string().min(1),
  timeline: z.string().min(2).max(240),
});

export async function get_development_snapshot(org_id: string) {
  void org_id;
  const [sub_dimensions, recommendations] = await Promise.all([
    prisma.subDimension.findMany({
      where: {
        deleted_at: null,
        assessment_layer: {
          deleted_at: null,
        },
      },
      include: {
        assessment_layer: true,
      },
      orderBy: [{ assessment_layer: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.developmentRecommendation.findMany({
      where: {
        deleted_at: null,
        sub_dimension: {
          assessment_layer: {
            deleted_at: null,
          },
        },
      },
      include: {
        sub_dimension: {
          include: {
            assessment_layer: true,
          },
        },
      },
      orderBy: [{ sub_dimension: { name: "asc" } }, { score_range_min: "asc" }],
    }),
  ]);

  return {
    recommendations: recommendations.map((recommendation) => ({
      id: recommendation.id,
      recommendation_text: recommendation.recommendation_text,
      reassessment_trigger: recommendation.reassessment_trigger,
      score_range_max: recommendation.score_range_max,
      score_range_min: recommendation.score_range_min,
      sub_dimension_name: recommendation.sub_dimension.name,
      timeline: recommendation.timeline,
    })),
    sub_dimensions: sub_dimensions.map((sub_dimension) => ({
      id: sub_dimension.id,
      label: `${sub_dimension.assessment_layer.name} / ${sub_dimension.name}`,
    })),
  };
}

export async function create_development_recommendation(input: {
  data: z.infer<typeof development_recommendation_schema>;
}) {
  return prisma.developmentRecommendation.create({
    data: input.data,
  });
}
