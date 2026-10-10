export type ApiEnvelope<T> = {
  data: T | null;
  error: { code: string; message: string } | null;
};

export function successResponse<T>(data: T, status = 200) {
  return Response.json({ data, error: null } satisfies ApiEnvelope<T>, {
    status,
  });
}

export function errorResponse(code: string, message: string, status: number) {
  return Response.json(
    { data: null, error: { code, message } } satisfies ApiEnvelope<never>,
    { status },
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPrismaErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}
