"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { MapPin, ArrowRight, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

const questions = [
  {
    id: "travel_style",
    title: "How do you usually travel?",
    description: "This helps us tailor the vibe of your itinerary.",
    options: [
      { label: "Solo Backpacker", icon: "🎒" },
      { label: "With a Partner", icon: "👩‍❤️‍👨" },
      { label: "Group of Friends", icon: "🍻" },
      { label: "Family Trip", icon: "👨‍👩‍👧‍👦" },
    ],
  },
  {
    id: "pace",
    title: "What's your ideal travel pace?",
    description: "Do you like to see everything or take it easy?",
    options: [
      { label: "Relaxed (Chilled out)", icon: "☕" },
      { label: "Moderate (Balanced)", icon: "🚶" },
      { label: "Adventure (Packed schedule)", icon: "⛰️" },
    ],
  },
  {
    id: "food_pref",
    title: "Any food preferences?",
    description: "We'll recommend the best local spots for you.",
    options: [
      { label: "Vegetarian", icon: "🥗" },
      { label: "Non-Vegetarian", icon: "🍗" },
      { label: "Vegan", icon: "🌱" },
      { label: "No Preference", icon: "🍲" },
    ],
  },
  {
    id: "budget_tier",
    title: "What is your budget comfort?",
    description: "This filters accommodations and activities.",
    options: [
      { label: "Budget (₹3k - 10k)", icon: "🪙" },
      { label: "Standard (₹10k - 25k)", icon: "💵" },
      { label: "Luxury (₹25k+)", icon: "💎" },
    ],
  },
]

export default function TravelQuizPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOptionSelect = async (optionLabel: string) => {
    const newAnswers = { ...answers, [questions[currentStep].id]: optionLabel }
    setAnswers(newAnswers)

    if (currentStep < questions.length - 1) {
      setTimeout(() => setCurrentStep((prev) => prev + 1), 300)
    } else {
      setIsSubmitting(true)
      
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        await supabase.from("user_preferences").insert({
          user_id: user.id,
          travel_style: newAnswers["travel_style"],
          pace: newAnswers["pace"],
          food_pref: newAnswers["food_pref"],
          budget_tier: newAnswers["budget_tier"]
        })
      }

      setTimeout(() => {
        router.push("/dashboard")
      }, 500)
    }
  }

  const handleSkip = () => {
    router.push("/dashboard")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/30 overflow-hidden">
      <div className="absolute top-4 left-4 flex items-center gap-2 font-bold text-xl tracking-tight">
        <MapPin className="h-6 w-6 text-primary" />
        <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          AI Trip Planner
        </span>
      </div>

      <div className="w-full max-w-md">
        {/* Progress Bar */}
        <div className="mb-8 w-full bg-secondary rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500 ease-in-out"
            style={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}
          />
        </div>

        <AnimatePresence mode="wait">
          {!isSubmitting ? (
            <motion.div
              key={currentStep}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="shadow-lg border-primary/10">
                <CardHeader>
                  <CardTitle className="text-2xl">{questions[currentStep].title}</CardTitle>
                  <CardDescription>{questions[currentStep].description}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {questions[currentStep].options.map((option) => (
                    <Button
                      key={option.label}
                      variant={answers[questions[currentStep].id] === option.label ? "default" : "outline"}
                      className="h-14 justify-start text-left font-normal text-base"
                      onClick={() => handleOptionSelect(option.label)}
                    >
                      <span className="mr-3 text-xl">{option.icon}</span>
                      {option.label}
                    </Button>
                  ))}
                </CardContent>
                <CardFooter className="justify-center pt-2 pb-6">
                  <Button variant="ghost" className="text-muted-foreground" onClick={handleSkip}>
                    Skip for now
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center space-y-4"
            >
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h2 className="text-xl font-semibold">Personalizing your experience...</h2>
              <p className="text-muted-foreground">Setting up your dashboard</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
