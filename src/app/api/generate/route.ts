import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  // Rate limit: full AI itinerary is expensive — 5 per IP per 5 minutes
  const { ok, retryAfter } = rateLimit(request, { limit: 5, windowMs: 5 * 60 * 1000 })
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down and try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  try {
    const tripData = await request.json()
    const { destination, duration_days, budget_range, preference, confirmed_stay, selected_places } = tripData

    const BACKEND = process.env.PYTHON_BACKEND_URL ?? "http://localhost:8000";

    // Handle potential legacy fields if the frontend hasn't been fully updated yet
    const startDate = tripData.startDate || new Date().toISOString().split('T')[0];
    const endDate = tripData.endDate || new Date(Date.now() + (duration_days || 3) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Convert budget_range (INR) to budget_usd by dividing by 83
    const budgetInr = parseFloat(budget_range || "10000");
    const budgetUsd = Math.round((budgetInr / 83.0) * 100) / 100; // Round to 2 decimal places

    const travelers = tripData.travelers || 1;
    const style = preference || "balanced";
    const originCity = tripData.originCity || "DEL"; // Default IATA for MVP

    // POST directly to our FastAPI backend's SSE /api/plan endpoint
    const internalToken = process.env.INTERNAL_API_TOKEN ?? ''
    const upstream = await fetch(`${BACKEND}/api/plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(internalToken ? { "X-Internal-Token": internalToken } : {}),
      },
      body: JSON.stringify({
        destination: destination,
        start_date: start_date_format(startDate),
        end_date: start_date_format(endDate),
        budget_usd: budgetUsd,
        origin_city: originCity,
        travelers: travelers,
        style: style,
        confirmed_stay: confirmed_stay || null,
        selected_places: selected_places || []
      }),
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      throw new Error(`FastAPI Server returned error: ${upstream.status} - ${errorText}`);
    }

    // Pipe SSE stream straight to the browser
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error: any) {
    console.error("API Generate Proxy Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper to ensure dates are in YYYY-MM-DD format
function start_date_format(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return new Date().toISOString().split('T')[0];
    }
    return d.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}
