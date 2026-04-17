import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { MapPin, Plane, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-7xl mx-auto items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <MapPin className="h-6 w-6 text-primary" />
            <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              AI Trip Planner
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button>Get Started</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="w-full py-24 md:py-32 lg:py-48 flex items-center justify-center">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="inline-flex items-center rounded-lg bg-muted px-3 py-1 text-sm font-medium">
                <Sparkles className="mr-2 h-4 w-4" />
                <span>AI-Powered Itineraries in Seconds</span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl">
                Plan your perfect journey with{" "}
                <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  Intelligent Agent
                </span>
              </h1>
              <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed pb-4">
                Tell us where you want to go, your budget, and how many days. Our AI agent will build a complete itinerary, find the best stays, and plot it all on an interactive map.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:opacity-90">
                  <Plane className="h-4 w-4" />
                  Start Planning for Free
                </Button>
                <Button size="lg" variant="outline">
                  View Demo Trip
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
