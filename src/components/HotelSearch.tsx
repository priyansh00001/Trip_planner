"use client"

import { useState, useEffect, useRef } from "react"
import { Search, MapPin, Loader2, CheckCircle2, SlidersHorizontal } from "lucide-react"

interface HotelSearchProps {
  destination: string
  onSelect: (stay: { name: string; lat: number; lng: number }) => void
}

export default function HotelSearch({ destination, onSelect }: HotelSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [confirmedName, setConfirmedName] = useState<string | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [manualName, setManualName] = useState("")
  const [manualLat, setManualLat] = useState("")
  const [manualLng, setManualLng] = useState("")
  const [manualError, setManualError] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Debounced Search using Nominatim OpenStreetMap API
  useEffect(() => {
    if (!query.trim() || query.length < 3) {
      setResults([])
      setIsOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        // Search with hotel name + destination, restricted to India
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + " " + destination)}&limit=8&addressdetails=1&countrycodes=in`
        const res = await fetch(url)
        const data = await res.json()

        if (data && data.length > 0) {
          setResults(data)
          setIsOpen(true)
        } else {
          // PATH B: Smart City Fallback — hotel not in OSM, find the city center instead
          console.warn("Hotel not found in OSM. Falling back to city geocode for:", destination)
          const cityUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination + " India")}&limit=1`
          const cityRes = await fetch(cityUrl)
          const cityData = await cityRes.json()

          if (cityData && cityData.length > 0) {
            // Mark this as a city-level fallback so the UI can inform the user
            setResults([{ ...cityData[0], _isCityFallback: true, _hotelName: query }])
            setIsOpen(true)
          } else {
            setResults([])
            setIsOpen(true) // Still open to show "no results" message
          }
        }
      } catch (err) {
        console.error("Geocoding failed", err)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [query, destination])

  const handleSelect = (result: any) => {
    const cleanName = result._isCityFallback ? result._hotelName : result.display_name.split(",")[0]
    setConfirmedName(cleanName)
    setQuery("")
    setIsOpen(false)

    onSelect({
      name: cleanName,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    })
  }

  // PATH C: Manual coordinate submission
  const handleManualSubmit = () => {
    setManualError("")
    const lat = parseFloat(manualLat)
    const lng = parseFloat(manualLng)

    if (!manualName.trim()) { setManualError("Please enter the hotel name."); return }
    if (isNaN(lat) || lat < -90 || lat > 90) { setManualError("Invalid latitude. Must be between -90 and 90."); return }
    if (isNaN(lng) || lng < -180 || lng > 180) { setManualError("Invalid longitude. Must be between -180 and 180."); return }

    setConfirmedName(manualName)
    setShowManual(false)
    onSelect({ name: manualName, lat, lng })
  }

  if (confirmedName) {
    return (
      <div className="mt-6 flex flex-col gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-900/50">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-500 font-bold">
          <CheckCircle2 className="h-5 w-5" />
          Basecamp Locked In!
        </div>
        <p className="text-sm font-medium">{confirmedName}</p>
        <button
          onClick={() => { setConfirmedName(null); setShowManual(false) }}
          className="text-xs text-muted-foreground underline text-left w-fit mt-1"
        >
          Change Selection
        </button>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm text-muted-foreground">Already Booked? Lock it in:</h3>
        <button
          onClick={() => setShowManual(!showManual)}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {showManual ? "Use Search Instead" : "Enter Coordinates Manually"}
        </button>
      </div>

      {/* PATH C: Manual Coordinate Entry */}
      {showManual ? (
        <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-dashed">
          <p className="text-xs text-muted-foreground">
            Open Google Maps, right-click your hotel, and copy the coordinates shown.
          </p>
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="Hotel Name (e.g. Casa Camilo)"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              placeholder="Latitude (e.g. 15.4909)"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            />
            <input
              type="number"
              value={manualLng}
              onChange={(e) => setManualLng(e.target.value)}
              placeholder="Longitude (e.g. 73.8278)"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
          {manualError && <p className="text-xs text-red-500">{manualError}</p>}
          <button
            onClick={handleManualSubmit}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Pin to Map
          </button>
        </div>
      ) : (
        /* PATH A/B: Live Search with Smart Fallback */
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Search className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (results.length > 0) setIsOpen(true) }}
              className="flex h-11 w-full rounded-md border border-input bg-background/50 pl-10 px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground"
              placeholder={`Search for your hotel in ${destination}...`}
            />
          </div>

          {isOpen && results.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg overflow-hidden flex flex-col max-h-72 overflow-y-auto">
              {results.map((r: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(r)}
                  className="flex flex-col items-start px-4 py-3 hover:bg-muted/50 border-b last:border-0 transition-colors w-full text-left"
                >
                  {r._isCityFallback ? (
                    <>
                      <span className="font-semibold text-sm">{r._hotelName}</span>
                      <span className="text-xs text-amber-500 mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Hotel not in maps database. Will pin to {destination} city center. Use manual entry for exact location.
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-sm line-clamp-1">{r.display_name.split(",")[0]}</span>
                      <span className="text-xs text-muted-foreground line-clamp-1 mt-0.5 flex items-center">
                        <MapPin className="h-3 w-3 mr-1 inline" />
                        {r.display_name}
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>
          )}

          {isOpen && query.length >= 3 && results.length === 0 && !isSearching && (
            <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg p-4 text-sm text-center text-muted-foreground">
              No matches found. Try the <button onClick={() => setShowManual(true)} className="text-primary underline">manual coordinate entry</button> instead.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
