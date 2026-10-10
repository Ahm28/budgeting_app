import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api/responses";
import { parseAccountTransferInput } from "@/lib/cash-flow/validation";

const transferInclude = {
  fromAccount: { select: { id: true, name: true, type: true, isArchived: true } },
  toAccount: { select: { id: true, name: true, type: true, isArchived: true } },
} as const;

function selectedMonth(value: string | null) {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const start = new Date(`${value}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { gte: start, lt: end };
}

export async function GET(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const date = selectedMonth(new URL(request.url).searchParams.get("month"));
  if (!date) return errorResponse("INVALID_MONTH", "Pilih periode bulan yang valid.", 400);

  try {
    const transfers = await db.accountTransfer.findMany({
      where: { transferDate: date },
      include: transferInclude,
      orderBy: [{ transferDate: "desc" }, { createdAt: "desc" }],
    });
    return successResponse(transfers);
  } catch (error) {
    console.error("Could not load account transfers", error);
    return errorResponse("INTERNAL_ERROR", "Transfer belum dapat dimuat.", 500);
  }
}

async function parseRequest(request: Request) {
  try {
    const input = parseAccountTransferInput(await request.json());
    return input ? { input } : { error: errorResponse("INVALID_TRANSFER", "Periksa tanggal, jumlah, dan akun tujuan.", 400) };
  } catch {
    return { error: errorResponse("INVALID_JSON", "Format data tidak valid.", 400) };
  }
}

async function activeAccounts(fromAccountId: string, toAccountId: string) {
  const [fromAccount, toAccount] = await Promise.all([
    db.account.findFirst({ where: { id: fromAccountId, isArchived: false }, select: { id: true } }),
    db.account.findFirst({ where: { id: toAccountId, isArchived: false }, select: { id: true } }),
  ]);
  return { fromAccount, toAccount };
}

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  const parsed = await parseRequest(request);
  if (parsed.error) return parsed.error;

  try {
    const references = await activeAccounts(parsed.input.fromAccountId, parsed.input.toAccountId);
    if (!references.fromAccount || !references.toAccount) {
      return errorResponse("ACCOUNT_NOT_FOUND", "Kedua akun harus aktif untuk melakukan transfer.", 400);
    }
    const transfer = await db.accountTransfer.create({
      data: {
        transferDate: new Date(`${parsed.input.transferDate}T00:00:00.000Z`),
        amount: parsed.input.amount,
        description: parsed.input.description || null,
        fromAccountId: parsed.input.fromAccountId,
        toAccountId: parsed.input.toAccountId,
      },
      include: transferInclude,
    });
    return successResponse(transfer, 201);
  } catch (error) {
    console.error("Could not create account transfer", error);
    return errorResponse("INTERNAL_ERROR", "Transfer belum dapat disimpan.", 500);
  }
}
