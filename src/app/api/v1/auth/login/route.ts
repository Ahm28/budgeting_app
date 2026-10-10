import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  AUTH_SESSION_SECONDS,
  createSessionToken,
  verifyAccessKey,
} from "@/lib/auth";
import { errorResponse, isRecord, successResponse } from "@/lib/api/responses";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "Format data tidak valid.", 400);
  }

  if (!isRecord(body) || !verifyAccessKey(body.accessKey)) {
    return errorResponse("INVALID_CREDENTIAL", "Kunci akses tidak sesuai.", 401);
  }

  const token = createSessionToken();
  if (!token) {
    return errorResponse("AUTH_NOT_CONFIGURED", "Konfigurasi autentikasi belum lengkap.", 503);
  }

  const expiresAt = Number(token.split(".")[0]) * 1000;
  const response = NextResponse.json(successResponse({ authenticated: true, expiresAt }));
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_SESSION_SECONDS,
  });
  return response;
}
