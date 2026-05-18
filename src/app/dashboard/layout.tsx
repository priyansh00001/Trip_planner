"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { Compass, Home, LogOut, MapPin, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home, exact: true },
    { href: "/dashboard/explore", label: "Explore Destinations", icon: Compass },
  ]

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row bg-background">
      {/* Desktop Sidebar — Soft Luxury Editorial */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="flex h-16 items-center border-b border-border/50 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <MapPin className="h-5 w-5 text-[var(--gold)]" />
            <span className="font-serif text-lg tracking-wide text-foreground">
              Trip Planner
            </span>
          </Link>
        </div>
        
        <div className="flex-1 overflow-auto py-6">
          <nav className="grid items-start px-4 text-sm space-y-1">
            {navItems.map(item => {
              const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-all text-[11px] uppercase tracking-[0.15em] font-medium ${
                    isActive 
                      ? "text-foreground bg-foreground/5 border-l-2 border-[var(--gold)]" 
                      : "text-muted-foreground hover:text-foreground hover:bg-foreground/3"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
        
        <div className="p-4 border-t border-border/50">
          <nav className="grid space-y-1">
            <Link
              href="/dashboard/profile"
              className="flex items-center gap-3 px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] font-medium text-muted-foreground transition-all hover:text-foreground"
            >
              <User className="h-4 w-4" />
              Profile
            </Link>
            <Button 
              variant="ghost" 
              onClick={handleLogout}
              className="w-full justify-start text-muted-foreground hover:text-destructive text-[11px] uppercase tracking-[0.15em] font-medium px-4"
            >
              <LogOut className="mr-3 h-4 w-4" />
              Log out
            </Button>
          </nav>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex flex-col flex-1">
        <header className="flex h-14 items-center gap-4 border-b border-border/50 bg-card/50 backdrop-blur-sm px-4 md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[var(--gold)]" />
            <span className="font-serif text-lg">Trip Planner</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/dashboard/explore" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Explore</Link>
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
