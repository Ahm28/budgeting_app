ALTER TABLE "Category" ADD COLUMN "parentId" UUID;

CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_not_self_check"
    CHECK ("parentId" IS NULL OR "parentId" <> "id");
