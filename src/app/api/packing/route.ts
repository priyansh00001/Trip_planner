import { NextResponse } from 'next/server'
import { callAI, parseAIJson } from '@/lib/ai'

export async function POST(request: Request) {
  try {
    const { destination, duration_days, activities } = await request.json()

    const prompt = `You are an expert travel packer.
A traveler is going to ${destination}, India for ${duration_days} days.
Their planned activities include: ${activities.join(", ")}.

Generate a practical, smart packing list based specifically on the climate of ${destination} and these exact activities.
Group the items into logical categories.
Do not include obvious things like "underwear" unless there's a specific reason, focus on highly relevant items (e.g. trekking poles for mountains, sunscreen for beaches, conservative clothes for temples).

Return ONLY a valid JSON object with this exact structure:
{
  "categories": [
    {
      "name": "Category Name (e.g., Clothing, Gear, Toiletries)",
      "icon": "Shirt, Camera, Briefcase, etc (use a relevant Lucide icon name)",
      "items": [
        {
          "name": "Item name",
          "reason": "Short 3-5 word reason why it's needed based on activities"
        }
      ]
    }
  ]
}`

    const { content, provider } = await callAI({
      prompt,
      systemPrompt: 'You are an expert packing assistant. You respond ONLY with valid JSON.',
      temperature: 0.5,
      maxTokens: 1500,
    })

    if (provider === 'none' || !content) {
      return NextResponse.json({ error: "All AI providers failed. Please try again in a few minutes." }, { status: 503 })
    }

    const parsed = parseAIJson(content)
    if (!parsed) {
      return NextResponse.json({ error: "Failed to parse packing list" }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error("Packing API Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
