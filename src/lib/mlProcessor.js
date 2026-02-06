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
            const pct = ((today.close - past.close) / past.close) * 100;
            return Number.isFinite(pct) ? pct : 0;
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
export function processStockDataForPrediction(candles, allHistory = false) {
    if (!candles || candles.length <= 30) return { features: [], dates: [], actuals: [], rawFeatures: [] };

    const features = [];
    const dates = [];
    const actuals = []; // 실제 다음날 변동률 (백테스팅용)
    const rawFeatures = []; // 개별 feature 값들 (테이블 표시용)

    // allHistory가 true면 30번째부터 끝-1까지 (다음날 데이터 필요), false면 마지막 하나만 처리
    const startIndex = allHistory ? 30 : candles.length - 1;
    const endIndex = allHistory ? candles.length - 1 : candles.length; // 백테스팅 시 마지막 제외

    for (let i = startIndex; i < endIndex; i++) {
        const today = candles[i];
        const tomorrow = candles[i + 1]; // 백테스팅용 실제 결과

        // 1. 연속 상승/하락 일수 계산
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

        // 2. 변화율 (1일, 7일, 30일)
        const getChangePct = (days) => {
            const past = candles[i - days];
            if (!past || past.close === 0) return 0;
            const pct = ((today.close - past.close) / past.close) * 100;
            return Number.isFinite(pct) ? pct : 0;
        };

        const change1d = parseFloat(getChangePct(1).toFixed(2));
        const change7d = parseFloat(getChangePct(7).toFixed(2));
        const change30d = parseFloat(getChangePct(30).toFixed(2));

        const vector = [consecutiveDays, change1d, change7d, change30d];

        features.push(vector);
        dates.push(today.timestamp || today.date);

        // 개별 feature 저장 (테이블 표시용)
        rawFeatures.push({
            consecutiveDays,
            change1d,
            change7d,
            change30d
        });

        // 실제 다음날 변동률 계산
        if (tomorrow) {
            const actualChange = ((tomorrow.close - today.close) / today.close) * 100;
            actuals.push(parseFloat(actualChange.toFixed(2)));
        } else {
            actuals.push(null); // 다음날 데이터 없음
        }
    }

    // 기존 호환성 유지
    if (!allHistory) {
        return {
            feature: features[0],
            date: dates[0],
            rawFeature: rawFeatures[0],
            actual: actuals[0]
        };
    }

    return {
        features,
        dates,
        actuals,
        rawFeatures
    };
}
