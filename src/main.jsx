import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 참고: React.StrictMode는 개발 모드에서 PerformanceMeasure를 대량 생성하여
// 실시간 분석처럼 빈번한 업데이트가 있는 경우 메모리 누수를 유발할 수 있음.
// 프로덕션 빌드에서는 StrictMode가 자동으로 비활성화되므로 영향 없음.
createRoot(document.getElementById('root')).render(
  <App />
)
