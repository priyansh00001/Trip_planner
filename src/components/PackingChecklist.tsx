"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Briefcase, CheckCircle2, Circle, Loader2, Shirt, Camera, Plus, Map, Umbrella, Sun, Smartphone, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const IconMap: Record<string, any> = {
  Shirt, Camera, Briefcase, Map, Umbrella, Sun, Smartphone
}

interface PackingChecklistProps {
  isOpen: boolean
  onClose: () => void
  destination: string
  duration_days: number
  plan: any
}

export default function PackingChecklist({ isOpen, onClose, destination, duration_days, plan }: PackingChecklistProps) {
  const [list, setList] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())

  const toggleItem = (id: string) => {
    const newSet = new Set(checkedItems)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setCheckedItems(newSet)
  }

  const generateList = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const activities = plan.days?.flatMap((d: any) => d.activities?.map((a: any) => a.name) || []).slice(0, 10) || []
      
      const res = await fetch("/api/packing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, duration_days, activities })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate list")
      
      setList(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[9998] backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[450px] bg-background shadow-2xl z-[9999] border-l flex flex-col no-print"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold leading-tight text-lg">Packing Checklist</h3>
                  <p className="text-xs text-muted-foreground">{destination} · {duration_days} Days</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {!list && !loading ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
                    <Briefcase className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Smart AI Packer</h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    Our AI will scan your exact itinerary and {destination}'s weather to generate the perfect packing list.
                  </p>
                  <Button onClick={generateList} className="rounded-full w-full">
                    <Plus className="h-4 w-4 mr-2" /> Generate My Checklist
                  </Button>
                  {error && <p className="text-destructive text-xs mt-3">{error}</p>}
                </div>
              ) : loading ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                  <p className="font-medium text-lg">Analyzing itinerary...</p>
                  <p className="text-sm text-muted-foreground">Looking up what to pack for {destination}</p>
                </div>
              ) : (
                <div className="space-y-6 pb-20">
                  {list.categories?.map((cat: any, i: number) => {
                    const CatIcon = IconMap[cat.icon] || Briefcase
                    
                    return (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <h4 className="font-bold flex items-center gap-2 mb-3 text-primary text-sm uppercase tracking-wider border-b pb-2">
                          <CatIcon className="h-4 w-4" /> {cat.name}
                        </h4>
                        <div className="space-y-2.5">
                          {cat.items?.map((item: any, j: number) => {
                            const itemId = `${cat.name}-${item.name}`
                            const isChecked = checkedItems.has(itemId)
                            
                            return (
                              <div 
                                key={j} 
                                className={`flex items-start gap-3 cursor-pointer group transition-all p-2 rounded-lg hover:bg-muted/50 ${isChecked ? 'opacity-50' : 'opacity-100'}`}
                                onClick={() => toggleItem(itemId)}
                              >
                                <button className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                                  {isChecked ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                  ) : (
                                    <Circle className="h-5 w-5" />
                                  )}
                                </button>
                                <div>
                                  <p className={`text-sm font-medium leading-tight ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    {item.name}
                                  </p>
                                  {item.reason && (
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                      {item.reason}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
