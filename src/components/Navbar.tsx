"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { createClient } from "@/lib/supabase/client"
import { Menu, X, ArrowLeft } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  
  const isHidden = pathname?.startsWith('/generate-stays') || pathname?.startsWith('/generate/') || pathname === '/generate' || ['/login', '/signup', '/forgot-password', '/check-email', '/reset-password'].includes(pathname || '')
  
  useEffect(() => {
    const supabase = createClient()
    
    // Get initial session
    async function getInitialSession() {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
    }
    getInitialSession()

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])
  
  if (isHidden) return null
  
  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <div className="sticky top-4 left-0 right-0 z-50 w-full px-4 md:px-8 max-w-7xl mx-auto mb-6">
      <nav className="rounded-full border border-[var(--gold)]/20 bg-card/70 backdrop-blur-md shadow-lg shadow-foreground/3">
        <div className="px-6 md:px-8 h-14 flex items-center justify-between">
          {pathname?.startsWith('/trips/') || pathname?.startsWith('/select-stay/') || pathname?.startsWith('/pick-places/') ? (
            <Link href="/dashboard" className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] font-bold text-muted-foreground hover:text-foreground transition-colors bg-card/50 backdrop-blur-sm border border-border/40 px-3.5 py-2 rounded-full hover:bg-foreground/5 shadow-sm">
              <ArrowLeft className="h-3.5 w-3.5 text-[var(--gold)]" /> Back to Dashboard
            </Link>
          ) : (
            <Link href="/" className="font-serif text-xl tracking-wide text-foreground hover:text-[var(--gold)] transition-colors">
              Karyakram
            </Link>
          )}
          
          <div className="hidden md:flex items-center gap-8">
            {user && (
              <Link href="/dashboard" className={`text-[10px] uppercase tracking-[0.25em] font-bold transition-all ${pathname === '/dashboard' ? 'text-[var(--gold)]' : 'text-muted-foreground hover:text-foreground'}`}>
                My Trips
              </Link>
            )}
            <Link href="/trip-input" className={`text-[10px] uppercase tracking-[0.25em] font-bold transition-all ${pathname === '/trip-input' ? 'text-[var(--gold)]' : 'text-muted-foreground hover:text-foreground'}`}>
              Plan a Trip
            </Link>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            {user ? (
              <div className="relative group">
                <button className="flex items-center gap-2 text-xs font-medium text-foreground px-2.5 py-1.5 border border-border/50 rounded-full hover:bg-foreground/5 transition-colors">
                  <div className="h-5 w-5 rounded-full bg-[var(--gold)] text-background flex items-center justify-center font-bold text-[10px]">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-card border border-border/50 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 overflow-hidden">
                  <Link href="/dashboard" className="block px-4 py-3 text-xs uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:bg-foreground/5 border-b border-border/50">
                    Dashboard
                  </Link>
                  <Link href="/dashboard/profile" className="block px-4 py-3 text-xs uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:bg-foreground/5 border-b border-border/50">
                    Profile
                  </Link>
                  <button onClick={handleSignOut} className="w-full text-left px-4 py-3 text-xs uppercase tracking-[0.1em] text-destructive hover:bg-destructive/5">
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <Link href="/login" className="text-[9px] uppercase tracking-[0.25em] font-bold px-5 py-2 bg-foreground text-background rounded-full hover:bg-foreground/90 transition-all">
                Sign In
              </Link>
            )}
          </div>
          
          <div className="md:hidden flex items-center gap-4">
            <ThemeToggle />
            <button onClick={() => setIsOpen(!isOpen)} className="text-foreground">
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        
        {isOpen && (
          <div className="md:hidden absolute top-16 left-4 right-4 bg-card/95 backdrop-blur-md border border-[var(--gold)]/20 shadow-xl rounded-3xl p-6 flex flex-col gap-6">
            {user && (
              <Link href="/dashboard" onClick={() => setIsOpen(false)} className={`text-xs uppercase tracking-[0.2em] font-medium ${pathname === '/dashboard' ? 'text-[var(--gold)]' : 'text-foreground'}`}>
                My Trips
              </Link>
            )}
            <Link href="/trip-input" onClick={() => setIsOpen(false)} className={`text-xs uppercase tracking-[0.2em] font-medium ${pathname === '/trip-input' ? 'text-[var(--gold)]' : 'text-foreground'}`}>
              Plan a Trip
            </Link>
            <div className="h-px bg-border/50 w-full" />
            {user ? (
              <>
                <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                <Link href="/dashboard/profile" onClick={() => setIsOpen(false)} className={`text-xs uppercase tracking-[0.2em] font-medium ${pathname === '/dashboard/profile' ? 'text-[var(--gold)]' : 'text-foreground'}`}>
                  Profile
                </Link>
                <button onClick={() => { handleSignOut(); setIsOpen(false); }} className="text-left text-xs uppercase tracking-[0.2em] font-medium text-destructive">
                  Sign Out
                </button>
              </>
            ) : (
              <Link href="/login" onClick={() => setIsOpen(false)} className="text-xs uppercase tracking-[0.2em] font-medium text-foreground">
                Sign In
              </Link>
            )}
          </div>
        )}
      </nav>
    </div>
  )
}
