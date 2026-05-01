"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { MapPin, Calendar, Wallet, Building2, Coffee, Mountain, Compass, Utensils, Camera, ArrowLeft, Bus, Train, Navigation, Loader2, Star, Clock, Sparkles, Printer, Share2, Check, Music, Wine, MessageSquarePlus, Lock, ExternalLink, Briefcase, CheckCircle2, PenLine, Car, X, Shield, Plus, RefreshCcw, CloudRain, Lightbulb, UtensilsCrossed, Languages, ThumbsUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import PackingChecklist from "@/components/PackingChecklist"
import BudgetDrawer from "@/components/BudgetDrawer"
import EmergencyCard from "@/components/EmergencyCard"

import dynamic from "next/dynamic"

// Dynamically import the Map component to avoid SSR errors with Leaflet
const TripMap = dynamic(() => import("@/components/TripMap"), { 
  ssr: false,
  loading: () => <div className="w-full h-[400px] bg-muted/20 animate-pulse rounded-2xl flex items-center justify-center border border-dashed">Loading Interactive Map...</div>
})

const ChatDrawer = dynamic(() => import("@/components/ChatDrawer"), { ssr: false })
const MetroDrawer = dynamic(() => import("@/components/MetroDrawer"), { ssr: false })
const DailyWeather = dynamic(() => import("@/components/DailyWeather"), { ssr: false })
const HotelSearch = dynamic(() => import("@/components/HotelSearch"), { ssr: false })
const WeatherWidget = dynamic(() => import("@/components/WeatherWidget"), { ssr: false })
const ShareTripCard = dynamic(() => import("@/components/ShareTripCard"), { ssr: false })
const LanguageDrawer = dynamic(() => import("@/components/LanguageDrawer"), { ssr: false })
const LocalTipsDrawer = dynamic(() => import("@/components/LocalTipsDrawer"), { ssr: false })
const StreetFoodDrawer = dynamic(() => import("@/components/StreetFoodDrawer"), { ssr: false })

// Haversine distance in km between two lat/lng points
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

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

const generateAffiliateLink = (hotelName: string, destination: string, type: string) => {
  const query = encodeURIComponent(`${hotelName} ${destination}`)
  const aid = "INSERT_ID_LATER" // Replace with actual Booking.com Affiliate ID
  
  if (type.toLowerCase().includes("hostel")) {
    // Search Hostelworld for the city
    return `https://www.hostelworld.com/st/search/?q=${encodeURIComponent(destination)}`
  } else if (type.toLowerCase().includes("homestay")) {
    return `https://www.airbnb.com/s/${query}/homes`
  }
  
  // Default to Booking.com
  return `https://www.booking.com/searchresults.html?ss=${query}&aid=${aid}`
}

