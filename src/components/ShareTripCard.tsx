"use client"

import { useRef, useState } from "react"
import { Share2, Download, Check, X, MapPin, Calendar, Clock } from "lucide-react"
import * as htmlToImage from 'html-to-image'
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { motion, AnimatePresence } from "framer-motion"

interface ShareTripCardProps {
  plan: any
  trip: any
}

export default function ShareTripCard({ plan, trip }: ShareTripCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleDownload = async () => {
    if (!cardRef.current) return
    setIsGenerating(true)
    
    try {
      const dataUrl = await htmlToImage.toPng(cardRef.current, { 
        quality: 1.0,
        pixelRatio: 3, 
        backgroundColor: '#ffffff'
      })
      
      const link = document.createElement("a")
      link.download = `${plan.destination.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_itinerary.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error("Failed to generate image", err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/trip/public/${trip?.id || 'demo'}`
    
    // Write synchronously to avoid browser NotAllowedError for clipboard
    navigator.clipboard.writeText(url).catch(err => console.error("Clipboard error", err))
    
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)

    // Update DB asynchronously in background so anyone can view the shared link
    if (trip?.id) {
      const supabase = createClient()
      supabase.from('trips').update({ is_public: true }).eq('id', trip.id).then()
    }
  }

  if (!plan) return null

  // Capitalize destination properly
  const destName = plan.destination.charAt(0).toUpperCase() + plan.destination.slice(1)

  return (
    <>
      {/* Inline trigger button that replaces the big ugly card */}
      <div className="w-full flex justify-center mb-10 mt-8 no-print">
        <button 
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] font-medium px-8 py-4 border border-[var(--gold)]/40 hover:bg-[var(--gold)]/5 transition-all text-foreground"
        >
          <Share2 className="h-4 w-4 text-[var(--gold)]" /> Share This Itinerary
        </button>
      </div>

      {/* Full Screen Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-background rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border"
            >
              <button 
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Left Side: The Ticket Preview */}
              <div className="w-full md:w-[400px] bg-muted/30 p-6 sm:p-8 flex items-center justify-center border-r">
                
                {/* The element we actually screenshot - Clean Boarding Pass Design */}
                <div 
                  ref={cardRef}
                  className="w-full max-w-[320px] bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200"
                  style={{ color: '#000' }} // Force light mode colors for the exported image
                >
                  {/* Ticket Header */}
                  <div className="bg-indigo-600 p-5 text-white flex justify-between items-center">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest opacity-80 font-semibold mb-1">Boarding Pass</div>
                      <div className="font-bold text-xl flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> {destName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black">{trip?.duration_days}</div>
                      <div className="text-[10px] uppercase tracking-widest opacity-80 font-semibold">Days</div>
                    </div>
                  </div>

                  {/* Ticket Body */}
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-4 mb-5 pb-5 border-b border-dashed border-gray-300">
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Staying At</div>
                        <div className="font-bold text-sm leading-tight text-gray-900">
                          {plan.confirmed_stay?.name || plan.recommendedStays?.[0]?.name || "To be decided"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Budget</div>
                        <div className="font-bold text-sm text-gray-900">
                          {plan.estimatedCost || "Standard"}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-5 pb-5 border-b border-dashed border-gray-300">
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Best Time</div>
                        <div className="font-bold text-sm text-gray-900 leading-tight">
                          {plan.bestTimeToVisit || "Year Round"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Total Activities</div>
                        <div className="font-bold text-sm text-gray-900">
                          {plan.days?.reduce((sum: number, d: any) => sum + (d.activities?.length || 0), 0) || 0} planned
                        </div>
                      </div>
                    </div>

                    {plan.highlights && plan.highlights.length > 0 && (
                      <>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Highlights</div>
                        <div className="flex flex-wrap gap-1.5">
                          {plan.highlights.slice(0, 5).map((h: string, i: number) => (
                            <span key={i} className="text-[10px] font-semibold bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full border border-indigo-100">
                              {h}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Ticket Footer / Barcode */}
                  <div className="bg-gray-50 p-4 border-t border-dashed border-gray-300 flex items-center justify-between">
                    <div className="flex gap-1 opacity-40">
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
                        <div key={i} className="bg-black" style={{ width: Math.random() > 0.5 ? '2px' : '4px', height: '24px' }} />
                      ))}
                    </div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-right">
                      Generated via<br/>AI Trip Planner
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Actions */}
              <div className="p-8 flex-1 flex flex-col justify-center">
                <h3 className="text-2xl font-bold mb-2">Ready to share?</h3>
                <p className="text-muted-foreground text-sm mb-8">
                  Download this clean itinerary ticket or grab a public link to share the full interactive trip with your friends.
                </p>

                <div className="space-y-3">
                  <Button 
                    size="lg" 
                    onClick={handleDownload} 
                    disabled={isGenerating}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white justify-start px-6"
                  >
                    {isGenerating ? (
                      <span className="flex items-center"><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-3" /> Rendering High-Res Image...</span>
                    ) : (
                      <span className="flex items-center"><Download className="h-5 w-5 mr-3" /> Download Ticket Image</span>
                    )}
                  </Button>
                  
                  <Button 
                    size="lg" 
                    variant="outline" 
                    onClick={handleCopyLink}
                    className="w-full justify-start px-6"
                  >
                    {copied ? (
                      <span className="flex items-center text-emerald-600 dark:text-emerald-500"><Check className="h-5 w-5 mr-3" /> Link Copied to Clipboard!</span>
                    ) : (
                      <span className="flex items-center"><Share2 className="h-5 w-5 mr-3 text-muted-foreground" /> Copy Web Link</span>
                    )}
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground mt-6 text-center">
                  Web links are currently read-only. Your friends won't be able to modify your trip.
                </p>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
