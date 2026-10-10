import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api/responses";
import { getBudgetPeriodDetails, overlapsBudgetPeriod, toDate } from "@/lib/budget/data";
import { parseBudgetPeriodInput } from "@/lib/budget/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  const { id } = await context.params;

  try {
    const period = await getBudgetPeriodDetails(id);
    return period
      ? successResponse(period)
      : errorResponse("PERIOD_NOT_FOUND", "Periode budget tidak ditemukan.", 404);
  } catch (error) {
    console.error("Could not load budget period", error);
    return errorResponse("INTERNAL_ERROR", "Budget pada periode ini belum dapat dimuat.", 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "Format data tidak valid.", 400);
  }
  const input = parseBudgetPeriodInput(body);
  if (!input) return errorResponse("INVALID_PERIOD", "Tanggal awal dan akhir periode tidak valid.", 400);
  const { id } = await context.params;

  try {
    const exists = await db.budgetPeriod.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return errorResponse("PERIOD_NOT_FOUND", "Periode budget tidak ditemukan.", 404);
    const startsOn = toDate(input.startsOn);
    const endsOn = toDate(input.endsOn);
    if (await overlapsBudgetPeriod(startsOn, endsOn, id)) {
      return errorResponse("PERIOD_OVERLAP", "Periode budget tidak boleh tumpang tindih dengan periode lain.", 409);
    }
    const period = await db.budgetPeriod.update({ where: { id }, data: { startsOn, endsOn } });
    return successResponse({
      id: period.id,
      startsOn: period.startsOn.toISOString().slice(0, 10),
      endsOn: period.endsOn.toISOString().slice(0, 10),
      createdAt: period.createdAt,
      updatedAt: period.updatedAt,
    });
  } catch (error) {
    console.error("Could not update budget period", error);
    return errorResponse("INTERNAL_ERROR", "Tanggal periode belum dapat diubah.", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  const { id } = await context.params;

  try {
    await db.budgetPeriod.delete({ where: { id } });
    return successResponse({ id });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      return errorResponse("PERIOD_NOT_FOUND", "Periode budget tidak ditemukan.", 404);
    }
    console.error("Could not delete budget period", error);
    return errorResponse("INTERNAL_ERROR", "Periode budget belum dapat dihapus.", 500);
  }
}
