import { isRecord } from "@/lib/api/responses";
import { categoryTypes } from "@/lib/master-data/types";
import type { AccountTransferInput, TransactionInput } from "./types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseTransactionInput(value: unknown): TransactionInput | null {
  if (!isRecord(value)) return null;

  const { transactionDate, accountId, categoryId } = value;
  const categoryType = categoryTypes.find((type) => type === value.categoryType);
  const budgetCategoryId = categoryType === "EXPENSE"
    ? (typeof value.budgetCategoryId === "string" ? value.budgetCategoryId : categoryId)
    : null;
  const amount = typeof value.amount === "string" && value.amount.trim() !== ""
    ? Number(value.amount)
    : value.amount;
  const description = typeof value.description === "string" ? value.description.trim() : "";

  if (
    typeof transactionDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate) ||
    Number.isNaN(Date.parse(`${transactionDate}T00:00:00.000Z`)) ||
    new Date(`${transactionDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== transactionDate ||
    typeof amount !== "number" ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > Number.MAX_SAFE_INTEGER ||
    typeof accountId !== "string" ||
    !uuidPattern.test(accountId) ||
    typeof categoryId !== "string" ||
    !uuidPattern.test(categoryId) ||
    (budgetCategoryId !== null && (typeof budgetCategoryId !== "string" || !uuidPattern.test(budgetCategoryId))) ||
    !categoryType ||
    description.length > 160
  ) {
    return null;
  }

  return { transactionDate, amount, description, accountId, categoryId, budgetCategoryId, categoryType };
}

export function parseAccountTransferInput(value: unknown): AccountTransferInput | null {
  if (!isRecord(value)) return null;

  const { transferDate, fromAccountId, toAccountId } = value;
  const amount = typeof value.amount === "string" && value.amount.trim() !== ""
    ? Number(value.amount)
    : value.amount;
  const description = typeof value.description === "string" ? value.description.trim() : "";

  if (
    typeof transferDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(transferDate) ||
    Number.isNaN(Date.parse(`${transferDate}T00:00:00.000Z`)) ||
    new Date(`${transferDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== transferDate ||
    typeof amount !== "number" ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    typeof fromAccountId !== "string" ||
    !uuidPattern.test(fromAccountId) ||
    typeof toAccountId !== "string" ||
    !uuidPattern.test(toAccountId) ||
    fromAccountId === toAccountId ||
    description.length > 160
  ) {
    return null;
  }

  return { transferDate, amount, description, fromAccountId, toAccountId };
}
