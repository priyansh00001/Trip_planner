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

// Category styling - completely muted for Soft Luxury
const CategoryColors: Record<string, string> = {
  "Cafe": "border border-foreground/20 text-foreground/70",
  "Restaurant": "border border-foreground/20 text-foreground/70",
  "Beach": "border border-foreground/20 text-foreground/70",
  "Temple": "border border-foreground/20 text-foreground/70",
  "Museum": "border border-foreground/20 text-foreground/70",
  "Market": "border border-foreground/20 text-foreground/70",
  "Trek": "border border-foreground/20 text-foreground/70",
  "Viewpoint": "border border-foreground/20 text-foreground/70",
  "Club": "border border-foreground/20 text-foreground/70",
  "Heritage": "border border-foreground/20 text-foreground/70",
  "Park": "border border-foreground/20 text-foreground/70",
}

// Map of destinations to dynamic themes
const themeMapping: Record<string, string[]> = {
  ocean: ["goa", "maldives", "andaman", "lakshadweep", "phuket", "beach", "puducherry", "pondicherry", "varkala", "gokarna"],
  desert: ["jaipur", "jaisalmer", "jodhpur", "rajasthan", "dubai", "leh", "ladakh", "bikaner", "pushkar"],
  forest: ["kerala", "munnar", "wayanad", "coorg", "ooty", "manali", "shimla", "srinagar", "darjeeling", "meghalaya", "assam", "bali"],
  heritage: ["delhi", "agra", "varanasi", "kolkata", "amritsar", "madurai", "mysore", "hampi", "khajuraho", "lucknow"]
}

function getDestinationTheme(destination: string) {
  if (!destination) return "default"
  const dest = destination.toLowerCase()
  for (const [theme, keywords] of Object.entries(themeMapping)) {
    if (keywords.some(keyword => dest.includes(keyword))) {
      return theme
    }
  }
  return "default"
}

// Map of popular destinations to gorgeous reliable images (Wikimedia Commons / Unsplash known good)
const destinationImages: Record<string, string> = {
  mumbai: 'https://images.pexels.com/photos/2260800/pexels-photo-2260800.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', // Mumbai Skyline / Gateway
  delhi: 'https://images.pexels.com/photos/35255277/pexels-photo-35255277.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&dpr=2', // India Gate, New Delhi (verified)
  goa: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=80&w=2000&auto=format&fit=crop', // Goa Beach
  jaipur: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?q=80&w=2000&auto=format&fit=crop', // Jaipur Hawa Mahal
  agra: 'https://images.pexels.com/photos/164336/pexels-photo-164336.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', // Taj Mahal
  kerala: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?q=80&w=2000&auto=format&fit=crop', // Kerala Backwaters
  varanasi: 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?q=80&w=2000&auto=format&fit=crop', // Varanasi
  udaipur: 'https://images.unsplash.com/photo-1593010452654-e4f62edc4b69?q=80&w=2000&auto=format&fit=crop', // Udaipur
  bangalore: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?q=80&w=2000&auto=format&fit=crop', // Bangalore
  default: 'https://images.unsplash.com/photo-1598890777032-bde835ba27c2?q=80&w=2000&auto=format&fit=crop' // Known good Unsplash fallback (Japanese Torii)
}

