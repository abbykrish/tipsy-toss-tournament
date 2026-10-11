import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { ApiError } from "./db";

export type AppEnv = { Bindings: Env };

const COOKIE = "tt_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function adminPassword(c: Context<AppEnv>): string {
  const password = c.env.ADMIN_PASSWORD;
  if (!password) throw new ApiError(500, "ADMIN_PASSWORD isn't configured on the server");
  return password;
}

async function sameSecret(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

export async function logIn(c: Context<AppEnv>, password: unknown): Promise<void> {
  const secret = adminPassword(c);
  if (typeof password !== "string" || !(await sameSecret(password, secret))) {
    throw new ApiError(401, "Wrong password");
  }
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  await setSignedCookie(c, COOKIE, String(expires), secret, {
    path: "/",
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Strict",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function logOut(c: Context<AppEnv>): void {
  deleteCookie(c, COOKIE, { path: "/" });
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const value = await getSignedCookie(c, adminPassword(c), COOKIE);
  if (!value || Number(value) < Date.now()) throw new ApiError(401, "Log in to use the admin tools");
  await next();
};
