import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const tripData = await request.json()
    const { destination, duration_days, budget_range, preference } = tripData

    const prompt = `You are India's #1 travel expert and local guide. You have encyclopedic knowledge of every famous cafe, restaurant, beach, temple, museum, market, trek, and hidden gem across India.

A traveler is planning a ${duration_days}-day trip to ${destination}, India.
Their total budget is approximately ₹${budget_range} INR (excluding flights/initial transport).
They prefer staying in: ${preference}.

Create a hyper-detailed, day-by-day itinerary using ONLY REAL, WELL-KNOWN, POPULAR places that actually exist.

CRITICAL RULES:
1. Every single place name MUST be a real, existing, well-known establishment or location in ${destination}.
2. Include a realistic Google-style rating (out of 5) for each place.
3. Categorize each activity (Cafe, Restaurant, Beach, Temple, Museum, Market, Trek, Viewpoint, Club, Heritage, Park, etc.)
4. Explain WHY this place is famous or worth visiting in 1 short line.
5. Plan the day logically: Morning → Afternoon → Evening.
6. Suggest 1 or 2 REAL, highly-rated ${preference}s for the ENTIRE trip. Do NOT suggest a different hotel for every day!
7. IMPORTANT: Include accurate latitude and longitude coordinates for EVERY activity and stay. These must be real GPS coordinates for the actual location.

Return ONLY a valid JSON object with this exact structure:
{
  "tripTitle": "A catchy, exciting title for this trip",
  "destination": "${destination}",
  "estimatedCost": "₹XXXXX (total estimated cost)",
  "highlights": ["Highlight 1", "Highlight 2"],
  "bestTimeToVisit": "Month range",
  "recommendedStays": [
    {
      "name": "REAL hotel/hostel/homestay name",
      "type": "${preference}",
      "rating": 4.2,
      "price": "₹XXXX/night",
      "whyStay": "Brief reason",
      "lat": 15.4909,
      "lng": 73.8278
    }
  ],
  "days": [
    {
      "dayNumber": 1,
      "theme": "A catchy theme for the day",
      "activities": [
        {
          "time": "Morning/Afternoon/Evening",
          "name": "REAL place name",
          "category": "Cafe/Beach/Temple/etc",
          "rating": 4.5,
          "description": "What you'll do here",
          "whyVisit": "One line on why this place is famous",
          "costEstimate": "₹XXX",
          "icon": "Coffee/MapPin/Building2/Compass/Utensils/Mountain",
          "lat": 15.4989,
          "lng": 73.8278
        }
      ]
    }
  ]
}`

    const groqKey = process.env.GROQ_API_KEY
    const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
    let planJson: any = null

    if (groqKey) {
      try {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: "You are an expert Indian travel planner. You respond ONLY with valid JSON." },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_tokens: 4096,
          })
        })
        const groqData = await groqRes.json()
        if (groqRes.ok && groqData.choices?.[0]?.message?.content) {
          planJson = JSON.parse(groqData.choices[0].message.content)
        }
      } catch (err: any) {
        console.warn("Groq error:", err.message)
      }
    }

    if (!planJson && geminiKey) {
      try {
        const geminiRes = await fetch(
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
        const geminiData = await geminiRes.json()
        if (geminiRes.ok && geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
          planJson = JSON.parse(geminiData.candidates[0].content.parts[0].text)
        }
      } catch (err: any) {
        console.warn("Gemini error:", err.message)
      }
    }

    if (!planJson) {
      planJson = {
        "tripTitle": `${duration_days} Days in ${destination}: The Complete Experience`,
        "destination": destination,
        "estimatedCost": `₹${budget_range}`,
        "highlights": [
          "Explore the best local cafes",
          "Visit iconic heritage sites",
          "Shop at vibrant local markets"
        ],
        "bestTimeToVisit": "October - March",
        "recommendedStays": [
          {
            "name": `Premium ${preference} in ${destination}`,
            "type": preference,
            "rating": 4.6,
            "price": "₹1200/night",
            "whyStay": "Centrally located, highly rated by travelers, and easily accessible."
          }
        ],
        "days": Array.from({ length: Math.min(duration_days, 3) }, (_, i) => ({
          "dayNumber": i + 1,
          "theme": `Day ${i + 1} Exploration`,
          "activities": [
            {
              "time": "Morning",
              "name": `Famous Cafe in ${destination}`,
              "category": "Cafe",
              "rating": 4.4,
              "description": "Start your day with an amazing local breakfast.",
              "whyVisit": "Top-rated spot known for local flavors",
              "costEstimate": "₹400",
              "icon": "Coffee"
            },
            {
              "time": "Afternoon",
              "name": `Iconic Heritage Site`,
              "category": "Heritage",
              "rating": 4.7,
              "description": "Explore the rich cultural history of the area.",
              "whyVisit": "A must-visit cultural landmark",
              "costEstimate": "₹200",
              "icon": "Building2"
            }
          ]
        }))
      }
    }

    return NextResponse.json({ plan: planJson })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
