import React, { useState, useMemo } from 'react';
import {
  Feature,
  Holiday,
  Member,
  TaskProcess,
  ProjectSettings,
  TASK_ASSIGNEE_ROLES,
  normalizeMemberRole,
} from '../types';
import {
  X,
  Sparkles,
  Calendar,
  Clock,
  User,
  ArrowRight,
  Check,
  AlertCircle,
  CalendarOff,
  Zap,
} from 'lucide-react';
import { autoScheduleProcesses, isMemberWorkingDay } from '../utils/dateUtils';

interface AutoScheduleModalProps {
  feature: Feature;
  holidays: Holiday[];
  members: Member[];
  workloadUnit?: '人日' | '人時';
  dailyStandardHours?: number;
  settings?: ProjectSettings;
  onApplySchedule: (
    featureId: string,
    updatedProcesses: TaskProcess[],
    featureStartDate?: string,
    featureEndDate?: string
  ) => void;
  onClose: () => void;
}

export const AutoScheduleModal: React.FC<AutoScheduleModalProps> = ({
  feature,
  holidays,
  members,
  workloadUnit = '人日',
  dailyStandardHours = 8,
  settings,
  onApplySchedule,
  onClose,
}) => {
  // 工程担当者として選任可能なメンバー（課長、主任、担当、研修生）
  const eligibleAssignees = useMemo(() => {
    return members.filter((m) =>
      TASK_ASSIGNEE_ROLES.includes(normalizeMemberRole(m.role))
    );
  }, [members]);

  const activeWorkloadUnit = settings?.workloadUnit || workloadUnit;
  const activeDailyHours = settings?.dailyWorkingHours || dailyStandardHours;

  // 基準開始日（既存第1工程の開始日、または今日）
  const initialStartDate =
    feature.processes[0]?.startDate ||
    settings?.baselineDate ||
    new Date().toISOString().slice(0, 10);

  const [featureStartDate, setFeatureStartDate] = useState(initialStartDate);

  // 各工程の担当者・工数の編集用ローカル状態
  const [processesConfig, setProcessesConfig] = useState(
    feature.processes.map((p) => ({
      ...p,
      assignee: p.assignee || eligibleAssignees[0]?.name || '',
      plannedWorkload: p.plannedWorkload || 1,
    }))
  );

  // 担当者変更ハンドラー
  const handleAssigneeChange = (index: number, newAssignee: string) => {
    setProcessesConfig((prev) =>
      prev.map((p, i) => (i === index ? { ...p, assignee: newAssignee } : p))
    );
  };

  // 工数変更ハンドラー
  const handleWorkloadChange = (index: number, newWorkload: number) => {
    setProcessesConfig((prev) =>
      prev.map((p, i) => (i === index ? { ...p, plannedWorkload: Math.max(0.5, newWorkload) } : p))
    );
  };

  // 自動スケジュール計算
  const scheduleResult = useMemo(() => {
    return autoScheduleProcesses(
      featureStartDate,
      processesConfig,
      holidays,
      members,
      activeWorkloadUnit,
      activeDailyHours,
      settings?.weeklyMeetingHours
    );
  }, [featureStartDate, processesConfig, holidays, members, activeWorkloadUnit, activeDailyHours, settings?.weeklyMeetingHours]);

  const handleApply = () => {
    onApplySchedule(
      feature.id,
      scheduleResult.scheduledProcesses,
      featureStartDate,
      scheduleResult.featureEndDate
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* モーダルヘッダー */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 to-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                工程自動スケジューリング
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  {feature.name}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                機能開始日と各工程の担当者を指定すると、担当者の実稼働時間と休日（土日祝＋個別休暇）を考慮して全日程を自動算出します
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 設定 & サマリーパネル */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/70">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* 機能開始日入力 */}
            <div className="p-3 bg-white border border-indigo-200 rounded-xl shadow-2xs">
              <label className="text-xs font-bold text-indigo-900 block mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>機能の開始日 (基準日) *</span>
              </label>
              <input
                type="date"
                required
                value={featureStartDate}
                onChange={(e) => setFeatureStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 bg-indigo-50/30 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* 自動算出された全体日程プレビュー */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                自動計算による機能全体の期間
              </span>
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800">
                <span>{featureStartDate}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-indigo-600">{scheduleResult.featureEndDate}</span>
              </div>
            </div>

            {/* 総工数 & 単位 */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                工程総工数 / 工数単位
              </span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800 font-mono">
                  {scheduleResult.totalWorkload} {settings.workloadUnit}
                </span>
                <span className="text-[10px] text-slate-400">
                  {settings.workloadUnit === '人時' ? `基準: ${settings.hoursPerDay}h/日` : '日単位計算'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 各工程の担当者・工数入力 & スケジュール結果テーブル */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/90 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center">#</th>
                  <th className="px-3 py-2.5 w-36">工程名</th>
                  <th className="px-3 py-2.5 w-56">担当者 (マスタ連動)</th>
                  <th className="px-3 py-2.5 w-28">工数 ({settings.workloadUnit})</th>
                  <th className="px-3 py-2.5 text-center w-52">自動算出 日程 (期間)</th>
                  <th className="px-3 py-2.5">考慮された休日・休暇</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scheduleResult.scheduledProcesses.map((proc, index) => {
                  const assignedMember = members.find((m) => m.name === proc.assignee?.trim());
                  const memberHours = assignedMember?.dailyWorkingHours || settings.hoursPerDay;
                  const memberHolidaysCount = assignedMember?.individualHolidays.length || 0;

                  return (
                    <tr key={proc.id || index} className="hover:bg-indigo-50/20 transition-colors">
                      {/* 番号 */}
                      <td className="px-3 py-2 text-center text-slate-400 font-mono text-[11px]">
                        {index + 1}
                      </td>

                      {/* 工程名 */}
                      <td className="px-3 py-2 font-bold text-slate-800">
                        {proc.processType}
                      </td>

                      {/* 担当者セレクト */}
                      <td className="px-3 py-2">
                        <div className="space-y-1">
                          <select
                            value={proc.assignee}
                            onChange={(e) => handleAssigneeChange(index, e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-medium focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          >
                            <option value="">(担当未設定)</option>
                            {proc.assignee && !eligibleAssignees.some((m) => m.name === proc.assignee) && (
                              <option value={proc.assignee}>
                                {proc.assignee} (現在の設定)
                              </option>
                            )}
                            {eligibleAssignees.map((m) => {
                              const role = normalizeMemberRole(m.role);
                              return (
                                <option key={m.id} value={m.name}>
                                  {m.name} ({role} / {m.dailyWorkingHours}h/日)
                                </option>
                              );
                            })}
                          </select>
                          {assignedMember && (
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                              <span className="font-mono bg-slate-100 px-1 py-0.2 rounded">
                                {memberHours}h/日
                              </span>
                              {memberHolidaysCount > 0 && (
                                <span className="text-rose-600 font-medium flex items-center gap-0.5">
                                  <CalendarOff className="w-2.5 h-2.5" />
                                  個別休暇{memberHolidaysCount}日
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 工数入力 */}
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={proc.plannedWorkload}
                          onChange={(e) => handleWorkloadChange(index, Number(e.target.value))}
                          className="w-20 px-2 py-1 text-xs border border-slate-300 rounded bg-white font-mono text-right"
                        />
                      </td>

                      {/* 算出日程 */}
                      <td className="px-3 py-2 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 font-mono font-bold text-xs">
                          <span>{proc.startDate}</span>
                          <span className="text-slate-400 font-normal">〜</span>
                          <span>{proc.endDate}</span>
                        </div>
                      </td>

                      {/* 休日スキップ注記 */}
                      <td className="px-3 py-2 text-[11px] text-slate-500">
                        {assignedMember && assignedMember.individualHolidays.some((ih) => ih.date >= proc.startDate && ih.date <= proc.endDate) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-md font-medium text-[10px]">
                            <CalendarOff className="w-3 h-3" />
                            <span>担当者休暇を自動スキップ済</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">土日祝除外済</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            工程数: <strong className="text-slate-800">{scheduleResult.scheduledProcesses.length}</strong> 件
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>このスケジュールをWBSに適用</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
