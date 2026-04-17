"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Compass, Home, LogOut, MapPin, User, Settings } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden border-r bg-muted/30 md:flex flex-col w-64">
        <div className="flex h-14 items-center justify-between border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <MapPin className="h-6 w-6 text-primary" />
            <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
              AI Trip Planner
            </span>
          </Link>
          <ThemeToggle />
        </div>
        
        <div className="flex-1 overflow-auto py-2">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4 space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-primary transition-all hover:text-primary"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/explore"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
            >
              <Compass className="h-4 w-4" />
              Explore Destinations
            </Link>
          </nav>
        </div>
        
        <div className="mt-auto p-4 border-t">
          <nav className="grid space-y-1">
            <Link
              href="/dashboard/profile"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-primary"
            >
              <User className="h-4 w-4" />
              Profile
            </Link>
            <Button 
              variant="ghost" 
              onClick={handleLogout}
              className="w-full justify-start text-muted-foreground hover:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </nav>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex flex-col flex-1">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/30 px-4 md:hidden">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <MapPin className="h-5 w-5 text-primary" />
            <span>AI Trip Planner</span>
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
