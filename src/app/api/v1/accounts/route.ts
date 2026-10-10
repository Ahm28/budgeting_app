import { db } from "@/lib/db";
import { errorResponse, isPrismaErrorCode, successResponse } from "@/lib/api/responses";
import { parseAccountInput } from "@/lib/master-data/validation";
import { requireSession } from "@/lib/auth";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  try {
    const accounts = await db.account.findMany({ orderBy: { name: "asc" } });
    return successResponse(accounts);
  } catch (error) {
    console.error("Could not load accounts", error);
    return errorResponse("INTERNAL_ERROR", "Akun belum dapat dimuat.", 500);
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

  const input = parseAccountInput(body);
  if (!input) {
    return errorResponse(
      "INVALID_ACCOUNT",
      "Periksa nama, jenis akun, saldo awal, dan saldo minimum.",
      400,
    );
  }

  try {
    const duplicate = await db.account.findFirst({
      where: { name: { equals: input.name, mode: "insensitive" } },
      select: { id: true },
    });

    if (duplicate) {
      return errorResponse("ACCOUNT_NAME_EXISTS", "Nama akun sudah digunakan.", 409);
    }

    const account = await db.account.create({ data: input });
    return successResponse(account, 201);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      return errorResponse("ACCOUNT_NAME_EXISTS", "Nama akun sudah digunakan.", 409);
    }

    console.error("Could not create account", error);
    return errorResponse("INTERNAL_ERROR", "Akun belum dapat disimpan.", 500);
  }
}
