import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api/responses";
import { exclusiveEnd, getBudgetPeriodDetails } from "@/lib/budget/data";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function numberString(value: { toString(): string } | null | undefined) {
  return value?.toString() ?? "0";
}

export async function GET(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const periodId = new URL(request.url).searchParams.get("periodId");
  if (!periodId || !uuidPattern.test(periodId)) {
    return errorResponse("INVALID_PERIOD", "Pilih periode budget yang valid.", 400);
  }

  try {
    const details = await getBudgetPeriodDetails(periodId);
    if (!details) return errorResponse("PERIOD_NOT_FOUND", "Periode budget tidak ditemukan.", 404);

    const startsOn = new Date(`${details.startsOn}T00:00:00.000Z`);
    const endsOn = exclusiveEnd(new Date(`${details.endsOn}T00:00:00.000Z`));
    const dateFilter = { transactionDate: { gte: startsOn, lt: endsOn } };
    const [period, income, allIncome, allExpense, allTransfersOut, allTransfersIn, accounts, transactions, transfers] = await Promise.all([
      db.budgetPeriod.findUnique({ where: { id: periodId } }),
      db.transaction.aggregate({
        where: { ...dateFilter, category: { is: { type: "INCOME" } } },
        _sum: { amount: true },
      }),
      db.transaction.groupBy({ by: ["accountId"], where: { category: { is: { type: "INCOME" } } }, _sum: { amount: true } }),
      db.transaction.groupBy({ by: ["accountId"], where: { category: { is: { type: "EXPENSE" } } }, _sum: { amount: true } }),
      db.accountTransfer.groupBy({ by: ["fromAccountId"], _sum: { amount: true } }),
      db.accountTransfer.groupBy({ by: ["toAccountId"], _sum: { amount: true } }),
      db.account.findMany({ orderBy: { name: "asc" } }),
      db.transaction.findMany({
        where: dateFilter,
        include: {
          account: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, type: true } },
        },
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      }),
      db.accountTransfer.findMany({
        where: { transferDate: { gte: startsOn, lt: endsOn } },
        include: {
          fromAccount: { select: { id: true, name: true } },
          toAccount: { select: { id: true, name: true } },
        },
        orderBy: [{ transferDate: "desc" }, { createdAt: "desc" }],
      }),
    ]);

    if (!period) return errorResponse("PERIOD_NOT_FOUND", "Periode budget tidak ditemukan.", 404);

    const incomeByAccount = new Map(allIncome.map((row) => [row.accountId, Number(numberString(row._sum.amount))]));
    const expenseByAccount = new Map(allExpense.map((row) => [row.accountId, Number(numberString(row._sum.amount))]));
    const transfersOutByAccount = new Map(allTransfersOut.map((row) => [row.fromAccountId, Number(numberString(row._sum.amount))]));
    const transfersInByAccount = new Map(allTransfersIn.map((row) => [row.toAccountId, Number(numberString(row._sum.amount))]));
    const accountBalances = accounts.map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      isArchived: account.isArchived,
      balance: String(
        Number(account.openingBalance.toString()) +
        (incomeByAccount.get(account.id) ?? 0) -
        (expenseByAccount.get(account.id) ?? 0) -
        (transfersOutByAccount.get(account.id) ?? 0) +
        (transfersInByAccount.get(account.id) ?? 0),
      ),
    }));

    const recentActivity = [
      ...transactions.map((transaction) => ({
        id: `transaction-${transaction.id}`,
        date: transaction.transactionDate.toISOString().slice(0, 10),
        createdAt: transaction.createdAt.toISOString(),
        type: transaction.category.type,
        title: transaction.description || transaction.category.name,
        detail: `${transaction.category.name} · ${transaction.account.name}`,
        amount: transaction.amount.toString(),
      })),
      ...transfers.map((transfer) => ({
        id: `transfer-${transfer.id}`,
        date: transfer.transferDate.toISOString().slice(0, 10),
        createdAt: transfer.createdAt.toISOString(),
        type: "TRANSFER" as const,
        title: transfer.description || "Transfer antar akun",
        detail: `${transfer.fromAccount.name} → ${transfer.toAccount.name}`,
        amount: transfer.amount.toString(),
      })),
    ].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 8)
      .map((activity) => ({
        id: activity.id,
        date: activity.date,
        type: activity.type,
        title: activity.title,
        detail: activity.detail,
        amount: activity.amount,
      }));

    const incomeTotal = Number(numberString(income._sum.amount));
    const expenseTotal = Number(details.totalSpent);
    return successResponse({
      period: {
        id: period.id,
        startsOn: period.startsOn.toISOString().slice(0, 10),
        endsOn: period.endsOn.toISOString().slice(0, 10),
        createdAt: period.createdAt,
        updatedAt: period.updatedAt,
      },
      summary: {
        income: String(incomeTotal),
        expense: String(expenseTotal),
        netCashFlow: String(incomeTotal - expenseTotal),
        totalBudget: details.totalBudget,
        budgetSpent: details.totalSpent,
        budgetRemaining: details.totalRemaining,
      },
      categories: details.allocations,
      accountBalances,
      recentActivity,
    });
  } catch (error) {
    console.error("Could not load dashboard", error);
    return errorResponse("INTERNAL_ERROR", "Ringkasan belum dapat dimuat.", 500);
  }
}
