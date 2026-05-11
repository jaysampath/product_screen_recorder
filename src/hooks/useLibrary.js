import { useState, useEffect, useCallback } from 'react';

const CUSTOM_NAMES_KEY = 'recording-custom-names';

function getCustomNames() {
  try {
    const stored = localStorage.getItem(CUSTOM_NAMES_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveCustomNames(names) {
  localStorage.setItem(CUSTOM_NAMES_KEY, JSON.stringify(names));
}

function sortRecordings(recordings, sortBy) {
  const sorted = [...recordings];
  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    case 'longest':
      return sorted.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    case 'largest':
      return sorted.sort((a, b) => (b.size || 0) - (a.size || 0));
    case 'name':
      return sorted.sort((a, b) =>
        (a.displayName || a.filename).localeCompare(b.displayName || b.filename)
      );
    default:
      return sorted;
  }
}

export function useLibrary() {
  const [recordings, setRecordings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRecordings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const raw = await window.electron.invoke('list-recordings');
      const customNames = getCustomNames();
      const withNames = raw.map(r => ({
        ...r,
        displayName: customNames[r.id] || r.filename,
      }));
      setRecordings(prev => {
        // preserve sort if sortBy hasn't changed
        return sortRecordings(withNames, sortBy);
      });
    } catch (err) {
      setError(err.message || 'Failed to load recordings');
    } finally {
      setIsLoading(false);
    }
  }, [sortBy]);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  useEffect(() => {
    const handler = () => fetchRecordings();
    window.addEventListener('processing-complete', handler);
    return () => window.removeEventListener('processing-complete', handler);
  }, [fetchRecordings]);

  const deleteRecording = useCallback(async (filePath) => {
    // optimistic remove
    setRecordings(prev => prev.filter(r => r.filePath !== filePath));
    setSelectedIds(prev => {
      const next = new Set(prev);
      // remove by matching filePath → find id first from current recordings
      return next; // id already gone from rendered list; no-op safe
    });
    try {
      await window.electron.invoke('delete-recording', { filePath });
    } catch {
      // re-fetch on error to restore state
      fetchRecordings();
    }
  }, [fetchRecordings]);

  const deleteSelected = useCallback(async () => {
    const ids = new Set(selectedIds);
    setRecordings(prev => {
      const toDelete = prev.filter(r => ids.has(r.id)).map(r => r.filePath);
      Promise.all(
        toDelete.map(fp => window.electron.invoke('delete-recording', { filePath: fp }))
      ).catch(() => fetchRecordings());
      return prev.filter(r => !ids.has(r.id));
    });
    setSelectedIds(new Set());
  }, [selectedIds, fetchRecordings]);

  const openInFinder = useCallback((filePath) => {
    window.electron.invoke('open-in-finder', { filePath });
  }, []);

  const renameRecording = useCallback((id, newName) => {
    setRecordings(prev =>
      prev.map(r => (r.id === id ? { ...r, displayName: newName } : r))
    );
    const names = getCustomNames();
    names[id] = newName;
    saveCustomNames(names);
  }, []);

  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const filteredRecordings = recordings.filter(r => {
    if (!searchQuery.trim()) return true;
    return (r.displayName || r.filename)
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
  });

  return {
    recordings: filteredRecordings,
    allRecordings: recordings,
    isLoading,
    error,
    selectedIds,
    sortBy,
    setSortBy,
    searchQuery,
    setSearchQuery,
    fetchRecordings,
    deleteRecording,
    deleteSelected,
    openInFinder,
    renameRecording,
    toggleSelect,
    clearSelection,
  };
}
