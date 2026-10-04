import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Activity,
  LineChart,
  Plus,
  ChevronsDown,
  ChevronsUp,
  Clock,
  RotateCcw,
  Download,
  CalendarCheck,
  AlertTriangle,
  CheckCircle2,
  Check,
  User,
  X,
  FolderKanban,
  Settings,
  Layers,
  Users,
  History,
  Trash2,
  Upload,
  ChevronDown,
  FileSpreadsheet,
  Database,
  Workflow,
  Home,
  Calculator,
  Sparkles,
} from 'lucide-react';
import { ProjectSettings, Feature, Holiday, Project } from '../types';
import { getTodayString } from '../utils/dateUtils';
import { computeProjectSummary } from '../utils/wbsCalculations';

interface HeaderProps {
  settings: ProjectSettings;
  features: Feature[];
  holidays: Holiday[];
  assigneeFilter?: string;
  onClearAssigneeFilter?: () => void;
  allProjects: Project[];
  selectedProjectId: string; // 'all' または 各プロジェクトID
  onSelectProject: (projectId: string) => void;
  onOpenCreateProject: () => void;
  onOpenEditProject: (projectId: string) => void;
  onUpdateSettings: (newSettings: Partial<ProjectSettings>) => void;
  onOpenAddFeature: () => void;
  onOpenHolidays: () => void;
  onOpenMemberMaster?: () => void;
  onOpenProcessStructureMaster?: () => void;
  onOpenMeetingHours?: () => void;
  onOpenWbsHistory?: () => void;
  onNavigateToMainMenu?: () => void;
  onNavigateToEstimates?: (estimateId?: string) => void;
  onOpenLinkEstimateModal?: (project: Project) => void;
  membersCount?: number;
  snapshotsCount?: number;
  defaultProcessesCount?: number;
  onToggleAllExpand: (expand: boolean) => void;
  isAllExpanded: boolean;
  onResetData: () => void;
  onClearAllData?: () => void;
  onExportCsv?: () => void;
  onExportWbsCsv?: () => void;
  onExportMembersCsv?: () => void;
  onExportHolidaysCsv?: () => void;
  onExportProcessStructureCsv?: () => void;
  onOpenImportData?: (initialTab?: 'wbs' | 'members' | 'holidays' | 'process_structure') => void;
  isSaving: boolean;
  lastSavedAt: Date | null;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  features,
  holidays,
  assigneeFilter,
  onClearAssigneeFilter,
  allProjects,
  selectedProjectId,
  onSelectProject,
  onOpenCreateProject,
  onOpenEditProject,
  onUpdateSettings,
  onOpenAddFeature,
  onOpenHolidays,
  onOpenMemberMaster,
  onOpenProcessStructureMaster,
  onOpenMeetingHours,
  onOpenWbsHistory,
  onNavigateToMainMenu,
  onNavigateToEstimates,
  onOpenLinkEstimateModal,
  membersCount = 0,
  snapshotsCount = 0,
  defaultProcessesCount,
  onToggleAllExpand,
  isAllExpanded,
  onResetData,
  onClearAllData,
  onExportCsv,
  onExportWbsCsv,
  onExportMembersCsv,
  onExportHolidaysCsv,
  onExportProcessStructureCsv,
  onOpenImportData,
  isSaving,
  lastSavedAt,
}) => {
  const today = getTodayString();
  const [isMasterMenuOpen, setIsMasterMenuOpen] = useState(false);
  const masterMenuRef = useRef<HTMLDivElement>(null);

  // マスタ管理メニューの外側クリック検知
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (masterMenuRef.current && !masterMenuRef.current.contains(e.target as Node)) {
        setIsMasterMenuOpen(false);
      }
    };
    if (isMasterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMasterMenuOpen]);

  // プロジェクト全体または担当者のサマリー計算
  const projectSummary = useMemo(() => {
    return computeProjectSummary(
      features,
      settings.baselineDate,
      holidays,
      settings.workloadUnit,
      settings.hoursPerDay
    );
  }, [features, settings.baselineDate, holidays, settings.workloadUnit, settings.hoursPerDay]);

  const currentProjectMeta = allProjects.find((p) => p.id === selectedProjectId);
  const isAllProjects = selectedProjectId === 'all';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* 上部：プロジェクト統合セレクター ＆ プロジェクト管理バー */}
      <div className="px-4 py-1.5 bg-slate-900 text-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* メインメニュー戻りボタン */}
          {onNavigateToMainMenu && (
            <button
              type="button"
              onClick={onNavigateToMainMenu}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 hover:border-indigo-400 text-[11px] font-semibold transition-colors cursor-pointer mr-1"
              title="メインメニューに戻る"
            >
              <Home className="w-3.5 h-3.5 text-indigo-400" />
              <span>メインメニュー</span>
            </button>
          )}

          {/* 見積管理遷移ボタン */}
          {onNavigateToEstimates && (
            <button
              type="button"
              onClick={() => onNavigateToEstimates()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 hover:border-emerald-400 text-[11px] font-semibold transition-colors cursor-pointer mr-2"
              title="概算見積管理画面を開く"
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-400" />
              <span>見積管理</span>
            </button>
          )}

          <div className="h-4 w-px bg-slate-700 hidden sm:block mr-1" />

          <div className="flex items-center gap-1.5 text-indigo-300 font-semibold">
            <FolderKanban className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-300">プロジェクト:</span>
          </div>

          {/* プロジェクト切り替えセレクトボックス */}
          <div className="relative">
            <select
              value={selectedProjectId}
              onChange={(e) => onSelectProject(e.target.value)}
              className="bg-slate-800 text-white font-semibold text-xs border border-slate-700 hover:border-indigo-400 rounded-md px-2.5 py-1 pr-7 appearance-none cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-indigo-400 transition-colors"
            >
              <option value="all">🏢 すべてのプロジェクト（横断表示・全{allProjects.length}件）</option>
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  📁 {p.name} {p.estimateNumber ? `[${p.estimateNumber}]` : '[未連携]'} {p.manager ? `(PM: ${p.manager})` : ''}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <ChevronsDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* 選択中のプロジェクト情報・見積連携ステータスバッジ */}
          {isAllProjects ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/60 text-[11px] font-medium">
                <Layers className="w-3 h-3" />
                <span>全プロジェクト横断 ({allProjects.length}件)</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
                <span className="text-indigo-300 font-semibold font-mono">
                  連携済: {allProjects.filter((p) => p.estimateNumber).length}件
                </span>
                <span className="text-slate-500">/</span>
                <span className="text-amber-300 font-semibold font-mono">
                  未連携: {allProjects.filter((p) => !p.estimateNumber).length}件
                </span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {currentProjectMeta?.manager && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-medium">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>管理者: {currentProjectMeta.manager}</span>
                </span>
              )}

              {/* 見積連携ありの場合 */}
              {currentProjectMeta?.estimateNumber ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-200 border border-indigo-500/80 text-[11px] font-medium shadow-2xs">
                  <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span>見積連携済:</span>
                  <span className="font-mono font-bold text-white bg-indigo-900/90 px-1.5 py-0.2 rounded">
                    {currentProjectMeta.estimateNumber}
                  </span>
                  {currentProjectMeta.estimateTitle && (
                    <span className="text-indigo-300 max-w-[140px] truncate" title={currentProjectMeta.estimateTitle}>
                      ({currentProjectMeta.estimateTitle})
                    </span>
                  )}
                  {onNavigateToEstimates && (
                    <button
                      type="button"
                      onClick={() => onNavigateToEstimates(currentProjectMeta.estimateId)}
                      className="ml-1 text-[10px] text-indigo-300 hover:text-white underline hover:no-underline cursor-pointer"
                    >
                      見積表示
                    </button>
                  )}
                </div>
              ) : (
                /* 見積未連携（単体登録）の場合 */
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-600/70 text-amber-200 text-[11px] font-medium">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>見積未連携（単体登録）</span>
                  {currentProjectMeta && onOpenLinkEstimateModal && (
                    <button
                      type="button"
                      onClick={() => onOpenLinkEstimateModal(currentProjectMeta)}
                      className="ml-1 px-2 py-0.2 rounded bg-amber-800/90 hover:bg-amber-700 text-white text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                    >
                      見積と紐付け
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右側：マスタ管理・履歴・プロジェクト管理アクションボタン */}
        <div className="flex items-center gap-2">
          {/* マスタ管理ドロップダウン（休日管理・担当者マスタ・CSV管理） */}
          <div className="relative" ref={masterMenuRef}>
            <button
              type="button"
              onClick={() => setIsMasterMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white border border-slate-700 hover:border-indigo-400 text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
              title="マスタ設定（担当者・休日）およびCSV管理（取り込み・出力）"
            >
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>マスタ管理</span>
              <ChevronDown
                className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${
                  isMasterMenuOpen ? 'rotate-180 text-indigo-300' : ''
                }`}
              />
            </button>

            {isMasterMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-slate-800">
                {/* セクション1：マスタ設定 */}
                <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  マスタ設定
                </div>

                {onOpenMemberMaster && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMasterMenuOpen(false);
                      onOpenMemberMaster();
                    }}
                    className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-indigo-50/70 text-slate-700 hover:text-indigo-900 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-md bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-900">
                          担当者マスタ
                        </div>
                        <div className="text-[11px] text-slate-500">
                          役職・稼働時間・個別休暇
                        </div>
                      </div>
                    </div>
                    {membersCount > 0 && (
                      <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                        {membersCount}名
                      </span>
                    )}
                  </button>
                )}

                {/* 工程構成管理 */}
                {onOpenProcessStructureMaster && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMasterMenuOpen(false);
                      onOpenProcessStructureMaster();
                    }}
                    className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-emerald-50/70 text-slate-700 hover:text-emerald-900 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 shrink-0">
                        <Workflow className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">
                          工程構成管理
                        </div>
                        <div className="text-[11px] text-slate-500">
                          新規機能の初期工程・工数構成
                        </div>
                      </div>
                    </div>
                    {defaultProcessesCount !== undefined && defaultProcessesCount > 0 && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                        {defaultProcessesCount}工程
                      </span>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsMasterMenuOpen(false);
                    onOpenHolidays();
                  }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-rose-50/70 text-slate-700 hover:text-rose-900 transition-colors cursor-pointer group"
                >
                  <div className="p-1.5 rounded-md bg-rose-50 text-rose-600 group-hover:bg-rose-100 shrink-0">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-rose-900">
                      休日管理
                    </div>
                    <div className="text-[11px] text-slate-500">
                      祝日・会社休日カレンダー設定
                    </div>
                  </div>
                </button>

                {/* 定例会・会議時間設定 */}
                {onOpenMeetingHours && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMasterMenuOpen(false);
                      onOpenMeetingHours();
                    }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-amber-50/70 text-slate-700 hover:text-amber-900 transition-colors cursor-pointer group"
                  >
                    <div className="p-1.5 rounded-md bg-amber-50 text-amber-600 group-hover:bg-amber-100 shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-amber-900 flex items-center gap-1.5">
                        <span>定例会・会議時間設定</span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-mono font-semibold">
                          実稼働
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        全曜日の会議時間と実稼働時間の管理
                      </div>
                    </div>
                  </button>
                )}

                {/* 区切り線 */}
                <div className="my-1.5 border-t border-slate-100"></div>

                {/* セクション2：CSV管理 */}
                <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>CSV管理</span>
                  <span className="text-[9px] font-normal text-slate-400">取込・出力</span>
                </div>

                {onOpenImportData && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMasterMenuOpen(false);
                      onOpenImportData('wbs');
                    }}
                    className="w-full text-left px-3 py-1.5 flex items-center gap-2.5 hover:bg-slate-50 text-slate-700 hover:text-indigo-900 transition-colors cursor-pointer group"
                  >
                    <div className="p-1.5 rounded-md bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 shrink-0">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-900">
                        CSV取り込み
                      </div>
                      <div className="text-[11px] text-slate-500">
                        進捗・担当者・休日・工程構成のCSV反映
                      </div>
                    </div>
                  </button>
                )}

                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-400">
                  CSV出力 (エクスポート)
                </div>

                <div className="grid grid-cols-1 gap-0.5 px-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMasterMenuOpen(false);
                      if (onExportWbsCsv) onExportWbsCsv();
                      else if (onExportCsv) onExportCsv();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2 hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 transition-colors cursor-pointer text-xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="font-medium">プロジェクト進捗 (WBS) 出力</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMasterMenuOpen(false);
                      if (onExportMembersCsv) onExportMembersCsv();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2 hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 transition-colors cursor-pointer text-xs"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-medium">担当者マスタ 出力</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMasterMenuOpen(false);
                      if (onExportHolidaysCsv) onExportHolidaysCsv();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2 hover:bg-rose-50 text-slate-700 hover:text-rose-900 transition-colors cursor-pointer text-xs"
                  >
                    <CalendarCheck className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="font-medium">休日管理カレンダー 出力</span>
                  </button>

                  {onExportProcessStructureCsv && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMasterMenuOpen(false);
                        onExportProcessStructureCsv();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2 hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 transition-colors cursor-pointer text-xs"
                    >
                      <Workflow className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-medium">工程構成マスタ 出力</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 履歴・保存ボタン（最上部ヘッダー部へ移動） */}
          {onOpenWbsHistory && (
            <button
              type="button"
              onClick={onOpenWbsHistory}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 hover:border-amber-500/50 text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
              title="リスケジュール対策：WBSバージョンの保存・履歴比較・復元"
            >
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span>履歴・保存</span>
              {snapshotsCount > 0 && (
                <span className="bg-amber-500/25 text-amber-300 border border-amber-500/50 text-[10px] font-bold px-1.5 py-0.2 rounded-full font-mono">
                  {snapshotsCount}
                </span>
              )}
            </button>
          )}

          {!isAllProjects && (
            <button
              type="button"
              onClick={() => onOpenEditProject(selectedProjectId)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
              title="選択中のプロジェクト設定・管理者を編集"
            >
              <Settings className="w-3 h-3 text-slate-400" />
              <span>プロジェクト編集</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCreateProject}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium transition-colors cursor-pointer shadow-xs"
            title="新規プロジェクトを作成して追加"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新規プロジェクト追加</span>
          </button>
        </div>
      </div>

      {/* メイントップバー */}
      <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        {/* 左側：ロゴ & プロジェクト表示 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <img
              src="/logo.jpg"
              alt="PaceUP!"
              className="h-9 w-auto max-w-[130px] object-contain rounded-sm"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = document.getElementById('paceup-fallback-badge');
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div
              id="paceup-fallback-badge"
              className="hidden items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 text-white shadow-xs"
            >
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>PaceUP!</span>
                <span className="text-slate-400 font-normal text-xs">|</span>
                <span className="text-sm font-bold text-slate-700">
                  {isAllProjects ? '全プロジェクト横断進捗管理' : settings.projectName}
                </span>
              </h1>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {isAllProjects ? '横断ビュー' : 'WBS進捗管理'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
              <span>進捗管理システム</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                {isSaving ? (
                  <span className="text-amber-600 font-medium">保存中...</span>
                ) : lastSavedAt ? (
                  <span className="text-slate-400">
                    自動保存済 ({lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})
                  </span>
                ) : (
                  <span className="text-slate-400">準備完了</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* 中央：プロジェクト全体または担当者の進捗率（予定・実績）＆状況表示 */}
        <div className={`flex items-center border rounded-xl px-3.5 py-1.5 shadow-2xs gap-4 transition-all ${
          assigneeFilter ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-slate-50 border-slate-200/90'
        }`}>
          {/* 進捗率（予定・実績） */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {assigneeFilter ? '担当者進捗率' : '全体進捗率'}
                </span>
                {assigneeFilter && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-indigo-100 border border-indigo-300 text-indigo-800 text-[10px] font-bold">
                    <User className="w-2.5 h-2.5" />
                    <span>{assigneeFilter}</span>
                    {onClearAssigneeFilter && (
                      <button
                        type="button"
                        onClick={onClearAssigneeFilter}
                        className="hover:bg-indigo-200 rounded-full p-0.5 ml-0.5 text-indigo-600 hover:text-indigo-900 cursor-pointer"
                        title="担当者絞り込みを解除"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {projectSummary.totalProcessesCount === 0 ? (
                  <span className="text-xs text-slate-400 italic">該当工程なし</span>
                ) : (
                  <>
                    {/* 予定 */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] px-1 py-0.2 rounded bg-indigo-100 text-indigo-700 font-semibold">
                        予定
                      </span>
                      <span className="font-mono text-xs font-bold text-indigo-700">
                        {projectSummary.overallPlannedProgress}%
                      </span>
                    </div>
                    <span className="text-slate-300 text-xs">/</span>
                    {/* 実績 */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold">
                        実績
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-700">
                        {projectSummary.overallActualProgress}%
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ミニ進捗バー */}
            {projectSummary.totalProcessesCount > 0 && (
              <div className="w-20 flex flex-col gap-1">
                <div
                  className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden"
                  title={`${assigneeFilter ? `${assigneeFilter} 予定進捗率` : '全体予定進捗率'}: ${projectSummary.overallPlannedProgress}%`}
                >
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all"
                    style={{ width: `${projectSummary.overallPlannedProgress}%` }}
                  ></div>
                </div>
                <div
                  className="w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden"
                  title={`${assigneeFilter ? `${assigneeFilter} 実績進捗率` : '全体実績進捗率'}: ${projectSummary.overallActualProgress}%`}
                >
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all"
                    style={{ width: `${projectSummary.overallActualProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          <div className="h-7 w-px bg-slate-200"></div>

          {/* 全体状況 / 担当者状況 */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {assigneeFilter ? '担当者状況' : '全体状況'}
            </span>
            <div className="mt-0.5">
              {projectSummary.totalProcessesCount === 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-400 text-xs font-medium">
                  -
                </span>
              ) : projectSummary.overallStatus === 'completed' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>完了</span>
                </span>
              ) : projectSummary.overallStatus === 'on_track' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 border border-blue-200 text-blue-800 text-xs font-bold">
                  <Check className="w-3.5 h-3.5" />
                  <span>順調</span>
                </span>
              ) : projectSummary.overallStatus === 'delayed' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 border border-rose-200 text-rose-800 text-xs font-bold shadow-2xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>遅延</span>
                  <span className="font-mono text-xs text-rose-700 bg-white/70 px-1 py-0.2 rounded ml-0.5">
                    -{projectSummary.totalDelayManDays > 0 ? projectSummary.totalDelayManDays : '0.1'}人日
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  <span>未着手</span>
                </span>
              )}
            </div>
          </div>

          <div className="h-7 w-px bg-slate-200"></div>

          {/* プロジェクト全体のStep数 ＆ 生産性 */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Step数 / 生産性
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <div
                className="flex items-center gap-1"
                title={`プロジェクト総Step数: ${projectSummary.totalStepCount ? projectSummary.totalStepCount.toLocaleString() : 0} Step`}
              >
                <span className="text-[10px] px-1 py-0.2 rounded bg-indigo-100 text-indigo-700 font-semibold">
                  Step
                </span>
                <span className="font-mono text-xs font-bold text-slate-800">
                  {projectSummary.totalStepCount > 0 ? projectSummary.totalStepCount.toLocaleString() : '-'}
                </span>
              </div>
              <span className="text-slate-300 text-xs">/</span>
              <div
                className="flex items-center gap-1"
                title={
                  projectSummary.totalStepCount > 0
                    ? `生産性 (Step/${settings.workloadUnit}): 実績 ${projectSummary.actualProductivity ?? '-'} / 予定 ${projectSummary.plannedProductivity ?? '-'}`
                    : 'Step未入力'
                }
              >
                <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold">
                  生産性
                </span>
                <span className="font-mono text-xs font-bold text-emerald-700">
                  {projectSummary.totalStepCount > 0 ? (
                    projectSummary.actualProductivity !== undefined ? (
                      `${projectSummary.actualProductivity}`
                    ) : projectSummary.plannedProductivity !== undefined ? (
                      `予:${projectSummary.plannedProductivity}`
                    ) : (
                      '-'
                    )
                  ) : (
                    '-'
                  )}
                  {projectSummary.totalStepCount > 0 &&
                    (projectSummary.actualProductivity !== undefined || projectSummary.plannedProductivity !== undefined) && (
                      <span className="text-[10px] font-normal text-slate-500 ml-0.5">
                        Step/{settings.workloadUnit}
                      </span>
                    )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 右側：メインアクション群 */}
        <div className="flex items-center flex-wrap gap-2">
          {/* 基準日コントロール */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-600 font-medium flex items-center gap-1">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-500" />
              基準日:
            </span>
            <input
              type="date"
              value={settings.baselineDate}
              onChange={(e) => {
                if (e.target.value) {
                  onUpdateSettings({ baselineDate: e.target.value });
                }
              }}
              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800 font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
            {settings.baselineDate !== today && (
              <button
                type="button"
                onClick={() => onUpdateSettings({ baselineDate: today })}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium ml-1 cursor-pointer underline"
                title="今日の日付にリセット"
              >
                今日
              </button>
            )}
          </div>

          {/* 工数単位切替 */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => onUpdateSettings({ workloadUnit: '人日' })}
              className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                settings.workloadUnit === '人日'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              人日
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ workloadUnit: '人時' })}
              className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                settings.workloadUnit === '人時'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              人時
            </button>
          </div>

          {/* イナズマ線トグル（要件のチェックボックスON/OFF機能） */}
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50/70 hover:bg-amber-100/60 cursor-pointer transition-colors text-xs select-none">
            <input
              type="checkbox"
              checked={settings.showLightningLine}
              onChange={(e) => onUpdateSettings({ showLightningLine: e.target.checked })}
              className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer accent-amber-600"
            />
            <span className="font-semibold text-amber-900 flex items-center gap-1">
              ⚡ イナズマ線
            </span>
          </label>

          {/* バーンダウンチャートトグル */}
          <button
            type="button"
            onClick={() => onUpdateSettings({ showBurnDown: !settings.showBurnDown })}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
              settings.showBurnDown
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <LineChart className="w-3.5 h-3.5" />
            <span>バーンダウン</span>
          </button>

          {/* 新規機能追加ボタン */}
          <button
            type="button"
            onClick={onOpenAddFeature}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>機能を追加</span>
          </button>
        </div>
      </div>

      {/* サブコントロールバー（グリッド補助機能） */}
      <div className="px-4 py-1.5 bg-slate-50/90 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          {/* 一括展開/折りたたみ */}
          <button
            type="button"
            onClick={() => onToggleAllExpand(!isAllExpanded)}
            className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-medium cursor-pointer"
          >
            {isAllExpanded ? (
              <>
                <ChevronsUp className="w-3 h-3 text-slate-500" />
                <span>全機能を折りたたむ</span>
              </>
            ) : (
              <>
                <ChevronsDown className="w-3 h-3 text-slate-500" />
                <span>全機能を展開する</span>
              </>
            )}
          </button>

          <span className="text-slate-300">|</span>

          {/* 凡例バッジ */}
          <div className="flex items-center gap-2.5 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500"></span>
              <span>予定期間</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500"></span>
              <span>実績進捗</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-amber-500"></span>
              <span className="text-amber-700 font-medium">イナズマ線 (左:遅延 / 右:先行)</span>
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
              <span>休日・非稼働日</span>
            </span>
          </div>
        </div>

        {/* データツール群（初期化・リセット） */}
        <div className="flex items-center gap-2 text-[11px]">
          <button
            type="button"
            onClick={onResetData}
            className="flex items-center gap-1 text-slate-400 hover:text-rose-600 cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-200/60"
            title="デモ初期データにリセット"
          >
            <RotateCcw className="w-3 h-3" />
            <span>初期状態へ復元</span>
          </button>
          {onClearAllData && (
            <button
              type="button"
              onClick={onClearAllData}
              className="flex items-center gap-1 text-rose-500 hover:text-rose-700 cursor-pointer px-1.5 py-0.5 rounded hover:bg-rose-50/80 border border-rose-200 font-medium transition-colors"
              title="休日管理以外の全データをクリアして新規状態にします"
            >
              <Trash2 className="w-3 h-3 text-rose-500" />
              <span>データリセット</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
