import { accountTypes, categoryTypes } from "./types";
import type { AccountInput, CategoryInput } from "./types";
import { isRecord } from "@/lib/api/responses";

const maximumAmount = Number.MAX_SAFE_INTEGER;

function parseName(value: unknown, maximumLength: number) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (name.length < 1 || name.length > maximumLength) return null;
  return name;
}

function parseAmount(value: unknown) {
  const amount = typeof value === "string" && value.trim() !== ""
    ? Number(value)
    : value;

  if (
    typeof amount !== "number" ||
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    amount > maximumAmount
  ) {
    return null;
  }

  return amount;
}

export function parseCategoryInput(value: unknown): CategoryInput | null {
  if (!isRecord(value)) return null;

  const name = parseName(value.name, 60);
  const type = categoryTypes.find((candidate) => candidate === value.type);
  const parentId = value.parentId === undefined || value.parentId === null || value.parentId === ""
    ? null
    : typeof value.parentId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.parentId)
      ? value.parentId
      : undefined;

  if (!name || !type || parentId === undefined) return null;

  return { name, type, parentId };
}

export function parseAccountInput(value: unknown): AccountInput | null {
  if (!isRecord(value)) return null;

  const name = parseName(value.name, 80);
  const type = accountTypes.find((candidate) => candidate === value.type);
  const openingBalance = parseAmount(value.openingBalance);
  const minimumBalance = parseAmount(value.minimumBalance);

  if (
    !name ||
    !type ||
    openingBalance === null ||
    minimumBalance === null
  ) {
    return null;
  }

  return {
    name,
    type,
    openingBalance,
    minimumBalance,
  };
}
