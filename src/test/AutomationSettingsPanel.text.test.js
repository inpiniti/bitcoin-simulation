/**
 * Issue #7: AutomationSettingsPanel UI 문구 정리
 * - 'Git Action 봇' 문구 제거 확인
 * - 실제 동작 방식(HuggingFace APScheduler)이 반영된 문구 확인
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const componentSource = readFileSync(
    resolve(__dirname, '../components/automation/AutomationSettingsPanel.jsx'),
    'utf-8'
)

describe('AutomationSettingsPanel UI 문구', () => {
    it('"Git Action 봇" 문구가 없다', () => {
        expect(componentSource).not.toContain('Git Action 봇')
    })

    it('"HuggingFace" 또는 "APScheduler" 문구가 포함된다', () => {
        const hasHuggingFace = componentSource.includes('HuggingFace')
        const hasAPScheduler = componentSource.includes('APScheduler')
        expect(hasHuggingFace || hasAPScheduler).toBe(true)
    })

    it('"Supabase 저장" 안내 문구가 유지된다', () => {
        expect(componentSource).toContain('Supabase 저장')
    })
})
