import { NextResponse } from 'next/server'
import { callAI, parseAIJson } from '@/lib/ai'
import { EMERGENCY_DB, EMERGENCY_NUMBERS } from '@/config/emergency-data'

export async function POST(request: Request) {
  try {
    const { destination } = await request.json()
    const cityKey = destination?.toLowerCase().split(',')[0].trim().replace(/\s+/g, '') || ''

    // 1. Check static DB first (verified, instant, free)
    // Try exact match, then try common aliases
    const staticData = EMERGENCY_DB[cityKey] 
      || EMERGENCY_DB[cityKey.replace(/\s/g, '')] 
      || null

    if (staticData) {
      return NextResponse.json({
        hospitals: staticData,
        emergencyNumbers: EMERGENCY_NUMBERS,
        source: 'curated',
        destination,
      })
    }

    // 2. AI fallback for cities not in static DB
    const prompt = `You are a local travel safety expert for India.
A traveler is visiting ${destination}, India.

Find and return the 3-4 most well-known, major hospitals or medical centers nearest to the main tourist/city center area of ${destination}.
These must be REAL, EXISTING hospitals. Do NOT invent or hallucinate hospital names.
Only include hospitals you are highly confident actually exist.

Return ONLY a valid JSON object with this exact structure:
{
  "hospitals": [
    {
      "name": "Full official hospital name",
      "address": "Brief address or area (e.g., Near Dal Gate, Srinagar)",
      "phone": "Phone number if known, otherwise empty string"
    }
  ]
}`

    const { content, provider } = await callAI({
      prompt,
      systemPrompt: 'You are a factual medical facility locator for India. You respond ONLY with valid JSON. Only include hospitals you are certain exist. Never invent names.',
      temperature: 0.1,
      maxTokens: 800,
    })

    if (provider !== 'none' && content) {
      const parsed = parseAIJson(content)
      if (parsed) {
        return NextResponse.json({
          ...parsed,
          emergencyNumbers: EMERGENCY_NUMBERS,
          source: 'ai',
          destination,
        })
      }
    }

    // 3. Ultimate fallback — always return universal emergency numbers
    return NextResponse.json({
      hospitals: [
        { name: "Nearest District Hospital", address: `City center, ${destination}`, phone: "108 (Ambulance)" }
      ],
      emergencyNumbers: EMERGENCY_NUMBERS,
      source: 'fallback',
      destination,
    })
  } catch (error: any) {
    console.error("Emergency API Error:", error)
    return NextResponse.json({
      hospitals: [
        { name: "Emergency Services", address: "Dial 112 for help", phone: "112" }
      ],
      emergencyNumbers: EMERGENCY_NUMBERS,
      source: 'fallback',
    })
  }
}
