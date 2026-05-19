"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plane, Train, Bus, Car, Loader2, AlertCircle,
  Check, ArrowRight, ArrowLeft, RefreshCw
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { TripProgressBar } from "@/components/TripProgressBar"
import Link from "next/link"

type TransportOption = {
  mode: string
  operator: string
  price_min_inr: number
  price_max_inr: number
  duration_minutes: number
  departure_times?: string[]
  frequency?: string
  booking_url?: string
  source?: string
  scraped_at?: string
}

type TransportData = {
  origin: string
  destination: string
  scraping_in_progress: boolean
  options: {
    flight: TransportOption[]
    train: TransportOption[]
    bus: TransportOption[]
    cab: TransportOption[]
  }
}

const tabItems = [
  { id: "flight", label: "Flights", icon: Plane },
  { id: "train", label: "Trains", icon: Train },
  { id: "bus", label: "Buses", icon: Bus },
  { id: "cab", label: "Cabs", icon: Car },
]

export default function SelectTransportPage() {
  const router = useRouter()
  const params = useParams()

  const [trip, setTrip] = useState<any>(null)
  const [transportData, setTransportData] = useState<TransportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [activeTab, setActiveTab] = useState<string>("flight")
  const [selectedOption, setSelectedOption] = useState<TransportOption | null>(null)
  const [confirming, setConfirming] = useState(false)

  // 1. Load Trip Parameters (Supabase or LocalStorage)
  useEffect(() => {
    async function loadTrip() {
      if (!params?.tripId) return

      try {
        if (params.tripId === "anonymous") {
          const stored = localStorage.getItem("anonymous_trip")
          if (!stored) { router.push("/trip-input"); return }
          const data = JSON.parse(stored)
          setTrip(data)
          fetchTransport(data.originCity || "Delhi", data.destination)
        } else {
          const supabase = createClient()
          const { data, error } = await supabase
            .from('trips').select('*').eq('id', params.tripId).single()

          if (error || !data) {
            setError("Could not load trip details.")
            setLoading(false)
            return
          }
          setTrip(data)
          fetchTransport(data.origin_city || "Delhi", data.destination)
        }
      } catch (err: any) {
        setError(err.message)
        setLoading(false)
      }
    }
    loadTrip()
  }, [params, router])

  // 2. Fetch Transport options from API
  async function fetchTransport(origin: string, destination: string) {
    try {
      const res = await fetch(`/api/transport?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`)
      if (!res.ok) throw new Error("Failed to fetch transport options")
      const data: TransportData = await res.json()
      
      setTransportData(data)
      setLoading(false)

      // Auto select flight tab if it has options, otherwise try others
      const modes = ["flight", "train", "bus", "cab"] as const
      const activeMode = modes.find(m => data.options[m]?.length > 0) || "flight"
      setActiveTab(activeMode)

      // Handle active scrape background polling
      if (data.scraping_in_progress) {
        setPolling(true)
      } else {
        setPolling(false)
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  // Polling logic when scraping is in progress
  useEffect(() => {
    if (!polling || !trip) return

    const interval = setInterval(async () => {
      try {
        const origin = trip.originCity || trip.origin_city || "Delhi"
        const res = await fetch(`/api/transport?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(trip.destination)}`)
        if (res.ok) {
          const data: TransportData = await res.json()
          setTransportData(data)
          if (!data.scraping_in_progress) {
            setPolling(false)
          }
        }
      } catch (err) {
        console.error("Polling error:", err)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [polling, trip])

  const handleConfirmTransport = async () => {
    if (!selectedOption || !trip) return
    setConfirming(true)

    const transportCost = selectedOption.price_min_inr
    const totalBudget = Number(trip.budget_range || trip.budget || 10000)
    const remainingBudget = totalBudget - (transportCost * 2)

    if (params?.tripId === "anonymous") {
      localStorage.setItem("anonymous_trip", JSON.stringify({
        ...trip,
        selected_transport: selectedOption,
        transport_cost_inr: transportCost,
        remaining_budget_inr: remainingBudget,
        status: 'generating_stays'
      }))
      router.push(`/generate-stays/anonymous`)
    } else {
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from('trips')
        .update({
          selected_transport: selectedOption,
          transport_cost_inr: transportCost,
          remaining_budget_inr: remainingBudget,
          status: 'generating_stays'
        })
        .eq('id', trip.id)
      
      if (updateError) {
        setError("Failed to save selected transport options.")
        setConfirming(false)
        return
      }
      router.push(`/generate-stays/${trip.id}`)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--gold)] mx-auto mb-4" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Finding transit options...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="max-w-md text-center p-10 border border-border/50 bg-card">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-4" />
          <h2 className="font-serif text-2xl mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => router.push('/trip-input')}
            className="text-[10px] uppercase tracking-[0.2em] font-bold px-6 py-3 bg-foreground text-background hover:bg-foreground/90 transition-all cursor-pointer"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // Budget computations
  const totalBudget = Number(trip?.budget_range || trip?.budget || 10000)
  const roundTripCost = selectedOption ? selectedOption.price_min_inr * 2 : 0
  const remainingBudget = totalBudget - roundTripCost
  const transportPercent = Math.min((roundTripCost / totalBudget) * 100, 100)

  const activeOptions = transportData ? transportData.options[activeTab as keyof typeof transportData.options] || [] : []

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <TripProgressBar currentStep={1} />

      {/* Header */}
      <div className="border-b border-border/50 py-12 px-6 bg-card/10">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--gold)] font-medium mb-3">
            Step 1 of 4 — Route Planning
          </p>
          <h1 className="font-serif text-4xl md:text-5xl tracking-tight mb-4">
            How will you reach <span className="italic">{trip?.destination}</span>?
          </h1>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            Compare travel modes from {trip?.originCity || trip?.origin_city || "Delhi"} to {trip?.destination}.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mt-6 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            <span className="px-4 py-2 border border-border/50 rounded-full bg-card/30 backdrop-blur-sm">From: {trip?.originCity || trip?.origin_city || "Delhi"}</span>
            <span className="px-4 py-2 border border-border/50 rounded-full bg-card/30 backdrop-blur-sm">To: {trip?.destination}</span>
            <span className="px-4 py-2 border border-border/50 rounded-full bg-card/30 backdrop-blur-sm">Trip Budget: ₹{totalBudget.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>

      {/* Interactive Budget Allocation Bar */}
      <div className="border-b border-border/40 py-6 px-6 bg-card/20 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.2em] font-semibold mb-2">
            <span>Budget Allocation Tracker</span>
            <span className={remainingBudget < 0 ? "text-destructive" : "text-[var(--gold)]"}>
              Remaining: ₹{remainingBudget.toLocaleString("en-IN")}
            </span>
          </div>

          {/* Allocation Progress Bar */}
          <div className="h-3 bg-border/20 rounded-full overflow-hidden flex">
            {roundTripCost > 0 && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${transportPercent}%` }}
                className="h-full bg-[var(--gold)]"
                title={`Transport (Round Trip): ₹${roundTripCost.toLocaleString("en-IN")}`}
              />
            )}
            <div className="flex-1 h-full bg-emerald-500/20" title={`Stays & Activities Allocation: ₹${remainingBudget.toLocaleString("en-IN")}`} />
          </div>

          <div className="flex justify-between text-[9px] uppercase tracking-[0.1em] text-muted-foreground mt-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--gold)] block" />
              Transit Round-Trip (₹{roundTripCost.toLocaleString("en-IN")})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/40 block" />
              Remaining for Stays & Play (₹{Math.max(0, remainingBudget).toLocaleString("en-IN")})
            </span>
          </div>
        </div>
      </div>

      {/* Scraper Status Notification */}
      {polling && (
        <div className="bg-[var(--gold)]/10 border-b border-[var(--gold)]/20 py-3 px-6 text-center text-xs font-serif text-[var(--gold)] flex items-center justify-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking real-time schedules and prices... Options will dynamically update below.
        </div>
      )}

      {/* Navigation tabs */}
      <div className="max-w-5xl mx-auto w-full px-6 pt-12 flex justify-center">
        <div className="inline-flex border-b border-border/40 p-1 gap-2 md:gap-4">
          {tabItems.map((tab) => {
            const Icon = tab.icon
            const isTabActive = activeTab === tab.id
            const count = transportData?.options[tab.id as keyof typeof transportData.options]?.length || 0

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-6 border-b-2 text-xs uppercase tracking-[0.15em] font-medium transition-all ${
                  isTabActive
                    ? "border-[var(--gold)] text-[var(--gold)] font-bold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[9px] font-semibold bg-border/40 text-muted-foreground rounded-full">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Options Grid */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
        <AnimatePresence mode="wait">
          {activeOptions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center py-20 border border-dashed border-border/30 rounded-3xl bg-card/10 backdrop-blur-sm"
            >
              <RefreshCw className="h-8 w-8 text-muted-foreground/30 mx-auto mb-4 animate-spin-slow" />
              <h3 className="font-serif text-lg text-muted-foreground mb-1">Searching for Options</h3>
              <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">
                No active schedules found yet. If scraping is in progress, they will appear shortly.
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {activeOptions.map((opt, idx) => {
                const isSelected = selectedOption?.operator === opt.operator && selectedOption?.price_min_inr === opt.price_min_inr
                const totalOptCost = opt.price_min_inr * 2

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                    onClick={() => setSelectedOption(opt)}
                    className="cursor-pointer"
                  >
                    <div className={`relative rounded-3xl p-6 h-full flex flex-col glass-card border hover:-translate-y-1 transition-all duration-300 ${
                      isSelected
                        ? "border-[var(--gold)] bg-[var(--gold)]/5 shadow-md shadow-[var(--gold)]/5"
                        : "border-border/30 hover:border-[var(--gold)]/30"
                    }`}>
                      {/* Checkmark */}
                      {isSelected && (
                        <div className="absolute top-4 right-4 h-6 w-6 bg-[var(--gold)] rounded-full flex items-center justify-center shadow-md">
                          <Check className="h-4 w-4 text-background" strokeWidth={3} />
                        </div>
                      )}

                      {/* Header info */}
                      <span className="text-[9px] uppercase tracking-[0.15em] font-semibold text-muted-foreground border border-border/40 px-3 py-1.5 rounded-full self-start mb-4 bg-card/20">
                        {opt.mode}
                      </span>

                      <h3 className="font-serif text-xl leading-tight pr-8 mb-2">{opt.operator}</h3>

                      {opt.frequency && (
                        <p className="text-[10px] text-muted-foreground mb-3">
                          Frequency: {opt.frequency}
                        </p>
                      )}

                      {/* Times and durations */}
                      <div className="grid grid-cols-2 gap-4 py-3 border-t border-b border-border/20 my-4 text-xs">
                        <div>
                          <span className="block text-[9px] uppercase tracking-[0.05em] text-muted-foreground">Duration</span>
                          <span className="font-medium">
                            {Math.floor(opt.duration_minutes / 60)}h {opt.duration_minutes % 60}m
                          </span>
                        </div>
                        {opt.departure_times && opt.departure_times.length > 0 && (
                          <div>
                            <span className="block text-[9px] uppercase tracking-[0.05em] text-muted-foreground">Departures</span>
                            <span className="font-medium truncate block">
                              {opt.departure_times.join(", ")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Prices */}
                      <div className="mt-auto pt-4 flex items-end justify-between">
                        <div>
                          <span className="block text-[8px] uppercase tracking-[0.05em] text-muted-foreground">One Way</span>
                          <span className="font-serif text-xl text-[var(--gold)] font-semibold">
                            ₹{opt.price_min_inr.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[8px] uppercase tracking-[0.05em] text-muted-foreground">Round Trip (Est)</span>
                          <span className="font-serif text-sm text-foreground/80">
                            ₹{totalOptCost.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>

                      {opt.booking_url && (
                        <a
                          href={opt.booking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-4 text-[9px] uppercase tracking-[0.1em] font-semibold text-muted-foreground hover:text-[var(--gold)] text-center border border-border/30 hover:border-[var(--gold)]/40 py-2 block transition-all"
                        >
                          Book via {opt.source || "Ixigo"}
                        </a>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA Section */}
        <div className="mt-16 flex flex-col items-center gap-3">
          <div className="flex gap-4">
            <button
              onClick={() => router.push("/trip-input")}
              className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold px-8 py-5 border border-border hover:border-foreground rounded-full transition-all cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            
            <button
              disabled={!selectedOption || confirming}
              onClick={handleConfirmTransport}
              className="flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.2em] font-semibold px-12 py-5 bg-foreground text-background rounded-full hover:bg-foreground/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg cursor-pointer"
            >
              {confirming ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Setting course...</>
              ) : (
                <>Confirm Route & Continue <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </div>

          {!selectedOption && (
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50">Select a transit route to proceed</p>
          )}
        </div>
      </main>
    </div>
  )
}
