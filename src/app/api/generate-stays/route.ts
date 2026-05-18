import { NextResponse } from 'next/server'
import { callAI, parseAIJson } from '@/lib/ai'

export async function POST(request: Request) {
  try {
    const tripData = await request.json()
    const { destination, budget_range, preference } = tripData

    const prompt = `You are a travel accommodation expert for India.
A traveler is planning a trip to ${destination}, India.
Their total budget is approximately ₹${budget_range} INR.
They prefer staying in: ${preference}.

Return EXACTLY 6-8 real, well-known, highly-rated stays in ${destination}. 
Include a mix of budget and premium options if possible, but mostly stick to their preference of ${preference}.

CRITICAL RULES:
1. Every hotel/hostel MUST be a real, existing establishment in ${destination}.
2. Include accurate latitude and longitude coordinates for EVERY stay.
3. Include an estimated price per night in INR.
4. Categorize each stay (e.g., Hostel, Budget Hotel, Luxury Resort, Homestay).

Return ONLY a valid JSON object with this exact structure:
{
  "stays": [
    {
      "id": "unique-string-id",
      "name": "REAL hotel/hostel name",
      "type": "Category (e.g., Luxury Resort, Backpacker Hostel)",
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
