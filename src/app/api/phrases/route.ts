import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { destination } = await request.json()

    if (!destination) {
      return NextResponse.json({ error: "Destination is required" }, { status: 400 })
    }

    const prompt = `You are a local language expert in India. A traveler is visiting ${destination}, India.
    
    1. Identify the primary local language spoken in this state/city (e.g., Kannada for Bangalore, Tamil for Chennai, Marathi for Mumbai, Hindi for Delhi).
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

    const groqKey = process.env.GROQ_API_KEY
    const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
    
    if (groqKey) {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "You return ONLY valid JSON." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        })
      })
      const data = await groqRes.json()
      if (groqRes.ok && data.choices?.[0]?.message?.content) {
        return NextResponse.json(JSON.parse(data.choices[0].message.content))
      }
    }

    if (geminiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        }
      )
      const data = await res.json()
      if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return NextResponse.json(JSON.parse(data.candidates[0].content.parts[0].text))
      }
    }

    throw new Error("Both APIs failed or are missing keys")
  } catch (error: any) {
    console.error("Language API Error:", error)
    // Return a successful 200 response with fallback data so the UI doesn't crash
    return NextResponse.json({ 
      language: "Hindi (Fallback)",
      phrases: [
        { english: "Hello", local: "नमस्ते", pronunciation: "Namaste" },
        { english: "How much is this?", local: "यह कितने का है?", pronunciation: "Yeh kitne ka hai?" },
        { english: "Thank you", local: "धन्यवाद", pronunciation: "Dhanyavad" },
        { english: "Help!", local: "मदद करो!", pronunciation: "Madad karo!" }
      ]
    })
  }
}
