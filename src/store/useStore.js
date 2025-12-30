import { create } from 'zustand'

export const useStore = create((set) => ({
    // History data
    hist1min: [],
    hist5min: [],
    hist15min: [],
    hist1h: [],
    hist2h: [],
    hist1d: [],
    hist2d: [],
    hist1w: [],

    // Simulation data
    simul1min1x: [],
    // ... more simulation results can be added here

    // Loading states
    loading: {
        hist1min: false,
        hist5min: false,
        // ...
    },

    // Actions
    setHistory: (key, data) => set((state) => ({ [key]: data })),
    setLoading: (key, isLoading) => set((state) => ({
        loading: { ...state.loading, [key]: isLoading }
    })),
}))
