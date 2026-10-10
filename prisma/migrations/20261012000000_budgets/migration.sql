-- Add an optional budget source category. Existing expense entries fall back to their recorded category.
ALTER TABLE "Transaction" ADD COLUMN "budgetCategoryId" UUID;

CREATE INDEX "Transaction_budgetCategoryId_transactionDate_idx"
    ON "Transaction"("budgetCategoryId", "transactionDate");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_budgetCategoryId_fkey"
    FOREIGN KEY ("budgetCategoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "BudgetPeriod" (
    "id" UUID NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BudgetPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetAllocation" (
    "id" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BudgetAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetPeriod_startsOn_endsOn_idx" ON "BudgetPeriod"("startsOn", "endsOn");
CREATE UNIQUE INDEX "BudgetAllocation_periodId_categoryId_key" ON "BudgetAllocation"("periodId", "categoryId");
CREATE INDEX "BudgetAllocation_categoryId_idx" ON "BudgetAllocation"("categoryId");

-- AddForeignKey
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "BudgetPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
