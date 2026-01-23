import { useState, useEffect } from 'react'
import { useStore } from "@/store/useStore"
import { DOCS_DATA } from "./docData"
import { FileText, Copy, Check } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import { cn } from "@/lib/utils"

// Highlight.js 스타일 (VS Code Dark 커스텀)
import 'highlight.js/styles/vs2015.css'

function CodeBlock({ node, inline, className, children, ...props }) {
    const [copied, setCopied] = useState(false)
    const match = /language-(\w+)/.exec(className || '')

    const handleCopy = () => {
        navigator.clipboard.writeText(String(children).replace(/\n$/, ''))
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    if (!inline && match) {
        return (
            <div className="relative group my-4">
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={handleCopy}
                        className="p-1.5 rounded bg-[#3c3c3c] hover:bg-[#4c4c4c] text-[#cccccc] transition-colors border border-[#555] shadow-sm"
                        title="Copy code"
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                </div>
                {/* 언어 라벨 */}
                <div className="absolute right-2 -top-6 text-[10px] text-[#888] font-mono select-none">
                    {match[1].toUpperCase()}
                </div>
                <pre className={cn("rounded-md border border-[#3c3c3c] bg-[#1e1e1e] overflow-x-auto p-4", className)}>
                    <code className={className} {...props}>
                        {children}
                    </code>
                </pre>
            </div>
        )
    }

    return (
        <code className={cn("bg-[#2d2d2d] text-[#ce9178] px-1.5 py-0.5 rounded font-mono text-[0.9em]", className)} {...props}>
            {children}
        </code>
    )
}

export function DocsPanel() {
    const { selectedDoc } = useStore()
    const doc = DOCS_DATA[selectedDoc]

    // 문서 변경 시 스크롤 최상단으로 + 해시 있으면 이동
    useEffect(() => {
        const scrollArea = document.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollArea) {
            scrollArea.scrollTop = 0;
        }

        // 약간의 지연 후 해시 이동 (렌더링 완료 대기)
        setTimeout(() => {
            if (window.location.hash) {
                const id = window.location.hash.replace('#', '');
                const element = document.getElementById(id);
                if (element && scrollArea) {
                    element.scrollIntoView({ behavior: 'smooth' });
                }
            }
        }, 100);
    }, [selectedDoc])

    if (!doc) {
        return (
            <div className="flex-1 bg-[#1e1e1e] flex items-center justify-center">
                <div className="text-center text-[#5a5a5a]">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">문서를 선택해주세요.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 bg-[#1e1e1e] flex flex-col h-full overflow-hidden">
            <ScrollArea className="flex-1 p-8">
                <div className="max-w-4xl mx-auto pb-20">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight, rehypeSlug]}
                        components={{
                            h1: ({ node, ...props }) => <h1 className="text-3xl font-bold text-[#569cd6] pb-2 border-b border-[#3c3c3c] mt-8 mb-6 scroll-mt-4" {...props} />,
                            h2: ({ node, ...props }) => <h2 className="text-2xl font-bold text-[#4ec9b0] mt-10 mb-4 scroll-mt-4 border-b border-[#2d2d2d] pb-1" {...props} />,
                            h3: ({ node, ...props }) => <h3 className="text-xl font-bold text-[#ce9178] mt-8 mb-3 scroll-mt-4" {...props} />,
                            h4: ({ node, ...props }) => <h4 className="text-lg font-bold text-[#dcdcaa] mt-6 mb-2" {...props} />,
                            p: ({ node, ...props }) => <p className="text-[#d4d4d4] text-[15px] leading-7 mb-4" {...props} />,
                            ul: ({ node, ...props }) => <ul className="list-disc pl-6 mb-4 text-[#d4d4d4] space-y-1" {...props} />,
                            ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-4 text-[#d4d4d4] space-y-1" {...props} />,
                            li: ({ node, ...props }) => <li className="pl-1 marker:text-[#6a9955]" {...props} />,
                            blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-[#6a9955] pl-4 italic text-[#a0a0a0] my-4" {...props} />,
                            a: ({ node, ...props }) => <a className="text-[#3794ff] hover:underline cursor-pointer" {...props} />,
                            hr: ({ node, ...props }) => <hr className="border-[#3c3c3c] my-8" {...props} />,
                            img: ({ node, ...props }) => <img className="max-w-full rounded border border-[#3c3c3c] my-4" {...props} />,
                            table: ({ node, ...props }) => <div className="my-6 w-full overflow-y-auto"><table className="w-full border-collapse border border-[#3c3c3c] text-sm" {...props} /></div>,
                            thead: ({ node, ...props }) => <thead className="bg-[#2d2d2d]" {...props} />,
                            tbody: ({ node, ...props }) => <tbody {...props} />,
                            tr: ({ node, ...props }) => <tr className="border-b border-[#3c3c3c] hover:bg-[#252526]" {...props} />,
                            th: ({ node, ...props }) => <th className="border border-[#3c3c3c] px-4 py-2 text-left font-bold text-[#cccccc]" {...props} />,
                            td: ({ node, ...props }) => <td className="border border-[#3c3c3c] px-4 py-2 text-[#d4d4d4]" {...props} />,
                            code: CodeBlock
                        }}
                    >
                        {doc.content}
                    </ReactMarkdown>
                </div>
            </ScrollArea>
        </div>
    )
}
