"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, AlertCircle } from "lucide-react"

import { createClient } from "@/lib/supabase/client"

const loadingSteps = [
  "Charting your journey",
  "Mapping scenic routes",
  "Scheduling local experiences",
  "Arranging transport connections",
  "Perfecting your itinerary",
]

export default function GeneratePage() {
  const router = useRouter()
  const params = useParams()
  const [currentStep, setCurrentStep] = useState(0)
  const [dynamicStatus, setDynamicStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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

        // 2. Call our secure Next.js API route — pass confirmed_stay and selected_places
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...tripData,
            confirmed_stay: tripData.plan_data?.confirmed_stay ?? null,
            selected_places: tripData.plan_data?.selected_places ?? [],
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || "Failed to generate AI plan")
        }

        // Consume the text/event-stream response chunk-by-chunk!
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let finalPlan: any = null

        if (!reader) throw new Error("No response body to stream.")

        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          
          // Split buffer by lines to parse SSE event envelopes
          const lines = buffer.split("\n")
          // Retain the last incomplete line in the buffer
          buffer = lines.pop() || ""

          let currentEvent = ""

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            if (trimmed.startsWith("event: ")) {
              currentEvent = trimmed.slice(7).trim()
            } else if (trimmed.startsWith("data: ")) {
              const dataStr = trimmed.slice(6).trim()
              try {
                const parsed = JSON.parse(dataStr)
                if (currentEvent === "status") {
                  // Update loading text dynamically with agent's message!
                  if (parsed.message) {
                    setDynamicStatus(parsed.message)
                  }
                } else if (currentEvent === "result") {
                  finalPlan = parsed
                }
              } catch (e) {
                console.warn("Failed to parse SSE data block:", dataStr, e)
              }
            }
          }
        }

        // Parse remaining buffer if any
        if (buffer.trim().startsWith("data: ")) {
          const dataStr = buffer.trim().slice(6).trim()
          try {
            finalPlan = JSON.parse(dataStr)
          } catch {}
        }

        if (!finalPlan) {
          throw new Error("Generation completed but no plan data was received.")
        }

        // 3. Save the generated JSON back to Supabase — preserve confirmed_stay
        const { error: updateError } = await supabase
          .from('trips')
          .update({
            plan_data: {
              ...finalPlan,
              confirmed_stay: tripData.plan_data?.confirmed_stay ?? null,
            },
            status: 'completed'
          })
          .eq('id', params.tripId)

        if (updateError) throw new Error("Failed to save plan to database.")

        // 4. Redirect to the trip output page
        router.push(`/trips/${params.tripId}`)

      } catch (err: any) {
        console.error(err)
        setError(err.message)
      }
    }
    
    generateTripPlan()
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
      {/* Atmospheric background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-[0.06] dark:opacity-[0.1]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
      </div>

      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[var(--gold)]/5 rounded-full blur-3xl" />
      
      <div className="z-10 flex flex-col items-center text-center max-w-lg">
        {/* Spinner */}
        <Loader2 className="h-10 w-10 animate-spin text-[var(--gold)] mb-10" />

        {/* Step text */}
        <AnimatePresence mode="wait">
          <motion.div
            key={dynamicStatus || currentStep}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center"
          >
            <h2 className="font-serif text-2xl md:text-3xl tracking-tight text-foreground">
              {dynamicStatus || loadingSteps[currentStep]}
            </h2>
          </motion.div>
        </AnimatePresence>

        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-6">
          Crafting your perfect journey
        </p>

        {/* Progress bar */}
        <div className="flex gap-2 mt-8">
          {loadingSteps.map((_, i) => (
            <div
              key={i}
              className={`h-1 w-8 transition-all duration-700 ${
                i <= currentStep ? 'bg-[var(--gold)]' : 'bg-border/30'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
