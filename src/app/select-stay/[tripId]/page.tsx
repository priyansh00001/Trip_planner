"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  MapPin, Star, Loader2, AlertCircle,
  Check, ArrowRight
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i <= Math.round(rating) ? "fill-[var(--gold)] text-[var(--gold)]" : "text-muted-foreground/20"}`}
        />
      ))}
      <span className="text-[10px] text-muted-foreground ml-1.5">{rating}</span>
    </div>
  )
}

export default function SelectStayPage() {
  const router = useRouter()
  const params = useParams()

  const [trip, setTrip] = useState<any>(null)
  const [stays, setStays] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    async function loadStays() {
      if (!params?.tripId) return

      if (params.tripId === "anonymous") {
        const stored = localStorage.getItem("anonymous_trip")
        if (!stored) { router.push("/trip-input"); return }
        const data = JSON.parse(stored)
        setTrip(data)
        setStays(data.plan_data?.stays || [])
        setLoading(false)
      } else {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('trips').select('*').eq('id', params.tripId).single()

        if (error || !data) { setError("Could not load stay options."); setLoading(false); return }
        setTrip(data)
        setStays(data.plan_data?.stays || [])
        setLoading(false)
      }
    }
    loadStays()
  }, [params, router])

  const handleConfirmStay = async () => {
    if (!selectedId || !trip) return
    setConfirming(true)

    const chosenStay = stays.find((s: any) => s.id === selectedId)
    if (!chosenStay) return

    if (params?.tripId === "anonymous") {
      localStorage.setItem("anonymous_trip", JSON.stringify({
        ...trip,
        plan_data: { ...trip.plan_data, confirmed_stay: chosenStay },
        status: 'generating_itinerary'
      }))
      router.push(`/pick-places/anonymous`)
    } else {
      const supabase = createClient()
      await supabase
        .from('trips')
        .update({
          plan_data: { ...trip.plan_data, confirmed_stay: chosenStay },
          status: 'generating_itinerary',
        })
        .eq('id', trip.id)
      router.push(`/pick-places/${trip.id}`)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--gold)] mx-auto mb-4" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Finding your perfect stay</p>
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
          <button
            onClick={() => router.push('/dashboard')}
            className="text-[10px] uppercase tracking-[0.2em] font-medium px-6 py-3 bg-foreground text-background"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Editorial Header */}
      <div className="border-b border-border/50 py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--gold)] font-medium mb-4">
            Step 1 of 3 — Choose Your Base
          </p>
          <h1 className="font-serif text-4xl md:text-5xl tracking-tight mb-4">
            Where will you stay in <span className="italic">{trip?.destination}</span>?
          </h1>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            Pick your base — we'll plan every day's activities starting from here.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mt-6 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            <span className="px-4 py-2 border border-border/50">{trip?.destination}</span>
            <span className="px-4 py-2 border border-border/50">{trip?.duration_days} Days</span>
            <span className="px-4 py-2 border border-border/50">₹{Number(trip?.budget_range).toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>

      {/* Stay Cards */}
      <div className="max-w-5xl mx-auto px-6 py-14">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground text-center mb-10">
          {stays.length} options found · Select one to continue
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {stays.map((stay: any, idx: number) => {
            const isSelected = selectedId === stay.id

            return (
              <motion.div
                key={stay.id || idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.07 }}
                onClick={() => setSelectedId(stay.id || String(idx))}
                className="cursor-pointer"
              >
                <div className={`relative border transition-all duration-300 p-6 h-full flex flex-col ${
                  isSelected
                    ? "border-[var(--gold)] bg-[var(--gold)]/5"
                    : "border-border/40 hover:border-foreground/20"
                }`}>
                  {/* Selected checkmark */}
                  {isSelected && (
                    <div className="absolute top-4 right-4 h-6 w-6 bg-[var(--gold)] flex items-center justify-center">
                      <Check className="h-4 w-4 text-background" strokeWidth={3} />
                    </div>
                  )}

                  {/* Type badge */}
                  <span className="text-[9px] uppercase tracking-[0.15em] font-medium text-muted-foreground border border-border/50 px-2 py-1 self-start mb-4">
                    {stay.type}
                  </span>

                  <h3 className="font-serif text-xl leading-tight pr-8 mb-2">{stay.name}</h3>

                  {stay.address && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-3">
                      <MapPin className="h-3 w-3 shrink-0" /> {stay.address}
                    </p>
                  )}

                  <div className="mb-3">
                    <StarRating rating={stay.rating} />
                  </div>

                  <div className="mt-auto pt-4 border-t border-border/30 flex items-center justify-between">
                    <span className="font-serif text-xl text-[var(--gold)]">
                      {stay.price}
                    </span>
                  </div>

                  {stay.whyStay && (
                    <p className="mt-3 text-[10px] text-muted-foreground leading-relaxed border-t border-border/20 pt-3 italic">
                      {stay.whyStay}
                    </p>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Confirm CTA */}
        <div className="mt-14 flex flex-col items-center gap-3">
          <button
            disabled={!selectedId || confirming}
            onClick={handleConfirmStay}
            className="flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.2em] font-semibold px-12 py-5 bg-foreground text-background hover:bg-foreground/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {confirming ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Building your itinerary...</>
            ) : (
              <>Confirm Stay & Continue <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
          {!selectedId && (
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50">Select a stay above to continue</p>
          )}
        </div>
      </div>
    </div>
  )
}
