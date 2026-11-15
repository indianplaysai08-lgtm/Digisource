const ORIGIN = "https://digisource.yg771085.workers.dev";
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": ORIGIN,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
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
          "SELECT COUNT(*) AS total FROM submissions WHERE contact_email = ? AND created_at >= datetime('now','-1 hour')"
        ).bind(email).first();
        if ((recent?.total || 0) >= 3) return json({ error: "This email has reached the hourly submission limit. Please try again later." }, 429);

        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO submissions (id, kind, title, contact_email, summary, rights_confirmed, review_status) VALUES (?, ?, ?, ?, ?, 1, 'pending')"
        ).bind(id, kind, title, email, summary).run();
        return json({ ok: true, id, status: "pending", message: "Your submission details were received for review. Files are not uploaded yet." }, 201);
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