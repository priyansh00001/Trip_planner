"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Map, Plane, Compass, Star, Trash2, Camera, CheckCircle2, ArrowRight, MapPin, Calendar, Wallet } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { TripDebriefModal } from "@/components/TripDebriefModal"

// Destination-specific hero images for trip cards
const cardImages: Record<string, string> = {
  delhi: 'https://images.pexels.com/photos/35255277/pexels-photo-35255277.jpeg?auto=compress&cs=tinysrgb&w=600&h=400&dpr=1',
  mumbai: 'https://images.pexels.com/photos/2260800/pexels-photo-2260800.jpeg?auto=compress&cs=tinysrgb&w=600&h=400&dpr=1',
  goa: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=80&w=600&auto=format&fit=crop',
  jaipur: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?q=80&w=600&auto=format&fit=crop',
  agra: 'https://images.pexels.com/photos/164336/pexels-photo-164336.jpeg?auto=compress&cs=tinysrgb&w=600&h=400&dpr=1',
  kerala: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?q=80&w=600&auto=format&fit=crop',
  varanasi: 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?q=80&w=600&auto=format&fit=crop',
  manali: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?q=80&w=600&auto=format&fit=crop',
  shimla: 'https://images.unsplash.com/photo-1597074866923-dc0589150bf6?q=80&w=600&auto=format&fit=crop',
  udaipur: 'https://images.unsplash.com/photo-1593010452654-e4f62edc4b69?q=80&w=600&auto=format&fit=crop',
  jibhi: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?q=80&w=600&auto=format&fit=crop',
  rishikesh: 'https://images.unsplash.com/photo-1588083949404-c4f1ed1323b3?q=80&w=600&auto=format&fit=crop',
  darjeeling: 'https://images.unsplash.com/photo-1622308644420-0f6e7fa24e0e?q=80&w=600&auto=format&fit=crop',
  leh: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=80&w=600&auto=format&fit=crop',
  ladakh: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=80&w=600&auto=format&fit=crop',
  bangalore: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?q=80&w=600&auto=format&fit=crop',
  kolkata: 'https://images.unsplash.com/photo-1558431382-27e303142255?q=80&w=600&auto=format&fit=crop',
  ooty: 'https://images.unsplash.com/photo-1622308644420-0f6e7fa24e0e?q=80&w=600&auto=format&fit=crop',
  mysore: 'https://images.unsplash.com/photo-1600100397608-e4b1356773fe?q=80&w=600&auto=format&fit=crop',
}

// Fallback: beautiful generic travel landscape
const fallbackImage = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=600&auto=format&fit=crop'

function getCardImage(destination: string) {
  const dest = destination.toLowerCase()
  for (const [key, url] of Object.entries(cardImages)) {
    if (dest.includes(key)) return url
  }
  return fallbackImage
}

