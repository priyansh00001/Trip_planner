"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, UploadCloud, Star, Loader2, CheckCircle2, Globe } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[500px] bg-background rounded-2xl shadow-2xl border z-[9999] overflow-hidden"
      >
        <div className="p-5 border-b bg-muted/20 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xl">Trip Debrief</h3>
            <p className="text-sm text-muted-foreground">{destination} Memories</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === "feedback" && (
              <motion.div key="feedback" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="text-center">
                  <h4 className="text-lg font-semibold mb-2">How was your trip?</h4>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setRating(star)} className="transition-transform hover:scale-110">
                        <Star className={`h-10 w-10 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 block">Overall Thoughts</label>
                  <textarea
                    rows={3}
                    placeholder="Did you discover any hidden gems?"
                    value={review}
                    onChange={e => setReview(e.target.value)}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  />
                </div>
                {/* Share with community toggle */}
                <div className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-3 border">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="text-sm font-semibold">Share with Community</p>
                      <p className="text-xs text-muted-foreground">Show on Explore page</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPublic(!isPublic)}
                    className={`w-12 h-7 rounded-full transition-colors relative ${isPublic ? 'bg-purple-500' : 'bg-muted-foreground/30'}`}
                  >
                    <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12 text-lg font-semibold rounded-full" onClick={handleSkipFeedback} disabled={isSubmitting}>
                    Skip
                  </Button>
                  <Button className="flex-1 h-12 text-lg font-semibold rounded-full bg-gradient-to-r from-indigo-500 to-purple-600" onClick={handleSaveFeedback} disabled={isSubmitting || rating === 0}>
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "Save"}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "upload" && (
              <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="text-center mb-4">
                  <h4 className="text-lg font-semibold">Upload a Memory</h4>
                  <p className="text-sm text-muted-foreground">Add photos to generate your custom collage.</p>
                </div>

                <div className="border-2 border-dashed border-primary/20 rounded-xl p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={e => e.target.files && setSelectedFiles(Array.from(e.target.files))}
                  />
                  {selectedFiles.length > 0 ? (
                    <div className="text-primary font-medium">
                      {selectedFiles.length === 1 ? selectedFiles[0].name : `${selectedFiles.length} photos selected`}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">Click or drag photos here</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 block">Photo Caption</label>
                  <Input placeholder="E.g., Sunset at the beach" value={photoDesc} onChange={e => setPhotoDesc(e.target.value)} />
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 rounded-full" onClick={() => setStep("done")}>Skip</Button>
                  <Button className="flex-1 rounded-full" onClick={handleUploadPhoto} disabled={selectedFiles.length === 0 || isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : `Upload ${selectedFiles.length > 1 ? selectedFiles.length : ''}`}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8 space-y-4">
                <div className="h-20 w-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h4 className="text-2xl font-bold">Memory Saved!</h4>
                <p className="text-muted-foreground">Your trip is marked as complete. You can view all your photos in the Memories gallery.</p>
                <Button className="w-full mt-4 rounded-full" onClick={() => {
                  onComplete()
                  onClose()
                }}>
                  View Memories
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  )
}
