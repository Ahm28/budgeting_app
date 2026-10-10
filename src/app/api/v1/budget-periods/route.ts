import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api/responses";
import { overlapsBudgetPeriod, toDate } from "@/lib/budget/data";
import { parseBudgetPeriodInput } from "@/lib/budget/validation";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const periods = await db.budgetPeriod.findMany({ orderBy: { startsOn: "desc" } });
    return successResponse(periods.map((period) => ({
      id: period.id,
      startsOn: period.startsOn.toISOString().slice(0, 10),
      endsOn: period.endsOn.toISOString().slice(0, 10),
      createdAt: period.createdAt,
      updatedAt: period.updatedAt,
    })));
  } catch (error) {
    console.error("Could not load budget periods", error);
    return errorResponse("INTERNAL_ERROR", "Periode budget belum dapat dimuat.", 500);
  }
}

export async function POST(request: Request) {
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

  try {
    const startsOn = toDate(input.startsOn);
    const endsOn = toDate(input.endsOn);
    if (await overlapsBudgetPeriod(startsOn, endsOn)) {
      return errorResponse("PERIOD_OVERLAP", "Periode budget tidak boleh tumpang tindih dengan periode lain.", 409);
    }
    const period = await db.budgetPeriod.create({ data: { startsOn, endsOn } });
    return successResponse({
      id: period.id,
      startsOn: period.startsOn.toISOString().slice(0, 10),
      endsOn: period.endsOn.toISOString().slice(0, 10),
      createdAt: period.createdAt,
      updatedAt: period.updatedAt,
    }, 201);
  } catch (error) {
    console.error("Could not create budget period", error);
    return errorResponse("INTERNAL_ERROR", "Periode budget belum dapat dibuat.", 500);
  }
}
