const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "https://digisource.yg771085.workers.dev",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  }
});

const safeLimit = (value) => {
  const n = Number.parseInt(value || "24", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 24;
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return json({ ok: true });
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
    if (!env.DB) return json({ error: "Database binding is missing" }, 503);

    try {
      if (url.pathname === "/health") {
        const row = await env.DB.prepare("SELECT 1 AS ok").first();
        return json({ service: "DigiSource API", database: row?.ok === 1 ? "connected" : "unavailable" });
      }

      const routes = {
        "/api/products": {
          sql: "SELECT id, title, slug, description, category, creator_name, licence, cover_key, created_at FROM products WHERE status = 'published' AND (? = '' OR title LIKE ? OR description LIKE ? OR category LIKE ?) ORDER BY created_at DESC LIMIT ?",
          search: true
        },
        "/api/research": {
          sql: "SELECT id, title, slug, summary, author_name, sources, licence, created_at FROM research WHERE status = 'published' AND (? = '' OR title LIKE ? OR summary LIKE ?) ORDER BY created_at DESC LIMIT ?",
          search: true
        },
        "/api/datasets": {
          sql: "SELECT id, title, slug, description, format, records_count, source_url, licence, created_at FROM datasets WHERE status = 'published' AND (? = '' OR title LIKE ? OR description LIKE ? OR format LIKE ?) ORDER BY created_at DESC LIMIT ?",
          search: true
        }
      };

      const route = routes[url.pathname];
      if (!route) return json({ error: "Not found" }, 404);
      const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
      const pattern = `%${q}%`;
      const limit = safeLimit(url.searchParams.get("limit"));
      let statement;
      if (url.pathname === "/api/research") {
        statement = env.DB.prepare(route.sql).bind(q, pattern, pattern, limit);
      } else {
        statement = env.DB.prepare(route.sql).bind(q, pattern, pattern, pattern, limit);
      }
      const result = await statement.all();
      return json({ items: result.results || [], count: (result.results || []).length });
    } catch (error) {
      return json({ error: "Backend request failed" }, 500);
    }
  }
};