-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'CANDIDATE', 'RATER', 'ASSESSOR');

-- CreateEnum
CREATE TYPE "AssessmentLayerCode" AS ENUM ('COGNITIVE', 'PERSONALITY', 'MOTIVATORS', 'EXECUTION', 'LEADERSHIP', 'SJT');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('MCQ', 'FORCED_CHOICE_TRIAD', 'RANKING', 'Q_SORT', 'SCENARIO', 'LIKERT', 'SIMULATION', 'FORCED_CHOICE_PAIR', 'SINGLE_CHOICE_TIMED');

-- CreateEnum
CREATE TYPE "ItemReviewStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "AssessmentVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RoleFitRecommendation" AS ENUM ('STRONG_FIT', 'FIT', 'DEVELOP', 'POOR_FIT');

-- CreateEnum
CREATE TYPE "DevelopmentPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RaterRelationship" AS ENUM ('SELF', 'PEER', 'DIRECT_REPORT', 'MANAGER', 'SKIP_LEVEL');

-- CreateEnum
CREATE TYPE "RaterAssignmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ValidityType" AS ENUM ('CONSTRUCT', 'CRITERION', 'INTERNAL_RELIABILITY', 'TEST_RETEST', 'ADVERSE_IMPACT', 'INCREMENTAL');

