"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, Mountain, Palmtree, Building2, Tent, ArrowRight, Star, Copy, ImageIcon, ChevronLeft, ChevronRight, Loader2, MapPin, Calendar, Wallet, Plane } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

// ─── Destination card images ───
const destImages: Record<string, string> = {
  goa: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=80&w=600&auto=format&fit=crop',
  manali: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?q=80&w=600&auto=format&fit=crop',
  jaipur: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?q=80&w=600&auto=format&fit=crop',
  kerala: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?q=80&w=600&auto=format&fit=crop',
  kashmir: 'https://images.unsplash.com/photo-1614591276564-7b3e69347a48?q=80&w=600&auto=format&fit=crop',
  rishikesh: 'https://images.unsplash.com/photo-1683318528842-bd5f1fd0ff9a?q=80&w=600&auto=format&fit=crop',
  udaipur: 'https://images.unsplash.com/photo-1589901164570-f9de6556e1c1?q=80&w=600&auto=format&fit=crop',
  dubai: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=600&auto=format&fit=crop',
}

// ─── Curated Templates ───
const TEMPLATES = [
  { id: "goa-4", title: "Goa", tagline: "Beaches, Nightlife & Seafood", days: 4, budget: "₹25,000", dest: "Goa", season: "Oct – Mar" },
  { id: "manali-5", title: "Manali", tagline: "Snow, Trekking & Solang Valley", days: 5, budget: "₹20,000", dest: "Manali", season: "Dec – Feb" },
  { id: "jaipur-3", title: "Jaipur", tagline: "Forts, Palaces & Culture", days: 3, budget: "₹15,000", dest: "Jaipur", season: "Nov – Feb" },
  { id: "kerala-6", title: "Kerala", tagline: "Backwaters, Tea Gardens & Ayurveda", days: 6, budget: "₹35,000", dest: "Kerala", season: "Sep – Mar" },
  { id: "kashmir-7", title: "Kashmir", tagline: "Dal Lake, Gulmarg & Pahalgam", days: 7, budget: "₹40,000", dest: "Kashmir", season: "Mar – Oct" },
  { id: "rishikesh-3", title: "Rishikesh", tagline: "Rafting, Yoga & Ganges", days: 3, budget: "₹12,000", dest: "Rishikesh", season: "Sep – Nov" },
  { id: "udaipur-4", title: "Udaipur", tagline: "Lakes, Heritage & Romance", days: 4, budget: "₹18,000", dest: "Udaipur", season: "Oct – Mar" },
  { id: "dubai-5", title: "Dubai", tagline: "Burj Khalifa, Desert Safari", days: 5, budget: "₹1,00,000", dest: "Dubai", season: "Nov – Mar" },
]

// ─── Matchmaker Options ───
const VIBES = [
  { label: "Relaxing", icon: Palmtree, desc: "Unwind & recharge" },
  { label: "Adventure", icon: Mountain, desc: "Thrill & adrenaline" },
  { label: "Cultural", icon: Building2, desc: "History & heritage" },
  { label: "Backpacking", icon: Tent, desc: "Budget & explore" },
]
const LANDSCAPES = ["🏖️ Beach", "🏔️ Mountains", "🏙️ City", "🌿 Countryside"]
const BUDGETS = ["₹10k – ₹25k", "₹25k – ₹50k", "₹50k – ₹1L", "₹1L+"]
const BUDGET_VALUES = ["₹10,000 - ₹25,000", "₹25,000 - ₹50,000", "₹50,000 - ₹1,00,000", "₹1,00,000+"]

