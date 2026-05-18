import { NextResponse } from 'next/server'
import { callAI, parseAIJson } from '@/lib/ai'

/**
 * Compress plan JSON to reduce token count.
 * Strips verbose fields (descriptions, tips, whyVisit) from activities
 * since the AI doesn't need them to make edits — it just needs names + coords.
 * Reduces token count from ~7,000-8,000 to ~2,000-3,000.
 */
function compressPlan(plan: any) {
  return {
    ...plan,
    // Remove large top-level text fields not needed for editing
    localTips: undefined,
    streetFood: undefined,
    culturalNotes: undefined,
    days: plan.days?.map((day: any) => ({
      dayNumber: day.dayNumber,
      theme: day.theme,
      activities: day.activities?.map((act: any) => ({
        time: act.time,
        name: act.name,
        category: act.category,
        icon: act.icon,
        lat: act.lat,
        lng: act.lng,
        costEstimate: act.costEstimate,
        rating: act.rating,
        // Keep these short fields, strip verbose ones
        description: act.description?.substring(0, 80),
        // Omit: whyVisit, proTip, signatureDish, nearestMetro, indoorAlternative, journalNote, etc.
        ...(act.journalDone ? { journalDone: act.journalDone, journalNote: act.journalNote, journalSpend: act.journalSpend, journalRating: act.journalRating } : {})
      }))
    })),
    recommendedStays: plan.recommendedStays?.map((s: any) => ({
      name: s.name, type: s.type, price: s.price, lat: s.lat, lng: s.lng
    })),
    confirmed_stay: plan.confirmed_stay ? {
      name: plan.confirmed_stay.name, type: plan.confirmed_stay.type,
      lat: plan.confirmed_stay.lat, lng: plan.confirmed_stay.lng
    } : undefined,
  }
}

export async function POST(request: Request) {
  try {
    const { plan, message } = await request.json()

    if (!message || !plan) {
      return NextResponse.json({ error: "Missing message or current plan data" }, { status: 400 })
    }

    // Compress plan to reduce token count significantly
    const compressedPlan = compressPlan(plan)

    const prompt = `You are a precise travel itinerary editor. Make ONLY the exact changes the user requests.

CURRENT TRIP PLAN (compressed):
${JSON.stringify(compressedPlan)}

USER REQUEST: "${message}"

RULES:
1. Add EXACTLY what is asked — no extra activities.
2. ADDING: append to the correct day's "activities" array with fields: time, name, category, rating, description, whyVisit, costEstimate, icon, lat, lng (real GPS coords).
3. REMOVING: delete only that activity.
4. REPLACING: remove old, insert new at same position.
5. Return the COMPLETE plan JSON with ALL days intact. NEVER return markdown.

Return ONLY the raw JSON object.`

    const { content, provider } = await callAI({
      prompt,
      systemPrompt: 'You are a travel itinerary editor. Respond ONLY with valid JSON.',
      temperature: 0.3,
      maxTokens: 4000,
    })

    if (provider === 'none' || !content) {
      return NextResponse.json(
        { error: "All AI providers are rate-limited right now. Please wait 1–2 minutes and try again." },
        { status: 503 }
      )
    }

    const editedCompressedPlan = parseAIJson(content)
    if (!editedCompressedPlan) {
      return NextResponse.json(
        { error: "AI returned invalid JSON. Please try again." },
        { status: 500 }
      )
    }

    // Merge edited compressed plan back into original full plan
    // This restores all the verbose fields (descriptions, tips, etc.) the AI stripped
    const mergedPlan = {
      ...plan,
      days: editedCompressedPlan.days?.map((editedDay: any) => {
        const originalDay = plan.days?.find((d: any) => d.dayNumber === editedDay.dayNumber)
        if (!originalDay) return editedDay

        return {
          ...originalDay,
          activities: editedDay.activities?.map((editedAct: any, i: number) => {
            // Try to match by name to restore original verbose fields
            const originalAct = originalDay.activities?.find(
              (a: any) => a.name === editedAct.name
            ) || originalDay.activities?.[i]

            if (originalAct && originalAct.name === editedAct.name) {
              // Same activity — restore full original data, keep any journal edits
              return {
                ...originalAct,
                ...(editedAct.journalDone !== undefined ? {
                  journalDone: editedAct.journalDone,
                  journalNote: editedAct.journalNote,
                  journalSpend: editedAct.journalSpend,
                  journalRating: editedAct.journalRating,
                } : {})
              }
            }

            // New activity added by AI — use as-is (it has full fields from the prompt)
            return editedAct
          })
        }
      })
    }

    console.log(`✅ Agent succeeded with provider: ${provider}`)
    return NextResponse.json({ plan: mergedPlan })

  } catch (error: any) {
    console.error("Agent API Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
