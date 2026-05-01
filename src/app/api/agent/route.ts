import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { plan, message } = await request.json()

    if (!message || !plan) {
      return NextResponse.json({ error: "Missing message or current plan data" }, { status: 400 })
    }

    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) {
      return NextResponse.json({ error: "Groq API Key not found" }, { status: 500 })
    }

    const prompt = `You are a precise travel itinerary editor. Your job is to make ONLY the exact changes the user requests — nothing more, nothing less.

CURRENT TRIP PLAN:
${JSON.stringify(plan)}

USER REQUEST: "${message}"

STRICT RULES:
1. COUNT what the user asked for. If they say "add a restaurant" → add EXACTLY 1 restaurant. If they say "add 2 cafes" → add exactly 2 cafes. NEVER add more items than requested.
2. DO NOT add any extra activities, cafes, restaurants, or anything else that was not explicitly requested. If the user asked for 1 thing, you add 1 thing.
3. DO NOT "pad" the itinerary or make the day feel "complete". Only touch what was asked.
4. ADDING: append the new activity object to the correct day's "activities" array with all required fields: time, name, category, rating, description, whyVisit, costEstimate, icon, lat, lng. Use real GPS coordinates.
5. REMOVING: delete only that exact activity from the array.
6. REPLACING: remove the old one, insert the new one at the same position.
7. ALL other days, activities, hotels, and data must remain completely unchanged.
8. Return the COMPLETE JSON with ALL days. NEVER return markdown or text outside the JSON.

Return ONLY the raw complete JSON object.`

    const fetchGroqAgent = async (modelName: string) => {
      const payload: any = {
        model: modelName,
        messages: [
          { role: "system", content: "You are an Indian public transport and travel expert backend service. Respond ONLY with valid JSON. Never output markdown or text outside the JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 5000, 
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

    let groqRes = await fetchGroqAgent("llama-3.3-70b-versatile")
    
    // Model Cascade: catch ALL failures, not just 429
    if (!groqRes.ok) {
      console.warn(`Agent Groq 70B Failed (${groqRes.status}). Falling back to Mixtral 8x7b...`)
      groqRes = await fetchGroqAgent("mixtral-8x7b-32768")
    }

    const groqData = await groqRes.json()

    if (!groqRes.ok) {
      return NextResponse.json({ error: "Failed to generate AI response", details: groqData }, { status: groqRes.status })
    }

    try {
      let rawContent = groqData.choices[0].message.content
      // Intelligently strip markdown if Mixtral adds it (e.g. ```json ... ```)
      rawContent = rawContent.replace(/^```json\s*/, "")
      rawContent = rawContent.replace(/```\s*$/, "")
      
      const updatedPlan = JSON.parse(rawContent)
      return NextResponse.json({ plan: updatedPlan })
    } catch (parseErr: any) {
      console.error("Agent JSON Parse Failed:", parseErr.message)
      return NextResponse.json({ error: "AI returned invalid JSON format" }, { status: 500 })
    }

  } catch (error: any) {
    console.error("Agent API Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
