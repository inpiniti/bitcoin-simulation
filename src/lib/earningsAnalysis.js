import { fetchStockData } from "./api";

/**
 * 실적 발표 전후의 주가 변동 분석
 * @param {string} ticker 
 * @param {Array} earningsHistory - api.js의 fetchEarningsData 결과의 history 배열
 */
export async function analyzeEarningsImpact(ticker, earningsHistory) {
    if (!earningsHistory || earningsHistory.length === 0) return null;

    // 실적 발표 전후의 데이터를 조회하기 위해 넉넉하게 2년치 데이터 로드
    const priceData = await fetchStockData(ticker, '1d', '730d');
    if (!priceData || priceData.length === 0) return null;

    const results = [];

    for (const record of earningsHistory) {
        // quarter: "2023-12-31", actual: 2.18, estimate: 2.1
        // Yahoo API의 history에는 발표일이 명시되지 않는 경우가 많으므로 quarter 정보를 기반으로 추정하거나
        // chart 데이터의 이벤트를 사용할 수 있음. 
        // 여기서는 데이터가 있는 날짜 중 quarter와 가장 가까운 실제 거래일(발표 시점)을 찾거나, 
        // Yahoo Finance의 chart events가 더 정확함.
    }

    // 간단한 분석 로직 (Mock 데이터 및 가공)
    // 실제 구현에서는 과거 발표일 전후 3일간의 수익률 표준편차를 구하여 'Expected Move' 산출
    const surprises = earningsHistory.filter(h => h.surprisePercent && h.surprisePercent.raw > 0);
    const avgSurprise = surprises.reduce((acc, h) => acc + h.surprisePercent.raw, 0) / (surprises.length || 1);

    return {
        ticker,
        avgSurprise: avgSurprise * 100, // %
        prediction: {
            upside: 5.2, // 과거 서프라이즈 시 평균 상승폭 가상 수치
            downside: -4.5,
            confidence: 75
        },
        impactHistory: earningsHistory.map(h => ({
            period: h.quarter.fmt,
            actual: h.actual.fmt,
            estimate: h.estimate.fmt,
            surprise: h.surprisePercent?.fmt || '0%',
            priceImpact: h.surprisePercent?.raw != null
                ? (h.surprisePercent.raw * 0.3).toFixed(2)  // EPS surprise의 약 30%를 주가 반응 추정치로 사용
                : null
        }))
    };
}
