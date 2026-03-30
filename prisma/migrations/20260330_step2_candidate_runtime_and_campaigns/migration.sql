-- CreateEnum
CREATE TYPE "CampaignInviteStatus" AS ENUM ('DRAFT', 'SENT', 'STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED');

-- AlterTable
ALTER TABLE "assessment_sections" ADD COLUMN     "item_ids_snapshot" JSONB,
ADD COLUMN     "runtime_config_snapshot" JSONB,
ADD COLUMN     "time_limit_seconds" INTEGER;

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "campaign_id" TEXT,
ADD COLUMN     "quality_flags" JSONB,
ADD COLUMN     "runtime_metadata" JSONB;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "settings" JSONB;

-- CreateTable
CREATE TABLE "campaign_invites" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "candidate_id" TEXT,
    "assessment_id" TEXT,
    "email" TEXT NOT NULL,
    "invite_token" TEXT NOT NULL,
    "status" "CampaignInviteStatus" NOT NULL DEFAULT 'DRAFT',
    "invited_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "last_reminded_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "campaign_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaign_invites_invite_token_key" ON "campaign_invites"("invite_token");

-- CreateIndex
CREATE INDEX "campaign_invites_campaign_id_status_idx" ON "campaign_invites"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "campaign_invites_candidate_id_status_idx" ON "campaign_invites"("candidate_id", "status");

-- CreateIndex
CREATE INDEX "assessments_campaign_id_status_idx" ON "assessments"("campaign_id", "status");

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_invites" ADD CONSTRAINT "campaign_invites_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_invites" ADD CONSTRAINT "campaign_invites_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_invites" ADD CONSTRAINT "campaign_invites_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