export default function TripPlanPage() {
  const params = useParams()
  const router = useRouter()
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [debriefTrip, setDebriefTrip] = useState<any | null>(null)
  const [trip, setTrip] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isModifying, setIsModifying] = useState(false)
  const [newDays, setNewDays] = useState(3)
  const [newBudget, setNewBudget] = useState(10000)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [showNightlife, setShowNightlife] = useState(false)
  const [nightlifeSpots, setNightlifeSpots] = useState<any[]>([])
  const [loadingNightlife, setLoadingNightlife] = useState(false)
  const [metroOpen, setMetroOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [packingOpen, setPackingOpen] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [sosOpen, setSosOpen] = useState(false)
  const [localTipsOpen, setLocalTipsOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [streetFoodOpen, setStreetFoodOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)
  const [journalModal, setJournalModal] = useState<{ dayIdx: number; actIdx: number } | null>(null)
  const [journalNote, setJournalNote] = useState("")
  const [journalSpend, setJournalSpend] = useState("")
  const [journalRating, setJournalRating] = useState(0)
  
  // Track which activities have been swapped for their indoor alternatives
  const [swappedActivities, setSwappedActivities] = useState<Record<string, boolean>>({})

  const toggleSwap = (dayIdx: number, actIdx: number) => {
    const key = `${dayIdx}-${actIdx}`
    setSwappedActivities(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Function to save rewritten plan from Chat Agent
  const handlePlanUpdate = async (newPlan: any) => {
    if (!trip?.id) return
    
    // Auto-unwrap if the AI wrapped the result in {"plan": {...}}
    const actualPlan = newPlan.days ? newPlan : (newPlan.plan || newPlan)

    // Fail gracefully if AI returned garbage
    if (!actualPlan.days || !Array.isArray(actualPlan.days)) {
      console.error("Malformed AI Response:", newPlan)
      alert("The AI encountered an error while rewriting the plan. Please try again.")
      return
    }

    // ✅ Fix: spread new itinerary directly at the top level of plan_data
    // preserving confirmed_stay and other metadata without burying days under a 'plan' key
    const updatedPlanData = {
      ...actualPlan,
      confirmed_stay: trip.plan_data?.confirmed_stay ?? undefined,
    }

    // Optimistically update UI
    setTrip({ ...trip, plan_data: updatedPlanData })
    
    // Save to Database
    const supabase = createClient()
    await supabase
      .from('trips')
      .update({ plan_data: updatedPlanData })
      .eq('id', trip.id)
  }

  const generatePDF = async () => {
    setIsGeneratingPDF(true)
    try {
      // Use html-to-image instead of html2canvas to handle modern CSS (like Tailwind v4 oklch/lab colors)
      const { toPng } = await import("html-to-image")
      const { jsPDF } = await import("jspdf")
      
      const element = document.getElementById("itinerary-content")
      if (!element) return

      // Temporarily hide elements that shouldn't be printed
      const ignoreElements = document.querySelectorAll('[data-html2canvas-ignore]')
      ignoreElements.forEach(el => (el as HTMLElement).style.display = 'none')

      const imgData = await toPng(element, {
        quality: 0.95,
        backgroundColor: '#ffffff',
        pixelRatio: 2, // High resolution
      })
      
      // Restore elements
      ignoreElements.forEach(el => (el as HTMLElement).style.display = '')
      
      const pdf = new jsPDF("p", "mm", "a4")
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (element.offsetHeight * pdfWidth) / element.offsetWidth
      
      let heightLeft = pdfHeight
      let position = 0

      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight)
      heightLeft -= pdf.internal.pageSize.getHeight()

      // Add new pages if content is taller than A4
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight
        pdf.addPage()
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight)
        heightLeft -= pdf.internal.pageSize.getHeight()
      }

      pdf.save(`${plan.destination}-itinerary.pdf`)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Failed to generate PDF. See console for details.")
    } finally {
      setIsGeneratingPDF(false)
    }
  }

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

  // Date & Weather Calculations
  let daysUntilTrip = -1
  let isWeatherLocked = false
  if (trip.start_date) {
    const start = new Date(trip.start_date)
    const today = new Date()
    today.setHours(0,0,0,0)
    daysUntilTrip = Math.floor((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntilTrip > 14) {
      isWeatherLocked = true
    }
  }

  return (
    <div id="itinerary-content" className="min-h-screen bg-background pb-20">

      {/* Hero Header Section */}
      <div className="w-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 pt-16 pb-14 px-6 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full blur-2xl"/>
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-white/5 rounded-full blur-2xl"/>

        <div className="absolute top-4 left-4 z-10" data-html2canvas-ignore>
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

        {/* Interactive Map View — hidden in print */}
        <div className="mb-12 no-print">
          <h2 className="text-xl font-bold mb-4 flex items-center text-primary">
            <MapPin className="h-5 w-5 mr-2" /> Interactive Route Map
          </h2>
          <TripMap plan={plan} />
        </div>

        {/* Live Weather Widget — hidden in print */}
        <div className="mb-10 no-print">
          <h2 className="text-xl font-bold mb-4 flex items-center text-primary">
            <span className="mr-2">🌤</span> Live Weather
          </h2>
          {(() => {
            const lat = plan.recommendedStays?.[0]?.lat || plan.days?.[0]?.activities?.[0]?.lat
            const lng = plan.recommendedStays?.[0]?.lng || plan.days?.[0]?.activities?.[0]?.lng
            return <WeatherWidget destination={plan.destination} lat={lat} lng={lng} />
          })()}
        </div>

        {/* Confirmed Basecamp Banner */}
        {plan.confirmed_stay && (
          <motion.div
            className="mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-xl font-bold mb-4 flex items-center text-primary">
              <Building2 className="h-5 w-5 mr-2" /> Your Confirmed Basecamp
            </h2>
            <Card className="relative overflow-hidden border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10 shadow-md">
              <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-b from-indigo-500 to-purple-600" />
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1 block">
                      ✅ Confirmed Stay · {plan.confirmed_stay.type}
                    </span>
                    <h3 className="font-bold text-xl leading-tight">{plan.confirmed_stay.name}</h3>
                    {plan.confirmed_stay.address && (
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {plan.confirmed_stay.address}
                      </p>
                    )}
                    {plan.confirmed_stay.rating && (
                      <div className="mt-2"><StarRating rating={plan.confirmed_stay.rating} /></div>
                    )}
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                    <span className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">
                      {plan.confirmed_stay.price}
                    </span>
                    <a
                      href={generateAffiliateLink(plan.confirmed_stay.name, plan.destination, plan.confirmed_stay.type)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                        Book Now <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </a>
                  </div>
                </div>
                {plan.confirmed_stay.whyStay && (
                  <p className="mt-3 text-sm text-muted-foreground bg-background/50 p-2.5 rounded-md border border-border/50">
                    ✨ {plan.confirmed_stay.whyStay}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Weather Locked Banner — hidden in print */}
        {isWeatherLocked && (
          <motion.div 
            className="mb-10 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left shadow-sm no-print"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mx-auto sm:mx-0">
              <Lock className="h-6 w-6 text-amber-600 dark:text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-700 dark:text-amber-500 mb-1">
                Live Forecast Locked 🔒
              </h3>
              <p className="text-sm text-foreground/80 leading-relaxed text-left">
                Meteorological data for your exact dates unlocks in <strong>{daysUntilTrip - 14} days</strong>. For now, we recommend packing based on typical seasonal averages for <strong>{plan.destination}</strong>.
              </p>
            </div>
          </motion.div>
        )}

        {/* Packing Checklist Generator */}
        <PackingChecklist destination={plan.destination} duration_days={trip.duration_days} plan={plan} />

        <div className="space-y-14">
          {(plan.days || []).map((day: any, idx: number) => {
            // Find coordinates to pass to the Weather API
            const destLat = plan.recommendedStays?.[0]?.lat || day.activities?.[0]?.lat
            const destLng = plan.recommendedStays?.[0]?.lng || day.activities?.[0]?.lng

            // Calculate real date from trip start_date
            let realDateStr = ""
            if (trip.start_date) {
              const d = new Date(trip.start_date)
              d.setDate(d.getDate() + idx)
              realDateStr = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
            }

            return (
            <div key={idx} className="relative">

              {/* Day Header - Sticky */}
              <div className="flex items-center mb-6 sticky top-4 z-10 bg-background/80 backdrop-blur-md py-3 px-4 rounded-xl shadow-sm border">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg mr-4 shrink-0 shadow-lg">
                  D{day.dayNumber}
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold">{day.theme}</h2>
                  {realDateStr && (
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      <Calendar className="h-3 w-3 inline mr-1" />{realDateStr}
                    </p>
                  )}
                </div>

                {/* Weather Forecast Badge */}
                {destLat && destLng && (
                  <DailyWeather lat={destLat} lng={destLng} dayOffset={idx} startDate={trip.start_date} />
                )}
              </div>

              {/* Timeline Container */}
              <div className="ml-6 border-l-2 border-primary/20 pl-8 space-y-8 py-2">

                {/* Activities Blocks */}
                {day.activities.map((activity: any, actIdx: number) => {
                  const ActivityIcon = IconMap[activity.icon] || MapPin
                  const categoryColor = CategoryColors[activity.category] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                  const isDone = activity.journalDone === true

                  // Transport estimator: calculate distance from previous activity
                  const prevActivity = actIdx > 0 ? day.activities[actIdx - 1] : null
                  let transportBlock = null
                  if (prevActivity && prevActivity.lat && prevActivity.lng && activity.lat && activity.lng) {
                    const distKm = haversineKm(prevActivity.lat, prevActivity.lng, activity.lat, activity.lng)
                    const cabFare = Math.round(distKm * 20 + 30)
                    const autoFare = Math.round(distKm * 13 + 25)
                    const walkMins = Math.round((distKm / 5) * 60)
                    const driveMins = Math.round((distKm / 30) * 60) + 5
                    transportBlock = (
                      <div className="my-4 mx-auto max-w-[340px] no-print">
                        <div className="flex items-center gap-2 mb-2 justify-center">
                          <div className="h-px flex-1 bg-border" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Getting There</span>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <a href={`https://m.uber.com/ul/?action=setPickup&client_id=&pickup=my_location&dropoff[latitude]=${activity.lat}&dropoff[longitude]=${activity.lng}&dropoff[nickname]=${encodeURIComponent(activity.name)}`} target="_blank" rel="noopener noreferrer" className="bg-blue-500/10 border border-blue-500/15 rounded-xl p-2.5 hover:bg-blue-500/20 transition-colors block">
                            <Car className="h-4 w-4 mx-auto text-blue-500 mb-1" />
                            <p className="text-sm font-black text-blue-600 dark:text-blue-400">₹{cabFare}</p>
                            <p className="text-[10px] text-muted-foreground">Book Cab</p>
                          </a>
                          <a href={`https://book.olacabs.com/`} target="_blank" rel="noopener noreferrer" className="bg-amber-500/10 border border-amber-500/15 rounded-xl p-2.5 hover:bg-amber-500/20 transition-colors block">
                            <Navigation className="h-4 w-4 mx-auto text-amber-500 mb-1" />
                            <p className="text-sm font-black text-amber-600 dark:text-amber-400">₹{autoFare}</p>
                            <p className="text-[10px] text-muted-foreground">Book Auto</p>
                          </a>
                          <div className="bg-emerald-500/10 border border-emerald-500/15 rounded-xl p-2.5">
                            <MapPin className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`}</p>
                            <p className="text-[10px] text-muted-foreground">{walkMins < 30 ? `🚶 ${walkMins}m walk` : 'Drive only'}</p>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={actIdx} className="relative">
                      {/* Transport Estimator between activities */}
                      {transportBlock}

                      {/* Timeline Dot */}
                      <div className={`absolute -left-[41px] top-1 h-5 w-5 rounded-full border-4 border-background shadow-sm ${isDone ? 'bg-emerald-500' : 'bg-primary'}`} />

                      <div className="mb-1.5 flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider bg-primary/10 px-2.5 py-1 rounded-md">
                          {activity.time}
                        </span>
                        {activity.category && (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${categoryColor}`}>
                            {activity.category}
                          </span>
                        )}
                        {isDone && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            ✓ Done
                          </span>
                        )}
                      </div>

                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.5 }}
                      >
                        {(() => {
                          const isSwapped = swappedActivities[`${idx}-${actIdx}`]
                          const displayActivity = isSwapped && activity.indoorAlternative ? activity.indoorAlternative : activity
                          
                          // Make sure indoorAlternative has necessary fields if swapped
                          if (isSwapped && !displayActivity.costEstimate) displayActivity.costEstimate = activity.costEstimate
                          if (isSwapped && !displayActivity.time) displayActivity.time = activity.time
                          
                          return (
                        <Card className={`mt-2 hover:shadow-xl transition-all duration-300 group border-muted ${isDone ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-800/30' : isSwapped ? 'bg-indigo-50/30 dark:bg-indigo-950/10 border-indigo-200/50 dark:border-indigo-800/30' : 'bg-card/50 hover:bg-card'}`}>
                          <CardContent className="p-4 sm:p-5">
                          <div className="flex gap-4">
                            <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center transition-colors hidden sm:flex ${isDone ? 'bg-emerald-500/10 text-emerald-500' : isSwapped ? 'bg-indigo-500/10 text-indigo-500' : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white'}`}>
                              {isDone ? <CheckCircle2 className="h-5 w-5" /> : isSwapped ? <Building2 className="h-5 w-5" /> : <ActivityIcon className="h-5 w-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <h3 className={`font-bold text-lg leading-tight ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                                  {displayActivity.name} {isSwapped && <span className="text-xs text-indigo-500 ml-1 font-semibold border border-indigo-200 bg-indigo-50 px-2 py-0.5 rounded-full relative -top-0.5">(Indoor Alternative)</span>}
                                </h3>
                                <div className="flex items-center gap-1.5">
                                  {activity.journalSpend && (
                                    <span className="text-xs font-bold whitespace-nowrap text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                                      Spent ₹{Number(activity.journalSpend).toLocaleString('en-IN')}
                                    </span>
                                  )}
                                  <span className="text-xs font-bold whitespace-nowrap text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                    {displayActivity.costEstimate}
                                  </span>
                                </div>
                              </div>

                              {/* Star Rating */}
                              {displayActivity.rating && (
                                <div className="mt-1.5">
                                  <StarRating rating={displayActivity.rating} />
                                </div>
                              )}

                              <p className="text-muted-foreground text-sm leading-relaxed mt-2">
                                {displayActivity.description}
                              </p>

                              {/* Journal Note Display */}
                              {activity.journalNote && (
                                <div className="mt-3 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-500/5 px-4 py-3 rounded-xl border border-amber-500/10">
                                  <PenLine className="h-4 w-4 mt-0.5 shrink-0" />
                                  <div>
                                    <p className="font-bold text-xs uppercase tracking-wider text-amber-500 mb-1">My Journal</p>
                                    <p className="font-medium italic">"{activity.journalNote}"</p>
                                    {activity.journalRating > 0 && (
                                      <div className="flex gap-0.5 mt-1.5">
                                        {[1,2,3,4,5].map(s => (
                                          <Star key={s} className={`h-3.5 w-3.5 ${s <= activity.journalRating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`} />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Why Visit Badge */}
                              {displayActivity.whyVisit && (
                                <div className="mt-3 flex items-start gap-1.5 text-xs text-primary/80 bg-primary/5 px-3 py-2 rounded-lg border border-primary/10">
                                  <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                  <span className="font-medium">{displayActivity.whyVisit}</span>
                                </div>
                              )}

                              {/* Signature Dish Badge */}
                              {displayActivity.signatureDish && (
                                <div className="mt-2 flex items-start gap-1.5 text-xs text-orange-600 dark:text-orange-400 bg-orange-500/5 px-3 py-2 rounded-lg border border-orange-500/10">
                                  <UtensilsCrossed className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                  <span className="font-medium"><strong>Must Try:</strong> {displayActivity.signatureDish}</span>
                                </div>
                              )}

                              {/* Pro Tip Badge */}
                              {displayActivity.proTip && (
                                <div className="mt-2 flex items-start gap-1.5 text-xs text-sky-600 dark:text-sky-400 bg-sky-500/5 px-3 py-2 rounded-lg border border-sky-500/10">
                                  <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                  <span className="font-medium"><strong>Pro Tip:</strong> {displayActivity.proTip}</span>
                                </div>
                              )}

                              {/* Nearest Metro Badge */}
                              {displayActivity.nearestMetro && displayActivity.nearestMetro.station && (
                                <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 px-3 py-2 rounded-lg border border-emerald-500/10">
                                  <Train className="h-3.5 w-3.5 shrink-0" />
                                  <span className="font-medium">
                                    🚇 {displayActivity.nearestMetro.station} ({displayActivity.nearestMetro.line}) · {displayActivity.nearestMetro.walkMins} min walk
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Swap Activity Button (If Indoor Alternative Exists) */}
                          {activity.indoorAlternative && !isDone && (
                            <div className="mt-4 pt-3 border-t border-dashed border-border/60 flex justify-end no-print">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => toggleSwap(idx, actIdx)}
                                className={`text-xs h-8 ${isSwapped ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800' : 'text-muted-foreground hover:text-foreground'}`}
                              >
                                {isSwapped ? (
                                  <><RefreshCcw className="h-3 w-3 mr-1.5" /> Revert to Original</>
                                ) : (
                                  <><CloudRain className="h-3 w-3 mr-1.5 text-sky-500" /> Raining? Swap for Indoor Activity</>
                                )}
                              </Button>
                            </div>
                          )}

                          {/* Journal Action Bar — Bold & Prominent */}
                          <div className="mt-4 pt-3 border-t border-dashed no-print">
                            <button
                              onClick={() => {
                                setJournalModal({ dayIdx: idx, actIdx })
                                setJournalNote(activity.journalNote || "")
                                setJournalSpend(activity.journalSpend || "")
                                setJournalRating(activity.journalRating || 0)
                              }}
                              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                                isDone
                                  ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 hover:from-emerald-500/20 hover:to-teal-500/20 border border-emerald-500/20'
                                  : 'bg-gradient-to-r from-violet-500/10 to-indigo-500/10 text-violet-600 dark:text-violet-400 hover:from-violet-500/20 hover:to-indigo-500/20 border border-violet-500/20'
                              }`}
                            >
                              {isDone ? (
                                <><CheckCircle2 className="h-4 w-4" /> View Journal Entry</>
                              ) : (
                                <><PenLine className="h-4 w-4" /> Log Experience & Spend</>
                              )}
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                      )
                      })()}
                      </motion.div>
                    </div>
                  )
                })}
              </div>
            </div>
          )})}
        </div>

        {/* Nightlife Toggle Section — hidden in print */}
        <div className="mt-14 no-print">
          <Button
            size="lg"
            variant={showNightlife ? "default" : "outline"}
            className={`rounded-full px-8 shadow-sm font-bold transition-all ${
              showNightlife
                ? "bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:opacity-90 text-white"
                : "border-fuchsia-300 text-fuchsia-600 hover:bg-fuchsia-50 dark:border-fuchsia-700 dark:text-fuchsia-400 dark:hover:bg-fuchsia-950"
            }`}
            onClick={async () => {
              if (showNightlife) {
                setShowNightlife(false)
                return
              }
              if (nightlifeSpots.length > 0) {
                setShowNightlife(true)
                return
              }
              setLoadingNightlife(true)
              try {
                const res = await fetch('/api/nightlife', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ destination: plan.destination })
                })
                const data = await res.json()
                setNightlifeSpots(data.spots || [])
                setShowNightlife(true)
              } catch (e) {
                console.error(e)
              }
              setLoadingNightlife(false)
            }}
          >
            {loadingNightlife ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Finding Nightlife...</>
            ) : showNightlife ? (
              <><Music className="h-4 w-4 mr-2" /> Hide Nightlife</>
            ) : (
              <><Wine className="h-4 w-4 mr-2" /> Show Bars & Nightlife 🎶</>
            )}
          </Button>

          {showNightlife && nightlifeSpots.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-5 flex items-center text-fuchsia-500">
                <Music className="h-5 w-5 mr-2" /> After Dark in {plan.destination}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {nightlifeSpots.map((spot: any, idx: number) => (
                  <Card key={idx} className="relative overflow-hidden border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/5 to-purple-500/5 dark:from-fuchsia-500/10 dark:to-purple-500/10 hover:shadow-lg transition-all group">
                    <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-b from-fuchsia-500 to-purple-600" />
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <div className="pr-2">
                          <span className="text-[10px] font-bold text-fuchsia-500 uppercase tracking-wider mb-1 block">
                            {spot.category} · {spot.bestFor}
                          </span>
                          <h3 className="font-bold text-lg leading-tight">{spot.name}</h3>
                        </div>
                        <span className="text-xs font-bold bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-700 dark:text-fuchsia-300 px-2.5 py-1 rounded-md border border-fuchsia-200 dark:border-fuchsia-800 whitespace-nowrap">
                          {spot.priceRange}
                        </span>
                      </div>
                      {spot.rating && (
                        <div className="mb-2"><StarRating rating={spot.rating} /></div>
                      )}
                      <p className="text-sm text-muted-foreground italic">"{spot.vibe}"</p>
                      {spot.timings && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {spot.timings}
                        </p>
                      )}
                      {spot.whyGo && (
                        <div className="mt-3 flex items-start gap-1.5 text-xs text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-500/5 px-3 py-2 rounded-lg border border-fuchsia-500/10">
                          <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span className="font-medium">{spot.whyGo}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Share Trip Card Generator */}
        <ShareTripCard plan={plan} trip={trip} />

        {/* Modifier Section — hidden in print */}
        {isModifying && (
          <div className="mt-12 mb-12 p-6 sm:p-8 bg-card rounded-2xl border-2 border-primary/20 shadow-xl relative overflow-hidden no-print">
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
            <Button variant="outline" size="lg" className="rounded-full px-8 shadow-sm border-primary/20 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950" onClick={() => setIsModifying(true)}>
              <RefreshCcw className="h-4 w-4 mr-2" /> Modify Trip
            </Button>
            <Button variant="outline" size="lg" className="rounded-full px-8 shadow-sm border-primary/20 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" /> Export
            </Button>
            <Button variant="outline" size="lg" className="rounded-full px-8 shadow-sm border-primary/20 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" onClick={() => router.push('/trip-input')}>
              <Plus className="h-4 w-4 mr-2" /> Plan New Trip
            </Button>
          </div>
        )}

        {/* =============================================
            PRINT-ONLY SECTION — only visible when printing
            ============================================= */}
        <div className="hidden print:block">
          {/* Clean hero for print */}
          <div className="print-hero">
            <h1>{plan.tripTitle}</h1>
            <div className="print-meta">
              <span>📍 {plan.destination}</span>
              <span>📅 {trip.duration_days} Days</span>
              <span>💰 {plan.estimatedCost}</span>
              {plan.bestTimeToVisit && <span>🌤 Best Time: {plan.bestTimeToVisit}</span>}
            </div>
            {plan.highlights && plan.highlights.length > 0 && (
              <p style={{ fontSize: "9pt", marginTop: "8px", color: "#6b7280" }}>
                Highlights: {plan.highlights.join(" · ")}
              </p>
            )}
          </div>

          {/* Recommended hotel */}
          {plan.recommendedStays && plan.recommendedStays.length > 0 && (
            <div style={{ marginBottom: "20px", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "6px" }}>
              <div style={{ fontSize: "8pt", fontWeight: 700, color: "#6366f1", textTransform: "uppercase" as const, marginBottom: "4px" }}>🏨 Recommended Stay</div>
              {plan.recommendedStays.slice(0, 2).map((stay: any, i: number) => (
                <div key={i} style={{ fontSize: "10pt", fontWeight: 600 }}>{stay.name} · {stay.type} · {stay.price} · ⭐ {stay.rating}</div>
              ))}
            </div>
          )}

          {/* Day-by-day itinerary */}
          {plan.days?.map((day: any) => (
            <div key={day.dayNumber} className="print-day">
              <div className="print-day-header">Day {day.dayNumber} — {day.theme}</div>
              {day.activities?.map((act: any, i: number) => (
                <div key={i} className="print-activity">
                  <div className="print-activity-time">{act.time}</div>
                  <div>
                    <div className="print-activity-name">
                      {act.name}
                      <span style={{ fontWeight: 400, fontSize: "8pt", color: "#6b7280" }}> ({act.category}) · ⭐ {act.rating} · {act.costEstimate}</span>
                    </div>
                    <div className="print-activity-desc">{act.description}</div>
                    {act.whyVisit && <div className="print-activity-desc" style={{ fontStyle: "italic" }}>✨ {act.whyVisit}</div>}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Print footer */}
          <div className="print-footer">
            Generated by AI Trip Planner · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>

      </div>

      {/* ═══ Expandable FAB Menu ═══ */}
      {fabOpen && (
        <div 
          className="fixed inset-0 z-[9996] print:hidden"
          onClick={() => setFabOpen(false)}
        />
      )}

      <div className="fixed bottom-6 right-6 z-[9997] print:hidden flex flex-col-reverse items-end gap-3">
        {/* Main Toggle Button */}
        <motion.button
          onClick={() => setFabOpen(!fabOpen)}
          animate={{ rotate: fabOpen ? 90 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-xl hover:shadow-2xl transition-shadow flex items-center justify-center gap-2 ${fabOpen ? 'w-14' : 'pl-5 pr-4'}`}
        >
          {fabOpen ? (
            <Plus className="h-7 w-7" />
          ) : (
            <span className="text-sm font-bold tracking-wide">Trip Tools</span>
          )}
        </motion.button>

        {/* Fan-out Buttons */}
        <AnimatePresence>
          {fabOpen && (
            <>
              {[
                { label: "SOS", icon: Shield, color: "from-red-500 to-rose-600", action: () => { setSosOpen(true); setFabOpen(false) } },
                { label: "Street Food", icon: UtensilsCrossed, color: "from-orange-500 to-red-500", action: () => { setStreetFoodOpen(true); setFabOpen(false) } },
                { label: "Local Tips", icon: ThumbsUp, color: "from-amber-500 to-orange-600", action: () => { setLocalTipsOpen(true); setFabOpen(false) } },
                { label: "Phrases", icon: Languages, color: "from-blue-500 to-indigo-600", action: () => { setLanguageOpen(true); setFabOpen(false) } },
                { label: "Budget", icon: Wallet, color: "from-emerald-500 to-teal-600", action: () => { setBudgetOpen(true); setFabOpen(false) } },
                { label: "Packing", icon: Briefcase, color: "from-sky-500 to-blue-600", action: () => { setPackingOpen(true); setFabOpen(false) } },
                { label: "Metro", icon: Train, color: "from-teal-500 to-cyan-600", action: () => { setMetroOpen(true); setFabOpen(false) } },
              ].map((item, i) => {
                const Icon = item.icon
                return (
                  <motion.button
                    key={item.label}
                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.8 }}
                    transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 20 }}
                    onClick={item.action}
                    className={`flex items-center gap-2.5 pl-4 pr-2 py-2 rounded-full bg-gradient-to-r ${item.color} text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all`}
                  >
                    <span className="text-xs font-bold whitespace-nowrap">{item.label}</span>
                    <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                      <Icon className="h-5 w-5" />
                    </div>
                  </motion.button>
                )
              })}
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Metro Drawer */}
      <MetroDrawer isOpen={metroOpen} onClose={() => setMetroOpen(false)} plan={plan} />

      {/* Chat Drawer */}
      <ChatDrawer 
        isOpen={chatOpen} 
        onClose={() => setChatOpen(false)} 
        plan={plan} 
        onPlanUpdate={handlePlanUpdate} 
      />

      {/* Packing Drawer */}
      <PackingChecklist 
        isOpen={packingOpen} 
        onClose={() => setPackingOpen(false)} 
        destination={plan.destination} 
        duration_days={trip.duration_days} 
        plan={plan} 
      />

      {/* Budget Drawer */}
      <BudgetDrawer 
        isOpen={budgetOpen} 
        onClose={() => setBudgetOpen(false)} 
        plan={plan} 
        onPlanUpdate={handlePlanUpdate} 
      />

      {/* Language Drawer */}
      <LanguageDrawer 
        isOpen={languageOpen} 
        onClose={() => setLanguageOpen(false)} 
        destination={plan.destination} 
      />

      {/* Local Tips Drawer */}
      <LocalTipsDrawer 
        isOpen={localTipsOpen} 
        onClose={() => setLocalTipsOpen(false)} 
        localTips={plan.localTips} 
      />

      {/* Street Food Drawer */}
      <StreetFoodDrawer 
        isOpen={streetFoodOpen} 
        onClose={() => setStreetFoodOpen(false)} 
        streetFood={plan.streetFood} 
      />

      {/* Emergency SOS Drawer */}
      <EmergencyCard 
        isOpen={sosOpen} 
        onClose={() => setSosOpen(false)} 
        destination={plan.destination} 
      />

      {/* Journal / Mark Done Modal */}
      {journalModal && (() => {
        const { dayIdx, actIdx } = journalModal
        const activity = plan.days?.[dayIdx]?.activities?.[actIdx]
        if (!activity) return null

        const handleSaveJournal = async () => {
          const updatedPlan = JSON.parse(JSON.stringify(plan))
          const act = updatedPlan.days[dayIdx].activities[actIdx]
          act.journalDone = true
          act.journalNote = journalNote
          act.journalSpend = journalSpend
          act.journalRating = journalRating
          
          await handlePlanUpdate(updatedPlan)
          setJournalModal(null)
        }

        const handleUndone = async () => {
          const updatedPlan = JSON.parse(JSON.stringify(plan))
          const act = updatedPlan.days[dayIdx].activities[actIdx]
          delete act.journalDone
          delete act.journalNote
          delete act.journalSpend
          delete act.journalRating
          
          await handlePlanUpdate(updatedPlan)
          setJournalModal(null)
        }

        return (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-[9998] backdrop-blur-sm no-print"
              onClick={() => setJournalModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[440px] bg-background rounded-2xl shadow-2xl border z-[9999] overflow-hidden no-print"
            >
              {/* Modal Header */}
              <div className="p-5 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">Trip Journal</h3>
                    <p className="text-sm text-muted-foreground">{activity.name}</p>
                  </div>
                  <button onClick={() => setJournalModal(null)} className="p-2 rounded-full hover:bg-muted transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4">
                {/* Actual Spend */}
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 block">Actual Spend (₹)</label>
                  <Input 
                    type="number" 
                    placeholder={`AI Est: ${activity.costEstimate || 'N/A'}`}
                    value={journalSpend}
                    onChange={(e) => setJournalSpend(e.target.value)}
                  />
                </div>

                {/* Personal Rating */}
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 block">Your Rating</label>
                  <div className="flex gap-1.5">
                    {[1,2,3,4,5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setJournalRating(star)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star className={`h-7 w-7 ${star <= journalRating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Journal Note */}
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 block">Memory / Notes</label>
                  <textarea
                    placeholder="How was it? Any memorable moment?"
                    value={journalNote}
                    onChange={(e) => setJournalNote(e.target.value)}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t bg-muted/10 flex gap-2">
                <Button className="flex-1 rounded-full" onClick={handleSaveJournal}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Mark as Done & Save
                </Button>
                {activity.journalDone && (
                  <Button variant="outline" className="rounded-full text-rose-500 hover:text-rose-600" onClick={handleUndone}>
                    Undo
                  </Button>
                )}
              </div>
            </motion.div>
          </>
        )
      })()}
    </div>
  )
}
