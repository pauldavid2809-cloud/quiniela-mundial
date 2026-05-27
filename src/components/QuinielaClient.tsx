const handlePredict = async (matchId: number, prediction: 'home' | 'draw' | 'away') => {
  const match = matches.find(m => m.id === matchId)
  if (!match || match.status !== 'scheduled') return

  setSaving(matchId)
  setLocalPredictions(prev => ({ ...prev, [matchId]: prediction }))

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    alert('Sesión expirada, recarga la página')
    setSaving(null)
    return
  }

  const { error } = await supabase
    .from('predictions')
    .upsert(
      { user_id: user.id, match_id: matchId, prediction },
      { onConflict: 'user_id,match_id' }
    )

  if (error) {
    console.error('Error guardando predicción:', error)
    alert('Error: ' + error.message)
    setLocalPredictions(prev => {
      const copy = { ...prev }
      delete copy[matchId]
      return copy
    })
  }
  setSaving(null)
}