# 시뮬레이션 유틸리티 (Simulation Utilities)

**경로:** `src/utils/simulation.js`

시뮬레이션 엔진을 위한 전용 헬퍼 함수들입니다.
*참고: 핵심 로직 대부분은 `lib/dataProcessor.js`로 이동되었습니다. 이 파일은 보조 헬퍼만 유지합니다.*

- **runBacktest(data, strategy)**: 전체 백테스트를 실행하고 요약 보고서를 반환하는 래퍼 함수입니다.
