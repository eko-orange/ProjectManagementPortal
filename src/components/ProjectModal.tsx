import React, { useState, useEffect, useMemo } from 'react';
import { X, FolderPlus, Edit3, User, Clock, FileText, Check, ShieldCheck, AlertCircle } from 'lucide-react';
import { Project, ProjectSettings, Member, PROJECT_MANAGER_ROLES, normalizeMemberRole, Estimate } from '../types';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    manager: string;
    description: string;
    workloadUnit: '人時' | '人日';
    hoursPerDay: number;
    weeklyMeetingHours?: { [dayOfWeek: number]: number };
    estimateId?: string;
    estimateNumber?: string;
    estimateTitle?: string;
  }) => void;
  projectToEdit?: Project | null;
  members?: Member[];
  estimates?: Estimate[];
}

const DAYS_SHORT = [
  { day: 1, label: '月' },
  { day: 2, label: '火' },
  { day: 3, label: '水' },
  { day: 4, label: '木' },
  { day: 5, label: '金' },
  { day: 6, label: '土' },
  { day: 0, label: '日' },
];

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSave,
  projectToEdit,
  members = [],
  estimates = [],
}) => {
  const isEdit = Boolean(projectToEdit);

  // プロジェクト管理者として選任可能なメンバー（本部長、副本部長、部長、課長）
  const eligibleManagers = useMemo(() => {
    return members.filter((m) =>
      PROJECT_MANAGER_ROLES.includes(normalizeMemberRole(m.role))
    );
  }, [members]);

  const [name, setName] = useState('');
  const [manager, setManager] = useState('');
  const [description, setDescription] = useState('');
  const [workloadUnit, setWorkloadUnit] = useState<'人時' | '人日'>('人日');
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [weeklyMeetingHours, setWeeklyMeetingHours] = useState<{ [day: number]: number }>({
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
  });
  const [estimateId, setEstimateId] = useState<string>('');
  const [showMeetingConfig, setShowMeetingConfig] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (projectToEdit) {
      setName(projectToEdit.name || '');
      setManager(projectToEdit.manager || '');
      setDescription(projectToEdit.description || '');
      setWorkloadUnit(projectToEdit.settings?.workloadUnit || '人日');
      setHoursPerDay(projectToEdit.settings?.hoursPerDay || 8);
      setEstimateId(projectToEdit.estimateId || '');
      const initialMeetings: { [day: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      if (projectToEdit.settings?.weeklyMeetingHours) {
        Object.entries(projectToEdit.settings.weeklyMeetingHours).forEach(([k, v]) => {
          initialMeetings[Number(k)] = Number(v) || 0;
        });
      }
      setWeeklyMeetingHours(initialMeetings);
      setError('');
    } else {
      setName('');
      // 新規作成時は選任可能な最初のメンバーを初期設定
      setManager(eligibleManagers[0]?.name || '');
      setDescription('');
      setWorkloadUnit('人日');
      setHoursPerDay(8);
      setEstimateId('');
      setWeeklyMeetingHours({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
      setError('');
    }
  }, [projectToEdit, isOpen, eligibleManagers]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('プロジェクト名を入力してください');
      return;
    }
    if (!manager.trim()) {
      setError('プロジェクト管理者名を入力してください');
      return;
    }

    const linkedEstimate = estimates?.find((est) => est.id === estimateId);

    onSave({
      name: name.trim(),
      manager: manager.trim(),
      description: description.trim(),
      workloadUnit,
      hoursPerDay: Number(hoursPerDay) || 8,
      weeklyMeetingHours,
      estimateId: linkedEstimate ? linkedEstimate.id : undefined,
      estimateNumber: linkedEstimate ? linkedEstimate.estimateNumber : undefined,
      estimateTitle: linkedEstimate ? linkedEstimate.title : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-modal-title"
      >
        {/* ヘッダー */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {isEdit ? <Edit3 className="w-5 h-5" /> : <FolderPlus className="w-5 h-5" />}
            </div>
            <div>
              <h2 id="project-modal-title" className="text-base font-bold text-white">
                {isEdit ? 'プロジェクト情報の編集' : '新規プロジェクト作成'}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {isEdit ? 'プロジェクトの基本情報および管理者を更新します' : '新しいプロジェクトを登録してWBS管理を開始します'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/50 transition-colors"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* フォーム本体 */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="px-3.5 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          {/* プロジェクト名 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              プロジェクト名 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="例: 次世代基幹システムリプレイス"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* プロジェクト管理者 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                プロジェクト管理者 (PM) <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 font-medium">
                対象役職: 本部長・副本部長・部長・課長
              </span>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <select
                required
                value={manager}
                onChange={(e) => {
                  setManager(e.target.value);
                  if (error) setError('');
                }}
                className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all bg-white font-medium cursor-pointer"
              >
                <option value="">-- プロジェクト管理者を選択してください --</option>
                {/* 既存設定値が対象外や未登録でも失われないよう保護 */}
                {manager && !eligibleManagers.some((m) => m.name === manager) && (
                  <option value={manager}>
                    {manager} (現在の設定)
                  </option>
                )}
                {eligibleManagers.map((m) => {
                  const role = normalizeMemberRole(m.role);
                  return (
                    <option key={m.id} value={m.name}>
                      {m.name} ({role}{m.department ? ` - ${m.department}` : ''})
                    </option>
                  );
                })}
              </select>
            </div>

            {eligibleManagers.length === 0 ? (
              <div className="flex items-center gap-1.5 p-2 mt-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  担当者マスタに対象役職（本部長・副本部長・部長・課長）のメンバーが登録されていません。担当者マスタで役職を設定してください。
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 mt-1">
                担当者マスタで「本部長」「副本部長」「部長」「課長」に任命されているメンバーから選択可能です
              </p>
            )}
          </div>

          {/* プロジェクト概要 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              プロジェクト概要・目的
            </label>
            <div className="relative">
              <div className="absolute top-2.5 left-3 pointer-events-none text-slate-400">
                <FileText className="w-4 h-4" />
              </div>
              <textarea
                rows={2}
                placeholder="プロジェクトの目的、スコープ、特記事項など"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all placeholder:text-slate-400 resize-none"
              />
            </div>
          </div>

          {/* 見積管理との連携設定 */}
          {estimates && estimates.length > 0 && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1.5">
              <label className="block text-xs font-bold text-indigo-950 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>見積管理との連携</span>
                </span>
                {estimateId ? (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-200 text-indigo-900 font-bold">
                    連携設定中
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 font-semibold">
                    未連携（単体登録）
                  </span>
                )}
              </label>
              <select
                value={estimateId}
                onChange={(e) => setEstimateId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:border-indigo-500 font-medium cursor-pointer"
              >
                <option value="">-- 未連携（単体登録プロジェクトとして管理） --</option>
                {estimates.map((est) => (
                  <option key={est.id} value={est.id}>
                    🏷️ {est.estimateNumber} - {est.title} (顧客: {est.clientName} / {est.features.length}機能)
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 leading-tight">
                見積を選択すると、見積管理番号が進捗管理ヘッダーおよびWBS上に表示されます。
              </p>
            </div>
          )}

          {/* 工数単位 & 1日の稼働時間 */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                工数表示単位
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setWorkloadUnit('人日')}
                  className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                    workloadUnit === '人日'
                      ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  人日
                </button>
                <button
                  type="button"
                  onClick={() => setWorkloadUnit('人時')}
                  className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                    workloadUnit === '人時'
                      ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  人時
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                1日の標準稼働時間
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Clock className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(Math.max(1, Math.min(24, Number(e.target.value) || 8)))}
                  className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-right font-mono"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-slate-500">
                  h/日
                </div>
              </div>
            </div>
          </div>

          {/* 曜日別定例会・会議時間設定 */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>曜日ごとの定例会・会議時間 (任意)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowMeetingConfig((prev) => !prev)}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer underline"
              >
                {showMeetingConfig ? '折りたたむ' : '曜日別時間を編集'}
              </button>
            </div>

            {showMeetingConfig ? (
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2">
                <p className="text-[11px] text-slate-500">
                  毎日の定例会時間を指定すると、実稼働可能時間が自動調整されます。
                </p>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS_SHORT.map((item) => {
                    const currentVal = weeklyMeetingHours[item.day] || 0;
                    return (
                      <div key={item.day} className="flex flex-col items-center bg-white p-1.5 rounded border border-slate-200">
                        <span className={`text-[11px] font-bold ${item.day === 0 ? 'text-rose-600' : item.day === 6 ? 'text-blue-600' : 'text-slate-700'}`}>
                          {item.label}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={hoursPerDay}
                          step={0.25}
                          value={currentVal}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(hoursPerDay, parseFloat(e.target.value) || 0));
                            setWeeklyMeetingHours((prev) => ({ ...prev, [item.day]: val }));
                          }}
                          className="w-full text-center text-[11px] border border-slate-200 rounded mt-1 font-mono font-bold py-0.5"
                        />
                        <span className="text-[9px] text-slate-400 mt-0.5">時間</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                <span>登録済み会議時間:</span>
                <span className="font-mono font-semibold text-slate-700">
                  {Object.values(weeklyMeetingHours).reduce<number>((a, b) => a + (Number(b) || 0), 0)} 時間/週
                </span>
              </div>
            )}
          </div>

          {/* アクションボタン */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs hover:shadow transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isEdit ? '変更を保存' : 'プロジェクトを作成'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
