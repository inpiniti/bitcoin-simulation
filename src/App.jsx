import { useEffect } from "react"
import { executeAutoTrade } from "@/lib/autoTradeLogic"
import { TitleBar, ActivityBar, Sidebar, EditorArea, StatusBar } from "@/components/layout"
import { GlobalAlertDialog } from "@/components/GlobalAlertDialog"
import './index.css'

function App() {
  // Auto Trade Scheduler (1분마다 체크)
  useEffect(() => {
    const interval = setInterval(() => {
      executeAutoTrade();
    }, 60000); // 1분

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] overflow-hidden">
      {/* Title Bar */}
      <TitleBar />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Activity Bar (간격 선택) */}
        <ActivityBar />

        {/* Sidebar (시뮬레이션 전략) */}
        <Sidebar />

        {/* Editor Area (결과) */}
        <EditorArea />
      </div>

      {/* Status Bar */}
      <StatusBar />
      <GlobalAlertDialog />
    </div>
  )
}

export default App
