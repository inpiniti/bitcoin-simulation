import { TitleBar, ActivityBar, Sidebar, EditorArea, StatusBar } from "@/components/layout"
import './index.css'

function App() {
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
    </div>
  )
}

export default App
