import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { destination } = await request.json()

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

    const groqKey = process.env.GROQ_API_KEY
    const fetchGroq = async (modelName: string) => {
      return await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: "You are a factual medical facility locator for India. You respond ONLY with valid JSON. Only include hospitals you are certain exist. Never invent names." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1, // Very low temperature for factual accuracy
          max_tokens: 800,
        })
      })
    }

    let groqRes = await fetchGroq("llama-3.3-70b-versatile")
    if (!groqRes.ok) {
      console.warn(`Groq 70B Failed (Status ${groqRes.status}). Falling back to Llama 3.1 8B...`)
      groqRes = await fetchGroq("llama-3.1-8b-instant")
    }

    const groqData = await groqRes.json()
    if (!groqRes.ok) throw new Error("Failed to fetch hospital data from Groq")

    const rawContent = groqData.choices[0].message.content
    const parsedData = JSON.parse(rawContent)

    return NextResponse.json(parsedData)
  } catch (error: any) {
    console.error("Emergency API Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
