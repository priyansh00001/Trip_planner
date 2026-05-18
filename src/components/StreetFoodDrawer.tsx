"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { UtensilsCrossed, X, MapPin, Clock, IndianRupee, Flame, Loader2 } from "lucide-react"

interface StreetFood {
  name: string
  location_hint: string
  description: string
  price?: string
  bestTime?: string
  spiceLevel?: "mild" | "medium" | "hot" | "extra-hot"
}

interface StreetFoodDrawerProps {
  isOpen: boolean
  onClose: () => void
  streetFood?: StreetFood[]
  destination?: string
}

const spiceColors: Record<string, string> = {
  "mild": "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400",
  "medium": "text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400",
  "hot": "text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400",
  "extra-hot": "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400",
}

const spiceLabel: Record<string, string> = {
  "mild": "🟢 Mild",
  "medium": "🟡 Medium",
  "hot": "🔴 Hot",
  "extra-hot": "🌶️ Extra Hot",
}

export default function StreetFoodDrawer({ isOpen, onClose, streetFood, destination }: StreetFoodDrawerProps) {
  const [apiItems, setApiItems] = useState<StreetFood[]>([])
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<'curated' | 'ai' | 'none'>('none')

  useEffect(() => {
    if (!isOpen || !destination) return
    setLoading(true)
    fetch(`/api/street-food?destination=${encodeURIComponent(destination)}`)
      .then(r => r.json())
      .then(data => {
        setApiItems(data.items || [])
        setSource(data.source || 'none')
      })
      .catch(() => setApiItems([]))
      .finally(() => setLoading(false))
  }, [isOpen, destination])

  // Merge: API items first, then any AI items from plan that aren't duplicates
  const planItems: StreetFood[] = streetFood ?? []
  const apiNames = new Set(apiItems.map(f => f.name.toLowerCase()))
  const uniquePlanItems = planItems.filter(f => !apiNames.has(f.name.toLowerCase()))
  const mergedList = [...apiItems, ...uniquePlanItems]

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
            className="fixed inset-0 bg-black/50 z-[9998] backdrop-blur-sm no-print"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-background shadow-2xl z-[9999] border-l flex flex-col no-print"
          >
            {/* Header */}
            <div className="p-5 border-b bg-gradient-to-r from-orange-500/10 to-red-500/5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-500/15 rounded-xl text-orange-600 dark:text-orange-400">
                  <UtensilsCrossed className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold leading-tight text-xl">Must-Try Street Food</h3>
                  <p className="text-sm text-muted-foreground">
                    {destination ? `${destination}'s iconic local bites` : "Iconic local bites to grab"}
                    {mergedList.length > 0 && (
                      <span className="ml-2 text-xs font-semibold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">
                        {mergedList.length} spots {source === 'curated' ? '✓ Curated' : source === 'ai' ? '✨ AI' : ''}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                  <p className="text-sm text-muted-foreground font-medium">Finding the best local bites...</p>
                </div>
              ) : mergedList.length === 0 ? (
                <div className="text-center py-16">
                  <UtensilsCrossed className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-20" />
                  <p className="font-semibold text-muted-foreground">No street food data available.</p>
                  <p className="text-xs text-muted-foreground mt-2">Generate a new trip to see AI-curated street foods!</p>
                </div>
              ) : (
                mergedList.map((food, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="bg-card p-5 rounded-2xl shadow-sm border relative overflow-hidden group hover:border-orange-300 dark:hover:border-orange-700 transition-all hover:shadow-md"
                  >
                    {/* Left accent bar */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-400 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-l-2xl" />

                    {/* Food name & spice level */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-lg text-foreground leading-tight">{food.name}</h3>
                      {food.spiceLevel && (
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap shrink-0 ${spiceColors[food.spiceLevel]}`}>
                          {spiceLabel[food.spiceLevel]}
                        </span>
                      )}
                    </div>

                    {/* Location */}
                    <div className="flex items-center text-orange-600 dark:text-orange-400 text-xs font-semibold mb-2">
                      <MapPin className="h-3 w-3 mr-1.5 shrink-0" />
                      {food.location_hint}
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                      {food.description}
                    </p>

                    {/* Price & Best Time */}
                    {(food.price || food.bestTime) && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {food.price && (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg">
                            <IndianRupee className="h-3 w-3" /> {food.price}
                          </span>
                        )}
                        {food.bestTime && (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 px-2.5 py-1 rounded-lg">
                            <Clock className="h-3 w-3" /> {food.bestTime}
                          </span>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer note */}
            <div className="p-4 border-t bg-muted/10 text-center">
              <p className="text-xs text-muted-foreground">
                🌶️ Always carry cash · Visit popular stalls early for freshness
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
