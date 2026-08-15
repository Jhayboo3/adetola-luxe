ALTER TABLE "Category" ADD COLUMN "parentId" TEXT REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
