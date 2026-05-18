"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Map, Plane, Compass, Star, Trash2, Camera, CheckCircle2, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { ThemeToggle } from "@/components/theme-toggle"
import { TripDebriefModal } from "@/components/TripDebriefModal"

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
    <div className="flex flex-col gap-8 p-4 md:p-8 lg:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight capitalize">Hello, {userName} 👋</h1>
          <p className="text-muted-foreground">Manage your trips and discover new adventures.</p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/memories">
            <Button variant="outline" className="shadow-sm font-semibold">
              <Camera className="mr-2 h-4 w-4" /> Memories
            </Button>
          </Link>
          <Link href="/trip-input">
            <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 shadow-md">
              <Plus className="mr-2 h-4 w-4" /> New AI Itinerary
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trips Planned</CardTitle>
            <Map className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trips.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Destinations Visited</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{destinationsVisited}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activities Planned</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActivities}</div>
          </CardContent>
        </Card>
      </div>

      {/* Trips Section */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <h2 className="text-xl font-semibold">Your Trips</h2>
          
          <div className="flex bg-muted p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'upcoming' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Upcoming ({upcomingTrips.length})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'past' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Past Adventures ({pastTrips.length})
            </button>
          </div>
        </div>
        
        {activeTrips.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Compass className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {activeTab === 'upcoming' ? 'No trips planned yet' : 'No past adventures yet'}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              {activeTab === 'upcoming' 
                ? "You haven't generated any AI itineraries yet. Tell us where you want to go and we'll handle the rest."
                : "You haven't completed any trips yet. Once you return from a trip, mark it as traveled to see it here."}
            </p>
            {activeTab === 'upcoming' && (
              <Link href="/trip-input">
                <Button size="lg" className="bg-gradient-to-r from-indigo-500 to-purple-600">
                  Plan Your First Trip
                </Button>
              </Link>
            )}
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {activeTrips.map((trip) => {
              // Generate a stable random gradient based on destination string
              const hash = trip.destination.split('').reduce((acc: number, char: string) => char.charCodeAt(0) + ((acc << 5) - acc), 0)
              const hue = Math.abs(hash) % 360
              const gradientStyle = {
                background: `linear-gradient(135deg, hsl(${hue}, 80%, 60%), hsl(${(hue + 40) % 360}, 80%, 40%))`
              }

              return (
              <Card key={trip.id} className="overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group border-primary/10">
                <div className="h-24 w-full relative" style={gradientStyle}>
                  <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
                  <span className={`absolute top-4 right-4 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm ${trip.status.startsWith('completed') ? 'bg-white text-emerald-700 dark:bg-zinc-900 dark:text-emerald-400' : 'bg-white text-blue-700 dark:bg-zinc-900 dark:text-blue-400 animate-pulse'}`}>
                    {trip.status === 'completed_and_reviewed' ? 'Finished' : trip.status === 'completed' ? 'Ready' : 'Generating...'}
                  </span>
                </div>
                <CardHeader className="pb-2 pt-4">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl capitalize group-hover:text-primary transition-colors">{trip.destination}</CardTitle>
                  </div>
                  <CardDescription className="flex items-center mt-2 font-medium">
                    {trip.duration_days} Days • ₹{parseInt(trip.budget_range).toLocaleString('en-IN')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 p-4">
                  <p className="text-sm text-muted-foreground">
                    Stay Preference: <span className="font-semibold text-foreground">{trip.preference || 'Any'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-4">
                    Generated on {new Date(trip.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
                <CardFooter className="p-4 pt-0 flex flex-col gap-2">
                  <div className="flex gap-2 w-full">
                    <Link href={trip.status.startsWith('completed') ? `/trips/${trip.id}` : `/generate/${trip.id}`} className="flex-1">
                      <Button 
                        variant={trip.status.startsWith('completed') ? "default" : "secondary"} 
                        className="w-full font-semibold"
                      >
                        {trip.status.startsWith('completed') ? 'View Itinerary' : 'Still Generating...'}
                      </Button>
                    </Link>
                    <Button 
                      variant="outline" 
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
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
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {trip.status === 'completed' && (
                    <Button 
                      variant="outline" 
                      className="w-full text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      onClick={() => setDebriefTrip(trip)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Mark as Traveled
                    </Button>
                  )}
                  {trip.status === 'completed_and_reviewed' && (
                    <div className="w-full text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-md">
                      ✓ Trip Completed
                    </div>
                  )}
                </CardFooter>
              </Card>
              )
            })}
          </div>
        )}
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
