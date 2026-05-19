"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function Footer() {
  const pathname = usePathname()
  
  const isHidden = pathname?.startsWith('/generate-stays') || pathname?.startsWith('/generate/') || pathname === '/generate' || ['/login', '/signup', '/forgot-password', '/check-email', '/reset-password'].includes(pathname || '')
  
  if (isHidden) return null
  
  return (
    <footer className="border-t border-border/50 bg-background pt-16 pb-8 mt-auto">
      <div className="container mx-auto max-w-7xl px-6 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
          <div className="space-y-4">
            <span className="font-serif text-2xl tracking-wide text-foreground">Karyakram</span>
            <p className="text-sm text-muted-foreground">
              AI-powered itineraries crafted for every kind of explorer.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="text-[10px] uppercase tracking-[0.2em] font-medium text-[var(--gold)]">Explore</h4>
            <ul className="space-y-3">
              <li><Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Home</Link></li>
              <li><Link href="/trip-input" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Plan a Trip</Link></li>
              <li><Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="text-[10px] uppercase tracking-[0.2em] font-medium text-[var(--gold)]">About</h4>
            <p className="text-sm text-muted-foreground">
              Built for Indian travelers. Discover local gems and iconic destinations effortlessly.
            </p>
          </div>
        </div>
        <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] text-muted-foreground/50">
            © 2025 Karyakram. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
