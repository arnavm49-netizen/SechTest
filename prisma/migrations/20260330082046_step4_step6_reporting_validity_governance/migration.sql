-- CreateEnum
CREATE TYPE "GovernanceRequestType" AS ENUM ('ACCESS', 'CHALLENGE', 'DELETE', 'ADVERSE_ACTION_NOTICE');

-- CreateEnum
CREATE TYPE "GovernanceRequestStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'APPROVED', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MonitorSeverity" AS ENUM ('MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MonitorStatus" AS ENUM ('HEALTHY', 'WARNING', 'BREACHED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "demographic_group" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "job_title" TEXT,
ADD COLUMN     "manager_id" TEXT,
ADD COLUMN     "manager_quality_score" DOUBLE PRECISION,
ADD COLUMN     "profile" JSONB;

-- CreateTable
CREATE TABLE "governance_requests" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assessment_id" TEXT,
    "request_type" "GovernanceRequestType" NOT NULL,
    "status" "GovernanceRequestStatus" NOT NULL DEFAULT 'OPEN',
    "request_note" TEXT NOT NULL,
    "resolution_note" TEXT,
    "due_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "governance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_health_checks" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "check_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "MonitorSeverity" NOT NULL,
    "status" "MonitorStatus" NOT NULL,
    "detail" TEXT NOT NULL,
    "trigger_summary" TEXT,
    "metadata" JSONB,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_review_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "system_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "governance_requests_org_id_request_type_status_idx" ON "governance_requests"("org_id", "request_type", "status");

-- CreateIndex
CREATE INDEX "governance_requests_user_id_status_idx" ON "governance_requests"("user_id", "status");

-- CreateIndex
CREATE INDEX "system_health_checks_org_id_severity_status_idx" ON "system_health_checks"("org_id", "severity", "status");

-- CreateIndex
CREATE UNIQUE INDEX "system_health_checks_org_id_check_code_key" ON "system_health_checks"("org_id", "check_code");

-- CreateIndex
CREATE INDEX "users_manager_id_idx" ON "users"("manager_id");

-- CreateIndex
CREATE INDEX "users_org_id_demographic_group_idx" ON "users"("org_id", "demographic_group");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_requests" ADD CONSTRAINT "governance_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_requests" ADD CONSTRAINT "governance_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_requests" ADD CONSTRAINT "governance_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_requests" ADD CONSTRAINT "governance_requests_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_health_checks" ADD CONSTRAINT "system_health_checks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
