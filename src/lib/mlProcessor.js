/**
 * Machine Learning Data Processor
 * 주식 데이터를 받아 학습용 Feature와 Label로 변환합니다.
 */

// 데이터는 날짜 오름차순(과거 -> 현재) 배열이라고 가정합니다.
export function processStockDataForML(candles) {
    const features = [];
    const labels = [];

    // 최소 30일치 데이터 필요 (30일 변화율 계산 위함)
    if (!candles || candles.length <= 30) return { features: [], labels: [] };

    for (let i = 30; i < candles.length - 1; i++) {
        const today = candles[i];
        const tomorrow = candles[i + 1];

        // 데이터 유효성 체크
        if (!today.close || !tomorrow.close) continue;

        // 1. 연속 상승/하락 일수
        let consecutiveDays = 0;
        // 연속 상승
        if (today.close > candles[i - 1].close) {
            let temp = 1;
            while (i - temp > 0 && candles[i - temp].close > candles[i - temp - 1].close) {
                consecutiveDays++;
                temp++;
            }
            if (consecutiveDays === 0) consecutiveDays = 1; // 바로 전날 올랐으면 일단 1일
        }
        // 연속 하락
        else if (today.close < candles[i - 1].close) {
            let temp = 1;
            while (i - temp > 0 && candles[i - temp].close < candles[i - temp - 1].close) {
                consecutiveDays--;
                temp++;
            }
            if (consecutiveDays === 0) consecutiveDays = -1;
        }

        // 2. 변화율 (1일, 7일, 30일)
        const getChangePct = (days) => {
            const past = candles[i - days];
            if (!past || past.close === 0) return 0;
            return ((today.close - past.close) / past.close) * 100;
        };

        const change1d = getChangePct(1);
        const change7d = getChangePct(7);
        const change30d = getChangePct(30);

        // Feature Vector
        features.push([
            consecutiveDays,
            parseFloat(change1d.toFixed(2)),
            parseFloat(change7d.toFixed(2)),
            parseFloat(change30d.toFixed(2))
        ]);

        // Label: 다음날 2% 이상 상승 여부 (1=True, 0=False)
        const nextDayChange = ((tomorrow.close - today.close) / today.close) * 100;
        labels.push(nextDayChange >= 2.0 ? 1 : 0);
    }

    return { features, labels };
}

/**
 * 예측용 데이터 전처리 (Label 없음, 마지막 날짜까지 포함)
 */
export function processStockDataForPrediction(candles) {
    const features = [];
    const dates = [];

    // 마지막 날짜 데이터까지 Feature 생성
    // (학습때는 내일 데이터가 필요해서 length-1까지만 했지만, 예측은 오늘 데이터로 내일을 예측하므로 끝까지 사용)

    if (!candles || candles.length <= 30) return { features: [], dates: [] };

    // 마지막 1개만 필요하지만, 시각화를 위해 전체 다 변환해도 됨.
    // 여기서는 마지막 1개(가장 최근 일자)만 추출해서 리턴하도록 함.

    const i = candles.length - 1;
    const today = candles[i];

    let consecutiveDays = 0;
    if (today.close > candles[i - 1].close) {
        let temp = 1;
        while (i - temp > 0 && candles[i - temp].close > candles[i - temp - 1].close) {
            consecutiveDays++;
            temp++;
        }
        if (consecutiveDays === 0) consecutiveDays = 1;
    } else if (today.close < candles[i - 1].close) {
        let temp = 1;
        while (i - temp > 0 && candles[i - temp].close < candles[i - temp - 1].close) {
            consecutiveDays--;
            temp++;
        }
        if (consecutiveDays === 0) consecutiveDays = -1;
    }

    const getChangePct = (days) => {
        const past = candles[i - days];
        if (!past || past.close === 0) return 0;
        return ((today.close - past.close) / past.close) * 100;
    };

    const vector = [
        consecutiveDays,
        parseFloat(getChangePct(1).toFixed(2)),
        parseFloat(getChangePct(7).toFixed(2)),
        parseFloat(getChangePct(30).toFixed(2))
    ];

    return {
        feature: vector,
        date: today.timestamp || today.date
    };
}
