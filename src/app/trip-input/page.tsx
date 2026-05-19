"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Loader2, Calendar, MapPin } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"

import { createClient } from "@/lib/supabase/client"

const POPULAR_CITIES = [
  "Delhi", "Mumbai", "Bengaluru", "Goa", "Jaipur", "Agra", "Kochi", 
  "Srinagar", "Manali", "Shimla", "Udaipur", "Varanasi", "Kolkata", 
  "Hyderabad", "Chennai", "Pune", "Ooty", "Rishikesh", "Dharamshala", 
  "Leh Ladakh", "Amritsar", "Alleppey", "Pondicherry", "Munnar", 
  "Darjeeling", "Jaisalmer", "Jodhpur", "Hampi", "Mysore", "Guwahati",
  "Shillong", "Gangtok", "Mussoorie", "Dehradun", "Chandigarh"
]

const accomOptions = [
  { label: "Hotel", emoji: "🏨", desc: "Comfort & amenities" },
  { label: "Hostel 🎒", emoji: "🎒", desc: "Social & budget" },
  { label: "Homestay 🏡", emoji: "🏡", desc: "Local & authentic" },
  { label: "No Preference", emoji: "✨", desc: "Surprise me" },
]

export default function TripInputPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [originCity, setOriginCity] = useState("")
  const [destination, setDestination] = useState("")
  const [days, setDays] = useState<number>(3)
  const [budget, setBudget] = useState<number>(10000)
  const [accommodation, setAccommodation] = useState("No Preference")

  const [originSuggestions, setOriginSuggestions] = useState<string[]>([])
  const [destSuggestions, setDestSuggestions] = useState<string[]>([])
  const [showOriginDropdown, setShowOriginDropdown] = useState(false)
  const [showDestDropdown, setShowDestDropdown] = useState(false)

  const handleOriginChange = (val: string) => {
    setOriginCity(val)
    if (val.trim()) {
      const filtered = POPULAR_CITIES.filter(city => 
        city.toLowerCase().includes(val.toLowerCase()) && 
        city.toLowerCase() !== val.toLowerCase()
      )
      setOriginSuggestions(filtered)
      setShowOriginDropdown(true)
    } else {
      setOriginSuggestions([])
      setShowOriginDropdown(false)
    }
  }

  const handleDestChange = (val: string) => {
    setDestination(val)
    if (val.trim()) {
      const filtered = POPULAR_CITIES.filter(city => 
        city.toLowerCase().includes(val.toLowerCase()) && 
        city.toLowerCase() !== val.toLowerCase()
      )
      setDestSuggestions(filtered)
      setShowDestDropdown(true)
    } else {
      setDestSuggestions([])
      setShowDestDropdown(false)
    }
  }

  useEffect(() => {
    const handleOutsideClick = () => {
      setShowOriginDropdown(false)
      setShowDestDropdown(false)
    }
    window.addEventListener("click", handleOutsideClick)
    return () => window.removeEventListener("click", handleOutsideClick)
  }, [])

  const todayStr = new Date().toISOString().split('T')[0]
  const [journeyDate, setJourneyDate] = useState(todayStr)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const origin = params.get("origin")
      const dest = params.get("destination")
      const dStr = params.get("days")
      const bStr = params.get("budget")
      const pref = params.get("preference")

      if (origin) setOriginCity(origin)
      if (dest) setDestination(dest)
      if (dStr) {
        const val = parseInt(dStr)
        if (!isNaN(val)) setDays(val)
      }
      if (bStr) {
        const val = parseInt(bStr)
        if (!isNaN(val)) setBudget(val)
      }
      if (pref) setAccommodation(pref)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!originCity.trim()) { setError("Please enter your origin city"); return }
    if (!destination.trim()) { setError("Please enter a destination"); return }
    if (journeyDate < todayStr) { setError("Journey date cannot be in the past"); return }

    setIsSubmitting(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data, error: insertError } = await supabase.from('trips').insert({
        user_id: user.id,
        origin_city: originCity,
        destination,
        duration_days: days,
        budget_range: String(budget),
        preference: accommodation,
        status: 'selecting_transport',
        start_date: journeyDate
      }).select().single()

      if (insertError) { setError(insertError.message); setIsSubmitting(false); return }
      router.push(`/select-transport/${data.id}`)
    } else {
      localStorage.setItem("anonymous_trip", JSON.stringify({
        originCity, destination, duration_days: days, budget_range: String(budget),
        preference: accommodation, start_date: journeyDate
      }))
      router.push(`/select-transport/anonymous`)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Atmospheric background watermark */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-[0.08] dark:opacity-[0.14]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background" />
      </div>

      {/* Main Form */}
      <main className="flex-1 flex items-start justify-center py-12 md:py-20 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-2xl bg-card/75 backdrop-blur-2xl border border-border/40 rounded-[32px] p-8 md:p-12 shadow-2xl shadow-black/10"
        >
          {/* Title */}
          <div className="text-center mb-14">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--gold)] font-semibold mb-4">New Journey</p>
            <h1 className="font-serif text-4xl md:text-5xl tracking-tight">Plan your escape</h1>
            <p className="text-muted-foreground/80 mt-3 max-w-md mx-auto text-sm leading-relaxed">
              Tell us the essentials. Our AI will craft a bespoke itinerary tailored to your style.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-12">
            {/* Origin City */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-muted-foreground/95 mb-3 block">
                Origin City
              </label>
              <input
                type="text"
                placeholder="Where are you traveling from?"
                value={originCity}
                onChange={(e) => handleOriginChange(e.target.value)}
                onFocus={() => { if (originCity.trim()) setShowOriginDropdown(true) }}
                className="w-full bg-transparent border-0 border-b-2 border-border/60 focus:border-[var(--gold)] outline-none py-4 text-2xl font-serif text-foreground placeholder:text-muted-foreground/45 transition-colors"
                required
              />
              {showOriginDropdown && originSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-2 bg-card/95 backdrop-blur-2xl border border-border/40 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                  {originSuggestions.map((city) => (
                    <div
                      key={city}
                      onClick={() => {
                        setOriginCity(city)
                        setShowOriginDropdown(false)
                      }}
                      className="px-6 py-4 hover:bg-[var(--gold)]/10 hover:text-[var(--gold)] cursor-pointer text-left transition-colors font-sans text-sm border-b border-border/10 last:border-0"
                    >
                      {city}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Destination */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-muted-foreground/95 mb-3 block">
                Destination
              </label>
              <input
                type="text"
                placeholder="Where do you dream of going?"
                value={destination}
                onChange={(e) => handleDestChange(e.target.value)}
                onFocus={() => { if (destination.trim()) setShowDestDropdown(true) }}
                className="w-full bg-transparent border-0 border-b-2 border-border/60 focus:border-[var(--gold)] outline-none py-4 text-2xl font-serif text-foreground placeholder:text-muted-foreground/45 transition-colors"
                required
              />
              {showDestDropdown && destSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-2 bg-card/95 backdrop-blur-2xl border border-border/40 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                  {destSuggestions.map((city) => (
                    <div
                      key={city}
                      onClick={() => {
                        setDestination(city)
                        setShowDestDropdown(false)
                      }}
                      className="px-6 py-4 hover:bg-[var(--gold)]/10 hover:text-[var(--gold)] cursor-pointer text-left transition-colors font-sans text-sm border-b border-border/10 last:border-0"
                    >
                      {city}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Start Date */}
            <div>
              <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-muted-foreground/95 mb-3 block">
                Departure Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  min={todayStr}
                  value={journeyDate}
                  onChange={(e) => setJourneyDate(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  className="w-full bg-transparent border-0 border-b-2 border-border/60 focus:border-[var(--gold)] outline-none py-4 text-lg text-foreground transition-colors cursor-pointer"
                  required
                />
                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50 pointer-events-none" />
              </div>
            </div>

            {/* Duration & Budget */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-muted-foreground/95 mb-4 block">
                  Duration
                </label>
                <div className="flex items-end gap-4">
                  <input
                    type="range"
                    min="1" max="14"
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value))}
                    className="w-full accent-[var(--gold)] h-[2px] bg-border/40 appearance-none cursor-pointer"
                  />
                  <div className="text-right shrink-0">
                    <span className="font-serif text-3xl text-foreground">{days}</span>
                    <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/90 ml-1.5">days</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-muted-foreground/95 mb-4 block">
                  Budget
                </label>
                <div className="flex items-end gap-4">
                  <input
                    type="range"
                    min="3000" max="100000" step="1000"
                    value={budget}
                    onChange={(e) => setBudget(parseInt(e.target.value))}
                    className="w-full accent-[var(--gold)] h-[2px] bg-border/40 appearance-none cursor-pointer"
                  />
                  <div className="text-right shrink-0">
                    <span className="font-serif text-3xl text-foreground">₹{(budget / 1000).toFixed(0)}k</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/80 mt-2">₹{budget.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-medium text-destructive border border-destructive/30 bg-destructive/5 px-4 py-3 rounded-xl"
              >
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.2em] font-semibold py-5 bg-foreground text-background hover:bg-foreground/90 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg cursor-pointer"
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Crafting your journey...</>
                ) : (
                  <>Generate My Itinerary <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          </form>

          <p className="text-center text-[10px] text-muted-foreground/50 uppercase tracking-[0.15em] mt-8">
            Powered by AI · Personalized for you
          </p>
        </motion.div>
      </main>
    </div>
  )
}
