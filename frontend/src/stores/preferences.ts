import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { UserPreferences } from '../api/types'
import { fetchUserPreferences, updateUserPreferences } from '../api/client'

interface PreferencesState {
  loading: boolean
  preferences: UserPreferences | null
  load: () => Promise<void>
  save: (data: UserPreferences) => Promise<void>
  setLocal: (updater: (p: UserPreferences) => UserPreferences) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  devtools((set, get) => ({
    loading: false,
    preferences: null,
    load: async () => {
      set({ loading: true })
      try {
        const data = await fetchUserPreferences()
        set({ preferences: data })
      } finally {
        set({ loading: false })
      }
    },
    save: async (data: UserPreferences) => {
      set({ loading: true })
      try {
        const saved = await updateUserPreferences(data)
        set({ preferences: saved })
      } finally {
        set({ loading: false })
      }
    },
    setLocal: (updater) => {
      const current = get().preferences
      if (!current) return
      const next = updater(current)
      set({ preferences: next })
    },
  })),
)