import { db } from "@/lib/db";
import { errorResponse, isPrismaErrorCode, isRecord, successResponse } from "@/lib/api/responses";
import { parseCategoryInput } from "@/lib/master-data/validation";
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
  const input = archiveValue === null ? parseCategoryInput(body) : null;

  if (archiveValue === null && !input) {
    return errorResponse("INVALID_CATEGORY", "Periksa nama dan jenis kategori.", 400);
  }

  try {
    if (input) {
      const [parent, existing] = await Promise.all([
        input.parentId
          ? db.category.findFirst({ where: { id: input.parentId, type: input.type, parentId: null, isArchived: false }, select: { id: true } })
          : Promise.resolve(null),
        db.category.findUnique({ where: { id }, select: { id: true, type: true, subcategories: { select: { id: true } } } }),
      ]);
      if (!existing) return errorResponse("CATEGORY_NOT_FOUND", "Kategori tidak ditemukan.", 404);
      if (input.parentId && !parent) return errorResponse("INVALID_CATEGORY_PARENT", "Subkategori harus menggunakan kategori induk aktif dengan jenis yang sama.", 400);
      if (existing.subcategories.length && (input.parentId || input.type !== existing.type)) {
        return errorResponse("CATEGORY_HAS_SUBCATEGORIES", "Kategori induk yang memiliki subkategori tidak dapat dijadikan subkategori atau diubah jenisnya.", 400);
      }

      const duplicate = await db.category.findFirst({
        where: {
          type: input.type,
          name: { equals: input.name, mode: "insensitive" },
          id: { not: id },
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
    }

    const category = await db.category.update({
      where: { id },
      data: input ?? { isArchived: archiveValue as boolean },
      include: { parent: { select: { id: true, name: true } } },
    });
    return successResponse(category);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return errorResponse("CATEGORY_NOT_FOUND", "Kategori tidak ditemukan.", 404);
    }
    if (isPrismaErrorCode(error, "P2002")) {
      return errorResponse(
        "CATEGORY_NAME_EXISTS",
        "Kategori dengan jenis tersebut sudah ada.",
        409,
      );
    }

    console.error("Could not update category", error);
    return errorResponse("INTERNAL_ERROR", "Perubahan kategori belum dapat disimpan.", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  const { id } = await context.params;

  try {
    const category = await db.category.update({
      where: { id },
      data: { isArchived: true },
    });
    return successResponse(category);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return errorResponse("CATEGORY_NOT_FOUND", "Kategori tidak ditemukan.", 404);
    }

    console.error("Could not archive category", error);
    return errorResponse("INTERNAL_ERROR", "Kategori belum dapat diarsipkan.", 500);
  }
}
