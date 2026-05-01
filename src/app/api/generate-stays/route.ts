import { NextResponse } from 'next/server'

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
            { role: "system", content: "You are an expert Indian travel planner. You respond ONLY with valid JSON." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 3000,
        })
      })
    }

    let groqRes = await fetchGroq("llama-3.3-70b-versatile")
    if (!groqRes.ok) {
      console.warn(`Groq 70B Failed (Status ${groqRes.status}). Automatically falling back to Llama 3.1 8B...`)
      groqRes = await fetchGroq("llama-3.1-8b-instant")
    }

    const groqData = await groqRes.json()
    if (!groqRes.ok) {
      throw new Error(groqData.error?.message || "Failed to fetch stays from Groq")
    }

    const rawContent = groqData.choices[0].message.content
    const parsedData = JSON.parse(rawContent)

    return NextResponse.json(parsedData)
  } catch (error: any) {
    console.error("Generate Stays API Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
