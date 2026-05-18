"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MapPin, Loader2, Eye, EyeOff, X, Sparkles, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { motion, AnimatePresence } from "framer-motion"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  selectedPlaces: any[]
}

export default function AuthModal({ isOpen, onClose, selectedPlaces }: AuthModalProps) {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signUpSuccess, setSignUpSuccess] = useState(false)

  if (!isOpen) return null

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()

    try {
      if (isSignUp) {
        // Sign Up Flow
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard`,
          },
        })

        if (signUpErr) throw new Error(signUpErr.message)
        
        // Since we need them to verify their email (or if autoconfirmed), let's save their pending anonymous trip state
        // In local storage so when they confirm they have it
        setSignUpSuccess(true)
        setLoading(false)
        return
      }

      // Sign In Flow
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) throw new Error(signInErr.message)

      const user = signInData.user
      if (!user) throw new Error("Could not authenticate user.")

      // Post-auth: Check local storage for anonymous trip details
      const anonTripStr = localStorage.getItem("anonymous_trip")
      if (anonTripStr) {
        const anonTrip = JSON.parse(anonTripStr)
        
        // Write the trip to Supabase
        const { data: newTrip, error: insertError } = await supabase
          .from("trips")
          .insert({
            user_id: user.id,
            destination: anonTrip.destination,
            duration_days: anonTrip.duration_days,
            budget_range: String(anonTrip.budget_range),
            preference: anonTrip.preference || "No Preference",
            status: "generating_itinerary",
            start_date: anonTrip.start_date || new Date().toISOString().split("T")[0],
            plan_data: {
              stays: anonTrip.plan_data?.stays || [],
              confirmed_stay: anonTrip.plan_data?.confirmed_stay || null,
              selected_places: selectedPlaces.map(p => ({
                name: p.name,
                description: p.description,
                rating: p.rating,
                category: p.category,
                lat: p.lat,
                lng: p.lng,
                timing: p.timing,
                signatureDish: p.signatureDish,
                address: p.address,
                priceLevel: p.priceLevel,
              })),
            },
          })
          .select()
          .single()

        if (insertError) throw new Error(`Failed to save trip: ${insertError.message}`)

        // Clear anonymous cache
        localStorage.removeItem("anonymous_trip")

        // Redirect immediately to generate itinerary loading screen!
        onClose()
        router.push(`/generate/${newTrip.id}`)
        router.refresh()
      } else {
        onClose()
        router.push("/dashboard")
        router.refresh()
      }

    } catch (err: any) {
      console.error(err)
      setError(err.message)
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    const supabase = createClient()
    
    // Cache the selected places in localStorage so that when they redirect back we can catch it!
    const anonTripStr = localStorage.getItem("anonymous_trip")
    if (anonTripStr) {
      const anonTrip = JSON.parse(anonTripStr)
      localStorage.setItem("anonymous_trip", JSON.stringify({
        ...anonTrip,
        plan_data: {
          ...anonTrip.plan_data,
          selected_places: selectedPlaces.map(p => ({
            name: p.name,
            description: p.description,
            rating: p.rating,
            category: p.category,
            lat: p.lat,
            lng: p.lng,
            timing: p.timing,
            signatureDish: p.signatureDish,
            address: p.address,
            priceLevel: p.priceLevel,
          }))
        }
      }))
    }

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=/dashboard` },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-md bg-background border rounded-2xl shadow-2xl overflow-hidden relative"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-6">
            <MapPin className="h-6 w-6 text-primary animate-pulse" />
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              AI Trip Planner
            </span>
          </div>

          {signUpSuccess ? (
            <div className="text-center py-6">
              <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-500 mb-4">
                <CheckCircle2 className="h-12 w-12" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Check Your Email!</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                We've sent a verification link to <span className="font-semibold text-foreground">{email}</span>. Please click the link to confirm your account and activate your premium trip!
              </p>
              <Button onClick={onClose} className="w-full rounded-xl py-6 bg-gradient-to-r from-indigo-500 to-purple-600">
                Done
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-extrabold tracking-tight mb-2">
                {isSignUp ? "Create your account" : "Sign in to generate itinerary"}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {isSignUp
                  ? "Already have an account? "
                  : "Save your stays, selected places, and unlock your day-by-day RAG itinerary in seconds!"}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setError(null)
                  }}
                  className="text-primary font-semibold hover:underline ml-1"
                >
                  {isSignUp ? "Sign In" : "Sign up free"}
                </button>
              </p>

              {/* Google OAuth Button */}
              <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 border border-border rounded-xl py-3 px-4 text-sm font-semibold hover:bg-muted/50 transition-colors mb-5"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <div className="relative mb-5">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-3 text-muted-foreground">or with email</span>
                </div>
              </div>

              {error && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5 mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleAuth} className="space-y-4">
                {isSignUp && (
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Full Name</label>
                    <input
                      type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                      placeholder="Abhishek Dubey"
                      className="w-full rounded-xl border border-input bg-muted/30 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold mb-1 block">Email address</label>
                  <input
                    type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-input bg-muted/30 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-input bg-muted/30 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full rounded-xl py-6 text-sm font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 shadow-lg shadow-indigo-500/20 mt-4">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {isSignUp ? (loading ? "Creating..." : "Create Account →") : (loading ? "Logging in..." : "Unlock Final Itinerary →")}
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
