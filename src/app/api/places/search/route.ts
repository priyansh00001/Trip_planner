import { NextResponse } from 'next/server'
import { callAI, parseAIJson } from '@/lib/ai'
import { rateLimit } from '@/lib/rate-limit'

/**
 * /api/places/search
 * 
 * Returns places for a given city + category.
 * Integrates directly with TripAdvisor/Hostelworld scraped databases on FastAPI!
 * Falls back to AI if the city is not yet scraped.
 */
export async function GET(request: Request) {
  // Rate limit: 20 place-search calls per IP per minute
  const { ok, retryAfter } = rateLimit(request, { limit: 20, windowMs: 60 * 1000 })
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city') || ''
  const category = searchParams.get('category') || 'landmarks'

  if (!city) {
    return NextResponse.json({ error: 'City is required' }, { status: 400 })
  }

  const authenticated = searchParams.get('authenticated') !== 'false'

  const BACKEND = process.env.PYTHON_BACKEND_URL ?? "http://localhost:8000";
  const citySlug = city.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  let places: any[] = []
  let source = 'ai'

  // Step 1: Try fetching authentic scraped data from our FastAPI backend
  try {
    const res = await fetch(`${BACKEND}/api/destinations/${citySlug}?authenticated=${authenticated}`);
    if (res.ok) {
      const data = await res.json();
      const rawPlaces = data.places || [];

      if (rawPlaces.length > 0) {
        // Filter places by category
        const filtered = filterPlacesByCategory(rawPlaces, category);
        
        // Map to exact frontend schema
        places = filtered.slice(0, 15).map((p: any) => ({
          name: p.name,
          description: p.description || `A beautiful spot in ${city}`,
          rating: p.rating || 4.5,
          category: category,
          lat: p.lat || p.latitude || 28.6139,
          lng: p.lng || p.longitude || p.lon || 77.2090,
          priceLevel: p.price_level || (p.entry_fee_inr && p.entry_fee_inr > 200 ? 3 : 1),
          timing: p.best_time || "9:00 AM - 6:00 PM",
          signatureDish: p.signature_dish || null,
          address: p.locality || p.address || city
        }));

        source = 'scraped-db';
      }
    } else if (res.status === 202) {
      // Triggered background discovery, log it
      console.log(`[Discovery] Destination ${city} is currently being discovered/scraped by backend.`);
    }
  } catch (err) {
    console.warn("FastAPI Destinations fetch failed, falling back to AI:", err);
  }

  // Step 2: Fallback to AI if no scraped places are found
  if (places.length === 0) {
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

    try {
      const { content, provider } = await callAI({
        prompt,
        systemPrompt: 'You are an Indian travel expert. Return ONLY valid JSON. Every place must be real and currently existing.',
        temperature: 0.5,
        maxTokens: 3000,
      })

      if (provider !== 'none' && content) {
        const parsed = parseAIJson(content)
        if (parsed?.places) {
          places = parsed.places
          source = 'ai';
        }
      }
    } catch (aiErr) {
      console.error("AI Fallback failed:", aiErr);
    }
  }

  if (places.length === 0) {
    return NextResponse.json({ places: [], source: 'none' })
  }

  // Step 3: Fetch photos from Unsplash for each place
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY
  
  if (unsplashKey) {
    try {
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
        source: `${source}+unsplash`,
      })
    } catch (unsplashErr) {
      console.warn("Bulk Unsplash error:", unsplashErr);
    }
  }

  // No Unsplash key or Unsplash request failed — return places without photos
  return NextResponse.json({
    places: places.map((p: any) => ({ ...p, photos: p.photos || [] })),
    city,
    category,
    source,
  })
}

// Category matching helper
function filterPlacesByCategory(places: any[], category: string): any[] {
  const cat = category.toLowerCase();
  
  return places.filter((p: any) => {
    const pCat = (p.category || "").toLowerCase();
    
    if (cat === "landmarks") {
      return pCat.includes("landmark") || pCat.includes("sight") || pCat.includes("temple") || 
             pCat.includes("heritage") || pCat.includes("monument") || pCat.includes("fort") || 
             pCat.includes("palace") || pCat.includes("viewpoint") || pCat.includes("church") ||
             pCat.includes("mosque") || pCat.includes("tomb");
    }
    if (cat === "cafes") {
      return pCat.includes("cafe") || pCat.includes("restaurant") || pCat.includes("bakery") || 
             pCat.includes("coffee") || pCat.includes("club") || pCat.includes("bar") || 
             pCat.includes("pub") || pCat.includes("lounge");
    }
    if (cat === "markets") {
      return pCat.includes("market") || pCat.includes("shopping") || pCat.includes("bazaar") || 
             pCat.includes("mall") || pCat.includes("street shop");
    }
    if (cat === "parks") {
      return pCat.includes("park") || pCat.includes("garden") || pCat.includes("lake") || 
             pCat.includes("nature") || pCat.includes("zoo") || pCat.includes("beach") || 
             pCat.includes("waterfall") || pCat.includes("forest") || pCat.includes("trek") ||
             pCat.includes("wildlife");
    }
    if (cat === "culture") {
      return pCat.includes("museum") || pCat.includes("art") || pCat.includes("gallery") || 
             pCat.includes("theater") || pCat.includes("library") || pCat.includes("cultural");
    }
    if (cat === "food") {
      return pCat.includes("street food") || pCat.includes("eatery") || pCat.includes("restaurant") || 
             pCat.includes("dhaba") || pCat.includes("food court");
    }
    
    return true; // fallback to include all if unknown
  });
}
