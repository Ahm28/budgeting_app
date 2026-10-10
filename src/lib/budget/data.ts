import { db } from "@/lib/db";

export function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function exclusiveEnd(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + 1));
}

export async function overlapsBudgetPeriod(startsOn: Date, endsOn: Date, excludeId?: string) {
  const period = await db.budgetPeriod.findFirst({
    where: {
      startsOn: { lte: endsOn },
      endsOn: { gte: startsOn },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(period);
}

export async function getBudgetPeriodDetails(id: string) {
  const period = await db.budgetPeriod.findUnique({
    where: { id },
    include: { allocations: { include: { category: true } } },
  });
  if (!period) return null;

  const expenses = await db.transaction.findMany({
    where: {
      transactionDate: { gte: period.startsOn, lt: exclusiveEnd(period.endsOn) },
      category: { is: { type: "EXPENSE" } },
    },
    select: { amount: true, categoryId: true, budgetCategoryId: true },
  });

  const directSpentByCategory = new Map<string, number>();
  for (const expense of expenses) {
    const categoryId = expense.budgetCategoryId ?? expense.categoryId;
    directSpentByCategory.set(categoryId, (directSpentByCategory.get(categoryId) ?? 0) + Number(expense.amount.toString()));
  }

  const allocationByCategory = new Map(period.allocations.map((allocation) => [allocation.categoryId, allocation]));
  const categories = await db.category.findMany({ where: { type: "EXPENSE" }, include: { parent: { select: { id: true, name: true } } }, orderBy: [{ isArchived: "asc" }, { name: "asc" }] });
  const visibleCategories = categories.filter((category) =>
    !category.isArchived || allocationByCategory.has(category.id) || directSpentByCategory.has(category.id) ||
    categories.some((child) => child.parentId === category.id && (!child.isArchived || allocationByCategory.has(child.id) || directSpentByCategory.has(child.id))),
  );
  const childIdsByParent = new Map<string, string[]>();
  for (const category of visibleCategories) {
    if (category.parentId) childIdsByParent.set(category.parentId, [...(childIdsByParent.get(category.parentId) ?? []), category.id]);
  }
  const orderedCategories = visibleCategories.filter((category) => !category.parentId).flatMap((parent) => [
    parent,
    ...visibleCategories.filter((category) => category.parentId === parent.id),
  ]);
  const allocations = orderedCategories.map((category) => {
    const allocation = allocationByCategory.get(category.id);
    const amount = allocation ? Number(allocation.amount.toString()) : 0;
    const directSpent = directSpentByCategory.get(category.id) ?? 0;
    const childSpent = (childIdsByParent.get(category.id) ?? []).reduce((sum, childId) => sum + (directSpentByCategory.get(childId) ?? 0), 0);
    const spent = directSpent + childSpent;
    return {
      id: allocation?.id ?? null,
      categoryId: category.id,
      category: { id: category.id, name: category.name, type: category.type, isArchived: category.isArchived, parentId: category.parentId, parent: category.parent },
      amount: String(amount),
      spent: String(spent),
      directSpent: String(directSpent),
      remaining: String(amount - spent),
    };
  });

  const totalBudget = allocations.filter((row) => !row.category.parentId).reduce((total, row) => total + Number(row.amount), 0);
  const totalSpent = expenses.reduce((total, expense) => total + Number(expense.amount.toString()), 0);
  return {
    id: period.id,
    startsOn: period.startsOn.toISOString().slice(0, 10),
    endsOn: period.endsOn.toISOString().slice(0, 10),
    createdAt: period.createdAt,
    updatedAt: period.updatedAt,
    allocations,
    totalBudget: String(totalBudget),
    totalSpent: String(totalSpent),
    totalRemaining: String(totalBudget - totalSpent),
  };
}
