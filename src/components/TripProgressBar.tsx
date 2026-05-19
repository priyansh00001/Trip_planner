"use client"

import { Check, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface TripProgressBarProps {
  currentStep: number // 1-4
}

export function TripProgressBar({ currentStep }: TripProgressBarProps) {
  const steps = [
    { num: 1, label: "Plan" },
    { num: 2, label: "Choose Stay" },
    { num: 3, label: "Pick Places" },
    { num: 4, label: "Your Itinerary" },
  ]

  return (
    <div className="w-full bg-background/85 backdrop-blur-md border-b border-border/40 py-3 px-6 no-print sticky top-[72px] z-40">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        {/* Integrated Back Button */}
        <Link href="/dashboard" className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] font-bold text-muted-foreground hover:text-foreground transition-colors mr-2 sm:mr-6 bg-card/50 backdrop-blur-sm border border-border/40 px-3.5 py-2 rounded-full hover:bg-foreground/5 shrink-0 shadow-sm">
          <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Back to </span>Dashboard
        </Link>

        <div className="flex-1 flex items-center justify-between">
          {steps.map((step, i) => {
          const isCompleted = step.num < currentStep
          const isActive = step.num === currentStep

          return (
            <div key={step.num} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div 
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                    isCompleted 
                      ? "bg-foreground text-background" 
                      : isActive 
                        ? "bg-[var(--gold)] text-background" 
                        : "bg-border/50 text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : step.num}
                </div>
                <span 
                  className={`hidden sm:block text-[10px] uppercase tracking-[0.15em] font-medium ${
                    isActive 
                      ? "text-foreground" 
                      : isCompleted 
                        ? "text-foreground/70" 
                        : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="flex-1 mx-4 h-px bg-border/50">
                  {isCompleted && <div className="h-full bg-foreground" />}
                </div>
              )}
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}
