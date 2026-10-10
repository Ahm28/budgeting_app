import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api/responses";
import { parseTransactionInput } from "@/lib/cash-flow/validation";

type RouteContext = { params: Promise<{ id: string }> };

const transactionInclude = {
  account: { select: { id: true, name: true, type: true, isArchived: true } },
  category: { select: { id: true, name: true, type: true, isArchived: true, parentId: true, parent: { select: { id: true, name: true } } } },
  budgetCategory: { select: { id: true, name: true, type: true, isArchived: true, parentId: true, parent: { select: { id: true, name: true } } } },
} as const;

export async function PATCH(request: Request, context: RouteContext) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "Format data tidak valid.", 400);
  }

  const input = parseTransactionInput(body);
  if (!input) return errorResponse("INVALID_TRANSACTION", "Periksa tanggal, jumlah, akun, dan kategori.", 400);
  const { id } = await context.params;

  try {
    const [transactionExists, account, category, budgetCategory] = await Promise.all([
      db.transaction.findUnique({ where: { id }, select: { id: true } }),
      db.account.findFirst({ where: { id: input.accountId, isArchived: false }, select: { id: true } }),
      db.category.findFirst({
        where: { id: input.categoryId, isArchived: false, type: input.categoryType },
        select: { id: true },
      }),
      input.budgetCategoryId
        ? db.category.findFirst({
            where: { id: input.budgetCategoryId, isArchived: false, type: "EXPENSE" },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (!transactionExists) return errorResponse("TRANSACTION_NOT_FOUND", "Transaksi tidak ditemukan.", 404);
    if (!account) return errorResponse("ACCOUNT_NOT_FOUND", "Akun aktif tidak ditemukan.", 400);
    if (!category) return errorResponse("CATEGORY_NOT_FOUND", "Kategori aktif tidak sesuai dengan jenis transaksi.", 400);
    if (input.budgetCategoryId && !budgetCategory) return errorResponse("BUDGET_CATEGORY_NOT_FOUND", "Kategori sumber budget harus berupa kategori pengeluaran yang aktif.", 400);

    const transaction = await db.transaction.update({
      where: { id },
      data: {
        transactionDate: new Date(`${input.transactionDate}T00:00:00.000Z`),
        amount: input.amount,
        description: input.description || null,
        accountId: input.accountId,
        categoryId: input.categoryId,
        budgetCategoryId: input.budgetCategoryId,
      },
      include: transactionInclude,
    });
    return successResponse(transaction);
  } catch (error) {
    console.error("Could not update transaction", error);
    return errorResponse("INTERNAL_ERROR", "Perubahan transaksi belum dapat disimpan.", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  const { id } = await context.params;

  try {
    const transaction = await db.transaction.delete({ where: { id } });
    return successResponse({ id: transaction.id });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      return errorResponse("TRANSACTION_NOT_FOUND", "Transaksi tidak ditemukan.", 404);
    }
    console.error("Could not delete transaction", error);
    return errorResponse("INTERNAL_ERROR", "Transaksi belum dapat dihapus.", 500);
  }
}
