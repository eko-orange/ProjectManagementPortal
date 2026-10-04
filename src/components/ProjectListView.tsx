import React, { useState, useMemo } from 'react';
import {
  FolderKanban,
  Plus,
  Search,
  User,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Activity,
  ArrowRight,
  Edit3,
  Trash2,
  Check,
  Filter,
  Layers,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Project } from '../types';
import { computeFullProjectMetrics, ProjectSummary } from '../utils/wbsCalculations';

interface ProjectListViewProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onOpenCreateModal: () => void;
  onOpenEditModal: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
}

export const ProjectListView: React.FC<ProjectListViewProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onOpenCreateModal,
  onOpenEditModal,
  onDeleteProject,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delayed' | 'on_track' | 'completed' | 'not_started'>('all');
  const [managerFilter, setManagerFilter] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // 各プロジェクトのメトリクスを算出
  const projectSummaries = useMemo(() => {
    return projects.map((p) => ({
      project: p,
      summary: computeFullProjectMetrics(p),
    }));
  }, [projects]);

  // 管理者のユニークリスト
  const managers = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.manager) set.add(p.manager);
    });
    return Array.from(set);
  }, [projects]);

  // フィルタリング
  const filteredSummaries = useMemo(() => {
    return projectSummaries.filter(({ project, summary }) => {
      // 検索ワード
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (project.name || '').toLowerCase().includes(q);
        const matchManager = (project.manager || '').toLowerCase().includes(q);
        const matchDesc = (project.description || '').toLowerCase().includes(q);
        if (!matchName && !matchManager && !matchDesc) return false;
      }

      // ステータスフィルター
      if (statusFilter !== 'all' && summary.status !== statusFilter) {
        return false;
      }

      // 管理者フィルター
      if (managerFilter !== 'all' && project.manager !== managerFilter) {
        return false;
      }

      return true;
    });
  }, [projectSummaries, searchQuery, statusFilter, managerFilter]);

  // 全体サマリー統計
  const overallStats = useMemo(() => {
    const total = projectSummaries.length;
    let delayedCount = 0;
    let completedCount = 0;
    let onTrackCount = 0;
    let sumActualProgress = 0;
    let sumPlannedProgress = 0;

    projectSummaries.forEach(({ summary }) => {
      if (summary.status === 'delayed') delayedCount++;
      else if (summary.status === 'completed') completedCount++;
      else if (summary.status === 'on_track') onTrackCount++;

      sumActualProgress += summary.actualProgress;
      sumPlannedProgress += summary.plannedProgress;
    });

    const avgActual = total > 0 ? Math.round(sumActualProgress / total) : 0;
    const avgPlanned = total > 0 ? Math.round(sumPlannedProgress / total) : 0;

    return {
      total,
      delayedCount,
      completedCount,
      onTrackCount,
      avgActual,
      avgPlanned,
    };
  }, [projectSummaries]);

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (projects.length <= 1) {
      alert('これ以上プロジェクトを削除することはできません（最低1件必要です）。');
      return;
    }
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = (id: string) => {
    onDeleteProject(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 上部ヘッダーバー */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white shadow-sm">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  プロジェクト一覧
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {projects.length} 件
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                各プロジェクトの予定・実績・状況の一括モニタリングおよび管理
              </p>
            </div>
          </div>

          {/* 新規プロジェクト作成ボタン */}
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs hover:shadow transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>新規プロジェクト作成</span>
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        {/* 指標サマリーカード */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {/* 総プロジェクト数 */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-500">総プロジェクト数</span>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">
                {overallStats.total}
                <span className="text-xs font-normal text-slate-400 ml-1">件</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">ポートフォリオ管理中</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          {/* 順調プロジェクト */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-emerald-700">順調</span>
              <div className="text-2xl font-bold text-emerald-600 mt-0.5">
                {overallStats.onTrackCount}
                <span className="text-xs font-normal text-slate-400 ml-1">件</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">オントラック進行</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* 遅延注意プロジェクト */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-rose-700">遅延発生</span>
              <div className="text-2xl font-bold text-rose-600 mt-0.5">
                {overallStats.delayedCount}
                <span className="text-xs font-normal text-slate-400 ml-1">件</span>
              </div>
              <div className="text-[11px] text-rose-500 mt-1 font-medium">
                {overallStats.delayedCount > 0 ? '重点フォロー推奨' : '遅延なし'}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          {/* 全体平均進捗率 */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-500">全体平均実績進捗</span>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">
                {overallStats.avgActual}
                <span className="text-xs font-normal text-slate-400 ml-1">%</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                予定平均: {overallStats.avgPlanned}%
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 検索・絞り込みフィルターバー */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          {/* 検索入力 */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="プロジェクト名、管理者、概要で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* フィルターセレクト群 */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 状況フィルター */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>状況:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">すべて ({projectSummaries.length})</option>
                <option value="on_track">順調</option>
                <option value="delayed">遅延</option>
                <option value="completed">完了</option>
                <option value="not_started">未着手</option>
              </select>
            </div>

            {/* 管理者フィルター */}
            {managers.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>管理者:</span>
                <select
                  value={managerFilter}
                  onChange={(e) => setManagerFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">全員</option>
                  {managers.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(searchQuery || statusFilter !== 'all' || managerFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setManagerFilter('all');
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 underline font-medium px-1 cursor-pointer"
              >
                クリア
              </button>
            )}
          </div>
        </div>

        {/* プロジェクト一覧カード群 */}
        {filteredSummaries.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <FolderKanban className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              該当するプロジェクトが見つかりませんでした
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              検索条件を変更するか、新しいプロジェクトを登録してください。
            </p>
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>新規プロジェクト作成</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSummaries.map(({ project, summary }) => {
              const isActive = project.id === activeProjectId;
              const isDelayed = summary.status === 'delayed';
              const isCompleted = summary.status === 'completed';

              return (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className={`bg-white rounded-xl border transition-all duration-200 shadow-xs hover:shadow-md hover:border-indigo-300 flex flex-col justify-between overflow-hidden cursor-pointer group ${
                    isActive ? 'ring-2 ring-indigo-500/20 border-indigo-500' : 'border-slate-200'
                  }`}
                >
                  {/* カード上部 */}
                  <div className="p-5">
                    {/* タイトル行 & 状況バッジ */}
                    <div className="flex items-start justify-between gap-2.5 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h2 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                            {project.name}
                          </h2>
                          {isActive && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0">
                              選択中
                            </span>
                          )}
                        </div>
                        {project.description && (
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                            {project.description}
                          </p>
                        )}
                      </div>

                      {/* 状況バッジ */}
                      <div className="shrink-0">
                        {summary.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Check className="w-3.5 h-3.5" />
                            <span>完了</span>
                          </span>
                        )}
                        {summary.status === 'delayed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span>遅延</span>
                          </span>
                        )}
                        {summary.status === 'on_track' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>順調</span>
                          </span>
                        )}
                        {summary.status === 'not_started' && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            未着手
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 管理者 & 期間情報 */}
                    <div className="space-y-1.5 py-2.5 px-3 rounded-lg bg-slate-50/80 border border-slate-100 text-xs mb-4">
                      {/* プロジェクト管理者 */}
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          管理者 (PM)
                        </span>
                        <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                            {project.manager ? project.manager[0] : '管'}
                          </span>
                          {project.manager || '未設定'}
                        </span>
                      </div>

                      {/* 期間 */}
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          スケジュール
                        </span>
                        <span className="text-slate-800 font-mono text-[11px]">
                          {summary.earliestStartDate && summary.latestEndDate ? (
                            <>
                              {summary.earliestStartDate.slice(5)} 〜 {summary.latestEndDate.slice(5)}
                              <span className="text-slate-400 ml-1">({summary.totalWorkingDays}日)</span>
                            </>
                          ) : (
                            <span className="text-slate-400">日付未定</span>
                          )}
                        </span>
                      </div>

                      {/* 工数 */}
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          総工数
                        </span>
                        <span className="text-slate-800 font-mono text-[11px]">
                          予定 {summary.totalPlannedWorkload} {summary.workloadUnit} / 実績 {summary.totalActualWorkload} {summary.workloadUnit}
                        </span>
                      </div>
                    </div>

                    {/* 予定進捗 vs 実績進捗 プログレスバー */}
                    <div className="space-y-2.5">
                      {/* 予定進捗 */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-500">予定進捗率</span>
                          <span className="font-semibold text-slate-700 font-mono">
                            {summary.plannedProgress}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-400 rounded-full transition-all duration-300"
                            style={{ width: `${summary.plannedProgress}%` }}
                          />
                        </div>
                      </div>

                      {/* 実績進捗 */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-slate-700">実績進捗率</span>
                          <span
                            className={`font-bold font-mono ${
                              isDelayed ? 'text-rose-600' : isCompleted ? 'text-blue-600' : 'text-emerald-600'
                            }`}
                          >
                            {summary.actualProgress}%
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isDelayed
                                ? 'bg-rose-500'
                                : isCompleted
                                ? 'bg-blue-600'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${summary.actualProgress}%` }}
                          />
                        </div>
                      </div>

                      {/* 遅延情報のアラート */}
                      {isDelayed && summary.delayManDays > 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-100">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>遅延工数: -{summary.delayManDays} 人日</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* カードフッター操作バー */}
                  <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {/* 編集ボタン */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEditModal(project);
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                        title="プロジェクト情報を編集"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {/* 削除ボタン */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(project.id, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        title="プロジェクトを削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* WBSを開くボタン */}
                    <button
                      type="button"
                      onClick={() => onSelectProject(project.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 group-hover:text-indigo-700 hover:underline cursor-pointer"
                    >
                      <span>WBS管理画面へ</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 削除確認モーダル */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">プロジェクトの削除</h4>
                <p className="text-xs text-slate-500">この操作は元に戻せません</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              プロジェクトとそれに紐づくすべての機能・工程・WBSデータが削除されます。本当に削除してよろしいですか？
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete(deleteConfirmId)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer"
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
