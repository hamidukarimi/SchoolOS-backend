import type { CookieOptions } from "express";
import type { StringValue } from "ms";
import ms from "ms";
import env from "./env.js";

const baseRefreshCookieOptions = (): CookieOptions => {
  const options: CookieOptions = {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: "/api",
  };

  if (env.cookieDomain) {
    options.domain = env.cookieDomain;
  }

  return options;
};

export const refreshCookieOptions = (): CookieOptions => ({
  ...baseRefreshCookieOptions(),
  maxAge: ms(env.jwtRefreshExpiresIn as StringValue),
});

export const clearRefreshCookieOptions = (): CookieOptions =>
  baseRefreshCookieOptions();