function getHeroImage(destination: string) {
  if (!destination) return destinationImages.default
  const dest = destination.toLowerCase()
  for (const [key, url] of Object.entries(destinationImages)) {
    if (dest.includes(key)) return url
  }
  return destinationImages.default
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

  const supabase = createClient()

  // Fetch trip data
  useEffect(() => {
    async function fetchTrip() {
      if (!params.tripId) return

      try {
        const { data, error } = await supabase
          .from("trips")
          .select("*")
          .eq("id", params.tripId)
          .single()

        if (error) throw error
        setTrip(data)
        setNewDays(data.duration_days || 3)
        setNewBudget(parseInt(data.budget_range) || 10000)
      } catch (err) {
        console.error("Error fetching trip:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchTrip()
  }, [params.tripId, supabase])

  // Inject Dynamic Theme
  useEffect(() => {
    if (trip?.plan_data?.destination) {
      const theme = getDestinationTheme(trip.plan_data.destination)
      if (theme !== "default") {
        document.documentElement.setAttribute('data-theme', theme)
      }
      return () => document.documentElement.removeAttribute('data-theme')
    }
  }, [trip?.plan_data?.destination])

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

      {/* Cinematic Fade Hero Section */}
      <div className="w-full relative overflow-hidden pt-32 pb-40 px-6">
        <div 
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: `url('${getHeroImage(plan.destination)}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed', // Parallax effect
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
          }}
        />

        <div className="absolute top-6 left-6 z-10" data-html2canvas-ignore>
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="text-foreground hover:bg-black/5 rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        <div className="max-w-4xl mx-auto flex flex-col items-center text-center relative z-10 mt-8">
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-[10px] sm:text-xs font-bold tracking-[0.4em] uppercase text-foreground mb-8 border-b border-foreground/30 pb-3"
          >
            Curated Journey
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-6xl sm:text-7xl md:text-8xl font-serif text-foreground mb-10 tracking-tighter drop-shadow-sm"
          >
            {plan.tripTitle}
          </motion.h1>

          {/* Trip Meta Badges */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="flex flex-wrap justify-center gap-10 text-foreground font-serif text-sm tracking-wider"
          >
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-2 opacity-50" /> {plan.destination}
            </div>
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-2 opacity-50" /> {trip.duration_days} Days
            </div>
            <div className="flex items-center">
              <Wallet className="h-4 w-4 mr-2 opacity-50" /> {plan.estimatedCost}
            </div>
          </motion.div>

          {/* Best Time to Visit */}
          {plan.bestTimeToVisit && (
            <p className="text-muted-foreground text-xs mt-6 flex items-center font-serif italic">
              <Clock className="h-3 w-3 mr-1.5" /> Best time to visit: {plan.bestTimeToVisit}
            </p>
          )}

          {/* Highlights Chips */}
          {plan.highlights && plan.highlights.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 mt-10">
              {plan.highlights.map((h: string, i: number) => (
                <span key={i} className="text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-2 border border-border bg-transparent">
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
        <div className="mb-16 no-print">
          <h2 className="text-xl font-serif mb-6 flex items-center text-foreground">
             Interactive Route Map
          </h2>
          <TripMap plan={plan} />
        </div>

        {/* Live Weather Widget — hidden in print */}
        <div className="mb-16 no-print">
          <h2 className="text-xl font-serif mb-6 flex items-center text-foreground">
             Live Weather
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
            <h2 className="text-xl font-serif mb-6 flex items-center text-foreground">
              Your Confirmed Basecamp
            </h2>
            <Card className="relative overflow-hidden rounded-none border border-border bg-transparent shadow-none">
              <div className="absolute top-0 bottom-0 left-0 w-1 bg-primary/20" />
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <span className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2 block">
                      Confirmed Stay · {plan.confirmed_stay.type}
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
                  <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
                    <span className="text-xl font-serif text-foreground">
                      {plan.confirmed_stay.price}
                    </span>
                    <a
                      href={generateAffiliateLink(plan.confirmed_stay.name, plan.destination, plan.confirmed_stay.type)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm" className="rounded-none border-foreground hover:bg-foreground hover:text-background transition-colors text-xs tracking-widest uppercase">
                        Book Now
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

        {isWeatherLocked && (
          <motion.div 
            className="mb-12 p-6 border-b border-border flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left no-print"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="h-10 w-10 flex items-center justify-center shrink-0 mx-auto sm:mx-0 opacity-50">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm tracking-widest uppercase text-foreground mb-2">
                Live Forecast Locked
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed text-left">
                Meteorological data for your exact dates unlocks in <strong>{daysUntilTrip - 14} days</strong>. We recommend packing based on typical seasonal averages for <strong>{plan.destination}</strong>.
              </p>
            </div>
          </motion.div>
        )}

        {/* Packing Checklist Generator - Moved to Trip Tools Drawer */}

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

              {/* Massive Background Number */}
              <div className="absolute -top-16 -left-8 md:-left-16 text-[12rem] md:text-[16rem] font-serif text-foreground opacity-[0.03] leading-none pointer-events-none select-none z-0">
                {day.dayNumber}
              </div>

              {/* Day Header - Static */}
              <div className="flex items-end justify-between mb-12 py-6 px-4 border-b border-[var(--gold)]/30 relative z-10">
                <div className="flex items-baseline relative z-10">
                  <div>
                    <span className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-bold mb-2 block">
                      Day {day.dayNumber}
                    </span>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif tracking-tight text-foreground">{day.theme}</h2>
                    {realDateStr && (
                      <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mt-3 italic font-serif">
                        {realDateStr}
                      </p>
                    )}
                  </div>
                </div>

                {/* Weather Forecast Badge */}
                {destLat && destLng && (
                  <div className="opacity-70 scale-90 origin-right">
                    <DailyWeather lat={destLat} lng={destLng} dayOffset={idx} startDate={trip.start_date} />
                  </div>
                )}
              </div>

              {/* Timeline Container */}
              <div className="ml-2 sm:ml-8 space-y-4 py-2">

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
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <a href={`https://m.uber.com/ul/?action=setPickup&client_id=&pickup=my_location&dropoff[latitude]=${activity.lat}&dropoff[longitude]=${activity.lng}&dropoff[nickname]=${encodeURIComponent(activity.name)}`} target="_blank" rel="noopener noreferrer" className="border border-border/50 bg-transparent rounded-none p-3 hover:bg-black/5 transition-colors block">
                            <Car className="h-4 w-4 mx-auto text-foreground/60 mb-2" />
                            <p className="text-sm font-serif text-foreground">₹{cabFare}</p>
                            <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">Book Cab</p>
                          </a>
                          <a href={`https://book.olacabs.com/`} target="_blank" rel="noopener noreferrer" className="border border-border/50 bg-transparent rounded-none p-3 hover:bg-black/5 transition-colors block">
                            <Navigation className="h-4 w-4 mx-auto text-foreground/60 mb-2" />
                            <p className="text-sm font-serif text-foreground">₹{autoFare}</p>
                            <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">Book Auto</p>
                          </a>
                          <div className="border border-border/50 bg-transparent rounded-none p-3">
                            <MapPin className="h-4 w-4 mx-auto text-foreground/60 mb-2" />
                            <p className="text-sm font-serif text-foreground">{distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`}</p>
                            <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">{walkMins < 30 ? `${walkMins}m walk` : 'Drive only'}</p>
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
                      <div className={`absolute -left-[41px] top-1 h-5 w-5 rounded-full border-4 border-background shadow-sm ${isDone ? 'bg-emerald-500' : 'bg-[var(--gold)]'}`} />

                      <div className="mb-4 flex items-center gap-3 flex-wrap">
                        <span className="text-[10px] font-medium text-foreground uppercase tracking-[0.2em] border-b border-foreground/20 pb-0.5">
                          {activity.time}
                        </span>
                        {activity.category && (
                          <span className={`text-[9px] uppercase tracking-widest px-3 py-1 bg-transparent ${categoryColor}`}>
                            {activity.category}
                          </span>
                        )}
                        {isDone && (
                          <span className="text-[9px] uppercase tracking-widest px-3 py-1 border border-foreground/30 text-foreground/50">
                            ✓ Completed
                          </span>
                        )}
                      </div>

                      <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.98 }}
                        whileInView={{ opacity: 1, y: 0, scale: 1 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.8, delay: actIdx * 0.12, ease: [0.22, 1, 0.36, 1] }}
                        className="relative z-10"
                      >
                        {(() => {
                          const isSwapped = swappedActivities[`${idx}-${actIdx}`]
                          const displayActivity = isSwapped && activity.indoorAlternative ? activity.indoorAlternative : activity
                          
                          // Make sure indoorAlternative has necessary fields if swapped
                          if (isSwapped && !displayActivity.costEstimate) displayActivity.costEstimate = activity.costEstimate
                          if (isSwapped && !displayActivity.time) displayActivity.time = activity.time
                          
                          return (
                        <Card className={`mt-8 rounded-3xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all duration-700 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgb(0,0,0,0.4)] hover:-translate-y-1 overflow-hidden relative ${isDone ? 'opacity-40' : ''}`}>
                          <div className="absolute inset-0 bg-gradient-to-br from-white/40 dark:from-white/5 to-transparent pointer-events-none" />
                          <CardContent className="p-8 sm:p-10 relative z-10">
                          <div className="flex gap-4">
                            <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center transition-colors hidden sm:flex ${isDone ? 'bg-emerald-500/10 text-emerald-500' : isSwapped ? 'bg-indigo-500/10 text-indigo-500' : 'bg-[var(--gold)]/10 text-[var(--gold)] group-hover:bg-[var(--gold)] group-hover:text-white'}`}>
                              {isDone ? <CheckCircle2 className="h-5 w-5" /> : isSwapped ? <Building2 className="h-5 w-5" /> : <ActivityIcon className="h-5 w-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-4">
                                <h3 className={`font-serif text-2xl leading-tight text-foreground ${isDone ? 'opacity-40 line-through' : ''}`}>
                                  {displayActivity.name} {isSwapped && <span className="text-[10px] uppercase tracking-widest text-foreground/50 ml-2 font-sans">(Indoor Alternative)</span>}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                  {activity.journalSpend && (
                                    <span className="text-[10px] uppercase tracking-widest text-foreground/70 border border-foreground/20 px-3 py-1">
                                      Spent ₹{Number(activity.journalSpend).toLocaleString('en-IN')}
                                    </span>
                                  )}
                                  <span className="text-[10px] uppercase tracking-widest text-foreground/70 border border-foreground/20 px-3 py-1">
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

                              {displayActivity.whyVisit && (
                                <p className="mt-6 text-sm text-foreground/80 leading-relaxed italic border-l border-[var(--gold)]/40 pl-5 font-serif">
                                  "{displayActivity.whyVisit}"
                                </p>
                              )}

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
                                <div className="mt-3 flex items-start gap-2 text-[10px] sm:text-xs text-foreground/80 bg-transparent px-4 py-3 border border-foreground/10 uppercase tracking-widest font-medium">
                                  <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-[var(--gold)]" />
                                  <span>{displayActivity.whyVisit}</span>
                                </div>
                              )}

                              {/* Signature Dish Badge */}
                              {displayActivity.signatureDish && (
                                <div className="mt-2 flex items-start gap-1.5 text-xs text-foreground/60 bg-foreground/5 px-3 py-2 rounded-lg border border-foreground/10">
                                  <UtensilsCrossed className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                  <span className="font-medium"><strong>Must Try:</strong> {displayActivity.signatureDish}</span>
                                </div>
                              )}

                              {/* Pro Tip Display */}
                              {displayActivity.proTip && (
                                <div className="mt-4 flex items-start gap-2 bg-transparent border-t border-[var(--gold)]/20 pt-4">
                                  <Lightbulb className="h-4 w-4 text-[var(--gold)] mt-0.5 shrink-0" />
                                  <p className="text-[10px] sm:text-xs text-foreground/80 font-medium uppercase tracking-wider">
                                    Pro Tip: <span className="text-muted-foreground normal-case tracking-normal">{displayActivity.proTip}</span>
                                  </p>
                                </div>
                              )}

                              {/* Nearest Metro Badge */}
                              {displayActivity.nearestMetro && displayActivity.nearestMetro.station && (
                                <div className="mt-2 flex items-center gap-1.5 text-xs text-foreground/60 bg-foreground/5 px-3 py-2 rounded-lg border border-foreground/10">
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
                            <div className="mt-4 pt-4 flex justify-end no-print">
                              <button 
                                onClick={() => toggleSwap(`${idx}-${actIdx}`)}
                                className={`flex items-center gap-2 text-[10px] uppercase tracking-widest font-medium px-4 py-2 border transition-all ${
                                  isSwapped 
                                    ? 'bg-transparent text-foreground border-foreground/30 hover:bg-foreground/5' 
                                    : 'bg-transparent text-foreground/70 border-foreground/20 hover:border-foreground/40 hover:text-foreground'
                                }`}
                              >
                                {isSwapped ? (
                                  <>
                                    <Sun className="h-3 w-3" /> Swap back to Outdoor
                                  </>
                                ) : (
                                  <>
                                    <CloudRain className="h-3 w-3 text-[var(--gold)]" /> Raining? Swap for Indoor Activity
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          {/* Journal Action Bar — Bold & Prominent */}
                          <div className="mt-6 pt-4 border-t border-border/30 no-print">
                            <button
                              onClick={() => {
                                setJournalModal({ dayIdx: idx, actIdx })
                                setJournalNote(activity.journalNote || "")
                                setJournalSpend(activity.journalSpend || "")
                                setJournalRating(activity.journalRating || 0)
                              }}
                              className={`w-full flex items-center justify-center gap-2 py-3 rounded-none font-medium text-xs tracking-widest uppercase transition-all ${
                                isDone
                                  ? 'text-muted-foreground hover:text-foreground border border-border/50'
                                  : 'text-foreground border border-foreground hover:bg-foreground hover:text-background'
                              }`}
                            >
                              {isDone ? (
                                <><CheckCircle2 className="h-3.5 w-3.5" /> Entry Saved</>
                              ) : (
                                <><PenLine className="h-3.5 w-3.5" /> Log Experience</>
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
        <div className="mt-20 mb-8 no-print flex justify-center">
          <button
            className={`flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] font-medium px-8 py-4 border transition-all ${
              showNightlife ? "bg-foreground/5 border-foreground/30 text-foreground" : "border-[var(--gold)]/40 bg-transparent hover:bg-[var(--gold)]/5 text-foreground"
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
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Curating Nightlife...</>
            ) : showNightlife ? (
              <>Hide Nightlife</>
            ) : (
              <>Explore Nightlife</>
            )}
          </button>

          {showNightlife && nightlifeSpots.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-serif mb-8 text-foreground text-center">
                After Dark
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {nightlifeSpots.map((spot: any, idx: number) => (
                  <Card key={idx} className="rounded-none border-x-0 border-t-0 border-b border-border/40 bg-transparent shadow-none hover:bg-black/[0.02] transition-colors">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="pr-4">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2 block">
                            {spot.category}
                          </span>
                          <h3 className="font-serif text-xl leading-tight text-foreground">{spot.name}</h3>
                        </div>
                        <span className="text-xs font-serif text-foreground/70">
                          {spot.priceRange}
                        </span>
                      </div>
                      {spot.rating && (
                        <div className="mb-4 opacity-70"><StarRating rating={spot.rating} /></div>
                      )}
                      <p className="text-sm text-muted-foreground leading-relaxed italic border-l border-border/50 pl-4 mb-4">"{spot.vibe}"</p>
                      {spot.timings && (
                        <p className="text-xs text-muted-foreground mt-2 font-serif">
                          {spot.timings}
                        </p>
                      )}
                      {spot.whyGo && (
                        <div className="mt-4 flex items-start gap-2 bg-transparent border-t border-[var(--gold)]/20 pt-4 text-[10px] sm:text-xs text-foreground/80 font-medium uppercase tracking-widest">
                          <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-[var(--gold)]" />
                          <span className="normal-case tracking-normal">{spot.whyGo}</span>
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
          <div className="mt-20 flex flex-col sm:flex-row justify-center gap-6 pb-24 border-t border-border/30 pt-16">
            <Button variant="ghost" size="lg" className="rounded-none border-b border-transparent hover:border-foreground text-foreground uppercase tracking-widest text-xs px-0 hover:bg-transparent" onClick={() => setIsModifying(true)}>
              Modify Trip
            </Button>
            <Button variant="ghost" size="lg" className="rounded-none border-b border-transparent hover:border-foreground text-foreground uppercase tracking-widest text-xs px-0 hover:bg-transparent" onClick={() => window.print()}>
              Export Itinerary
            </Button>
            <Button variant="outline" size="lg" className="rounded-none border-foreground text-foreground hover:bg-foreground hover:text-background uppercase tracking-widest text-xs px-8" onClick={() => router.push('/trip-input')}>
              Plan New Trip
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

      <div className="fixed bottom-6 right-6 z-[9997] print:hidden flex flex-col-reverse items-end gap-2">
        {/* Main Toggle Button */}
        <motion.button
          onClick={() => setFabOpen(!fabOpen)}
          animate={{ rotate: fabOpen ? 90 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`h-14 rounded-none border border-foreground bg-background text-foreground hover:bg-foreground hover:text-background shadow-none transition-colors flex items-center justify-center gap-3 tracking-widest uppercase text-[10px] ${fabOpen ? 'w-14' : 'px-6'}`}
        >
          {fabOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <span className="font-medium">Trip Tools</span>
          )}
        </motion.button>

        {/* Fan-out Buttons */}
        <AnimatePresence>
          {fabOpen && (
            <div className="flex flex-col gap-1 items-end bg-background/95 backdrop-blur-md border border-border p-2 mb-2 shadow-2xl">
              {[
                { label: "SOS", icon: Shield, action: () => { setSosOpen(true); setFabOpen(false) } },
                { label: "Street Food", icon: UtensilsCrossed, action: () => { setStreetFoodOpen(true); setFabOpen(false) } },
                { label: "Local Tips", icon: ThumbsUp, action: () => { setLocalTipsOpen(true); setFabOpen(false) } },
                { label: "Phrases", icon: Languages, action: () => { setLanguageOpen(true); setFabOpen(false) } },
                { label: "Budget", icon: Wallet, action: () => { setBudgetOpen(true); setFabOpen(false) } },
                { label: "Packing", icon: Briefcase, action: () => { setPackingOpen(true); setFabOpen(false) } },
                { label: "AI Chat", icon: MessageSquarePlus, action: () => { setChatOpen(true); setFabOpen(false) } },
                { label: "Metro", icon: Train, action: () => { setMetroOpen(true); setFabOpen(false) } },
              ].map((item, i) => {
                const Icon = item.icon
                return (
                  <motion.button
                    key={item.label}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={item.action}
                    className={`flex items-center gap-4 px-4 py-3 border-b border-border/40 text-foreground hover:bg-foreground hover:text-background transition-all w-48 justify-end last:border-0`}
                  >
                    <span className="text-[10px] font-medium uppercase tracking-widest">{item.label}</span>
                    <Icon className="h-4 w-4" />
                  </motion.button>
                )
              })}
            </div>
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
        destination={plan.destination}
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
