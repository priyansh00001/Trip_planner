"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MapPin, CalendarDays, Wallet, Building2, Sparkles, Navigation, ArrowLeft } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

const accomOptions = ["Hotel", "Hostel 🎒", "Homestay 🏡", "No Preference"]

export default function TripInputPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form State
  const [destination, setDestination] = useState("")
  const [days, setDays] = useState<number>(3)
  const [budget, setBudget] = useState<number>(10000)
  const [accommodation, setAccommodation] = useState("No Preference")
  
  // Initialize to today's date
  const todayStr = new Date().toISOString().split('T')[0]
  const [journeyDate, setJourneyDate] = useState(todayStr)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!destination.trim()) {
      setError("Please enter a destination")
      return
    }

    if (journeyDate < todayStr) {
      setError("Journey date cannot be in the past")
      return
    }

    setIsSubmitting(true)
    setError(null)
    
    // Save the initial trip state to the DB
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data, error: insertError } = await supabase.from('trips').insert({
        user_id: user.id,
        destination,
        duration_days: days,
        budget_range: String(budget),
        preference: accommodation,
        status: 'generating_stays',
        start_date: journeyDate
      }).select().single()

      if (insertError) {
        setError(insertError.message)
        setIsSubmitting(false)
        return
      }

      // Redirect to the Phase 1 AI generation screen (Stays) passing the new trip ID
      router.push(`/generate-stays/${data.id}`)
    } else {
      setError("You must be logged in to create a trip.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col p-4 bg-muted/30 lg:p-8">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Link>
        
        <Card className="shadow-lg border-primary/10">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Navigation className="h-5 w-5" />
              </div>
              <CardTitle className="text-3xl">Where to next?</CardTitle>
            </div>
            <CardDescription className="text-base text-muted-foreground">
              Give us the basics, and our AI will handcraft a personalized itinerary just for you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Destination */}
              <div className="space-y-3">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Destination
                </label>
                <input
                  type="text"
                  placeholder="e.g. Manali, Goa, Rishikesh..."
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="flex h-12 w-full text-lg rounded-md border border-input bg-transparent px-4 py-2 shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  required
                />
              </div>

              {/* Journey Date */}
              <div className="space-y-3">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" /> Start Date
                </label>
                <input
                  type="date"
                  min={todayStr}
                  value={journeyDate}
                  onChange={(e) => setJourneyDate(e.target.value)}
                  className="flex h-12 w-full text-lg rounded-md border border-input bg-transparent px-4 py-2 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  required
                />
              </div>

              {/* Duration and Budget Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-semibold flex flex-col gap-1">
                    <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Duration (Days)</span>
                    <span className="text-xs font-normal text-muted-foreground">How long is your trip?</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="14"
                      value={days}
                      onChange={(e) => setDays(parseInt(e.target.value))}
                      className="w-full accent-primary h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-lg font-bold min-w-[3rem] text-right">{days} {days === 1 ? 'day' : 'days'}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold flex flex-col gap-1">
                    <span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Total Budget (₹)</span>
                    <span className="text-xs font-normal text-muted-foreground">Excluding flights/initial transport</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="3000"
                      max="100000"
                      step="1000"
                      value={budget}
                      onChange={(e) => setBudget(parseInt(e.target.value))}
                      className="w-full accent-primary h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-lg font-bold min-w-[5rem] text-right">₹{budget.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Stay Preference */}
              <div className="space-y-3">
                <label className="text-sm font-semibold flex flex-col gap-1">
                  <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Accommodation Preferred</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {accomOptions.map((opt) => (
                    <Button
                      key={opt}
                      type="button"
                      variant={accommodation === opt ? "default" : "outline"}
                      onClick={() => setAccommodation(opt)}
                      className="h-12 w-full font-medium"
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
              </div>

              {error && <div className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}

              {/* Submit CTA */}
              <Button 
                type="submit" 
                size="lg" 
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 transition-opacity"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  "Initiating AI Matrix..."
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" /> Generate My AI Itinerary
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
