/**
 * Domain-specific selector hooks for the central Zustand store.
 *
 * Each hook uses `useShallow` to prevent unnecessary re-renders — the component
 * only re-renders when one of the selected values actually changes.
 *
 * Usage example:
 *   import { useUIStore } from '@/store/selectors'
 *   const { viewMode, setViewMode } = useUIStore()
 */
import { useStore } from './useStore'
import { useShallow } from 'zustand/react/shallow'

// ---------------------------------------------------------------------------
// UI / Layout
// State  : viewMode, selectedDoc, globalError, sidebarOpen
// Actions: setViewMode, setSelectedDoc, setGlobalError, toggleSidebar
// ---------------------------------------------------------------------------
export const useUIStore = () => useStore(useShallow(state => ({
    viewMode: state.viewMode,
    selectedDoc: state.selectedDoc,
    globalError: state.globalError,
    sidebarOpen: state.sidebarOpen,
    setViewMode: state.setViewMode,
    setSelectedDoc: state.setSelectedDoc,
    setGlobalError: state.setGlobalError,
    toggleSidebar: state.toggleSidebar,
})))

// ---------------------------------------------------------------------------
// Machine Learning / AI Models
// State  : mlModels, aiModels, loadingAiModels
// Actions: saveMLModel, deleteMLModel, fetchAiModels
// ---------------------------------------------------------------------------
export const useMLStore = () => useStore(useShallow(state => ({
    mlModels: state.mlModels,
    aiModels: state.aiModels,
    loadingAiModels: state.loadingAiModels,
    saveMLModel: state.saveMLModel,
    deleteMLModel: state.deleteMLModel,
    fetchAiModels: state.fetchAiModels,
})))

// ---------------------------------------------------------------------------
// Auto Trading (Server-side automation configs & DL trade logs)
// State  : automationConfigList, loadingAutomation,
//          autoTradeDlLogs, loadingAutoTradeDlLogs
// Actions: loadAutomationConfigs, saveAutomationConfig,
//          deleteAutomationConfig, fetchAutoTradeDlLogs
// ---------------------------------------------------------------------------
export const useAutoTradeStore = () => useStore(useShallow(state => ({
    automationConfigList: state.automationConfigList,
    loadingAutomation: state.loadingAutomation,
    autoTradeDlLogs: state.autoTradeDlLogs,
    loadingAutoTradeDlLogs: state.loadingAutoTradeDlLogs,
    loadAutomationConfigs: state.loadAutomationConfigs,
    saveAutomationConfig: state.saveAutomationConfig,
    deleteAutomationConfig: state.deleteAutomationConfig,
    fetchAutoTradeDlLogs: state.fetchAutoTradeDlLogs,
})))

// ---------------------------------------------------------------------------
// Korea Investment Securities (KIS) Authentication & WebSocket
// State  : kisAuth, wsStatus
// Actions: loginKIS, logoutKIS, reloginKIS, setWsStatus
// ---------------------------------------------------------------------------
export const useKISStore = () => useStore(useShallow(state => ({
    kisAuth: state.kisAuth,
    wsStatus: state.wsStatus,
    loginKIS: state.loginKIS,
    logoutKIS: state.logoutKIS,
    reloginKIS: state.reloginKIS,
    setWsStatus: state.setWsStatus,
})))

// ---------------------------------------------------------------------------
// Market Analysis & Real-time Analysis
// State  : analysisResult, isAnalyzing, analysisProgress, isRealtimeAnalysis,
//          realtimeAnalysisData, realtimeAnalysisTickers, realtimePrices,
//          realtimeTrades, realtimePositions
// Actions: runMarketAnalysis, stopAnalysis, startRealtimeAnalysis,
//          stopRealtimeAnalysis, batchUpdateRealtimePrices,
//          updateRealtimePrice, clearRealtimeTrades
// ---------------------------------------------------------------------------
export const useAnalysisStore = () => useStore(useShallow(state => ({
    analysisResult: state.analysisResult,
    isAnalyzing: state.isAnalyzing,
    analysisProgress: state.analysisProgress,
    isRealtimeAnalysis: state.isRealtimeAnalysis,
    realtimeAnalysisData: state.realtimeAnalysisData,
    realtimeAnalysisTickers: state.realtimeAnalysisTickers,
    realtimePrices: state.realtimePrices,
    realtimeTrades: state.realtimeTrades,
    realtimePositions: state.realtimePositions,
    runMarketAnalysis: state.runMarketAnalysis,
    stopAnalysis: state.stopAnalysis,
    startRealtimeAnalysis: state.startRealtimeAnalysis,
    stopRealtimeAnalysis: state.stopRealtimeAnalysis,
    batchUpdateRealtimePrices: state.batchUpdateRealtimePrices,
    updateRealtimePrice: state.updateRealtimePrice,
    clearRealtimeTrades: state.clearRealtimeTrades,
})))

// ---------------------------------------------------------------------------
// Chart / Historical Data
// State  : hist, interval, loadingInterval, ticker, mode
// Actions: setInterval, setTicker, setMode, loadDailyData, clearAllData
// ---------------------------------------------------------------------------
export const useChartStore = () => useStore(useShallow(state => ({
    hist: state.hist,
    interval: state.interval,
    loadingInterval: state.loadingInterval,
    ticker: state.ticker,
    mode: state.mode,
    setInterval: state.setInterval,
    setTicker: state.setTicker,
    setMode: state.setMode,
    loadDailyData: state.loadDailyData,
    clearAllData: state.clearAllData,
})))

// ---------------------------------------------------------------------------
// Simulation
// State  : simul, selectedResult, strategyOptions, loadingSimul
// Actions: runSimulation, updateStrategyOptions, setSelectedResult
// ---------------------------------------------------------------------------
export const useSimulationStore = () => useStore(useShallow(state => ({
    simul: state.simul,
    selectedResult: state.selectedResult,
    strategyOptions: state.strategyOptions,
    loadingSimul: state.loadingSimul,
    runSimulation: state.runSimulation,
    updateStrategyOptions: state.updateStrategyOptions,
    setSelectedResult: state.setSelectedResult,
})))
