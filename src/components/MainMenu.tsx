import React, { useMemo } from 'react';
import {
  FolderKanban,
  Calculator,
  Users,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Download,
  Settings2,
  Workflow,
  Plus,
  RotateCcw,
  Trash2,
  FileSpreadsheet,
  Building2,
  UserCheck,
} from 'lucide-react';
import { Project, Estimate, Member, Holiday, ProcessStructurePattern } from '../types';

interface MainMenuProps {
  projects: Project[];
  estimates: Estimate[];
  members: Member[];
  holidays: Holiday[];
  processPatterns: ProcessStructurePattern[];
  onNavigateToWbs: (projectId?: string) => void;
  onNavigateToEstimates: () => void;
  onOpenCreateProject: () => void;
  onOpenCreateEstimate: () => void;
  onOpenMemberMaster: () => void;
  onOpenHolidayModal: () => void;
  onOpenProcessStructureModal: () => void;
  onOpenImportData: (tab?: 'wbs' | 'members' | 'holidays' | 'process_structure') => void;
  onExportMembersCsv: () => void;
  onOpenResetDemoModal: () => void;
  onOpenClearDataModal: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  projects,
  estimates,
  members,
  holidays,
  processPatterns,
  onNavigateToWbs,
  onNavigateToEstimates,
  onOpenCreateProject,
  onOpenCreateEstimate,
  onOpenMemberMaster,
  onOpenHolidayModal,
  onOpenProcessStructureModal,
  onOpenImportData,
  onExportMembersCsv,
  onOpenResetDemoModal,
  onOpenClearDataModal,
}) => {
  // KPI集計
  const metrics = useMemo(() => {
    // プロジェクト進捗管理
    const totalProjects = projects.length;
    const linkedProjects = projects.filter((p) => Boolean(p.estimateNumber || p.estimateId)).length;
    const unlinkedProjects = totalProjects - linkedProjects;

    const totalFeatures = projects.reduce((acc, p) => acc + (p.features?.length || 0), 0);
    const totalWbsSteps = projects.reduce(
      (acc, p) => acc + (p.features || []).reduce((fAcc, f) => fAcc + (f.stepCount || 0), 0),
      0
    );

    // 見積管理
    const totalEstimates = estimates.length;
    const linkedEstimates = estimates.filter((e) => e.status === 'linked' || e.linkedProjectId).length;
    const approvedEstimates = estimates.filter((e) => e.status === 'approved' && !e.linkedProjectId).length;
    const submittedEstimates = estimates.filter((e) => e.status === 'submitted').length;
    const draftEstimates = estimates.filter((e) => e.status === 'draft').length;

    const totalEstimateAmount = estimates.reduce((acc, e) => {
      const subtotal = e.features.reduce(
        (fAcc, f) => fAcc + (f.estimatedAmount || f.estimatedWorkload * e.unitPrice),
        0
      );
      return acc + Math.round(subtotal * (1 + (e.taxRate !== undefined ? e.taxRate : 0.1)));
    }, 0);

    // 担当者
    const totalMembers = members.length;
    const pmsCount = members.filter((m) =>
      ['本部長', '副本部長', '部長', '課長'].includes(m.role)
    ).length;
    const staffCount = members.filter((m) =>
      ['主任', '担当', '研修生'].includes(m.role)
    ).length;

    return {
      totalProjects,
      linkedProjects,
      unlinkedProjects,
      totalFeatures,
      totalWbsSteps,
      totalEstimates,
      linkedEstimates,
      approvedEstimates,
      submittedEstimates,
      draftEstimates,
      totalEstimateAmount,
      totalMembers,
      pmsCount,
      staffCount,
    };
  }, [projects, estimates, members]);

  const todayStr = useMemo(() => {
    const d = new Date();
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${days[d.getDay()]})`;
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-slate-100 overflow-y-auto">
      {/* メインメニュー ヘッダーバナー */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-semibold">
                  メインメニュー
                </span>
                <span className="text-xs text-slate-400 font-mono">{todayStr}</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>PaceUP! 統合管理ポータル</span>
              </h1>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                概算見積登録・見積管理、プロジェクト横断進捗管理（WBS/ガント/イナズマ線/Step数・生産性）、担当者マスタ管理をシームレスに統合。
              </p>
            </div>

            {/* クイックリンク */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onNavigateToWbs()}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                <FolderKanban className="w-4 h-4" />
                <span>進捗管理へ直行</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onNavigateToEstimates}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                <Calculator className="w-4 h-4 text-indigo-400" />
                <span>見積管理へ</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 全体統計サマリー */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium">進行中プロジェクト</span>
              <FolderKanban className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 font-mono">{metrics.totalProjects}</span>
              <span className="text-xs text-slate-500">件</span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <span className="text-indigo-600 font-semibold font-mono">見積連携: {metrics.linkedProjects}件</span>
              <span>/</span>
              <span className="text-amber-600 font-semibold font-mono">未連携: {metrics.unlinkedProjects}件</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium">概算見積マスタ件数</span>
              <Calculator className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 font-mono">{metrics.totalEstimates}</span>
              <span className="text-xs text-slate-500">件</span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <span className="text-emerald-700 font-semibold">受注・連携済: {metrics.linkedEstimates + metrics.approvedEstimates}件</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium">稼働中開発規模 (Step数)</span>
              <Layers className="w-4 h-4 text-purple-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-purple-700 font-mono">
                {metrics.totalWbsSteps.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">Step</span>
            </div>
            <div className="text-[11px] text-slate-500">
              全{metrics.totalFeatures}機能の積算開発行数
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium">登録担当者数 (全役職)</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 font-mono">{metrics.totalMembers}</span>
              <span className="text-xs text-slate-500">名</span>
            </div>
            <div className="text-[11px] text-slate-500">
              管理者層: {metrics.pmsCount}名 / 実務層: {metrics.staffCount}名
            </div>
          </div>
        </div>

        {/* メイン3大機能カード */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">主要機能メニュー</h2>
              <p className="text-xs text-slate-500">利用したい機能を選択してください</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. プロジェクト進捗管理カード */}
            <div className="bg-white rounded-2xl border-2 border-slate-200 hover:border-indigo-500/80 transition-all duration-200 shadow-sm hover:shadow-lg flex flex-col overflow-hidden group">
              <div className="p-6 flex-1 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <FolderKanban className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                    WBS・ガント
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    プロジェクト進捗管理
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    プロジェクト横断のWBS・ガントチャート・イナズマ線による実績管理。機能別Step数・生産性・工数・遅延を可視化します。
                  </p>
                </div>

                {/* 連携ステータス情報 */}
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-700">
                    <span>プロジェクト数:</span>
                    <span className="font-mono">{projects.length}件</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      見積連携済プロジェクト:
                    </span>
                    <span className="font-mono font-bold text-indigo-700">{metrics.linkedProjects}件</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      単体登録 (未連携):
                    </span>
                    <span className="font-mono font-bold text-amber-700">{metrics.unlinkedProjects}件</span>
                  </div>
                  <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200">
                    ※見積管理と連携されていないプロジェクトはUI上に明示されます
                  </p>
                </div>
              </div>

              {/* カードフッターアクション */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateToWbs()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <span>進捗管理画面を開く</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onOpenCreateProject}
                  className="p-2.5 rounded-xl border border-slate-300 hover:bg-white text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer"
                  title="新規プロジェクトを作成"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 2. 見積管理カード */}
            <div className="bg-white rounded-2xl border-2 border-slate-200 hover:border-emerald-500/80 transition-all duration-200 shadow-sm hover:shadow-lg flex flex-col overflow-hidden group">
              <div className="p-6 flex-1 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Calculator className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                    新機能・連携対応
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                    見積管理 (概算見積登録)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    プロジェクトおよび機能の登録、見積管理番号の発行、Step数・工数・概算金額の積算。受注後に進捗管理へワンクリック連携します。
                  </p>
                </div>

                {/* 見積ステータス情報 */}
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-700">
                    <span>総見積登録件数:</span>
                    <span className="font-mono">{estimates.length}件</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      進捗管理へ連携済:
                    </span>
                    <span className="font-mono font-bold text-purple-700">{metrics.linkedEstimates}件</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      受注・内諾 (未連携):
                    </span>
                    <span className="font-mono font-bold text-emerald-700">{metrics.approvedEstimates}件</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                    <span>概算合計金額:</span>
                    <span className="font-mono font-bold text-slate-800">
                      ¥{metrics.totalEstimateAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* カードフッターアクション */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onNavigateToEstimates}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <span>見積管理画面を開く</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onOpenCreateEstimate}
                  className="p-2.5 rounded-xl border border-slate-300 hover:bg-white text-slate-700 hover:text-emerald-600 transition-colors cursor-pointer"
                  title="新規概算見積を登録"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 3. 担当者マスタ管理カード（メインメニューに移動） */}
            <div className="bg-white rounded-2xl border-2 border-slate-200 hover:border-purple-500/80 transition-all duration-200 shadow-sm hover:shadow-lg flex flex-col overflow-hidden group">
              <div className="p-6 flex-1 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold border border-purple-100">
                    メインメニュー移動
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                    担当者マスタ管理
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    全社の担当者、役職（9段階）、1日の稼働時間、有給・特別休暇の統合管理。CSV取り込み・出力もここから実行できます。
                  </p>
                </div>

                {/* メンバー構成情報 */}
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-700">
                    <span>登録メンバー数:</span>
                    <span className="font-mono">{members.length}名</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                    <div>執行役員・本部長: <strong>{members.filter(m => ['執行役員', '本部長', '副本部長'].includes(m.role)).length}名</strong></div>
                    <div>部長・課長 (PM): <strong>{members.filter(m => ['部長', '課長'].includes(m.role)).length}名</strong></div>
                    <div>主任・担当: <strong>{members.filter(m => ['主任', '担当'].includes(m.role)).length}名</strong></div>
                    <div>研修生: <strong>{members.filter(m => m.role === '研修生').length}名</strong></div>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => onOpenImportData('members')}
                      className="flex-1 py-1 px-2 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Upload className="w-3 h-3 text-slate-500" />
                      <span>CSV取込</span>
                    </button>
                    <button
                      type="button"
                      onClick={onExportMembersCsv}
                      className="flex-1 py-1 px-2 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Download className="w-3 h-3 text-slate-500" />
                      <span>CSV出力</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* カードフッターアクション */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenMemberMaster}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  <span>担当者マスタを開く</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* システムマスタ ＆ データ移行ツールバー */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-slate-600" />
                <span>システムマスタ設定 ＆ 全社データ移行</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                会社共通休日カレンダー、工程構成パターン、CSV一括データ移行などを管理します
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* 休日管理 */}
            <button
              type="button"
              onClick={onOpenHolidayModal}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-left transition-all cursor-pointer group flex items-start gap-3"
            >
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 group-hover:text-indigo-900">休日カレンダー管理</div>
                <div className="text-[11px] text-slate-500 mt-0.5">祝日・土日・創立記念日・有給</div>
              </div>
            </button>

            {/* 工程構成マスタ */}
            <button
              type="button"
              onClick={onOpenProcessStructureModal}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-left transition-all cursor-pointer group flex items-start gap-3"
            >
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100">
                <Workflow className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 group-hover:text-emerald-900">工程構成マスタ</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{processPatterns.length}パターンの開発工程定義</div>
              </div>
            </button>

            {/* CSV一括データ移行 */}
            <button
              type="button"
              onClick={() => onOpenImportData('wbs')}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-left transition-all cursor-pointer group flex items-start gap-3"
            >
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 group-hover:text-blue-900">CSVデータ移行</div>
                <div className="text-[11px] text-slate-500 mt-0.5">WBS・担当者・休日の一括取込</div>
              </div>
            </button>

            {/* デモ復元 / データリセット */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-2">
              <div className="font-bold text-slate-700 text-xs">データメンテナンス</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenResetDemoModal}
                  className="flex-1 py-1 px-2 rounded bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 text-[11px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3 h-3 text-indigo-600" />
                  <span>初期復元</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenClearDataModal}
                  className="flex-1 py-1 px-2 rounded bg-white hover:bg-rose-50 border border-slate-200 text-slate-700 hover:text-rose-700 text-[11px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3 text-rose-500" />
                  <span>データ消去</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
