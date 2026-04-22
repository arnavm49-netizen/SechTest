-- CreateEnum
CREATE TYPE "AssessmentPurpose" AS ENUM ('HIRING', 'DEVELOPMENT', 'SUCCESSION');

-- CreateEnum
CREATE TYPE "NineBoxPlacement" AS ENUM (
  'HIGH_PERFORMANCE_HIGH_POTENTIAL',
  'HIGH_PERFORMANCE_MODERATE_POTENTIAL',
  'HIGH_PERFORMANCE_LOW_POTENTIAL',
  'MODERATE_PERFORMANCE_HIGH_POTENTIAL',
  'MODERATE_PERFORMANCE_MODERATE_POTENTIAL',
  'MODERATE_PERFORMANCE_LOW_POTENTIAL',
  'LOW_PERFORMANCE_HIGH_POTENTIAL',
  'LOW_PERFORMANCE_MODERATE_POTENTIAL',
  'LOW_PERFORMANCE_LOW_POTENTIAL'
);

-- AlterTable: Campaign — add purpose
ALTER TABLE "campaigns" ADD COLUMN "purpose" "AssessmentPurpose" NOT NULL DEFAULT 'HIRING';

-- AlterTable: RaterResponse — add narrative_comment
ALTER TABLE "rater_responses" ADD COLUMN "narrative_comment" TEXT;

-- AlterTable: RoleFitResult — add 9-box fields
ALTER TABLE "role_fit_results" ADD COLUMN "performance_pct" DOUBLE PRECISION;
ALTER TABLE "role_fit_results" ADD COLUMN "potential_pct" DOUBLE PRECISION;
ALTER TABLE "role_fit_results" ADD COLUMN "nine_box" "NineBoxPlacement";

-- AlterTable: DevelopmentPlan — add plan_summary and target_review_date
ALTER TABLE "development_plans" ADD COLUMN "plan_summary" TEXT;
ALTER TABLE "development_plans" ADD COLUMN "target_review_date" TIMESTAMP(3);

-- CreateTable: DevelopmentIntervention
CREATE TABLE "development_interventions" (
  "id" TEXT NOT NULL,
  "development_plan_id" TEXT NOT NULL,
  "sub_dimension_name" TEXT NOT NULL,
  "gap_score" DOUBLE PRECISION,
  "target_score" DOUBLE PRECISION,
  "intervention_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "actions" JSONB NOT NULL,
  "success_criteria" TEXT,
  "timeline_weeks" INTEGER,
  "priority" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "development_interventions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "development_interventions_development_plan_id_priority_idx" ON "development_interventions"("development_plan_id", "priority");

-- AddForeignKey
ALTER TABLE "development_interventions" ADD CONSTRAINT "development_interventions_development_plan_id_fkey" FOREIGN KEY ("development_plan_id") REFERENCES "development_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
