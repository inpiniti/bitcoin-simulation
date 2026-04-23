import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';

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

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function PipelinePanel() {
  const [runId, setRunId] = useState(null);
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(null);

  // 파이프라인 시작
  const startPipeline = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/sp500/pipeline/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: 'AAPL' }),
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
      <Card className="w-full h-full">
        <CardHeader>
          <CardTitle>SP500 파이프라인</CardTitle>
          <CardDescription>AAPL 단계별 분석 테스트</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={startPipeline} disabled={loading} size="lg" className="w-full">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                시작 중...
              </>
            ) : (
              '파이프라인 시작'
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>SP500 파이프라인</CardTitle>
          <CardDescription>Run ID: {runId}</CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {STEPS.map((step) => {
          const stepStatus = pipelineStatus?.steps?.[step.id];
          const status = stepStatus?.status || 'pending';
          const isCompleted = status === 'completed';
          const isFailed = status === 'failed';
          const isRunning = executing === step.id;

          return (
            <Card
              key={step.id}
              className={`transition-all ${
                isCompleted ? 'bg-white border-green-200' : isFailed ? 'bg-red-50' : 'bg-gray-50'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  {/* 왼쪽: 단계 정보 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      {isCompleted && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                      {isFailed && <AlertCircle className="w-5 h-5 text-red-600" />}
                      {status === 'pending' || status === 'running' ? (
                        <Clock className="w-5 h-5 text-gray-400" />
                      ) : null}

                      <div>
                        <p className="font-semibold text-sm">{step.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {isCompleted && '✓ 완료'}
                          {isFailed && '✗ 실패'}
                          {status === 'running' && '실행 중...'}
                          {status === 'pending' && '대기 중'}
                        </p>
                      </div>
                    </div>

                    {/* Result 표시 */}
                    {stepStatus?.result && (
                      <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
                        <p className="text-xs font-mono text-green-700">
                          {JSON.stringify(stepStatus.result, null, 2)}
                        </p>
                      </div>
                    )}

                    {/* Error 표시 */}
                    {stepStatus?.error && (
                      <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
                        <p className="text-xs text-red-700">{stepStatus.error}</p>
                      </div>
                    )}
                  </div>

                  {/* 오른쪽: 버튼 */}
                  <div className="ml-4">
                    {isCompleted && <Badge className="bg-green-600">완료</Badge>}
                    {isFailed && <Badge variant="destructive">실패</Badge>}
                    {isRunning && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
                    {!isCompleted && !isRunning && (
                      <Button
                        onClick={() => executeStep(step.id)}
                        size="sm"
                        variant="outline"
                        className="text-xs"
                      >
                        시작
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