-- CreateEnum
CREATE TYPE "MeasurementFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'BIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('INDIVIDUAL', 'CANDIDATE_FEEDBACK', 'TEAM_HEATMAP', 'VALIDITY', 'ADVERSE_IMPACT', 'EBITDA', 'TRAJECTORY');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'TOKEN_REFRESH', 'CREATE_USER', 'UPDATE_USER', 'DEACTIVATE_USER', 'BULK_IMPORT_USERS', 'VIEW_SCORE', 'EXPORT_REPORT', 'EDIT_ITEM', 'CHANGE_WEIGHT', 'PUBLISH_VERSION', 'API_REQUEST');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "dpdp_consent_template" TEXT NOT NULL,
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_layers" (
    "id" TEXT NOT NULL,
    "code" "AssessmentLayerCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "default_weight" DOUBLE PRECISION NOT NULL,
    "predictive_evidence" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "assessment_layers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_families" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "weight_matrix" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "role_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_dimensions" (
    "id" TEXT NOT NULL,
    "layer_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "target_alpha" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sub_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "layer_id" TEXT NOT NULL,
    "sub_dimension_id" TEXT,
    "item_type" "ItemType" NOT NULL,
    "stem" TEXT NOT NULL,
    "options" JSONB,
    "correct_answer" JSONB,
    "scoring_key" JSONB,
    "difficulty_b" DOUBLE PRECISION,
    "discrimination_a" DOUBLE PRECISION,
    "guessing_c" DOUBLE PRECISION,
    "time_limit_seconds" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "exposure_count" INTEGER NOT NULL DEFAULT 0,
    "max_exposure_pct" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "last_used_at" TIMESTAMP(3),
    "tags" JSONB,
    "created_by" TEXT,
    "review_status" "ItemReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "desirability_rating" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_options" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "option_text" TEXT NOT NULL,
    "score_weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "item_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_versions" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "stem_snapshot" TEXT NOT NULL,
    "options_snapshot" JSONB,
    "scoring_key_snapshot" JSONB,
    "changed_by" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "change_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "question_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_versions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "version_label" TEXT NOT NULL,
    "sections_snapshot" JSONB NOT NULL,
    "scoring_config_snapshot" JSONB NOT NULL,
    "status" "AssessmentVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "published_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "assessment_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "role_family_id" TEXT NOT NULL,
    "assessment_version_id" TEXT NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "total_time_seconds" INTEGER,
    "consent_given_at" TIMESTAMP(3),
    "proctor_mode" BOOLEAN NOT NULL DEFAULT false,
    "is_high_stakes" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_sections" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "layer_id" TEXT NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "items_presented" INTEGER NOT NULL DEFAULT 0,
    "items_answered" INTEGER NOT NULL DEFAULT 0,
    "dropout_flag" BOOLEAN NOT NULL DEFAULT false,
    "section_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "assessment_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responses" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "response_value" JSONB,
    "response_time_seconds" INTEGER,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "irt_theta_estimate" DOUBLE PRECISION,
    "sequence_number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "layer_id" TEXT NOT NULL,
    "sub_dimension_id" TEXT,
    "raw_score" DOUBLE PRECISION,
    "z_score" DOUBLE PRECISION,
    "percentile" DOUBLE PRECISION,
    "normalized_score_0_100" DOUBLE PRECISION,
    "irt_theta" DOUBLE PRECISION,
    "reliability_estimate" DOUBLE PRECISION,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "scoring_model_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_fit_results" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "role_family_id" TEXT NOT NULL,
    "fit_score_pct" DOUBLE PRECISION NOT NULL,
    "rank_in_cohort" INTEGER,
    "top_3_drivers" JSONB,
    "top_2_constraints" JSONB,
    "recommendation" "RoleFitRecommendation" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "role_fit_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_plans" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "gap_dimensions" JSONB NOT NULL,
    "status" "DevelopmentPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "manager_reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "development_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rater_assignments" (
    "id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "rater_id" TEXT NOT NULL,
    "relationship" "RaterRelationship" NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "status" "RaterAssignmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "calibration_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "rater_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rater_responses" (
    "id" TEXT NOT NULL,
    "rater_assignment_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "response_value" JSONB,
    "response_time_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "rater_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validity_evidence" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "validity_type" "ValidityType" NOT NULL,
    "layer_id" TEXT,
    "sub_dimension_id" TEXT,
    "role_family_id" TEXT,
    "metric_name" TEXT NOT NULL,
    "metric_value" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "pass_fail" BOOLEAN NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sample_n" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "validity_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_definitions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "role_family_id" TEXT NOT NULL,
    "kpi_name" TEXT NOT NULL,
    "kpi_description" TEXT NOT NULL,
    "measurement_unit" TEXT NOT NULL,
    "measurement_frequency" "MeasurementFrequency" NOT NULL,
    "data_source" TEXT NOT NULL,
    "prediction_horizon_months" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "kpi_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_observations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kpi_definition_id" TEXT NOT NULL,
    "observation_date" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "kpi_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outcome_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "kpi_definition_id" TEXT NOT NULL,
    "metric_name" TEXT NOT NULL,
    "metric_value" DOUBLE PRECISION NOT NULL,
    "observation_period" TEXT NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "outcome_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "behaviour_maps" (
    "id" TEXT NOT NULL,
    "sub_dimension_id" TEXT NOT NULL,
    "behaviour_description" TEXT NOT NULL,
    "outcome_description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "behaviour_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "target_entity" TEXT NOT NULL,
    "target_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "consent_text_hash" TEXT NOT NULL,
    "consented_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "norm_groups" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "norm_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "norm_statistics" (
    "id" TEXT NOT NULL,
    "norm_group_id" TEXT NOT NULL,
    "sub_dimension_id" TEXT NOT NULL,
    "mean" DOUBLE PRECISION NOT NULL,
    "std_dev" DOUBLE PRECISION NOT NULL,
    "percentile_lookup" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sample_n" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "norm_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assessment_version_id" TEXT NOT NULL,
    "role_family_id" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "invite_template" TEXT NOT NULL,
    "reminder_template" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_templates" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "sections_config" JSONB NOT NULL,
    "branding" JSONB NOT NULL,
    "distribution_rules" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_reports" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "report_template_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_recommendations" (
    "id" TEXT NOT NULL,
    "sub_dimension_id" TEXT NOT NULL,
    "score_range_min" DOUBLE PRECISION NOT NULL,
    "score_range_max" DOUBLE PRECISION NOT NULL,
    "recommendation_text" TEXT NOT NULL,
    "timeline" TEXT NOT NULL,
    "reassessment_trigger" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "development_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_org_id_role_idx" ON "users"("org_id", "role");

-- CreateIndex
CREATE INDEX "users_org_id_is_active_idx" ON "users"("org_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_layers_code_key" ON "assessment_layers"("code");

-- CreateIndex
CREATE INDEX "assessment_layers_is_active_idx" ON "assessment_layers"("is_active");

-- CreateIndex
CREATE INDEX "role_families_org_id_is_active_idx" ON "role_families"("org_id", "is_active");

-- CreateIndex
CREATE INDEX "role_families_weight_matrix_idx" ON "role_families" USING GIN ("weight_matrix");

-- CreateIndex
CREATE UNIQUE INDEX "role_families_org_id_name_key" ON "role_families"("org_id", "name");

-- CreateIndex
CREATE INDEX "sub_dimensions_layer_id_is_active_idx" ON "sub_dimensions"("layer_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "sub_dimensions_layer_id_code_key" ON "sub_dimensions"("layer_id", "code");

-- CreateIndex
CREATE INDEX "items_layer_id_sub_dimension_id_idx" ON "items"("layer_id", "sub_dimension_id");

-- CreateIndex
CREATE INDEX "items_id_is_active_idx" ON "items"("id", "is_active");

-- CreateIndex
CREATE INDEX "items_review_status_is_active_idx" ON "items"("review_status", "is_active");

-- CreateIndex
CREATE INDEX "items_tags_idx" ON "items" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "items_options_idx" ON "items" USING GIN ("options");

-- CreateIndex
CREATE INDEX "item_options_item_id_display_order_idx" ON "item_options"("item_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "question_versions_item_id_version_number_key" ON "question_versions"("item_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_versions_org_id_version_label_key" ON "assessment_versions"("org_id", "version_label");

-- CreateIndex
CREATE INDEX "assessments_org_id_role_family_id_idx" ON "assessments"("org_id", "role_family_id");

-- CreateIndex
CREATE INDEX "assessments_candidate_id_status_idx" ON "assessments"("candidate_id", "status");

-- CreateIndex
CREATE INDEX "assessment_sections_assessment_id_layer_id_idx" ON "assessment_sections"("assessment_id", "layer_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_sections_assessment_id_layer_id_key" ON "assessment_sections"("assessment_id", "layer_id");

-- CreateIndex
CREATE INDEX "responses_assessment_id_section_id_idx" ON "responses"("assessment_id", "section_id");

-- CreateIndex
CREATE UNIQUE INDEX "responses_assessment_id_sequence_number_key" ON "responses"("assessment_id", "sequence_number");

-- CreateIndex
CREATE INDEX "scores_assessment_id_layer_id_idx" ON "scores"("assessment_id", "layer_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_fit_results_assessment_id_role_family_id_key" ON "role_fit_results"("assessment_id", "role_family_id");

-- CreateIndex
CREATE INDEX "development_plans_user_id_assessment_id_idx" ON "development_plans"("user_id", "assessment_id");

-- CreateIndex
CREATE INDEX "rater_assignments_subject_id_assessment_id_idx" ON "rater_assignments"("subject_id", "assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "rater_assignments_assessment_id_subject_id_rater_id_relatio_key" ON "rater_assignments"("assessment_id", "subject_id", "rater_id", "relationship");

-- CreateIndex
CREATE UNIQUE INDEX "rater_responses_rater_assignment_id_item_id_key" ON "rater_responses"("rater_assignment_id", "item_id");

-- CreateIndex
CREATE INDEX "validity_evidence_org_id_validity_type_idx" ON "validity_evidence"("org_id", "validity_type");

-- CreateIndex
CREATE INDEX "kpi_definitions_org_id_role_family_id_idx" ON "kpi_definitions"("org_id", "role_family_id");

-- CreateIndex
CREATE INDEX "kpi_observations_user_id_kpi_definition_id_idx" ON "kpi_observations"("user_id", "kpi_definition_id");

-- CreateIndex
CREATE INDEX "outcome_records_user_id_assessment_id_idx" ON "outcome_records"("user_id", "assessment_id");

-- CreateIndex
CREATE INDEX "behaviour_maps_sub_dimension_id_is_active_idx" ON "behaviour_maps"("sub_dimension_id", "is_active");

-- CreateIndex
CREATE INDEX "audit_log_user_id_timestamp_idx" ON "audit_log"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "consent_records_user_id_assessment_id_idx" ON "consent_records"("user_id", "assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "consent_records_user_id_assessment_id_key" ON "consent_records"("user_id", "assessment_id");

-- CreateIndex
CREATE INDEX "norm_groups_org_id_is_active_idx" ON "norm_groups"("org_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "norm_groups_org_id_name_key" ON "norm_groups"("org_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "norm_statistics_norm_group_id_sub_dimension_id_key" ON "norm_statistics"("norm_group_id", "sub_dimension_id");

-- CreateIndex
CREATE INDEX "campaigns_org_id_role_family_id_idx" ON "campaigns"("org_id", "role_family_id");

-- CreateIndex
CREATE INDEX "report_templates_org_id_report_type_is_active_idx" ON "report_templates"("org_id", "report_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "report_templates_org_id_name_key" ON "report_templates"("org_id", "name");

-- CreateIndex
CREATE INDEX "generated_reports_assessment_id_report_template_id_idx" ON "generated_reports"("assessment_id", "report_template_id");

-- CreateIndex
CREATE INDEX "development_recommendations_sub_dimension_id_is_active_idx" ON "development_recommendations"("sub_dimension_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_expires_at_idx" ON "refresh_tokens"("user_id", "expires_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_families" ADD CONSTRAINT "role_families_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_families" ADD CONSTRAINT "role_families_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_dimensions" ADD CONSTRAINT "sub_dimensions_layer_id_fkey" FOREIGN KEY ("layer_id") REFERENCES "assessment_layers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_layer_id_fkey" FOREIGN KEY ("layer_id") REFERENCES "assessment_layers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_sub_dimension_id_fkey" FOREIGN KEY ("sub_dimension_id") REFERENCES "sub_dimensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_options" ADD CONSTRAINT "item_options_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_versions" ADD CONSTRAINT "assessment_versions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_versions" ADD CONSTRAINT "assessment_versions_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_role_family_id_fkey" FOREIGN KEY ("role_family_id") REFERENCES "role_families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_assessment_version_id_fkey" FOREIGN KEY ("assessment_version_id") REFERENCES "assessment_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_sections" ADD CONSTRAINT "assessment_sections_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_sections" ADD CONSTRAINT "assessment_sections_layer_id_fkey" FOREIGN KEY ("layer_id") REFERENCES "assessment_layers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "assessment_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_layer_id_fkey" FOREIGN KEY ("layer_id") REFERENCES "assessment_layers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_sub_dimension_id_fkey" FOREIGN KEY ("sub_dimension_id") REFERENCES "sub_dimensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_fit_results" ADD CONSTRAINT "role_fit_results_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_fit_results" ADD CONSTRAINT "role_fit_results_role_family_id_fkey" FOREIGN KEY ("role_family_id") REFERENCES "role_families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_plans" ADD CONSTRAINT "development_plans_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_plans" ADD CONSTRAINT "development_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rater_assignments" ADD CONSTRAINT "rater_assignments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rater_assignments" ADD CONSTRAINT "rater_assignments_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rater_assignments" ADD CONSTRAINT "rater_assignments_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rater_responses" ADD CONSTRAINT "rater_responses_rater_assignment_id_fkey" FOREIGN KEY ("rater_assignment_id") REFERENCES "rater_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rater_responses" ADD CONSTRAINT "rater_responses_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validity_evidence" ADD CONSTRAINT "validity_evidence_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validity_evidence" ADD CONSTRAINT "validity_evidence_layer_id_fkey" FOREIGN KEY ("layer_id") REFERENCES "assessment_layers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validity_evidence" ADD CONSTRAINT "validity_evidence_sub_dimension_id_fkey" FOREIGN KEY ("sub_dimension_id") REFERENCES "sub_dimensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validity_evidence" ADD CONSTRAINT "validity_evidence_role_family_id_fkey" FOREIGN KEY ("role_family_id") REFERENCES "role_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpi_definitions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpi_definitions_role_family_id_fkey" FOREIGN KEY ("role_family_id") REFERENCES "role_families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_observations" ADD CONSTRAINT "kpi_observations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_observations" ADD CONSTRAINT "kpi_observations_kpi_definition_id_fkey" FOREIGN KEY ("kpi_definition_id") REFERENCES "kpi_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_records" ADD CONSTRAINT "outcome_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_records" ADD CONSTRAINT "outcome_records_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_records" ADD CONSTRAINT "outcome_records_kpi_definition_id_fkey" FOREIGN KEY ("kpi_definition_id") REFERENCES "kpi_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behaviour_maps" ADD CONSTRAINT "behaviour_maps_sub_dimension_id_fkey" FOREIGN KEY ("sub_dimension_id") REFERENCES "sub_dimensions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "norm_groups" ADD CONSTRAINT "norm_groups_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "norm_statistics" ADD CONSTRAINT "norm_statistics_norm_group_id_fkey" FOREIGN KEY ("norm_group_id") REFERENCES "norm_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "norm_statistics" ADD CONSTRAINT "norm_statistics_sub_dimension_id_fkey" FOREIGN KEY ("sub_dimension_id") REFERENCES "sub_dimensions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_assessment_version_id_fkey" FOREIGN KEY ("assessment_version_id") REFERENCES "assessment_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_role_family_id_fkey" FOREIGN KEY ("role_family_id") REFERENCES "role_families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_report_template_id_fkey" FOREIGN KEY ("report_template_id") REFERENCES "report_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_recommendations" ADD CONSTRAINT "development_recommendations_sub_dimension_id_fkey" FOREIGN KEY ("sub_dimension_id") REFERENCES "sub_dimensions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

