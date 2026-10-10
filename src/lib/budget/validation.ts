import { isRecord } from "@/lib/api/responses";
import type { BudgetAllocationInput, BudgetPeriodInput } from "./types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isDate(value: unknown): value is string {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

export function parseBudgetPeriodInput(value: unknown): BudgetPeriodInput | null {
  if (!isRecord(value) || !isDate(value.startsOn) || !isDate(value.endsOn) || value.startsOn > value.endsOn) {
    return null;
  }
  return { startsOn: value.startsOn, endsOn: value.endsOn };
}

export function parseBudgetAllocations(value: unknown): BudgetAllocationInput[] | null {
  if (!isRecord(value) || !Array.isArray(value.allocations) || value.allocations.length > 300) return null;
  const allocations: BudgetAllocationInput[] = [];
  const seen = new Set<string>();

  for (const row of value.allocations) {
    if (!isRecord(row) || typeof row.categoryId !== "string" || !uuidPattern.test(row.categoryId) || seen.has(row.categoryId)) {
      return null;
    }
    const amount = typeof row.amount === "string" && row.amount.trim() !== "" ? Number(row.amount) : row.amount;
    if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0) return null;
    seen.add(row.categoryId);
    allocations.push({ categoryId: row.categoryId, amount });
  }
  return allocations;
}
