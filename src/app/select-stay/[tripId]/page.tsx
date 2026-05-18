"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  Building2, MapPin, Star, Loader2, AlertCircle,
  CheckCircle2, ArrowRight, Wallet, Home
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating}</span>
    </div>
  )
}

const typeColors: Record<string, string> = {
  "Luxury Resort":     "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  "Boutique Hotel":    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "Budget Hotel":      "bg-blue-100  text-blue-800  dark:bg-blue-900/30  dark:text-blue-300",
  "Backpacker Hostel": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "Hostel":            "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "Homestay":          "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "Resort":            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
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
      const supabase = createClient()

      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', params.tripId)
        .single()

      if (error || !data) {
        setError("Could not load stay options. Please try again.")
        setLoading(false)
        return
      }

      setTrip(data)
      setStays(data.plan_data?.stays || [])
      setLoading(false)
    }

    loadStays()
  }, [params])

  const handleConfirmStay = async () => {
    if (!selectedId || !trip) return
    setConfirming(true)

    const chosenStay = stays.find((s: any) => s.id === selectedId)
    if (!chosenStay) return

    const supabase = createClient()
    await supabase
      .from('trips')
      .update({
        plan_data: {
          ...trip.plan_data,
          confirmed_stay: chosenStay,
        },
        status: 'generating_itinerary',
      })
      .eq('id', trip.id)

    // Route to the Pick Places page (new step in flow)
    router.push(`/pick-places/${trip.id}`)
  }

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

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="w-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 pt-16 pb-14 px-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-white/5 rounded-full blur-2xl" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white mb-6 backdrop-blur-md">
            <Home className="h-4 w-4 mr-2" />
            Step 1 of 2 — Choose Your Basecamp
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Where will you stay in {trip?.destination}?
          </h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            Pick your base — we'll plan every day's activities starting from here.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mt-6 text-white/80 font-medium text-sm">
            <div className="flex items-center bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
              <MapPin className="h-4 w-4 mr-2" /> {trip?.destination}
            </div>
            <div className="flex items-center bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
              <Building2 className="h-4 w-4 mr-2" /> {trip?.duration_days} Days
            </div>
            <div className="flex items-center bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
              <Wallet className="h-4 w-4 mr-2" /> Budget ₹{Number(trip?.budget_range).toLocaleString("en-IN")}
            </div>
          </div>
        </div>
      </div>

      {/* Stay Cards Grid */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <p className="text-muted-foreground text-sm mb-8 text-center">
          {stays.length} options found · Click a card to select, then confirm below
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {stays.map((stay: any, idx: number) => {
            const isSelected = selectedId === stay.id
            const badgeClass = typeColors[stay.type] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"

            return (
              <motion.div
                key={stay.id || idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.07 }}
                onClick={() => setSelectedId(stay.id || String(idx))}
              >
                <Card
                  className={`relative cursor-pointer transition-all duration-300 overflow-hidden h-full
                    ${isSelected
                      ? "border-2 border-indigo-500 shadow-xl shadow-indigo-500/20 scale-[1.02]"
                      : "border hover:border-indigo-300 hover:shadow-lg hover:scale-[1.01]"
                    }`}
                >
                  {/* Coloured top accent bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${isSelected ? "bg-gradient-to-r from-indigo-500 to-purple-500" : "bg-muted"}`} />

                  {/* Selected checkmark */}
                  {isSelected && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle2 className="h-6 w-6 text-indigo-500 fill-indigo-100" />
                    </div>
                  )}

                  <CardContent className="p-5 pt-6">
                    {/* Type badge */}
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${badgeClass}`}>
                      {stay.type}
                    </span>

                    <h3 className="font-bold text-lg mt-3 leading-tight pr-6">{stay.name}</h3>

                    {stay.address && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" /> {stay.address}
                      </p>
                    )}

                    <div className="mt-2">
                      <StarRating rating={stay.rating} />
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                        {stay.price}
                      </span>
                    </div>

                    {stay.whyStay && (
                      <div className="mt-3 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 leading-relaxed border">
                        ✨ {stay.whyStay}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Confirm CTA */}
        <div className="mt-12 flex flex-col items-center gap-3">
          <Button
            size="lg"
            disabled={!selectedId || confirming}
            onClick={handleConfirmStay}
            className="rounded-full px-10 text-base font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 shadow-lg shadow-indigo-500/30 transition-all"
          >
            {confirming ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Building your itinerary...</>
            ) : (
              <><CheckCircle2 className="h-5 w-5 mr-2" /> Confirm Stay & Plan My Trip <ArrowRight className="h-4 w-4 ml-2" /></>
            )}
          </Button>
          {!selectedId && (
            <p className="text-sm text-muted-foreground">Select a stay above to continue</p>
          )}
        </div>
      </div>
    </div>
  )
}
