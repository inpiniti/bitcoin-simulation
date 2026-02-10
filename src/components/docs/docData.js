// Markdown files import with ?raw to act as raw string
import architectureMd from '@/docs/architecture.md?raw'
import useStoreMd from '@/docs/store/useStore.md?raw'

import coreMd from '@/docs/lib/core.md?raw'
import tradingMd from '@/docs/lib/trading.md?raw'
import kisMd from '@/docs/lib/kis.md?raw'
import integrationMd from '@/docs/lib/integration.md?raw'
import marketDataMd from '@/docs/lib/marketData.md?raw'

import layoutMd from '@/docs/components/layout.md?raw'
import panelsMd from '@/docs/components/panels.md?raw'
import financialQAMd from '@/docs/components/financialQA.md?raw'
import chartsMd from '@/docs/components/charts.md?raw'
import dialogsMd from '@/docs/components/dialogs.md?raw'
import uiMd from '@/docs/components/ui.md?raw'

import simUtilsMd from '@/docs/utils/simulation.md?raw'

export const DOCS_DATA = {
    // ARCHITECTURE
    'architecture': {
        id: 'architecture',
        title: '아키텍처 가이드',
        type: 'intro',
        path: 'Architecture Guide',
        description: 'Lib, Utils, Store, Component의 역할과 차이점.',
        content: architectureMd
    },

    // STORE
    'store/useStore': {
        id: 'store/useStore',
        title: 'Global Store (Zustand)',
        type: 'store',
        path: 'src/store/useStore.js',
        description: 'Centralized state management.',
        content: useStoreMd,
        children: [
            // State Section
            { id: 'state-상태', label: 'State (상태)', type: 'section' },
            { id: 'global-settings-전역-설정', label: 'Global Settings', type: 'subsection' },
            { id: 'data--history-데이터', label: 'Data & History', type: 'subsection' },
            { id: 'kis-authentication-한국투자증권', label: 'KIS Auth', type: 'subsection' },

            // Actions Section
            { id: 'actions-액션', label: 'Actions (액션)', type: 'section' },
            { id: 'setticker', label: 'setTicker', type: 'method' },
            { id: 'loaddailydata', label: 'loadDailyData', type: 'method' },
            { id: 'runsimulation', label: 'runSimulation', type: 'method' },
            { id: 'loginkis', label: 'loginKIS', type: 'method' },
            { id: 'runmarketanalysis', label: 'runMarketAnalysis', type: 'method' },
            { id: 'setglobalerror', label: 'setGlobalError', type: 'method' },
        ]
    },

    // LIB
    'lib/core': {
        id: 'lib/core',
        title: 'Core Libraries',
        type: 'lib',
        path: 'src/lib/{api, dataProcessor, utils}.js',
        description: 'Essential data processing and API. (Deep linking supported)',
        content: coreMd,
        children: [
            // API Service - ID must be all lowercase to match rehype-slug generation
            { id: 'api-service', label: 'API Service', type: 'section' },
            { id: 'fetchcoindailydata', label: 'fetchCoinDailyData', type: 'method' },
            { id: 'converttoyahoosymbol', label: 'convertToYahooSymbol', type: 'method' }, // Fixed typo
            { id: 'fetchstockdata', label: 'fetchStockData', type: 'method' },
            { id: 'fetchstockhistory', label: 'fetchStockHistory', type: 'method' },
            { id: 'fetchstockminutedata', label: 'fetchStockMinuteData', type: 'method' },
            { id: 'fetchstockoverview', label: 'fetchStockOverview', type: 'method' },
            { id: 'warmupaimodel', label: 'warmupAIModel', type: 'method' },
            { id: 'fetchstocknews', label: 'fetchStockNews', type: 'method' },
            { id: 'fetchearningsdata', label: 'fetchEarningsData', type: 'method' },
            { id: 'fetchkospi200tickers', label: 'fetchKospi200Tickers', type: 'method' },
            { id: 'fetchkosdaq150tickers', label: 'fetchKosdaq150Tickers', type: 'method' },
            { id: 'fetchusalltickers', label: 'fetchUSAllTickers', type: 'method' },
            { id: 'fetchrecommendedtickers', label: 'fetchRecommendedTickers', type: 'method' },
            { id: 'fetchforecast', label: 'fetchForecast', type: 'method' },
            { id: 'fetchwhaleanalysis', label: 'fetchWhaleAnalysis', type: 'method' },
            { id: 'getsentimentscore', label: 'getSentimentScore', type: 'method' },

            // Data Processor
            { id: 'data-processor', label: 'Data Processor', type: 'section' },
            { id: 'aggregatetointerval', label: 'aggregateToInterval', type: 'method' },
            { id: 'calculatersi', label: 'calculateRSI', type: 'method' },
            { id: 'calculatema', label: 'calculateMA', type: 'method' },
            { id: 'addderiveddata', label: 'addDerivedData', type: 'method' },
            { id: 'generateintegratedtrades', label: 'generateIntegratedTrades', type: 'method' },
            { id: 'analyzesignal', label: 'analyzeSignal', type: 'method' },
            { id: 'calculatefixedquantityresult', label: 'calculateFixedQuantityResult', type: 'method' },
            { id: 'calculatecumulativeresult', label: 'calculateCumulativeResult', type: 'method' },
            { id: 'calculatemartingaleresult', label: 'calculateMartingaleResult', type: 'method' },
            { id: 'calculatevmartingaleresult', label: 'calculateVMartingaleResult', type: 'method' },

            // Utils
            { id: 'utilities', label: 'Utilities', type: 'section' },
            { id: 'cn', label: 'cn', type: 'method' },
        ]
    },
    'lib/trading': {
        id: 'lib/trading',
        title: 'Trading Logic',
        type: 'lib',
        path: 'src/lib/{autoTrade, orderTracker}.js',
        description: 'Order execution and history.',
        content: tradingMd,
        children: [
            { id: 'auto-trade-logic', label: 'Auto Trade Logic', type: 'section' },
            { id: 'decidetrade', label: 'decideTrade', type: 'method' },
            { id: 'analyzesignal', label: 'analyzeSignal', type: 'method' },

            { id: 'order-tracker', label: 'Order Tracker', type: 'section' },
            { id: 'createorder', label: 'createOrder', type: 'method' },
            { id: 'updateorderstatus', label: 'updateOrderStatus', type: 'method' },
            { id: 'getpendingorders', label: 'getPendingOrders', type: 'method' },
        ]
    },
    'lib/kis': {
        id: 'lib/kis',
        title: 'KIS API',
        type: 'lib',
        path: 'src/lib/kisApi.js',
        description: 'Korea Investment Securities.',
        content: kisMd,
        children: [
            { id: 'authentication-인증', label: 'Authentication', type: 'section' },
            { id: 'getaccesstoken', label: 'getAccessToken', type: 'method' },
            { id: 'revokeaccesstoken', label: 'revokeAccessToken', type: 'method' },

            { id: 'trading-매매', label: 'Trading', type: 'section' },
            { id: 'orderstock', label: 'orderStock', type: 'method' },
            { id: 'getdailyorderhistory', label: 'getDailyOrderHistory', type: 'method' },

            { id: 'account-계좌', label: 'Account', type: 'section' },
            { id: 'getoverseasbalance', label: 'getOverseasBalance', type: 'method' },
        ]
    },
    'lib/integration': {
        id: 'lib/integration',
        title: 'Integrations',
        type: 'lib',
        path: 'src/lib/{supabase, discussion}.js',
        description: 'External services.',
        content: integrationMd,
        children: [
            { id: 'supabase-client', label: 'Supabase Client', type: 'section' },
            { id: 'supabase', label: 'supabase', type: 'method' },

            { id: 'discussion-api', label: 'Discussion API', type: 'section' },
            { id: 'fetchdiscussions', label: 'fetchDiscussions', type: 'method' },

            { id: 'earnings-analysis', label: 'Earnings Analysis', type: 'section' },
            { id: 'analyzeearningsimpact', label: 'analyzeEarningsImpact', type: 'method' },
        ]
    },
    'lib/marketData': {
        id: 'lib/marketData',
        title: 'Market Data',
        type: 'lib',
        path: 'src/lib/{marketData}.js',
        description: 'Indices and timing.',
        content: marketDataMd,
        children: [
            { id: 'sp-500-data', label: 'S&P 500 Data', type: 'section' },
            { id: 'getsp500tickers', label: 'getSP500Tickers', type: 'method' },

            { id: 'market-time', label: 'Market Time', type: 'section' },
            { id: 'ismarketopen', label: 'isMarketOpen', type: 'method' },
            { id: 'gettimetoclose', label: 'getTimeToClose', type: 'method' },
        ]
    },

    // COMPONENTS
    'components/layout': {
        id: 'components/layout',
        title: 'Layout & Navigation',
        type: 'component',
        path: 'src/components/layout/*',
        description: 'App shell structure.',
        content: layoutMd,
        children: [
            { id: 'editorarea', label: 'EditorArea', type: 'component' },
            { id: 'titlebar', label: 'TitleBar', type: 'component' },
            { id: 'activitybar', label: 'ActivityBar', type: 'component' },
            { id: 'sidebar', label: 'Sidebar', type: 'component' },
        ]
    },
    'components/panels': {
        id: 'components/panels',
        title: 'Feature Panels',
        type: 'component',
        path: 'src/components/*Panel.jsx',
        description: 'Major feature views.',
        content: panelsMd,
        children: [
            { id: 'overviewpanel', label: 'OverviewPanel', type: 'component' },
            { id: 'analysispanel', label: 'AnalysisPanel', type: 'component' },
            { id: 'simulationpanel', label: 'SimulationPanel', type: 'component' },
            { id: 'resultpanel', label: 'ResultPanel', type: 'component' },
            { id: 'financialqapanel', label: 'FinancialQAPanel', type: 'component' },
            { id: 'earningsimpactpanel', label: 'EarningsImpactPanel', type: 'component' },
            { id: 'introscreen', label: 'IntroScreen', type: 'component' },
        ]
    },
    'components/charts': {
        id: 'components/charts',
        title: 'Charts',
        type: 'component',
        path: 'src/components/*ChartView.jsx',
        description: 'Visualization components.',
        content: chartsMd,
        children: [
            { id: 'chartview', label: 'ChartView', type: 'component' },
        ]
    },
    'components/dialogs': {
        id: 'components/dialogs',
        title: 'Dialogs',
        type: 'component',
        path: 'src/components/*Dialog.jsx',
        description: 'Modals and popups.',
        content: dialogsMd,
        children: [
            { id: 'globalalertdialog', label: 'GlobalAlertDialog', type: 'component' },
            { id: 'autotradingdialog', label: 'AutoTradingDialog', type: 'component' },
            { id: 'kisorderdialog', label: 'KISOrderDialog', type: 'component' },
        ]
    },
    'components/ui': {
        id: 'components/ui',
        title: 'Shared UI Components',
        type: 'component',
        path: 'src/components/ui/*.jsx',
        description: 'Animated and reusable UI elements.',
        content: uiMd,
        children: [
            { id: 'animatednumber', label: 'AnimatedNumber', type: 'method' },
            { id: 'animatedtablerow', label: 'AnimatedTableRow', type: 'method' },
        ]
    },

    'components/financialQA': {
        id: 'components/financialQA',
        title: 'Financial QA Engine',
        type: 'component',
        path: 'src/components/FinancialQAPanel.jsx',
        description: 'AI-powered question answering system.',
        content: financialQAMd,
        children: [
            { id: 'financialqapanel', label: 'FinancialQAPanel', type: 'component' },
            { id: 'checkai', label: 'checkAI', type: 'method' },
            { id: 'loadcontext', label: 'loadContext', type: 'method' },
            { id: 'handlesend', label: 'handleSend', type: 'method' }
        ]
    },
    // UTILS
    'utils/simulation': {
        id: 'utils/simulation',
        title: 'Simulation Utils',
        type: 'utils',
        path: 'src/utils/simulation.js',
        description: 'Backtesting helpers.',
        content: simUtilsMd
    }
};
