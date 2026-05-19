"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin, Calendar, Award, Loader2, Plane, Star, ShieldCheck, Sparkles } from "lucide-react"

export default function DashboardProfilePage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [trips, setTrips] = useState<any[]>([])

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      
      const { data: { session } } = await supabase.auth.getSession()
      let currentUser: any = session?.user

      if (!currentUser) {
        try {
          const { data } = await supabase.auth.getUser()
          currentUser = data.user
        } catch (err) {
          console.log("Auth lock error ignored in dev mode")
        }
      }

      setUser(currentUser)

      if (currentUser) {
        const { data: userTrips } = await supabase
          .from('trips')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })

        if (userTrips) {
          setTrips(userTrips)
        }
      }
      setLoading(false)
    }
    
    loadProfile()
  }, [])

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[var(--gold)]" />
      </div>
    )
  }

  // --- Calculate Stats ---
  const completedTrips = trips.filter(t => t.status === "completed_and_reviewed").length
  const totalDays = trips.reduce((acc, t) => acc + (parseInt(t.duration_days) || 0), 0)
  
  const destinations = new Set<string>()
  trips.forEach(t => {
    if (t.destination) {
      destinations.add(t.destination.split(',')[0].trim())
    }
  })
  const uniqueDestinations = destinations.size

  // --- Gamification Badges ---
  const badges = []
  if (trips.length >= 1) badges.push({ name: "First Step", icon: Plane, desc: "Planned your first itinerary" })
  if (completedTrips >= 1) badges.push({ name: "Explorer", icon: MapPin, desc: "Completed an adventure" })
  if (uniqueDestinations >= 3) badges.push({ name: "Globe Trotter", icon: Star, desc: "Visited 3+ cities" })
  if (totalDays >= 14) badges.push({ name: "Seasoned Nomad", icon: Calendar, desc: "Traveled for over 14 days total" })
  if (trips.some(t => (parseInt(t.duration_days) || 0) >= 7)) badges.push({ name: "Long Hauler", icon: ShieldCheck, desc: "Planned a 7+ day trip" })

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 lg:p-10 max-w-5xl mx-auto pb-20 bg-background text-foreground">
      
      {/* Premium Hero Header — Soft Luxury Glass */}
      <div className="relative overflow-hidden rounded-3xl glass-card">
        {/* Soft elegant background glow */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-[var(--gold)]/5 to-transparent blur-3xl opacity-40"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 p-8 md:p-12">
          {/* Avatar */}
          <div className="w-28 h-28 shrink-0 rounded-full bg-gradient-to-tr from-[var(--gold)]/80 to-[var(--gold)] flex items-center justify-center text-background text-4xl font-bold font-serif shadow-lg ring-4 ring-background">
            {user?.user_metadata?.full_name?.[0] || user?.email?.[0].toUpperCase() || "U"}
          </div>
          
          <div className="text-center md:text-left space-y-2">
            <div className="inline-flex items-center rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/5 px-3 py-1 text-xs font-medium text-[var(--gold)] tracking-wider mb-2">
              <Sparkles className="h-3 w-3 mr-2 text-[var(--gold)]" /> Member since {new Date(user?.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <h1 className="text-3xl md:text-4xl font-serif tracking-tight text-foreground">
              {user?.user_metadata?.full_name || "Traveler"}
            </h1>
            <p className="text-muted-foreground text-sm tracking-widest uppercase font-medium">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        
        {/* Left Column: Stats */}
        <div className="md:col-span-1 space-y-6">
          <h2 className="text-xl font-serif tracking-tight px-1 text-foreground">Travel Stats</h2>
          
          <div className="grid gap-4">
            <Card className="glass-card hover:border-[var(--gold)]/40 hover:-translate-y-0.5 transition-all duration-300">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-[var(--gold)]/10 text-[var(--gold)]">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Destinations</p>
                  <p className="text-2xl font-bold font-serif mt-1">{uniqueDestinations}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card hover:border-[var(--gold)]/40 hover:-translate-y-0.5 transition-all duration-300">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-[var(--gold)]/10 text-[var(--gold)]">
                  <Plane className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Trips</p>
                  <p className="text-2xl font-bold font-serif mt-1">{trips.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card hover:border-[var(--gold)]/40 hover:-translate-y-0.5 transition-all duration-300">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-[var(--gold)]/10 text-[var(--gold)]">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold font-serif mt-1">{completedTrips}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card hover:border-[var(--gold)]/40 hover:-translate-y-0.5 transition-all duration-300">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-[var(--gold)]/10 text-[var(--gold)]">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Days Traveled</p>
                  <p className="text-2xl font-bold font-serif mt-1">{totalDays}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column: Trophy Case */}
        <div className="md:col-span-2 space-y-6">
          <h2 className="text-xl font-serif tracking-tight px-1 flex items-center text-foreground">
            <Award className="h-5 w-5 mr-2 text-[var(--gold)]" /> Trophy Case
          </h2>

          <Card className="glass-card overflow-hidden">
            <CardContent className="p-6">
              {badges.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Award className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  Plan your first trip to start earning beautiful badges!
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {badges.map((badge, i) => (
                    <div key={i} className="group relative flex flex-col items-center text-center p-6 rounded-2xl bg-card/40 border border-border/30 hover:border-[var(--gold)]/30 hover:bg-card/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-md backdrop-blur-sm">
                      <div className="absolute inset-0 bg-gradient-to-br from-[var(--gold)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                      <div className="p-4 rounded-full mb-4 shadow-sm bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20 ring-4 ring-background group-hover:scale-110 transition-transform duration-300">
                        <badge.icon className="h-6 w-6" />
                      </div>
                      <h4 className="font-bold text-foreground mb-1 text-sm">{badge.name}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{badge.desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Explored Places */}
          {uniqueDestinations > 0 && (
            <div className="pt-4 space-y-4">
              <h2 className="text-xl font-serif tracking-tight px-1 text-foreground">Places Explored</h2>
              <div className="flex flex-wrap gap-2">
                {Array.from(destinations).map((dest, i) => (
                  <div key={i} className="px-4 py-2 bg-card/60 backdrop-blur-sm border border-border/60 hover:border-[var(--gold)]/20 hover:bg-card rounded-full text-xs uppercase tracking-wider font-medium text-foreground transition-all cursor-default">
                    {dest}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
