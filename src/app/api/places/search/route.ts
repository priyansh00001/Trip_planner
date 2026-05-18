import { NextResponse } from 'next/server'
import { callAI, parseAIJson } from '@/lib/ai'

/**
 * /api/places/search
 * 
 * Returns places for a given city + category.
 * Uses AI to generate place names, then Unsplash for photos.
 * Will be swapped to Google Places API when available.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city') || ''
  const category = searchParams.get('category') || 'landmarks'
  const page = parseInt(searchParams.get('page') || '1')

  if (!city) {
    return NextResponse.json({ error: 'City is required' }, { status: 400 })
  }

  // Category → AI prompt mapping
  const categoryPrompts: Record<string, string> = {
    landmarks: `famous tourist attractions, monuments, and landmarks in ${city}`,
    cafes: `best rated cafes and restaurants in ${city}`,
    markets: `popular markets, shopping streets, and bazaars in ${city}`,
    parks: `beautiful parks, gardens, and nature spots in ${city}`,
    culture: `museums, art galleries, and cultural places in ${city}`,
    food: `famous street food spots, food streets, and iconic eateries in ${city}`,
  }

  const categoryQuery = categoryPrompts[category] || categoryPrompts.landmarks

  // Step 1: Get real place names from AI
  const prompt = `List exactly 15 real, famous, well-known ${categoryQuery}, India.

RULES:
- Every place MUST be real and currently existing
- Include accurate GPS coordinates
- Include a realistic Google-style rating
- Include a one-line description of why it's worth visiting
- For restaurants/cafes, include price range and signature dish
- DO NOT include any place that has permanently closed

Return ONLY valid JSON:
{
  "places": [
    {
      "name": "Exact Real Place Name",
      "description": "One line about why it's famous or worth visiting",
      "rating": 4.5,
      "category": "${category}",
      "lat": 28.6139,
      "lng": 77.2090,
      "priceLevel": 2,
      "timing": "9:00 AM - 5:00 PM",
      "signatureDish": "Only for food places, otherwise null",
      "address": "Short area/neighborhood name"
    }
  ]
}`

  const { content, provider } = await callAI({
    prompt,
    systemPrompt: 'You are an Indian travel expert. Return ONLY valid JSON. Every place must be real and currently existing.',
    temperature: 0.5,
    maxTokens: 3000,
  })

  let places: any[] = []

  if (provider !== 'none' && content) {
    const parsed = parseAIJson(content)
    if (parsed?.places) {
      places = parsed.places
    }
  }

  if (places.length === 0) {
    return NextResponse.json({ places: [], source: 'none' })
  }

  // Step 2: Fetch photos from Unsplash for each place
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY
  
  if (unsplashKey) {
    const placesWithPhotos = await Promise.all(
      places.map(async (place: any) => {
        try {
          const query = encodeURIComponent(`${place.name} ${city} India`)
          const res = await fetch(
            `https://api.unsplash.com/search/photos?query=${query}&per_page=3&orientation=squarish`,
            {
              headers: { Authorization: `Client-ID ${unsplashKey}` },
            }
          )

          if (res.ok) {
            const data = await res.json()
            const photos = data.results?.map((r: any) => ({
              url: r.urls?.regular || r.urls?.small,
              thumb: r.urls?.thumb,
              alt: r.alt_description || place.name,
              credit: r.user?.name || 'Unsplash',
            })) || []

            return { ...place, photos }
          }
        } catch (err) {
          console.warn(`Unsplash error for ${place.name}:`, err)
        }
        return { ...place, photos: [] }
      })
    )

    return NextResponse.json({
      places: placesWithPhotos,
      city,
      category,
      source: 'ai+unsplash',
    })
  }

  // No Unsplash key — return places without photos
  return NextResponse.json({
    places: places.map((p: any) => ({ ...p, photos: [] })),
    city,
    category,
    source: 'ai-only',
  })
}
