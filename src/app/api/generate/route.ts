import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const tripData = await request.json()
    const { destination, duration_days, budget_range, preference, confirmed_stay } = tripData

    // Build context about where the user is staying
    const stayContext = confirmed_stay
      ? `The traveler has already booked their stay at: "${confirmed_stay.name}" (${confirmed_stay.type}) located at ${confirmed_stay.address || destination}. Plan all activities to logically start and end near this basecamp each day.`
      : `They prefer staying in: ${preference}.`

    const prompt = `You are India's #1 travel expert and local guide. You have encyclopedic knowledge of every famous cafe, restaurant, beach, temple, museum, market, trek, and hidden gem across India.

A traveler is planning a ${duration_days}-day trip to ${destination}, India.
Their total budget is approximately ₹${budget_range} INR (excluding flights/initial transport).
${stayContext}

Create a hyper-detailed, day-by-day itinerary using ONLY REAL, WELL-KNOWN, POPULAR places that actually exist.

CRITICAL RULES:
1. Every single place name MUST be a real, existing, well-known establishment or location in ${destination}.
2. Include a realistic Google-style rating (out of 5) for each place.
3. Categorize each activity (Cafe, Restaurant, Beach, Temple, Museum, Market, Trek, Viewpoint, Club, Heritage, Park, etc.)
4. Explain WHY this place is famous or worth visiting in 1 short line.
5. Plan the day logically: Morning → Afternoon → Evening — starting from the basecamp.
6. DO NOT include a recommendedStays section. The hotel is already confirmed.
7. IMPORTANT: Include accurate latitude and longitude coordinates for EVERY activity. These must be real GPS coordinates.
8. THE HUMAN GUIDE EDGE: For restaurants/cafes, provide a specific "signatureDish" to order. For monuments/activities, provide a "proTip" (e.g., "Enter via Gate 2 to avoid crowds"). 
9. DYNAMIC ALTERNATIVES: For every outdoor activity, provide an "indoorAlternative" in case it rains.
10. LOCAL SECRETS: Provide a top-level "localTips" object with 3 Do's/Don'ts and 2 Scams to watch out for.
11. CULTURAL SENSITIVITY: STRICTLY DO NOT recommend any dishes containing Beef or Buffalo meat. Focus on local vegetarian, chicken, mutton, or seafood delicacies.

Return ONLY a valid JSON object with this exact structure:
{
  "tripTitle": "A catchy, exciting title for this trip",
  "destination": "${destination}",
  "estimatedCost": "₹XXXXX (total estimated cost)",
  "highlights": ["Highlight 1", "Highlight 2"],
  "bestTimeToVisit": "Month range",
  "streetFood": [
    {
      "name": "Iconic Street Food Name",
      "location_hint": "Where to find the best one (e.g., Old City, Beach Road)",
      "description": "Why it's a must-try"
    }
  ],
  "localTips": {
    "etiquette": ["Cover shoulders in temples", "Eat with your right hand"],
    "scamsToAvoid": ["Fake guides at monuments", "Overpriced autos"]
  },
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
          "signatureDish": "If it's a food place, what's the must-try dish? (Optional)",
          "proTip": "Logistical tip like 'Book online' or 'Best photo spot' (Optional)",
          "indoorAlternative": {
            "name": "Real Indoor Place",
            "description": "Why go here if it rains?"
          },
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
      // Create a reusable helper to fetch from Groq
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
            max_tokens: 4096,
          })
        })
      }

      try {
        let groqRes = await fetchGroq("llama-3.3-70b-versatile")
        
        // Model Cascade Fallback: If 70B fails for ANY reason (429, 500, 503, HTML error), try the 8B model
        if (!groqRes.ok) {
          console.warn(`Groq 70B Failed (Status ${groqRes.status}). Automatically falling back to Llama 3.1 8B...`)
          groqRes = await fetchGroq("llama-3.1-8b-instant")
        }

        const groqData = await groqRes.json()
        if (groqRes.ok && groqData.choices?.[0]?.message?.content) {
          try {
            planJson = JSON.parse(groqData.choices[0].message.content)
          } catch (parseErr: any) {
            console.error("Groq JSON Parse Failed:", parseErr.message)
          }
        } else {
          if (!groqRes.ok) {
            console.error("Groq API Failed (Status " + groqRes.status + "):", JSON.stringify(groqData).substring(0, 300))
          }
        }
      } catch (err: any) {
        console.warn("Groq network/timeout error:", err.message)
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
        "tripTitle": `API ERROR: AI Failed to Generate Trip`,
        "destination": destination,
        "estimatedCost": `Error`,
        "highlights": [
          "Groq AI API failed to respond.",
          "You may have exhausted your free daily rate limit on Groq.",
          "Please check your terminal logs for the exact error (e.g., Status 429)."
        ],
        "bestTimeToVisit": "N/A",
        "localTips": {
          "etiquette": ["Always carry backup cash.", "Respect local customs."],
          "scamsToAvoid": ["Be cautious of unofficial guides.", "Confirm taxi fares before getting in."]
        },
        "recommendedStays": [
          {
            "name": `API Fallback Reached`,
            "type": preference,
            "rating": 0,
            "price": "-",
            "whyStay": "This is dummy data because the AI API failed.",
            "lat": 15.4909,
            "lng": 73.8278
          }
        ],
        "days": Array.from({ length: Math.min(duration_days, 3) }, (_, i) => ({
          "dayNumber": i + 1,
          "theme": `AI API Failed`,
          "activities": [
            {
              "time": "Morning",
              "name": `Groq API Error/Rate Limit`,
              "category": "Error",
              "rating": 4.4,
              "description": "Start your day with an amazing local breakfast.",
              "whyVisit": "Top-rated spot known for local flavors",
              "signatureDish": "Error Special",
              "proTip": "Try again later when rate limits reset.",
              "indoorAlternative": {
                "name": "Hotel Lobby",
                "description": "Stay dry and try planning again."
              },
              "costEstimate": "₹400",
              "icon": "Coffee",
              "lat": 15.4989 + (i * 0.02),
              "lng": 73.8278 + (i * 0.01)
            },
            {
              "time": "Afternoon",
              "name": `Iconic Heritage Site`,
              "category": "Heritage",
              "rating": 4.7,
              "description": "Explore the rich cultural history of the area.",
              "whyVisit": "A must-visit cultural landmark",
              "proTip": "Wear comfortable walking shoes.",
              "costEstimate": "₹200",
              "icon": "Building2",
              "lat": 15.5100 + (i * 0.02),
              "lng": 73.8300 + (i * 0.02)
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
