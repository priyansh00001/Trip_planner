"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, AlertCircle } from "lucide-react"

import { createClient } from "@/lib/supabase/client"

const loadingSteps = [
  "Searching for the best stays",
  "Comparing hostels & hotels",
  "Checking ratings & reviews",
  "Finding stays near top attractions",
  "Preparing your options",
]

export default function GenerateStaysPage() {
  const router = useRouter()
  const params = useParams()
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev))
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    async function generateStays() {
      if (!params || !params.tripId) return

      try {
        let tripData: any = null

        if (params.tripId === "anonymous") {
          const stored = localStorage.getItem("anonymous_trip")
          if (!stored) { router.push("/trip-input"); return }
          tripData = JSON.parse(stored)
        } else {
          const supabase = createClient()
          const { data, error: tripError } = await supabase
            .from('trips').select('*').eq('id', params.tripId).single()
          if (tripError || !data) throw new Error("Could not find trip details.")
          tripData = data
        }

        const res = await fetch("/api/generate-stays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tripData),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to generate stay options")

        if (params.tripId === "anonymous") {
          localStorage.setItem("anonymous_trip", JSON.stringify({
            ...tripData,
            plan_data: { stays: data.stays, destination: tripData.destination },
            status: 'selecting_stay'
          }))
          router.push(`/select-stay/anonymous`)
        } else {
          const supabase = createClient()
          const { error: updateError } = await supabase
            .from('trips')
            .update({
              plan_data: { stays: data.stays, destination: tripData.destination },
              status: 'selecting_stay'
            })
            .eq('id', params.tripId)
          if (updateError) throw new Error("Failed to save stays to database.")
          router.push(`/select-stay/${params.tripId}`)
        }
      } catch (err: any) {
        console.error(err)
        setError(err.message)
      }
    }
    generateStays()
  }, [params, router])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
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
    <div className="flex min-h-screen flex-col items-center justify-center p-6 overflow-hidden relative">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-[var(--gold)]/5 rounded-full blur-3xl" />

      <div className="z-10 flex flex-col items-center text-center max-w-md">
        {/* Spinner */}
        <Loader2 className="h-10 w-10 animate-spin text-[var(--gold)] mb-10" />

        {/* Step text */}
        <AnimatePresence mode="wait">
          <motion.p
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="font-serif text-2xl md:text-3xl tracking-tight text-foreground"
          >
            {loadingSteps[currentStep]}
          </motion.p>
        </AnimatePresence>

        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-6">
          Finding the perfect basecamp
        </p>

        {/* Progress dots */}
        <div className="flex gap-2 mt-8">
          {loadingSteps.map((_, i) => (
            <div
              key={i}
              className={`h-1 w-8 transition-all duration-500 ${
                i <= currentStep ? 'bg-[var(--gold)]' : 'bg-border/30'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
