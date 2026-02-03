
import { useEffect, useState, useRef } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * 숫자가 부드럽게 변하는 애니메이션 컴포넌트
 * 
 * @component
 * @param {Object} props - 컴포넌트 props
 * @param {number} props.value - 표시할 숫자 값
 * @param {function} [props.format] - 숫자 포맷팅 함수 (기본: 소수점 2자리)
 * @param {string} [props.className] - 추가 클래스
 * @param {boolean} [props.flashOnUpdate=true] - 값 변경 시 색상 플래시 효과 여부
 * @returns {JSX.Element} 애니메이션이 적용된 숫자 스팬
 */
export function AnimatedNumber({
    value,
    format = (v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    className,
    flashOnUpdate = true
}) {
    // 초기값부터 시작
    const prevValueRef = useRef(value);
    const [flashClass, setFlashClass] = useState("");

    // 스프링 애니메이션 설정: 숫자가 빠르게 올라가고 부드럽게 멈춤
    const spring = useSpring(value, { mass: 0.5, stiffness: 75, damping: 15 });

    // 포맷팅 적용
    const display = useTransform(spring, (current) => format(current));

    useEffect(() => {
        // 값이 변경되었을 때 처리
        if (value !== prevValueRef.current) {
            spring.set(value);

            if (flashOnUpdate) {
                // 상승 시 빨강(#f23645), 하락 시 초록(#089981) - AnalysisPanel의 색상 테마와 일치
                if (value > prevValueRef.current) {
                    setFlashClass("text-[#f23645] brightness-200 font-bold drop-shadow-[0_0_8px_rgba(242,54,69,0.5)] transition-all duration-300 scale-110");
                } else if (value < prevValueRef.current) {
                    setFlashClass("text-[#089981] brightness-200 font-bold drop-shadow-[0_0_8px_rgba(8,153,129,0.5)] transition-all duration-300 scale-110");
                }

                // 600ms 후 플래시 효과 제거 (애니메이션 지속 시간)
                const timer = setTimeout(() => {
                    setFlashClass("");
                }, 600);

                prevValueRef.current = value;
                return () => clearTimeout(timer);
            }
            prevValueRef.current = value;
        }
    }, [value, spring, flashOnUpdate]);

    return (
        <motion.span className={cn("inline-block tabular-nums", className, flashClass)}>
            {display}
        </motion.span>
    );
}
