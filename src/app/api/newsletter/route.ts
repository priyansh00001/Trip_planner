import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_KEY!

// Monthly trip recommendations
function getMonthlyRecommendations(): { month: string; destinations: { name: string; why: string }[] } {
  const now = new Date()
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
  const month = monthNames[now.getMonth()]

  const recommendations: Record<string, { name: string; why: string }[]> = {
    January: [
      { name: "Goa", why: "Perfect beach weather, vibrant nightlife, and seafood festivals" },
      { name: "Jaipur", why: "Cool mornings, clear skies — ideal for fort exploration" },
      { name: "Andaman Islands", why: "Crystal clear waters and world-class snorkeling" },
    ],
    February: [
      { name: "Udaipur", why: "Romantic lakeside vibes with pleasant 20°C days" },
      { name: "Khajuraho", why: "Dance festival season with illuminated temples" },
      { name: "Rann of Kutch", why: "Last chance to see the white desert under full moonlight" },
    ],
    March: [
      { name: "Varanasi", why: "Holi celebrations along the Ganges — unforgettable" },
      { name: "Hampi", why: "Comfortable weather before the summer heat hits" },
      { name: "Pondicherry", why: "French Quarter charm with perfect beach days" },
    ],
    April: [
      { name: "Munnar", why: "Tea gardens in bloom, misty mornings, cool hillside air" },
      { name: "Darjeeling", why: "Clear Kanchenjunga views and spring tea harvest" },
      { name: "Coorg", why: "Coffee plantation walks with monsoon approaching" },
    ],
    May: [
      { name: "Ladakh", why: "Roads open up, stark landscapes, monastery visits" },
      { name: "Manali", why: "Snow melting, adventure sports season begins" },
      { name: "Shimla", why: "Escape the plains heat with colonial hill station charm" },
    ],
    June: [
      { name: "Meghalaya", why: "Living root bridges in the monsoon are magical" },
      { name: "Valley of Flowers", why: "Trek season opens — alpine meadows in full bloom" },
      { name: "Spiti Valley", why: "Stark high-altitude desert beauty" },
    ],
    July: [
      { name: "Kerala Backwaters", why: "Monsoon transforms the backwaters into emerald paradise" },
      { name: "Coorg", why: "Lush green coffee estates, waterfalls at peak flow" },
      { name: "Gokarna", why: "Quiet monsoon beaches, dramatic cliffside views" },
    ],
    August: [
      { name: "Tirthan Valley", why: "Hidden Himalayan gem with trout fishing" },
      { name: "Wayanad", why: "Misty hills, wildlife safaris, and spice plantations" },
      { name: "Lonavala", why: "Waterfalls and lush Western Ghats scenery" },
    ],
    September: [
      { name: "Rishikesh", why: "River rafting season starts, Ganges at its best" },
      { name: "Udaipur", why: "Post-monsoon lake city glows with renewed beauty" },
      { name: "Ooty", why: "Flower show season with pleasant climate" },
    ],
    October: [
      { name: "Rajasthan", why: "Festival season — Pushkar Camel Fair, Diwali in Jaipur" },
      { name: "Kashmir", why: "Autumn colors — saffron, gold chinar trees by Dal Lake" },
      { name: "Hampi", why: "Perfect weather for exploring ruins at sunrise" },
    ],
    November: [
      { name: "Kerala", why: "Post-monsoon perfection — houseboats, Ayurveda, beaches" },
      { name: "Goa", why: "Season opening — beach shacks return, music festivals begin" },
      { name: "Varanasi", why: "Dev Deepawali — millions of diyas light up the ghats" },
    ],
    December: [
      { name: "Jaisalmer", why: "Desert camping under stars, cool nights, camel safaris" },
      { name: "Auli", why: "First snowfall — skiing season begins in the Himalayas" },
      { name: "Alleppey", why: "New Year on a houseboat — warm, magical, unforgettable" },
    ],
  }

  return { month, destinations: recommendations[month] || recommendations.January }
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Please provide a valid email" }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Store subscriber (upsert to avoid duplicates)
    const { error: dbError } = await supabase
      .from("newsletter_subscribers")
      .upsert({ email, subscribed_at: new Date().toISOString() }, { onConflict: "email" })

    if (dbError) {
      console.error("Newsletter DB error:", dbError)
      // Don't fail — the table might not exist yet, still send the recommendations
    }

    // Generate monthly recommendations
    const { month, destinations } = getMonthlyRecommendations()

    return NextResponse.json({
      success: true,
      message: `Welcome! Here are our top picks for ${month}.`,
      month,
      recommendations: destinations,
      features: [
        "AI-powered itinerary generation in seconds",
        "Real-time weather & emergency SOS",
        "Interactive maps with all your stops plotted",
        "Budget splitting & expense tracking",
        "Trip memories & photo collage generator",
        "Community wall — share trips with fellow travelers",
      ]
    })

  } catch (err: any) {
    console.error("Newsletter error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
