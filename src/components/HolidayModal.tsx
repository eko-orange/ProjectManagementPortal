import React, { useState } from 'react';
import { Holiday } from '../types';
import { X, Plus, Trash2, RotateCcw, Calendar, AlertCircle, Check, Upload } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';

interface HolidayModalProps {
  holidays: Holiday[];
  onSaveHolidays: (holidays: Holiday[]) => void;
  onResetHolidays: () => void;
  onOpenCsvImport?: () => void;
  onClose: () => void;
}

export const HolidayModal: React.FC<HolidayModalProps> = ({
  holidays,
  onSaveHolidays,
  onResetHolidays,
  onOpenCsvImport,
  onClose,
}) => {
  const [newDate, setNewDate] = useState(formatDate(new Date()));
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<Holiday['type']>('company');
  const [searchQuery, setSearchQuery] = useState('');

  // 休日ソート
  const sortedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  const filteredHolidays = sortedHolidays.filter(
    (h) => h.name.includes(searchQuery) || h.date.includes(searchQuery)
  );

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newName.trim()) return;

    // 既存の日付チェック
    const exists = holidays.some((h) => h.date === newDate);
    if (exists) {
      alert(`${newDate} はすでに休日として登録されています。`);
      return;
    }

    const newItem: Holiday = {
      id: `h-custom-${Date.now()}`,
      date: newDate,
      name: newName.trim(),
      type: newType,
    };

    onSaveHolidays([...holidays, newItem]);
    setNewName('');
  };

  const handleDelete = (id: string) => {
    onSaveHolidays(holidays.filter((h) => h.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* モーダルヘッダー */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">休日カレンダー管理</h2>
              <p className="text-xs text-slate-500">
                稼働日・予定進捗率の計算から除外する休日（土日祝日・会社休日）
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenCsvImport && (
              <button
                type="button"
                onClick={onOpenCsvImport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                title="休日管理カレンダーのCSV取り込み"
              >
                <Upload className="w-3.5 h-3.5 text-rose-600" />
                <span>CSV取り込み</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 登録フォーム */}
        <div className="p-5 border-b border-slate-200 bg-white">
          <form onSubmit={handleAddHoliday} className="flex flex-wrap items-end gap-3">
            <div className="w-36">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                日付
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-xs text-slate-800 font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                休日名・理由
              </label>
              <input
                type="text"
                placeholder="例: 夏季特別休暇, 創立記念日"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="w-36">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                種別
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as Holiday['type'])}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
              >
                <option value="company">会社指定休日</option>
                <option value="national">国民の祝日</option>
                <option value="weekend">特別休業日</option>
              </select>
            </div>

            <button
              type="submit"
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded-md transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>休日を追加</span>
            </button>
          </form>
        </div>

        {/* 休日リストヘッダー & 検索 */}
        <div className="px-5 py-2.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">登録済み休日一覧</span>
            <span className="text-slate-400 font-mono">({filteredHolidays.length}件)</span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="日付や名前で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-44"
            />
            <button
              type="button"
              onClick={onResetHolidays}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-600 cursor-pointer"
              title="初期の日本標準祝日・会社休日に戻す"
            >
              <RotateCcw className="w-3 h-3" />
              <span>標準祝日に戻す</span>
            </button>
          </div>
        </div>

        {/* 休日リストスクロールエリア */}
        <div className="flex-1 overflow-y-auto p-5 space-y-1.5 divide-y divide-slate-100">
          {filteredHolidays.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              該当する休日は見つかりませんでした。
            </div>
          ) : (
            filteredHolidays.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-slate-50 text-xs transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {h.date}
                  </span>
                  <span className="font-medium text-slate-900">{h.name}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      h.type === 'company'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {h.type === 'company' ? '会社指定休日' : '祝日'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(h.id)}
                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="この休日を削除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>※ 土曜日・日曜日は休日カレンダーに関わらず自動的に非稼働日として計算されます。</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-medium cursor-pointer transition-colors"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
};
