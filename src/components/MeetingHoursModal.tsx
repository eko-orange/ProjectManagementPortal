import React, { useState } from 'react';
import { X, Clock, Calendar, Save, RotateCcw, Sparkles, Check, Info } from 'lucide-react';
import { ProjectSettings } from '../types';

interface MeetingHoursModalProps {
  settings?: ProjectSettings;
  weeklyMeetingHours?: { [dayOfWeek: number]: number };
  hoursPerDay?: number;
  projectName?: string;
  isOpen?: boolean;
  onSave: (weeklyMeetingHours: { [dayOfWeek: number]: number }) => void;
  onClose: () => void;
}

// 曜日定義: 0:日, 1:月, 2:火, 3:水, 4:木, 5:金, 6:土
// 日本の業務スケジュールに合わせて月曜〜日曜の順に表示
const DAYS_ORDER = [
  { dayIndex: 1, name: '月曜日', shortName: '月', isWeekend: false, badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { dayIndex: 2, name: '火曜日', shortName: '火', isWeekend: false, badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { dayIndex: 3, name: '水曜日', shortName: '水', isWeekend: false, badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { dayIndex: 4, name: '木曜日', shortName: '木', isWeekend: false, badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { dayIndex: 5, name: '金曜日', shortName: '金', isWeekend: false, badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { dayIndex: 6, name: '土曜日', shortName: '土', isWeekend: true, badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  { dayIndex: 0, name: '日曜日', shortName: '日', isWeekend: true, badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
];

const PRESET_HOURS = [0, 0.5, 1, 1.5, 2];

export const MeetingHoursModal: React.FC<MeetingHoursModalProps> = ({
  settings,
  weeklyMeetingHours: propWeeklyMeetingHours,
  hoursPerDay: propHoursPerDay,
  projectName,
  onSave,
  onClose,
}) => {
  const baseHours = propHoursPerDay ?? settings?.hoursPerDay ?? 8;

  // 初期値（0〜6の全曜日）
  const [meetingHours, setMeetingHours] = useState<{ [dayOfWeek: number]: number }>(() => {
    const initial: { [key: number]: number } = {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
    };
    const source = propWeeklyMeetingHours ?? settings?.weeklyMeetingHours;
    if (source) {
      Object.entries(source).forEach(([key, val]) => {
        initial[Number(key)] = Number(val) || 0;
      });
    }
    return initial;
  });

  const handleHourChange = (dayIndex: number, val: number) => {
    const clamped = Math.max(0, Math.min(baseHours, Number(val) || 0));
    setMeetingHours((prev) => ({
      ...prev,
      [dayIndex]: Math.round(clamped * 100) / 100,
    }));
  };

  // プリセット適用
  const applyPreset = (presetType: 'morning30' | 'regular60' | 'clear') => {
    const next = { ...meetingHours };
    if (presetType === 'morning30') {
      [1, 2, 3, 4, 5].forEach((d) => {
        next[d] = 0.5;
      });
    } else if (presetType === 'regular60') {
      [1, 2, 3, 4, 5].forEach((d) => {
        next[d] = 1.0;
      });
    } else if (presetType === 'clear') {
      [0, 1, 2, 3, 4, 5, 6].forEach((d) => {
        next[d] = 0;
      });
    }
    setMeetingHours(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(meetingHours);
    onClose();
  };

  // 1週間の合計会議時間
  const totalWeeklyMeetingHours = Object.values(meetingHours).reduce<number>((sum, h) => sum + (Number(h) || 0), 0);
  const weekdayCapacity = [1, 2, 3, 4, 5].reduce(
    (sum, d) => sum + Math.max(0, baseHours - (meetingHours[d] || 0)),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-hours-title"
      >
        {/* ヘッダー */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 id="meeting-hours-title" className="text-base font-bold text-white flex items-center gap-2">
                <span>定例会・会議時間設定</span>
                <span className="text-xs font-normal text-indigo-300 bg-indigo-900/60 px-2 py-0.5 rounded-full border border-indigo-700/50">
                  実稼働可能時間の調整
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                曜日ごとの定例会時間を登録し、WBSの日程自動計算に実稼働時間を正確に反映します
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* サマリーバー & プリセット */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500">標準所定:</span>{' '}
              <span className="font-bold font-mono text-slate-700">{baseHours}時間/日</span>
            </div>
            <div className="h-3 w-px bg-slate-200" />
            <div>
              <span className="text-slate-500">週の会議合計:</span>{' '}
              <span className="font-bold font-mono text-amber-600">{totalWeeklyMeetingHours}時間</span>
            </div>
            <div className="h-3 w-px bg-slate-200" />
            <div>
              <span className="text-slate-500">平日実作業枠:</span>{' '}
              <span className="font-bold font-mono text-emerald-600">{weekdayCapacity}時間/週</span>
            </div>
          </div>

          {/* クイックプリセット */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 text-[11px] font-medium mr-1">一括設定:</span>
            <button
              type="button"
              onClick={() => applyPreset('morning30')}
              className="px-2 py-1 rounded bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
            >
              朝会30分
            </button>
            <button
              type="button"
              onClick={() => applyPreset('regular60')}
              className="px-2 py-1 rounded bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
            >
              定例1時間
            </button>
            <button
              type="button"
              onClick={() => applyPreset('clear')}
              className="px-2 py-1 rounded bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-700 border border-slate-200 hover:border-rose-300 text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
            >
              クリア
            </button>
          </div>
        </div>

        {/* 曜日別設定フォーム本体 */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-3 flex-1">
          <div className="text-xs text-slate-500 flex items-start gap-1.5 mb-2 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
            <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              毎日定例会がある場合、実稼働時間が短縮されます。
              工数計算（人時）および新規機能追加時、<strong>「1日所定時間 − 会議時間」</strong>を実稼働可能時間として自動でスロット計算します。
            </div>
          </div>

          <div className="space-y-2.5">
            {DAYS_ORDER.map((item) => {
              const currentHours = meetingHours[item.dayIndex] || 0;
              const effectiveWorkingHours = Math.max(0, baseHours - currentHours);

              return (
                <div
                  key={item.dayIndex}
                  className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                    currentHours > 0
                      ? 'bg-indigo-50/30 border-indigo-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* 曜日名バッジ */}
                  <div className="flex items-center gap-2.5 min-w-[120px]">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-xs border shadow-2xs ${item.badgeClass}`}
                    >
                      {item.shortName}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span>{item.name}</span>
                        {item.isWeekend && (
                          <span className="text-[10px] text-slate-400 font-normal">休日</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        実作業: <span className="font-semibold text-emerald-700">{effectiveWorkingHours}h</span> / 日
                      </div>
                    </div>
                  </div>

                  {/* クイック選択チップ */}
                  <div className="flex items-center gap-1">
                    {PRESET_HOURS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => handleHourChange(item.dayIndex, h)}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                          currentHours === h
                            ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {h === 0 ? 'なし' : `${h}h`}
                      </button>
                    ))}
                  </div>

                  {/* 数値直接入力 */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={baseHours}
                      step={0.25}
                      value={currentHours}
                      onChange={(e) => handleHourChange(item.dayIndex, parseFloat(e.target.value) || 0)}
                      className="w-18 px-2 py-1 text-xs text-right border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 font-mono font-semibold"
                    />
                    <span className="text-xs text-slate-500">時間</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* フッターアクション */}
          <div className="pt-4 mt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>定例会・会議設定を保存</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
