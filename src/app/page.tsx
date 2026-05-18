"use client"

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check } from "lucide-react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [newsletterState, setNewsletterState] = useState<"idle" | "loading" | "success">("idle");
  const [newsletterData, setNewsletterData] = useState<any>(null);

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setNewsletterState("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setNewsletterData(data);
        setNewsletterState("success");
      } else {
        setNewsletterState("idle");
      }
    } catch {
      setNewsletterState("idle");
    }
  };
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container flex h-16 max-w-7xl mx-auto items-center justify-between px-6 md:px-8">
          <Link href="/" className="font-serif text-lg tracking-wide text-foreground">
            Trip Planner
          </Link>
          <Link
            href="/login"
            className="text-[10px] uppercase tracking-[0.2em] font-medium px-6 py-2.5 bg-foreground text-background hover:bg-foreground/90 transition-all"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col">
        <section className="relative flex-1 flex items-center justify-center px-6 overflow-hidden">
          {/* Background travel photo */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-[0.07] dark:opacity-[0.12]" />
            <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
          </div>

          {/* Ambient glow */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[var(--gold)]/3 rounded-full blur-[120px] pointer-events-none" />

          <div className="container max-w-4xl mx-auto text-center py-28 md:py-40">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--gold)] font-medium mb-6">
                AI-Powered Travel Planning
              </p>

              <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl tracking-tight leading-[1.05]">
                Plan your perfect<br />
                <span className="italic">journey</span>
              </h1>

              <p className="text-muted-foreground mt-6 max-w-lg mx-auto text-sm md:text-base leading-relaxed">
                Tell us where you want to go, your budget, and how many days. 
                Our AI agent will craft a complete itinerary, find the best stays, 
                and plot it all on an interactive map.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
                <Link
                  href="/trip-input"
                  className="inline-flex items-center justify-center text-[10px] uppercase tracking-[0.2em] font-medium px-10 py-4 bg-foreground text-background hover:bg-foreground/90 transition-all"
                >
                  Start Planning
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center text-[10px] uppercase tracking-[0.2em] font-medium px-10 py-4 border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                >
                  View Demo Trip
                </Link>
              </div>

              {/* Feature highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-20 max-w-2xl mx-auto">
                {[
                  { label: "Interactive Maps" },
                  { label: "Live Weather" },
                  { label: "Emergency SOS" },
                  { label: "Budget Splitter" },
                ].map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="flex flex-col items-center gap-2 py-4 border border-border/30"
                  >
                    <span className="text-[10px] uppercase tracking-[0.15em] font-medium text-muted-foreground">{f.label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50">
        <div className="container max-w-7xl mx-auto px-6 md:px-8 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Brand */}
            <div className="space-y-4">
              <span className="font-serif text-lg">Trip Planner</span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Plan smarter, travel better. AI-powered itineraries crafted for every kind of explorer.
              </p>
              <div className="flex gap-3">
                {[
                  { label: "Twitter", path: "M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" },
                  { label: "GitHub", path: "M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4" },
                  { label: "Instagram", path: "M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zM17.5 6.5h.01M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2z" },
                ].map((social) => (
                  <a key={social.label} href="#" className="w-8 h-8 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all" aria-label={social.label}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={social.path}/></svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Product */}
            <div className="space-y-4">
              <h4 className="text-[10px] uppercase tracking-[0.2em] font-medium text-[var(--gold)]">Product</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Features", href: "#" },
                  { label: "Explore Destinations", href: "/dashboard/explore" },
                  { label: "Community Wall", href: "/dashboard/explore#community" },
                  { label: "Trip Memories", href: "/memories" },
                ].map(link => (
                  <li key={link.label}><Link href={link.href} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{link.label}</Link></li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div className="space-y-4">
              <h4 className="text-[10px] uppercase tracking-[0.2em] font-medium text-[var(--gold)]">Company</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "About Us", href: "#" },
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Contact", href: "mailto:support@aitripplanner.com" },
                ].map(link => (
                  <li key={link.label}><Link href={link.href} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{link.label}</Link></li>
                ))}
              </ul>
            </div>

            {/* Newsletter */}
            <div className="space-y-4">
              <h4 className="text-[10px] uppercase tracking-[0.2em] font-medium text-[var(--gold)]">Stay Updated</h4>
              <AnimatePresence mode="wait">
                {newsletterState === "success" && newsletterData ? (
                  <motion.div key="success" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <div className="flex items-center gap-2 text-[var(--gold)]">
                      <Check className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{newsletterData.message}</span>
                    </div>
                    <div className="space-y-2">
                      {newsletterData.recommendations?.map((r: any, i: number) => (
                        <div key={i} className="border border-border/30 p-2.5">
                          <p className="text-[10px] font-medium text-foreground">{r.name}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">{r.why}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-xs text-muted-foreground mb-3">Get monthly trip recommendations and new features.</p>
                    <form className="flex gap-2" onSubmit={handleNewsletter}>
                      <input 
                        type="email" 
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="flex-1 border border-border/50 bg-transparent px-3 py-2 text-xs focus:outline-none focus:border-[var(--gold)] transition-colors" 
                        required
                      />
                      <button 
                        type="submit"
                        disabled={newsletterState === "loading"}
                        className="text-[9px] uppercase tracking-[0.15em] font-medium px-4 py-2 bg-foreground text-background hover:bg-foreground/90 transition-all disabled:opacity-50"
                      >
                        {newsletterState === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Join"}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-16 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[10px] text-muted-foreground/50">
              © {new Date().getFullYear()} AI Trip Planner. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors">Terms</Link>
              <span className="text-[10px] text-muted-foreground/50">Made with ❤️ in India</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
