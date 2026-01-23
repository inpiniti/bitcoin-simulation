import { useStore } from "@/store/useStore"
import { cn } from "@/lib/utils"
import { DOCS_DATA } from "./docData"
import { Book, Code2, Box, Database, Wrench } from "lucide-react"

export function DocsSidebarContent() {
    const { selectedDoc, setSelectedDoc } = useStore()

    const groups = [
        {
            type: 'intro',
            label: 'Introduction',
            icon: Book,
            color: 'text-[#e1e1e1]',
            items: Object.values(DOCS_DATA).filter(d => d.type === 'intro')
        },
        {
            type: 'store',
            label: 'State Management',
            icon: Database,
            color: 'text-[#4ec9b0]',
            items: Object.values(DOCS_DATA).filter(d => d.type === 'store')
        },
        {
            type: 'lib',
            label: 'Libraries',
            icon: Code2,
            color: 'text-[#569cd6]',
            items: Object.values(DOCS_DATA).filter(d => d.type === 'lib')
        },
        {
            type: 'component',
            label: 'Components',
            icon: Box,
            color: 'text-[#ce9178]',
            items: Object.values(DOCS_DATA).filter(d => d.type === 'component')
        },
        {
            type: 'utils',
            label: 'Utilities',
            icon: Wrench,
            color: 'text-[#dcdcaa]',
            items: Object.values(DOCS_DATA).filter(d => d.type === 'utils')
        },
    ]

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#252526]">
            <div className="p-4 border-b border-[#3c3c3c]">
                <h2 className="text-[11px] font-bold text-[#bbbbbb] uppercase tracking-wider flex items-center gap-2">
                    <Book className="w-3.5 h-3.5" /> Documentation
                </h2>
            </div>

            <div className="flex-1 overflow-auto p-2 space-y-6">
                {groups.map(group => (
                    group.items.length > 0 && (
                        <div key={group.type}>
                            <h3 className={cn("text-[11px] font-bold mb-2 px-2 flex items-center gap-2", group.color)}>
                                <group.icon className="w-3.5 h-3.5" /> {group.label}
                            </h3>
                            <div className="space-y-0.5">
                                {group.items.map(item => {
                                    const isSelected = selectedDoc === item.id || (item.children && item.children.some(c => c.id === window.location.hash.replace('#', '')));

                                    return (
                                        <div key={item.id}>
                                            <button
                                                onClick={() => {
                                                    setSelectedDoc(item.id)
                                                    window.location.hash = '' // Clear hash on main item click
                                                }}
                                                className={cn(
                                                    "w-full text-left px-2 py-1.5 text-[13px] rounded flex flex-col gap-0.5 transition-colors",
                                                    selectedDoc === item.id
                                                        ? "bg-[#37373d] text-white"
                                                        : "text-[#cccccc] hover:bg-[#2a2d2e]"
                                                )}
                                            >
                                                <span className="font-medium">{item.title}</span>
                                                <span className="text-[10px] text-[#888888] truncate">{item.path}</span>
                                            </button>

                                            {/* Render Children if selected */}
                                            {selectedDoc === item.id && item.children && (
                                                <div className="ml-3 pl-2 border-l border-[#444444] mt-0.5 space-y-0.5">
                                                    {item.children.map(child => (
                                                        <button
                                                            key={child.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                window.location.hash = `#${child.id}`
                                                                // Trigger re-render to highlight active child (handled by hash check usually, but simple force update might be needed or just rely on CSS :target logic if fully native, but here we use JS)
                                                            }}
                                                            className="w-full text-left px-2 py-1 text-[12px] text-[#999999] hover:text-[#cccccc] hover:bg-[#2a2d2e] rounded flex items-center gap-2 truncate"
                                                        >
                                                            {child.type === 'method' && <span className="text-[10px] bg-[#b180d7] text-black px-1 rounded-sm font-mono shrink-0">M</span>}
                                                            {child.type === 'section' && <span className="w-1 h-1 bg-[#cccccc] rounded-full shrink-0" />}
                                                            <span className="truncate">{child.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                ))}
            </div>
        </div>
    )
}
