const ORIGIN = "https://digisource.yg771085.workers.dev";
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": ORIGIN,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  }
});
const safeLimit = (value) => {
  const n = Number.parseInt(value || "24", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 24;
};
const clean = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
const slugFor = (title) => {
  const base = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "resource";
  return base + "-" + crypto.randomUUID().slice(0, 8);
};
const fieldFrom = (summary, label) => {
  const line = summary.split("\n").find((x) => x.startsWith(label + ":"));
  return line ? line.slice(label.length + 1).trim() : "";
};
const adminAllowed = (request, env) => {
  const configured = env.ADMIN_TOKEN;
  const supplied = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!configured || !supplied || supplied.length !== configured.length) return false;
  let diff = 0;
  for (let i = 0; i < configured.length; i++) diff |= configured.charCodeAt(i) ^ supplied.charCodeAt(i);
  return diff === 0;
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return json({ ok: true });
    if (!env.DB) return json({ error: "Database binding is missing" }, 503);

    try {
      if (url.pathname === "/health" && request.method === "GET") {
        const row = await env.DB.prepare("SELECT 1 AS ok").first();
        return json({ service: "DigiSource API", database: row?.ok === 1 ? "connected" : "unavailable" });
      }

      if (url.pathname === "/api/submissions" && request.method === "POST") {
        const length = Number(request.headers.get("content-length") || "0");
        if (length > 12000) return json({ error: "Submission is too large" }, 413);
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object") return json({ error: "Invalid request" }, 400);
        if (clean(body.website, 200)) return json({ ok: true, message: "Submission received for review" }, 201);
        const kind = clean(body.kind, 20);
        const title = clean(body.title, 160);
        const email = clean(body.email, 254).toLowerCase();
        const summary = clean(body.summary, 4000);
        if (!["product", "research", "dataset"].includes(kind)) return json({ error: "Choose a valid submission type" }, 400);
        if (title.length < 3) return json({ error: "Please enter a title of at least 3 characters" }, 400);
        if (!validEmail(email)) return json({ error: "Please enter a valid contact email" }, 400);
        if (body.rightsConfirmed !== true) return json({ error: "Please confirm you have permission to share this content" }, 400);

        const recent = await env.DB.prepare(
          "SELECT COUNT(*) AS total FROM submissions WHERE contact_email = ? AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour')"
        ).bind(email).first();
        if ((recent?.total || 0) >= 3) return json({ error: "This email has reached the hourly submission limit. Please try again later." }, 429);

        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO submissions (id, kind, title, contact_email, summary, rights_confirmed, review_status) VALUES (?, ?, ?, ?, ?, 1, 'pending')"
        ).bind(id, kind, title, email, summary).run();
        return json({ ok: true, id, status: "pending", message: "Your submission details were received for review. Files are not uploaded yet." }, 201);
      }

      if (url.pathname.startsWith("/api/admin/")) {
        if (!env.ADMIN_TOKEN) return json({ error: "Admin access is not configured yet. Set the ADMIN_TOKEN Worker secret first." }, 503);
        if (!adminAllowed(request, env)) return json({ error: "Unauthorized" }, 401);

        if (url.pathname === "/api/admin/submissions" && request.method === "GET") {
          const result = await env.DB.prepare(
            "SELECT id, kind, title, contact_email, summary, review_status, created_at FROM submissions WHERE review_status = 'pending' ORDER BY created_at ASC LIMIT 100"
          ).all();
          return json({ items: result.results || [], count: (result.results || []).length });
        }

        if (url.pathname === "/api/admin/review" && request.method === "POST") {
          const body = await request.json().catch(() => null);
          const id = clean(body?.id, 80);
          const decision = clean(body?.decision, 20);
          if (!id || !["approve", "reject"].includes(decision)) return json({ error: "A submission ID and valid decision are required" }, 400);
          const item = await env.DB.prepare(
            "SELECT id, kind, title, contact_email, summary, review_status FROM submissions WHERE id = ?"
          ).bind(id).first();
          if (!item) return json({ error: "Submission not found" }, 404);
          if (item.review_status !== "pending") return json({ error: "This submission has already been reviewed" }, 409);

          if (decision === "reject") {
            await env.DB.prepare("UPDATE submissions SET review_status = 'rejected' WHERE id = ? AND review_status = 'pending'").bind(id).run();
            return json({ ok: true, status: "rejected" });
          }

          const slug = slugFor(item.title);
          if (item.kind === "product") {
            await env.DB.prepare(
              "INSERT INTO products (id, title, slug, description, category, creator_name, licence, status) VALUES (?, ?, ?, ?, 'General', 'Community contributor', 'See item details', 'published')"
            ).bind(crypto.randomUUID(), item.title, slug, item.summary).run();
          } else if (item.kind === "research") {
            await env.DB.prepare(
              "INSERT INTO research (id, title, slug, summary, author_name, sources, licence, status) VALUES (?, ?, ?, ?, 'Community contributor', '', 'See item details', 'published')"
            ).bind(crypto.randomUUID(), item.title, slug, item.summary).run();
          } else {
            const format = fieldFrom(item.summary, "Format") || "Unknown";
            const rawCount = fieldFrom(item.summary, "Approximate records");
            const records = /^\d+$/.test(rawCount) ? Number(rawCount) : null;
            const rawSource = fieldFrom(item.summary, "Source");
            const source = /^https?:\/\//i.test(rawSource) ? rawSource.slice(0, 500) : "";
            const licence = fieldFrom(item.summary, "Licence") || "Not specified";
            const description = fieldFrom(item.summary, "Description") || item.summary;
            await env.DB.prepare(
              "INSERT INTO datasets (id, title, slug, description, format, records_count, source_url, licence, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published')"
            ).bind(crypto.randomUUID(), item.title, slug, description, format, records, source, licence).run();
          }
          await env.DB.prepare("UPDATE submissions SET review_status = 'approved' WHERE id = ? AND review_status = 'pending'").bind(id).run();
          return json({ ok: true, status: "approved" });
        }
        return json({ error: "Not found" }, 404);
      }

      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      const routes = {
        "/api/products": "SELECT id, title, slug, description, category, creator_name, licence, cover_key, created_at FROM products WHERE status = 'published' AND (? = '' OR title LIKE ? OR description LIKE ? OR category LIKE ?) ORDER BY created_at DESC LIMIT ?",
        "/api/research": "SELECT id, title, slug, summary, author_name, sources, licence, created_at FROM research WHERE status = 'published' AND (? = '' OR title LIKE ? OR summary LIKE ?) ORDER BY created_at DESC LIMIT ?",
        "/api/datasets": "SELECT id, title, slug, description, format, records_count, source_url, licence, created_at FROM datasets WHERE status = 'published' AND (? = '' OR title LIKE ? OR description LIKE ? OR format LIKE ?) ORDER BY created_at DESC LIMIT ?"
      };
      const sql = routes[url.pathname];
      if (!sql) return json({ error: "Not found" }, 404);
      const q = clean(url.searchParams.get("q") || "", 80);
      const pattern = `%${q}%`;
      const limit = safeLimit(url.searchParams.get("limit"));
      const statement = url.pathname === "/api/research"
        ? env.DB.prepare(sql).bind(q, pattern, pattern, limit)
        : env.DB.prepare(sql).bind(q, pattern, pattern, pattern, limit);
      const result = await statement.all();
      return json({ items: result.results || [], count: (result.results || []).length });
    } catch (error) {
      return json({ error: "Backend request failed" }, 500);
    }
  }
};