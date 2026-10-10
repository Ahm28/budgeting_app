import { getCurrentSessionExpiration } from "@/lib/auth";
import { successResponse } from "@/lib/api/responses";

export async function GET() {
  const expiresAt = await getCurrentSessionExpiration();
  return successResponse({ authenticated: expiresAt !== null, expiresAt });
}
