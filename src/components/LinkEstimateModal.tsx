import React, { useState } from 'react';
import { X, Sparkles, AlertTriangle, Link2, Plus, Check } from 'lucide-react';
import { Project, Estimate } from '../types';

interface LinkEstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  estimates: Estimate[];
  onLinkToExistingEstimate: (projectId: string, estimateId: string) => void;
  onCreateEstimateFromProject: (project: Project) => void;
  onUnlinkEstimate: (projectId: string) => void;
}

export const LinkEstimateModal: React.FC<LinkEstimateModalProps> = ({
  isOpen,
  onClose,
  project,
  estimates,
  onLinkToExistingEstimate,
  onCreateEstimateFromProject,
  onUnlinkEstimate,
}) => {
  const [selectedEstimateId, setSelectedEstimateId] = useState<string>('');
  const [actionType, setActionType] = useState<'existing' | 'new'>('existing');

  if (!isOpen || !project) return null;

  const currentLinkedEstimate = estimates.find((e) => e.id === project.estimateId);

  const handleApply = () => {
    if (actionType === 'existing' && selectedEstimateId) {
      onLinkToExistingEstimate(project.id, selectedEstimateId);
      onClose();
    } else if (actionType === 'new') {
      onCreateEstimateFromProject(project);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">見積管理との連携設定</h3>
              <p className="text-xs text-slate-300">プロジェクト「{project.name}」</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 本文 */}
        <div className="p-6 space-y-4 text-xs text-slate-700">
          {/* 現在のステータス */}
          {currentLinkedEstimate ? (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-950 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>現在連携中: {currentLinkedEstimate.estimateNumber}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onUnlinkEstimate(project.id);
                    onClose();
                  }}
                  className="text-[11px] text-rose-600 hover:underline cursor-pointer font-semibold"
                >
                  連携を解除する
                </button>
              </div>
              <p className="text-indigo-800 text-[11px]">
                見積件名: {currentLinkedEstimate.title} (顧客: {currentLinkedEstimate.clientName})
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">このプロジェクトは見積管理と連携されていません</strong>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  単体登録されたプロジェクトです。既存の概算見積と紐付けるか、このプロジェクトの内容をベースに見積管理へ新規登録できます。
                </p>
              </div>
            </div>
          )}

          {/* 連携オプション選択 */}
          <div className="space-y-3 pt-2">
            <label className="font-bold text-slate-800 block">連携アクションの選択:</label>

            <div className="space-y-2.5">
              {/* オプション1: 既存見積と紐付け */}
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  actionType === 'existing'
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="linkAction"
                  value="existing"
                  checked={actionType === 'existing'}
                  onChange={() => setActionType('existing')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1 space-y-2">
                  <div>
                    <span className="font-bold text-slate-900 text-xs">既存の概算見積を選択して紐付ける</span>
                    <p className="text-[11px] text-slate-500">
                      見積管理に登録済みの見積管理番号をこのプロジェクトに関連付けます
                    </p>
                  </div>
                  {actionType === 'existing' && (
                    <select
                      value={selectedEstimateId}
                      onChange={(e) => setSelectedEstimateId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    >
                      <option value="">-- 見積を選択してください --</option>
                      {estimates.map((est) => (
                        <option key={est.id} value={est.id}>
                          {est.estimateNumber} - {est.title} (顧客: {est.clientName} / {est.features.length}機能)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </label>

              {/* オプション2: プロジェクトから新規見積を作成 */}
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  actionType === 'new'
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="linkAction"
                  value="new"
                  checked={actionType === 'new'}
                  onChange={() => setActionType('new')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>このプロジェクト情報をもとに見積管理に新規登録</span>
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    プロジェクト名「{project.name}」および現在の{project.features.length}機能（Step数・工数）を元に見積管理番号を発行し、見積管理へ新規登録します
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={actionType === 'existing' && !selectedEstimateId}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>設定を適用する</span>
          </button>
        </div>
      </div>
    </div>
  );
};
