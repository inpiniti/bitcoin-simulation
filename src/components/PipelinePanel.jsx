import React, { useState, useEffect } from 'react';

const STEPS = [
  { id: 'stock_data', name: 'AAPL 데이터 수집' },
  { id: 'preprocess', name: '데이터 전처리' },
  { id: 'xgboost', name: 'XGBoost 분석' },
  { id: 'rl', name: 'RL 분석' },
  { id: 'timesfm', name: 'TimesFM 분석' },
  { id: 'chronos', name: 'Chronos 분석' },
  { id: 'moirai', name: 'Moirai 분석' },
  { id: 'rumors', name: '소문 수집' },
  { id: 'analyze_rumors', name: '소문 분석' },
];

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export default function PipelinePanel() {
  const [runId, setRunId] = useState(null);
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(null);
  const [xgbModelId, setXgbModelId] = useState('');
  const [rlModelId, setRlModelId] = useState('');
  const [showModelInput, setShowModelInput] = useState(false);
  const [activeModels, setActiveModels] = useState(null);
  const [xgbModels, setXgbModels] = useState([]);
  const [rlModels, setRlModels] = useState([]);

  // 모델 목록 로드
  useEffect(() => {
    const loadModels = async () => {
      try {
        const res = await fetch(`${API_URL}/sp500/pipeline/models`);
        const data = await res.json();
        setActiveModels(data.active);
        setXgbModels(data.xgboost_models || []);
        setRlModels(data.rl_models || []);
      } catch (error) {
        console.error('모델 조회 실패:', error);
      }
    };
    loadModels();
  }, []);

  // 파이프라인 시작
  const startPipeline = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('ticker', 'AAPL');
      if (xgbModelId.trim()) params.append('xgb_model_id', xgbModelId.trim());
      if (rlModelId.trim()) params.append('rl_model_id', rlModelId.trim());

      const res = await fetch(`${API_URL}/sp500/pipeline/start?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setRunId(data.run_id);
      setPipelineStatus({
        run_id: data.run_id,
        steps: STEPS.reduce(
          (acc, s) => ({
            ...acc,
            [s.id]: { status: 'pending', result: null, error: null },
          }),
          {}
        ),
      });
    } catch (error) {
      alert('파이프라인 시작 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 단계 실행
  const executeStep = async (stepId) => {
    if (!runId) return;
    try {
      setExecuting(stepId);
      const res = await fetch(`${API_URL}/sp500/pipeline/${runId}/step/${stepId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (res.ok) {
        setPipelineStatus((prev) => ({
          ...prev,
          steps: {
            ...prev.steps,
            [stepId]: {
              status: 'completed',
              result: data.result,
              error: null,
            },
          },
        }));
      } else {
        setPipelineStatus((prev) => ({
          ...prev,
          steps: {
            ...prev.steps,
            [stepId]: {
              status: 'failed',
              result: null,
              error: data.detail,
            },
          },
        }));
      }
    } catch (error) {
      setPipelineStatus((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          [stepId]: {
            status: 'failed',
            result: null,
            error: error.message,
          },
        },
      }));
    } finally {
      setExecuting(null);
    }
  };

  // 상태 갱신 (주기적)
  useEffect(() => {
    if (!runId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/sp500/pipeline/${runId}`);
        const data = await res.json();
        setPipelineStatus(data);
      } catch (error) {
        console.error('상태 조회 실패:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [runId]);

  if (!runId) {
    return (
      <div style={{ padding: '32px', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>SP500 파이프라인</h1>
          <p style={{ fontSize: '14px', color: '#666' }}>AAPL 단계별 분석 테스트</p>
        </div>

        {/* 모델 선택 섹션 */}
        <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: '0', fontSize: '14px', fontWeight: 'bold' }}>모델 선택 (선택사항)</h3>
            <button
              onClick={() => setShowModelInput(!showModelInput)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: '#e0e0e0',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {showModelInput ? '접기' : '펼치기'}
            </button>
          </div>

          {showModelInput && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* XGBoost 모델 선택 */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#666', marginBottom: '4px', fontWeight: 'bold' }}>
                  XGBoost 모델
                </label>
                <select
                  value={xgbModelId}
                  onChange={(e) => setXgbModelId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '12px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">
                    자동 선택 (활성 모델: {activeModels?.xgb_model_id ? activeModels.xgb_model_id.substring(0, 8) + '...' : '없음'})
                  </option>
                  {xgbModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.id.substring(0, 8)}...)
                    </option>
                  ))}
                </select>
              </div>

              {/* RL 모델 선택 */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#666', marginBottom: '4px', fontWeight: 'bold' }}>
                  RL 모델
                </label>
                <select
                  value={rlModelId}
                  onChange={(e) => setRlModelId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '12px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">
                    자동 선택 (활성 모델: {activeModels?.rl_model_id ? activeModels.rl_model_id.substring(0, 8) + '...' : '없음'})
                  </option>
                  {rlModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.id.substring(0, 8)}...)
                    </option>
                  ))}
                </select>
              </div>

              <p style={{ fontSize: '11px', color: '#999', margin: '4px 0 0 0' }}>
                미지정 시 활성 모델이 자동 사용됩니다
              </p>
            </div>
          )}
        </div>

        <button
          onClick={startPipeline}
          disabled={loading}
          style={{
            width: '100%',
            padding: '16px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: '#007AFF',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '시작 중...' : '파이프라인 시작'}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '32px',
      maxWidth: '600px',
      margin: '0 auto',
      height: '100vh',
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>SP500 파이프라인</h1>
        <p style={{ fontSize: '12px', color: '#999' }}>Run ID: {runId}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {STEPS.map((step) => {
          const stepStatus = pipelineStatus?.steps?.[step.id];
          const status = stepStatus?.status || 'pending';
          const isCompleted = status === 'completed';
          const isFailed = status === 'failed';
          const isRunning = executing === step.id;

          const bgColor = isCompleted ? '#f0f0f0' : isFailed ? '#ffe8e8' : '#e8e8e8';

          return (
            <div
              key={step.id}
              style={{
                padding: '16px',
                backgroundColor: bgColor,
                borderRadius: '12px',
                border: '1px solid #ccc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '16px',
              }}
            >
              {/* 왼쪽: 텍스트 정보 */}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                  {step.name}
                </p>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  {isCompleted && '✓ 완료'}
                  {isFailed && '✗ 실패'}
                  {status === 'running' && '실행 중...'}
                  {status === 'pending' && '대기 중'}
                </p>

                {/* Result 표시 */}
                {stepStatus?.result && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '8px',
                      backgroundColor: '#f9f9f9',
                      borderLeft: '3px solid #4CAF50',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#333',
                      wordBreak: 'break-word',
                    }}
                  >
                    {JSON.stringify(stepStatus.result, null, 2)}
                  </div>
                )}

                {/* Error 표시 */}
                {stepStatus?.error && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '8px',
                      backgroundColor: '#fff3f3',
                      borderLeft: '3px solid #f44336',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#d32f2f',
                    }}
                  >
                    {stepStatus.error}
                  </div>
                )}
              </div>

              {/* 오른쪽: 버튼 */}
              <div style={{ whiteSpace: 'nowrap' }}>
                {isCompleted && (
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}
                  >
                    완료
                  </span>
                )}
                {isFailed && (
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}
                  >
                    실패
                  </span>
                )}
                {isRunning && (
                  <span style={{ fontSize: '12px', color: '#007AFF' }}>실행 중...</span>
                )}
                {!isCompleted && !isRunning && (
                  <button
                    onClick={() => executeStep(step.id)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: '#007AFF',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    시작
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
