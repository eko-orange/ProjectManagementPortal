import React, { useState, useMemo, useEffect } from 'react';
import {
  Feature,
  Holiday,
  Member,
  STANDARD_PROCESSES,
  COMMON_PROCESS_SUGGESTIONS,
  TASK_ASSIGNEE_ROLES,
  normalizeMemberRole,
  ProcessStructurePattern,
} from '../types';
import { INITIAL_PROCESS_STRUCTURE_PATTERNS } from '../data/initialData';
import {
  X,
  Plus,
  Sparkles,
  Layers,
  Trash2,
  RotateCcw,
  ArrowRight,
  User,
  CalendarOff,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  GripVertical,
  Workflow,
  Settings,
} from 'lucide-react';
import { autoScheduleProcesses, getTodayString } from '../utils/dateUtils';

interface AddFeatureModalProps {
  holidays: Holiday[];
  members?: Member[];
  workloadUnit?: '人時' | '人日';
  hoursPerDay?: number;
  weeklyMeetingHours?: { [dayOfWeek: number]: number };
  processPatterns?: ProcessStructurePattern[];
  onOpenProcessMaster?: () => void;
  onAddFeature: (feature: Feature) => void;
  onClose: () => void;
}

interface ProcessItemConfig {
  id: string;
  name: string;
  days: number;
  assignee: string;
}

