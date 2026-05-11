import { useState, useCallback, useMemo } from 'react'

export function useSourcePicker() {
  const [sources, setSources] = useState([])
  const [selectedSource, setSelectedSource] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchSources = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.electron.invoke('get-sources')
      setSources(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const filteredSources = useMemo(() => {
    if (!searchQuery.trim()) return sources
    const q = searchQuery.toLowerCase()
    return sources.filter((s) => s.name.toLowerCase().includes(q))
  }, [sources, searchQuery])

  return {
    sources,
    filteredSources,
    selectedSource,
    setSelectedSource,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    fetchSources
  }
}
