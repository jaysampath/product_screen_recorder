import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const signUp = useCallback(async (email, password, displayName) => {
    setError(null)
    try {
      const { data, error: authError } = await supabase.auth.signUp({ email, password })
      if (authError) {
        setError(authError.message)
        return { success: false }
      }

      console.log('[auth] signup success, user id:', data.user.id)

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          display_name: displayName || email.split('@')[0],
          plan: 'free',
          share_links_used: 0,
          storage_used_bytes: 0
        })

      if (profileError) {
        console.error('[auth] profile insert failed:', profileError.message)
      } else {
        console.log('[auth] profile created successfully')
      }

      if (data.session) {
        await window.electron.invoke('save-session', {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        })
      }

      setUser({
        id: data.user.id,
        email: data.user.email,
        display_name: displayName || email.split('@')[0],
        plan: 'free',
        share_links_used: 0
      })

      return { success: true }
    } catch (err) {
      const msg = err.message || 'Sign up failed'
      setError(msg)
      return { success: false, error: msg }
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    setError(null)
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError

      const { user: authUser, session } = data

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle()

      console.log('[auth] profile fetch:', profile, profileError)

      if (!profile) {
        setError('Account setup incomplete. Please contact support.')
        await supabase.auth.signOut()
        return { success: false }
      }

      await window.electron.invoke('save-session', {
        access_token: session.access_token,
        refresh_token: session.refresh_token
      })

      setUser({
        id: authUser.id,
        email: authUser.email,
        display_name: profile.display_name,
        plan: profile.plan,
        share_links_used: profile.share_links_used
      })

      return { success: true }
    } catch (err) {
      const msg = err.message || 'Sign in failed'
      setError(msg)
      return { success: false, error: msg }
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    await window.electron.invoke('clear-session')
    setUser(null)
  }, [])

  const restoreSession = useCallback(async () => {
    try {
      const tokens = await window.electron.invoke('get-session')
      if (tokens?.access_token && tokens?.refresh_token) {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token
        })
        if (!sessionError && data?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle()

          if (!profile) {
            await window.electron.invoke('clear-session')
            setUser(null)
            setIsLoading(false)
            return
          }

          setUser({
            id: data.user.id,
            email: data.user.email,
            display_name: profile.display_name,
            plan: profile.plan,
            share_links_used: profile.share_links_used
          })
          setIsLoading(false)
        }
      }
    } catch {
      // no valid session — stay logged out
    } finally {
      setIsLoading(false)
    }
  }, [])

  const isPro = useCallback(() => user?.plan === 'pro', [user])

  const canShareLink = useCallback(() => {
    if (!user) return false
    if (isPro()) return true
    return user.share_links_used < 3
  }, [user, isPro])

  return {
    user,
    isLoading,
    error,
    signUp,
    signIn,
    signOut,
    restoreSession,
    isPro,
    canShareLink
  }
}
