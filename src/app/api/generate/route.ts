import { NextResponse } from 'next/server'
import { callAI, parseAIJson } from '@/lib/ai'

export async function POST(request: Request) {
  try {
    const tripData = await request.json()
    const { destination, duration_days, budget_range, preference, confirmed_stay, selected_places } = tripData

    // Build context about where the user is staying
    const stayContext = confirmed_stay
      ? `The traveler has already booked their stay at: "${confirmed_stay.name}" (${confirmed_stay.type}) located at ${confirmed_stay.address || destination}. Plan all activities to logically start and end near this basecamp each day.`
      : `They prefer staying in: ${preference}.`

    // Build selected places context if user picked places
    const hasSelectedPlaces = selected_places && selected_places.length > 0
    const selectedPlacesContext = hasSelectedPlaces
      ? `
MUST-INCLUDE PLACES (user personally selected these — they MUST appear in the itinerary):
${selected_places.map((p: any, i: number) => `${i + 1}. ${p.name}${p.address ? ` (${p.address})` : ''}${p.timing ? ` — open: ${p.timing}` : ''}${p.category ? ` [${p.category}]` : ''}${p.signatureDish ? ` — signature: ${p.signatureDish}` : ''}`).join('\n')}

You may add 2-3 extra places to fill logical gaps in the schedule, but the above places are non-negotiable.`
      : `Choose the best places to visit in ${destination} for a memorable trip.`

    const prompt = `You are India's #1 travel expert and local guide. You have encyclopedic knowledge of every famous cafe, restaurant, beach, temple, museum, market, trek, and hidden gem across India.

A traveler is planning a ${duration_days}-day trip to ${destination}, India.
Their total budget is approximately ₹${budget_range} INR (excluding flights/initial transport).
${stayContext}

${selectedPlacesContext}

Create a hyper-detailed, day-by-day itinerary using ONLY REAL, WELL-KNOWN, POPULAR places that actually exist.

CRITICAL RULES:
1. Every single place name MUST be a real, existing, well-known establishment or location in ${destination}.
2. Include a realistic Google-style rating (out of 5) for each place.
3. Categorize each activity (Cafe, Restaurant, Beach, Temple, Museum, Market, Trek, Viewpoint, Club, Heritage, Park, etc.)
4. Explain WHY this place is famous or worth visiting in 1 short line.
5. Plan the day logically: Morning → Afternoon → Evening — starting from the basecamp.
6. Arrange places geographically — minimize travel time between consecutive activities.
7. DO NOT include a recommendedStays section. The hotel is already confirmed.
8. COORDINATES (CRITICAL): Every activity MUST have real, accurate, UNIQUE GPS coordinates (lat/lng) for its actual real-world location in ${destination}. Each activity will be at a DIFFERENT location so coordinates must differ. Do NOT copy or reuse coordinates across activities. Do NOT use placeholder values.
9. THE HUMAN GUIDE EDGE: For restaurants/cafes, provide a specific "signatureDish" to order. For monuments/activities, provide a "proTip" (e.g., "Enter via Gate 2 to avoid crowds"). 
10. DYNAMIC ALTERNATIVES: For every outdoor activity, provide an "indoorAlternative" in case it rains.
11. LOCAL SECRETS: Provide a top-level "localTips" object with 3 Do's/Don'ts and 2 Scams to watch out for.
12. CULTURAL SENSITIVITY: STRICTLY DO NOT recommend any dishes containing Beef or Buffalo meat. Focus on local vegetarian, chicken, mutton, or seafood delicacies.

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
          "lat": REAL_LATITUDE_OF_THIS_PLACE,
          "lng": REAL_LONGITUDE_OF_THIS_PLACE
        }
      ]
    }
  ]
}`


    const { content, provider } = await callAI({
      prompt,
      systemPrompt: 'You are an expert Indian travel planner. You respond ONLY with valid JSON.',
      temperature: 0.7,
      maxTokens: 8000,
    })

    let planJson: any = null

    if (provider !== 'none' && content) {
      planJson = parseAIJson(content)
    }

    if (!planJson) {
      planJson = {
        "tripTitle": `AI Unavailable — Please Try Again`,
        "destination": destination,
        "estimatedCost": `N/A`,
        "highlights": [
          "All AI providers (Groq + Gemini) are temporarily unavailable.",
          "This usually resolves within 1–2 minutes.",
          "Please try generating your trip again shortly."
        ],
        "bestTimeToVisit": "N/A",
        "localTips": {
          "etiquette": ["Always carry backup cash.", "Respect local customs."],
          "scamsToAvoid": ["Be cautious of unofficial guides.", "Confirm taxi fares before getting in."]
        },
        "recommendedStays": [
          {
            "name": `Fallback Stay`,
            "type": preference,
            "rating": 0,
            "price": "-",
            "whyStay": "This is placeholder data because the AI providers are temporarily unavailable.",
            "lat": 15.4909,
            "lng": 73.8278
          }
        ],
        "days": Array.from({ length: Math.min(duration_days, 3) }, (_, i) => ({
          "dayNumber": i + 1,
          "theme": `AI Unavailable`,
          "activities": [
            {
              "time": "Morning",
              "name": `AI providers rate-limited`,
              "category": "Info",
              "rating": 0,
              "description": "All AI providers are temporarily unavailable. Try again in a few minutes.",
              "whyVisit": "Rate limits typically reset within 1-2 minutes",
              "proTip": "Try generating your trip again shortly.",
              "indoorAlternative": {
                "name": "Wait & Retry",
                "description": "Rate limits reset quickly."
              },
              "costEstimate": "₹0",
              "icon": "Coffee",
              "lat": 15.4989 + (i * 0.02),
              "lng": 73.8278 + (i * 0.01)
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
