import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api/responses";
import { getBudgetPeriodDetails } from "@/lib/budget/data";
import { parseBudgetAllocations } from "@/lib/budget/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "Format data tidak valid.", 400);
  }
  const allocations = parseBudgetAllocations(body);
  if (!allocations) return errorResponse("INVALID_ALLOCATIONS", "Periksa kategori budget dan jumlahnya.", 400);
  const { id } = await context.params;

  try {
    const period = await db.budgetPeriod.findUnique({ where: { id }, select: { id: true } });
    if (!period) return errorResponse("PERIOD_NOT_FOUND", "Periode budget tidak ditemukan.", 404);

    const categories = await db.category.findMany({
      where: { id: { in: allocations.map((allocation) => allocation.categoryId) }, type: "EXPENSE" },
      select: { id: true, parentId: true },
    });
    if (categories.length !== allocations.length) {
      return errorResponse("INVALID_BUDGET_CATEGORY", "Budget hanya dapat dialokasikan ke kategori pengeluaran.", 400);
    }

    const amountByCategory = new Map(allocations.map(({ categoryId, amount }) => [categoryId, amount]));
    const childTotals = new Map<string, number>();
    for (const category of categories) {
      if (category.parentId) childTotals.set(category.parentId, (childTotals.get(category.parentId) ?? 0) + (amountByCategory.get(category.id) ?? 0));
    }
    for (const [parentId, childrenTotal] of childTotals) {
      if (childrenTotal > (amountByCategory.get(parentId) ?? 0)) {
        return errorResponse("SUBCATEGORY_BUDGET_EXCEEDS_PARENT", "Total budget subkategori tidak boleh melebihi budget kategori induk.", 400);
      }
    }

    const keepCategoryIds = allocations.map((allocation) => allocation.categoryId);
    const operations = [
      keepCategoryIds.length
        ? db.budgetAllocation.deleteMany({ where: { periodId: id, categoryId: { notIn: keepCategoryIds } } })
        : db.budgetAllocation.deleteMany({ where: { periodId: id } }),
      ...allocations.map(({ categoryId, amount }) => db.budgetAllocation.upsert({
        where: { periodId_categoryId: { periodId: id, categoryId } },
        create: { periodId: id, categoryId, amount },
        update: { amount },
      })),
    ];
    await db.$transaction(operations);

    const details = await getBudgetPeriodDetails(id);
    return details
      ? successResponse(details)
      : errorResponse("PERIOD_NOT_FOUND", "Periode budget tidak ditemukan.", 404);
  } catch (error) {
    console.error("Could not save budget allocations", error);
    return errorResponse("INTERNAL_ERROR", "Rencana budget belum dapat disimpan.", 500);
  }
}
