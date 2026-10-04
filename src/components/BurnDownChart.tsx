import React, { useState, useMemo } from 'react';
import { Feature, Holiday, ProjectSettings } from '../types';
import { computeBurnDownData } from '../utils/wbsCalculations';
import { X, TrendingDown, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface BurnDownChartProps {
  features: Feature[];
  settings: ProjectSettings;
  holidays: Holiday[];
  onClose: () => void;
}

export const BurnDownChart: React.FC<BurnDownChartProps> = ({
  features,
  settings,
  holidays,
  onClose,
}) => {
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | 'all'>('all');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  const { data, totalWorkload, currentRemaining, completionRate } = useMemo(() => {
    return computeBurnDownData(features, selectedFeatureId, settings.baselineDate, holidays);
  }, [features, selectedFeatureId, settings.baselineDate, holidays]);

  // SVG描画パラメータ
  const chartWidth = 960;
  const chartHeight = 280;
  const padding = { top: 24, right: 36, bottom: 44, left: 52 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const maxWorkload = Math.max(totalWorkload, 1);
  const pointCount = data.length;

  const getX = (index: number) => {
    if (pointCount <= 1) return padding.left;
    return padding.left + (index / (pointCount - 1)) * innerWidth;
  };

  const getY = (val: number) => {
    return padding.top + innerHeight - (val / maxWorkload) * innerHeight;
  };

  // 理想線のパス
  const idealPath = useMemo(() => {
    if (data.length === 0) return '';
    return data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.idealRemaining)}`)
      .join(' ');
  }, [data, maxWorkload]);

  // 予定残工数線のパス
  const plannedPath = useMemo(() => {
    if (data.length === 0) return '';
    return data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.plannedRemaining)}`)
      .join(' ');
  }, [data, maxWorkload]);

  // 実績残工数線のパス (今日まで)
  const actualPath = useMemo(() => {
    const points = data
      .map((d, i) => (d.actualRemaining !== null ? { x: getX(i), y: getY(d.actualRemaining) } : null))
      .filter(Boolean) as Array<{ x: number; y: number }>;

    if (points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [data, maxWorkload]);

  // 今日以降の予測値マップ（日付 => 予測残工数）
  // 遅れが大きい場合でも急な下降（垂直崖落ち）にならず、終盤（完了予定）へ向けて現実的に緩やかに収束する滑らかな推移を計算
  const forecastMap = useMemo(() => {
    const map: Record<string, number> = {};
    const todayIndex = data.findIndex((d) => d.date === settings.baselineDate);
    if (todayIndex === -1) return map;

    const todayPoint = data[todayIndex];
    if (todayPoint.actualRemaining === null) return map;

    const actualRemainingToday = todayPoint.actualRemaining;
    const plannedRemainingToday = todayPoint.plannedRemaining;
    map[todayPoint.date] = actualRemainingToday;

    if (todayIndex >= data.length - 1) return map;

    // 残りの稼働日数をカウント
    const remainingDays = data.slice(todayIndex + 1);
    const totalRemainingWorkDays = remainingDays.filter((d) => d.isWorkingDay).length;

    // 現在の遅延工数（実績残 - 予定残、遅延時はプラス）
    const currentDelay = actualRemainingToday - plannedRemainingToday;

    let elapsedWorkDaysAfterToday = 0;
    for (let i = todayIndex + 1; i < data.length; i++) {
      const d = data[i];
      if (d.isWorkingDay) {
        elapsedWorkDaysAfterToday++;
      }

      // 稼働日進捗比率 (0から1へ稼働日に応じて徐々に進む)
      const progressRatio = totalRemainingWorkDays > 0
        ? Math.min(1, elapsedWorkDaysAfterToday / totalRemainingWorkDays)
        : (i - todayIndex) / (data.length - 1 - todayIndex);

      // 遅延分を終盤に向けて徐々に消化・収束させる（1 - progressRatio）
      // 稼働日が進むごとに過剰残工数が一定かつ緩やかに減衰し、急な下降を防ぐ
      const remainingDelay = currentDelay * (1 - progressRatio);
      const forecastVal = Math.max(
        0,
        Math.round((d.plannedRemaining + remainingDelay) * 10) / 10
      );
      map[d.date] = forecastVal;
    }

    return map;
  }, [data, settings.baselineDate]);

  // 今日以降の予測線 (今日の実績点から終盤へ緩やかに収束する線)
  const forecastPath = useMemo(() => {
    const todayIndex = data.findIndex((d) => d.date === settings.baselineDate);
    if (todayIndex === -1 || todayIndex >= data.length - 1) return '';

    const points: Array<{ x: number; y: number }> = [];
    for (let i = todayIndex; i < data.length; i++) {
      const d = data[i];
      const val = forecastMap[d.date];
      if (val !== undefined) {
        points.push({ x: getX(i), y: getY(val) });
      }
    }

    if (points.length <= 1) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [data, forecastMap, settings.baselineDate, maxWorkload]);

  // 基準日（今日）のX座標
  const todayIndex = data.findIndex((d) => d.date === settings.baselineDate);
  const todayX = todayIndex !== -1 ? getX(todayIndex) : null;

  const hoveredData = hoveredPointIndex !== null ? data[hoveredPointIndex] : null;

  return (
    <div className="bg-white border-b border-slate-200 shadow-sm p-4 transition-all animate-fadeIn">
      {/* 上部コントロール */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">バーンダウンチャート</h2>
              <p className="text-xs text-slate-500">工数消化推移と残工数の可視化</p>
            </div>
          </div>

          {/* 機能フィルタ切り替え */}
          <div className="flex items-center gap-1.5 ml-4 text-xs">
            <span className="text-slate-500 font-medium">対象:</span>
            <select
              value={selectedFeatureId}
              onChange={(e) => setSelectedFeatureId(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-md px-2 py-1 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">プロジェクト全体（全機能）</option>
              {features.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* サマリーメトリクス & 閉じるボタン */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">総予定工数</span>
              <span className="font-bold text-slate-800 font-mono">
                {totalWorkload} {settings.workloadUnit}
              </span>
            </div>
            <div className="w-px h-6 bg-slate-200"></div>
            <div>
              <span className="text-slate-400 block text-[10px]">現在残工数</span>
              <span className="font-bold text-blue-600 font-mono">
                {currentRemaining} {settings.workloadUnit}
              </span>
            </div>
            <div className="w-px h-6 bg-slate-200"></div>
            <div>
              <span className="text-slate-400 block text-[10px]">消化進捗率</span>
              <span className="font-bold text-emerald-600 font-mono">{completionRate}%</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            title="チャートを閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* チャート描画領域 */}
      <div className="relative w-full overflow-x-auto bg-slate-50/50 rounded-lg border border-slate-200 p-2">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto max-h-[300px] overflow-visible"
        >
          {/* グリッド水平線 */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + innerHeight * (1 - ratio);
            const val = Math.round(maxWorkload * ratio * 10) / 10;
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-mono"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* 休日背景シャドウ */}
          {data.map((d, i) => {
            if (d.isWorkingDay) return null;
            const x = getX(i);
            const width = innerWidth / Math.max(pointCount, 1);
            return (
              <rect
                key={`weekend-${d.date}`}
                x={x - width / 2}
                y={padding.top}
                width={width}
                height={innerHeight}
                fill="#f1f5f9"
                opacity="0.6"
              />
            );
          })}

          {/* 基準日ライン */}
          {todayX !== null && (
            <g>
              <line
                x1={todayX}
                y1={padding.top}
                x2={todayX}
                y2={chartHeight - padding.bottom}
                stroke="#3b82f6"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <text
                x={todayX}
                y={padding.top - 6}
                textAnchor="middle"
                className="text-[10px] font-bold fill-blue-600 font-sans"
              >
                今日
              </text>
            </g>
          )}

          {/* 理想線 (Ideal Burn Down) */}
          <path
            d={idealPath}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeDasharray="4 4"
          />

          {/* 予定残工数線 (Planned) */}
          <path
            d={plannedPath}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />

          {/* 予測線 (Forecast from Today) */}
          {forecastPath && (
            <path
              d={forecastPath}
              fill="none"
              stroke="#0284c7"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
          )}

          {/* 実績残工数線 (Actual Burn Down) */}
          <path
            d={actualPath}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* 実績データポイント */}
          {data.map((d, i) => {
            if (d.actualRemaining === null) return null;
            const cx = getX(i);
            const cy = getY(d.actualRemaining);
            const isHovered = hoveredPointIndex === i;
            return (
              <circle
                key={`actual-pt-${d.date}`}
                cx={cx}
                cy={cy}
                r={isHovered ? 5 : 3.5}
                fill="#2563eb"
                stroke="#ffffff"
                strokeWidth="1.5"
                className="transition-all cursor-pointer"
                onMouseEnter={() => setHoveredPointIndex(i)}
                onMouseLeave={() => setHoveredPointIndex(null)}
              />
            );
          })}

          {/* X軸日付ラベル */}
          {data.map((d, i) => {
            // 間引き表示（データ点数に応じて数日おき）
            const interval = Math.ceil(pointCount / 14);
            if (i % interval !== 0 && i !== pointCount - 1 && i !== todayIndex) return null;

            const x = getX(i);
            const isToday = d.date === settings.baselineDate;
            return (
              <text
                key={`x-label-${d.date}`}
                x={x}
                y={chartHeight - padding.bottom + 18}
                textAnchor="middle"
                className={`text-[10px] font-mono ${
                  isToday ? 'fill-blue-600 font-bold' : d.isWorkingDay ? 'fill-slate-500' : 'fill-rose-400'
                }`}
              >
                {d.displayDate}
              </text>
            );
          })}

          {/* ホバー時の垂直インジケータ */}
          {hoveredPointIndex !== null && (
            <line
              x1={getX(hoveredPointIndex)}
              y1={padding.top}
              x2={getX(hoveredPointIndex)}
              y2={chartHeight - padding.bottom}
              stroke="#64748b"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          )}
        </svg>

        {/* ツールチップ */}
        {hoveredData && hoveredPointIndex !== null && (
          <div
            className="absolute z-20 bg-slate-900 text-white text-xs rounded-lg px-2.5 py-2 shadow-lg pointer-events-none"
            style={{
              left: `${Math.min(getX(hoveredPointIndex) + 12, chartWidth - 140)}px`,
              top: '30px',
            }}
          >
            <div className="font-semibold text-slate-200 border-b border-slate-700 pb-1 mb-1">
              {hoveredData.date} {hoveredData.isWorkingDay ? '(稼働日)' : '(休日)'}
            </div>
            <div className="space-y-0.5 text-[11px] font-mono">
              <div className="flex justify-between gap-3 text-slate-300">
                <span>理想残:</span>
                <span>{hoveredData.idealRemaining} {settings.workloadUnit}</span>
              </div>
              <div className="flex justify-between gap-3 text-slate-300">
                <span>予定残:</span>
                <span>{hoveredData.plannedRemaining} {settings.workloadUnit}</span>
              </div>
              {hoveredData.actualRemaining !== null ? (
                <div className="flex justify-between gap-3 text-blue-400 font-bold">
                  <span>実績残:</span>
                  <span>{hoveredData.actualRemaining} {settings.workloadUnit}</span>
                </div>
              ) : forecastMap[hoveredData.date] !== undefined ? (
                <div className="flex justify-between gap-3 text-sky-400 font-bold">
                  <span>収束予測残:</span>
                  <span>{forecastMap[hoveredData.date]} {settings.workloadUnit}</span>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap items-center justify-center gap-5 mt-2.5 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-blue-600 inline-block"></span>
          <span className="font-medium text-slate-800">実績残工数</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-b border-dashed border-slate-400 inline-block"></span>
          <span>理想消化線 (均等消化)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-slate-300 inline-block"></span>
          <span>予定スケジュール残工数</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-b border-dashed border-sky-500 inline-block"></span>
          <span>収束予測線（遅延加味・緩やかな収束）</span>
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="w-3 h-3 bg-slate-200/80 rounded-xs inline-block"></span>
          <span>土日・非稼働日</span>
        </span>
      </div>
    </div>
  );
};
