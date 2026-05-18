import { NextResponse } from 'next/server'
import { callAI, parseAIJson } from '@/lib/ai'

export async function POST(request: Request) {
  try {
    const { destination } = await request.json()

    const prompt = `You are a nightlife expert for ${destination}, India. List the top 6 REAL, EXISTING bars, pubs, clubs, and nightlife spots in ${destination}.

RULES:
1. Every place MUST be a real, famous, existing establishment.
2. Include accurate GPS coordinates (latitude, longitude).
3. Cover a variety: beach bars, rooftop lounges, dance clubs, chill pubs, live music venues.

Return ONLY valid JSON:
{
  "spots": [
    {
      "name": "REAL bar/club name",
      "category": "Bar/Club/Lounge/Pub/Beach Bar",
      "vibe": "One-line description of the vibe",
      "rating": 4.2,
      "priceRange": "₹₹ or ₹₹₹",
      "bestFor": "Couples/Groups/Solo travelers",
      "timings": "7 PM - 1 AM",
      "whyGo": "One line on why this spot is famous",
      "lat": 15.5485,
      "lng": 73.7554
    }
  ]
}`

    const { content, provider } = await callAI({
      prompt,
      systemPrompt: 'You are a nightlife expert. Respond ONLY with valid JSON. Never output markdown.',
      temperature: 0.7,
      maxTokens: 2048,
    })

    if (provider !== 'none' && content) {
      const parsed = parseAIJson(content)
      if (parsed) {
        return NextResponse.json(parsed)
      }
    }

    // Fallback mock
    return NextResponse.json({
      spots: [
        {
          name: `No nightlife data available`,
          category: "Info",
          vibe: "AI providers are currently unavailable",
          rating: 0,
          priceRange: "-",
          bestFor: "Try again later",
          timings: "N/A",
          whyGo: "All AI providers failed. Please try again in a few minutes.",
          lat: 15.5500,
          lng: 73.7550
        }
      ]
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
