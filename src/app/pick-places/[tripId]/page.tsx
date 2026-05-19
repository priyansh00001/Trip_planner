"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Landmark, Coffee, ShoppingBag, TreePine, Palette, UtensilsCrossed,
  Loader2, Check, ArrowRight, MapPin, Star, Search, Clock, X,
  AlertCircle, Eye
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import AuthModal from "@/components/AuthModal"
import { TripProgressBar } from "@/components/TripProgressBar"

// ─── Category Config ─────────────────────────────────────
const CATEGORIES = [
  { id: "landmarks", label: "Landmarks", icon: Landmark },
  { id: "cafes", label: "Cafes & Restaurants", icon: Coffee },
  { id: "markets", label: "Markets & Shopping", icon: ShoppingBag },
  { id: "parks", label: "Parks & Nature", icon: TreePine },
  { id: "culture", label: "Culture & Museums", icon: Palette },
  { id: "food", label: "Street Food Zones", icon: UtensilsCrossed },
]

interface Place {
  name: string
  description: string
  rating: number
  category: string
  lat: number
  lng: number
  priceLevel?: number
  timing?: string
  signatureDish?: string | null
  address?: string
  photos: { url: string; thumb: string; alt: string; credit: string }[]
}

// ─── Place Card Component ────────────────────────────────
function PlaceCard({
  place, isSelected, onToggle, onDetail, index,
}: {
  place: Place; isSelected: boolean; onToggle: () => void; onDetail: () => void; index: number
}) {
  const photo = place.photos?.[0]
  const heights = ["h-64", "h-72", "h-56", "h-80", "h-60", "h-68"]
  const cardHeight = heights[index % heights.length]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="break-inside-avoid mb-5"
    >
      <div
        onClick={onToggle}
        className={`relative group cursor-pointer overflow-hidden rounded-3xl transition-all duration-300 glass-card ${
          isSelected
            ? "border-[var(--gold)] shadow-lg"
            : "border-border/30 hover:border-foreground/20 hover:shadow-md"
        }`}
      >
        {/* Photo */}
        <div className={`relative ${cardHeight} bg-muted`}>
          {photo?.url ? (
            <img
              src={photo.url}
              alt={photo.alt || place.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted/50">
              <MapPin className="h-10 w-10 text-muted-foreground/15" />
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Selection checkmark */}
          <AnimatePresence>
            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute top-3 right-3 h-7 w-7 bg-[var(--gold)] rounded-full flex items-center justify-center shadow-lg"
              >
                <Check className="h-4 w-4 text-background" strokeWidth={3} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Detail button */}
          <button
            onClick={(e) => { e.stopPropagation(); onDetail(); }}
            className="absolute top-3 left-3 h-7 w-7 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Eye className="h-3.5 w-3.5 text-white" />
          </button>

          {/* Content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="font-serif text-white text-lg leading-tight drop-shadow-lg">
              {place.name}
            </h3>
            <p className="text-white/60 text-[10px] mt-1 line-clamp-2">{place.description}</p>

            <div className="flex items-center gap-3 mt-2">
              {place.rating > 0 && (
                <div className="flex items-center gap-1 text-[10px]">
                  <Star className="h-3 w-3 fill-[var(--gold)] text-[var(--gold)]" />
                  <span className="text-white font-medium">{place.rating}</span>
                </div>
              )}
              {place.timing && (
                <div className="flex items-center gap-1 text-white/50 text-[10px]">
                  <Clock className="h-3 w-3" />
                  <span>{place.timing}</span>
                </div>
              )}
              {place.priceLevel && place.priceLevel > 0 && (
                <span className="text-[10px] text-white/50">
                  {"₹".repeat(place.priceLevel)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Signature dish */}
        {place.signatureDish && (
          <div className="px-4 py-2.5 bg-card border-t border-border/30 text-[10px] text-muted-foreground">
            Must try: <span className="font-medium text-foreground">{place.signatureDish}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Place Detail Modal ──────────────────────────────────
function PlaceDetailModal({
  place, isSelected, onToggle, onClose,
}: {
  place: Place; isSelected: boolean; onToggle: () => void; onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-card border border-border/50 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-64 bg-muted">
          {place.photos?.[0]?.url ? (
            <img src={place.photos[0].url} alt={place.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MapPin className="h-14 w-14 text-muted-foreground/15" />
            </div>
          )}
          <button onClick={onClose} className="absolute top-3 right-3 h-8 w-8 bg-black/50 flex items-center justify-center">
            <X className="h-4 w-4 text-white" />
          </button>
          {place.photos?.[0]?.credit && (
            <div className="absolute bottom-2 right-2 text-[9px] text-white/40 bg-black/30 px-2 py-0.5">
              {place.photos[0].credit}
            </div>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h2 className="font-serif text-2xl">{place.name}</h2>
            {place.address && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 uppercase tracking-[0.1em]">
                <MapPin className="h-3 w-3" /> {place.address}
              </p>
            )}
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{place.description}</p>

          <div className="flex flex-wrap gap-3">
            {place.rating > 0 && (
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 border border-border/50 rounded-full bg-card/30">
                <Star className="h-3 w-3 fill-[var(--gold)] text-[var(--gold)]" /> {place.rating}
              </div>
            )}
            {place.timing && (
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 border border-border/50 rounded-full bg-card/30">
                <Clock className="h-3 w-3" /> {place.timing}
              </div>
            )}
            {place.priceLevel && place.priceLevel > 0 && (
              <div className="text-[10px] px-3 py-1.5 border border-border/50 rounded-full bg-card/30">
                {"₹".repeat(place.priceLevel)} Price
              </div>
            )}
          </div>

          {place.signatureDish && (
            <div className="border border-[var(--gold)]/20 bg-[var(--gold)]/5 p-4">
              <p className="text-sm font-medium">
                Signature Dish: {place.signatureDish}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onToggle}
              className={`flex-1 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.15em] font-semibold py-3.5 rounded-full transition-all cursor-pointer ${
                isSelected
                  ? "bg-[var(--gold)] text-background"
                  : "bg-foreground text-background hover:bg-foreground/90"
              }`}
            >
              {isSelected ? <><Check className="h-3.5 w-3.5" /> Selected</> : <>Add to My Trip</>}
            </button>
            <button
              onClick={() => {
                const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + place.address)}`
                window.open(url, '_blank')
              }}
              className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] font-bold px-5 py-3.5 border border-border/50 hover:border-foreground/30 rounded-full transition-all cursor-pointer"
            >
              <MapPin className="h-3 w-3" /> Maps
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Page ───────────────────────────────────────────
export default function PickPlacesPage() {
  const router = useRouter()
  const params = useParams()

  const [trip, setTrip] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  const [activeCategory, setActiveCategory] = useState("landmarks")
  const [placesCache, setPlacesCache] = useState<Record<string, Place[]>>({})
  const [loadingCategory, setLoadingCategory] = useState(false)
  const [selectedPlaces, setSelectedPlaces] = useState<Place[]>([])
  const [detailPlace, setDetailPlace] = useState<Place | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [continuing, setContinuing] = useState(false)

  useEffect(() => {
    async function loadTrip() {
      if (!params?.tripId) return
      if (params.tripId === "anonymous") {
        const stored = localStorage.getItem("anonymous_trip")
        if (!stored) { router.push("/trip-input"); return }
        setTrip({ ...JSON.parse(stored), id: "anonymous" })
        setLoading(false)
      } else {
        const supabase = createClient()
        const { data, error } = await supabase.from('trips').select('*').eq('id', params.tripId).single()
        if (error || !data) { setError("Could not load trip data."); setLoading(false); return }
        setTrip(data)
        setLoading(false)
      }
    }
    loadTrip()
  }, [params, router])

  const fetchPlaces = useCallback(async (category: string) => {
    if (!trip?.destination || placesCache[category]) return
    setLoadingCategory(true)
    try {
      const res = await fetch(`/api/places/search?city=${encodeURIComponent(trip.destination)}&category=${category}`)
      const data = await res.json()
      if (data.places) setPlacesCache(prev => ({ ...prev, [category]: data.places }))
    } catch (err) { console.error("Failed to fetch places:", err) }
    setLoadingCategory(false)
  }, [trip?.destination, placesCache])

  useEffect(() => {
    if (trip?.destination) fetchPlaces(activeCategory)
  }, [activeCategory, trip?.destination, fetchPlaces])

  const togglePlace = (place: Place) => {
    setSelectedPlaces(prev => {
      const exists = prev.find(p => p.name === place.name)
      if (exists) return prev.filter(p => p.name !== place.name)
      return [...prev, place]
    })
  }
  const isSelected = (place: Place) => selectedPlaces.some(p => p.name === place.name)

  const handleContinue = async () => {
    if (!trip?.id || selectedPlaces.length === 0) return
    setContinuing(true)
    if (params?.tripId === "anonymous") { setIsAuthModalOpen(true); setContinuing(false); return }

    const supabase = createClient()
    await supabase
      .from('trips')
      .update({
        plan_data: {
          ...trip.plan_data,
          selected_places: selectedPlaces.map(p => ({
            name: p.name, description: p.description, rating: p.rating, category: p.category,
            lat: p.lat, lng: p.lng, timing: p.timing, signatureDish: p.signatureDish,
            address: p.address, priceLevel: p.priceLevel,
          })),
        },
        status: 'generating_itinerary',
      })
      .eq('id', trip.id)
    router.push(`/generate/${trip.id}`)
  }

  const currentPlaces = (placesCache[activeCategory] || []).filter(p =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const minPlaces = Math.max(5, (trip?.duration_days || 3) * 3)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--gold)] mx-auto mb-4" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Loading trip details</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="max-w-md text-center p-10 border border-border/50">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-4" />
          <h2 className="font-serif text-2xl mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <button onClick={() => router.push('/dashboard')} className="text-[10px] uppercase tracking-[0.2em] font-medium px-6 py-3 bg-foreground text-background">
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <TripProgressBar currentStep={3} />

      {/* Editorial Header */}
      <div className="border-b border-border/50 py-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--gold)] font-medium mb-4">
            Step 2 of 3 — Curate Your Experiences
          </p>
          <h1 className="font-serif text-4xl md:text-5xl tracking-tight mb-4">
            What excites you in <span className="italic">{trip?.destination}</span>?
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto">
            Browse and select places you'd love to visit. We'll weave them into your perfect itinerary.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mt-6 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            <span className="px-4 py-2 border border-border/50 rounded-full bg-card/30 backdrop-blur-sm">{trip?.destination}</span>
            <span className="px-4 py-2 border border-border/50 rounded-full bg-card/30 backdrop-blur-sm">{trip?.duration_days} Days</span>
            <span className="px-4 py-2 border border-border/50 rounded-full bg-card/30 backdrop-blur-sm">{selectedPlaces.length} Selected</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-8">

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          {CATEGORIES.map(cat => {
            const count = selectedPlaces.filter(p => p.category === cat.id).length
            const isActive = activeCategory === cat.id

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-5 py-2.5 text-[10px] uppercase tracking-[0.15em] font-bold whitespace-nowrap border rounded-full transition-all duration-300 ${
                  isActive
                    ? "bg-foreground text-background border-foreground"
                    : "border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {cat.label}
                {count > 0 && (
                  <span className={`ml-1 px-2.5 py-0.5 text-[9px] font-bold rounded-full ${
                    isActive ? "bg-background/20" : "bg-[var(--gold)]/10 text-[var(--gold)]"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search Bar */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
          <input
            type="text"
            placeholder={`Search places in ${trip?.destination}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 border border-border/50 bg-transparent rounded-full pl-11 pr-4 text-sm focus:outline-none focus:border-[var(--gold)] transition-all bg-card/10 backdrop-blur-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Masonry Grid */}
        {loadingCategory ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--gold)]" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Discovering places</p>
          </div>
        ) : currentPlaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <MapPin className="h-10 w-10 text-muted-foreground/15" />
            <p className="text-sm text-muted-foreground">No places found. Try a different category.</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-5">
            {currentPlaces.map((place, i) => (
              <PlaceCard
                key={place.name + i}
                place={place}
                isSelected={isSelected(place)}
                onToggle={() => togglePlace(place)}
                onDetail={() => setDetailPlace(place)}
                index={i}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {detailPlace && (
          <PlaceDetailModal
            place={detailPlace}
            isSelected={isSelected(detailPlace)}
            onToggle={() => togglePlace(detailPlace)}
            onClose={() => setDetailPlace(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAuthModalOpen && (
          <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} selectedPlaces={selectedPlaces} />
        )}
      </AnimatePresence>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {selectedPlaces.length} place{selectedPlaces.length !== 1 ? 's' : ''} selected
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
              {selectedPlaces.length < minPlaces
                ? `Select at least ${minPlaces} for a ${trip?.duration_days}-day trip`
                : "You're all set — continue to generate"
              }
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/generate/${trip?.id}`)}
              className="hidden sm:flex items-center text-[10px] uppercase tracking-[0.15em] font-bold px-6 py-3.5 border border-border/50 text-muted-foreground hover:text-foreground rounded-full transition-all cursor-pointer"
            >
              Skip & Let AI Decide
            </button>
            <button
              onClick={handleContinue}
              disabled={selectedPlaces.length < 1 || continuing}
              className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] font-bold px-6 py-3.5 bg-foreground text-background rounded-full hover:bg-foreground/90 transition-all disabled:opacity-30 shadow-md cursor-pointer"
            >
              {continuing ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Building...</>
              ) : (
                <>Continue <ArrowRight className="h-3.5 w-3.5" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
