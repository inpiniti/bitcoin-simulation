/**
 * 미국 주식 시장 시간 관리 유틸리티 (서머타임 지원)
 */

/**
 * 주어진 날짜가 미국 서머타임(DST) 기간인지 확인합니다.
 * 규칙: 3월의 두 번째 일요일 시작 ~ 11월의 첫 번째 일요일 종료
 * @param {Date} date - 확인할 날짜 (기본값: 현재)
 * @returns {boolean} 서머타임 여부
 */
export function isUSDST(date = new Date()) {
    const year = date.getFullYear();

    // 3월의 두 번째 일요일 구하기
    const march = new Date(year, 2, 1); // 3월 1일
    const secondSundayMarch = 8 + (7 - march.getDay()) % 7;
    // 만약 3월 1일이 일요일이면 getDay()는 0, offset 7 -> 8일. 
    // 3월 1일이 월요일(1) -> 8 + (6) = 14일.
    // getDay()=0(일) -> 2nd Sunday is 8th. 
    // Wait, let's verify logic.
    // 1st Sunday: 1 + (7 - march.getDay()) % 7
    // 2nd Sunday: 1 + (7 - march.getDay()) % 7 + 7
    let startDay = 1 + (7 - march.getDay()) % 7;
    if (startDay === 1 && march.getDay() !== 0) startDay += 7; // Logic check... simpler:
    // start date: 02:00 AM

    // 11월의 첫 번째 일요일 구하기
    const november = new Date(year, 10, 1); // 11월 1일
    const firstSundayNov = 1 + (7 - november.getDay()) % 7;

    // DST 시작 시점 (3월 2주 일요일 02:00)
    // 간단히 날짜 비교를 위해 월(Month) 인덱스 사용
    // 3월(2) 이전: false
    // 11월(10) 이후: false
    // 3월, 11월은 일자 비교

    // 정확한 비교를 위해 Date 객체 생성
    // 3월 2번째 일요일
    let temp = new Date(year, 2, 1);
    let day = temp.getDay();
    let dstStart = 1 + (day === 0 ? 0 : 7 - day) + 7; // First Sunday + 7 days = 2nd Sunday? No.
    // If Mar 1 is Sun(0), 1st Sun is Mar 1. 2nd Sun is Mar 8.
    // Logic: 1 + (7 - 0)%7 = 1. (+7) = 8. Correct.
    // If Mar 1 is Mon(1), 1st Sun is Mar 7. 2nd Sun is Mar 14.
    // Logic: 1 + (7-1)%7 = 7. (+7) = 14. Correct.

    const dstStartDate = new Date(year, 2, dstStart, 2); // 3월의 2번째 일요일 02:00

    // 11월 1번째 일요일
    temp = new Date(year, 10, 1);
    day = temp.getDay();
    let dstEnd = 1 + (day === 0 ? 0 : 7 - day);
    const dstEndDate = new Date(year, 10, dstEnd, 2); // 11월의 1번째 일요일 02:00

    return date >= dstStartDate && date < dstEndDate;
}

/**
 * 오늘의 미국 장 마감 시간을 반환합니다 (KST 기준).
 * Winter: 다음날 06:00
 * Summer: 다음날 05:00
 * @returns {Date} 마감 시간 Date 객체
 */
export function getUSMarketCloseTime(now = new Date()) {
    const isSummer = isUSDST(now);

    // 미국 장 마감은 현지 시간 16:00
    // KST = EDT/EST + 13/14h
    // Summer (EDT): 16:00 + 13h = 29:00 = 익일 05:00
    // Winter (EST): 16:00 + 14h = 30:00 = 익일 06:00

    // 오늘 날짜 기준, 내일 새벽 5시 or 6시
    // 오늘 장이 열려있는 상태라면(새벽), 마감 시간은 "오늘 아침"임.
    // 즉, 현재 시간이 00:00 ~ 06:00 사이라면, 마감 시간은 "오늘" 05:00/06:00.
    // 현재 시간이 09:00 이후라면, 마감 시간은 "내일" 05:00/06:00.

    // 편의상 "다가오는 가장 가까운 마감 시간"을 구함?
    // 아니면 "오늘 밤에 열릴(또는 열린) 장의 마감 시간"을 구함.

    // 로직:
    // 현재 시각이 마감 시간(05:00/06:00) 이전이면 -> 오늘 새벽이 마감.
    // 현재 시각이 마감 시간 이후면 -> 내일 새벽이 마감.

    const closeHour = isSummer ? 5 : 6;

    const closeTime = new Date(now);
    closeTime.setHours(closeHour, 0, 0, 0);

    if (now > closeTime) {
        closeTime.setDate(closeTime.getDate() + 1);
    }

    return closeTime;
}

/**
 * 다음 정규 장 마감까지 남은 분(Minute)을 반환합니다.
 */
export function getMinutesUntilClose() {
    const now = new Date();
    const closeTime = getUSMarketCloseTime(now);
    const diffMs = closeTime - now;
    return Math.floor(diffMs / 1000 / 60);
}
