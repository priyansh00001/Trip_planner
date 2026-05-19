import { NextResponse } from 'next/server'
import { callAI, parseAIJson } from '@/lib/ai'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  // Rate limit: 8 stay-generation calls per IP per 2 minutes
  const { ok, retryAfter } = rateLimit(request, { limit: 8, windowMs: 2 * 60 * 1000 })
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  try {
    const tripData = await request.json()
    const { destination, budget_range, remaining_budget_inr, preference } = tripData
    const budgetInr = remaining_budget_inr || budget_range

    const prompt = `You are a travel accommodation expert for India.
A traveler is planning a trip to ${destination}, India.
Their available budget for accommodation and activities is approximately ₹${budgetInr} INR.

Return EXACTLY 9 real, well-known, highly-rated stays in ${destination}, consisting of exactly 3 'Hotel' options, exactly 3 'Hostel' options, and exactly 3 'Homestay' options.

CRITICAL RULES:
1. Every hotel/hostel/homestay MUST be a real, existing establishment in ${destination}.
2. Include accurate latitude and longitude coordinates for EVERY stay.
3. Include an estimated price per night in INR.
4. Categorize each stay's type field EXACTLY as one of these values: "Hotel", "Hostel", or "Homestay".

Return ONLY a valid JSON object with this exact structure:
{
  "stays": [
    {
      "id": "unique-string-id",
      "name": "REAL hotel/hostel/homestay name",
      "type": "Hotel, Hostel, or Homestay",
      "rating": 4.5,
      "price": "₹XXXX/night",
      "whyStay": "One compelling reason to stay here",
      "lat": 15.4909,
      "lng": 73.8278,
      "address": "Short area or neighborhood name"
    }
  ]
}`

    const { content, provider } = await callAI({
      prompt,
      systemPrompt: 'You are an expert Indian travel planner. You respond ONLY with valid JSON.',
      temperature: 0.7,
      maxTokens: 3000,
    })

    if (provider === 'none' || !content) {
      return NextResponse.json({
        error: "All AI providers are currently unavailable. Please try again in a few minutes.",
        stays: []
      }, { status: 503 })
    }

    const parsed = parseAIJson(content)
    if (!parsed) {
      return NextResponse.json({ error: "Failed to parse stays data" }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error("Generate Stays API Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
