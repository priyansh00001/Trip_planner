import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Languages, Volume2, Loader2, X } from "lucide-react"

interface Phrase {
  english: string
  local: string
  pronunciation: string
}

interface LanguageDrawerProps {
  isOpen: boolean
  onClose: () => void
  destination: string
}

export default function LanguageDrawer({ isOpen, onClose, destination }: LanguageDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<{ language: string, phrases: Phrase[] } | null>(null)

  useEffect(() => {
    if (isOpen && !data && destination) {
      fetchPhrases()
    }
  }, [isOpen, destination])

  const fetchPhrases = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/phrases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination })
      })
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Simple Web Speech API for TTS
  const speak = (text: string, langHint: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      // Attempt to pick an Indian voice if available
      const voices = window.speechSynthesis.getVoices()
      const indianVoice = voices.find(v => v.lang.includes('hi-IN') || v.lang.includes('en-IN'))
      if (indianVoice) utterance.voice = indianVoice
      
      utterance.rate = 0.85 // slightly slower for clarity
      window.speechSynthesis.speak(utterance)
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
            <div className="p-5 border-b bg-muted/20 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
                  <Languages className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold leading-tight text-xl">Local Phrasebook</h3>
                  {data ? (
                    <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium tracking-tight">Language: {data.language}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground tracking-tight">Essential survival phrases</p>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-40 space-y-4 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                  <p className="text-sm font-medium">Translating phrases for {destination}...</p>
                </div>
              ) : data ? (
                <div className="grid gap-4 pb-8">
                  {data.phrases.map((phrase, idx) => (
                    <div key={idx} className="bg-card rounded-xl p-4 border shadow-sm relative overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        {phrase.english}
                      </p>
                      
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-bold text-foreground mb-0.5">
                            {phrase.local}
                          </p>
                          <p className="text-sm italic text-indigo-600 dark:text-indigo-400">
                            "{phrase.pronunciation}"
                          </p>
                        </div>
                        
                        <button 
                          onClick={() => speak(phrase.local, data.language)}
                          className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 transition-colors"
                          title="Listen"
                        >
                          <Volume2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  Failed to load phrases.
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
