"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Building2, Search, Star, MapPin, Loader2, AlertCircle } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

const loadingSteps = [
  { text: "Searching for the best stays...", icon: Search, color: "text-blue-500" },
  { text: "Comparing hostels & hotels...", icon: Building2, color: "text-emerald-500" },
  { text: "Checking ratings & reviews...", icon: Star, color: "text-amber-500" },
  { text: "Finding stays near top attractions...", icon: MapPin, color: "text-rose-500" },
  { text: "Preparing your options...", icon: Building2, color: "text-indigo-500" },
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
        const supabase = createClient()

        const { data: tripData, error: tripError } = await supabase
          .from('trips')
          .select('*')
          .eq('id', params.tripId)
          .single()

        if (tripError || !tripData) throw new Error("Could not find trip details.")

        // Call Phase 1 API: generate stays only
        const res = await fetch("/api/generate-stays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tripData),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to generate stay options")

        // Save stays to plan_data and update status
        const { error: updateError } = await supabase
          .from('trips')
          .update({
            plan_data: { stays: data.stays, destination: tripData.destination },
            status: 'selecting_stay'
          })
          .eq('id', params.tripId)

        if (updateError) throw new Error("Failed to save stays to database.")

        // Redirect to the stay selection page
        router.push(`/select-stay/${params.tripId}`)

      } catch (err: any) {
        console.error(err)
        setError(err.message)
      }
    }

    generateStays()
  }, [params, router])

  const CurrentIcon = loadingSteps[currentStep].icon

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/30">
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
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/30 overflow-hidden relative">
      {/* Background Pulse */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />

      <div className="z-10 flex flex-col items-center text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center"
          >
            <div className={`p-6 rounded-full bg-background shadow-xl mb-8 ${loadingSteps[currentStep].color} border`}>
              <CurrentIcon className="h-16 w-16" strokeWidth={1.5} />
            </div>

            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              {loadingSteps[currentStep].text}
            </h2>

            <div className="flex items-center text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin text-primary" />
              <span>Finding the perfect basecamp...</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
