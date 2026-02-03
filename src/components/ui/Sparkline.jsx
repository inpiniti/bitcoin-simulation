import { memo, useMemo } from 'react';

/**
 * 경량 스파크라인 차트 컴포넌트 (순수 SVG)
 * 실시간 분석 테이블에서 각 종목의 가격 추이를 작은 그래프로 표시합니다.
 * 
 * 성능 최적화:
 * - React.memo로 불필요한 리렌더링 방지
 * - useMemo로 경로 계산 캐싱
 * - 데이터 샘플링 (300개 → maxPoints개)
 * 
 * @param {Object} props
 * @param {number[]} props.data - 가격 데이터 배열 (close 값들)
 * @param {number} [props.width=80] - 차트 너비 (px)
 * @param {number} [props.height=24] - 차트 높이 (px)
 * @param {number} [props.maxPoints=30] - 표시할 최대 데이터 포인트 수
 * @param {string} [props.strokeColor] - 선 색상 (자동: 상승=초록, 하락=빨강)
 * @param {string} [props.className] - 추가 CSS 클래스
 */
function SparklineComponent({
    data = [],
    width = 80,
    height = 24,
    maxPoints = 30,
    strokeColor,
    className = ''
}) {
    // 데이터가 없거나 부족하면 렌더링 안함
    if (!data || data.length < 2) {
        return (
            <div
                className={`flex items-center justify-center ${className}`}
                style={{ width, height }}
            >
                <span className="text-[10px] text-[#555]">-</span>
            </div>
        );
    }

    // 경로 및 색상 계산 (메모이제이션)
    const { pathD, color, fillPathD } = useMemo(() => {
        // 데이터 샘플링: 너무 많은 포인트는 성능에 영향
        let sampledData = data;
        if (data.length > maxPoints) {
            const step = Math.floor(data.length / maxPoints);
            sampledData = [];
            for (let i = 0; i < data.length; i += step) {
                sampledData.push(data[i]);
            }
            // 마지막 값은 항상 포함 (현재가 반영)
            if (sampledData[sampledData.length - 1] !== data[data.length - 1]) {
                sampledData.push(data[data.length - 1]);
            }
        }

        // Min/Max 계산 (정규화용)
        const minVal = Math.min(...sampledData);
        const maxVal = Math.max(...sampledData);
        const range = maxVal - minVal || 1; // 0 방지

        // SVG 경로 생성
        const padding = 2; // 상하 여백
        const chartHeight = height - padding * 2;
        const chartWidth = width - 2;

        const points = sampledData.map((val, i) => {
            const x = (i / (sampledData.length - 1)) * chartWidth + 1;
            const y = padding + chartHeight - ((val - minVal) / range) * chartHeight;
            return { x, y };
        });

        // 라인 경로
        const pathD = points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
            .join(' ');

        // 그라데이션 채우기용 경로 (닫힌 경로)
        const fillPathD = pathD +
            ` L ${points[points.length - 1].x.toFixed(1)},${height} ` +
            `L ${points[0].x.toFixed(1)},${height} Z`;

        // 색상 결정: 시작가 vs 종가
        const firstVal = sampledData[0];
        const lastVal = sampledData[sampledData.length - 1];
        const isUp = lastVal >= firstVal;
        const color = strokeColor || (isUp ? '#089981' : '#f23645'); // 초록(상승) / 빨강(하락)

        return { pathD, color, fillPathD };
    }, [data, width, height, maxPoints, strokeColor]);

    return (
        <svg
            width={width}
            height={height}
            className={className}
            style={{ display: 'block' }}
        >
            {/* 그라데이션 정의 */}
            <defs>
                <linearGradient id={`sparkline-grad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>

            {/* 채우기 영역 */}
            <path
                d={fillPathD}
                fill={`url(#sparkline-grad-${color.replace('#', '')})`}
            />

            {/* 라인 */}
            <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

// React.memo로 감싸서 props가 변경될 때만 리렌더링
export const Sparkline = memo(SparklineComponent, (prevProps, nextProps) => {
    // 데이터 배열의 길이와 마지막 값만 비교 (성능 최적화)
    if (prevProps.data?.length !== nextProps.data?.length) return false;
    if (prevProps.data?.[prevProps.data.length - 1] !== nextProps.data?.[nextProps.data.length - 1]) return false;
    if (prevProps.width !== nextProps.width) return false;
    if (prevProps.height !== nextProps.height) return false;
    return true; // 동일하면 리렌더링 안함
});

Sparkline.displayName = 'Sparkline';
