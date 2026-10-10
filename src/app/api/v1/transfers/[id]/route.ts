import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api/responses";
import { parseAccountTransferInput } from "@/lib/cash-flow/validation";

type RouteContext = { params: Promise<{ id: string }> };

const transferInclude = {
  fromAccount: { select: { id: true, name: true, type: true, isArchived: true } },
  toAccount: { select: { id: true, name: true, type: true, isArchived: true } },
} as const;

async function parseRequest(request: Request) {
  try {
    const input = parseAccountTransferInput(await request.json());
    return input ? { input } : { error: errorResponse("INVALID_TRANSFER", "Periksa tanggal, jumlah, dan akun tujuan.", 400) };
  } catch {
    return { error: errorResponse("INVALID_JSON", "Format data tidak valid.", 400) };
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  const parsed = await parseRequest(request);
  if (parsed.error) return parsed.error;
  const { id } = await context.params;

  try {
    const [exists, fromAccount, toAccount] = await Promise.all([
      db.accountTransfer.findUnique({ where: { id }, select: { id: true } }),
      db.account.findFirst({ where: { id: parsed.input.fromAccountId, isArchived: false }, select: { id: true } }),
      db.account.findFirst({ where: { id: parsed.input.toAccountId, isArchived: false }, select: { id: true } }),
    ]);
    if (!exists) return errorResponse("TRANSFER_NOT_FOUND", "Transfer tidak ditemukan.", 404);
    if (!fromAccount || !toAccount) return errorResponse("ACCOUNT_NOT_FOUND", "Kedua akun harus aktif untuk melakukan transfer.", 400);

    const transfer = await db.accountTransfer.update({
      where: { id },
      data: {
        transferDate: new Date(`${parsed.input.transferDate}T00:00:00.000Z`),
        amount: parsed.input.amount,
        description: parsed.input.description || null,
        fromAccountId: parsed.input.fromAccountId,
        toAccountId: parsed.input.toAccountId,
      },
      include: transferInclude,
    });
    return successResponse(transfer);
  } catch (error) {
    console.error("Could not update account transfer", error);
    return errorResponse("INTERNAL_ERROR", "Perubahan transfer belum dapat disimpan.", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  const { id } = await context.params;

  try {
    const transfer = await db.accountTransfer.delete({ where: { id } });
    return successResponse({ id: transfer.id });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      return errorResponse("TRANSFER_NOT_FOUND", "Transfer tidak ditemukan.", 404);
    }
    console.error("Could not delete account transfer", error);
    return errorResponse("INTERNAL_ERROR", "Transfer belum dapat dihapus.", 500);
  }
}
