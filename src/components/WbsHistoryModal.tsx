import React, { useState } from 'react';
import { Feature, Project, ProjectSettings, WbsSnapshot } from '../types';
import {
  X,
  History,
  Save,
  RotateCcw,
  Trash2,
  Calendar,
  Layers,
  Clock,
  Eye,
  CheckCircle,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface WbsHistoryModalProps {
  currentProject: Project;
  currentFeatures: Feature[];
  currentSettings: ProjectSettings;
  snapshots: WbsSnapshot[];
  onSaveSnapshot: (versionName: string, notes: string) => Promise<boolean>;
  onRestoreSnapshot: (snapshotId: string) => Promise<boolean>;
  onDeleteSnapshot: (snapshotId: string) => Promise<boolean>;
  onClose: () => void;
}

export const WbsHistoryModal: React.FC<WbsHistoryModalProps> = ({
  currentProject,
  currentFeatures,
  currentSettings,
  snapshots,
  onSaveSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onClose,
}) => {
  const [versionName, setVersionName] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [previewSnapshotId, setPreviewSnapshotId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 現行WBSのサマリー計算
  const currentTotalProcesses = currentFeatures.reduce((acc, f) => acc + (f.processes?.length || 0), 0);
  const currentTotalWorkload = currentFeatures.reduce(
    (acc, f) => acc + (f.processes || []).reduce((pAcc, p) => pAcc + (Number(p.plannedWorkload) || 0), 0),
    0
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionName.trim()) return;

    setIsSaving(true);
    const ok = await onSaveSnapshot(versionName.trim(), notes.trim());
    setIsSaving(false);

    if (ok) {
      setVersionName('');
      setNotes('');
      setSuccessMessage('現在のWBS状態を新しい履歴バージョンとして保存しました');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleRestore = async (snapshotId: string) => {
    const ok = await onRestoreSnapshot(snapshotId);
    if (ok) {
      setConfirmRestoreId(null);
      setSuccessMessage('WBSを指定されたバージョンの状態に復元しました');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const previewSnapshot = snapshots.find((s) => s.id === previewSnapshotId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden">
        {/* モーダルヘッダー */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">WBS履歴管理・スナップショット保存</h2>
              <p className="text-xs text-slate-500">
                リスケジュール発生前後の計画状態をバージョン保存し、いつでも比較・過去状態への復元（ロールバック）ができます
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

        {/* 成功通知バナー */}
        {successMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center gap-2 text-emerald-800 text-xs font-semibold animate-fadeIn">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* メインコンテンツ */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左：新規バージョン保存フォーム & 現況 */}
          <div className="w-96 border-r border-slate-200 p-5 overflow-y-auto bg-slate-50/50 flex flex-col gap-5">
            {/* 現行WBSのサマリー */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                現在編集中のWBSステータス
              </span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">機能数</span>
                  <span className="text-sm font-bold text-slate-800 font-mono">
                    {currentFeatures.length}
                  </span>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">工程数</span>
                  <span className="text-sm font-bold text-slate-800 font-mono">
                    {currentTotalProcesses}
                  </span>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">総予定工数</span>
                  <span className="text-sm font-bold text-indigo-700 font-mono">
                    {currentTotalWorkload} {currentSettings.workloadUnit}
                  </span>
                </div>
              </div>
            </div>

            {/* 新規スナップショット保存フォーム */}
            <div className="p-4 bg-white border border-amber-200/80 rounded-xl shadow-xs">
              <div className="flex items-center gap-1.5 mb-3">
                <Save className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-800">現行WBSをバージョン保存</h3>
              </div>
              <form onSubmit={handleSave} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    バージョン名・タイトル *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="例: 第2回リスケ反映版 (佐藤氏休暇調整)"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    保存理由・リスケ変更メモ
                  </label>
                  <textarea
                    rows={3}
                    placeholder="例: フロントエンド要件追加に伴いテスト工程を3日延伸。ステークホルダー承認済み。"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving || !versionName.trim()}
                  className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? '保存中...' : '履歴バージョンとして保存'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* 右：保存済みバージョン履歴一覧 & プレビュー */}
          <div className="flex-1 flex flex-col overflow-y-auto p-5 bg-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">保存済みWBSバージョン一覧</h3>
                <p className="text-xs text-slate-500">
                  過去のバージョンを確認したり、「復元」をクリックして当時の計画へ戻すことができます
                </p>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                保存履歴: {snapshots.length} 件
              </span>
            </div>

            {snapshots.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs p-12 border-2 border-dashed border-slate-200 rounded-xl">
                <History className="w-10 h-10 mb-2 text-slate-300" />
                <span className="font-semibold text-slate-600">保存された履歴バージョンはありません</span>
                <p className="text-slate-400 text-[11px] mt-1 text-center max-w-sm">
                  左のフォームから現在の計画状態に名前をつけて保存すると、いつでもこの時点のWBSへ復元できます。
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {snapshots.map((snap) => {
                  const isPreview = previewSnapshotId === snap.id;
                  const isConfirming = confirmRestoreId === snap.id;

                  return (
                    <div
                      key={snap.id}
                      className={`border rounded-xl transition-all ${
                        isPreview
                          ? 'border-amber-400 bg-amber-50/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* バージョンカードヘッダー */}
                      <div className="p-4 flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 font-mono">
                              {snap.versionName}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                              <Clock className="w-2.5 h-2.5" />
                              {snap.createdDate || snap.createdAt.slice(0, 16).replace('T', ' ')}
                            </span>
                          </div>

                          {snap.notes && (
                            <p className="text-xs text-slate-600 pl-0.5">{snap.notes}</p>
                          )}

                          <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3 text-slate-400" />
                              機能: <strong className="text-slate-700">{snap.featuresCount || snap.features.length}</strong> 件
                            </span>
                            <span>•</span>
                            <span>
                              工程: <strong className="text-slate-700">{snap.totalProcessesCount}</strong> 件
                            </span>
                            <span>•</span>
                            <span>
                              総工数: <strong className="text-indigo-700">{snap.totalPlannedWorkload}</strong>
                            </span>
                          </div>
                        </div>

                        {/* アクションボタン群 */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewSnapshotId(isPreview ? null : snap.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                              isPreview
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-slate-50 text-slate-600 hover:text-slate-900 border-slate-200'
                            }`}
                          >
                            <Eye className="w-3 h-3" />
                            <span>{isPreview ? 'プレビュー閉じる' : '内容詳細'}</span>
                          </button>

                          {!isConfirming ? (
                            <button
                              type="button"
                              onClick={() => setConfirmRestoreId(snap.id)}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>この版へ復元</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5 p-1 bg-rose-50 border border-rose-200 rounded-lg">
                              <span className="text-[11px] font-bold text-rose-700 px-1">
                                本当に復元しますか？
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRestore(snap.id)}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold cursor-pointer"
                              >
                                復元実行
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRestoreId(null)}
                                className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[11px] cursor-pointer"
                              >
                                戻る
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => onDeleteSnapshot(snap.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="履歴を削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* プレビュー展開アコーディオン */}
                      {isPreview && (
                        <div className="border-t border-slate-200 p-4 bg-slate-50/70 rounded-b-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700">
                              このバージョンに含まれる機能と工程 ({snap.features.length} 機能)
                            </span>
                          </div>

                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {snap.features.map((feat) => (
                              <div
                                key={feat.id}
                                className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs"
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="font-bold text-slate-800">{feat.name}</span>
                                  <span className="text-[11px] font-mono text-slate-500">
                                    {feat.category || 'カテゴリ未設定'}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                  {feat.processes.map((proc) => (
                                    <div
                                      key={proc.id}
                                      className="p-1.5 bg-slate-50 rounded border border-slate-100 text-[11px]"
                                    >
                                      <div className="font-semibold text-slate-700 flex items-center justify-between">
                                        <span>{proc.processType}</span>
                                        <span className="text-indigo-600 font-mono">
                                          {proc.plannedWorkload}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-slate-500 flex items-center justify-between mt-0.5">
                                        <span className="truncate">{proc.assignee || '未定'}</span>
                                        <span className="font-mono">{proc.startDate.slice(5)}〜{proc.endDate.slice(5)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            プロジェクト: <strong className="text-slate-800">{currentProject.name}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
