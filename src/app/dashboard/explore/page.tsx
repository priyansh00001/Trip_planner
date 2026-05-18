"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { Sparkles, Mountain, Palmtree, Building2, Tent, DollarSign, Plane, ArrowRight, Star, Copy, ImageIcon, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

// ─── Animated Hero Visual ───
function HeroVisual() {
  const destinations = [
    { name: "Goa", top: "15%", left: "20%", delay: 0, color: "from-cyan-400 to-blue-500" },
    { name: "Kashmir", top: "8%", left: "55%", delay: 0.3, color: "from-violet-400 to-purple-500" },
    { name: "Jaipur", top: "35%", left: "40%", delay: 0.6, color: "from-amber-400 to-orange-500" },
    { name: "Kerala", top: "65%", left: "25%", delay: 0.9, color: "from-emerald-400 to-teal-500" },
    { name: "Manali", top: "45%", left: "70%", delay: 1.2, color: "from-sky-400 to-indigo-500" },
    { name: "Udaipur", top: "75%", left: "60%", delay: 1.5, color: "from-pink-400 to-rose-500" },
  ]

  return (
    <div className="relative w-[400px] h-[400px] md:w-[500px] md:h-[500px]">
      {/* Glowing orb background */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-600/20 via-indigo-600/10 to-pink-600/20 blur-3xl animate-pulse" />
      
      {/* Rotating ring */}
      <div className="absolute inset-8 rounded-full border border-purple-500/20 animate-[spin_30s_linear_infinite]" />
      <div className="absolute inset-16 rounded-full border border-pink-500/15 animate-[spin_25s_linear_infinite_reverse]" />
      <div className="absolute inset-24 rounded-full border border-indigo-500/10 animate-[spin_20s_linear_infinite]" />
      
      {/* Center icon */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-2xl shadow-purple-500/30">
        <Plane className="h-9 w-9 text-white" />
      </div>

      {/* Floating destination cards */}
      {destinations.map((dest, i) => (
        <motion.div
          key={dest.name}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: dest.delay, type: "spring", stiffness: 200 }}
          className="absolute"
          style={{ top: dest.top, left: dest.left }}
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
            className={`bg-gradient-to-r ${dest.color} text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg cursor-pointer hover:scale-110 transition-transform whitespace-nowrap`}
          >
            {dest.name}
          </motion.div>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Curated Templates ───
const TEMPLATES = [
  { id: "goa-4", title: "4 Days in Goa", subtitle: "Beaches, Nightlife & Seafood", days: 4, budget: "₹25,000", icon: "*", gradient: "from-cyan-500 to-blue-500", dest: "Goa" },
  { id: "manali-5", title: "5 Days in Manali", subtitle: "Snow, Trekking & Solang Valley", days: 5, budget: "₹20,000", icon: "*", gradient: "from-sky-500 to-indigo-600", dest: "Manali" },
  { id: "jaipur-3", title: "3 Days in Jaipur", subtitle: "Forts, Palaces & Culture", days: 3, budget: "₹15,000", icon: "*", gradient: "from-amber-500 to-orange-600", dest: "Jaipur" },
  { id: "kerala-6", title: "6 Days in Kerala", subtitle: "Backwaters, Tea Gardens & Ayurveda", days: 6, budget: "₹35,000", icon: "*", gradient: "from-emerald-500 to-teal-600", dest: "Kerala" },
  { id: "kashmir-7", title: "7 Days in Kashmir", subtitle: "Dal Lake, Gulmarg & Pahalgam", days: 7, budget: "₹40,000", icon: "*", gradient: "from-violet-500 to-purple-600", dest: "Kashmir" },
  { id: "rishikesh-3", title: "3 Days in Rishikesh", subtitle: "Rafting, Yoga & Ganges", days: 3, budget: "₹12,000", icon: "*", gradient: "from-green-500 to-emerald-600", dest: "Rishikesh" },
  { id: "udaipur-4", title: "4 Days in Udaipur", subtitle: "Lakes, Heritage & Romance", days: 4, budget: "₹18,000", icon: "*", gradient: "from-pink-500 to-rose-600", dest: "Udaipur" },
  { id: "dubai-5", title: "5 Days in Dubai", subtitle: "Burj Khalifa, Desert Safari", days: 5, budget: "₹1,00,000", icon: "*", gradient: "from-yellow-500 to-amber-600", dest: "Dubai" },
]

// ─── Matchmaker Questions ───
const VIBES = [
  { label: "Relaxing", icon: Palmtree, color: "from-green-400 to-emerald-500" },
  { label: "Adventure", icon: Mountain, color: "from-orange-400 to-red-500" },
  { label: "Cultural", icon: Building2, color: "from-purple-400 to-indigo-500" },
  { label: "Backpacking", icon: Tent, color: "from-yellow-400 to-amber-500" },
]

const LANDSCAPES = ["🏖️ Beach", "🏔️ Mountains", "🏙️ City", "🌿 Countryside"]
const BUDGETS = ["₹10,000 - ₹25,000", "₹25,000 - ₹50,000", "₹50,000 - ₹1,00,000", "₹1,00,000+"]

// ─── Main Page ───
export default function ExplorePage() {
  const router = useRouter()
  const [vibe, setVibe] = useState<string | null>(null)
  const [landscape, setLandscape] = useState<string | null>(null)
  const [budget, setBudget] = useState<string | null>(null)
  const [communityTrips, setCommunityTrips] = useState<any[]>([])
  const [loadingCommunity, setLoadingCommunity] = useState(true)
  const [cloningId, setCloningId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadCommunity() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("trips")
        .select("id, destination, duration_days, budget_range, review_rating, review_text, plan_data, created_at, status")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(12)

      if (error) {
        console.error("Explore page error fetching trips:", error)
      }

      if (data && data.length > 0) {
        // Also fetch photos for each trip
        const tripIds = data.map((t: any) => t.id)
        const { data: photos, error: photoError } = await supabase
          .from("memories")
          .select("trip_id, photo_url, description")
          .in("trip_id", tripIds)
          .limit(50)
          
        if (photoError) {
          console.error("Explore page error fetching photos:", photoError)
        }

        const tripsWithPhotos = data.map((trip: any) => ({
          ...trip,
          photos: (photos || []).filter((p: any) => p.trip_id === trip.id)
        }))
        setCommunityTrips(tripsWithPhotos)
      }
      setLoadingCommunity(false)
    }
    loadCommunity()
  }, [])

  const handleMatchmaker = () => {
    const prompt = `Plan a ${landscape?.replace(/[^\w\s]/g, "").trim() || "scenic"} trip in India with a ${vibe?.toLowerCase() || "relaxing"} vibe, budget around ${budget || "₹50,000"}`
    router.push(`/dashboard?prefill=${encodeURIComponent(prompt)}`)
  }

  const handleCloneTemplate = async (tmpl: typeof TEMPLATES[0]) => {
    setCloningId(tmpl.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push("/login")
      return
    }

    const todayStr = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase.from('trips').insert({
      user_id: user.id,
      destination: tmpl.dest,
      duration_days: tmpl.days,
      budget_range: tmpl.budget.replace(/[^\d]/g, ''),
      preference: 'No Preference',
      status: 'generating_stays',
      start_date: todayStr
    }).select().single()

    if (error || !data) {
      alert("Failed to create trip. Please try again.")
      return
    }

    router.push(`/generate-stays/${data.id}`)
  }

  const scrollCarousel = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 340, behavior: "smooth" })
  }

  return (
    <div className="min-h-screen pb-20">

      {/* ═══ SECTION 1: GLOBE HERO ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-background py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 text-center md:text-left space-y-6 z-10">
            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-extrabold text-white tracking-tight"
            >
              Explore the{" "}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                World
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="text-lg text-zinc-400 max-w-md"
            >
              Discover trending destinations, get AI-powered recommendations, or browse trips from our community.
            </motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <Link
                href="#matchmaker"
                className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-lg px-8 h-14 font-semibold hover:opacity-90 transition-opacity"
              >
                <Sparkles className="mr-2 h-5 w-5" /> Find My Perfect Trip
              </Link>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
            className="flex-shrink-0"
          >
            <HeroVisual />
          </motion.div>
        </div>

        {/* Trending Destinations Floating Cards */}
        <div className="max-w-6xl mx-auto px-4 mt-12">
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {[
              { name: "Goa", trend: "+42%", color: "border-cyan-500/30" },
              { name: "Manali", trend: "+38%", color: "border-blue-500/30" },
              { name: "Jaipur", trend: "+35%", color: "border-amber-500/30" },
              { name: "Kerala", trend: "+31%", color: "border-emerald-500/30" },
              { name: "Kashmir", trend: "+29%", color: "border-violet-500/30" },
              { name: "Rishikesh", trend: "+26%", color: "border-green-500/30" },
              { name: "Udaipur", trend: "+24%", color: "border-pink-500/30" },
              { name: "Dubai", trend: "+20%", color: "border-yellow-500/30" },
            ].map((dest, i) => (
              <motion.div
                key={dest.name}
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.1 }}
                className={`flex-shrink-0 bg-white/5 backdrop-blur-md border ${dest.color} rounded-2xl px-6 py-4 min-w-[140px] text-center hover:bg-white/10 transition-all cursor-pointer`}
              >
                <div className="text-white font-bold text-lg">{dest.name}</div>
                <div className="text-emerald-400 text-xs font-semibold mt-1">{dest.trend} trending</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 2: AI MATCHMAKER ═══ */}
      <section id="matchmaker" className="max-w-4xl mx-auto px-4 py-16 md:py-24">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-3">
            <Sparkles className="inline h-8 w-8 text-purple-500 mr-2" />
            AI Destination Matchmaker
          </h2>
          <p className="text-muted-foreground text-lg">Answer 3 quick questions and we'll find your dream trip.</p>
        </motion.div>

        <div className="space-y-10">
          {/* Q1: Vibe */}
          <div>
            <h3 className="text-sm font-bold uppercase text-muted-foreground mb-4">1. What's your vibe?</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {VIBES.map(v => (
                <button
                  key={v.label}
                  onClick={() => setVibe(v.label)}
                  className={`relative p-6 rounded-2xl border-2 transition-all text-center ${vibe === v.label ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20" : "border-border hover:border-purple-500/40"}`}
                >
                  <v.icon className={`h-10 w-10 mx-auto mb-3 ${vibe === v.label ? "text-purple-500" : "text-muted-foreground"}`} />
                  <span className="font-bold">{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Q2: Landscape */}
          <div>
            <h3 className="text-sm font-bold uppercase text-muted-foreground mb-4">2. Pick a landscape</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {LANDSCAPES.map(l => (
                <button
                  key={l}
                  onClick={() => setLandscape(l)}
                  className={`p-5 rounded-2xl border-2 transition-all text-center text-lg font-semibold ${landscape === l ? "border-pink-500 bg-pink-500/10 shadow-lg shadow-pink-500/20" : "border-border hover:border-pink-500/40"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Q3: Budget */}
          <div>
            <h3 className="text-sm font-bold uppercase text-muted-foreground mb-4">3. Budget range</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {BUDGETS.map(b => (
                <button
                  key={b}
                  onClick={() => setBudget(b)}
                  className={`p-5 rounded-2xl border-2 transition-all text-center font-semibold ${budget === b ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20" : "border-border hover:border-emerald-500/40"}`}
                >
                  <DollarSign className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  <span className="text-sm">{b}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center pt-4">
            <Button
              size="lg"
              disabled={!vibe || !landscape || !budget}
              onClick={handleMatchmaker}
              className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-lg px-10 h-14 disabled:opacity-40"
            >
              <Plane className="mr-2 h-5 w-5" /> Find My Destination <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 3: CURATED TEMPLATES ═══ */}
      <section className="bg-muted/30 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold">One-Click Trip Templates</h2>
              <p className="text-muted-foreground mt-1">Handcrafted itineraries, ready to go.</p>
            </div>
            <div className="hidden md:flex gap-2">
              <Button variant="outline" size="icon" className="rounded-full" onClick={() => scrollCarousel(-1)}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="icon" className="rounded-full" onClick={() => scrollCarousel(1)}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div ref={scrollRef} className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
            {TEMPLATES.map((tmpl, i) => (
              <motion.div
                key={tmpl.id}
                initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="flex-shrink-0 w-[300px] snap-start"
              >
                <Card className={`bg-gradient-to-br ${tmpl.gradient} text-white p-6 rounded-2xl h-full flex flex-col shadow-lg hover:shadow-2xl transition-shadow`}>
                  <h3 className="text-2xl font-bold">{tmpl.title}</h3>
                  <p className="text-white/80 text-sm mt-2 flex-1">{tmpl.subtitle}</p>
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/20">
                    <div className="text-sm">
                      <span className="font-bold">{tmpl.days} Days</span> · {tmpl.budget}
                    </div>
                    <Button size="sm" onClick={() => handleCloneTemplate(tmpl)} disabled={cloningId === tmpl.id} className="rounded-full bg-white/20 hover:bg-white/30 text-white border-0">
                      {cloningId === tmpl.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Copy className="h-4 w-4 mr-1" /> Clone</>}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 4: COMMUNITY WALL ═══ */}
      <section className="py-16 md:py-24 overflow-hidden">
        {/* Section Header */}
        <div className="text-center mb-16 max-w-6xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 mb-4">
            <span>📌</span> Pinned by Travelers Like You
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold mb-3 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">Community Wall of Fame</h2>
          <p className="text-muted-foreground text-lg">Real memories. Real adventures. Get inspired!</p>
        </div>

        {loadingCommunity ? (
          <div className="text-center py-20 text-muted-foreground">Loading memories...</div>
        ) : communityTrips.length === 0 ? (
          <div className="text-center py-20 bg-muted/30 rounded-2xl border border-dashed max-w-2xl mx-auto">
            <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-bold mb-2">No public trips yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Complete a trip and mark it as "Public" to pin it here and inspire other travelers!
            </p>
          </div>
        ) : (
          /* Cork Board Wall */
          <div
            className="relative w-full min-h-[600px] rounded-3xl py-16 px-8 md:px-16"
            style={{
              background: 'radial-gradient(ellipse at top, #1a0e05 0%, #0d0705 100%)',
              boxShadow: 'inset 0 0 120px rgba(0,0,0,0.8)',
            }}
          >
            {/* Ambient light spots */}
            <div className="absolute top-10 left-1/4 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-10 right-1/4 w-64 h-64 bg-orange-600/5 rounded-full blur-3xl pointer-events-none" />

            {/* String lights row */}
            <div className="absolute top-0 left-0 right-0 flex justify-around items-start pointer-events-none overflow-hidden h-8">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-px h-4 bg-white/10" />
                  <div className="w-2 h-2 rounded-full bg-amber-300/80 shadow-[0_0_6px_2px_rgba(251,191,36,0.4)]" style={{ animationDelay: `${i * 0.15}s` }} />
                </div>
              ))}
            </div>

            {/* Polaroid Grid */}
            <div className="flex flex-wrap justify-center gap-8 md:gap-12 pt-6">
              {communityTrips.map((trip, index) => {
                // Alternating slight rotations for a natural pinned look
                const rotations = [-3, 2, -1.5, 3, -2, 1, -3.5, 2.5]
                const rotation = rotations[index % rotations.length]
                const pinColors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-400', 'bg-green-500', 'bg-purple-500', 'bg-pink-500']
                const pinColor = pinColors[index % pinColors.length]
                const tapeRotations = [-8, 5, -12, 7, -6, 10]
                const tapeRot = tapeRotations[index % tapeRotations.length]

                return (
                  <motion.div
                    key={trip.id}
                    initial={{ opacity: 0, y: 40, rotate: rotation - 5 }}
                    whileInView={{ opacity: 1, y: 0, rotate: rotation }}
                    whileHover={{ scale: 1.05, rotate: 0, zIndex: 10 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 200, damping: 20, delay: index * 0.08 }}
                    className="relative cursor-pointer"
                    style={{ zIndex: index }}
                  >
                    {/* Thumb Pin */}
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-5 h-5 ${pinColor} rounded-full shadow-lg border-2 border-white/30`}
                      style={{ boxShadow: `0 2px 8px rgba(0,0,0,0.5)` }}
                    />

                    {/* Polaroid Frame */}
                    <div
                      className="bg-white shadow-2xl"
                      style={{
                        width: trip.photos.length > 0 ? '220px' : '200px',
                        padding: '12px',
                        paddingBottom: trip.review_text ? '80px' : '52px',
                        boxShadow: `${rotation > 0 ? '-' : ''}4px 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.1)`,
                      }}
                    >
                      {/* Tape strip on top */}
                      <div
                        className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-5 bg-amber-100/60 backdrop-blur-sm"
                        style={{ transform: `translateX(-50%) rotate(${tapeRot}deg)`, opacity: 0.7 }}
                      />

                      {/* Photo */}
                      {trip.photos.length > 0 ? (
                        <div className="relative overflow-hidden bg-gray-200" style={{ aspectRatio: '4/3' }}>
                          <img
                            src={trip.photos[0].photo_url}
                            alt={trip.destination}
                            className="w-full h-full object-cover"
                            crossOrigin="anonymous"
                          />
                          {/* Extra thumbnails stacked at corner */}
                          {trip.photos.length > 1 && (
                            <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                              {trip.photos.slice(1, 3).map((p: any, i: number) => (
                                <img key={i} src={p.photo_url} alt="" className="w-8 h-8 object-cover border-2 border-white shadow-sm" crossOrigin="anonymous" />
                              ))}
                              {trip.photos.length > 3 && (
                                <div className="w-8 h-8 bg-black/60 border-2 border-white flex items-center justify-center text-white text-xs font-bold">
                                  +{trip.photos.length - 3}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-5xl" style={{ aspectRatio: '4/3' }}>
                          ✈️
                        </div>
                      )}

                      {/* Caption area (white bottom of polaroid) */}
                      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-2">
                        <p className="font-bold text-gray-800 capitalize text-sm truncate" style={{ fontFamily: 'Georgia, serif' }}>
                          {trip.destination}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5" style={{ fontFamily: 'Georgia, serif' }}>
                          {trip.duration_days} days {trip.budget_range ? `· ${trip.budget_range}` : ''}
                        </p>
                        {trip.review_rating > 0 && (
                          <div className="flex gap-0.5 mt-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} className={`text-xs ${i < trip.review_rating ? 'text-yellow-500' : 'text-gray-300'}`}>★</span>
                            ))}
                          </div>
                        )}
                        {trip.review_text && (
                          <p className="text-gray-500 text-xs mt-1 italic line-clamp-2" style={{ fontFamily: 'Georgia, serif' }}>
                            "{trip.review_text}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Drop shadow on the wall */}
                    <div className="absolute inset-0 blur-xl bg-black/20 -z-10 scale-90 translate-y-4" />
                  </motion.div>
                )
              })}
            </div>

            {/* Bottom attribution */}
            <p className="text-center text-white/20 text-xs mt-16 font-medium tracking-widest uppercase">
              📌 Pin yours by marking a trip as Public in Memories
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
