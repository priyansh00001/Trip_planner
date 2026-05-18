import { motion, AnimatePresence } from "framer-motion"
import { ShieldAlert, ThumbsUp, ThumbsDown, Lightbulb, X } from "lucide-react"

interface LocalTipsDrawerProps {
  isOpen: boolean
  onClose: () => void
  localTips: {
    etiquette?: string[]
    scamsToAvoid?: string[]
  }
}

export default function LocalTipsDrawer({ isOpen, onClose, localTips }: LocalTipsDrawerProps) {
  if (!localTips) return null

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
                <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400">
                  <Lightbulb className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold leading-tight text-xl">Local Tips & Scams</h3>
                  <p className="text-sm text-muted-foreground tracking-tight">Stay smart and safe</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {localTips.etiquette && localTips.etiquette.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-lg flex items-center text-emerald-600 dark:text-emerald-400">
                    <ThumbsUp className="h-5 w-5 mr-2" /> Cultural Etiquette
                  </h3>
                  <ul className="space-y-3">
                    {localTips.etiquette.map((tip, idx) => (
                      <li key={idx} className="bg-card p-4 rounded-xl shadow-sm border text-sm font-medium leading-relaxed">
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {localTips.scamsToAvoid && localTips.scamsToAvoid.length > 0 && (
                <div className="space-y-3 mt-8">
                  <h3 className="font-bold text-lg flex items-center text-red-600 dark:text-red-400">
                    <ShieldAlert className="h-5 w-5 mr-2" /> Scams to Avoid
                  </h3>
                  <ul className="space-y-3">
                    {localTips.scamsToAvoid.map((scam, idx) => (
                      <li key={idx} className="bg-red-50 dark:bg-red-950/20 p-4 rounded-xl border border-red-100 dark:border-red-900/50 text-sm font-medium leading-relaxed text-red-900 dark:text-red-200">
                        <ThumbsDown className="h-4 w-4 inline mr-2 text-red-500" />
                        {scam}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
