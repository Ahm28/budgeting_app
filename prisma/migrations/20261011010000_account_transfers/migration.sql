-- CreateTable
CREATE TABLE "AccountTransfer" (
    "id" UUID NOT NULL,
    "transferDate" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" VARCHAR(160),
    "fromAccountId" UUID NOT NULL,
    "toAccountId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AccountTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountTransfer_transferDate_idx" ON "AccountTransfer"("transferDate");
CREATE INDEX "AccountTransfer_fromAccountId_transferDate_idx" ON "AccountTransfer"("fromAccountId", "transferDate");
CREATE INDEX "AccountTransfer_toAccountId_transferDate_idx" ON "AccountTransfer"("toAccountId", "transferDate");

-- AddForeignKey
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_fromAccountId_fkey"
    FOREIGN KEY ("fromAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_toAccountId_fkey"
    FOREIGN KEY ("toAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
