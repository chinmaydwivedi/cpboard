import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const isDevelopment = process.env.NODE_ENV === "development";
const STATIC_PATHS = new Set([
  "/favicon.ico",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/icon-maskable-192x192.png",
  "/icon-maskable-512x512.png",
  "/manifest.webmanifest",
  "/sw.js",
  "/.well-known/security.txt",
]);

function getPosthogOrigin() {
  try {
    const url = new URL(
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    );
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

function buildContentSecurityPolicy(nonce: string) {
  const posthogOrigin = getPosthogOrigin();
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}${posthogOrigin ? ` ${posthogOrigin}` : ""}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function pageResponse(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

function apiResponse(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return NextResponse.next();

  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  if (!origin) return NextResponse.next();

  try {
    const requestOrigin = new URL(origin);
    if (requestOrigin.origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
    }
    if (
      process.env.NODE_ENV === "production" &&
      requestOrigin.protocol !== "https:"
    ) {
      return NextResponse.json({ error: "Secure origin required" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  return NextResponse.next();
}

export function proxy(request: NextRequest) {
  if (STATIC_PATHS.has(request.nextUrl.pathname)) return NextResponse.next();
  return request.nextUrl.pathname.startsWith("/api/")
    ? apiResponse(request)
    : pageResponse(request);
}

export const config = {
  matcher: [
    "/api/:path*",
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon-192x192.png|icon-512x512.png|icon-maskable-192x192.png|icon-maskable-512x512.png|bg/|cpboard-app-icon.svg|file.svg|globe.svg|next.svg|vercel.svg|window.svg|.well-known/security.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
