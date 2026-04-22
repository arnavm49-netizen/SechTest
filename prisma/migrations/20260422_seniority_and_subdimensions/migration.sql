-- CreateEnum
CREATE TYPE "SeniorityLevel" AS ENUM ('INDIVIDUAL_CONTRIBUTOR', 'FIRST_LINE_MANAGER', 'MIDDLE_MANAGER', 'SENIOR_LEADER', 'EXECUTIVE');

-- AlterTable: RoleFamily — add seniority_level
ALTER TABLE "role_families" ADD COLUMN "seniority_level" "SeniorityLevel" NOT NULL DEFAULT 'MIDDLE_MANAGER';
