"use client"

import Link from "next/link"
import { MapPin, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-2 mb-12">
          <MapPin className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-pink-500 bg-clip-text text-transparent">AI Trip Planner</span>
        </div>

        {/* Email icon with glow */}
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl" />
          <div className="relative w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-full flex items-center justify-center">
            <Mail className="h-10 w-10 text-indigo-500" />
          </div>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight mb-3">Verify your email</h1>
        <p className="text-muted-foreground text-lg mb-3 max-w-sm mx-auto">
          We've sent a verification link to your inbox. Click the link to activate your account.
        </p>
        <p className="text-sm text-muted-foreground mb-10">
          Didn't get it? Check your spam folder — sometimes emails end up there.
        </p>

        {/* Steps */}
        <div className="bg-muted/40 border border-border rounded-2xl p-6 text-left mb-8 space-y-4">
          {[
            { step: "1", text: "Open your email inbox" },
            { step: "2", text: "Find the email from AI Trip Planner" },
            { step: "3", text: "Click the verification link" },
            { step: "4", text: "Start planning your dream trip! 🎉" },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-center gap-4">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{step}</div>
              <p className="text-sm font-medium">{text}</p>
            </div>
          ))}
        </div>

        <Link href="/login">
          <Button variant="outline" className="rounded-xl px-10">Back to Sign in</Button>
        </Link>
      </div>
    </div>
  )
}
