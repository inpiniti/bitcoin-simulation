import { useEffect } from "react"
import { executeAutoTrade } from "@/lib/autoTradeLogic"
import { TitleBar, ActivityBar, Sidebar, EditorArea, StatusBar } from "@/components/layout"
import { GlobalAlertDialog } from "@/components/GlobalAlertDialog"
import { useStore } from "@/store/useStore"
import './index.css'

function App() {
  const sidebarOpen = useStore(s => s.sidebarOpen)

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
        {/* Activity Bar + Sidebar — 슬라이드 토글 */}
        <div
          className="flex overflow-hidden transition-all duration-200"
          style={{ width: sidebarOpen ? undefined : 0 }}
        >
          <ActivityBar />
          <Sidebar />
        </div>

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
