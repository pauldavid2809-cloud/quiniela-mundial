'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import MatchCard from './MatchCard'

interface Phase {
  id: number
  name: string
  display_name: string
  is_unlocked: boolean
  points_value: number
  sort_order: number
}

interface Match {
  id: number
  api_id: number
  home_team: string
  away_team: string
  home_flag: string
  away_flag: string
  phase: string
  match_date: string
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'live' | 'completed'
  group_name: string | null
  venue: string | null
}

interface Prediction {
  id: number
  match_id: number
  prediction: 'home' | 'draw' | 'away'
  is_correct: boolean | null
  points_earned: number
}

interface Props {
  phases: Phase[]
  matches: Match[]
  predictions: Prediction[]
  userId: string
}

export default function QuinielaClient({ phases, matches, predictions, userId }: Props) {
  const [activePhase, setActivePhase] = useState(phases.find(p => p.is_unlocked)?.name || 'groups')
  const [localPredictions, setLocalPredictions] = useState<Record<number, 'home' | 'draw' | 'away'>>(
    Object.fromEntries(predictions.map(p => [p.match_id, p.prediction]))
  )
  const [saving, setSaving] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    setLocalPredictions(
      Object.fromEntries(predictions.map(p => [p.match_id, p.prediction]))
    )
  }, [predictions])

  const currentPhase = phases.find(p => p.name === activePhase)
  const phaseMatches = matches.filter(m => m.phase === activePhase)

  const grouped = activePhase === 'groups'
    ? phaseMatches.reduce((acc, m) => {