"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { MapPin, Calendar, Wallet, Building2, Coffee, Mountain, Compass, Utensils, Camera, ArrowLeft, Bus, Train, Navigation, Loader2, Star, Clock, Sparkles, Printer, Share2, Check } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import dynamic from "next/dynamic"

// Dynamically import the Map component to avoid SSR errors with Leaflet
const TripMap = dynamic(() => import("@/components/TripMap"), { 
  ssr: false,
  loading: () => <div className="w-full h-[400px] bg-muted/20 animate-pulse rounded-2xl flex items-center justify-center border border-dashed">Loading Interactive Map...</div>
})

// Map string icon names from AI to actual Lucide components
const IconMap: Record<string, any> = {
  Coffee, Mountain, MapPin, Compass, Utensils, Camera, Bus, Train, Navigation, Building2
}

// Category color mapping for vibrant badges
const CategoryColors: Record<string, string> = {
  "Cafe": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "Restaurant": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "Beach": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  "Temple": "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  "Museum": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "Market": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  "Trek": "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
  "Viewpoint": "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  "Club": "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
  "Heritage": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  "Park": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
}

function StarRating({ rating }: { rating?: number }) {
  if (!rating) return null
  const fullStars = Math.floor(rating)
  const hasHalf = rating % 1 >= 0.3

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < fullStars
              ? "fill-yellow-400 text-yellow-400"
              : i === fullStars && hasHalf
              ? "fill-yellow-400/50 text-yellow-400"
              : "text-muted-foreground/30"
          }`}
        />
      ))}
      <span className="text-xs font-semibold text-muted-foreground ml-1">{rating}</span>
    </div>
  )
}

export default function TripPlanPage() {
  const params = useParams()
  const router = useRouter()
  const [trip, setTrip] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isModifying, setIsModifying] = useState(false)
  const [newDays, setNewDays] = useState(3)
  const [newBudget, setNewBudget] = useState(10000)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    async function loadTrip() {
      if (!params || !params.tripId) return

      const supabase = createClient()
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', params.tripId)
        .single()

      if (data && data.plan_data) {
        setTrip(data)
        setNewDays(data.duration_days || 3)
        setNewBudget(parseInt(data.budget_range) || 10000)
      }
      setLoading(false)
    }
    loadTrip()
  }, [params])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  if (!trip || !trip.plan_data) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <h2 className="text-2xl font-bold">Trip not found</h2>
        <p className="text-muted-foreground">This itinerary may have failed to generate.</p>
        <Link href="/dashboard"><Button>Return to Dashboard</Button></Link>
      </div>
    )
  }

  const plan = trip.plan_data

  return (
    <div className="min-h-screen bg-background pb-20">

      {/* Hero Header Section */}
      <div className="w-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 pt-16 pb-14 px-6 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full blur-2xl"/>
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-white/5 rounded-full blur-2xl"/>

        <div className="absolute top-4 left-4 z-10">
          <Link href="/dashboard">
            <Button variant="outline" size="icon" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        <div className="max-w-4xl mx-auto flex flex-col items-center text-center mt-6 relative z-10">
          <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white mb-6 backdrop-blur-md">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Generated Plan
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            {plan.tripTitle}
          </h1>

          {/* Trip Meta Badges */}
          <div className="flex flex-wrap justify-center gap-3 text-white/90 font-medium mt-2">
            <div className="flex items-center bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
              <MapPin className="h-4 w-4 mr-2" /> {plan.destination}
            </div>
            <div className="flex items-center bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
              <Calendar className="h-4 w-4 mr-2" /> {trip.duration_days} Days
            </div>
            <div className="flex items-center bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
              <Wallet className="h-4 w-4 mr-2" /> {plan.estimatedCost}
            </div>
          </div>

          {/* Best Time to Visit */}
          {plan.bestTimeToVisit && (
            <p className="text-white/60 text-sm mt-4 flex items-center">
              <Clock className="h-3.5 w-3.5 mr-1.5" /> Best time to visit: {plan.bestTimeToVisit}
            </p>
          )}

          {/* Highlights Chips */}
          {plan.highlights && plan.highlights.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {plan.highlights.map((h: string, i: number) => (
                <span key={i} className="text-xs bg-white/10 text-white/80 px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm">
                  {h}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Vertical Timeline */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-10">

        {/* Interactive Map View */}
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-4 flex items-center text-primary">
            <MapPin className="h-5 w-5 mr-2" /> Interactive Route Map
          </h2>
          <TripMap plan={plan} />
        </div>

        {/* Global Stay Recommendation */}
        {plan.recommendedStays && plan.recommendedStays.length > 0 && (
          <motion.div 
            className="mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-xl font-bold mb-4 flex items-center text-primary">
              <Building2 className="h-5 w-5 mr-2" /> Recommended Basecamp
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {plan.recommendedStays.map((stay: any, idx: number) => (
                <Card key={idx} className="relative overflow-hidden border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 dark:from-blue-500/10 dark:to-indigo-500/10 shadow-sm border-2">
                  <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-b from-blue-500 to-indigo-500" />
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <div className="pr-2">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1 block">
                          Top Choice ({stay.type})
                        </span>
                        <h3 className="font-bold text-lg leading-tight">{stay.name}</h3>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-md border border-blue-200 dark:border-blue-800">
                          {stay.price}
                        </span>
                      </div>
                    </div>
                    {stay.rating && (
                      <div className="mb-3">
                        <StarRating rating={stay.rating} />
                      </div>
                    )}
                    {stay.whyStay && (
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed bg-background/50 p-2.5 rounded-md border border-border/50">
                        {stay.whyStay}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        <div className="space-y-14">
          {plan.days.map((day: any, idx: number) => (
            <div key={idx} className="relative">

              {/* Day Header - Sticky */}
              <div className="flex items-center mb-6 sticky top-4 z-10 bg-background/80 backdrop-blur-md py-3 px-4 rounded-xl shadow-sm border">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg mr-4 shrink-0 shadow-lg">
                  D{day.dayNumber}
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold">{day.theme}</h2>
                </div>
              </div>

              {/* Timeline Container */}
              <div className="ml-6 border-l-2 border-primary/20 pl-8 space-y-8 py-2">

                {/* Activities Blocks */}
                {day.activities.map((activity: any, actIdx: number) => {
                  const ActivityIcon = IconMap[activity.icon] || MapPin
                  const categoryColor = CategoryColors[activity.category] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"

                  return (
                    <div key={actIdx} className="relative">
                      {/* Timeline Dot */}
                      <div className="absolute -left-[41px] top-1 h-5 w-5 rounded-full border-4 border-background bg-primary shadow-sm" />

                      <div className="mb-1.5 flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider bg-primary/10 px-2.5 py-1 rounded-md">
                          {activity.time}
                        </span>
                        {activity.category && (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${categoryColor}`}>
                            {activity.category}
                          </span>
                        )}
                      </div>

                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.5 }}
                      >
                        <Card className="mt-2 hover:shadow-xl transition-all duration-300 group border-muted bg-card/50 hover:bg-card">
                          <CardContent className="p-4 sm:p-5">
                          <div className="flex gap-4">
                            <div className="h-11 w-11 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors hidden sm:flex">
                              <ActivityIcon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <h3 className="font-bold text-lg leading-tight">{activity.name}</h3>
                                <span className="text-xs font-bold whitespace-nowrap text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                  {activity.costEstimate}
                                </span>
                              </div>

                              {/* Star Rating */}
                              {activity.rating && (
                                <div className="mt-1.5">
                                  <StarRating rating={activity.rating} />
                                </div>
                              )}

                              <p className="text-muted-foreground text-sm leading-relaxed mt-2">
                                {activity.description}
                              </p>

                              {/* Why Visit Badge */}
                              {activity.whyVisit && (
                                <div className="mt-3 flex items-start gap-1.5 text-xs text-primary/80 bg-primary/5 px-3 py-2 rounded-lg border border-primary/10">
                                  <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                  <span className="font-medium">{activity.whyVisit}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      </motion.div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Modifier Section */}
        {isModifying && (
          <div className="mt-12 mb-12 p-6 sm:p-8 bg-card rounded-2xl border-2 border-primary/20 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-600 h-full"></div>
            <h3 className="text-xl sm:text-2xl font-bold mb-6 flex items-center"><Sparkles className="h-5 w-5 mr-2 text-primary"/> Modify & Regenerate Trip</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
              <div className="space-y-4">
                <label className="text-sm font-semibold flex justify-between">
                  <span>Duration</span>
                  <span className="text-primary font-bold">{newDays} Days</span>
                </label>
                <input type="range" min="1" max="14" value={newDays} onChange={(e) => setNewDays(parseInt(e.target.value))} className="w-full accent-primary h-2.5 bg-secondary rounded-lg appearance-none cursor-pointer" />
              </div>
              <div className="space-y-4">
                <label className="text-sm font-semibold flex justify-between">
                  <span>Total Budget</span>
                  <span className="text-primary font-bold">₹{newBudget.toLocaleString('en-IN')}</span>
                </label>
                <input type="range" min="3000" max="100000" step="1000" value={newBudget} onChange={(e) => setNewBudget(parseInt(e.target.value))} className="w-full accent-primary h-2.5 bg-secondary rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" onClick={async () => {
                setIsRegenerating(true);
                const supabase = createClient();
                await supabase.from('trips').update({ duration_days: newDays, budget_range: String(newBudget), status: 'generating', plan_data: null }).eq('id', params.tripId);
                router.push(`/generate/${params.tripId}`);
              }} disabled={isRegenerating} className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 font-bold">
                {isRegenerating ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : null}
                {isRegenerating ? "Rewriting History..." : "Apply & Regenerate Plan"}
              </Button>
              <Button size="lg" variant="outline" onClick={() => { setIsModifying(false); setNewDays(trip.duration_days); setNewBudget(parseInt(trip.budget_range)); }}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {!isModifying && (
          <div className="mt-16 flex flex-col sm:flex-row justify-center gap-4 pb-12">
            <Button 
              size="lg" 
              className="rounded-full px-8 bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 shadow-md w-full sm:w-auto font-bold"
              onClick={async () => {
                setSharing(true);
                const supabase = createClient();
                // We set is_public to true so anyone with the link can view it, even if RLS is on.
                await supabase.from('trips').update({ is_public: true }).eq('id', params.tripId);
                const url = window.location.href;
                await navigator.clipboard.writeText(url);
                setIsCopied(true);
                setSharing(false);
                setTimeout(() => setIsCopied(false), 3000);
              }}
            >
              {isCopied ? <Check className="h-4 w-4 mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
              {isCopied ? "Link Copied!" : "Share Trip"}
            </Button>
            <Button variant="outline" size="lg" className="rounded-full px-8 shadow-sm border-primary/20 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950" onClick={() => setIsModifying(true)}>
              Modify Trip
            </Button>
            <Button variant="outline" size="lg" className="rounded-full px-8 shadow-sm hidden md:flex" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" /> Export
            </Button>
            <Link href="/trip-input" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" className="rounded-full px-8 shadow-sm w-full">
                Plan New Trip
              </Button>
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
