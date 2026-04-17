"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Plane, Mountain, Train, Bus, MapPin, Loader2, AlertCircle } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

const loadingSteps = [
  { text: "Firing up the engines...", icon: Plane, color: "text-blue-500" },
  { text: "Mapping out scenic mountain routes...", icon: Mountain, color: "text-emerald-500" },
  { text: "Checking train schedules...", icon: Train, color: "text-amber-500" },
  { text: "Securing local bus connections...", icon: Bus, color: "text-rose-500" },
  { text: "Finalizing your perfect itinerary...", icon: MapPin, color: "text-indigo-500" },
]

export default function GeneratePage() {
  const router = useRouter()
  const params = useParams()
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Cycle through the cool loading animations every 3 seconds
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev))
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    async function generateTripPlan() {
      if (!params || !params.tripId) return

      try {
        const supabase = createClient()
        
        // 1. Fetch the trip explicitly via the frontend so RLS works natively
        const { data: tripData, error: tripError } = await supabase
          .from('trips')
          .select('*')
          .eq('id', params.tripId)
          .single()

        if (tripError || !tripData) throw new Error("Could not find trip details.")

        // 2. Call our secure Next.js API route that talks to Gemini
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tripData),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to generate AI plan")

        // 3. Save the generated JSON back to Supabase
        const { error: updateError } = await supabase
          .from('trips')
          .update({
            plan_data: data.plan,
            status: 'completed'
          })
          .eq('id', params.tripId)

        if (updateError) throw new Error("Failed to save plan to database.")

        // 4. Redirect to the amazing Output Screen (Module 7)
        router.push(`/trips/${params.tripId}`)

      } catch (err: any) {
        console.error(err)
        setError(err.message)
      }
    }
    
    generateTripPlan()
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
      {/* Background Pulse Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      
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
              <span>AI is thinking...</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
