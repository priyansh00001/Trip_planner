import { NextResponse } from 'next/server'

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
            { role: "system", content: "You are an expert packing assistant. You respond ONLY with valid JSON." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.5,
          max_tokens: 1500,
        })
      })
    }

    let groqRes = await fetchGroq("llama-3.3-70b-versatile")
    if (!groqRes.ok) {
      console.warn(`Groq 70B Failed (Status ${groqRes.status}). Falling back to Llama 3.1 8B...`)
      groqRes = await fetchGroq("llama-3.1-8b-instant")
    }

    const groqData = await groqRes.json()
    if (!groqRes.ok) throw new Error("Failed to fetch packing list from Groq")

    const rawContent = groqData.choices[0].message.content
    const parsedData = JSON.parse(rawContent)

    return NextResponse.json(parsedData)
  } catch (error: any) {
    console.error("Packing API Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
