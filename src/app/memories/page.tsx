"use client"

import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Camera, Download, Image as ImageIcon, Loader2, MapPin, CalendarDays, ArrowLeft, Plus, Trash2, Globe, Lock, Film } from "lucide-react"
import Link from "next/link"
import * as htmlToImage from "html-to-image"

import { createClient } from "@/lib/supabase/client"
import { TripDebriefModal } from "@/components/TripDebriefModal"

interface Memory {
  id: string
  photo_url: string
  description: string
  created_at: string
}

interface TripMemories {
  id: string
  destination: string
  duration_days: number
  start_date: string
  is_public: boolean
  memories: Memory[]
}

export default function MemoriesPage() {
  const [trips, setTrips] = useState<TripMemories[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [isGeneratingCollage, setIsGeneratingCollage] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [selectedForDeletion, setSelectedForDeletion] = useState<string[]>([])
  const collageRef = useRef<HTMLDivElement>(null)

  const loadMemories = async () => {
    setLoading(true)
    const supabase = createClient()
    
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

    if (!user) return

    const { data: tripsData } = await supabase
      .from("trips")
      .select("id, destination, duration_days, start_date, is_public")
      .eq("user_id", user.id)
      .eq("status", "completed_and_reviewed")
      .order("created_at", { ascending: false })

    if (!tripsData || tripsData.length === 0) {
      setLoading(false)
      return
    }

    const { data: memoriesData } = await supabase
      .from("memories")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    const grouped = tripsData.map(trip => ({
      ...trip,
      memories: (memoriesData || []).filter(m => m.trip_id === trip.id)
    }))

    setTrips(grouped)
    if (grouped.length > 0) setSelectedTripId(grouped[0].id)
    setLoading(false)
  }

  useEffect(() => { loadMemories() }, [])

  const handleTogglePublicStatus = async (tripId: string, currentStatus: boolean) => {
    const supabase = createClient()
    const newStatus = !currentStatus
    setTrips(prev => prev.map(t => t.id === tripId ? { ...t, is_public: newStatus } : t))
    await supabase.from("trips").update({ is_public: newStatus }).eq("id", tripId)
  }

  const handleDeleteMemory = async (memory: Memory) => {
    if (!confirm("Are you sure you want to delete this photo?")) return
    setTrips(prev => prev.map(t => {
      if (t.id === selectedTripId) return { ...t, memories: t.memories.filter(m => m.id !== memory.id) }
      return t
    }))
    const supabase = createClient()
    await supabase.from("memories").delete().eq("id", memory.id)
    const urlParts = memory.photo_url.split('/trip_photos/')
    if (urlParts.length > 1) await supabase.storage.from('trip_photos').remove([urlParts[1]])
  }

  const handleDeleteMultiple = async () => {
    if (selectedForDeletion.length === 0) return
    if (!confirm(`Delete ${selectedForDeletion.length} photo(s)?`)) return
    setTrips(prev => prev.map(t => {
      if (t.id === selectedTripId) return { ...t, memories: t.memories.filter(m => !selectedForDeletion.includes(m.id)) }
      return t
    }))
    const supabase = createClient()
    const memoriesToDelete = trips.find(t => t.id === selectedTripId)?.memories.filter(m => selectedForDeletion.includes(m.id)) || []
    await supabase.from("memories").delete().in("id", selectedForDeletion)
    const paths = memoriesToDelete.map(m => {
      const parts = m.photo_url.split('/trip_photos/')
      return parts.length > 1 ? parts[1] : null
    }).filter(Boolean) as string[]
    if (paths.length > 0) await supabase.storage.from('trip_photos').remove(paths)
    setSelectedForDeletion([])
  }

  const handleDownloadCollage = async (trip: TripMemories) => {
    if (!collageRef.current || trip.memories.length === 0) return
    setIsGeneratingCollage(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      const dataUrl = await htmlToImage.toPng(collageRef.current, {
        quality: 0.95, pixelRatio: 2, cacheBust: true,
        fetchRequestInit: { cache: 'no-cache' }
      })
      const link = document.createElement("a")
      link.download = `${trip.destination}-memories.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error("Failed to generate collage:", err)
      alert("Failed to generate collage. Please ensure your photos are fully loaded.")
    } finally {
      setIsGeneratingCollage(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--gold)] mx-auto mb-4" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Loading your memories</p>
        </div>
      </div>
    )
  }

  const selectedTrip = trips.find(t => t.id === selectedTripId)

  return (
    <div className="min-h-screen bg-background">


      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row gap-10">
        
        {/* Sidebar */}
        <aside className="w-full md:w-56 shrink-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-5">Your Journeys</p>

          {trips.length === 0 ? (
            <div className="border border-dashed border-border/60 p-6 text-center">
              <Camera className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Complete a trip and mark it as traveled to see your memories here.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {trips.map(trip => (
                <button
                  key={trip.id}
                  onClick={() => { setSelectedTripId(trip.id); setSelectedForDeletion([]) }}
                  className={`w-full text-left px-4 py-3 transition-all border-l-2 ${
                    selectedTripId === trip.id
                      ? 'border-l-[var(--gold)] bg-foreground/5 text-foreground'
                      : 'border-l-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/3'
                  }`}
                >
                  <div className="font-medium capitalize text-sm">{trip.destination}</div>
                  <div className="text-[10px] uppercase tracking-[0.1em] mt-0.5 opacity-60">
                    {trip.memories.length} {trip.memories.length === 1 ? 'photo' : 'photos'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Main Gallery */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {selectedTrip ? (
              <motion.div
                key={selectedTrip.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-8"
              >
                {/* Trip Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-border/50">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--gold)] mb-2">
                      {selectedTrip.duration_days} Days · {selectedTrip.memories.length} Memories
                    </p>
                    <h1 className="font-serif text-4xl capitalize tracking-tight">{selectedTrip.destination}</h1>
                    <div className="flex items-center gap-4 mt-3">
                      <button
                        onClick={() => handleTogglePublicStatus(selectedTrip.id, selectedTrip.is_public)}
                        className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] font-medium px-3 py-1.5 border transition-all ${
                          selectedTrip.is_public
                            ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10'
                            : 'border-border/50 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {selectedTrip.is_public
                          ? <><Globe className="h-3 w-3" /> Public</>
                          : <><Lock className="h-3 w-3" /> Private</>
                        }
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {selectedForDeletion.length > 0 ? (
                      <>
                        <button
                          onClick={() => setSelectedForDeletion([])}
                          className="text-[10px] uppercase tracking-[0.15em] font-medium px-4 py-2.5 border border-border/50 text-muted-foreground hover:text-foreground transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDownloadCollage(selectedTrip)}
                          disabled={isGeneratingCollage}
                          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] font-medium px-4 py-2.5 border border-[var(--gold)]/40 text-[var(--gold)] hover:bg-[var(--gold)]/5 transition-all disabled:opacity-50"
                        >
                          {isGeneratingCollage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                          Collage ({Math.min(selectedForDeletion.length, 9)})
                        </button>
                        <button
                          onClick={handleDeleteMultiple}
                          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] font-medium px-4 py-2.5 border border-destructive/40 text-destructive hover:bg-destructive/5 transition-all"
                        >
                          <Trash2 className="h-3 w-3" /> Delete ({selectedForDeletion.length})
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setIsUploadingPhoto(true)}
                          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] font-medium px-4 py-2.5 border border-border/60 text-muted-foreground hover:text-foreground transition-all"
                        >
                          <Plus className="h-3 w-3" /> Add Photos
                        </button>
                        <button
                          onClick={() => handleDownloadCollage(selectedTrip)}
                          disabled={isGeneratingCollage || selectedTrip.memories.length === 0}
                          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] font-medium px-4 py-2.5 bg-foreground text-background hover:bg-foreground/90 transition-all disabled:opacity-40"
                        >
                          {isGeneratingCollage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                          Download Collage
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Polaroid Gallery */}
                {selectedTrip.memories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-28 border border-dashed border-border/50 text-center">
                    <Camera className="h-12 w-12 text-muted-foreground/20 mb-5" />
                    <h3 className="font-serif text-2xl mb-2">No photos yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-6">
                      Upload photos from your trip to build your visual memoir.
                    </p>
                    <button
                      onClick={() => setIsUploadingPhoto(true)}
                      className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-medium px-6 py-3 bg-foreground text-background hover:bg-foreground/90 transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" /> Upload First Photo
                    </button>
                  </div>
                ) : (
                  <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
                    {selectedTrip.memories.map((memory, i) => (
                      <motion.div
                        key={memory.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.4 }}
                        className={`group relative bg-card inline-block w-full border border-border/40 hover:border-[var(--gold)]/30 transition-all duration-500 hover:shadow-2xl hover:shadow-foreground/5 ${i % 3 === 0 ? '-rotate-1' : i % 3 === 1 ? 'rotate-1' : '-rotate-0.5'}`}
                        style={{ transform: `rotate(${[-1, 1.2, -0.7, 0.5, -1.5, 0.8][i % 6]}deg)` }}
                      >
                        {/* Tape strip */}
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-16 h-6 bg-[var(--gold)]/10 border border-[var(--gold)]/20 backdrop-blur-sm z-10 rotate-[-1deg]" />

                        {/* Image */}
                        <div className="p-3 pb-10">
                          <img
                            src={memory.photo_url}
                            alt={memory.description || "Trip memory"}
                            className="w-full h-auto"
                            crossOrigin="anonymous"
                          />
                        </div>

                        {/* Caption */}
                        <p className="absolute bottom-3 left-0 right-0 text-center font-serif italic text-muted-foreground px-4 truncate text-xs">
                          {memory.description || "Untitled Memory"}
                        </p>

                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedForDeletion.includes(memory.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedForDeletion(prev => [...prev, memory.id])
                            else setSelectedForDeletion(prev => prev.filter(id => id !== memory.id))
                          }}
                          className={`absolute top-5 left-5 h-5 w-5 cursor-pointer transition-opacity z-10 accent-[var(--gold)] ${
                            selectedForDeletion.includes(memory.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
                          }`}
                        />

                        {/* Delete */}
                        {!selectedForDeletion.length && (
                          <button
                            onClick={() => handleDeleteMemory(memory)}
                            className="absolute top-5 right-5 bg-background/90 border border-border/50 text-destructive p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive hover:text-destructive-foreground hover:border-transparent z-10"
                            title="Delete photo"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Hidden Collage Render Target */}
                {selectedTrip.memories.length > 0 && (
                  <div className="overflow-hidden absolute -left-[9999px] top-0 pointer-events-none">
                    <div
                      ref={collageRef}
                      className="w-[1080px] h-[1080px] bg-[#f8f5f0] p-12 flex flex-col"
                      style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")' }}
                    >
                      {(() => {
                        const collageMemories = selectedForDeletion.length > 0
                          ? selectedTrip.memories.filter(m => selectedForDeletion.includes(m.id)).slice(0, 9)
                          : selectedTrip.memories.slice(0, 4)
                        const isLargeGrid = collageMemories.length > 4
                        return (
                          <>
                            <div className="text-center mb-12">
                              <h1 className="text-6xl font-extrabold capitalize text-[#2c3e50] font-serif tracking-tight drop-shadow-sm">{selectedTrip.destination}</h1>
                              <div className="flex items-center justify-center gap-4 mt-4 text-[#7f8c8d] text-xl font-medium tracking-widest uppercase">
                                <span className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Travel Memories</span>
                                <span>•</span>
                                <span>{new Date(selectedTrip.start_date).getFullYear() || new Date().getFullYear()}</span>
                              </div>
                            </div>
                            <div className={`flex-1 grid gap-8 place-content-center items-start ${isLargeGrid ? 'grid-cols-3' : 'grid-cols-2'}`}>
                              {collageMemories.map((memory, i) => (
                                <div key={i} className={`bg-white p-4 ${isLargeGrid ? 'pb-10' : 'pb-16'} rounded-sm shadow-xl relative ${i % 2 === 0 ? '-rotate-2' : 'rotate-3'}`}>
                                  <div className="w-full bg-gray-200 overflow-hidden rounded-sm aspect-square">
                                    <img src={memory.photo_url} alt="" className="w-full h-full object-cover grayscale-[20%] sepia-[10%] contrast-110" crossOrigin="anonymous" />
                                  </div>
                                  {memory.description && (
                                    <p className={`absolute ${isLargeGrid ? 'bottom-3' : 'bottom-5'} left-0 right-0 text-center font-serif italic text-gray-700 ${isLargeGrid ? 'text-xl px-4' : 'text-3xl px-6'} truncate`}>
                                      "{memory.description}"
                                    </p>
                                  )}
                                  <div className={`absolute -top-4 left-1/2 -translate-x-1/2 ${isLargeGrid ? 'w-20 h-6' : 'w-32 h-10'} bg-white/40 backdrop-blur-md shadow-sm rotate-[-4deg] opacity-70`} />
                                </div>
                              ))}
                            </div>
                            <div className="mt-8 text-center text-[#95a5a6] font-medium tracking-widest text-lg flex items-center justify-center gap-2">
                              <Camera className="h-6 w-6" /> Generated by AI Trip Planner
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-32 text-center"
              >
                <Camera className="h-16 w-16 text-muted-foreground/15 mb-6" />
                <h2 className="font-serif text-3xl mb-3">Your memoir awaits</h2>
                <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                  Complete a journey and mark it as traveled to begin building your visual travel memoir.
                </p>
                <Link href="/dashboard" className="mt-8">
                  <button className="text-[10px] uppercase tracking-[0.2em] font-medium px-6 py-3 border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all">
                    Back to Dashboard
                  </button>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Upload Modal */}
      {selectedTrip && (
        <TripDebriefModal
          isOpen={isUploadingPhoto}
          onClose={() => setIsUploadingPhoto(false)}
          tripId={selectedTrip.id}
          destination={selectedTrip.destination}
          initialStep="upload"
          onComplete={() => { setIsUploadingPhoto(false); loadMemories() }}
        />
      )}
    </div>
  )
}
