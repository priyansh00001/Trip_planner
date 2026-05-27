// src/app/api/transport-proxy/scrape-now/route.ts
// Proxies POST /api/transport/scrape-now to the Python backend
// Streams SSE response back to the browser

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const body    = await req.json()
  const backend = process.env.PYTHON_BACKEND_URL ?? "http://localhost:8000"

  if (!body.origin || !body.destination) {
    return new Response(
      JSON.stringify({ error: "origin and destination required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  try {
    const res = await fetch(`${backend}/api/transport/scrape-now`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    })

    // Stream the SSE response straight through
    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type":  "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Proxy error" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    )
  }
}
