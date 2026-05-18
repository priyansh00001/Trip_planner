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
      let currentUser = session?.user

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
        <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
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
  if (trips.length >= 1) badges.push({ name: "First Step", icon: Plane, desc: "Planned your first itinerary", color: "from-blue-400 to-blue-600" })
  if (completedTrips >= 1) badges.push({ name: "Explorer", icon: MapPin, desc: "Completed an adventure", color: "from-emerald-400 to-emerald-600" })
  if (uniqueDestinations >= 3) badges.push({ name: "Globe Trotter", icon: Star, desc: "Visited 3+ cities", color: "from-purple-400 to-purple-600" })
  if (totalDays >= 14) badges.push({ name: "Seasoned Nomad", icon: Calendar, desc: "Traveled for over 14 days total", color: "from-amber-400 to-orange-500" })
  if (trips.some(t => (parseInt(t.duration_days) || 0) >= 7)) badges.push({ name: "Long Hauler", icon: ShieldCheck, desc: "Planned a 7+ day trip", color: "from-rose-400 to-rose-600" })

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 lg:p-10 max-w-5xl mx-auto pb-20">
      
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-background border border-white/5 shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-3xl opacity-50"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 p-8 md:p-12">
          {/* Avatar */}
          <div className="w-28 h-28 shrink-0 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-4xl font-extrabold shadow-[0_0_30px_rgba(139,92,246,0.3)] ring-4 ring-background">
            {user?.user_metadata?.full_name?.[0] || user?.email?.[0].toUpperCase() || "U"}
          </div>
          
          <div className="text-center md:text-left space-y-2">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-md mb-2">
              <Sparkles className="h-3 w-3 mr-2 text-primary" /> Member since {new Date(user?.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              {user?.user_metadata?.full_name || "Traveler"}
            </h1>
            <p className="text-muted-foreground text-lg">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        
        {/* Left Column: Stats */}
        <div className="md:col-span-1 space-y-6">
          <h2 className="text-xl font-semibold tracking-tight px-1">Travel Stats</h2>
          
          <div className="grid gap-4">
            <Card className="bg-background/40 backdrop-blur-xl border-white/10 shadow-lg hover:bg-background/60 transition-colors">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Destinations</p>
                  <p className="text-2xl font-bold">{uniqueDestinations}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-background/40 backdrop-blur-xl border-white/10 shadow-lg hover:bg-background/60 transition-colors">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500">
                  <Plane className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Trips</p>
                  <p className="text-2xl font-bold">{trips.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-background/40 backdrop-blur-xl border-white/10 shadow-lg hover:bg-background/60 transition-colors">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{completedTrips}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-background/40 backdrop-blur-xl border-white/10 shadow-lg hover:bg-background/60 transition-colors">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Days Traveled</p>
                  <p className="text-2xl font-bold">{totalDays}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column: Trophy Case & Map */}
        <div className="md:col-span-2 space-y-6">
          <h2 className="text-xl font-semibold tracking-tight px-1 flex items-center">
            <Award className="h-5 w-5 mr-2 text-primary" /> Trophy Case
          </h2>

          <Card className="bg-background/40 backdrop-blur-xl border-white/10 shadow-lg overflow-hidden">
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
                    <div key={i} className="group relative flex flex-col items-center text-center p-6 rounded-2xl bg-muted/30 border border-white/5 hover:border-white/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                      <div className={`absolute inset-0 bg-gradient-to-br ${badge.color} opacity-0 group-hover:opacity-5 transition-opacity rounded-2xl`}></div>
                      <div className={`p-4 rounded-full mb-4 shadow-lg bg-gradient-to-br ${badge.color} text-white ring-4 ring-background group-hover:scale-110 transition-transform duration-300`}>
                        <badge.icon className="h-6 w-6" />
                      </div>
                      <h4 className="font-bold text-foreground mb-1">{badge.name}</h4>
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
              <h2 className="text-xl font-semibold tracking-tight px-1">Places Explored</h2>
              <div className="flex flex-wrap gap-2">
                {Array.from(destinations).map((dest, i) => (
                  <div key={i} className="px-4 py-2 bg-muted/40 backdrop-blur-sm border border-white/5 rounded-full text-sm font-medium hover:bg-muted/60 transition-colors cursor-default">
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