export default function DashboardPage() {
  const router = useRouter()
  const [trips, setTrips] = useState<any[]>([])
  const [userName, setUserName] = useState("Traveler")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [debriefTrip, setDebriefTrip] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')

  const upcomingTrips = trips.filter(t => t.status !== 'completed_and_reviewed')
  const pastTrips = trips.filter(t => t.status === 'completed_and_reviewed')
  const activeTrips = activeTab === 'upcoming' ? upcomingTrips : pastTrips;

  // Derived stats
  const destinationsVisited = new Set(trips.map(t => t.destination.toLowerCase())).size;
  const totalActivities = trips.reduce((total, trip) => {
    if (!trip.plan_data || !trip.plan_data.days) return total;
    return total + trip.plan_data.days.reduce((dayTotal: number, day: any) => dayTotal + (day.activities?.length || 0), 0);
  }, 0);

  useEffect(() => {
    async function loadDashboardData() {
      const supabase = createClient()
      
      // Use getSession first to avoid network lock race conditions in Strict Mode
      const { data: { session } } = await supabase.auth.getSession()
      let user: any = session?.user

      if (!user) {
        try {
          const { data } = await supabase.auth.getUser()
          user = data.user
        } catch (err) {
          console.log("Auth lock error ignored in dev mode")
        }
      }

      if (user) {
        // Intercept and migrate any pending guest/anonymous trip planning data
        const anonTripStr = localStorage.getItem("anonymous_trip")
        if (anonTripStr) {
          try {
            const anonTrip = JSON.parse(anonTripStr)
            
            // Only migrate if we have selected stays and selected places
            const { data: newTrip, error: insertError } = await supabase
              .from("trips")
              .insert({
                user_id: user.id,
                destination: anonTrip.destination,
                duration_days: anonTrip.duration_days,
                budget_range: String(anonTrip.budget_range),
                preference: anonTrip.preference || "No Preference",
                status: "generating_itinerary",
                start_date: anonTrip.start_date || new Date().toISOString().split("T")[0],
                plan_data: anonTrip.plan_data || {},
              })
              .select()
              .single()

            if (!insertError && newTrip) {
              localStorage.removeItem("anonymous_trip")
              router.push(`/generate/${newTrip.id}`)
              return
            }
          } catch (e) {
            console.error("Failed to migrate anonymous trip:", e)
          }
        }

        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || "Traveler"
        setUserName(name)

        const { data: userTrips } = await supabase
          .from('trips')
          .select("id, destination, duration_days, budget_range, preference, review_rating, review_text, plan_data, created_at, status")
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          
        if (userTrips) {
          setTrips(userTrips)
        }
      }
    }
    loadDashboardData()
  }, [])

  return (
    <div className="flex flex-col gap-12 p-6 md:p-10 lg:p-14 max-w-6xl mx-auto">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 border-b border-border/50 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--gold)] font-medium mb-3">Welcome back</p>
          <h1 className="font-serif text-4xl md:text-5xl tracking-tight capitalize text-foreground">{userName}</h1>
          <p className="text-muted-foreground mt-2 text-sm tracking-wide">Your curated travel journal</p>
        </motion.div>
        <motion.div 
          className="flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Link href="/memories">
            <button className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-medium px-5 py-3 border border-border/60 hover:bg-foreground/5 transition-all text-foreground">
              <Camera className="h-3.5 w-3.5 text-[var(--gold)]" /> Memories
            </button>
          </Link>
          <Link href="/trip-input">
            <button className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-medium px-5 py-3 bg-foreground text-background hover:bg-foreground/90 transition-all">
              <Plus className="h-3.5 w-3.5" /> New Itinerary
            </button>
          </Link>
        </motion.div>
      </div>

      {/* Editorial Stats — Horizontal with large serif numbers */}
      <motion.div 
        className="grid grid-cols-3 gap-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <div className="text-center">
          <p className="font-serif text-5xl md:text-6xl text-foreground">{trips.length}</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-2">Journeys Planned</p>
        </div>
        <div className="text-center border-x border-border/50">
          <p className="font-serif text-5xl md:text-6xl text-foreground">{destinationsVisited}</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-2">Destinations</p>
        </div>
        <div className="text-center">
          <p className="font-serif text-5xl md:text-6xl text-foreground">{totalActivities}</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-2">Experiences</p>
        </div>
      </motion.div>

      {/* Trips Section */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 border-b border-border/50 pb-4">
          <h2 className="font-serif text-2xl tracking-tight">Your Itineraries</h2>
          
          <div className="flex gap-0">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-5 py-2 text-[10px] uppercase tracking-[0.15em] font-medium border transition-all ${
                activeTab === 'upcoming' 
                  ? 'bg-foreground text-background border-foreground' 
                  : 'border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              Upcoming ({upcomingTrips.length})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`px-5 py-2 text-[10px] uppercase tracking-[0.15em] font-medium border border-l-0 transition-all ${
                activeTab === 'past' 
                  ? 'bg-foreground text-background border-foreground' 
                  : 'border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              Past ({pastTrips.length})
            </button>
          </div>
        </div>
        
        <AnimatePresence mode="wait">
          {activeTrips.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <Compass className="h-12 w-12 text-[var(--gold)] mb-6 opacity-40" />
              <h3 className="font-serif text-2xl mb-3">
                {activeTab === 'upcoming' ? 'No journeys planned yet' : 'No past adventures'}
              </h3>
              <p className="text-muted-foreground text-sm max-w-md mb-8">
                {activeTab === 'upcoming' 
                  ? "Your travel story begins with a single destination. Let our AI craft a bespoke itinerary for you."
                  : "Once you return from a trip, mark it as traveled to build your travel memoir."}
              </p>
              {activeTab === 'upcoming' && (
                <Link href="/trip-input">
                  <button className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-medium px-8 py-4 bg-foreground text-background hover:bg-foreground/90 transition-all">
                    Plan Your First Journey <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </Link>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
            >
              {activeTrips.map((trip, index) => {
                const heroImg = getCardImage(trip.destination)

                return (
                  <motion.div
                    key={trip.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                  >
                    <div className="group overflow-hidden border border-border/50 bg-card/50 backdrop-blur-sm hover:border-[var(--gold)]/30 transition-all duration-500 flex flex-col h-full">
                      {/* Image or gradient header */}
                      <div className="h-40 w-full relative overflow-hidden">
                        {heroImg ? (
                          <div 
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                            style={{ backgroundImage: `url('${heroImg}')` }}
                          />
                        ) : (
                          <div className="absolute inset-0 bg-foreground/5" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                        
                        {/* Status badge */}
                        <span className={`absolute top-4 right-4 text-[9px] uppercase tracking-[0.15em] font-medium px-3 py-1.5 backdrop-blur-md ${
                          trip.status === 'completed_and_reviewed' 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                            : trip.status === 'completed' 
                              ? 'bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]/30' 
                              : 'bg-white/10 text-white/80 border border-white/20 animate-pulse'
                        }`}>
                          {trip.status === 'completed_and_reviewed' ? 'Finished' : trip.status === 'completed' ? 'Ready' : 'Generating'}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="font-serif text-2xl capitalize tracking-tight group-hover:text-[var(--gold)] transition-colors duration-300">
                          {trip.destination}
                        </h3>
                        
                        <div className="flex items-center gap-4 mt-3 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {trip.duration_days} Days
                          </span>
                          <span className="flex items-center gap-1">
                            <Wallet className="h-3 w-3" /> ₹{parseInt(trip.budget_range).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="mt-4 pt-4 border-t border-border/30 flex-1">
                          <p className="text-xs text-muted-foreground">
                            Stay: <span className="text-foreground font-medium">{trip.preference || 'Any'}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground/60 mt-2">
                            {new Date(trip.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="p-5 pt-0 flex flex-col gap-2">
                        <div className="flex gap-2 w-full">
                          <Link href={trip.status.startsWith('completed') ? `/trips/${trip.id}` : `/generate/${trip.id}`} className="flex-1">
                            <button className="w-full flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.15em] font-medium px-4 py-3 bg-foreground text-background hover:bg-foreground/90 transition-all">
                              {trip.status.startsWith('completed') ? 'View Itinerary' : 'Generating...'} 
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </Link>
                          <button 
                            className="shrink-0 px-3 py-3 border border-border/50 text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
                            disabled={deletingId === trip.id}
                            onClick={async () => {
                              if (!confirm('Delete this trip? Your uploaded photos in the Memories gallery will NOT be deleted. This action cannot be undone.')) return;
                              setDeletingId(trip.id);
                              const supabase = createClient();
                              await supabase.from('trips').delete().eq('id', trip.id);
                              setTrips(prev => prev.filter(t => t.id !== trip.id));
                              setDeletingId(null);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        
                        {trip.status === 'completed' && (
                          <button 
                            className="w-full flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.15em] font-medium px-4 py-3 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/5 transition-all"
                            onClick={() => setDebriefTrip(trip)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Traveled
                          </button>
                        )}
                        {trip.status === 'completed_and_reviewed' && (
                          <div className="w-full text-center text-[10px] uppercase tracking-[0.15em] font-medium text-emerald-600 dark:text-emerald-400 py-2.5 bg-emerald-500/5 border border-emerald-500/20">
                            ✓ Journey Complete
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <TripDebriefModal 
        isOpen={!!debriefTrip}
        onClose={() => setDebriefTrip(null)}
        tripId={debriefTrip?.id || ""}
        destination={debriefTrip?.destination || ""}
        onComplete={() => {
          setTrips(prev => prev.map(t => t.id === debriefTrip?.id ? { ...t, status: "completed_and_reviewed" } : t))
          setDebriefTrip(null)
        }}
      />
    </div>
  )
}
