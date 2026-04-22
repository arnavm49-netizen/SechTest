-- DropIndex
DROP INDEX IF EXISTS "assessment_sections_assessment_id_layer_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "assessment_sections_assessment_id_section_order_key" ON "assessment_sections"("assessment_id", "section_order");
