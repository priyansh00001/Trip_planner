"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Plus, Map, Plane, Compass, Star, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

export default function DashboardPage() {
  const [trips, setTrips] = useState<any[]>([])
  const [userName, setUserName] = useState("Traveler")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function loadDashboardData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Use full_name from Google OAuth if available, otherwise fallback to the first part of their email
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || "Traveler"
        setUserName(name)

        // Fetch their actual trips from DB
        const { data: userTrips } = await supabase
          .from('trips')
          .select('*')
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
        <Link href="/trip-input">
          <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 shadow-md">
            <Plus className="mr-2 h-4 w-4" /> New AI Itinerary
          </Button>
        </Link>
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
            <CardTitle className="text-sm font-medium">Countries Visited</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saved Places</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>

      {/* Trips Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Your Upcoming Trips</h2>
        
        {trips.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Compass className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No trips planned yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              You haven't generated any AI itineraries yet. Tell us where you want to go and we'll handle the rest.
            </p>
            <Link href="/trip-input">
              <Button size="lg" className="bg-gradient-to-r from-indigo-500 to-purple-600">
                Plan Your First Trip
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <Card key={trip.id} className="overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group border-primary/10">
                <CardHeader className="pb-4 bg-muted/30">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl capitalize group-hover:text-primary transition-colors">{trip.destination}</CardTitle>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${trip.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse'}`}>
                      {trip.status}
                    </span>
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
                <CardFooter className="p-4 pt-0 flex gap-2">
                  <Link href={trip.status === 'completed' ? `/trips/${trip.id}` : `/generate/${trip.id}`} className="flex-1">
                    <Button 
                      variant={trip.status === 'completed' ? "default" : "secondary"} 
                      className="w-full font-semibold"
                    >
                      {trip.status === 'completed' ? 'View Itinerary' : 'Still Generating...'}
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
                    disabled={deletingId === trip.id}
                    onClick={async () => {
                      if (!confirm('Delete this trip? This cannot be undone.')) return;
                      setDeletingId(trip.id);
                      const supabase = createClient();
                      await supabase.from('trips').delete().eq('id', trip.id);
                      setTrips(prev => prev.filter(t => t.id !== trip.id));
                      setDeletingId(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
