import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { errorResponse } from "@/lib/api/responses";

export const AUTH_COOKIE_NAME = "budgeting_session";
export const AUTH_SESSION_SECONDS = 30 * 60;

function getSigningSecret() {
  return process.env.AUTH_SECRET;
}

function signature(expiresAt: string, secret: string) {
  return createHmac("sha256", secret).update(expiresAt).digest("base64url");
}

export function verifyAccessKey(value: unknown) {
  const expected = process.env.APP_ACCESS_KEY;
  if (typeof value !== "string" || !expected) return false;

  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function createSessionToken(now = Date.now()) {
  const secret = getSigningSecret();
  if (!secret) return null;

  const expiresAt = String(Math.floor(now / 1000) + AUTH_SESSION_SECONDS);
  return `${expiresAt}.${signature(expiresAt, secret)}`;
}

export function isValidSessionToken(token: string | undefined, now = Date.now()) {
  return getSessionExpiration(token, now) !== null;
}

export function getSessionExpiration(token: string | undefined, now = Date.now()) {
  const secret = getSigningSecret();
  if (!token || !secret) return null;

  const [expiresAt, providedSignature, extra] = token.split(".");
  if (!expiresAt || !providedSignature || extra || !/^\d+$/.test(expiresAt)) return null;
  if (Number(expiresAt) <= Math.floor(now / 1000)) return null;

  const expectedBuffer = Buffer.from(signature(expiresAt, secret));
  const providedBuffer = Buffer.from(providedSignature);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer)
    ? Number(expiresAt) * 1000
    : null;
}

export async function hasValidSession() {
  const cookieStore = await cookies();
  return isValidSessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}

export async function getCurrentSessionExpiration() {
  const cookieStore = await cookies();
  return getSessionExpiration(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}

export async function requireSession() {
  return (await hasValidSession())
    ? null
    : errorResponse("UNAUTHORIZED", "Sesi berakhir. Silakan masuk kembali.", 401);
}
