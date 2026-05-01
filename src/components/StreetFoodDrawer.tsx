import { motion, AnimatePresence } from "framer-motion"
import { UtensilsCrossed, X, MapPin } from "lucide-react"

interface StreetFood {
  name: string
  location_hint: string
  description: string
}

interface StreetFoodDrawerProps {
  isOpen: boolean
  onClose: () => void
  streetFood: StreetFood[]
}

export default function StreetFoodDrawer({ isOpen, onClose, streetFood }: StreetFoodDrawerProps) {
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
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[450px] bg-background shadow-2xl z-[9999] border-l flex flex-col no-print"
          >
            {/* Header */}
            <div className="p-5 border-b bg-muted/20 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-500/10 rounded-xl text-orange-600 dark:text-orange-400">
                  <UtensilsCrossed className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold leading-tight text-xl">Must-Try Street Food</h3>
                  <p className="text-sm text-muted-foreground tracking-tight">Iconic local bites to grab</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!streetFood || streetFood.length === 0 ? (
                <div className="text-center py-10">
                  <UtensilsCrossed className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                  <p className="text-muted-foreground">No street food recommendations available for this trip.</p>
                  <p className="text-xs text-muted-foreground mt-2">Generate a new trip to see AI-curated street foods!</p>
                </div>
              ) : (
                streetFood.map((food, idx) => (
                  <div key={idx} className="bg-card p-5 rounded-xl shadow-sm border relative overflow-hidden group hover:border-orange-300 dark:hover:border-orange-700 transition-colors">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <h3 className="font-bold text-lg text-foreground mb-1">{food.name}</h3>
                    <div className="flex items-center text-orange-600 dark:text-orange-400 text-xs font-semibold mb-3">
                      <MapPin className="h-3 w-3 mr-1" /> {food.location_hint}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {food.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
