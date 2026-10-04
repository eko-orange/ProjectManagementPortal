import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  ArrowRight,
  ExternalLink,
  Edit3,
  Copy,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronRight,
  Building2,
  User,
  Calendar,
  AlertTriangle,
  FolderKanban,
  FileSpreadsheet,
  Home,
  Check,
  X,
} from 'lucide-react';
import { Estimate, Member, Project } from '../types';
import { exportEstimatesToCsv, parseEstimatesCsv, downloadEstimatesTemplateCsv } from '../utils/csvHelper';

interface EstimateManagerProps {
  estimates: Estimate[];
  projects: Project[];
  members: Member[];
  onOpenCreateModal: () => void;
  onOpenEditModal: (estimate: Estimate) => void;
  onDeleteEstimate: (id: string) => void;
  onDuplicateEstimate: (estimate: Estimate) => void;
  onLinkEstimateToProject: (estimateId: string, targetProjectId?: string) => void;
  onNavigateToWbs: (projectId?: string) => void;
  onNavigateToMainMenu: () => void;
  onNavigateToMembers: () => void;
  onImportEstimates: (importedEstimates: Estimate[]) => void;
}

export const EstimateManager: React.FC<EstimateManagerProps> = ({
  estimates,
  projects,
  members,
  onOpenCreateModal,
  onOpenEditModal,
  onDeleteEstimate,
  onDuplicateEstimate,
  onLinkEstimateToProject,
  onNavigateToWbs,
  onNavigateToMainMenu,
  onNavigateToMembers,
  onImportEstimates,
}) => {
  // フィルター・検索状態
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEstimateIds, setExpandedEstimateIds] = useState<Record<string, boolean>>({
    [estimates[0]?.id || '']: true,
  });

  // 削除確認
  const [estimateToDelete, setEstimateToDelete] = useState<Estimate | null>(null);

  // 連携確認モーダル
  const [estimateToLink, setEstimateToLink] = useState<Estimate | null>(null);
  const [linkMode, setLinkMode] = useState<'new' | 'existing'>('new');
  const [targetProjectId, setTargetProjectId] = useState<string>('');

  // CSVインポート用input ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 展開トグル
  const handleToggleExpand = (id: string) => {
    setExpandedEstimateIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // 全体集計KPI
  const stats = useMemo(() => {
    const totalCount = estimates.length;
    const linkedCount = estimates.filter((e) => e.status === 'linked' || e.linkedProjectId).length;
    const approvedCount = estimates.filter((e) => e.status === 'approved' && !e.linkedProjectId).length;
    const submittedCount = estimates.filter((e) => e.status === 'submitted').length;
    const draftCount = estimates.filter((e) => e.status === 'draft').length;

    const totalSteps = estimates.reduce(
      (acc, e) => acc + e.features.reduce((fAcc, f) => fAcc + (f.stepCount || 0), 0),
      0
    );
    const totalWorkload = Math.round(
      estimates.reduce(
        (acc, e) => acc + e.features.reduce((fAcc, f) => fAcc + f.estimatedWorkload, 0),
        0
      ) * 10
    ) / 10;

    const totalAmount = estimates.reduce((acc, e) => {
      const subtotal = e.features.reduce(
        (fAcc, f) => fAcc + (f.estimatedAmount || f.estimatedWorkload * e.unitPrice),
        0
      );
      return acc + Math.round(subtotal * (1 + (e.taxRate !== undefined ? e.taxRate : 0.1)));
    }, 0);

    const avgProductivity = totalWorkload > 0 && totalSteps > 0
      ? Math.round((totalSteps / totalWorkload) * 10) / 10
      : undefined;

    return {
      totalCount,
      linkedCount,
      approvedCount,
      submittedCount,
      draftCount,
      totalSteps,
      totalWorkload,
      totalAmount,
      avgProductivity,
    };
  }, [estimates]);

  // フィルタリング後の見積一覧
  const filteredEstimates = useMemo(() => {
    return estimates.filter((e) => {
      // ステータスフィルター
      if (statusFilter === 'linked' && e.status !== 'linked' && !e.linkedProjectId) return false;
      if (statusFilter === 'unlinked' && (e.status === 'linked' || e.linkedProjectId)) return false;
      if (statusFilter === 'approved' && e.status !== 'approved') return false;
      if (statusFilter === 'submitted' && e.status !== 'submitted') return false;
      if (statusFilter === 'draft' && e.status !== 'draft') return false;
      if (statusFilter === 'rejected' && e.status !== 'rejected') return false;

      // 検索フィルター
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = e.estimateNumber.toLowerCase().includes(q);
        const matchTitle = e.title.toLowerCase().includes(q);
        const matchClient = e.clientName.toLowerCase().includes(q);
        const matchManager = e.manager.toLowerCase().includes(q);
        const matchFeatures = e.features.some(
          (f) => f.name.toLowerCase().includes(q) || (f.category && f.category.toLowerCase().includes(q))
        );
        return matchNum || matchTitle || matchClient || matchManager || matchFeatures;
      }
      return true;
    });
  }, [estimates, statusFilter, searchQuery]);

  // CSVファイル選択ハンドラー
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        const { estimates: parsed, errors } = parseEstimatesCsv(text);
        if (errors.length > 0) {
          alert(`CSVの解析中にエラーがありました:\n${errors.join('\n')}`);
        }
        if (parsed.length > 0) {
          onImportEstimates(parsed);
        }
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  // 連携実行
  const handleConfirmLink = () => {
    if (!estimateToLink) return;
    onLinkEstimateToProject(
      estimateToLink.id,
      linkMode === 'existing' && targetProjectId ? targetProjectId : undefined
    );
    setEstimateToLink(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
      {/* 画面トップバー（メインメニュー戻り ＆ ナビゲーション） */}
      <div className="bg-slate-900 border-b border-slate-800 text-white px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateToMainMenu}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            title="メインメニューに戻る"
          >
            <Home className="w-3.5 h-3.5 text-indigo-400" />
            <span>メインメニュー</span>
          </button>
          <div className="h-4 w-px bg-slate-700 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>概算見積管理 (見積登録・連携)</span>
                <span className="text-[11px] px-2 py-0.2 rounded-full bg-indigo-900/80 text-indigo-200 font-mono font-medium">
                  {estimates.length}件
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* 相互画面ナビゲーション */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateToWbs()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
            title="プロジェクト進捗管理画面を開く"
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span>プロジェクト進捗管理へ</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onNavigateToMembers}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            title="担当者マスタ管理を開く"
          >
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">担当者マスタ</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* KPI サマリーカード群 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* 総見積件数 & 金額 */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>総見積件数 / 総金額</span>
              <Calculator className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 font-mono">{stats.totalCount}</span>
              <span className="text-xs text-slate-500">件</span>
            </div>
            <div className="text-xs font-bold text-indigo-700 font-mono">
              ¥{stats.totalAmount.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">(税込概算)</span>
            </div>
          </div>

          {/* 受注・連携状況 */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>進捗管理連携済 / 受注承認</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700 font-mono">{stats.linkedCount}</span>
              <span className="text-xs text-slate-500">件連携済</span>
              {stats.approvedCount > 0 && (
                <span className="text-xs font-bold text-amber-600 ml-1">
                  ({stats.approvedCount}件未連携)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              受注内諾案件は進捗管理へワンクリック連携可能
            </p>
          </div>

          {/* 概算総規模 (Step数) */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>総Step数 (開発規模)</span>
              <Layers className="w-4 h-4 text-purple-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-purple-700 font-mono">
                {stats.totalSteps > 0 ? stats.totalSteps.toLocaleString() : '0'}
              </span>
              <span className="text-xs text-slate-500">Step</span>
            </div>
            <p className="text-[11px] text-slate-500">
              全{stats.totalCount}件の見積登録機能積算規模
            </p>
          </div>

          {/* 概算工数 & 想定生産性 */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>総工数 / 平均想定生産性</span>
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 font-mono">
                {stats.totalWorkload.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">人日</span>
            </div>
            <div className="text-xs text-slate-600 font-mono">
              {stats.avgProductivity ? (
                <span className="font-bold text-emerald-700">
                  {stats.avgProductivity} <span className="text-[10px] text-slate-500 font-normal">Step/人日</span>
                </span>
              ) : (
                <span className="text-slate-400">生産性算出対象なし</span>
              )}
            </div>
          </div>
        </div>

        {/* コントロールバー（検索・ステータスフィルター・CSVアクション・新規作成） */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* 検索入力 */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="見積管理番号、件名、顧客名、機能名で検索..."
                className="w-full pl-9 pr-3 py-1.5 text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* アクションボタン群 */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* テンプレートDL */}
              <button
                type="button"
                onClick={downloadEstimatesTemplateCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors cursor-pointer"
                title="CSV取り込み用テンプレートをダウンロード"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">雛形DL</span>
              </button>

              {/* CSVエクスポート */}
              <button
                type="button"
                onClick={() => exportEstimatesToCsv(estimates)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                title="全見積データをCSV出力"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>CSV出力</span>
              </button>

              {/* CSV取り込み */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                title="CSVファイルから見積を取り込み"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>CSV取込</span>
              </button>

              {/* 新規見積登録 */}
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>新規見積登録</span>
              </button>
            </div>
          </div>

          {/* ステータスフィルタータブ */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-t border-slate-100 pt-2.5">
            <span className="text-slate-400 text-[11px] font-semibold flex items-center gap-1 mr-1 shrink-0">
              <Filter className="w-3 h-3" />
              絞り込み:
            </span>
            {[
              { id: 'all', label: `すべて (${estimates.length})` },
              { id: 'linked', label: `🚀 連携済 (${stats.linkedCount})` },
              { id: 'unlinked', label: `⚠️ 未連携 (${estimates.length - stats.linkedCount})` },
              { id: 'approved', label: `🎉 受注・内諾 (${stats.approvedCount})` },
              { id: 'submitted', label: `📤 提出済 (${stats.submittedCount})` },
              { id: 'draft', label: `📝 下書き (${stats.draftCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 見積一覧カードリスト */}
        <div className="space-y-4">
          {filteredEstimates.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Calculator className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">該当する見積データが見つかりません</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'all'
                  ? '検索条件やステータスフィルターを変更して再度ご確認ください。'
                  : '「新規見積登録」から最初の概算見積を作成してみましょう。'}
              </p>
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>新規見積を作成する</span>
              </button>
            </div>
          ) : (
            filteredEstimates.map((estimate) => {
              const isExpanded = expandedEstimateIds[estimate.id] || false;
              const totalEstSteps = estimate.features.reduce((acc, f) => acc + (f.stepCount || 0), 0);
              const totalEstWorkload = Math.round(
                estimate.features.reduce((acc, f) => acc + f.estimatedWorkload, 0) * 10
              ) / 10;
              const subtotal = estimate.features.reduce(
                (acc, f) => acc + (f.estimatedAmount || f.estimatedWorkload * estimate.unitPrice),
                0
              );
              const totalAmountWithTax = Math.round(
                subtotal * (1 + (estimate.taxRate !== undefined ? estimate.taxRate : 0.1))
              );
              const prod = totalEstWorkload > 0 && totalEstSteps > 0
                ? Math.round((totalEstSteps / totalEstWorkload) * 10) / 10
                : undefined;

              const isLinked = Boolean(estimate.status === 'linked' || estimate.linkedProjectId);

              return (
                <div
                  key={estimate.id}
                  className={`bg-white rounded-xl border transition-all duration-150 overflow-hidden shadow-2xs ${
                    isLinked ? 'border-indigo-200' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* カードヘッダー */}
                  <div className="p-4 sm:p-5 flex flex-wrap items-start justify-between gap-3 bg-gradient-to-r from-white via-white to-slate-50/70 border-b border-slate-100">
                    <div className="flex items-start gap-3 flex-1 min-w-[280px]">
                      {/* 展開トグルボタン */}
                      <button
                        type="button"
                        onClick={() => handleToggleExpand(estimate.id)}
                        className="mt-0.5 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                        title={isExpanded ? '機能一覧を閉じる' : '機能一覧を表示'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>

                      <div className="space-y-1.5 flex-1">
                        {/* バッジ群 */}
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          {/* 見積管理番号 */}
                          <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white text-[11px] tracking-wide">
                            {estimate.estimateNumber}
                          </span>

                          {/* 見積ステータスバッジ */}
                          {estimate.status === 'linked' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-semibold text-[11px]">
                              <Sparkles className="w-3 h-3 text-purple-600" />
                              <span>進捗連携済</span>
                            </span>
                          )}
                          {estimate.status === 'approved' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>受注・承認済</span>
                            </span>
                          )}
                          {estimate.status === 'submitted' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-[11px]">
                              <Clock className="w-3 h-3 text-blue-600" />
                              <span>提出済</span>
                            </span>
                          )}
                          {estimate.status === 'draft' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[11px]">
                              <span>下書き</span>
                            </span>
                          )}
                          {estimate.status === 'rejected' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-[11px]">
                              <span>失注</span>
                            </span>
                          )}

                          {/* プロジェクト連携ステータス表示 */}
                          {isLinked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-medium">
                              <FolderKanban className="w-3 h-3 text-indigo-600" />
                              <span>連携: {estimate.linkedProjectName || 'プロジェクト'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              <span>進捗管理へ未連携</span>
                            </span>
                          )}
                        </div>

                        {/* 見積件名（プロジェクト名） */}
                        <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                          <span>{estimate.title}</span>
                        </h2>

                        {/* 顧客名 ＆ 担当者 ＆ 日程 */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <strong className="text-slate-700">{estimate.clientName}</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>担当: {estimate.manager}</span>
                          </span>
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>作成: {estimate.issueDate}</span>
                            <span className="text-slate-400">/ 有効期限: {estimate.validUntil}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 金額・工数サマリー ＆ アクション */}
                    <div className="flex flex-col sm:items-end gap-2 text-right">
                      <div>
                        <div className="text-lg font-bold text-slate-900 font-mono">
                          ¥{totalAmountWithTax.toLocaleString()}
                          <span className="text-[10px] text-slate-500 font-normal ml-1">(税込)</span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center justify-end gap-2 font-mono">
                          <span>概算工数: <strong>{totalEstWorkload}</strong> {estimate.workloadUnit}</span>
                          <span>|</span>
                          <span className="text-indigo-700 font-semibold">
                            {totalEstSteps > 0 ? `${totalEstSteps.toLocaleString()} Step` : '-'}
                          </span>
                          {prod && (
                            <span className="text-emerald-700 font-semibold">
                              ({prod} S/{estimate.workloadUnit})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* アクションボタンバー */}
                      <div className="flex items-center gap-1.5 flex-wrap justify-end pt-1">
                        {/* 連携ボタン */}
                        {isLinked ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToWbs(estimate.linkedProjectId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-colors cursor-pointer"
                            title="プロジェクト進捗管理画面のWBSを開く"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>WBS進捗を開く</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEstimateToLink(estimate)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                            title="この見積のプロジェクトと機能群を進捗管理に自動連携登録します"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>進捗管理へ連携</span>
                          </button>
                        )}

                        {/* 編集 */}
                        <button
                          type="button"
                          onClick={() => onOpenEditModal(estimate)}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                          title="見積内容を編集"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* 複製 */}
                        <button
                          type="button"
                          onClick={() => onDuplicateEstimate(estimate)}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                          title="この見積をベースに複製作成"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {/* 削除 */}
                        <button
                          type="button"
                          onClick={() => setEstimateToDelete(estimate)}
                          className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="見積を削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 展開時：登録機能一覧テーブル */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span className="font-bold flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-indigo-600" />
                          <span>登録機能一覧 ({estimate.features.length}機能)</span>
                        </span>
                        <span className="text-slate-500 font-mono text-[11px]">
                          単価設定: ¥{estimate.unitPrice.toLocaleString()} / {estimate.workloadUnit}
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                            <tr>
                              <th className="py-2 px-3 w-8 text-center">#</th>
                              <th className="py-2 px-3">機能名</th>
                              <th className="py-2 px-2 w-28">カテゴリ</th>
                              <th className="py-2 px-2 w-24 text-right">Step数</th>
                              <th className="py-2 px-2 w-24 text-right">概算工数</th>
                              <th className="py-2 px-2 w-28 text-right">想定生産性</th>
                              <th className="py-2 px-3 w-28 text-right">概算金額</th>
                              <th className="py-2 px-3">概要・前提</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {estimate.features.map((f, idx) => {
                              const fProd = f.estimatedWorkload > 0 && f.stepCount && f.stepCount > 0
                                ? Math.round((f.stepCount / f.estimatedWorkload) * 10) / 10
                                : null;
                              return (
                                <tr key={f.id || idx} className="hover:bg-slate-50/70">
                                  <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2 px-3 font-semibold text-slate-800">
                                    {f.name}
                                  </td>
                                  <td className="py-2 px-2 text-slate-600">
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600">
                                      {f.category || '一般機能'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono font-bold text-indigo-700">
                                    {f.stepCount !== undefined ? f.stepCount.toLocaleString() : '-'}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono font-semibold text-slate-800">
                                    {f.estimatedWorkload} {estimate.workloadUnit}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono text-[11px]">
                                    {fProd ? (
                                      <span className="font-bold text-emerald-700">
                                        {fProd} <span className="text-[10px] text-slate-400 font-normal">S/{estimate.workloadUnit}</span>
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                    ¥{(f.estimatedAmount || f.estimatedWorkload * estimate.unitPrice).toLocaleString()}
                                  </td>
                                  <td className="py-2 px-3 text-slate-500 text-[11px] truncate max-w-[200px]" title={f.description || ''}>
                                    {f.description || '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {estimate.notes && (
                        <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-2.5 text-xs text-amber-900">
                          <strong>特記事項・備考:</strong> {estimate.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 連携実行モーダル */}
      {estimateToLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <h3 className="text-base font-bold">プロジェクト進捗管理へ連携</h3>
              </div>
              <button
                type="button"
                onClick={() => setEstimateToLink(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl space-y-1">
                <div className="font-bold text-indigo-950 text-sm flex items-center gap-1.5">
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-indigo-200 text-indigo-900">
                    {estimateToLink.estimateNumber}
                  </span>
                  <span>{estimateToLink.title}</span>
                </div>
                <p className="text-indigo-800 text-[11px]">
                  登録された{estimateToLink.features.length}機能（合計Step数:{' '}
                  {estimateToLink.features.reduce((a, b) => a + (b.stepCount || 0), 0).toLocaleString()} Step / 工数:{' '}
                  {estimateToLink.features.reduce((a, b) => a + b.estimatedWorkload, 0)} {estimateToLink.workloadUnit}）を進捗管理へ反映します。
                </p>
              </div>

              <div className="space-y-2">
                <label className="block font-semibold text-slate-800">連携方法の選択:</label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:border-indigo-300 cursor-pointer transition-colors bg-white">
                    <input
                      type="radio"
                      name="linkMode"
                      value="new"
                      checked={linkMode === 'new'}
                      onChange={() => setLinkMode('new')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900">新規プロジェクトとして登録</span>
                      <p className="text-[11px] text-slate-500">
                        見積件名「{estimateToLink.title}」で新規プロジェクトを作成し、標準工程パターンで自動展開します
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:border-indigo-300 cursor-pointer transition-colors bg-white">
                    <input
                      type="radio"
                      name="linkMode"
                      value="existing"
                      checked={linkMode === 'existing'}
                      onChange={() => setLinkMode('existing')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <span className="font-bold text-slate-900">既存プロジェクトに紐付け</span>
                      <p className="text-[11px] text-slate-500 mb-1.5">
                        既に登録されているプロジェクトに見積管理番号を連携紐付けします
                      </p>
                      {linkMode === 'existing' && (
                        <select
                          value={targetProjectId}
                          onChange={(e) => setTargetProjectId(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded focus:bg-white"
                        >
                          <option value="">-- 対象プロジェクトを選択 --</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.estimateNumber ? `(現在連携: ${p.estimateNumber})` : '(未連携)'}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEstimateToLink(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmLink}
                disabled={linkMode === 'existing' && !targetProjectId}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>連携を実行する</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {estimateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold text-slate-900">見積データの削除確認</h3>
              </div>
              <button
                type="button"
                onClick={() => setEstimateToDelete(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3 text-xs text-slate-700">
              <p>
                以下の見積データを削除します。この操作は取り消せません。
              </p>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg font-mono">
                <div className="font-bold text-slate-900">{estimateToDelete.estimateNumber}</div>
                <div className="text-slate-700 text-xs mt-0.5">{estimateToDelete.title}</div>
                <div className="text-slate-500 text-[11px] mt-0.5">顧客: {estimateToDelete.clientName}</div>
              </div>
              {estimateToDelete.linkedProjectName && (
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-800 text-[11px]">
                  ⚠️ 連携先プロジェクト「{estimateToDelete.linkedProjectName}」との紐付けも解除されます。
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEstimateToDelete(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteEstimate(estimateToDelete.id);
                  setEstimateToDelete(null);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
