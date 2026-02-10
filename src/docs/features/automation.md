# Automation & AI Bot Configuration

자동 매매 봇이 실행할 시나리오와 API 키 등을 설정하는 기능입니다. GitHub Actions를 통해 주기적으로 실행되며, 조건에 따라 KIS API를 통해 실제 매매를 수행합니다.

## 설정 관리 (Automation Settings Panel)

`src/components/automation/AutomationSettingsPanel.jsx` 컴포넌트에서 설정을 관리합니다.

### 주요 기능
- **시나리오 목록**: 등록된 자동 매매 설정 테이블 (이름, 실행시간, 상태 등)
- **추가/수정 모달**:
    - **실행 시간**: Cron 표현식 또는 HH:mm (GitHub Actions가 이 시간을 확인하여 트리거)
    - **매매 조건**: 매수 확률(%), 매도 수익률(%) 임계값
    - **API 키**: 한국투자증권(KIS) App Key, Secret
    - **알림**: 매매 결과 이메일 알림 (SMTP)

### 데이터베이스 (Supabase)
이 기능은 Supabase의 `automation_settings` 테이블을 사용합니다.
(자세한 스키마는 README 참조)

## Store Actions (`useStore.js`)

#### `loadAutomationConfigs`
Supabase에서 `automation_settings` 목록을 로드 (`Select`).
- **Return**: `Promise<void>` (State 업데이트)

#### `saveAutomationConfig`
설정을 추가하거나 수정 (`Upsert`).
- **Parameter**: `config` (Object) - { name, execution_time, ... }
- **Return**: `Promise<{success, error}>`

#### `deleteAutomationConfig`
설정을 삭제 (`Delete`).
- **Parameter**: `id` (UUID)
- **Return**: `Promise<{success, error}>`
