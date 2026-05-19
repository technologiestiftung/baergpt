import { Hono } from "hono";
import type { Context } from "hono";
import { captureError } from "../monitoring/capture-error";

const cache = new Map<string, { data: ArrayBuffer; contentType: string; expiresAt: number }>();
const TTL_MS = 24 * 60 * 60 * 1000;

const favicon = new Hono();

// route to fetch favicon for a given domain
favicon.get("/", async (c: Context) => {
  const domain = c.req.query("domain");

  if (!domain) {
    return c.json({ error: "Invalid domain" }, 400);
  }

  const now = Date.now();
  const cached = cache.get(domain);

  if (cached && cached.expiresAt > now) {
    return c.body(cached.data, 200, { "Content-Type": cached.contentType });
  }

  try {
    const response = await fetch(
      `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
    );

    if (!response.ok) {
      return c.json({ error: "Failed to fetch favicon" }, 502);
    }

    const contentType = response.headers.get("Content-Type") ?? "image/png";
    const data = await response.arrayBuffer();

    cache.set(domain, { data, contentType, expiresAt: now + TTL_MS });

    return c.body(data, 200, { "Content-Type": contentType });
  } catch (error) {
    captureError(error);
    return c.json({ error: "Failed to fetch favicon" }, 502);
  }
});

export default favicon;
