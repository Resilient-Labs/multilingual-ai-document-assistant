import { NextResponse } from "next/server";
import { API_CSRF_COOKIE_NAME } from "@/lib/api-security";

const CSRF_TOKEN_TTL_SECONDS = 60 * 60 * 8;

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const existingToken = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${API_CSRF_COOKIE_NAME}=`))
    ?.slice(API_CSRF_COOKIE_NAME.length + 1);

  const csrfToken = existingToken || crypto.randomUUID();
  const response = NextResponse.json(
    { csrfToken },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );

  response.cookies.set({
    name: API_CSRF_COOKIE_NAME,
    value: csrfToken,
    httpOnly: false,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CSRF_TOKEN_TTL_SECONDS,
  });

  return response;
}
