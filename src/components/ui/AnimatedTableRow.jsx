
import { useEffect, useRef, useState, memo } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

/**
 * 실시간 데이터 변경에 반응하는 애니메이션 테이블 행
 * 
 * @component
 * @param {Object} props - 컴포넌트 props
 * @param {Object} props.item - 분석 데이터 아이템 (price 필드 포함 필수)
 * @param {React.ReactNode} props.children - 행 내부의 셀(TableCell)들
 * @param {string} [props.className] - 추가 스타일 클래스
 * @param {Function} [props.onClick] - 행 클릭 이벤트 핸들러
 * @returns {JSX.Element} 애니메이션이 적용된 Table Row
 */
function AnimatedTableRowComponent({ item, children, className, onClick, ...props }) {
    const prevPrice = useRef(item.price)
    const [status, setStatus] = useState("idle") // 'idle' | 'rise' | 'fall'

    useEffect(() => {
        // 가격 변경 감지
        if (item.price !== prevPrice.current) {
            if (item.price > prevPrice.current) {
                setStatus("rise")
            } else if (item.price < prevPrice.current) {
                setStatus("fall")
            }

            // 0.8초 후 상태 초기화 (펄스 종료)
            const timer = setTimeout(() => setStatus("idle"), 800)

            prevPrice.current = item.price
            return () => clearTimeout(timer)
        }
    }, [item.price])

    // 상태에 따른 스타일 변수
    const getStyles = () => {
        if (status === 'rise') {
            return {
                boxShadow: "inset 4px 0 0 0 #f23645, inset 0 0 20px rgba(242, 54, 69, 0.15)", // 왼쪽 붉은 막대 + 내부 광원
                backgroundColor: "rgba(242, 54, 69, 0.08)",
                borderColor: "#f23645" // 테두리도 붉게
            }
        }
        if (status === 'fall') {
            return {
                boxShadow: "inset 4px 0 0 0 #089981, inset 0 0 20px rgba(8, 153, 129, 0.15)", // 왼쪽 초록 막대 + 내부 광원
                backgroundColor: "rgba(8, 153, 129, 0.08)",
                borderColor: "#089981"
            }
        }
        return {
            boxShadow: "inset 0 0 0 0 transparent",
            backgroundColor: "transparent",
            borderColor: "#2d2d2d" // 기본 테두리 색상
        }
    }

    return (
        <motion.tr
            className={cn(
                "border-b cursor-pointer transition-all relative overflow-hidden",
                // 빛 애니메이션을 위한 CSS 클래스 (테이블 구조 변경 없이)
                status === 'rise' && "animate-scan-rise",
                status === 'fall' && "animate-scan-fall",
                className
            )}
            animate={getStyles()}
            transition={{ duration: 0.3 }}
            onClick={onClick}
            {...props}
        >
            {children}
        </motion.tr>
    )
}

// React.memo를 사용하여 불필요한 리렌더링 방지
export const AnimatedTableRow = memo(AnimatedTableRowComponent, (prevProps, nextProps) => {
    // children은 매번 새로운 객체이므로 비교에서 제외하고, 
    // 실제 데이터(item)가 변경되었을 때만 리렌더링하도록 함.
    // 이는 스크롤 성능 최적화에 중요함.
    const prev = prevProps.item
    const next = nextProps.item

    return (
        prev.ticker === next.ticker &&
        prev.price === next.price &&
        prev.changeRate === next.changeRate &&
        prev.signal === next.signal &&
        prev.sentiment === next.sentiment &&
        prev.reason === next.reason &&
        prevProps.className === nextProps.className
    )
})
