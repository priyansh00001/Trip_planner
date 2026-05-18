"use client"

import { useState, useRef, useEffect } from "react"
import { X, Send, Bot, User, Sparkles, Loader2 } from "lucide-react"

export default function ChatDrawer({ 
  isOpen, 
  onClose, 
  plan, 
  onPlanUpdate 
}: { 
  isOpen: boolean
  onClose: () => void
  plan: any
  onPlanUpdate: (newPlan: any) => Promise<void>
}) {
  const [messages, setMessages] = useState<{role: "user" | "ai", text: string}[]>([
    { role: "ai", text: `Hi! I'm your AI Travel Agent. I helped generate your trip to ${plan?.destination}. Do you want to change anything? (e.g., "Add another day", "Find a cheaper hotel", "Swap the beach for a museum on Day 1")` }
  ])
  const [input, setInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (!isOpen) return null

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!input.trim() || isProcessing) return

    const userMessage = input.trim()
    setInput("")
    setMessages(prev => [...prev, { role: "user", text: userMessage }])
    setIsProcessing(true)

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          message: userMessage
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to process request")
      }

      if (data.plan) {
        // Save the updated plan visually & in DB
        await onPlanUpdate(data.plan)
        setMessages(prev => [...prev, { role: "ai", text: "I've successfully updated your trip itinerary! You should see the changes reflected on your dashboard instantly. Anything else?" }])
      } else {
        throw new Error("Invalid response from Agent")
      }

    } catch (err: any) {
      console.error(err)
      setMessages(prev => [...prev, { role: "ai", text: `Oops! It looks like I ran into a problem modifying your trip: ${err.message}. Try again later.` }])
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ zIndex: 9998 }} onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[450px] bg-background shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300" style={{ zIndex: 9999 }}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-card">
          <div className="flex items-center gap-2">
            <div className="bg-primary/20 p-2 rounded-full">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">AI Trip Agent</h2>
              <p className="text-xs text-muted-foreground">Modify your itinerary instantly</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-muted/50 hover:bg-muted rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {/* Avatar */}
              <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${msg.role === "user" ? "bg-emerald-500" : "bg-primary"}`}>
                {msg.role === "user" ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
              </div>
              
              {/* Bubble */}
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${msg.role === "user" ? "bg-emerald-500 text-white rounded-tr-none" : "bg-card border shadow-sm rounded-tl-none text-card-foreground"}`}>
                {msg.text}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex gap-3 flex-row">
              <div className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center bg-primary">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-card border shadow-sm rounded-tl-none text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs">Rewriting your itinerary...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-card border-t shrink-0">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              type="text"
              value={input}
              disabled={isProcessing}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., 'Change my hotel to a resort'"
              className="w-full bg-muted/50 border rounded-full pl-5 pr-12 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="absolute right-2 p-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

      </div>
    </>
  )
}
