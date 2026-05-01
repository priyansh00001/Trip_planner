"use client"

import { useState } from "react"
import Link from "next/link"
import { MapPin, Loader2, ArrowLeft, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-12">
          <MapPin className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-pink-500 bg-clip-text text-transparent">AI Trip Planner</span>
        </div>

        {sent ? (
          /* Success State */
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="h-10 w-10 text-indigo-500" />
            </div>
            <h1 className="text-2xl font-extrabold mb-3">Check your inbox</h1>
            <p className="text-muted-foreground mb-2">We sent a password reset link to:</p>
            <p className="font-semibold text-foreground mb-8">{email}</p>
            <p className="text-sm text-muted-foreground mb-8">
              Didn't receive it? Check your spam folder, or{" "}
              <button onClick={() => setSent(false)} className="text-primary hover:underline font-medium">try again</button>.
            </p>
            <Link href="/login">
              <Button variant="outline" className="rounded-xl px-8">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sign in
              </Button>
            </Link>
          </div>
        ) : (
          /* Form State */
          <>
            <Link href="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to Sign in
            </Link>

            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Forgot password?</h1>
            <p className="text-muted-foreground mb-8">No worries! Enter your email and we'll send you a reset link.</p>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 mb-6">{error}</div>
            )}

            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email address</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-input bg-muted/30 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full rounded-xl py-6 text-base font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 shadow-lg shadow-indigo-500/20">
                {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Mail className="h-5 w-5 mr-2" />}
                {loading ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
