"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MapPin, Loader2, Eye, EyeOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getAnonState, clearAnonState } from "@/lib/anonymousState"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signInError.message)
      setLoading(false)
    } else {
      const nextUrl = new URLSearchParams(window.location.search).get("next") || "/dashboard"
      const anonState = getAnonState()
      
      if (anonState) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { error: insertError, data } = await supabase.from('trips').insert({
              user_id: user.id,
              origin_city: anonState.originCity || anonState.source,
              destination: anonState.destination,
              duration_days: anonState.duration_days,
              budget_range: anonState.budget_range || anonState.budget,
              preference: anonState.preference,
              start_date: anonState.start_date || anonState.startDate,
              status: anonState.status || 'selecting_transport',
              plan_data: anonState.plan_data,
              selected_transport: anonState.selected_transport,
              transport_cost_inr: anonState.transport_cost_inr,
              remaining_budget_inr: anonState.remaining_budget_inr,
            }).select().single()
            
            if (insertError) {
              console.error("Migration failed:", insertError)
            } else {
              // If we are migrating an anonymous state that is mid-flow, we redirect them to the right place
              if (anonState.lastCompletedStep === 'trip-input') {
                router.push(`/select-transport/${data.id}`)
              } else if (anonState.lastCompletedStep === 'select-transport') {
                router.push(`/generate-stays/${data.id}`)
              } else if (anonState.lastCompletedStep === 'generate-stays') {
                router.push(`/select-stay/${data.id}`)
              } else if (anonState.lastCompletedStep === 'select-stay') {
                router.push(`/pick-places/${data.id}`)
              } else if (anonState.lastCompletedStep === 'pick-places') {
                // If they finished picking places, they should go to generate-itinerary or dashboard
                router.push(`/dashboard`)
              } else {
                router.push(nextUrl)
              }
              clearAnonState()
              router.refresh()
              return
            }
          }
        } catch (err) {
          console.error("Migration error:", err)
        }
        clearAnonState()
      }
      
      // If we didn't migrate a mid-flight state and handle its routing above
      // Or if migration failed
      const safeNextUrl = nextUrl.includes("anonymous") ? "/dashboard" : nextUrl;
      router.push(safeNextUrl)
      router.refresh()
    }
  }

  const handleGoogleLogin = async () => {
    // We send them to dashboard for the OAuth callback so that the dashboard page can handle the anon migration.
    // However, if they have no anon state, we can send them to nextUrl
    const nextUrl = new URLSearchParams(window.location.search).get("next") || "/dashboard"
    const hasAnonState = typeof window !== "undefined" && !!localStorage.getItem("anonymous_trip")
    
    // Pass the actual nextUrl so dashboard can use it after migration, or use dashboard directly
    const callbackNext = hasAnonState ? `/dashboard?postLoginNext=${encodeURIComponent(nextUrl)}` : nextUrl
    
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(callbackNext)}` },
    })
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center py-12 px-6 relative">
      {/* Atmospheric background watermark */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-[0.08] dark:opacity-[0.14]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background" />
      </div>

      {/* Main Glassmorphic Card */}
      <div className="w-full max-w-md bg-card/75 backdrop-blur-2xl border border-border/40 rounded-[32px] p-8 md:p-12 shadow-2xl shadow-black/10">
        {/* Logo and Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <MapPin className="h-6 w-6 text-[var(--gold)]" />
            <span className="font-serif text-2xl tracking-tight text-foreground">Karyakram</span>
          </div>
          <h1 className="font-serif text-3xl tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground/80 text-xs mt-2 font-sans">
            Ready to plan your next travel escape?
          </p>
        </div>

        {/* Google SSO */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 border border-border/60 rounded-full py-4 px-4 text-xs uppercase tracking-[0.15em] font-semibold hover:bg-muted/50 transition-colors mb-6 font-sans cursor-pointer"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/40" /></div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-[0.15em]"><span className="bg-card px-3 text-muted-foreground">or with email</span></div>
        </div>

        {error && <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-2xl px-4 py-3 mb-4 font-sans">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-6 font-sans">
          <div>
            <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-muted-foreground/95 mb-2 block">Email Address</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-full border border-border/60 bg-muted/10 px-5 py-3.5 text-sm focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]/20 transition-all font-sans text-foreground"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-muted-foreground/95 block">Password</label>
              <Link href="/forgot-password" className="text-[10px] uppercase tracking-[0.1em] text-[var(--gold)] hover:underline font-bold">Forgot?</Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-full border border-border/60 bg-muted/10 px-5 py-3.5 text-sm focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]/20 transition-all pr-12 font-sans text-foreground"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-xs">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-full py-4 text-xs font-bold uppercase tracking-[0.2em] bg-[var(--gold)] text-background hover:bg-[var(--gold)]/90 shadow-lg shadow-[var(--gold)]/10 hover:shadow-[var(--gold)]/20 transition-all cursor-pointer disabled:opacity-50 mt-4"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Signing in..." : "Sign in →"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-muted-foreground/80 font-sans">
          Don't have an account?{" "}
          <Link href="/signup" className="text-[var(--gold)] hover:underline font-bold">
            Sign up free
          </Link>
        </p>

        <p className="mt-6 text-center text-[10px] text-muted-foreground/60 leading-relaxed font-sans">
          By signing in you agree to our{" "}
          <Link href="/terms" className="underline hover:text-foreground">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  )
}
