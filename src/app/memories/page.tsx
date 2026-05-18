"use client"

import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Camera, Download, Image as ImageIcon, Loader2, MapPin, CalendarDays, ArrowLeft, Plus, Trash2, Globe, Lock } from "lucide-react"
import Link from "next/link"
import * as htmlToImage from "html-to-image"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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

  useEffect(() => {
    loadMemories()
  }, [])

  const handleTogglePublicStatus = async (tripId: string, currentStatus: boolean) => {
    const supabase = createClient()
    const newStatus = !currentStatus
    
    // Optimistic UI update
    setTrips(prev => prev.map(t => t.id === tripId ? { ...t, is_public: newStatus } : t))
    
    // DB update
    await supabase.from("trips").update({ is_public: newStatus }).eq("id", tripId)
  }

  const handleDeleteMemory = async (memory: Memory) => {
    if (!confirm("Are you sure you want to delete this photo?")) return
    
    // Optimistic UI update
    setTrips(prev => prev.map(t => {
      if (t.id === selectedTripId) {
        return { ...t, memories: t.memories.filter(m => m.id !== memory.id) }
      }
      return t
    }))

    const supabase = createClient()
    
    // Delete from DB
    await supabase.from("memories").delete().eq("id", memory.id)

    // Delete from storage
    const urlParts = memory.photo_url.split('/trip_photos/')
    if (urlParts.length > 1) {
      const filePath = urlParts[1]
      await supabase.storage.from('trip_photos').remove([filePath])
    }
  }

  const handleDeleteMultiple = async () => {
    if (selectedForDeletion.length === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedForDeletion.length} photo(s)?`)) return

    // Optimistic UI update
    setTrips(prev => prev.map(t => {
      if (t.id === selectedTripId) {
        return { ...t, memories: t.memories.filter(m => !selectedForDeletion.includes(m.id)) }
      }
      return t
    }))

    const supabase = createClient()
    
    // Find memories to delete from storage
    const memoriesToDelete = trips.find(t => t.id === selectedTripId)?.memories.filter(m => selectedForDeletion.includes(m.id)) || []
    
    // DB delete
    await supabase.from("memories").delete().in("id", selectedForDeletion)
    
    // Storage delete
    const paths = memoriesToDelete.map(m => {
      const urlParts = m.photo_url.split('/trip_photos/')
      return urlParts.length > 1 ? urlParts[1] : null
    }).filter(Boolean) as string[]

    if (paths.length > 0) {
      await supabase.storage.from('trip_photos').remove(paths)
    }

    setSelectedForDeletion([])
  }

  const handleDownloadCollage = async (trip: TripMemories) => {
    if (!collageRef.current || trip.memories.length === 0) return
    
    setIsGeneratingCollage(true)
    try {
      // Ensure images are fully loaded before capturing
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const dataUrl = await htmlToImage.toPng(collageRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        cacheBust: true,
        // CORS is required for cross-origin images (Supabase Storage)
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
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
  }

  const selectedTrip = trips.find(t => t.id === selectedTripId)

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <header className="bg-background border-b sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" /> Trip Memories
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar - Trip Selection */}
        <div className="w-full md:w-64 shrink-0 space-y-2">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-4">Completed Trips</h2>
          {trips.length === 0 ? (
            <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-xl border border-dashed">
              You haven't completed any trips with memories yet.
            </div>
          ) : (
            trips.map(trip => (
              <button
                key={trip.id}
                onClick={() => {
                  setSelectedTripId(trip.id)
                  setSelectedForDeletion([])
                }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all ${selectedTripId === trip.id ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-muted bg-background border'}`}
              >
                <div className="font-bold capitalize">{trip.destination}</div>
                <div className={`text-xs mt-1 ${selectedTripId === trip.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {trip.memories.length} Photos
                </div>
              </button>
            ))
          )}
        </div>

        {/* Main Content - Gallery */}
        <div className="flex-1">
          {selectedTrip ? (
            <div className="space-y-6">
              {/* Trip Header */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 bg-background p-6 rounded-2xl border shadow-sm">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-bold capitalize">{selectedTrip.destination}</h2>
                    <Button 
                      variant={selectedTrip.is_public ? "secondary" : "outline"} 
                      size="sm" 
                      className={`h-7 px-2 text-xs rounded-full shadow-none ${selectedTrip.is_public ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-200' : 'text-muted-foreground'}`}
                      onClick={() => handleTogglePublicStatus(selectedTrip.id, selectedTrip.is_public)}
                    >
                      {selectedTrip.is_public ? (
                        <><Globe className="h-3 w-3 mr-1" /> Public on Wall</>
                      ) : (
                        <><Lock className="h-3 w-3 mr-1" /> Private</>
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-muted-foreground text-sm font-medium">
                    <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {selectedTrip.duration_days} Days</span>
                    <span className="flex items-center gap-1"><ImageIcon className="h-4 w-4" /> {selectedTrip.memories.length} Memories</span>
                  </div>
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  {selectedForDeletion.length > 0 ? (
                    <>
                      <Button 
                        variant="ghost"
                        onClick={() => setSelectedForDeletion([])}
                        className="rounded-full shadow-sm"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => handleDownloadCollage(selectedTrip)}
                        disabled={isGeneratingCollage}
                        className="bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-90 rounded-full shadow-md"
                      >
                        {isGeneratingCollage ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        Download Collage ({Math.min(selectedForDeletion.length, 9)})
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={handleDeleteMultiple}
                        className="rounded-full shadow-md"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete ({selectedForDeletion.length})
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        variant="outline"
                        onClick={() => setIsUploadingPhoto(true)}
                        className="rounded-full shadow-sm"
                      >
                        <Plus className="h-4 w-4 mr-2" /> Add Photos
                      </Button>
                      <Button 
                        onClick={() => handleDownloadCollage(selectedTrip)}
                        disabled={isGeneratingCollage || selectedTrip.memories.length === 0}
                        className="bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-90 rounded-full shadow-md"
                      >
                        {isGeneratingCollage ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        Download Collage
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Gallery Grid */}
              {selectedTrip.memories.length === 0 ? (
                <div className="text-center py-20 bg-background rounded-2xl border border-dashed flex flex-col items-center justify-center">
                  <ImageIcon className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <h3 className="text-xl font-bold mb-2">No photos uploaded</h3>
                  <p className="text-muted-foreground max-w-sm">Go back to your itinerary and click "Mark as Completed" to upload some memories!</p>
                </div>
              ) : (
                <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
                  {selectedTrip.memories.map((memory) => (
                    <motion.div 
                      key={memory.id} 
                      initial={{ opacity: 0, y: 20 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="group relative bg-white dark:bg-zinc-900 p-3 pb-12 rounded-sm shadow-md hover:shadow-xl transition-all inline-block w-full border border-zinc-200 dark:border-zinc-800"
                    >
                      {/* Image respects natural aspect ratio */}
                      <img 
                        src={memory.photo_url} 
                        alt={memory.description || "Trip memory"} 
                        className="w-full h-auto rounded-sm" 
                        crossOrigin="anonymous" 
                      />
                      
                      {/* Tape Effect */}
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-6 bg-white/40 dark:bg-white/10 backdrop-blur-md shadow-sm rotate-[-2deg]" />

                      {/* Caption */}
                      <p className="absolute bottom-3 left-0 right-0 text-center font-serif italic text-zinc-700 dark:text-zinc-300 px-4 truncate text-sm">
                        {memory.description || "Untitled Memory"}
                      </p>

                      {/* Checkbox for Multi-Select */}
                      <input 
                        type="checkbox"
                        checked={selectedForDeletion.includes(memory.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedForDeletion(prev => [...prev, memory.id])
                          } else {
                            setSelectedForDeletion(prev => prev.filter(id => id !== memory.id))
                          }
                        }}
                        className={`absolute top-5 left-5 h-6 w-6 rounded border-zinc-300 cursor-pointer transition-opacity z-10 ${selectedForDeletion.includes(memory.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      />

                      {/* Delete Button (Single) - Hide if multi-select active */}
                      {!selectedForDeletion.length && (
                        <button 
                          onClick={() => handleDeleteMemory(memory)}
                          className="absolute top-5 right-5 bg-destructive/90 text-destructive-foreground p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-md hover:bg-destructive hover:scale-110 z-10"
                          title="Delete photo"
                        >
                          <Trash2 className="h-4 w-4" />
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
                          {/* Collage Header */}
                          <div className="text-center mb-12">
                            <h1 className="text-6xl font-extrabold capitalize text-[#2c3e50] font-serif tracking-tight drop-shadow-sm">
                              {selectedTrip.destination}
                            </h1>
                            <div className="flex items-center justify-center gap-4 mt-4 text-[#7f8c8d] text-xl font-medium tracking-widest uppercase">
                              <span className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Travel Memories</span>
                              <span>•</span>
                              <span>{new Date(selectedTrip.start_date).getFullYear() || new Date().getFullYear()}</span>
                            </div>
                          </div>

                          {/* Polaroids Grid */}
                          <div className={`flex-1 grid gap-8 place-content-center items-start ${isLargeGrid ? 'grid-cols-3' : 'grid-cols-2'}`}>
                            {collageMemories.map((memory, i) => (
                              <div key={i} className={`bg-white p-4 ${isLargeGrid ? 'pb-10' : 'pb-16'} rounded-sm shadow-xl relative ${i % 2 === 0 ? '-rotate-2' : 'rotate-3'} transition-transform`}>
                                <div className="w-full bg-gray-200 overflow-hidden rounded-sm aspect-square">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={memory.photo_url} alt="" className="w-full h-full object-cover grayscale-[20%] sepia-[10%] contrast-110" crossOrigin="anonymous" />
                                </div>
                                {memory.description && (
                                  <p className={`absolute ${isLargeGrid ? 'bottom-3' : 'bottom-5'} left-0 right-0 text-center font-serif italic text-gray-700 ${isLargeGrid ? 'text-xl px-4' : 'text-3xl px-6'} truncate`}>
                                    "{memory.description}"
                                  </p>
                                )}
                                {/* Tape Effect */}
                                <div className={`absolute -top-4 left-1/2 -translate-x-1/2 ${isLargeGrid ? 'w-20 h-6' : 'w-32 h-10'} bg-white/40 backdrop-blur-md shadow-sm rotate-[-4deg] opacity-70`} />
                              </div>
                            ))}
                          </div>

                          {/* Branding Footer */}
                          <div className="mt-8 text-center text-[#95a5a6] font-medium tracking-widest text-lg flex items-center justify-center gap-2">
                            <Camera className="h-6 w-6" /> Generated by AI Trip Planner
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 py-20">
              <Camera className="h-20 w-20 mb-4" />
              <p>Select a trip to view memories</p>
            </div>
          )}
        </div>
      </main>

      {/* Upload Modal */}
      {selectedTrip && (
        <TripDebriefModal 
          isOpen={isUploadingPhoto}
          onClose={() => setIsUploadingPhoto(false)}
          tripId={selectedTrip.id}
          destination={selectedTrip.destination}
          initialStep="upload"
          onComplete={() => {
            setIsUploadingPhoto(false)
            loadMemories() // Refresh to show new photo
          }}
        />
      )}
    </div>
  )
}
