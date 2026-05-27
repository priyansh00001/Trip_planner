// src/app/api/transport-proxy/route.ts
// Proxies GET /api/transport requests to the Python backend

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const origin      = searchParams.get("origin") || ""
  const destination = searchParams.get("destination") || ""
  const authenticated = searchParams.get("authenticated") ?? "true"

  if (!origin || !destination) {
    return new Response(
      JSON.stringify({ error: "origin and destination are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  const backend = process.env.PYTHON_BACKEND_URL ?? "http://localhost:8000"

  try {
    const res = await fetch(
      `${backend}/api/transport?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&authenticated=${authenticated}`
    )
    const data = await res.json()
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Proxy error" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    )
  }
}