// ─── Main Page ───
export default function ExplorePage() {
  const router = useRouter()
  const [vibe, setVibe] = useState<string | null>(null)
  const [landscape, setLandscape] = useState<string | null>(null)
  const [budget, setBudget] = useState<number | null>(null)
  const [communityTrips, setCommunityTrips] = useState<any[]>([])
  const [loadingCommunity, setLoadingCommunity] = useState(true)
  const [cloningId, setCloningId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadCommunity() {
      const supabase = createClient()
      let { data, error } = await supabase
        .from("trips")
        .select("id, destination, duration_days, budget_range, review_rating, review_text, plan_data, created_at, status")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(12)

      if (error && error.code === '42703') {
        const fallback = await supabase
          .from("trips")
          .select("id, destination, duration_days, budget_range, plan_data, created_at, status")
          .eq("is_public", true)
          .order("created_at", { ascending: false })
          .limit(12)
        data = (fallback.data || []).map((t: any) => ({
          ...t,
          review_rating: null,
          review_text: null
        })) as any
        error = fallback.error as any
      }

      if (error) console.error("Explore page error fetching trips:", error)

      if (data && data.length > 0) {
        const tripIds = data.map((t: any) => t.id)
        const { data: photos } = await supabase
          .from("memories")
          .select("trip_id, photo_url, description")
          .in("trip_id", tripIds)
          .limit(50)

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
    const budgetVal = budget !== null ? BUDGET_VALUES[budget] : "₹50,000"
    const prompt = `Plan a ${landscape?.replace(/[^\w\s]/g, "").trim() || "scenic"} trip in India with a ${vibe?.toLowerCase() || "relaxing"} vibe, budget around ${budgetVal}`
    router.push(`/dashboard?prefill=${encodeURIComponent(prompt)}`)
  }

  const handleCloneTemplate = async (tmpl: typeof TEMPLATES[0]) => {
    setCloningId(tmpl.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

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

    if (error || !data) { alert("Failed to create trip."); return }
    router.push(`/generate-stays/${data.id}`)
  }

  const scrollCarousel = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 380, behavior: "smooth" })
  }

  return (
    <div className="min-h-screen pb-20">

      {/* ═══ SECTION 1: EDITORIAL HERO ═══ */}
      <section className="relative overflow-hidden border-b border-border/30">
        {/* Background image with overlay */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/80 to-background" />
        
        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-36 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--gold)] font-medium mb-6">
              Curated for the discerning traveler
            </p>
            <h1 className="font-serif text-5xl md:text-7xl tracking-tight text-foreground leading-[1.1]">
              Where will your<br />
              <span className="italic">next story</span> begin?
            </h1>
            <p className="text-muted-foreground mt-6 max-w-lg mx-auto text-sm leading-relaxed">
              Discover handpicked destinations, let our AI match your perfect getaway, 
              or draw inspiration from fellow travelers' journeys.
            </p>
          </motion.div>

          {/* Trending Destinations */}
          <motion.div 
            className="flex flex-wrap justify-center gap-3 mt-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {["Goa", "Kashmir", "Jaipur", "Kerala", "Manali", "Udaipur"].map((name, i) => (
              <Link key={name} href="/trip-input">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className="group flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] font-medium px-5 py-2.5 border border-border/40 bg-background/50 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:border-[var(--gold)]/40 transition-all cursor-pointer"
                >
                  <MapPin className="h-3 w-3 text-[var(--gold)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  {name}
                </motion.div>
              </Link>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 2: CURATED ITINERARIES ═══ */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--gold)] font-medium mb-3">Ready to go</p>
              <h2 className="font-serif text-3xl md:text-4xl tracking-tight">Curated Itineraries</h2>
              <p className="text-sm text-muted-foreground mt-2">One click. A complete trip plan crafted by our AI.</p>
            </div>
            <div className="hidden md:flex gap-2">
              <button 
                onClick={() => scrollCarousel(-1)}
                className="p-2.5 border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button 
                onClick={() => scrollCarousel(1)}
                className="p-2.5 border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory -mx-2 px-2">
            {TEMPLATES.map((tmpl, i) => {
              const img = destImages[tmpl.dest.toLowerCase()]
              return (
                <motion.div
                  key={tmpl.id}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  viewport={{ once: true }}
                  className="flex-shrink-0 w-[320px] snap-start group"
                >
                  <div className="border border-border/40 bg-card/50 overflow-hidden hover:border-[var(--gold)]/30 transition-all duration-500 h-full flex flex-col">
                    {/* Image */}
                    <div className="h-44 relative overflow-hidden">
                      {img && (
                        <div 
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                          style={{ backgroundImage: `url('${img}')` }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                      <div className="absolute bottom-4 left-5">
                        <p className="text-[9px] uppercase tracking-[0.15em] font-medium text-white/60">{tmpl.season}</p>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-serif text-2xl group-hover:text-[var(--gold)] transition-colors">{tmpl.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 flex-1">{tmpl.tagline}</p>
                      
                      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/30">
                        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{tmpl.days}d</span>
                          <span className="flex items-center gap-1"><Wallet className="h-3 w-3" />{tmpl.budget}</span>
                        </div>
                        <button 
                          onClick={() => handleCloneTemplate(tmpl)} 
                          disabled={cloningId === tmpl.id}
                          className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.15em] font-medium px-3 py-2 bg-foreground text-background hover:bg-foreground/90 transition-all disabled:opacity-40"
                        >
                          {cloningId === tmpl.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Copy className="h-3 w-3" /> Clone</>}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 3: AI MATCHMAKER ═══ */}
      <section id="matchmaker" className="border-y border-border/30 bg-card/30">
        <div className="max-w-4xl mx-auto px-6 py-20 md:py-28">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--gold)] font-medium mb-3">Personalized</p>
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight mb-3">
              Destination Matchmaker
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Three questions. One perfect destination. Let our AI read your travel personality.
            </p>
          </motion.div>

          <div className="space-y-14">
            {/* Q1: Vibe */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-5 font-medium">01 — Your travel mood</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {VIBES.map(v => (
                  <button
                    key={v.label}
                    onClick={() => setVibe(v.label)}
                    className={`group p-6 border transition-all duration-300 text-center ${
                      vibe === v.label 
                        ? "border-[var(--gold)] bg-[var(--gold)]/5" 
                        : "border-border/50 hover:border-foreground/20"
                    }`}
                  >
                    <v.icon className={`h-8 w-8 mx-auto mb-3 transition-colors ${vibe === v.label ? "text-[var(--gold)]" : "text-muted-foreground group-hover:text-foreground"}`} />
                    <span className="block text-xs font-medium uppercase tracking-[0.1em]">{v.label}</span>
                    <span className="block text-[10px] text-muted-foreground mt-1">{v.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Q2: Landscape */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-5 font-medium">02 — Preferred landscape</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {LANDSCAPES.map(l => (
                  <button
                    key={l}
                    onClick={() => setLandscape(l)}
                    className={`p-5 border transition-all duration-300 text-center text-sm font-medium ${
                      landscape === l 
                        ? "border-[var(--gold)] bg-[var(--gold)]/5" 
                        : "border-border/50 hover:border-foreground/20"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Q3: Budget */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-5 font-medium">03 — Budget range</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {BUDGETS.map((b, i) => (
                  <button
                    key={b}
                    onClick={() => setBudget(i)}
                    className={`p-5 border transition-all duration-300 text-center ${
                      budget === i 
                        ? "border-[var(--gold)] bg-[var(--gold)]/5" 
                        : "border-border/50 hover:border-foreground/20"
                    }`}
                  >
                    <span className="block text-sm font-medium">{b}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="text-center pt-4">
              <button
                disabled={!vibe || !landscape || budget === null}
                onClick={handleMatchmaker}
                className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-medium px-10 py-4 bg-foreground text-background hover:bg-foreground/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Sparkles className="h-3.5 w-3.5" /> Find My Destination <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 4: COMMUNITY WALL ═══ */}
      <section className="py-20 md:py-28 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 text-center mb-16">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--gold)] font-medium mb-3">From our community</p>
          <h2 className="font-serif text-3xl md:text-5xl tracking-tight mb-3">Traveler's Wall</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Real journeys, real memories. Browse trips shared by fellow explorers.
          </p>
        </div>

        {loadingCommunity ? (
          <div className="text-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--gold)] mx-auto mb-4" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Loading memories</p>
          </div>
        ) : communityTrips.length === 0 ? (
          <div className="max-w-lg mx-auto text-center py-20 border border-dashed border-border/50">
            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/20 mb-5" />
            <h3 className="font-serif text-2xl mb-2">The wall awaits</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Complete a trip and mark it as "Public" in your Memories to pin it here for other travelers.
            </p>
          </div>
        ) : (
          /* Polaroid Wall */
          <div
            className="relative w-full min-h-[600px] py-16 px-6 md:px-12"
            style={{
              background: 'radial-gradient(ellipse at center top, hsl(var(--card) / 0.8) 0%, hsl(var(--background)) 100%)',
            }}
          >
            {/* Ambient glow */}
            <div className="absolute top-20 left-1/4 w-72 h-72 bg-[var(--gold)]/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-20 right-1/4 w-56 h-56 bg-[var(--gold)]/3 rounded-full blur-3xl pointer-events-none" />

            {/* Polaroid Grid */}
            <div className="flex flex-wrap justify-center gap-8 md:gap-10 max-w-5xl mx-auto">
              {communityTrips.map((trip, index) => {
                const rotations = [-2.5, 1.8, -1.2, 2.5, -1.8, 0.8, -3, 2]
                const rotation = rotations[index % rotations.length]

                return (
                  <motion.div
                    key={trip.id}
                    initial={{ opacity: 0, y: 40, rotate: rotation - 3 }}
                    whileInView={{ opacity: 1, y: 0, rotate: rotation }}
                    whileHover={{ scale: 1.05, rotate: 0, zIndex: 10 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 200, damping: 20, delay: index * 0.06 }}
                    className="relative cursor-pointer"
                    style={{ zIndex: index }}
                  >
                    {/* Gold tape strip */}
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 w-14 h-5 bg-[var(--gold)]/15 border border-[var(--gold)]/20 backdrop-blur-sm z-20"
                      style={{ transform: `translateX(-50%) rotate(${[-5, 3, -8, 6][index % 4]}deg)` }}
                    />

                    {/* Polaroid Frame */}
                    <div
                      className="bg-card border border-border/40 shadow-2xl"
                      style={{
                        width: trip.photos.length > 0 ? '220px' : '200px',
                        padding: '10px',
                        paddingBottom: trip.review_text ? '76px' : '50px',
                      }}
                    >
                      {/* Photo */}
                      {trip.photos.length > 0 ? (
                        <div className="relative overflow-hidden bg-muted" style={{ aspectRatio: '4/3' }}>
                          <img
                            src={trip.photos[0].photo_url}
                            alt={trip.destination}
                            className="w-full h-full object-cover"
                            crossOrigin="anonymous"
                          />
                          {trip.photos.length > 1 && (
                            <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                              {trip.photos.slice(1, 3).map((p: any, i: number) => (
                                <img key={i} src={p.photo_url} alt="" className="w-7 h-7 object-cover border border-card shadow-sm" crossOrigin="anonymous" />
                              ))}
                              {trip.photos.length > 3 && (
                                <div className="w-7 h-7 bg-foreground/60 border border-card flex items-center justify-center text-background text-[9px] font-bold">
                                  +{trip.photos.length - 3}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-muted/50 flex items-center justify-center text-4xl" style={{ aspectRatio: '4/3' }}>
                          <Plane className="h-10 w-10 text-muted-foreground/20" />
                        </div>
                      )}

                      {/* Caption */}
                      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-2">
                        <p className="font-serif capitalize text-sm truncate text-foreground">{trip.destination}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-[0.1em]">
                          {trip.duration_days} days {trip.budget_range ? `· ₹${parseInt(trip.budget_range).toLocaleString('en-IN')}` : ''}
                        </p>
                        {trip.review_rating > 0 && (
                          <div className="flex gap-0.5 mt-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} className={`text-[10px] ${i < trip.review_rating ? 'text-[var(--gold)]' : 'text-muted-foreground/30'}`}>★</span>
                            ))}
                          </div>
                        )}
                        {trip.review_text && (
                          <p className="text-muted-foreground text-[10px] mt-1 italic line-clamp-2 font-serif">
                            "{trip.review_text}"
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            <p className="text-center text-muted-foreground/30 text-[10px] mt-16 uppercase tracking-[0.2em]">
              Pin yours by marking a trip as Public in Memories
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
