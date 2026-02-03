/**
 * 조건부 로그 유틸리티
 * 프로덕션 환경에서는 로그를 출력하지 않음
 * 
 * @example
 * import { logger } from '@/lib/logger';
 * logger.log('[KIS]', '연결 성공'); // 개발에서만 출력
 * logger.debug('[WS]', data);       // 개발에서만 출력
 */

const isDev = import.meta.env.DEV;

// 개발 환경에서도 비활성화하려면 이 플래그를 false로 설정
const ENABLE_LOGS = false;

export const logger = {
    log: (...args) => {
        if (isDev && ENABLE_LOGS) console.log(...args);
    },
    warn: (...args) => {
        if (isDev && ENABLE_LOGS) console.warn(...args);
    },
    error: (...args) => {
        // 에러는 항상 출력 (디버깅에 필수)
        console.error(...args);
    },
    debug: (...args) => {
        if (isDev && ENABLE_LOGS) console.debug(...args);
    },
    // 메모리 디버깅용 (필요시에만 활성화)
    memory: (...args) => {
        // if (isDev && ENABLE_LOGS) console.log(...args);
    }
};

export default logger;
