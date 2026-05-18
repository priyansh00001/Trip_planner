"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Shield, Phone, Siren, Heart, HelpCircle, Loader2, Building2, AlertTriangle, ChevronDown, ChevronUp, X } from "lucide-react"

// ═══════════════════════════════════════════════════════════════
// HARDCODED & VERIFIED INDIAN EMERGENCY NUMBERS
// These are universal across ALL of India. They do NOT change.
// Source: Government of India official helplines.
// ═══════════════════════════════════════════════════════════════
const INDIA_EMERGENCY_NUMBERS = [
  { label: "National Emergency", number: "112", icon: Siren, color: "text-red-500", bgColor: "bg-red-500/10", description: "Police, Fire, Ambulance (unified)" },
  { label: "Police", number: "100", icon: Shield, color: "text-blue-500", bgColor: "bg-blue-500/10", description: "Local police station dispatch" },
  { label: "Ambulance", number: "108", icon: Heart, color: "text-rose-500", bgColor: "bg-rose-500/10", description: "Free emergency ambulance service" },
  { label: "Fire Brigade", number: "101", icon: AlertTriangle, color: "text-orange-500", bgColor: "bg-orange-500/10", description: "Fire and rescue services" },
  { label: "Women Helpline", number: "1091", icon: Phone, color: "text-purple-500", bgColor: "bg-purple-500/10", description: "Women safety & domestic violence" },
  { label: "Tourist Helpline", number: "1363", icon: HelpCircle, color: "text-teal-500", bgColor: "bg-teal-500/10", description: "Ministry of Tourism 24/7 helpline" },
  { label: "Disaster Management", number: "1078", icon: Siren, color: "text-amber-500", bgColor: "bg-amber-500/10", description: "NDMA disaster relief" },
  { label: "Road Accident", number: "1073", icon: AlertTriangle, color: "text-yellow-500", bgColor: "bg-yellow-500/10", description: "Highway accident emergency" },
]

interface EmergencyCardProps {
  isOpen: boolean
  onClose: () => void
  destination: string
}

export default function EmergencyCard({ isOpen, onClose, destination }: EmergencyCardProps) {
  const [hospitals, setHospitals] = useState<any[] | null>(null)
  const [loadingHospitals, setLoadingHospitals] = useState(false)
  const [showHospitals, setShowHospitals] = useState(false)

  const fetchHospitals = async () => {
    if (hospitals) {
      setShowHospitals(!showHospitals)
      return
    }
    setLoadingHospitals(true)
    setShowHospitals(true)
    try {
      const res = await fetch("/api/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination })
      })
      const data = await res.json()
      if (data.hospitals) {
        setHospitals(data.hospitals)
      }
    } catch {
      setHospitals([{ name: "Unable to load hospital data. Please search locally.", address: "", phone: "" }])
    } finally {
      setLoadingHospitals(false)
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
            <div className="p-5 border-b bg-red-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl leading-tight">Emergency SOS</h3>
                    <p className="text-sm text-muted-foreground">Verified helplines · {destination}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-red-500 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
                    Verified ✓
                  </span>
                  <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Emergency Numbers Grid */}
              <div className="grid grid-cols-1 gap-3">
                {INDIA_EMERGENCY_NUMBERS.map((item, i) => {
                  const Icon = item.icon
                  return (
                    <a
                      key={i}
                      href={`tel:${item.number}`}
                      className={`flex items-center gap-4 p-4 rounded-xl ${item.bgColor} border border-transparent hover:border-current/10 transition-all group cursor-pointer`}
                    >
                      <div className={`p-2.5 rounded-lg bg-background/80 ${item.color} shadow-sm`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold leading-tight">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{item.description}</p>
                      </div>
                      <div className={`text-2xl font-black ${item.color}`}>{item.number}</div>
                    </a>
                  )
                })}
              </div>

              {/* Nearest Hospitals Section */}
              <div className="mt-6 pt-6 border-t">
                <button
                  onClick={fetchHospitals}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/15 text-red-600 dark:text-red-400 font-semibold text-sm transition-colors"
                >
                  {loadingHospitals ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Finding nearest hospitals...</>
                  ) : (
                    <><Building2 className="h-4 w-4" /> {showHospitals ? "Hide" : "Find"} Nearest Hospitals in {destination}</>
                  )}
                </button>

                {showHospitals && hospitals && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-3">
                    {hospitals.map((h: any, i: number) => (
                      <div key={i} className="p-4 rounded-xl bg-muted/30 border text-sm">
                        <p className="font-bold leading-tight">{h.name}</p>
                        {h.address && <p className="text-xs text-muted-foreground mt-1">{h.address}</p>}
                        {h.phone && (
                          <a href={`tel:${h.phone}`} className="text-xs font-semibold text-red-500 mt-1.5 inline-block hover:underline">
                            📞 {h.phone}
                          </a>
                        )}
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground/50 text-center pt-1">
                      Hospital data is AI-generated. Please verify before relying on it in an emergency.
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Footer Disclaimer */}
              <div className="mt-6 pt-4 border-t">
                <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
                  All emergency numbers are official Government of India helplines and work across all states and union territories. Tap any number to call directly from your device.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
