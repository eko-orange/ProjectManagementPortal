import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Feature,
  TaskProcess,
  Holiday,
  ProjectSettings,
  ComputedProcessStats,
  Project,
  COMMON_PROCESS_SUGGESTIONS,
  Member,
  TASK_ASSIGNEE_ROLES,
  normalizeMemberRole,
} from '../types';
import {
  calculateProcessStats,
  formatDate,
  getCalendarDays,
  isHoliday,
  isWorkingDay,
  parseDate,
  getTodayString,
  getWorkingDaysCount,
  computeDailyWorkloadMap,
  DayWorkloadSummary,
  AssigneeDailySummary,
  calculateAutoEndDateForProcess,
} from '../utils/dateUtils';
import {
  computeFeatureSummary,
  calculateProjectDateRange,
  computeLightningPoints,
  LightningPoint,
  FeatureSummary,
  calculateDelayManDays,
  computeFullProjectMetrics,
  ProjectSummary,
} from '../utils/wbsCalculations';
import {
  ChevronDown,
  ChevronRight,
  User,
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CornerDownRight,
  Zap,
  FolderKanban,
  Settings,
  Plus,
  Edit2,
  Check,
} from 'lucide-react';

interface WbsGridProps {
  projects: Project[];
  selectedProjectId: string; // 'all' または 特定のプロジェクトID
  onSelectProject?: (projectId: string) => void;
  settings: ProjectSettings;
  holidays: Holiday[];
  assigneeFilter?: string;
  onAssigneeFilterChange?: (filter: string) => void;
  onUpdateFeature: (projectId: string, featureId: string, updated: Partial<Feature>) => void;
  onUpdateProcess: (
    projectId: string,
    featureId: string,
    processId: string,
    updated: Partial<TaskProcess>
  ) => void;
  onDeleteFeature: (projectId: string, featureId: string) => void;
  onAddProcess?: (projectId: string, featureId: string, processName?: string) => void;
  onDeleteProcess?: (projectId: string, featureId: string, processId: string) => void;
  onOpenAddFeature?: (projectId?: string) => void;
  onOpenEditProject?: (project: Project) => void;
  members?: Member[];
  onOpenAutoSchedule?: (feature: Feature, project: Project) => void;
  onAutoSchedule?: (feature: Feature, project: Project) => void;
  onAutoScheduleAll?: (project: Project) => void;
  onAutoScheduleAllProjects?: () => void;
}

const ROW_HEIGHT = 52; // 行の高さ(px) - 上下2段レイアウトに適した高さ
const HEADER_HEIGHT = 56; // カレンダーヘッダーの高さ(px)

// フラットな表示行インターフェース
interface FlatRow {
  id: string;
  label: string;
  isProject?: boolean;
  isParent: boolean; // FeatureまたはProject
  projectId: string;
  project?: Project;
  projectSummary?: ProjectSummary;
  feature?: Feature;
  process?: TaskProcess;
  summary?: FeatureSummary;
  y: number;
}

