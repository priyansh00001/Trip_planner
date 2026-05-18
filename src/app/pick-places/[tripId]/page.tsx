"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Landmark, Coffee, ShoppingBag, TreePine, Palette, UtensilsCrossed,
  Loader2, Check, ArrowRight, MapPin, Star, Search, Clock, X,
  ChevronDown, AlertCircle, Sparkles, Eye
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import AuthModal from "@/components/AuthModal"

// ─── Category Config ─────────────────────────────────────
const CATEGORIES = [
  { id: "landmarks", label: "Landmarks", icon: Landmark, color: "from-amber-500 to-orange-500" },
  { id: "cafes", label: "Cafes & Restaurants", icon: Coffee, color: "from-emerald-500 to-teal-500" },
  { id: "markets", label: "Markets & Shopping", icon: ShoppingBag, color: "from-pink-500 to-rose-500" },
  { id: "parks", label: "Parks & Nature", icon: TreePine, color: "from-green-500 to-lime-500" },
  { id: "culture", label: "Culture & Museums", icon: Palette, color: "from-purple-500 to-violet-500" },
  { id: "food", label: "Street Food Zones", icon: UtensilsCrossed, color: "from-red-500 to-orange-500" },
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
  place,
  isSelected,
  onToggle,
  onDetail,
  index,
}: {
  place: Place
  isSelected: boolean
  onToggle: () => void
  onDetail: () => void
  index: number
}) {
  const photo = place.photos?.[0]
  // Vary card heights for masonry effect
  const heights = ["h-64", "h-72", "h-56", "h-80", "h-60", "h-68"]
  const cardHeight = heights[index % heights.length]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="break-inside-avoid mb-4"
    >
      <div
        onClick={onToggle}
        className={`relative group cursor-pointer rounded-2xl overflow-hidden border-2 transition-all duration-300 ${
          isSelected
            ? "border-indigo-500 shadow-xl shadow-indigo-500/20 scale-[1.02]"
            : "border-transparent hover:border-indigo-300/50 hover:shadow-lg"
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
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <MapPin className="h-12 w-12 text-muted-foreground/30" />
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
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg"
              >
                <Check className="h-5 w-5 text-white" strokeWidth={3} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Detail button */}
          <button
            onClick={(e) => { e.stopPropagation(); onDetail(); }}
            className="absolute top-3 left-3 h-8 w-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Eye className="h-4 w-4 text-white" />
          </button>

          {/* Content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="font-bold text-white text-lg leading-tight drop-shadow-lg">
              {place.name}
            </h3>
            <p className="text-white/70 text-xs mt-1 line-clamp-2">{place.description}</p>

            <div className="flex items-center gap-3 mt-2">
              {place.rating > 0 && (
                <div className="flex items-center gap-1 bg-black/30 backdrop-blur-sm rounded-full px-2 py-0.5">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs font-bold text-white">{place.rating}</span>
                </div>
              )}
              {place.timing && (
                <div className="flex items-center gap-1 text-white/60">
                  <Clock className="h-3 w-3" />
                  <span className="text-[10px]">{place.timing}</span>
                </div>
              )}
              {place.priceLevel && place.priceLevel > 0 && (
                <span className="text-xs text-white/60">
                  {"₹".repeat(place.priceLevel)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Signature dish for food places */}
        {place.signatureDish && (
          <div className="px-4 py-2 bg-background border-t text-xs text-muted-foreground">
            🍽️ Must try: <span className="font-semibold text-foreground">{place.signatureDish}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Place Detail Modal ──────────────────────────────────
function PlaceDetailModal({
  place,
  isSelected,
  onToggle,
  onClose,
}: {
  place: Place
  isSelected: boolean
  onToggle: () => void
  onClose: () => void
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
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-background rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Photo carousel */}
        <div className="relative h-64 bg-muted">
          {place.photos?.[0]?.url ? (
            <img
              src={place.photos[0].url}
              alt={place.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MapPin className="h-16 w-16 text-muted-foreground/20" />
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center"
          >
            <X className="h-4 w-4 text-white" />
          </button>
          {place.photos?.[0]?.credit && (
            <div className="absolute bottom-2 right-2 text-[10px] text-white/50 bg-black/30 px-2 py-0.5 rounded-full">
              📷 {place.photos[0].credit}
            </div>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-bold">{place.name}</h2>
            {place.address && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3" /> {place.address}
              </p>
            )}
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{place.description}</p>

          <div className="flex flex-wrap gap-3">
            {place.rating > 0 && (
              <div className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-3 py-1.5 rounded-lg text-sm font-medium">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                {place.rating}
              </div>
            )}
            {place.timing && (
              <div className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1.5 rounded-lg text-sm font-medium">
                <Clock className="h-4 w-4" />
                {place.timing}
              </div>
            )}
            {place.priceLevel && place.priceLevel > 0 && (
              <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-3 py-1.5 rounded-lg text-sm font-medium">
                {"₹".repeat(place.priceLevel)} Price
              </div>
            )}
          </div>

          {place.signatureDish && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                🍽️ Signature Dish: {place.signatureDish}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={onToggle}
              className={`flex-1 ${
                isSelected
                  ? "bg-indigo-500 hover:bg-indigo-600"
                  : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90"
              }`}
            >
              {isSelected ? (
                <><Check className="h-4 w-4 mr-2" /> Selected</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Add to My Trip</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + place.address)}`
                window.open(url, '_blank')
              }}
            >
              <MapPin className="h-4 w-4 mr-1" /> Maps
            </Button>
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

  // Load trip data
  useEffect(() => {
    async function loadTrip() {
      if (!params?.tripId) return

      if (params.tripId === "anonymous") {
        const stored = localStorage.getItem("anonymous_trip")
        if (!stored) {
          router.push("/trip-input")
          return
        }
        const parsed = JSON.parse(stored)
        setTrip({ ...parsed, id: "anonymous" })
        setLoading(false)
      } else {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('id', params.tripId)
          .single()

        if (error || !data) {
          setError("Could not load trip data.")
          setLoading(false)
          return
        }
        setTrip(data)
        setLoading(false)
      }
    }
    loadTrip()
  }, [params, router])

  // Fetch places for active category
  const fetchPlaces = useCallback(async (category: string) => {
    if (!trip?.destination || placesCache[category]) return

    setLoadingCategory(true)
    try {
      const res = await fetch(
        `/api/places/search?city=${encodeURIComponent(trip.destination)}&category=${category}`
      )
      const data = await res.json()
      if (data.places) {
        setPlacesCache(prev => ({ ...prev, [category]: data.places }))
      }
    } catch (err) {
      console.error("Failed to fetch places:", err)
    }
    setLoadingCategory(false)
  }, [trip?.destination, placesCache])

  useEffect(() => {
    if (trip?.destination) {
      fetchPlaces(activeCategory)
    }
  }, [activeCategory, trip?.destination, fetchPlaces])

  // Toggle place selection
  const togglePlace = (place: Place) => {
    setSelectedPlaces(prev => {
      const exists = prev.find(p => p.name === place.name)
      if (exists) return prev.filter(p => p.name !== place.name)
      return [...prev, place]
    })
  }

  const isSelected = (place: Place) => selectedPlaces.some(p => p.name === place.name)

  // Continue to generate itinerary
  const handleContinue = async () => {
    if (!trip?.id || selectedPlaces.length === 0) return
    setContinuing(true)

    if (params?.tripId === "anonymous") {
      setIsAuthModalOpen(true)
      setContinuing(false)
      return
    }

    const supabase = createClient()
    await supabase
      .from('trips')
      .update({
        plan_data: {
          ...trip.plan_data,
          selected_places: selectedPlaces.map(p => ({
            name: p.name,
            description: p.description,
            rating: p.rating,
            category: p.category,
            lat: p.lat,
            lng: p.lng,
            timing: p.timing,
            signatureDish: p.signatureDish,
            address: p.address,
            priceLevel: p.priceLevel,
          })),
        },
        status: 'generating_itinerary',
      })
      .eq('id', trip.id)

    router.push(`/generate/${trip.id}`)
  }

  // Filter places by search
  const currentPlaces = (placesCache[activeCategory] || []).filter(p =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const minPlaces = Math.max(5, (trip?.duration_days || 3) * 3)

  // ─── Loading / Error States ────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="max-w-md text-center p-8 border rounded-xl bg-background shadow-lg">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    )
  }

  // ─── Main Render ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-28">

      {/* Hero Header */}
      <div className="w-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 pt-14 pb-12 px-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-white/5 rounded-full blur-2xl" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white mb-5 backdrop-blur-md">
            <Sparkles className="h-4 w-4 mr-2" />
            Step 2 of 3 — Pick Your Places
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-3">
            What do you want to explore in {trip?.destination}?
          </h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            Browse and select places you'd love to visit. We'll build your perfect itinerary around your picks.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mt-5 text-white/80 font-medium text-sm">
            <div className="flex items-center bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
              <MapPin className="h-4 w-4 mr-2" /> {trip?.destination}
            </div>
            <div className="flex items-center bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
              📅 {trip?.duration_days} Days
            </div>
            <div className="flex items-center bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
              ✅ {selectedPlaces.length} Selected
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon
            const count = selectedPlaces.filter(p => p.category === cat.id).length
            const isActive = activeCategory === cat.id

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-gradient-to-r " + cat.color + " text-white shadow-lg"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {cat.label}
                {count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive ? "bg-white/20" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search places in ${trip?.destination}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 rounded-xl border bg-background pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Masonry Grid */}
        {loadingCategory ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
            <p className="text-muted-foreground">Discovering amazing places...</p>
          </div>
        ) : currentPlaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">No places found. Try a different category.</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
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
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            selectedPlaces={selectedPlaces}
          />
        )}
      </AnimatePresence>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">
              {selectedPlaces.length} place{selectedPlaces.length !== 1 ? 's' : ''} selected
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedPlaces.length < minPlaces
                ? `Select at least ${minPlaces} for a ${trip?.duration_days}-day trip`
                : "You're all set! Continue to generate your itinerary."
              }
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/generate/${trip?.id}`)}
              className="hidden sm:flex"
            >
              Skip & Let AI Decide
            </Button>
            <Button
              onClick={handleContinue}
              disabled={selectedPlaces.length < 1 || continuing}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 shadow-lg px-6"
            >
              {continuing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Building...</>
              ) : (
                <><ArrowRight className="h-4 w-4 mr-2" /> Continue</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
