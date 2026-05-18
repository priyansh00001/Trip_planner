"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"

import { createClient } from "@/lib/supabase/client"

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

  const [destination, setDestination] = useState("")
  const [days, setDays] = useState<number>(3)
  const [budget, setBudget] = useState<number>(10000)
  const [accommodation, setAccommodation] = useState("No Preference")

  const todayStr = new Date().toISOString().split('T')[0]
  const [journeyDate, setJourneyDate] = useState(todayStr)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!destination.trim()) { setError("Please enter a destination"); return }
    if (journeyDate < todayStr) { setError("Journey date cannot be in the past"); return }

    setIsSubmitting(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data, error: insertError } = await supabase.from('trips').insert({
        user_id: user.id,
        destination,
        duration_days: days,
        budget_range: String(budget),
        preference: accommodation,
        status: 'generating_stays',
        start_date: journeyDate
      }).select().single()

      if (insertError) { setError(insertError.message); setIsSubmitting(false); return }
      router.push(`/generate-stays/${data.id}`)
    } else {
      localStorage.setItem("anonymous_trip", JSON.stringify({
        destination, duration_days: days, budget_range: String(budget),
        preference: accommodation, start_date: journeyDate
      }))
      router.push(`/generate-stays/anonymous`)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Atmospheric background watermark */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-[0.08] dark:opacity-[0.14]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background" />
      </div>

      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
        </div>
      </header>

      {/* Main Form */}
      <main className="flex-1 flex items-start justify-center py-12 md:py-20 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-2xl"
        >
          {/* Title */}
          <div className="text-center mb-14">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--gold)] font-medium mb-4">New Journey</p>
            <h1 className="font-serif text-4xl md:text-5xl tracking-tight">Plan your escape</h1>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto text-sm leading-relaxed">
              Tell us the essentials. Our AI will craft a bespoke itinerary tailored to your style.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-12">
            {/* Destination */}
            <div>
              <label className="text-[11px] uppercase tracking-[0.2em] font-medium text-muted-foreground mb-3 block">
                Destination
              </label>
              <input
                type="text"
                placeholder="Where do you dream of going?"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full bg-transparent border-0 border-b-2 border-border/40 focus:border-[var(--gold)] outline-none py-4 text-2xl font-serif text-foreground placeholder:text-muted-foreground/30 transition-colors"
                required
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="text-[11px] uppercase tracking-[0.2em] font-medium text-muted-foreground mb-3 block">
                Departure Date
              </label>
              <input
                type="date"
                min={todayStr}
                value={journeyDate}
                onChange={(e) => setJourneyDate(e.target.value)}
                className="w-full bg-transparent border-0 border-b-2 border-border/40 focus:border-[var(--gold)] outline-none py-4 text-lg text-foreground transition-colors"
                required
              />
            </div>

            {/* Duration & Budget */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] font-medium text-muted-foreground mb-4 block">
                  Duration
                </label>
                <div className="flex items-end gap-4">
                  <input
                    type="range"
                    min="1" max="14"
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value))}
                    className="w-full accent-[var(--gold)] h-[2px] bg-border/30 appearance-none cursor-pointer"
                  />
                  <div className="text-right shrink-0">
                    <span className="font-serif text-3xl text-foreground">{days}</span>
                    <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground ml-1.5">days</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] font-medium text-muted-foreground mb-4 block">
                  Budget
                </label>
                <div className="flex items-end gap-4">
                  <input
                    type="range"
                    min="3000" max="100000" step="1000"
                    value={budget}
                    onChange={(e) => setBudget(parseInt(e.target.value))}
                    className="w-full accent-[var(--gold)] h-[2px] bg-border/30 appearance-none cursor-pointer"
                  />
                  <div className="text-right shrink-0">
                    <span className="font-serif text-3xl text-foreground">₹{(budget / 1000).toFixed(0)}k</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-2">₹{budget.toLocaleString('en-IN')} · Excluding flights</p>
              </div>
            </div>

            {/* Accommodation */}
            <div>
              <label className="text-[11px] uppercase tracking-[0.2em] font-medium text-muted-foreground mb-5 block">
                Accommodation Style
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {accomOptions.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setAccommodation(opt.label)}
                    className={`group p-5 border transition-all duration-300 text-center ${
                      accommodation === opt.label
                        ? "border-[var(--gold)] bg-[var(--gold)]/5"
                        : "border-border/40 hover:border-foreground/20"
                    }`}
                  >
                    <span className="text-2xl block mb-2">{opt.emoji}</span>
                    <span className="block text-xs font-medium text-foreground">{opt.label.replace(/ 🎒| 🏡/g, '')}</span>
                    <span className="block text-[10px] text-muted-foreground mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-medium text-destructive border border-destructive/30 bg-destructive/5 px-4 py-3"
              >
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.2em] font-semibold py-5 bg-foreground text-background hover:bg-foreground/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Crafting your journey...</>
                ) : (
                  <>Generate My Itinerary <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          </form>

          <p className="text-center text-[10px] text-muted-foreground/30 uppercase tracking-[0.15em] mt-8">
            Powered by AI · Personalized for you
          </p>
        </motion.div>
      </main>
    </div>
  )
}
