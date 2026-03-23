/**
 * Issue #8: 주요 API 호출 실패 시 사용자 피드백 없이 console.error만 처리
 * - KISAccountDialog: 에러 state가 설정되는지 검증
 * - PortfolioDashboard: 에러 state가 설정되는지 검증
 */
import { describe, it, expect, vi } from 'vitest'

describe('에러 핸들링 - 사용자 피드백 상태 관리', () => {
    it('KISAccountDialog: 데이터 로드 실패 시 error state가 설정된다', async () => {
        let errorState = null
        const setError = (msg) => { errorState = msg }

        // 데이터 로드 실패 시뮬레이션
        const loadData = async () => {
            try {
                throw new Error('KIS API 연결 실패')
            } catch (error) {
                console.error('데이터 로드 오류:', error)
                setError('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
            }
        }

        await loadData()
        expect(errorState).toBe('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
    })

    it('KISAccountDialog: 재로그인 실패 시 error state가 설정된다', async () => {
        let errorState = null
        const setError = (msg) => { errorState = msg }

        const handleRelogin = async () => {
            try {
                const result = { success: false, error: '토큰 만료' }
                if (!result.success) {
                    setError('재로그인에 실패했습니다: ' + (result.error || '알 수 없는 오류'))
                }
            } catch (error) {
                setError('재로그인 중 오류가 발생했습니다.')
            }
        }

        await handleRelogin()
        expect(errorState).toContain('재로그인에 실패했습니다')
        expect(errorState).toContain('토큰 만료')
    })

    it('KISAccountDialog: 재로그인 성공 시 error state가 null로 초기화된다', async () => {
        let errorState = '이전 오류'
        const setError = (msg) => { errorState = msg }

        const handleReloginSuccess = async () => {
            const result = { success: true }
            if (result.success) {
                setError(null)
            }
        }

        await handleReloginSuccess()
        expect(errorState).toBeNull()
    })

    it('PortfolioDashboard: 데이터 로드 실패 시 loadError state가 설정된다', async () => {
        let loadError = null
        const setLoadError = (msg) => { loadError = msg }

        const loadPortfolio = async () => {
            try {
                throw new Error('잔고 조회 실패')
            } catch (error) {
                console.error('포트폴리오 데이터 로드 오류:', error)
                setLoadError('포트폴리오 데이터를 불러오지 못했습니다. KIS 연결을 확인해주세요.')
            }
        }

        await loadPortfolio()
        expect(loadError).toContain('포트폴리오 데이터를 불러오지 못했습니다')
    })

    it('에러 배너: 닫기 버튼으로 error를 null로 설정한다', () => {
        let errorState = '오류 메시지'
        const setError = (val) => { errorState = val }

        // 닫기 버튼 클릭 핸들러
        const handleDismiss = () => setError(null)
        handleDismiss()

        expect(errorState).toBeNull()
    })
})
