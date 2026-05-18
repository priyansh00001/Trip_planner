"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, UploadCloud, Star, Loader2, Check } from "lucide-react"

import { createClient } from "@/lib/supabase/client"

interface TripDebriefModalProps {
  isOpen: boolean
  onClose: () => void
  tripId: string
  destination: string
  onComplete: () => void
  initialStep?: "feedback" | "upload" | "done"
}

export function TripDebriefModal({ isOpen, onClose, tripId, destination, onComplete, initialStep = "feedback" }: TripDebriefModalProps) {
  const [step, setStep] = useState<"feedback" | "upload" | "done">(initialStep)
  const [rating, setRating] = useState(0)
  const [review, setReview] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [photoDesc, setPhotoDesc] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isPublic, setIsPublic] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setStep(initialStep)
      setPhotoDesc("")
      setSelectedFiles([])
    }
  }, [isOpen, initialStep])

  if (!isOpen) return null

  const handleSaveFeedback = async () => {
    setIsSubmitting(true)
    const supabase = createClient()
    await supabase.from("trips").update({
      status: "completed_and_reviewed",
      review_rating: rating,
      review_text: review,
      is_public: isPublic
    }).eq("id", tripId)
    setIsSubmitting(false)
    setStep("upload")
  }

  const handleSkipFeedback = async () => {
    setIsSubmitting(true)
    const supabase = createClient()
    await supabase.from("trips").update({
      status: "completed_and_reviewed",
      is_public: isPublic
    }).eq("id", tripId)
    setIsSubmitting(false)
    setStep("upload")
  }

  const handleUploadPhoto = async () => {
    if (selectedFiles.length === 0) return
    setIsSubmitting(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const uploadPromises = selectedFiles.map(async (file) => {
        // 1. Upload to storage
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${user.id}/${tripId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('trip_photos')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error("Storage upload error:", uploadError)
          throw new Error(`Storage Error: ${uploadError.message}`)
        }

        // 2. Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('trip_photos')
          .getPublicUrl(filePath)

        // 3. Save memory to DB
        const { error: dbError } = await supabase.from('memories').insert({
          user_id: user.id,
          trip_id: tripId,
          photo_url: publicUrl,
          description: photoDesc // Apply same caption to all photos in the batch
        })

        if (dbError) {
          console.error("DB insert error:", dbError)
          throw new Error(`Database Error: ${dbError.message}`)
        }
      })

      try {
        await Promise.all(uploadPromises)
      } catch (err: any) {
        alert(err.message || "Failed to upload some photos.")
        setIsSubmitting(false)
        return
      }
    }

    setIsSubmitting(false)
    setStep("done")
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[9998] backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[480px] bg-card border border-border/50 shadow-2xl z-[9999] overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--gold)] font-medium">Trip Debrief</p>
            <h3 className="font-serif text-xl mt-1">{destination} Memories</h3>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {/* ─── STEP 1: FEEDBACK ─── */}
            {step === "feedback" && (
              <motion.div key="feedback" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-7">
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">Your experience</p>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setRating(star)} className="transition-transform hover:scale-110">
                        <Star className={`h-9 w-9 ${star <= rating ? 'fill-[var(--gold)] text-[var(--gold)]' : 'text-muted-foreground/20'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium mb-2 block">
                    Overall Thoughts
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Did you discover any hidden gems?"
                    value={review}
                    onChange={e => setReview(e.target.value)}
                    className="w-full bg-transparent border border-border/50 focus:border-[var(--gold)] outline-none px-4 py-3 text-sm resize-none transition-colors"
                  />
                </div>

                {/* Community toggle */}
                <div className="flex items-center justify-between border border-border/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Share with Community</p>
                    <p className="text-[10px] text-muted-foreground">Show on Explore page</p>
                  </div>
                  <button
                    onClick={() => setIsPublic(!isPublic)}
                    className={`w-11 h-6 transition-colors relative ${isPublic ? 'bg-[var(--gold)]' : 'bg-muted-foreground/20'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-background shadow transition-transform ${isPublic ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleSkipFeedback}
                    disabled={isSubmitting}
                    className="flex-1 py-3.5 text-[10px] uppercase tracking-[0.15em] font-medium border border-border/50 text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleSaveFeedback}
                    disabled={isSubmitting || rating === 0}
                    className="flex-1 py-3.5 text-[10px] uppercase tracking-[0.15em] font-medium bg-foreground text-background hover:bg-foreground/90 transition-all disabled:opacity-30"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mx-auto" /> : "Save"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── STEP 2: UPLOAD ─── */}
            {step === "upload" && (
              <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="text-center mb-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--gold)] font-medium mb-2">Preserve the moment</p>
                  <h4 className="font-serif text-xl">Upload a Memory</h4>
                  <p className="text-[10px] text-muted-foreground mt-1">Add photos to generate your custom collage.</p>
                </div>

                <div className="border border-dashed border-border/50 p-8 text-center hover:border-[var(--gold)]/30 hover:bg-[var(--gold)]/5 transition-all cursor-pointer relative">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={e => e.target.files && setSelectedFiles(Array.from(e.target.files))}
                  />
                  {selectedFiles.length > 0 ? (
                    <div className="text-sm font-medium text-[var(--gold)]">
                      {selectedFiles.length === 1 ? selectedFiles[0].name : `${selectedFiles.length} photos selected`}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <UploadCloud className="h-8 w-8 text-muted-foreground/30 mb-2" />
                      <p className="text-xs text-muted-foreground">Click or drag photos here</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium mb-2 block">
                    Caption
                  </label>
                  <input
                    type="text"
                    placeholder="E.g., Sunset at the beach"
                    value={photoDesc}
                    onChange={e => setPhotoDesc(e.target.value)}
                    className="w-full bg-transparent border border-border/50 focus:border-[var(--gold)] outline-none px-4 py-3 text-sm transition-colors"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep("done")}
                    className="flex-1 py-3.5 text-[10px] uppercase tracking-[0.15em] font-medium border border-border/50 text-muted-foreground hover:text-foreground transition-all"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleUploadPhoto}
                    disabled={selectedFiles.length === 0 || isSubmitting}
                    className="flex-1 py-3.5 text-[10px] uppercase tracking-[0.15em] font-medium bg-foreground text-background hover:bg-foreground/90 transition-all disabled:opacity-30"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mx-auto" /> : `Upload ${selectedFiles.length > 1 ? selectedFiles.length : ''}`}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── STEP 3: DONE ─── */}
            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8 space-y-4">
                <div className="h-16 w-16 border-2 border-[var(--gold)] flex items-center justify-center mx-auto mb-6">
                  <Check className="h-8 w-8 text-[var(--gold)]" />
                </div>
                <h4 className="font-serif text-2xl">Memory Saved</h4>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Your trip is marked as complete. View all your photos in the Memories gallery.
                </p>
                <button
                  className="w-full mt-4 py-3.5 text-[10px] uppercase tracking-[0.15em] font-medium bg-foreground text-background hover:bg-foreground/90 transition-all"
                  onClick={() => { onComplete(); onClose() }}
                >
                  View Memories
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  )
}
