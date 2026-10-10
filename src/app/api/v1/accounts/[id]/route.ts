import { db } from "@/lib/db";
import { errorResponse, isPrismaErrorCode, isRecord, successResponse } from "@/lib/api/responses";
import { parseAccountInput } from "@/lib/master-data/validation";
import { requireSession } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "Format data tidak valid.", 400);
  }

  const archiveValue =
    isRecord(body) && typeof body.isArchived === "boolean" ? body.isArchived : null;
  const input = archiveValue === null ? parseAccountInput(body) : null;

  if (archiveValue === null && !input) {
    return errorResponse(
      "INVALID_ACCOUNT",
      "Periksa nama, jenis akun, saldo awal, dan saldo minimum.",
      400,
    );
  }

  try {
    if (input) {
      const duplicate = await db.account.findFirst({
        where: {
          name: { equals: input.name, mode: "insensitive" },
          id: { not: id },
        },
        select: { id: true },
      });

      if (duplicate) {
        return errorResponse("ACCOUNT_NAME_EXISTS", "Nama akun sudah digunakan.", 409);
      }
    }

    const account = await db.account.update({
      where: { id },
      data: input ?? { isArchived: archiveValue as boolean },
    });
    return successResponse(account);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return errorResponse("ACCOUNT_NOT_FOUND", "Akun tidak ditemukan.", 404);
    }
    if (isPrismaErrorCode(error, "P2002")) {
      return errorResponse("ACCOUNT_NAME_EXISTS", "Nama akun sudah digunakan.", 409);
    }

    console.error("Could not update account", error);
    return errorResponse("INTERNAL_ERROR", "Perubahan akun belum dapat disimpan.", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  const { id } = await context.params;

  try {
    const account = await db.account.update({
      where: { id },
      data: { isArchived: true },
    });
    return successResponse(account);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return errorResponse("ACCOUNT_NOT_FOUND", "Akun tidak ditemukan.", 404);
    }

    console.error("Could not archive account", error);
    return errorResponse("INTERNAL_ERROR", "Akun belum dapat diarsipkan.", 500);
  }
}
