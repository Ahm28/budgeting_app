import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api/responses";
import { parseTransactionInput } from "@/lib/cash-flow/validation";
import type { CategoryType } from "@/lib/master-data/types";

const transactionInclude = {
  account: { select: { id: true, name: true, type: true, isArchived: true } },
  category: { select: { id: true, name: true, type: true, isArchived: true, parentId: true, parent: { select: { id: true, name: true } } } },
  budgetCategory: { select: { id: true, name: true, type: true, isArchived: true, parentId: true, parent: { select: { id: true, name: true } } } },
} as const;

const transferInclude = {
  fromAccount: { select: { id: true, name: true, type: true, isArchived: true } },
  toAccount: { select: { id: true, name: true, type: true, isArchived: true } },
} as const;

function monthRange(value: string | null) {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const start = new Date(`${value}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { start, end };
}

function sumValue(value: { toString(): string } | null | undefined) {
  return value?.toString() ?? "0";
}

export async function GET(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const range = monthRange(url.searchParams.get("month"));
  if (!range) return errorResponse("INVALID_MONTH", "Pilih periode bulan yang valid.", 400);

  try {
    const dateFilter = { transactionDate: { gte: range.start, lt: range.end } };
    const transferDateFilter = { transferDate: { gte: range.start, lt: range.end } };
    const [transactions, transfers, income, expense, accounts, allIncome, allExpense, allTransfersOut, allTransfersIn] = await Promise.all([
      db.transaction.findMany({
        where: dateFilter,
        include: transactionInclude,
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      }),
      db.accountTransfer.findMany({
        where: transferDateFilter,
        include: transferInclude,
        orderBy: [{ transferDate: "desc" }, { createdAt: "desc" }],
      }),
      db.transaction.aggregate({
        where: { ...dateFilter, category: { is: { type: "INCOME" } } },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: { ...dateFilter, category: { is: { type: "EXPENSE" } } },
        _sum: { amount: true },
      }),
      db.account.findMany({ orderBy: { name: "asc" } }),
      db.transaction.groupBy({
        by: ["accountId"],
        where: { category: { is: { type: "INCOME" } } },
        _sum: { amount: true },
      }),
      db.transaction.groupBy({
        by: ["accountId"],
        where: { category: { is: { type: "EXPENSE" } } },
        _sum: { amount: true },
      }),
      db.accountTransfer.groupBy({
        by: ["fromAccountId"],
        _sum: { amount: true },
      }),
      db.accountTransfer.groupBy({
        by: ["toAccountId"],
        _sum: { amount: true },
      }),
    ]);

    const incomeByAccount = new Map(allIncome.map((row) => [row.accountId, Number(sumValue(row._sum.amount))]));
    const expenseByAccount = new Map(allExpense.map((row) => [row.accountId, Number(sumValue(row._sum.amount))]));
    const transferOutByAccount = new Map(allTransfersOut.map((row) => [row.fromAccountId, Number(sumValue(row._sum.amount))]));
    const transferInByAccount = new Map(allTransfersIn.map((row) => [row.toAccountId, Number(sumValue(row._sum.amount))]));
    const accountBalances = accounts.map((account) => {
      const accountIncome = incomeByAccount.get(account.id) ?? 0;
      const accountExpense = expenseByAccount.get(account.id) ?? 0;
      const transferOut = transferOutByAccount.get(account.id) ?? 0;
      const transferIn = transferInByAccount.get(account.id) ?? 0;
      const openingBalance = Number(account.openingBalance.toString());
      return {
        account: {
          id: account.id,
          name: account.name,
          type: account.type,
          isArchived: account.isArchived,
        },
        openingBalance: String(openingBalance),
        income: String(accountIncome),
        expense: String(accountExpense),
        transferIn: String(transferIn),
        transferOut: String(transferOut),
        balance: String(openingBalance + accountIncome - accountExpense - transferOut + transferIn),
      };
    });

    const incomeTotal = Number(sumValue(income._sum.amount));
    const expenseTotal = Number(sumValue(expense._sum.amount));
    return successResponse({
      transactions,
      transfers,
      summary: {
        income: String(incomeTotal),
        expense: String(expenseTotal),
        net: String(incomeTotal - expenseTotal),
      },
      accountBalances,
    });
  } catch (error) {
    console.error("Could not load transactions", error);
    return errorResponse("INTERNAL_ERROR", "Arus kas belum dapat dimuat.", 500);
  }
}

async function validateReferences(input: NonNullable<ReturnType<typeof parseTransactionInput>>) {
  const [account, category, budgetCategory] = await Promise.all([
    db.account.findFirst({ where: { id: input.accountId, isArchived: false }, select: { id: true } }),
    db.category.findFirst({
      where: {
        id: input.categoryId,
        isArchived: false,
        type: input.categoryType as CategoryType,
      },
      select: { id: true },
    }),
    input.budgetCategoryId
      ? db.category.findFirst({
          where: { id: input.budgetCategoryId, isArchived: false, type: "EXPENSE" },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  return { account, category, budgetCategory };
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

  const input = parseTransactionInput(body);
  if (!input) return errorResponse("INVALID_TRANSACTION", "Periksa tanggal, jumlah, akun, dan kategori.", 400);

  try {
    const references = await validateReferences(input);
    if (!references.account) return errorResponse("ACCOUNT_NOT_FOUND", "Akun aktif tidak ditemukan.", 400);
    if (!references.category) return errorResponse("CATEGORY_NOT_FOUND", "Kategori aktif tidak sesuai dengan jenis transaksi.", 400);
    if (input.budgetCategoryId && !references.budgetCategory) return errorResponse("BUDGET_CATEGORY_NOT_FOUND", "Kategori sumber budget harus berupa kategori pengeluaran yang aktif.", 400);

    const transaction = await db.transaction.create({
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
    return successResponse(transaction, 201);
  } catch (error) {
    console.error("Could not create transaction", error);
    return errorResponse("INTERNAL_ERROR", "Transaksi belum dapat disimpan.", 500);
  }
}
