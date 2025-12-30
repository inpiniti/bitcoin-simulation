import { cn } from "@/lib/utils"

export function TitleBar() {
    return (
        <div className="h-8 bg-[#323233] flex items-center px-4 select-none">
            <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#f7931a]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.546z" />
                    <path fill="#fff" d="M17.17 10.06c.23-1.57-.96-2.42-2.6-2.98l.53-2.13-1.3-.32-.52 2.07c-.34-.08-.69-.16-1.04-.24l.52-2.09-1.3-.32-.53 2.13c-.28-.06-.56-.13-.83-.2l-1.79-.45-.35 1.39s.96.22.94.24c.53.13.62.48.61.75l-.61 2.45c.04.01.08.02.14.04l-.14-.04-.86 3.44c-.07.16-.23.41-.6.31.01.02-.94-.24-.94-.24l-.64 1.49 1.69.42c.31.08.62.16.92.23l-.54 2.15 1.3.32.53-2.13c.36.1.7.19 1.04.27l-.53 2.12 1.3.32.54-2.14c2.21.42 3.87.25 4.57-1.75.56-1.61-.03-2.54-1.19-3.15.85-.2 1.49-.76 1.66-1.93zm-2.98 4.17c-.4 1.61-3.11.74-3.99.52l.71-2.86c.88.22 3.7.66 3.28 2.34zm.4-4.19c-.36 1.46-2.62.72-3.35.54l.65-2.59c.73.18 3.08.52 2.7 2.05z" />
                </svg>
                <span className="text-xs text-[#cccccc]">Bitcoin Simulation</span>
            </div>
            <div className="flex-1 text-center text-xs text-[#7d7d7d]">
                비트코인 1년치 과거 데이터 기반 시뮬레이션
            </div>
            <div className="flex items-center gap-4 text-[#7d7d7d]">
                <button className="hover:text-[#cccccc] text-xs">−</button>
                <button className="hover:text-[#cccccc] text-xs">□</button>
                <button className="hover:text-[#cccccc] hover:bg-red-600 px-2 text-xs">×</button>
            </div>
        </div>
    )
}