export const AddFeatureModal: React.FC<AddFeatureModalProps> = ({
  holidays,
  members = [],
  workloadUnit = '人日',
  hoursPerDay = 8,
  weeklyMeetingHours,
  processPatterns = [],
  onOpenProcessMaster,
  onAddFeature,
  onClose,
}) => {
  // 機能・工程の担当者として選任可能なメンバー（課長、主任、担当、研修生）
  const eligibleAssignees = useMemo(() => {
    return members.filter((m) =>
      TASK_ASSIGNEE_ROLES.includes(normalizeMemberRole(m.role))
    );
  }, [members]);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('一般機能');
  const [stepCount, setStepCount] = useState<string>('');
  const [startDate, setStartDate] = useState(getTodayString());
  const [defaultAssignee, setDefaultAssignee] = useState(eligibleAssignees[0]?.name || '');

  // 有効な工程構成パターンリスト（マスタから取得または初期標準値）
  const availablePatterns = useMemo(() => {
    if (Array.isArray(processPatterns) && processPatterns.length > 0) {
      return processPatterns;
    }
    return INITIAL_PROCESS_STRUCTURE_PATTERNS;
  }, [processPatterns]);

  // デフォルト適用パターン
  const defaultPattern = useMemo(() => {
    const found = availablePatterns.find((p) => p.isDefault);
    return found || availablePatterns[0];
  }, [availablePatterns]);

  // 選択中のパターンID
  const [selectedPatternId, setSelectedPatternId] = useState<string>(defaultPattern.id);

  // 選択中パターンのオブジェクト
  const activePattern = useMemo(() => {
    return availablePatterns.find((p) => p.id === selectedPatternId) || defaultPattern;
  }, [availablePatterns, selectedPatternId, defaultPattern]);

  // 編集可能な工程リスト（工程構成マスタの初期値を反映）
  const [processesConfig, setProcessesConfig] = useState<ProcessItemConfig[]>(() =>
    defaultPattern.processes.map((p, idx) => ({
      id: `proc-cfg-${p.id || idx + 1}-${Date.now()}`,
      name: p.name,
      days: workloadUnit === '人時' ? p.defaultDays * hoursPerDay : p.defaultDays,
      assignee: eligibleAssignees[idx % Math.max(1, eligibleAssignees.length)]?.name || '',
    }))
  );

  // パターン切り替え処理
  const handleSelectPattern = (patternId: string) => {
    setSelectedPatternId(patternId);
    const target = availablePatterns.find((p) => p.id === patternId);
    if (!target) return;

    setProcessesConfig(
      target.processes.map((p, idx) => ({
        id: `proc-cfg-${p.id || idx + 1}-${Date.now()}`,
        name: p.name,
        days: workloadUnit === '人時' ? p.defaultDays * hoursPerDay : p.defaultDays,
        assignee: defaultAssignee || eligibleAssignees[idx % Math.max(1, eligibleAssignees.length)]?.name || '',
      }))
    );
  };

  // 選択中パターンの工程構成にリセット
  const handleResetToCurrentPattern = () => {
    setProcessesConfig(
      activePattern.processes.map((p, idx) => ({
        id: `proc-cfg-${p.id || idx + 1}-${Date.now()}`,
        name: p.name,
        days: workloadUnit === '人時' ? p.defaultDays * hoursPerDay : p.defaultDays,
        assignee: defaultAssignee || eligibleAssignees[idx % Math.max(1, eligibleAssignees.length)]?.name || '',
      }))
    );
  };

  // 工程の変更
  const handleUpdateProcessItem = (id: string, updated: Partial<ProcessItemConfig>) => {
    setProcessesConfig((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
    );
  };

  // 工程の削除
  const handleDeleteProcessItem = (id: string) => {
    if (processesConfig.length <= 1) {
      alert('最低1つの工程が必要です');
      return;
    }
    setProcessesConfig((prev) => prev.filter((item) => item.id !== id));
  };

  // 工程の並び順を上へ移動（日程も連鎖して再計算）
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setProcessesConfig((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // 工程の並び順を下へ移動（日程も連鎖して再計算）
  const handleMoveDown = (index: number) => {
    if (index >= processesConfig.length - 1) return;
    setProcessesConfig((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // ドラッグ＆ドロップによる並び替え
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }
    setProcessesConfig((prev) => {
      const next = [...prev];
      const [removed] = next.splice(draggedIndex, 1);
      next.splice(targetIndex, 0, removed);
      return next;
    });
    setDraggedIndex(null);
  };

  // 工程の追加
  const handleAddProcessItem = (presetName: string = '新規工程') => {
    const newId = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const defaultVal = workloadUnit === '人時' ? 3 * hoursPerDay : 3;
    setProcessesConfig((prev) => [
      ...prev,
      {
        id: newId,
        name: presetName,
        days: defaultVal,
        assignee: defaultAssignee,
      },
    ]);
  };

  // 初期担当者が変更された際、空の担当者フィールドに反映する補助
  const handleDefaultAssigneeChange = (val: string) => {
    setDefaultAssignee(val);
    setProcessesConfig((prev) =>
      prev.map((item) => (item.assignee === '' || item.assignee === defaultAssignee ? { ...item, assignee: val } : item))
    );
  };

  // 合計工数とスケジュール連鎖計算（担当者の稼働時間・個別休暇・曜日定例会・前工程あまり時間を自動反映）
  const schedulePreview = useMemo(() => {
    const procInputs = processesConfig.map((p) => ({
      ...p,
      processType: p.name,
      plannedWorkload: p.days,
    }));

    const result = autoScheduleProcesses(
      startDate,
      procInputs,
      holidays,
      members,
      workloadUnit === '人時' ? '人時' : '人日',
      hoursPerDay,
      weeklyMeetingHours
    );

    const itemsWithDates = result.scheduledProcesses.map((p, idx) => ({
      ...processesConfig[idx],
      startDate: p.startDate,
      endDate: p.endDate,
      duration: p.plannedWorkload,
    }));

    return {
      itemsWithDates,
      totalWorkload: result.totalWorkload,
      finalEndDate: result.featureEndDate,
    };
  }, [processesConfig, startDate, holidays, members, workloadUnit, hoursPerDay, weeklyMeetingHours]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (processesConfig.length === 0) {
      alert('少なくとも1つの工程を設定してください');
      return;
    }

    const featureId = `feat-${Date.now()}`;

    // 各工程のタスクオブジェクトを生成
    const processes = schedulePreview.itemsWithDates.map((item, idx) => ({
      id: `proc-${featureId}-${idx + 1}`,
      featureId,
      processType: item.name.trim() || `工程 ${idx + 1}`,
      assignee: (item.assignee || defaultAssignee || '未定').trim(),
      plannedWorkload: item.duration,
      actualWorkload: 0,
      startDate: item.startDate,
      endDate: item.endDate,
      actualProgress: 0,
      notes: '',
    }));

    const newFeature: Feature = {
      id: featureId,
      name: name.trim(),
      category: category.trim() || '一般機能',
      isExpanded: true,
      stepCount: stepCount.trim() ? Math.max(0, parseInt(stepCount.trim(), 10) || 0) : undefined,
      processes,
    };

    onAddFeature(newFeature);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">新規機能の追加</h2>
              <p className="text-xs text-slate-500">
                工程の構成・追加・削除・期間を自由にカスタマイズできます
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* フォーム（スクロール可能） */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 基本情報 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              機能名 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="例: 通知・プッシュ配信機能"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                カテゴリ / モジュール
              </label>
              <input
                type="text"
                placeholder="例: フロント機能"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Step数 (規模)</span>
                <span className="text-[10px] text-slate-400 font-normal">任意</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="例: 1500"
                value={stepCount}
                onChange={(e) => setStepCount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-right"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  初期担当者
                </label>
              </div>
              <select
                value={defaultAssignee}
                onChange={(e) => handleDefaultAssigneeChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-medium cursor-pointer"
              >
                <option value="">(未指定 / 各工程で個別選択)</option>
                {defaultAssignee && !eligibleAssignees.some((m) => m.name === defaultAssignee) && (
                  <option value={defaultAssignee}>{defaultAssignee} (現在の設定)</option>
                )}
                {eligibleAssignees.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                開始予定日
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* 工程構成セクション */}
          <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/70">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Workflow className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800">
                  工程構成 ({processesConfig.length} 工程 / 合計 {schedulePreview.totalWorkload} {workloadUnit})
                </span>
                <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                  <ArrowUpDown className="w-2.5 h-2.5" />
                  ▲▼で順序・日程並び替え
                </span>
              </div>

              {/* 工程構成パターンセレクター＆マスタ連携 */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <label className="text-[11px] font-semibold text-slate-600 shrink-0">
                    マスタ構成:
                  </label>
                  <select
                    value={selectedPatternId}
                    onChange={(e) => handleSelectPattern(e.target.value)}
                    className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 font-semibold focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                    title="工程構成マスタで定義されたパターンを選択"
                  >
                    {availablePatterns.map((pat) => (
                      <option key={pat.id} value={pat.id}>
                        {pat.isDefault ? '★ ' : ''}{pat.name} ({pat.processes.length}工程)
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleResetToCurrentPattern}
                  className="text-[11px] text-slate-600 hover:text-indigo-600 flex items-center gap-1 hover:underline cursor-pointer bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs"
                  title="選択中のマスタ工程構成にリセット"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
                  <span>初期構成にリセット</span>
                </button>

                {onOpenProcessMaster && (
                  <button
                    type="button"
                    onClick={onOpenProcessMaster}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded"
                    title="工程構成マスタ管理を開いて初期工程を編集"
                  >
                    <Settings className="w-3 h-3" />
                    <span>マスタ管理</span>
                  </button>
                )}
              </div>
            </div>

            {/* 工程リストテーブル */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {schedulePreview.itemsWithDates.map((item, idx) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={`flex items-center gap-1.5 bg-white p-2 rounded-md border text-xs shadow-2xs transition-all ${
                    draggedIndex === idx
                      ? 'border-indigo-400 bg-indigo-50/50 opacity-60 ring-2 ring-indigo-200'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* 並び替え用ドラッグハンドル＆上下矢印ボタン */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <div
                      className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-0.5"
                      title="ドラッグして工程順序を並び替え"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                    {/* 上へ移動ボタン */}
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveUp(idx)}
                      className={`p-0.5 rounded transition-colors ${
                        idx === 0
                          ? 'text-slate-200 cursor-not-allowed'
                          : 'text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 cursor-pointer'
                      }`}
                      title={idx === 0 ? '先頭の工程です' : '工程を前へ移動（日程も再計算）'}
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    {/* 下へ移動ボタン */}
                    <button
                      type="button"
                      disabled={idx === schedulePreview.itemsWithDates.length - 1}
                      onClick={() => handleMoveDown(idx)}
                      className={`p-0.5 rounded transition-colors ${
                        idx === schedulePreview.itemsWithDates.length - 1
                          ? 'text-slate-200 cursor-not-allowed'
                          : 'text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 cursor-pointer'
                      }`}
                      title={
                        idx === schedulePreview.itemsWithDates.length - 1
                          ? '末尾の工程です'
                          : '工程を次へ移動（日程も再計算）'
                      }
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>

                  {/* 工程名入力（datalist候補付き） */}
                  <div className="flex-1 min-w-[120px]">
                    <input
                      type="text"
                      list="feature-process-suggestions"
                      value={item.name}
                      onChange={(e) => handleUpdateProcessItem(item.id, { name: e.target.value })}
                      placeholder="工程名"
                      className="w-full bg-slate-50/50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  {/* 稼働日数 / 工数 */}
                  <div className="w-20 shrink-0 flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.days}
                      onChange={(e) =>
                        handleUpdateProcessItem(item.id, {
                          days: Math.max(0.1, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-12 bg-slate-50/50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded px-1.5 py-1 text-xs font-mono text-right text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                    />
                    <span className="text-[10px] text-slate-500 font-semibold">{workloadUnit === '人時' ? 'h' : '日'}</span>
                  </div>

                  {/* 担当者 */}
                  <div className="w-36 shrink-0">
                    <select
                      value={item.assignee}
                      onChange={(e) => handleUpdateProcessItem(item.id, { assignee: e.target.value })}
                      className="w-full bg-slate-50/70 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded px-1.5 py-1 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-medium cursor-pointer"
                      title="工程担当者を選択（課長・主任・担当・研修生）"
                    >
                      <option value="">(担当未設定)</option>
                      {item.assignee && !eligibleAssignees.some((m) => m.name === item.assignee) && (
                        <option value={item.assignee}>{item.assignee} (現在の設定)</option>
                      )}
                      {eligibleAssignees.map((m) => (
                        <option key={m.id} value={m.name}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 日程プレビュー */}
                  <div
                    className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-slate-500 shrink-0 px-1"
                    title="順序変更に伴い自動再計算された開始〜終了日"
                  >
                    <span className="font-semibold text-slate-700">{item.startDate.slice(5)}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                    <span className="font-semibold text-slate-700">{item.endDate.slice(5)}</span>
                  </div>

                  {/* 削除ボタン */}
                  <button
                    type="button"
                    onClick={() => handleDeleteProcessItem(item.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors shrink-0"
                    title="この工程を削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* 工程追加ボタン＆クイック追加チップ */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/80">
              <button
                type="button"
                onClick={() => handleAddProcessItem('新規工程')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-medium cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>工程を追加</span>
              </button>

              <span className="text-[11px] text-slate-400 ml-1">候補から追加:</span>
              {COMMON_PROCESS_SUGGESTIONS.slice(0, 7).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleAddProcessItem(preset)}
                  className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[10px] text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                >
                  +{preset}
                </button>
              ))}
            </div>
          </div>

          <datalist id="feature-process-suggestions">
            {COMMON_PROCESS_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          {/* 全体日程サマリー */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs flex items-center justify-between text-slate-600 font-mono">
            <span>
              全体予定期間: {startDate} 〜 {schedulePreview.finalEndDate}
            </span>
            <div className="flex items-center gap-3">
              {stepCount && parseInt(stepCount, 10) > 0 && schedulePreview.totalWorkload > 0 && (
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  予定生産性: {Math.round(parseInt(stepCount, 10) / schedulePreview.totalWorkload)} Step/{workloadUnit}
                </span>
              )}
              <span className="font-bold text-slate-800">
                合計 {schedulePreview.totalWorkload} {workloadUnit}
              </span>
            </div>
          </div>

          {/* モーダルフッター */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              機能と工程を作成
            </button>
          </div>

          {/* 担当者マスタ候補 datalist */}
          <datalist id="feature-member-suggestions">
            {members.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name} ({m.dailyWorkingHours}h/日 {m.role ? `- ${m.role}` : ''})
              </option>
            ))}
          </datalist>
        </form>
      </div>
    </div>
  );
};
