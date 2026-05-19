"use client"

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, Map, Sun, Shield, Wallet, Search, Sparkles } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/trip-input?destination=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      
      {/* Hero Section */}
      <main className="flex-1 flex flex-col -mt-[96px]">
        <section className="relative flex-1 flex items-center justify-center px-6 overflow-hidden">
          {/* Background travel photo */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-[0.07] dark:opacity-[0.12]" />
            <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
          </div>

          {/* Ambient glow */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[var(--gold)]/3 rounded-full blur-[120px] pointer-events-none" />

          <div className="container max-w-4xl mx-auto text-center pt-36 pb-20 md:pt-44 md:pb-28">
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

              <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto mt-10 relative">
                <div className="relative flex items-center bg-card/65 border border-[var(--gold)]/20 shadow-lg rounded-full backdrop-blur-md p-1.5 focus-within:border-[var(--gold)]/50 focus-within:ring-2 focus-within:ring-[var(--gold)]/5 transition-all">
                  <div className="pl-4 text-muted-foreground/60 shrink-0">
                    <Search className="h-5 w-5 text-[var(--gold)]" />
                  </div>
                  <input
                    type="text"
                    placeholder="Where do you want to escape? (e.g., Jaipur, Goa...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-0 outline-none px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground/45 font-medium font-sans"
                  />
                  <button
                    type="submit"
                    className="shrink-0 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-bold px-6 py-3.5 bg-foreground text-background rounded-full hover:bg-foreground/90 transition-all cursor-pointer"
                  >
                    Explore
                  </button>
                </div>
              </form>

              <div className="mt-4 flex flex-wrap justify-center gap-2.5 text-xs text-muted-foreground font-sans">
                <span className="opacity-60">Popular:</span>
                {["Jaipur", "Goa", "Kerala"].map((pop) => (
                  <button
                    key={pop}
                    onClick={() => {
                      setSearchQuery(pop)
                      router.push(`/trip-input?destination=${encodeURIComponent(pop)}`)
                    }}
                    className="hover:text-[var(--gold)] transition-colors underline decoration-border/40 underline-offset-4 font-medium"
                  >
                    {pop}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/trip-input"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] font-bold px-8 py-4 bg-[var(--gold)] text-background rounded-full hover:bg-[var(--gold)]/90 shadow-lg shadow-[var(--gold)]/10 hover:shadow-[var(--gold)]/20 transition-all cursor-pointer"
                >
                  Start Planning Your Free Trip <Sparkles className="h-3.5 w-3.5" />
                </Link>
                <a
                  href="#curated-escapes"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] font-bold px-8 py-4 border border-[var(--gold)]/25 text-[var(--gold)] hover:bg-[var(--gold)] hover:text-background rounded-full transition-all cursor-pointer"
                >
                  Explore Destinations
                </a>
              </div>

            </motion.div>
          </div>
        </section>
      </main>

      
      {/* Sections A, B, C */}
      <section className="py-24 px-6 bg-background">
        <div className="container max-w-7xl mx-auto">
          {/* Section A - How it Works */}
          <div className="mb-32">
            <h2 className="font-serif text-3xl md:text-4xl text-center mb-16">How it works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {[
                { step: "01", title: "Tell us your destination, budget, and dates", desc: "Share your basics and let AI handle the heavy lifting." },
                { step: "02", title: "Pick your basecamp hotel from real options", desc: "Select a curated stay that matches your travel style." },
                { step: "03", title: "Select places to visit — get a full day-by-day plan", desc: "Choose attractions and we'll map out a perfect itinerary." }
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2 }}
                  className="flex flex-col items-center text-center p-8 rounded-3xl border border-border/30 bg-card/30 hover:bg-card/50 hover:border-[var(--gold)]/20 backdrop-blur-sm transition-all duration-500"
                >
                  <div className="w-12 h-12 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] flex items-center justify-center font-bold text-lg mb-6 border border-[var(--gold)]/20">
                    {item.step}
                  </div>
                  <h3 className="font-serif text-xl mb-3">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Section: Curated Destinations */}
          <div id="curated-escapes" className="scroll-mt-24 mb-32">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--gold)] font-bold mb-3">Pre-Designed Routes</p>
              <h2 className="font-serif text-3xl md:text-4xl">Curated Luxury Escapes</h2>
              <p className="text-muted-foreground text-sm mt-3 font-sans">
                Instantly unlock premium expert-crafted itineraries for the most breathtaking escapes. Fully customizable in one click.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 font-sans">
              {[
                {
                  title: "Imperial Jaipur",
                  desc: "Wander through palaces, magnificent sandstone forts, and royal observatories steeped in history.",
                  img: "https://images.unsplash.com/photo-1477587458883-47145ed94245?q=80&w=600&auto=format&fit=crop",
                  tag: "5 Days · Heritage",
                  query: "destination=Jaipur&days=5&budget=35000&preference=Hotel"
                },
                {
                  title: "Coastal Goa",
                  desc: "Savor gourmet sea cuisines, watch fiery sunfalls, and explore hidden Portuguese colonial quarters.",
                  img: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=80&w=600&auto=format&fit=crop",
                  tag: "4 Days · Beachfront",
                  query: "destination=Goa&days=4&budget=28000&preference=Hotel"
                },
                {
                  title: "Serene Kerala",
                  desc: "Glide down quiet emerald channels on houseboats and wander misty spice hill plantations.",
                  img: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?q=80&w=600&auto=format&fit=crop",
                  tag: "6 Days · Backwaters",
                  query: "destination=Kerala&days=6&budget=45000&preference=Homestay 🏡"
                },
                {
                  title: "Mystique Ladakh",
                  desc: "Cross breathtaking high mountain paths, admire salt-blue lakes, and visit ancient monasteries.",
                  img: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=80&w=600&auto=format&fit=crop",
                  tag: "7 Days · Adventure",
                  query: "destination=Leh Ladakh&days=7&budget=60000&preference=Hotel"
                }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="group relative overflow-hidden rounded-2xl border border-border/30 bg-card/30 hover:bg-card/50 hover:border-[var(--gold)]/20 backdrop-blur-sm transition-all duration-500 flex flex-col h-full hover:-translate-y-1"
                >
                  <div className="h-44 w-full relative overflow-hidden">
                    <div 
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                      style={{ backgroundImage: `url('${item.img}')` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                    <span className="absolute top-4 right-4 text-[9px] uppercase tracking-[0.15em] font-bold px-3 py-1.5 backdrop-blur-md bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]/30 rounded-full">
                      {item.tag}
                    </span>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between gap-4 font-sans">
                    <div>
                      <h3 className="font-serif text-xl tracking-tight text-foreground group-hover:text-[var(--gold)] transition-colors duration-300">
                        {item.title}
                      </h3>
                      <p className="text-muted-foreground text-xs leading-relaxed mt-2">
                        {item.desc}
                      </p>
                    </div>
                    <Link
                      href={`/trip-input?${item.query}`}
                      className="inline-flex items-center justify-center text-[10px] uppercase tracking-[0.2em] font-bold py-3.5 border border-[var(--gold)]/25 text-[var(--gold)] hover:bg-[var(--gold)] hover:text-background rounded-full transition-all text-center w-full cursor-pointer"
                    >
                      Bespoke Customize
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Section B - Features Grid */}
          <div className="mb-32">
            <h2 className="font-serif text-3xl md:text-4xl text-center mb-16">Everything you need</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Map, title: "Interactive Maps", desc: "Visual routes with estimated travel times and distances." },
                { icon: Sun, title: "Live Weather", desc: "Real-time forecasts so you can pack and plan perfectly." },
                { icon: Shield, title: "Emergency SOS", desc: "One-tap access to local emergency contacts and safe spots." },
                { icon: Wallet, title: "Budget Splitter", desc: "Keep track of expenses effortlessly while on the go." }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-card rounded-2xl p-8 hover:-translate-y-1 hover:border-[var(--gold)]/40 transition-all duration-500"
                >
                  <feature.icon className="h-8 w-8 text-[var(--gold)] mb-6" />
                  <h3 className="font-serif text-xl mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Section C - Social Proof */}
          <div>
            <h2 className="font-serif text-3xl md:text-4xl text-center mb-16">Travelers love Karyakram</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { text: "Finally a travel app that gets Indian destinations right", author: "Priya M." },
                { text: "Planned our Rajasthan trip in 10 minutes", author: "Arjun K." },
                { text: "The budget breakdown saved us from overspending", author: "Sneha R." }
              ].map((testimonial, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2 }}
                  className="glass-card rounded-2xl p-8 hover:-translate-y-1 hover:border-[var(--gold)]/40 transition-all duration-500 relative"
                >
                  <span className="absolute top-6 left-6 text-4xl text-[var(--gold)]/20 font-serif">"</span>
                  <p className="text-foreground/80 italic font-serif text-lg leading-relaxed relative z-10 mb-6 mt-4">
                    {testimonial.text}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--gold)] font-medium">
                    — {testimonial.author}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