export const WbsGrid: React.FC<WbsGridProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  settings,
  holidays,
  assigneeFilter: externalAssigneeFilter,
  onAssigneeFilterChange,
  onUpdateFeature,
  onUpdateProcess,
  onDeleteFeature,
  onAddProcess,
  onDeleteProcess,
  onOpenAddFeature,
  onOpenEditProject,
  members = [],
  onOpenAutoSchedule,
  onAutoSchedule,
  onAutoScheduleAll,
  onAutoScheduleAllProjects,
}) => {
  const calendarScrollRef = useRef<HTMLDivElement>(null);
  const leftTableScrollRef = useRef<HTMLDivElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<LightningPoint | null>(null);

  // スケジュールのズーム設定（縮小 24px / 標準 34px / 拡大 46px）
  const [zoomLevel, setZoomLevel] = useState<'compact' | 'normal' | 'wide'>('normal');
  const CELL_WIDTH = zoomLevel === 'compact' ? 24 : zoomLevel === 'wide' ? 46 : 34;

  // 左右ペインの中央線リサイズ可変幅（既定値760px、localStorage保存）
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('wbs_left_pane_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 200 && parsed <= 1800) {
          return parsed;
        }
      }
    } catch (_) {}
    return 860;
  });
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);

  const handleDividerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingDivider(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handleDividerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingDivider || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = e.clientX - containerRect.left;
    const minWidth = 200;
    const maxWidth = Math.max(minWidth, containerRect.width - 200);
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, Math.round(newWidth)));
    setLeftPaneWidth(clampedWidth);
  };

  const handleDividerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingDivider) {
      setIsDraggingDivider(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
      try {
        localStorage.setItem('wbs_left_pane_width', leftPaneWidth.toString());
      } catch (_) {}
    }
  };

  const handleDividerDoubleClick = () => {
    const nextWidth = leftPaneWidth === 860 ? 560 : 860;
    setLeftPaneWidth(nextWidth);
    try {
      localStorage.setItem('wbs_left_pane_width', nextWidth.toString());
    } catch (_) {}
  };

  // プロジェクトごとの展開/折りたたみ状態（デフォルトはすべて展開）
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  // 担当者フィルター状態（親Propsがある場合は同期、無ければ内部状態）
  const [internalAssigneeFilter, setInternalAssigneeFilter] = useState('');
  const assigneeFilter =
    externalAssigneeFilter !== undefined ? externalAssigneeFilter : internalAssigneeFilter;

  const handleFilterChange = (val: string) => {
    if (onAssigneeFilterChange) {
      onAssigneeFilterChange(val);
    } else {
      setInternalAssigneeFilter(val);
    }
  };

  const isAllProjects = selectedProjectId === 'all';

  // 表示対象のプロジェクト一覧
  const targetProjects = useMemo(() => {
    if (isAllProjects) {
      return projects;
    }
    return projects.filter((p) => p.id === selectedProjectId);
  }, [projects, selectedProjectId, isAllProjects]);

  // 全プロジェクトから抽出した登録済み担当者のユニークリスト
  const uniqueAssignees = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((proj) => {
      (proj.features || []).forEach((f) => {
        (f.processes || []).forEach((p) => {
          if (p.assignee && p.assignee.trim()) {
            set.add(p.assignee.trim());
          }
        });
      });
    });
    return Array.from(set).sort();
  }, [projects]);

  // 工程担当者として選任可能なメンバー（課長、主任、担当、研修生）
  const eligibleAssignees = useMemo(() => {
    return (members || []).filter((m) =>
      TASK_ASSIGNEE_ROLES.includes(normalizeMemberRole(m.role))
    );
  }, [members]);

  // 絞り込みフィルター用の候補一覧（担当者マスタ登録メンバー＋現在タスクに存在するその他担当者）
  const filterCandidates = useMemo(() => {
    const masterMembers = members || [];
    const memberNames = new Set(masterMembers.map((m) => m.name));
    const others = uniqueAssignees.filter((name) => !memberNames.has(name));
    return {
      masterMembers,
      others,
    };
  }, [members, uniqueAssignees]);

  // 各プロジェクトにおけるフィルタリング済み機能リスト
  const filteredProjectData = useMemo(() => {
    const query = assigneeFilter.trim().toLowerCase();

    return targetProjects.map((project) => {
      const allFeatures = project.features || [];
      let displayFeatures: Feature[] = allFeatures;

      if (query) {
        displayFeatures = allFeatures
          .map((f) => {
            const matched = f.processes.filter((p) =>
              (p.assignee || '').toLowerCase().includes(query)
            );
            if (matched.length === 0) return null;
            return {
              ...f,
              isExpanded: true, // 絞り込み時は対象工程が見えるように自動展開
              processes: matched,
            };
          })
          .filter((f): f is Feature => f !== null);
      }

      // 担当者フィルターに応じたプロジェクト集計指標
      const summary = computeFullProjectMetrics(project, assigneeFilter);

      return {
        project,
        displayFeatures,
        summary,
        // 担当者フィルターがある場合はヒットしたタスクがあるプロジェクトのみ表示
        shouldShow: !query || displayFeatures.length > 0,
      };
    });
  }, [targetProjects, assigneeFilter]);

  // 全表示対象の全機能フラットリスト（カレンダー範囲算出用）
  const allDisplayFeaturesForDateRange = useMemo(() => {
    const list: Feature[] = [];
    filteredProjectData.forEach((pd) => {
      if (pd.shouldShow) {
        list.push(...pd.displayFeatures);
      }
    });
    return list;
  }, [filteredProjectData]);

  // 日付セルホバー時のリッチツールチップ表示状態
  const [hoveredDaySummary, setHoveredDaySummary] = useState<{
    summary: DayWorkloadSummary;
    x: number;
    y: number;
  } | null>(null);

  // 全プロジェクトから全機能をフラットに集約（複数プロジェクトを跨いだ担当者の稼働状況・キャパシティ計算用）
  const allFeaturesAcrossProjects = useMemo(() => {
    const list: Feature[] = [];
    projects.forEach((proj) => {
      (proj.features || []).forEach((f) => list.push(f));
    });
    return list;
  }, [projects]);

  // 日別の予定工数内訳マップ（会議時間＋全プロジェクトの各工程の割り当て）
  const dailyWorkloadMap = useMemo(() => {
    return computeDailyWorkloadMap(
      allFeaturesAcrossProjects,
      holidays,
      members,
      settings.hoursPerDay || 8,
      settings.weeklyMeetingHours,
      settings.workloadUnit
    );
  }, [
    allFeaturesAcrossProjects,
    holidays,
    members,
    settings.hoursPerDay,
    settings.weeklyMeetingHours,
    settings.workloadUnit,
  ]);

  // ツールチップ用テキスト生成
  const buildDayTooltipText = (d: string, sum?: DayWorkloadSummary): string => {
    const dateObj = parseDate(d);
    const dayOfWeek = dateObj.getDay();
    const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];
    const holiday = holidays.find((h) => h.date === d);

    const titlePrefix = `${d} (${dayLabels[dayOfWeek]})${holiday ? ` [${holiday.name}]` : ''}`;
    if (!sum) return titlePrefix;

    const parts: string[] = [titlePrefix];
    if (sum.meetingHours > 0) {
      parts.push(`定例会/会議: ${sum.meetingHours}h`);
    }

    if (sum.processes && sum.processes.length > 0) {
      sum.processes.forEach((p) => {
        parts.push(`${p.processName} (${p.assignee}): ${p.hours}h`);
      });
    } else if (sum.meetingHours === 0) {
      parts.push('予定工数なし');
    }

    if (sum.assigneeBreakdown && Object.keys(sum.assigneeBreakdown).length > 0) {
      parts.push('--- 担当者別 (会議含む) ---');
      Object.values(sum.assigneeBreakdown).forEach((ab) => {
        parts.push(
          `${ab.assignee}: ${ab.totalHours}h / ${ab.standardCapacity}h (会議${ab.meetingHours}h+作業${ab.processHours}h)${ab.isOverCapacity ? ` ⚠️超過+${ab.overHours}h` : ''}`
        );
      });
    }

    parts.push(`合計稼働: ${sum.totalHours}h / 所定${sum.standardCapacity}h`);
    if (sum.isOverCapacity) {
      parts.push(`⚠️ 超過: +${sum.overHours}h`);
    }

    return parts.join('\n');
  };

  // カレンダー全表示範囲の算出
  const { minDate, maxDate } = useMemo(() => {
    return calculateProjectDateRange(allDisplayFeaturesForDateRange, settings.baselineDate);
  }, [allDisplayFeaturesForDateRange, settings.baselineDate]);

  const calendarDays = useMemo(() => {
    return getCalendarDays(minDate, maxDate);
  }, [minDate, maxDate]);

  // 月ヘッダー用のグルーピング
  const monthGroups = useMemo(() => {
    const groups: Array<{ monthKey: string; label: string; daysCount: number }> = [];
    let currentMonth = '';
    let count = 0;

    calendarDays.forEach((d) => {
      const mKey = d.slice(0, 7); // YYYY-MM
      if (mKey !== currentMonth) {
        if (currentMonth) {
          const [y, m] = currentMonth.split('-');
          groups.push({
            monthKey: currentMonth,
            label: `${y}年${parseInt(m, 10)}月`,
            daysCount: count,
          });
        }
        currentMonth = mKey;
        count = 1;
      } else {
        count++;
      }
    });

    if (currentMonth) {
      const [y, m] = currentMonth.split('-');
      groups.push({
        monthKey: currentMonth,
        label: `${y}年${parseInt(m, 10)}月`,
        daysCount: count,
      });
    }

    return groups;
  }, [calendarDays]);

  // 各機能のサマリー計算
  const featureSummaries = useMemo(() => {
    const map = new Map<string, FeatureSummary>();
    filteredProjectData.forEach((pd) => {
      pd.displayFeatures.forEach((f) => {
        map.set(
          f.id,
          computeFeatureSummary(
            f,
            settings.baselineDate,
            holidays,
            pd.project.settings.workloadUnit || settings.workloadUnit,
            pd.project.settings.hoursPerDay || settings.hoursPerDay
          )
        );
      });
    });
    return map;
  }, [filteredProjectData, settings.baselineDate, holidays, settings.workloadUnit, settings.hoursPerDay]);

  // フラットな表示行リストの構築（左テーブル、右ガントバー、イナズマ線座標用）
  const flatRows = useMemo(() => {
    const rows: FlatRow[] = [];
    let currentY = HEADER_HEIGHT + ROW_HEIGHT / 2;

    filteredProjectData.forEach((pd) => {
      if (!pd.shouldShow) return;

      const { project, displayFeatures, summary } = pd;
      const isProjectExpanded =
        expandedProjects[project.id] !== undefined ? expandedProjects[project.id] : true;

      // 「すべてのプロジェクト（横断表示）」のとき、またはプロジェクトが複数あるときはプロジェクト見出し行を表示
      if (isAllProjects || projects.length > 1) {
        rows.push({
          id: `project-${project.id}`,
          label: project.name,
          isProject: true,
          isParent: true,
          projectId: project.id,
          project,
          projectSummary: summary,
          y: currentY,
        });
        currentY += ROW_HEIGHT;
      }

      // プロジェクトが開いている場合に配下の機能を展開
      if (!isAllProjects || isProjectExpanded) {
        displayFeatures.forEach((feature) => {
          const featSummary = featureSummaries.get(feature.id);
          rows.push({
            id: feature.id,
            label: feature.name,
            isProject: false,
            isParent: true,
            projectId: project.id,
            project,
            feature,
            summary: featSummary,
            y: currentY,
          });
          currentY += ROW_HEIGHT;

          if (feature.isExpanded) {
            feature.processes.forEach((proc) => {
              rows.push({
                id: proc.id,
                label: proc.processType,
                isProject: false,
                isParent: false,
                projectId: project.id,
                project,
                feature,
                process: proc,
                y: currentY,
              });
              currentY += ROW_HEIGHT;
            });
          }
        });
      }
    });

    return rows;
  }, [filteredProjectData, expandedProjects, isAllProjects, projects.length, featureSummaries]);

  // イナズマ線ポイントの算出（工程行ベース）
  const lightningPoints = useMemo(() => {
    if (!settings.showLightningLine) return [];
    // computeLightningPoints は flatRows の各タスクに対して計算
    return computeLightningPoints(flatRows as any, settings.baselineDate, holidays);
  }, [flatRows, settings.baselineDate, settings.showLightningLine, holidays]);

  // 日付文字列 -> カレンダーX座標（px）の変換
  const getXByDate = (dateStr: string): number => {
    const index = calendarDays.indexOf(dateStr);
    if (index === -1) {
      if (dateStr < minDate) return 0;
      if (dateStr > maxDate) return calendarDays.length * CELL_WIDTH;
      return 0;
    }
    return index * CELL_WIDTH;
  };

  // 基準日（今日）のX座標
  const baselineX = useMemo(() => {
    const idx = calendarDays.indexOf(settings.baselineDate);
    if (idx === -1) return null;
    return idx * CELL_WIDTH + CELL_WIDTH / 2;
  }, [calendarDays, settings.baselineDate, CELL_WIDTH]);

  // 初期ロード時およびズーム変更時に基準日（今日）付近へ横スクロール
  useEffect(() => {
    if (calendarScrollRef.current) {
      if (baselineX !== null) {
        const containerWidth = calendarScrollRef.current.clientWidth;
        calendarScrollRef.current.scrollLeft = Math.max(0, baselineX - containerWidth / 3);
      }
    }
  }, [baselineX, CELL_WIDTH]);

  const scrollSourceRef = useRef<'left' | 'right' | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  const registerScrollSource = (source: 'left' | 'right') => {
    if (scrollSourceRef.current === null) {
      scrollSourceRef.current = source;
    }
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = window.setTimeout(() => {
      scrollSourceRef.current = null;
    }, 80);
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // 左右ペインの縦スクロール同期 ＆ 横スクロール位置追跡
  const handleScrollLeft = (e: React.UIEvent<HTMLDivElement>) => {
    if (scrollSourceRef.current === 'right') return;
    registerScrollSource('left');
    if (calendarScrollRef.current) {
      calendarScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleScrollRight = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (scrollSourceRef.current === 'left') return;
    registerScrollSource('right');
    if (leftTableScrollRef.current) {
      leftTableScrollRef.current.scrollTop = target.scrollTop;
    }
  };

  // イナズマ線のSVG Path文字列構築
  const lightningPathData = useMemo(() => {
    if (lightningPoints.length === 0 || baselineX === null) return '';

    const pathSegments: string[] = [];

    // 起点：ヘッダー真下の基準日X
    pathSegments.push(`M ${baselineX} ${HEADER_HEIGHT}`);

    lightningPoints.forEach((pt) => {
      const ptX = getXByDate(pt.progressDate) + CELL_WIDTH / 2;
      pathSegments.push(`L ${ptX} ${pt.y}`);
    });

    // 終点：最後の行の下の基準日X
    const lastY =
      flatRows.length > 0 ? flatRows[flatRows.length - 1].y + ROW_HEIGHT / 2 : HEADER_HEIGHT;
    pathSegments.push(`L ${baselineX} ${lastY}`);

    return pathSegments.join(' ');
  }, [lightningPoints, baselineX, calendarDays, flatRows]);

  // 遅延部分の塗りつぶし領域ポリゴン
  const delayAreaPolygons = useMemo(() => {
    if (lightningPoints.length === 0 || baselineX === null) return [];

    const polygons: Array<{ points: string; isDelayed: boolean }> = [];

    for (let i = 0; i < lightningPoints.length - 1; i++) {
      const p1 = lightningPoints[i];
      const p2 = lightningPoints[i + 1];

      const x1 = getXByDate(p1.progressDate) + CELL_WIDTH / 2;
      const x2 = getXByDate(p2.progressDate) + CELL_WIDTH / 2;

      // 基準日より左（遅延）かどうか
      const isDelayed = x1 < baselineX || x2 < baselineX;
      if (isDelayed) {
        polygons.push({
          points: `${baselineX},${p1.y} ${x1},${p1.y} ${x2},${p2.y} ${baselineX},${p2.y}`,
          isDelayed: true,
        });
      }
    }

    return polygons;
  }, [lightningPoints, baselineX, calendarDays]);

  // プロジェクト展開トグル
  const handleToggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: prev[projectId] !== undefined ? !prev[projectId] : false,
    }));
  };

  const totalHitsCount = flatRows.filter((r) => !r.isParent).length;

  // 表示対象の総Step数および全体生産性の計算
  const { totalVisibleSteps, overallActualProductivity, overallPlannedProductivity } = useMemo(() => {
    let steps = 0;
    let totalActualW = 0;
    let totalPlannedW = 0;

    filteredProjectData.forEach((pd) => {
      if (!pd.shouldShow) return;
      pd.displayFeatures.forEach((f) => {
        if (f.stepCount !== undefined && f.stepCount !== null && !isNaN(Number(f.stepCount))) {
          steps += Math.max(0, Number(f.stepCount));
        }
        (f.processes || []).forEach((p) => {
          totalActualW += Number(p.actualWorkload) || 0;
          totalPlannedW += Number(p.plannedWorkload) || 0;
        });
      });
    });

    const roundedActual = Math.round(totalActualW * 10) / 10;
    const roundedPlanned = Math.round(totalPlannedW * 10) / 10;

    const actualProd = steps > 0 && roundedActual > 0 ? Math.round((steps / roundedActual) * 10) / 10 : undefined;
    const plannedProd = steps > 0 && roundedPlanned > 0 ? Math.round((steps / roundedPlanned) * 10) / 10 : undefined;

    return {
      totalVisibleSteps: steps,
      overallActualProductivity: actualProd,
      overallPlannedProductivity: plannedProd,
    };
  }, [filteredProjectData]);

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden min-h-0 h-full">
      {/* =========================================================================
          最上部：スケジュール表示設定バー（ズーム切替）
         ========================================================================= */}
      <div className="bg-slate-50 border-b border-slate-300 px-4 py-1.5 flex items-center justify-between gap-3 z-20 text-xs shadow-2xs">
        {/* 左側: ガイド情報 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-700">WBS進捗管理</span>
          <span className="text-slate-400">|</span>
          <span className="text-[11px] text-slate-600 font-medium">
            全 <strong className="text-slate-800 font-mono">{totalHitsCount}</strong> 工程
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-[11px] text-slate-600 font-medium" title="表示対象機能の総Step数（開発規模）">
            総Step数: <strong className="text-indigo-700 font-mono font-bold">{totalVisibleSteps > 0 ? totalVisibleSteps.toLocaleString() : '-'}</strong> {totalVisibleSteps > 0 ? 'Step' : ''}
          </span>
          <span className="text-slate-300">•</span>
          <span
            className="text-[11px] text-slate-600 font-medium"
            title={
              totalVisibleSteps > 0
                ? `全体生産性 (Step/${settings.workloadUnit}): 実績 ${overallActualProductivity ?? '-'} / 予定 ${overallPlannedProductivity ?? '-'}`
                : 'Step数未入力'
            }
          >
            全体生産性: <strong className="text-emerald-700 font-mono font-bold">
              {overallActualProductivity !== undefined
                ? `${overallActualProductivity} Step/${settings.workloadUnit}`
                : overallPlannedProductivity !== undefined
                ? `(予)${overallPlannedProductivity} Step/${settings.workloadUnit}`
                : '-'}
            </strong>
          </span>
        </div>

        {/* 右側: ズーム切替（縮小・標準・拡大） */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-500 font-medium">表示幅:</span>
          <div className="inline-flex rounded-md shadow-2xs border border-slate-300 bg-white p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setZoomLevel('compact')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                zoomLevel === 'compact'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="縮小表示（全体を見渡す・1日24px）"
            >
              縮小
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel('normal')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                zoomLevel === 'normal'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="標準表示（1日34px）"
            >
              標準
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel('wide')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                zoomLevel === 'wide'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="拡大表示（詳細を確認・1日46px）"
            >
              拡大
            </button>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`flex-1 flex overflow-hidden border-b border-slate-200 relative min-h-0 ${
          isDraggingDivider ? 'select-none cursor-col-resize' : ''
        }`}
      >
        {/* =========================================================================
            左側：スプレッドシート型グリッド（幅可変）
           ========================================================================= */}
        <div
          ref={leftTableScrollRef}
          onScroll={handleScrollLeft}
          onMouseEnter={() => {
            scrollSourceRef.current = 'left';
          }}
          style={{ width: `${leftPaneWidth}px` }}
          className="shrink-0 overflow-y-auto overflow-x-auto bg-white z-10 shadow-xs h-full"
        >
            {/* 担当者フィルター適用時のインフォバー */}
            {assigneeFilter && (
              <div className="bg-indigo-50 border-b border-indigo-200 px-3 py-1.5 text-xs flex items-center justify-between text-indigo-900 sticky top-0 z-30 shadow-2xs">
                <span className="font-medium flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    複数プロジェクト横断 担当者絞り込み: 「<span className="font-bold">{assigneeFilter}</span>」
                  </span>
                  <span className="text-indigo-600 bg-indigo-100/80 px-2 py-0.5 rounded-full font-mono text-[11px] font-bold">
                    {totalHitsCount} 工程
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleFilterChange('')}
                  className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer text-[11px]"
                >
                  フィルター解除
                </button>
              </div>
            )}

            {/* 個別プロジェクト絞り込み表示時のインフォバー（他プロジェクト非表示中のお知らせ） */}
            {!isAllProjects && projects.length > 1 && (
              <div className="bg-slate-800 text-slate-200 border-b border-slate-700 px-3 py-1.5 text-xs flex items-center justify-between sticky top-0 z-30 shadow-2xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <FolderKanban className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>
                    個別表示中: <strong className="text-white">{targetProjects[0]?.name || '選択中のプロジェクト'}</strong>
                    <span className="text-slate-400 ml-1.5">（他 {projects.length - 1} 件のプロジェクトは非表示中）</span>
                  </span>
                </span>
                {onSelectProject && (
                  <button
                    type="button"
                    onClick={() => onSelectProject('all')}
                    className="text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer text-[11px] whitespace-nowrap ml-2"
                  >
                    すべてのプロジェクト（全{projects.length}件）を表示
                  </button>
                )}
              </div>
            )}

            <table className="w-full text-xs text-left border-collapse border-spacing-0">
              {/* テーブルヘッダー */}
              <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-xs border-b border-slate-300 shadow-2xs">
                <tr style={{ height: `${HEADER_HEIGHT}px` }}>
                  <th className="px-2.5 py-1.5 font-bold text-slate-700 w-56 border-r border-slate-200">
                    <span>プロジェクト / 機能 / 工程</span>
                  </th>
                {/* 担当者列（選択方式フィルター） */}
                <th className="px-1.5 py-1 font-bold text-slate-700 w-32 border-r border-slate-200 text-center">
                  <div className="flex flex-col items-center gap-1 justify-center">
                    <span className="text-[11px] leading-tight">担当者</span>
                    <div className="relative w-full">
                      <select
                        value={assigneeFilter}
                        onChange={(e) => handleFilterChange(e.target.value)}
                        className={`w-full bg-white border rounded px-1 py-0.5 text-[11px] font-medium text-slate-800 focus:outline-hidden transition-all text-center cursor-pointer ${
                          assigneeFilter
                            ? 'border-indigo-500 ring-1 ring-indigo-400 bg-indigo-50 font-bold text-indigo-900'
                            : 'border-slate-300 hover:border-slate-400'
                        }`}
                        title="担当者マスタから選択して全プロジェクト横断絞り込み"
                      >
                        <option value="">全担当者 (すべて)</option>
                        {filterCandidates.masterMembers.length > 0 && (
                          <optgroup label="担当者マスタ">
                            {filterCandidates.masterMembers.map((m) => (
                              <option key={m.id} value={m.name}>
                                {m.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {filterCandidates.others.length > 0 && (
                          <optgroup label="その他アサイン">
                            {filterCandidates.others.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  </div>
                </th>
                <th className="px-2 py-2 font-bold text-slate-700 w-24 border-r border-slate-200 text-right">
                  <div className="flex flex-col items-end justify-center leading-tight">
                    <span>Step数</span>
                    <span className="text-[10px] font-normal text-slate-400">規模</span>
                  </div>
                </th>
                <th className="px-2 py-2 font-bold text-slate-700 w-16 border-r border-slate-200 text-right">
                  予定({settings.workloadUnit})
                </th>
                <th className="px-2 py-2 font-bold text-slate-700 w-16 border-r border-slate-200 text-right">
                  実績({settings.workloadUnit})
                </th>
                <th className="px-2 py-2 font-bold text-slate-700 w-28 border-r border-slate-200 text-right">
                  <div className="flex flex-col items-end justify-center leading-tight">
                    <span>生産性</span>
                    <span className="text-[10px] font-normal text-slate-400">Step/{settings.workloadUnit}</span>
                  </div>
                </th>
                <th className="px-2 py-2 font-bold text-slate-700 w-36 border-r border-slate-200 text-center">
                  <div className="flex flex-col items-center justify-center leading-tight">
                    <span>期間</span>
                    <span className="text-[10px] font-normal text-slate-500">開始 / 終了</span>
                  </div>
                </th>
                <th className="px-1.5 py-2 font-bold text-slate-700 w-12 border-r border-slate-200 text-center">
                  稼働日
                </th>
                <th className="px-2 py-2 font-bold text-slate-700 w-38 border-r border-slate-200 text-center">
                  <div className="flex flex-col items-center justify-center leading-tight">
                    <span>進捗率</span>
                    <span className="text-[10px] font-normal text-slate-500">予定 / 実績</span>
                  </div>
                </th>
                <th className="px-2 py-2 font-bold text-slate-700 w-22 border-r border-slate-200 text-center">
                  状況
                </th>
                <th className="px-2 py-2 font-bold text-slate-700 w-44 min-w-[140px] border-r border-slate-200 text-left">
                  備考
                </th>
                <th className="px-1.5 py-2 font-bold text-slate-500 w-12 text-center">
                  {isAllProjects && onAutoScheduleAllProjects ? (
                    <button
                      type="button"
                      onClick={onAutoScheduleAllProjects}
                      className="inline-flex items-center justify-center p-1 rounded bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-xs transition-colors"
                      title="全プロジェクト横断一括自動リスケジュール（複数プロジェクトに跨る同一担当者の1人1日8h上限・会議枠を厳密に考慮し全日程を自動再編成）"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                    </button>
                  ) : (
                    '操作'
                  )}
                </th>
              </tr>
            </thead>

            {/* テーブルボディ */}
            <tbody className="divide-y divide-slate-200">
              {flatRows.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500 bg-slate-50/50">
                    <p className="text-sm font-medium">
                      {assigneeFilter
                        ? `担当者「${assigneeFilter}」に一致する工程はありません`
                        : '表示対象のプロジェクトまたはタスクがありません'}
                    </p>
                    {assigneeFilter && (
                      <button
                        type="button"
                        onClick={() => handleFilterChange('')}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 underline font-medium cursor-pointer"
                      >
                        フィルターを解除して全件表示
                      </button>
                    )}
                  </td>
                </tr>
              )}

              {flatRows.map((row) => {
                // 1. プロジェクト見出し行
                if (row.isProject && row.project && row.projectSummary) {
                  const proj = row.project;
                  const pSum = row.projectSummary;
                  const isExpanded =
                    expandedProjects[proj.id] !== undefined ? expandedProjects[proj.id] : true;

                  return (
                    <tr
                      key={row.id}
                      style={{ height: `${ROW_HEIGHT}px` }}
                      className="bg-slate-800 text-white font-semibold hover:bg-slate-750 transition-colors border-t-2 border-indigo-500"
                    >
                      {/* プロジェクト名 ＆ 開閉トグル */}
                      <td className="px-3 py-1.5 border-r border-slate-700 align-middle">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleProject(proj.id)}
                            className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700 cursor-pointer"
                            title={isExpanded ? 'プロジェクトを折りたたむ' : 'プロジェクトを展開する'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-indigo-300" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-indigo-300" />
                            )}
                          </button>
                          <FolderKanban className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span className="truncate font-bold text-white text-xs tracking-tight" title={proj.name}>
                            {proj.name}
                          </span>
                          {proj.estimateNumber ? (
                            <span
                              className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-200 border border-indigo-500/70 font-mono text-[10px]"
                              title={`見積連携済: ${proj.estimateNumber} (${proj.estimateTitle || proj.name})`}
                            >
                              🏷️ {proj.estimateNumber}
                            </span>
                          ) : (
                            <span
                              className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-600/70 text-[10px]"
                              title="見積未連携（単体登録プロジェクト）"
                            >
                              ⚠️ 見積未連携
                            </span>
                          )}
                        </div>
                      </td>

                      {/* プロジェクト管理者 */}
                      <td className="px-1.5 py-1.5 border-r border-slate-700 text-center align-middle">
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 text-[10px] font-normal truncate max-w-[90px]">
                          <User className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          <span className="truncate">{proj.manager || '未設定'}</span>
                        </span>
                      </td>

                      {/* プロジェクト総Step数 */}
                      <td className="px-2 py-1.5 border-r border-slate-700 text-right font-mono font-bold text-indigo-300 align-middle">
                        {pSum.totalStepCount > 0 ? (
                          <span title={`プロジェクト「${proj.name}」の総Step数: ${pSum.totalStepCount.toLocaleString()} Step`}>
                            {pSum.totalStepCount.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-normal">-</span>
                        )}
                      </td>

                      {/* 予定工数合計 */}
                      <td className="px-2 py-1.5 border-r border-slate-700 text-right font-mono font-bold text-slate-100 align-middle">
                        {pSum.totalPlannedWorkload}
                      </td>

                      {/* 実績工数合計 */}
                      <td className="px-2 py-1.5 border-r border-slate-700 text-right font-mono font-bold text-slate-100 align-middle">
                        {pSum.totalActualWorkload}
                      </td>

                      {/* プロジェクト生産性 */}
                      <td className="px-2 py-1.5 border-r border-slate-700 text-right align-middle">
                        {pSum.totalStepCount > 0 ? (
                          <div className="flex flex-col items-end justify-center leading-tight font-mono">
                            {pSum.actualProductivity !== undefined ? (
                              <>
                                <span className="font-bold text-emerald-300 text-xs">
                                  {pSum.actualProductivity}
                                </span>
                                {pSum.plannedProductivity !== undefined && (
                                  <span className="text-[9px] text-slate-400">
                                    (予: {pSum.plannedProductivity})
                                  </span>
                                )}
                              </>
                            ) : pSum.plannedProductivity !== undefined ? (
                              <span className="text-indigo-200 text-xs">
                                <span className="text-[9px] text-indigo-400 mr-0.5">予</span>
                                {pSum.plannedProductivity}
                              </span>
                            ) : (
                              <span className="text-slate-500 font-normal text-xs">-</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 font-normal text-xs">-</span>
                        )}
                      </td>

                      {/* 期間（開始 / 終了） */}
                      <td className="px-2 py-1 border-r border-slate-700 align-middle">
                        <div className="flex flex-col gap-0.5 justify-center text-[10px] font-mono text-slate-300">
                          <div className="flex items-center gap-1">
                            <span className="px-1 py-0.2 rounded bg-slate-700 text-slate-300 text-[9px]">始</span>
                            <span>{pSum.earliestStartDate || '-'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="px-1 py-0.2 rounded bg-slate-700 text-slate-300 text-[9px]">終</span>
                            <span>{pSum.latestEndDate || '-'}</span>
                          </div>
                        </div>
                      </td>

                      {/* 総稼働日 */}
                      <td className="px-1.5 py-1.5 border-r border-slate-700 text-center font-mono text-[11px] text-slate-300 align-middle">
                        {pSum.totalWorkingDays ? `${pSum.totalWorkingDays}日` : '-'}
                      </td>

                      {/* 進捗率（予定 / 実績） */}
                      <td className="px-2 py-1 border-r border-slate-700 align-middle">
                        <div className="flex flex-col gap-1 justify-center">
                          {/* 予定 */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-900 text-indigo-300 font-semibold shrink-0">
                              予
                            </span>
                            <div className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-indigo-400 h-full rounded-full"
                                style={{ width: `${pSum.plannedProgress}%` }}
                              ></div>
                            </div>
                            <span className="font-mono font-bold text-indigo-300 text-[11px] w-8 text-right shrink-0">
                              {pSum.plannedProgress}%
                            </span>
                          </div>
                          {/* 実績 */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-900 text-emerald-300 font-semibold shrink-0">
                              実
                            </span>
                            <div className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-400 h-full rounded-full"
                                style={{ width: `${pSum.actualProgress}%` }}
                              ></div>
                            </div>
                            <span className="font-mono font-bold text-emerald-300 text-[11px] w-8 text-right shrink-0">
                              {pSum.actualProgress}%
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 状況 */}
                      <td className="px-2 py-1.5 border-r border-slate-700 text-center align-middle">
                        {pSum.status === 'completed' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-900/80 border border-emerald-700 text-emerald-200 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>完了</span>
                          </span>
                        )}
                        {pSum.status === 'delayed' && (
                          <span className="inline-flex flex-col items-center justify-center px-1.5 py-0.5 rounded bg-rose-900/80 border border-rose-700 text-rose-200 text-[10px] font-bold leading-tight">
                            <span className="flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                              <span>遅延</span>
                            </span>
                            <span className="font-mono text-[9px] text-rose-300">
                              -{pSum.delayManDays > 0 ? pSum.delayManDays : '0.1'}人日
                            </span>
                          </span>
                        )}
                        {pSum.status === 'on_track' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-900/80 border border-blue-700 text-blue-200 text-[10px] font-bold">
                            <Check className="w-3 h-3 text-blue-400" />
                            <span>順調</span>
                          </span>
                        )}
                        {pSum.status === 'not_started' && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px]">
                            未着手
                          </span>
                        )}
                      </td>

                      {/* 備考 */}
                      <td className="px-2 py-1.5 border-r border-slate-700 text-slate-400 text-[10px] truncate max-w-[150px] align-middle" title={proj.description || ''}>
                        {proj.description || '-'}
                      </td>

                      {/* 操作 */}
                      <td className="px-1.5 py-1.5 text-center text-slate-300 text-[10px] align-middle">
                        <div className="flex items-center justify-center gap-1">
                          {onAutoScheduleAll && (
                            <button
                              type="button"
                              onClick={() => onAutoScheduleAll(proj)}
                              className="p-1 hover:bg-amber-600 rounded text-amber-300 hover:text-white cursor-pointer transition-colors"
                              title="プロジェクト全体の全工程を一括自動リスケ（他プロジェクトの同一担当者稼働枠も含め1人1日8h・会議枠を考慮して自動計算）"
                            >
                              <Zap className="w-3 h-3" />
                            </button>
                          )}
                          {onOpenEditProject && (
                            <button
                              type="button"
                              onClick={() => onOpenEditProject(proj)}
                              className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white cursor-pointer"
                              title="プロジェクト設定を編集"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                          {onOpenAddFeature && (
                            <button
                              type="button"
                              onClick={() => onOpenAddFeature(proj.id)}
                              className="p-1 hover:bg-slate-700 rounded text-indigo-300 hover:text-white cursor-pointer"
                              title="このプロジェクトに機能を追加"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }

                // 2. 機能行 (Feature)
                if (row.isParent && !row.isProject && row.feature) {
                  const feature = row.feature;
                  const summary = row.summary;

                  return (
                    <tr
                      key={row.id}
                      style={{ height: `${ROW_HEIGHT}px` }}
                      className="bg-slate-100/90 hover:bg-slate-200/70 font-semibold text-slate-900 transition-colors"
                    >
                      {/* 機能名 & 開閉トグル */}
                      <td className="px-3 py-1.5 border-r border-slate-200 align-middle">
                        <div className="flex items-center gap-1.5 pl-3">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateFeature(row.projectId, feature.id, {
                                isExpanded: !feature.isExpanded,
                              })
                            }
                            className="p-0.5 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
                          >
                            {feature.isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span className="truncate font-bold text-slate-900" title={feature.name}>
                            {feature.name}
                          </span>
                          {feature.category && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-normal shrink-0">
                              {feature.category}
                            </span>
                          )}
                          {feature.estimateFeatureId ? (
                            <span
                              className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 border border-purple-200 font-semibold shrink-0"
                              title="見積管理から連携された機能"
                            >
                              見積連携
                            </span>
                          ) : (
                            <span
                              className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-normal shrink-0"
                              title="進捗管理で単体追加された機能"
                            >
                              単体登録
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 担当者 */}
                      <td className="px-2 py-1.5 border-r border-slate-200 text-center text-slate-400 text-[11px] align-middle">
                        -
                      </td>

                      {/* 機能Step数入力 */}
                      <td className="px-1.5 py-1 border-r border-slate-200 text-right align-middle">
                        <div className="flex items-center justify-end">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={feature.stepCount !== undefined && feature.stepCount !== null ? feature.stepCount : ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0);
                              onUpdateFeature(row.projectId, feature.id, { stepCount: val });
                            }}
                            placeholder="Step数"
                            className="w-20 px-1.5 py-0.5 text-right font-mono text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded hover:border-indigo-400 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500 transition-colors"
                            title="機能のStep数（行数）を入力"
                          />
                        </div>
                      </td>

                      {/* 予定工数合計 */}
                      <td className="px-2 py-1.5 border-r border-slate-200 text-right font-mono font-bold text-slate-800 align-middle">
                        {summary?.totalPlannedWorkload ?? 0}
                      </td>

                      {/* 実績工数合計 */}
                      <td className="px-2 py-1.5 border-r border-slate-200 text-right font-mono font-bold text-slate-800 align-middle">
                        {summary?.totalActualWorkload ?? 0}
                      </td>

                      {/* 機能生産性表示 */}
                      <td className="px-2 py-1.5 border-r border-slate-200 text-right align-middle">
                        {feature.stepCount && feature.stepCount > 0 ? (
                          <div className="flex flex-col items-end justify-center leading-tight font-mono">
                            {summary?.actualProductivity !== undefined ? (
                              <>
                                <span className="font-bold text-emerald-700 text-xs">
                                  {summary.actualProductivity}
                                </span>
                                {summary.plannedProductivity !== undefined && (
                                  <span className="text-[9px] text-slate-400">
                                    (予: {summary.plannedProductivity})
                                  </span>
                                )}
                              </>
                            ) : summary?.plannedProductivity !== undefined ? (
                              <span className="text-slate-600 text-xs">
                                <span className="text-[9px] text-indigo-600 font-semibold mr-0.5">予</span>
                                {summary.plannedProductivity}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* 期間（開始日 / 終了日を1列で上下表示） */}
                      <td className="px-2 py-1 border-r border-slate-200 align-middle">
                        <div className="flex flex-col gap-1 justify-center">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 text-slate-600 font-semibold shrink-0">
                              始
                            </span>
                            <span className="font-mono text-[11px] text-slate-700 font-medium">
                              {summary?.earliestStartDate || '-'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 text-slate-600 font-semibold shrink-0">
                              終
                            </span>
                            <span className="font-mono text-[11px] text-slate-700 font-medium">
                              {summary?.latestEndDate || '-'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 総稼働日数 */}
                      <td className="px-1.5 py-1.5 border-r border-slate-200 text-center font-mono text-[11px] text-slate-600 align-middle">
                        {summary?.totalWorkingDays ? `${summary.totalWorkingDays}日` : '-'}
                      </td>

                      {/* 進捗率（予定進捗 / 実績進捗を1列で上下表示） */}
                      <td className="px-2 py-1 border-r border-slate-200 align-middle">
                        <div className="flex flex-col gap-1 justify-center">
                          {/* 上段：予定進捗率 */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-100 text-indigo-700 font-semibold shrink-0">
                              予
                            </span>
                            <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-indigo-600 h-full rounded-full transition-all"
                                style={{ width: `${summary?.averagePlannedProgress ?? 0}%` }}
                              ></div>
                            </div>
                            <span className="font-mono font-bold text-indigo-700 text-[11px] w-8 text-right shrink-0">
                              {summary?.averagePlannedProgress ?? 0}%
                            </span>
                          </div>

                          {/* 下段：実績進捗率 */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold shrink-0">
                              実
                            </span>
                            <div className="flex-1 bg-emerald-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-600 h-full rounded-full transition-all"
                                style={{ width: `${summary?.averageActualProgress ?? 0}%` }}
                              ></div>
                            </div>
                            <span className="font-mono font-bold text-emerald-800 text-[11px] w-8 text-right shrink-0">
                              {summary?.averageActualProgress ?? 0}%
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 状況バッジ */}
                      <td className="px-2 py-1.5 border-r border-slate-200 text-center align-middle">
                        {summary?.status === 'completed' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                            完了
                          </span>
                        )}
                        {summary?.status === 'delayed' && (
                          <span
                            className="inline-flex flex-col items-center justify-center px-1.5 py-0.5 rounded bg-rose-100 border border-rose-200 text-rose-800 text-[10px] font-bold leading-tight shadow-2xs"
                            title={`機能遅延工数: -${settings.workloadUnit === '人時' ? Math.round(summary.totalDelayManDays * 8 * 10) / 10 + '時間' : summary.totalDelayManDays + '人日'}`}
                          >
                            <span className="flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                              <span>遅延</span>
                            </span>
                            <span className="font-mono text-[9px] text-rose-700 whitespace-nowrap">
                              -{settings.workloadUnit === '人時'
                                ? (summary.totalDelayManDays > 0 ? Math.round(summary.totalDelayManDays * 8 * 10) / 10 : 1) + 'h'
                                : (summary.totalDelayManDays > 0 ? summary.totalDelayManDays : 0.1) + '日'}
                            </span>
                          </span>
                        )}
                        {summary?.status === 'on_track' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium">
                            順調
                          </span>
                        )}
                        {summary?.status === 'not_started' && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px]">
                            未着手
                          </span>
                        )}
                      </td>

                      {/* 備考 */}
                      <td className="px-2 py-1.5 border-r border-slate-200 text-center text-slate-400 text-[10px] align-middle">
                        -
                      </td>

                      {/* 操作 */}
                      <td className="px-1.5 py-1.5 text-center text-slate-400 text-[10px] align-middle">
                        <div className="flex items-center justify-center gap-1">
                          {(onAutoSchedule || onOpenAutoSchedule) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const proj = projects.find((p) => p.id === row.projectId) || projects[0];
                                if (onAutoSchedule) {
                                  onAutoSchedule(feature, proj);
                                } else if (onOpenAutoSchedule) {
                                  onOpenAutoSchedule(feature, proj);
                                }
                              }}
                              className="p-1 hover:bg-amber-100 hover:text-amber-700 text-amber-600 rounded transition-colors cursor-pointer"
                              title="各工程の工数は固定のまま、他プロジェクト含む担当者の残枠から自動リスケジュール（即時反映・別画面なし）"
                            >
                              <Zap className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onAddProcess && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onAddProcess(row.projectId, feature.id);
                              }}
                              className="p-1 hover:bg-indigo-100 hover:text-indigo-700 text-indigo-600 rounded transition-colors cursor-pointer"
                              title="この機能に新しい工程を1件追加"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteFeature(row.projectId, feature.id);
                            }}
                            className="p-1 hover:bg-rose-100 hover:text-rose-700 rounded transition-colors cursor-pointer text-slate-400 hover:text-rose-600"
                            title="機能を削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // 3. 各工程行 (TaskProcess)
                if (!row.isParent && !row.isProject && row.feature && row.process) {
                  const feature = row.feature;
                  const proc = row.process;
                  const stats = calculateProcessStats(
                    proc.startDate,
                    proc.endDate,
                    proc.actualProgress,
                    settings.baselineDate,
                    holidays
                  );

                  return (
                    <tr
                      key={row.id}
                      style={{ height: `${ROW_HEIGHT}px` }}
                      className="hover:bg-indigo-50/30 transition-colors bg-white group text-slate-800"
                    >
                      {/* 工程名（直接テキスト編集＆候補サジェスト） */}
                      <td className="px-2 py-1 border-r border-slate-200 align-middle">
                        <div className="flex items-center gap-1 pl-6">
                          <CornerDownRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <input
                            type="text"
                            list="wbs-process-suggestions"
                            value={proc.processType}
                            onChange={(e) =>
                              onUpdateProcess(row.projectId, feature.id, proc.id, {
                                processType: e.target.value,
                              })
                            }
                            className="w-full bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded px-1.5 py-0.5 text-xs font-medium text-slate-800 focus:outline-hidden"
                            placeholder="工程名"
                            title="工程名を編集（候補から選択または直接入力）"
                          />
                        </div>
                      </td>

                      {/* 担当者セレクト（担当者マスタ連動: 課長・主任・担当・研修生） */}
                      <td className="px-1 py-1 border-r border-slate-200 text-center align-middle">
                        <select
                          value={proc.assignee || ''}
                          onChange={(e) => {
                            const newAssignee = e.target.value;
                            const targetProj = projects.find((p) => p.id === row.projectId) || projects[0];
                            const newEndDate = calculateAutoEndDateForProcess(
                              proc.startDate,
                              proc.plannedWorkload,
                              newAssignee,
                              proc.id,
                              targetProj?.features || [],
                              targetProj?.holidays || holidays,
                              members,
                              settings.workloadUnit,
                              settings.hoursPerDay,
                              settings.weeklyMeetingHours
                            );
                            onUpdateProcess(row.projectId, feature.id, proc.id, {
                              assignee: newAssignee,
                              endDate: newEndDate,
                            });
                          }}
                          className="w-full bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded px-1 py-0.5 text-xs text-center text-slate-800 focus:outline-hidden font-medium cursor-pointer"
                          title={
                            proc.assignee
                              ? `${proc.assignee} (実稼働: ${members?.find((m) => m.name === proc.assignee)?.dailyWorkingHours ?? 8}h/日)`
                              : '工程担当者を選択'
                          }
                        >
                          <option value="">(未設定)</option>
                          {proc.assignee && !eligibleAssignees.some((m) => m.name === proc.assignee) && (
                            <option value={proc.assignee}>{proc.assignee} (現在の設定)</option>
                          )}
                          {eligibleAssignees.map((m) => (
                            <option key={m.id} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Step数（工程は機能単位集計のため - 表示） */}
                      <td className="px-2 py-1 border-r border-slate-200 text-center text-slate-300 text-xs font-mono align-middle">
                        -
                      </td>

                      {/* 予定工数 */}
                      <td className="px-1 py-1 border-r border-slate-200 text-right align-middle">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={proc.plannedWorkload}
                          onChange={(e) => {
                            const newWorkload = Math.max(0, parseFloat(e.target.value) || 0);
                            const targetProj = projects.find((p) => p.id === row.projectId) || projects[0];
                            const newEndDate = calculateAutoEndDateForProcess(
                              proc.startDate,
                              newWorkload,
                              proc.assignee,
                              proc.id,
                              targetProj?.features || [],
                              targetProj?.holidays || holidays,
                              members,
                              settings.workloadUnit,
                              settings.hoursPerDay,
                              settings.weeklyMeetingHours
                            );
                            onUpdateProcess(row.projectId, feature.id, proc.id, {
                              plannedWorkload: newWorkload,
                              endDate: newEndDate,
                            });
                          }}
                          className="w-full bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded px-1 py-0.5 text-xs font-mono text-right text-slate-800 focus:outline-hidden"
                        />
                      </td>

                      {/* 実績工数 */}
                      <td className="px-1 py-1 border-r border-slate-200 text-right align-middle">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={proc.actualWorkload}
                          onChange={(e) =>
                            onUpdateProcess(row.projectId, feature.id, proc.id, {
                              actualWorkload: Math.max(0, parseFloat(e.target.value) || 0),
                            })
                          }
                          className="w-full bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded px-1 py-0.5 text-xs font-mono text-right text-slate-800 focus:outline-hidden"
                        />
                      </td>

                      {/* 生産性（工程は機能単位集計のため - 表示） */}
                      <td className="px-2 py-1 border-r border-slate-200 text-center text-slate-300 text-xs font-mono align-middle">
                        -
                      </td>

                      {/* 期間（開始予定日 / 終了予定日を1列で上下表示） */}
                      <td className="px-1.5 py-1 border-r border-slate-200 align-middle">
                        <div className="flex flex-col gap-1 justify-center">
                          {/* 上段：開始予定日（修正可能、終了日は自動算出） */}
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-500 font-semibold shrink-0">
                              始
                            </span>
                            <input
                              type="date"
                              value={proc.startDate}
                              onChange={(e) => {
                                const newStartDate = e.target.value;
                                const targetProj = projects.find((p) => p.id === row.projectId) || projects[0];
                                const newEndDate = calculateAutoEndDateForProcess(
                                  newStartDate,
                                  proc.plannedWorkload,
                                  proc.assignee,
                                  proc.id,
                                  targetProj?.features || [],
                                  targetProj?.holidays || holidays,
                                  members,
                                  settings.workloadUnit,
                                  settings.hoursPerDay,
                                  settings.weeklyMeetingHours
                                );
                                onUpdateProcess(row.projectId, feature.id, proc.id, {
                                  startDate: newStartDate,
                                  endDate: newEndDate,
                                });
                              }}
                              className="w-full bg-slate-50/50 hover:bg-slate-100 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded px-1 py-0.5 text-[11px] font-mono text-slate-700 focus:outline-hidden cursor-pointer"
                              title="開始予定日を変更（終了日は予定工数と会議・他工程のあまり枠から自動算出されます）"
                            />
                          </div>
                          {/* 下段：終了予定日（入力不可・自動算出） */}
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200/80 text-slate-500 font-semibold shrink-0" title="自動算出">
                              終
                            </span>
                            <input
                              type="date"
                              value={proc.endDate}
                              readOnly
                              tabIndex={-1}
                              title="終了予定日は開始日・予定工数・他工程や会議の空き枠から自動算出されます（直接入力不可）"
                              className="w-full bg-slate-100/80 border border-slate-200 text-slate-500 rounded px-1 py-0.5 text-[11px] font-mono cursor-not-allowed select-none focus:outline-hidden"
                            />
                          </div>
                        </div>
                      </td>

                      {/* 稼働日数 (自動計算) */}
                      <td className="px-1 py-1.5 border-r border-slate-200 text-center font-mono text-[11px] text-slate-600 align-middle">
                        {stats.totalPlannedDays}日
                      </td>

                      {/* 進捗率（予定進捗 / 実績進捗を1列で上下表示） */}
                      <td className="px-2 py-1 border-r border-slate-200 align-middle">
                        <div className="flex flex-col gap-1 justify-center">
                          {/* 上段：自動計算される予定進捗率 */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 font-semibold shrink-0">
                              予
                            </span>
                            <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-indigo-600 h-full rounded-full"
                                style={{ width: `${stats.plannedProgress}%` }}
                              ></div>
                            </div>
                            <span className="font-mono text-indigo-700 font-bold text-[11px] w-8 text-right shrink-0">
                              {stats.plannedProgress}%
                            </span>
                          </div>

                          {/* 下段：実績進捗率 (自由な数字を直接入力) */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold shrink-0">
                              実
                            </span>
                            <div className="flex items-center gap-1 flex-1 justify-end">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={proc.actualProgress}
                                onChange={(e) => {
                                  const val = Math.min(
                                    100,
                                    Math.max(0, parseInt(e.target.value, 10) || 0)
                                  );
                                  onUpdateProcess(row.projectId, feature.id, proc.id, {
                                    actualProgress: val,
                                  });
                                }}
                                className="w-12 bg-white border border-emerald-300 hover:border-emerald-500 focus:border-emerald-600 rounded px-1 py-0.5 text-xs font-mono font-bold text-emerald-800 text-right focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                              />
                              <span className="text-[11px] font-bold text-emerald-800">%</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 進捗状況 */}
                      <td className="px-2 py-1.5 border-r border-slate-200 text-center align-middle">
                        {stats.status === 'completed' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                            完了
                          </span>
                        )}
                        {stats.status === 'delayed' && (() => {
                          const delayManDays = calculateDelayManDays(
                            proc.plannedWorkload,
                            stats.plannedProgress,
                            proc.actualProgress,
                            settings.workloadUnit,
                            settings.hoursPerDay
                          );
                          return (
                            <span
                              className="inline-flex flex-col items-center justify-center px-1.5 py-0.5 rounded bg-rose-100 border border-rose-200 text-rose-800 text-[10px] font-bold leading-tight shadow-2xs"
                              title={`工程遅延: 乖離${Math.abs(stats.delayRate)}% (予定:${stats.plannedProgress}% / 実績:${proc.actualProgress}%)\n遅延工数: -${delayManDays}人日`}
                            >
                              <span className="flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                <span>遅延</span>
                              </span>
                              <span className="font-mono text-[9px] text-rose-700 whitespace-nowrap">
                                -{delayManDays > 0 ? delayManDays : '0.1'}人日
                              </span>
                            </span>
                          );
                        })()}
                        {stats.status === 'on_track' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium">
                            順調
                          </span>
                        )}
                        {stats.status === 'not_started' && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px]">
                            未着手
                          </span>
                        )}
                      </td>

                      {/* 備考（手入力可能: 遅延理由やメモ） */}
                      <td className="px-1.5 py-1 border-r border-slate-200 align-middle">
                        <input
                          type="text"
                          value={proc.notes || ''}
                          onChange={(e) =>
                            onUpdateProcess(row.projectId, feature.id, proc.id, {
                              notes: e.target.value,
                            })
                          }
                          placeholder="遅延理由やメモ"
                          title={proc.notes || '遅延時の理由や特記事項を入力'}
                          className="w-full bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded px-1.5 py-0.5 text-xs text-slate-700 focus:outline-hidden placeholder:text-slate-400 placeholder:italic"
                        />
                      </td>

                      {/* 操作（工程削除） */}
                      <td className="px-1.5 py-1.5 text-center text-slate-400 text-[10px] align-middle">
                        {onDeleteProcess && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteProcess(row.projectId, feature.id, proc.id);
                            }}
                            className="p-1 hover:bg-rose-100 hover:text-rose-700 rounded transition-colors cursor-pointer text-slate-400 hover:text-rose-600"
                            title="この工程を削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }

                return null;
              })}
            </tbody>
          </table>

          {/* 工程名サジェスト候補リスト */}
          <datalist id="wbs-process-suggestions">
            {COMMON_PROCESS_SUGGESTIONS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        {/* 左右ペイン可変リサイズディバイダー（中央線） */}
        <div
          onPointerDown={handleDividerPointerDown}
          onPointerMove={handleDividerPointerMove}
          onPointerUp={handleDividerPointerUp}
          onPointerCancel={handleDividerPointerUp}
          onDoubleClick={handleDividerDoubleClick}
          className={`w-2.5 shrink-0 bg-slate-200 hover:bg-indigo-400 active:bg-indigo-600 transition-colors cursor-col-resize z-20 flex items-center justify-center border-x border-slate-300 select-none group relative ${
            isDraggingDivider ? 'bg-indigo-600 ring-2 ring-indigo-300' : ''
          }`}
          title="左右にドラッグして進捗表とスケジュールの幅を調整（ダブルクリックで既定幅に切り替え）"
        >
          {/* 中央グリップインジケーター */}
          <div className="flex flex-col gap-1 items-center pointer-events-none">
            <div className={`w-1 h-1 rounded-full ${isDraggingDivider ? 'bg-white' : 'bg-slate-400 group-hover:bg-white'}`} />
            <div className={`w-1 h-1 rounded-full ${isDraggingDivider ? 'bg-white' : 'bg-slate-400 group-hover:bg-white'}`} />
            <div className={`w-1 h-1 rounded-full ${isDraggingDivider ? 'bg-white' : 'bg-slate-400 group-hover:bg-white'}`} />
            <div className={`w-1 h-1 rounded-full ${isDraggingDivider ? 'bg-white' : 'bg-slate-400 group-hover:bg-white'}`} />
          </div>

          {/* ドラッグ中の幅ツールチップ */}
          {isDraggingDivider && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-mono px-2 py-0.5 rounded shadow-md whitespace-nowrap pointer-events-none z-30">
              進捗表: {leftPaneWidth}px
            </div>
          )}
        </div>

        {/* =========================================================================
            右側：カレンダー ＆ ガントチャート ＆ イナズマ線（スクロール同期ペイン）
           ========================================================================= */}
        <div
          ref={calendarScrollRef}
          onScroll={handleScrollRight}
          onMouseEnter={() => {
            scrollSourceRef.current = 'right';
          }}
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-slate-50/40 h-full min-w-0"
        >
          <div
            className="relative"
            style={{
              width: `${calendarDays.length * CELL_WIDTH}px`,
              minHeight: `${flatRows.length * ROW_HEIGHT + HEADER_HEIGHT}px`,
            }}
          >
            {/* カレンダーヘッダー (Sticky Top) */}
            <div
              className="sticky top-0 z-20 bg-slate-100 border-b border-slate-300 shadow-2xs select-none"
              style={{ height: `${HEADER_HEIGHT}px` }}
            >
              {/* 月行 */}
              <div className="flex border-b border-slate-200 h-6 text-[11px] font-bold text-slate-700">
                {monthGroups.map((group) => (
                  <div
                    key={group.monthKey}
                    style={{ width: `${group.daysCount * CELL_WIDTH}px` }}
                    className="border-r border-slate-300 px-2 flex items-center bg-slate-100/90 truncate"
                  >
                    {group.label}
                  </div>
                ))}
              </div>

              {/* 日・曜日行 */}
              <div className="flex h-7.5">
                {calendarDays.map((d) => {
                  const dateObj = parseDate(d);
                  const dayOfWeek = dateObj.getDay(); // 0: 日, 6: 土
                  const holiday = holidays.find((h) => h.date === d);
                  const isSun = dayOfWeek === 0;
                  const isSat = dayOfWeek === 6;
                  const isHol = !!holiday;
                  const dayNum = dateObj.getDate();
                  const isToday = d === settings.baselineDate;

                  let bgClass = 'bg-white';
                  let textClass = 'text-slate-700';

                  if (isToday) {
                    bgClass = 'bg-blue-100/80';
                    textClass = 'text-blue-900 font-bold';
                  } else if (isHol) {
                    bgClass = 'bg-rose-50';
                    textClass = 'text-rose-600 font-bold';
                  } else if (isSun) {
                    bgClass = 'bg-rose-50/60';
                    textClass = 'text-rose-500 font-semibold';
                  } else if (isSat) {
                    bgClass = 'bg-blue-50/50';
                    textClass = 'text-blue-600 font-semibold';
                  }

                  const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];
                  const daySummary = dailyWorkloadMap[d];

                  return (
                    <div
                      key={d}
                      style={{ width: `${CELL_WIDTH}px` }}
                      className={`shrink-0 border-r border-slate-200 flex flex-col items-center justify-center text-[10px] ${bgClass} ${textClass} transition-colors cursor-pointer hover:bg-indigo-50/80 relative group select-none`}
                      title={buildDayTooltipText(d, daySummary)}
                      onMouseEnter={(e) => {
                        if (daySummary) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredDaySummary({
                            summary: daySummary,
                            x: rect.left,
                            y: rect.bottom + 4,
                          });
                        }
                      }}
                      onMouseMove={(e) => {
                        if (daySummary) {
                          setHoveredDaySummary((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  x: e.clientX,
                                  y: e.clientY + 14,
                                }
                              : null
                          );
                        }
                      }}
                      onMouseLeave={() => setHoveredDaySummary(null)}
                    >
                      <span className="leading-none">{dayNum}</span>
                      <span className="text-[8px] opacity-75 leading-none">
                        {dayLabels[dayOfWeek]}
                      </span>

                      {/* 稼働・会議インジケータ */}
                      {daySummary && (daySummary.meetingHours > 0 || daySummary.processes.length > 0) && (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {daySummary.meetingHours > 0 && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-2xs"
                              title={`会議: ${daySummary.meetingHours}h`}
                            />
                          )}
                          {daySummary.processes.length > 0 && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                daySummary.isOverCapacity ? 'bg-rose-500' : 'bg-indigo-500'
                              } shadow-2xs`}
                              title={`予定作業: ${daySummary.processHours}h`}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 背景グリッド縦線（土日祝・今日強調） */}
            <div className="absolute inset-0 top-[56px] flex pointer-events-none">
              {calendarDays.map((d) => {
                const dateObj = parseDate(d);
                const dayOfWeek = dateObj.getDay();
                const holiday = holidays.find((h) => h.date === d);
                const isSun = dayOfWeek === 0;
                const isSat = dayOfWeek === 6;
                const isHol = !!holiday;
                const isToday = d === settings.baselineDate;

                return (
                  <div
                    key={`grid-${d}`}
                    style={{ width: `${CELL_WIDTH}px` }}
                    className={`shrink-0 border-r border-slate-200/50 h-full ${
                      isToday
                        ? 'bg-blue-50/30'
                        : isHol || isSun
                        ? 'bg-rose-50/25'
                        : isSat
                        ? 'bg-blue-50/15'
                        : ''
                    }`}
                  ></div>
                );
              })}
            </div>

            {/* 基準日（今日）縦ライン */}
            {baselineX !== null && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-10"
                style={{ left: `${baselineX}px` }}
              >
                <div className="w-0.5 h-full bg-blue-500 shadow-sm opacity-90"></div>
                <div className="sticky top-[58px] -ml-5 px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold whitespace-nowrap shadow-xs">
                  基準日
                </div>
              </div>
            )}

            {/* 行ごとのガントバー描画 */}
            <div className="relative pt-0">
              {flatRows.map((row) => {
                // 1. プロジェクト見出し行の集約バー
                if (row.isProject && row.projectSummary) {
                  const sum = row.projectSummary;
                  if (!sum.earliestStartDate || !sum.latestEndDate) {
                    return (
                      <div
                        key={row.id}
                        style={{ height: `${ROW_HEIGHT}px` }}
                        className="border-b border-slate-700/60 bg-slate-800/90"
                      ></div>
                    );
                  }

                  const startX = getXByDate(sum.earliestStartDate);
                  const endX = getXByDate(sum.latestEndDate) + CELL_WIDTH;
                  const barWidth = Math.max(CELL_WIDTH, endX - startX);

                  return (
                    <div
                      key={row.id}
                      style={{ height: `${ROW_HEIGHT}px` }}
                      className="border-b border-slate-700/60 relative flex items-center bg-slate-800/90"
                    >
                      {/* プロジェクト帯バー */}
                      <div
                        className="absolute h-7 rounded-md bg-slate-900 border border-slate-600 text-white flex items-center shadow-md overflow-hidden"
                        style={{ left: `${startX}px`, width: `${barWidth}px` }}
                        title={`${row.label}\n期間: ${sum.earliestStartDate} 〜 ${sum.latestEndDate}\n実績: ${sum.actualProgress}%`}
                      >
                        {/* 実績進捗の進捗バー */}
                        <div
                          className="h-full bg-emerald-500/80 transition-all border-r border-emerald-400"
                          style={{ width: `${sum.actualProgress}%` }}
                        ></div>
                        <span className="absolute left-2 text-[11px] font-bold truncate tracking-tight text-white drop-shadow-xs flex items-center gap-1.5">
                          <FolderKanban className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{row.label}</span>
                          <span className="text-emerald-300 font-mono">({sum.actualProgress}%)</span>
                        </span>
                      </div>
                    </div>
                  );
                }

                // 2. 親機能行の集約バー
                if (row.isParent && !row.isProject && row.summary) {
                  const sum = row.summary;
                  if (!sum.earliestStartDate || !sum.latestEndDate) {
                    return (
                      <div
                        key={row.id}
                        style={{ height: `${ROW_HEIGHT}px` }}
                        className="border-b border-slate-200/60"
                      ></div>
                    );
                  }

                  const startX = getXByDate(sum.earliestStartDate);
                  const endX = getXByDate(sum.latestEndDate) + CELL_WIDTH;
                  const barWidth = Math.max(CELL_WIDTH, endX - startX);

                  return (
                    <div
                      key={row.id}
                      style={{ height: `${ROW_HEIGHT}px` }}
                      className="border-b border-slate-200/60 relative flex items-center"
                    >
                      {/* 親サマリーバー */}
                      <div
                        className="absolute h-6 rounded-md bg-slate-700/85 text-white flex items-center shadow-xs overflow-hidden"
                        style={{ left: `${startX}px`, width: `${barWidth}px` }}
                      >
                        {/* 実績進捗の進捗バー */}
                        <div
                          className="h-full bg-emerald-500/80 transition-all"
                          style={{ width: `${sum.averageActualProgress}%` }}
                        ></div>
                        <span className="absolute left-2 text-[10px] font-bold truncate">
                          {row.label} ({sum.averageActualProgress}%)
                        </span>
                      </div>
                    </div>
                  );
                }

                // 3. 各工程行のガントバー
                if (!row.isParent && !row.isProject && row.process) {
                  const proc = row.process;
                  const startX = getXByDate(proc.startDate);
                  const endX = getXByDate(proc.endDate) + CELL_WIDTH;
                  const barWidth = Math.max(CELL_WIDTH, endX - startX);

                  return (
                    <div
                      key={row.id}
                      style={{ height: `${ROW_HEIGHT}px` }}
                      className="border-b border-slate-200/60 relative flex items-center hover:bg-slate-100/40"
                    >
                      {/* 予定期間バー（下地：インディゴ系） */}
                      <div
                        className="absolute h-7.5 rounded-md bg-indigo-100 border border-indigo-300 text-indigo-900 flex items-center shadow-2xs overflow-hidden group cursor-pointer"
                        style={{ left: `${startX}px`, width: `${barWidth}px` }}
                        title={`${row.feature?.name ? `${row.feature.name} > ` : ''}${proc.processType}${
                          proc.assignee ? ` (${proc.assignee})` : ''
                        }\n期間: ${proc.startDate} 〜 ${proc.endDate}\n実績: ${proc.actualProgress}%`}
                      >
                        {/* 実績進捗塗り（エメラルドグリーン） */}
                        <div
                          className="h-full bg-emerald-500/70 border-r border-emerald-600 transition-all"
                          style={{ width: `${proc.actualProgress}%` }}
                        ></div>

                        {/* バー内テキスト */}
                        <div className="absolute inset-0 px-2 flex items-center justify-between text-[10px] font-medium pointer-events-none">
                          <span className="truncate">
                            {proc.processType}
                            {proc.assignee ? ` (${proc.assignee})` : ''}
                          </span>
                          <span className="font-mono font-bold shrink-0 ml-1">
                            {proc.actualProgress}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>

            {/* =========================================================================
                イナズマ線レイヤー (Progress Line SVG Overlay)
               ========================================================================= */}
            {settings.showLightningLine && baselineX !== null && (
              <svg
                className="absolute inset-0 pointer-events-none z-30"
                style={{
                  width: `${calendarDays.length * CELL_WIDTH}px`,
                  height: `${flatRows.length * ROW_HEIGHT + HEADER_HEIGHT}px`,
                }}
              >
                {/* 遅延領域ハイライト（基準日より左に折れる部分） */}
                {delayAreaPolygons.map((poly, idx) => (
                  <polygon
                    key={`delay-poly-${idx}`}
                    points={poly.points}
                    fill="#f43f5e"
                    opacity="0.15"
                  />
                ))}

                {/* イナズマ線本体（太いアンバー・ゴールドの折れ線） */}
                <path
                  d={lightningPathData}
                  fill="none"
                  stroke="#d97706"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="filter drop-shadow-xs"
                />

                {/* 各工程・親行の頂点ポイント */}
                {lightningPoints.map((pt) => {
                  const ptX = getXByDate(pt.progressDate) + CELL_WIDTH / 2;
                  const isDelayed = pt.delayDays < -0.2;
                  const isAhead = pt.delayDays > 0.2;

                  return (
                    <g key={`pt-${pt.id}`} className="pointer-events-auto cursor-pointer">
                      <circle
                        cx={ptX}
                        cy={pt.y}
                        r={pt.isParent ? 5.5 : 4.5}
                        fill={isDelayed ? '#e11d48' : isAhead ? '#10b981' : '#f59e0b'}
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="transition-transform hover:scale-150"
                        onMouseEnter={() => setHoveredPoint(pt)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    </g>
                  );
                })}
              </svg>
            )}

            {/* イナズマ線頂点ホバーツールチップ */}
            {hoveredPoint && (
              <div
                className="absolute z-40 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none"
                style={{
                  left: `${getXByDate(hoveredPoint.progressDate) + 18}px`,
                  top: `${hoveredPoint.y - 45}px`,
                }}
              >
                <div className="font-bold flex items-center gap-1 text-slate-200 border-b border-slate-700 pb-1 mb-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>{hoveredPoint.label}の進捗</span>
                </div>
                <div className="space-y-0.5 text-[11px] font-mono">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">実績進捗:</span>
                    <span className="font-bold text-emerald-400">{hoveredPoint.actualProgress}%</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">予定進捗:</span>
                    <span className="text-slate-200">{hoveredPoint.plannedProgress}%</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">進捗状況:</span>
                    <span
                      className={`font-bold ${
                        hoveredPoint.delayDays < 0 ? 'text-rose-400' : 'text-blue-400'
                      }`}
                    >
                      {hoveredPoint.delayDays < 0
                        ? `遅延 ${Math.abs(hoveredPoint.delayDays)}稼働日`
                        : hoveredPoint.delayDays > 0
                        ? `先行 +${hoveredPoint.delayDays}稼働日`
                        : '予定通り'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 日別予定工数・定例会ツールチップ（日付ホバー時） */}
            {hoveredDaySummary && (
              <div
                className="fixed z-50 pointer-events-none bg-slate-900/95 text-white backdrop-blur-md rounded-xl p-3 shadow-2xl border border-slate-700/80 text-xs w-72 transition-opacity animate-fadeIn"
                style={{
                  left: `${Math.min(window.innerWidth - 305, Math.max(16, hoveredDaySummary.x))}px`,
                  top: `${Math.min(window.innerHeight - 240, Math.max(16, hoveredDaySummary.y))}px`,
                }}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-700 mb-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-100">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>
                      {hoveredDaySummary.summary.date} (
                      {['日', '月', '火', '水', '木', '金', '土'][hoveredDaySummary.summary.dayOfWeek]}
                      )
                    </span>
                  </div>
                  {hoveredDaySummary.summary.holidayName && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-900/80 text-rose-300 text-[10px] font-semibold">
                      {hoveredDaySummary.summary.holidayName}
                    </span>
                  )}
                </div>

                {/* 内訳 */}
                <div className="space-y-1.5 mb-2.5 max-h-48 overflow-y-auto pr-1">
                  {/* 会議時間 */}
                  {hoveredDaySummary.summary.meetingHours > 0 && (
                    <div className="flex items-center justify-between bg-purple-950/70 border border-purple-800/60 rounded px-2 py-1 text-purple-200">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></span>
                        <span className="font-medium">定例会・会議</span>
                      </span>
                      <span className="font-mono font-bold text-purple-300">
                        {hoveredDaySummary.summary.meetingHours}h
                      </span>
                    </div>
                  )}

                  {/* 各工程予定 */}
                  {hoveredDaySummary.summary.processes.length > 0 ? (
                    hoveredDaySummary.summary.processes.map((proc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-slate-800/80 border border-slate-700/60 rounded px-2 py-1"
                      >
                        <div className="flex flex-col truncate pr-2">
                          <span className="font-medium text-slate-200 truncate flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                            <span className="truncate">{proc.processName}</span>
                          </span>
                          <span className="text-[10px] text-slate-400 pl-3 truncate">
                            {proc.assignee} ({proc.featureName})
                          </span>
                        </div>
                        <span className="font-mono font-bold text-indigo-300 shrink-0">
                          {proc.hours}h
                        </span>
                      </div>
                    ))
                  ) : hoveredDaySummary.summary.meetingHours === 0 ? (
                    <div className="text-slate-400 text-[11px] py-1 text-center">
                      予定工数・会議なし
                    </div>
                  ) : null}
                </div>

                {/* 担当者別稼働状況（1人あたり8時間上限、会議は全員に加算） */}
                {hoveredDaySummary.summary.assigneeBreakdown &&
                  Object.keys(hoveredDaySummary.summary.assigneeBreakdown).length > 0 && (
                    <div className="pt-2 border-t border-slate-700/80 mb-2 space-y-1">
                      <div className="text-[10px] text-slate-400 font-medium">
                        担当者別稼働 (1人所定{settings.hoursPerDay || 8}h / 会議込):
                      </div>
                      {(Object.values(hoveredDaySummary.summary.assigneeBreakdown) as AssigneeDailySummary[]).map((ab) => (
                        <div
                          key={ab.assignee}
                          className="flex items-center justify-between text-[11px] bg-slate-800/60 rounded px-1.5 py-1"
                        >
                          <span className="text-slate-300 truncate mr-2 font-medium">
                            {ab.assignee}
                          </span>
                          <span
                            className={`font-mono font-semibold ${
                              ab.isOverCapacity ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {ab.totalHours}h / {ab.standardCapacity}h
                            {ab.meetingHours > 0 && (
                              <span className="text-[10px] text-slate-400 font-normal ml-1">
                                (会議{ab.meetingHours}h+作業{ab.processHours}h)
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                {/* 合計稼働 & キャパシティ比較 */}
                <div className="pt-2 border-t border-slate-700 flex items-center justify-between font-mono">
                  <span className="text-slate-300 text-[11px]">合計稼働時間:</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-bold text-sm ${
                        hoveredDaySummary.summary.isOverCapacity
                          ? 'text-rose-400 font-extrabold'
                          : 'text-emerald-400'
                      }`}
                    >
                      {hoveredDaySummary.summary.totalHours}h
                    </span>
                    <span className="text-slate-400 text-xs">
                      / 所定{hoveredDaySummary.summary.standardCapacity}h
                    </span>
                  </div>
                </div>

                {/* 超過警告 */}
                {hoveredDaySummary.summary.isOverCapacity && (
                  <div className="mt-2 px-2 py-1 rounded bg-rose-950/80 border border-rose-800 text-rose-300 text-[10px] flex items-center gap-1 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>所定上限を超過しています (+{hoveredDaySummary.summary.overHours}h)</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 担当者マスタ候補 datalist */}
      <datalist id="wbs-grid-members-list">
        {(members || []).map((m) => (
          <option key={m.id} value={m.name}>
            {m.name} ({m.dailyWorkingHours}h/日)
          </option>
        ))}
      </datalist>

      {/* 一般工程候補 datalist */}
      <datalist id="common-process-suggestions">
        {COMMON_PROCESS_SUGGESTIONS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
};
