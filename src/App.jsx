import { useStore } from "@/store/useStore"
import { TitleBar, ActivityBar, Sidebar, EditorArea, StatusBar } from "@/components/layout"
import { GlobalAlertDialog } from "@/components/GlobalAlertDialog"
import './index.css'

function App() {
  const sidebarOpen = useStore(s => s.sidebarOpen)

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] overflow-hidden">
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <div
          className="flex overflow-hidden transition-all duration-200"
          style={{ width: sidebarOpen ? undefined : 0 }}
        >
          <ActivityBar />
          <Sidebar />
        </div>
        <EditorArea />
      </div>
      <StatusBar />
      <GlobalAlertDialog />
    </div>
  )
}

export default App
