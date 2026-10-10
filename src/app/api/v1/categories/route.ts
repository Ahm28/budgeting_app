import { db } from "@/lib/db";
import { errorResponse, isPrismaErrorCode, successResponse } from "@/lib/api/responses";
import { parseCategoryInput } from "@/lib/master-data/validation";
import { requireSession } from "@/lib/auth";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  try {
    const categories = await db.category.findMany({
      include: { parent: { select: { id: true, name: true } } },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
    return successResponse(categories);
  } catch (error) {
    console.error("Could not load categories", error);
    return errorResponse("INTERNAL_ERROR", "Kategori belum dapat dimuat.", 500);
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

  const input = parseCategoryInput(body);
  if (!input) {
    return errorResponse("INVALID_CATEGORY", "Periksa nama dan jenis kategori.", 400);
  }

  try {
    if (input.parentId) {
      const parent = await db.category.findFirst({ where: { id: input.parentId, type: input.type, parentId: null, isArchived: false }, select: { id: true } });
      if (!parent) return errorResponse("INVALID_CATEGORY_PARENT", "Subkategori harus menggunakan kategori induk aktif dengan jenis yang sama.", 400);
    }

    const duplicate = await db.category.findFirst({
      where: {
        type: input.type,
        name: { equals: input.name, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (duplicate) {
      return errorResponse(
        "CATEGORY_NAME_EXISTS",
        "Kategori dengan jenis tersebut sudah ada.",
        409,
      );
    }

    const category = await db.category.create({ data: input, include: { parent: { select: { id: true, name: true } } } });
    return successResponse(category, 201);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      return errorResponse(
        "CATEGORY_NAME_EXISTS",
        "Kategori dengan jenis tersebut sudah ada.",
        409,
      );
    }

    console.error("Could not create category", error);
    return errorResponse("INTERNAL_ERROR", "Kategori belum dapat disimpan.", 500);
  }
}
