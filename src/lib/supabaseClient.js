/**
 * Supabase 클라이언트 설정
 * 매매 히스토리 DB 연동용
 */
import { createClient } from '@supabase/supabase-js'

// 환경변수에서 Supabase 설정 로드
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Supabase 클라이언트 싱글톤
let supabaseClient = null

/**
 * Supabase 클라이언트 인스턴스 반환
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getSupabaseClient() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.warn('[Supabase] 환경변수 미설정: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY')
        return null
    }

    if (!supabaseClient) {
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    }

    return supabaseClient
}

/**
 * Supabase 연결 상태 확인
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
    return !!(SUPABASE_URL && SUPABASE_ANON_KEY)
}
