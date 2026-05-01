import { NextResponse } from 'next/server'

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

    const groqKey = process.env.GROQ_API_KEY
    let result: any = null

    if (groqKey) {
      const fetchGroqNightlife = async (modelName: string) => {
        const payload: any = {
          model: modelName,
          messages: [
            { role: "system", content: "You are a nightlife expert. Respond ONLY with valid JSON. Never output markdown." },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2048,
        }
        if (modelName.includes("llama")) {
          payload.response_format = { type: "json_object" }
        }

        return await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload)
        })
      }

      try {
        let res = await fetchGroqNightlife("llama-3.3-70b-versatile")
        
        // Model Cascade Fallback: If 70B is rate limited (429), try Mixtral instantly
        if (!res.ok && res.status === 429) {
          console.warn("Nightlife Groq 70B Rate Limited. Falling back to Mixtral 8x7b...")
          res = await fetchGroqNightlife("mixtral-8x7b-32768")
        }

        const data = await res.json()
        if (res.ok && data.choices?.[0]?.message?.content) {
          let rawContent = data.choices[0].message.content
          rawContent = rawContent.replace(/^```json\s*/, "")
          rawContent = rawContent.replace(/```\s*$/, "")
          result = JSON.parse(rawContent)
        }
      } catch (err: any) {
        console.warn("Groq nightlife error:", err.message)
      }
    }

    // Fallback mock
    if (!result) {
      result = {
        spots: [
          {
            name: `API ERROR: AI Failed`,
            category: "Error",
            vibe: "Rate Limit Exceeded on Groq",
            rating: 0,
            priceRange: "-",
            bestFor: "Check Terminal",
            timings: "N/A",
            whyGo: "The AI failed to generate real data due to token limits.",
            lat: 15.5500,
            lng: 73.7550
          }
        ]
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
