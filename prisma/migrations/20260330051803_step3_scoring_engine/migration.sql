-- CreateEnum
CREATE TYPE "ScoringModelStatus" AS ENUM ('DRAFT', 'LIVE', 'CHALLENGER', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ScoringRunStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'INVALIDATED');

-- CreateTable
CREATE TABLE "norm_group_members" (
    "id" TEXT NOT NULL,
    "norm_group_id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "norm_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_models" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version_label" TEXT NOT NULL,
    "status" "ScoringModelStatus" NOT NULL DEFAULT 'DRAFT',
    "engine_mode" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "notes" TEXT,
    "created_by" TEXT,
    "published_by" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "scoring_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_runs" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "scoring_model_id" TEXT NOT NULL,
    "status" "ScoringRunStatus" NOT NULL DEFAULT 'PENDING',
    "quality_gate_passed" BOOLEAN NOT NULL DEFAULT true,
    "invalid_reason" TEXT,
    "step_outputs" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "scoring_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scored_responses" (
    "id" TEXT NOT NULL,
    "scoring_run_id" TEXT NOT NULL,
    "response_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "layer_id" TEXT NOT NULL,
    "sub_dimension_id" TEXT,
    "raw_value" JSONB,
    "scored_value" DOUBLE PRECISION,
    "speed_score" DOUBLE PRECISION,
    "explanation" JSONB,
    "quality_flags" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "scored_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "norm_group_members_user_id_norm_group_id_idx" ON "norm_group_members"("user_id", "norm_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "norm_group_members_norm_group_id_assessment_id_key" ON "norm_group_members"("norm_group_id", "assessment_id");

-- CreateIndex
CREATE INDEX "scoring_models_org_id_status_idx" ON "scoring_models"("org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_models_org_id_version_label_key" ON "scoring_models"("org_id", "version_label");

-- CreateIndex
CREATE INDEX "scoring_runs_assessment_id_created_at_idx" ON "scoring_runs"("assessment_id", "created_at");

-- CreateIndex
CREATE INDEX "scoring_runs_scoring_model_id_status_idx" ON "scoring_runs"("scoring_model_id", "status");

-- CreateIndex
CREATE INDEX "scored_responses_item_id_layer_id_idx" ON "scored_responses"("item_id", "layer_id");

-- CreateIndex
CREATE UNIQUE INDEX "scored_responses_scoring_run_id_response_id_key" ON "scored_responses"("scoring_run_id", "response_id");

-- AddForeignKey
ALTER TABLE "norm_group_members" ADD CONSTRAINT "norm_group_members_norm_group_id_fkey" FOREIGN KEY ("norm_group_id") REFERENCES "norm_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "norm_group_members" ADD CONSTRAINT "norm_group_members_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "norm_group_members" ADD CONSTRAINT "norm_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_models" ADD CONSTRAINT "scoring_models_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_models" ADD CONSTRAINT "scoring_models_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_models" ADD CONSTRAINT "scoring_models_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_runs" ADD CONSTRAINT "scoring_runs_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_runs" ADD CONSTRAINT "scoring_runs_scoring_model_id_fkey" FOREIGN KEY ("scoring_model_id") REFERENCES "scoring_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scored_responses" ADD CONSTRAINT "scored_responses_scoring_run_id_fkey" FOREIGN KEY ("scoring_run_id") REFERENCES "scoring_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scored_responses" ADD CONSTRAINT "scored_responses_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scored_responses" ADD CONSTRAINT "scored_responses_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scored_responses" ADD CONSTRAINT "scored_responses_layer_id_fkey" FOREIGN KEY ("layer_id") REFERENCES "assessment_layers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scored_responses" ADD CONSTRAINT "scored_responses_sub_dimension_id_fkey" FOREIGN KEY ("sub_dimension_id") REFERENCES "sub_dimensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
