import { NextResponse } from 'next/server'
import { callAI, parseAIJson } from '@/lib/ai'
import { CITY_LANGUAGE_MAP, PHRASES_DB } from '@/config/phrases-data'

export async function POST(request: Request) {
  try {
    const { destination } = await request.json()

    if (!destination) {
      return NextResponse.json({ error: "Destination is required" }, { status: 400 })
    }

    const cityKey = destination.toLowerCase().split(',')[0].trim().replace(/\s+/g, '')

    // 1. Check static DB first (instant, free, verified)
    const languageKey = CITY_LANGUAGE_MAP[cityKey]
    if (languageKey && PHRASES_DB[languageKey]) {
      return NextResponse.json({
        ...PHRASES_DB[languageKey],
        source: 'curated',
        destination,
      })
    }

    // 2. AI fallback for unmapped cities
    const prompt = `You are a local language expert in India. A traveler is visiting ${destination}, India.
    
    1. Identify the primary local language spoken in this state/city.
    2. Provide 8-10 essential survival phrases translated into that local language.
    
    Return ONLY a valid JSON object with this structure:
    {
      "language": "Name of the local language",
      "phrases": [
        {
          "english": "Hello / Greetings",
          "local": "Local translation",
          "pronunciation": "Easy english pronunciation"
        }
      ]
    }`

    const { content, provider } = await callAI({
      prompt,
      systemPrompt: 'You return ONLY valid JSON.',
      temperature: 0.7,
      maxTokens: 1500,
    })

    if (provider !== 'none' && content) {
      const parsed = parseAIJson(content)
      if (parsed) {
        return NextResponse.json({
          ...parsed,
          source: 'ai',
          destination,
        })
      }
    }

    // 3. Ultimate fallback — Hindi (understood across most of India)
    return NextResponse.json({
      ...PHRASES_DB['hindi'],
      source: 'fallback',
      destination,
    })
  } catch (error: any) {
    console.error("Language API Error:", error)
    return NextResponse.json({
      ...PHRASES_DB['hindi'],
      source: 'fallback',
      destination,
    })
  }
}
