import { Feature, TaskProcess, Holiday, ComputedProcessStats, BurnDownPoint, Project } from '../types';
import {
  calculateProcessStats,
  formatDate,
  getCalendarDays,
  isWorkingDay,
  parseDate,
  getWorkingDaysCount,
} from './dateUtils';

// 遅延人日の計算ヘルパー
export function calculateDelayManDays(
  plannedWorkload: number,
  plannedProgress: number,
  actualProgress: number,
  workloadUnit: '人日' | '人時' = '人日',
  hoursPerDay: number = 8
): number {
  if (actualProgress >= plannedProgress || plannedWorkload <= 0) return 0;
  // 人日換算
  const workloadInManDays = workloadUnit === '人時' ? plannedWorkload / (hoursPerDay || 8) : plannedWorkload;
  const delayRatio = (plannedProgress - actualProgress) / 100;
  const delayDays = workloadInManDays * delayRatio;
  return Math.round(delayDays * 10) / 10;
}

// 親機能のサマリー計算
export interface FeatureSummary {
  featureId: string;
  totalPlannedWorkload: number;
  totalActualWorkload: number;
  averagePlannedProgress: number; // 工数加重平均
  averageActualProgress: number;  // 工数加重平均
  overallStatus: ComputedProcessStats['status'];
  earliestStartDate: string;
  latestEndDate: string;
  totalWorkingDays: number;
  delayManDays: number; // 遅延人日の合計
  stepCount?: number;   // 機能のStep数
  plannedProductivity?: number; // 予定生産性 (Step / 予定工数)
  actualProductivity?: number;  // 実績生産性 (Step / 実績工数)
}

export function computeFeatureSummary(
  feature: Feature,
  baselineDate: string,
  holidays: Holiday[],
  workloadUnit: '人日' | '人時' = '人日',
  hoursPerDay: number = 8
): FeatureSummary {
  let totalPlannedWorkload = 0;
  let totalActualWorkload = 0;
  let weightedPlannedProgressSum = 0;
  let weightedActualProgressSum = 0;
  let totalDelayManDays = 0;

  let earliestStart = '';
  let latestEnd = '';

  let hasDelayed = false;
  let allCompleted = feature.processes.length > 0;
  let anyStarted = false;

  for (const proc of feature.processes) {
    const plannedW = Number(proc.plannedWorkload) || 0;
    const actualW = Number(proc.actualWorkload) || 0;
    const actualP = Number(proc.actualProgress) || 0;

    totalPlannedWorkload += plannedW;
    totalActualWorkload += actualW;

    const stats = calculateProcessStats(proc.startDate, proc.endDate, actualP, baselineDate, holidays);

    // 工数による加重平均（工数が0なら均等配分）
    const weight = plannedW > 0 ? plannedW : 1;
    weightedPlannedProgressSum += stats.plannedProgress * weight;
    weightedActualProgressSum += actualP * weight;

    // 遅延人日
    const delayDays = calculateDelayManDays(plannedW, stats.plannedProgress, actualP, workloadUnit, hoursPerDay);
    totalDelayManDays += delayDays;

    if (stats.status === 'delayed') hasDelayed = true;
    if (actualP < 100) allCompleted = false;
    if (actualP > 0) anyStarted = true;

    if (proc.startDate) {
      if (!earliestStart || proc.startDate < earliestStart) earliestStart = proc.startDate;
    }
    if (proc.endDate) {
      if (!latestEnd || proc.endDate > latestEnd) latestEnd = proc.endDate;
    }
  }

  const weightDivider = totalPlannedWorkload > 0 ? totalPlannedWorkload : (feature.processes.length || 1);
  const avgPlannedProgress = Math.round(weightedPlannedProgressSum / weightDivider);
  const avgActualProgress = Math.round(weightedActualProgressSum / weightDivider);

  let overallStatus: ComputedProcessStats['status'] = 'not_started';
  if (allCompleted && feature.processes.length > 0) {
    overallStatus = 'completed';
  } else if (hasDelayed || totalDelayManDays > 0) {
    overallStatus = 'delayed';
  } else if (anyStarted) {
    overallStatus = 'on_track';
  }

  const totalWorkingDays = (earliestStart && latestEnd)
    ? getWorkingDaysCount(earliestStart, latestEnd, holidays)
    : 0;

  const roundedPlannedWorkload = Math.round(totalPlannedWorkload * 10) / 10;
  const roundedActualWorkload = Math.round(totalActualWorkload * 10) / 10;

  const stepCount =
    feature.stepCount !== undefined && feature.stepCount !== null && !isNaN(Number(feature.stepCount))
      ? Number(feature.stepCount)
      : undefined;

  const plannedProductivity =
    stepCount !== undefined && stepCount > 0 && roundedPlannedWorkload > 0
      ? Math.round((stepCount / roundedPlannedWorkload) * 10) / 10
      : undefined;

  const actualProductivity =
    stepCount !== undefined && stepCount > 0 && roundedActualWorkload > 0
      ? Math.round((stepCount / roundedActualWorkload) * 10) / 10
      : undefined;

  return {
    featureId: feature.id,
    totalPlannedWorkload: roundedPlannedWorkload,
    totalActualWorkload: roundedActualWorkload,
    averagePlannedProgress: Math.min(100, Math.max(0, avgPlannedProgress)),
    averageActualProgress: Math.min(100, Math.max(0, avgActualProgress)),
    overallStatus,
    earliestStartDate: earliestStart,
    latestEndDate: latestEnd,
    totalWorkingDays,
    delayManDays: Math.round(totalDelayManDays * 10) / 10,
    stepCount,
    plannedProductivity,
    actualProductivity,
  };
}

// プロジェクト全体のサマリー計算
export interface ProjectOverallSummary {
  totalPlannedWorkload: number;
  totalActualWorkload: number;
  overallPlannedProgress: number; // 工数加重平均の予定進捗率
  overallActualProgress: number;  // 工数加重平均の実績進捗率
  totalDelayManDays: number;      // 遅延人日の総計
  overallStatus: ComputedProcessStats['status'];
  totalFeaturesCount: number;
  totalProcessesCount: number;
  completedProcessesCount: number;
  delayedProcessesCount: number;
  totalStepCount: number;         // プロジェクト全体の総Step数
  plannedProductivity?: number;   // 全体予定生産性 (Step / 予定工数)
  actualProductivity?: number;    // 全体実績生産性 (Step / 実績工数)
}

export function computeProjectSummary(
  features: Feature[],
  baselineDate: string,
  holidays: Holiday[],
  workloadUnit: '人日' | '人時' = '人日',
  hoursPerDay: number = 8
): ProjectOverallSummary {
  let totalPlannedWorkload = 0;
  let totalActualWorkload = 0;
  let weightedPlannedProgressSum = 0;
  let weightedActualProgressSum = 0;
  let totalDelayManDays = 0;
  let totalProcessesCount = 0;
  let completedProcessesCount = 0;
  let delayedProcessesCount = 0;
  let anyStarted = false;

  for (const feature of features) {
    for (const proc of feature.processes) {
      totalProcessesCount++;
      const plannedW = Number(proc.plannedWorkload) || 0;
      const actualW = Number(proc.actualWorkload) || 0;
      const actualP = Number(proc.actualProgress) || 0;

      totalPlannedWorkload += plannedW;
      totalActualWorkload += actualW;

      const stats = calculateProcessStats(proc.startDate, proc.endDate, actualP, baselineDate, holidays);
      const weight = plannedW > 0 ? plannedW : 1;

      weightedPlannedProgressSum += stats.plannedProgress * weight;
      weightedActualProgressSum += actualP * weight;

      const delayDays = calculateDelayManDays(plannedW, stats.plannedProgress, actualP, workloadUnit, hoursPerDay);
      if (delayDays > 0) {
        totalDelayManDays += delayDays;
      }

      if (stats.status === 'delayed' || delayDays > 0) {
        delayedProcessesCount++;
      }
      if (actualP >= 100) {
        completedProcessesCount++;
      }
      if (actualP > 0) {
        anyStarted = true;
      }
    }
  }

  const weightDivider = totalPlannedWorkload > 0 ? totalPlannedWorkload : (totalProcessesCount || 1);
  const overallPlannedProgress = Math.min(100, Math.max(0, Math.round(weightedPlannedProgressSum / weightDivider)));
  const overallActualProgress = Math.min(100, Math.max(0, Math.round(weightedActualProgressSum / weightDivider)));

  let overallStatus: ComputedProcessStats['status'] = 'not_started';
  if (totalProcessesCount > 0 && completedProcessesCount === totalProcessesCount) {
    overallStatus = 'completed';
  } else if (delayedProcessesCount > 0 || totalDelayManDays > 0 || overallActualProgress < overallPlannedProgress - 5) {
    overallStatus = 'delayed';
  } else if (anyStarted) {
    overallStatus = 'on_track';
  }

  // プロジェクト全体のStep数集計
  let totalStepCount = 0;
  for (const feature of features) {
    if (feature.stepCount !== undefined && feature.stepCount !== null && !isNaN(Number(feature.stepCount))) {
      totalStepCount += Math.max(0, Number(feature.stepCount));
    }
  }

  const roundedPlannedWorkload = Math.round(totalPlannedWorkload * 10) / 10;
  const roundedActualWorkload = Math.round(totalActualWorkload * 10) / 10;

  const plannedProductivity =
    totalStepCount > 0 && roundedPlannedWorkload > 0
      ? Math.round((totalStepCount / roundedPlannedWorkload) * 10) / 10
      : undefined;

  const actualProductivity =
    totalStepCount > 0 && roundedActualWorkload > 0
      ? Math.round((totalStepCount / roundedActualWorkload) * 10) / 10
      : undefined;

  return {
    totalPlannedWorkload: roundedPlannedWorkload,
    totalActualWorkload: roundedActualWorkload,
    overallPlannedProgress,
    overallActualProgress,
    totalDelayManDays: Math.round(totalDelayManDays * 10) / 10,
    overallStatus,
    totalFeaturesCount: features.length,
    totalProcessesCount,
    completedProcessesCount,
    delayedProcessesCount,
    totalStepCount,
    plannedProductivity,
    actualProductivity,
  };
}

// プロジェクト全体の表示日付範囲の算出
export function calculateProjectDateRange(
  features: Feature[],
  baselineDate: string
): { minDate: string; maxDate: string } {
  let minDate = baselineDate;
  let maxDate = baselineDate;

  for (const feature of features) {
    for (const proc of feature.processes) {
      if (proc.startDate && proc.startDate < minDate) minDate = proc.startDate;
      if (proc.endDate && proc.endDate > maxDate) maxDate = proc.endDate;
    }
  }

  // 表示の余裕を持たせる（開始前-3日、終了後+7日）
  const minD = parseDate(minDate);
  minD.setDate(minD.getDate() - 3);
  const maxD = parseDate(maxDate);
  maxD.setDate(maxD.getDate() + 7);

  return {
    minDate: formatDate(minD),
    maxDate: formatDate(maxD),
  };
}

// イナズマ線の頂点ポイント計算
// 頂点ごとの情報：
// rowId, rowIndex, y (行中央), progressDate (実績進捗率が対応する日付位置), delayDays (遅れ/進み日数)
export interface LightningPoint {
  id: string;
  label: string;
  isParent: boolean;
  y: number;
  progressDate: string;
  delayDays: number;
  actualProgress: number;
  plannedProgress: number;
  baselineDate: string;
}

export function computeLightningPoints(
  rows: Array<{ id: string; label: string; isParent: boolean; process?: TaskProcess; summary?: FeatureSummary; y: number }>,
  baselineDate: string,
  holidays: Holiday[]
): LightningPoint[] {
  const points: LightningPoint[] = [];

  for (const row of rows) {
    if (row.isParent && row.summary) {
      // 親機能行のイナズマ点
      const sum = row.summary;
      const progressDate = calculateProgressDate(
        sum.earliestStartDate,
        sum.latestEndDate,
        sum.averageActualProgress,
        baselineDate,
        holidays
      );
      const delayDays = calculateDelayDays(
        sum.earliestStartDate,
        sum.latestEndDate,
        sum.averageActualProgress,
        sum.averagePlannedProgress,
        holidays
      );

      points.push({
        id: row.id,
        label: row.label,
        isParent: true,
        y: row.y,
        progressDate,
        delayDays,
        actualProgress: sum.averageActualProgress,
        plannedProgress: sum.averagePlannedProgress,
        baselineDate,
      });
    } else if (row.process) {
      // 各工程行のイナズマ点
      const proc = row.process;
      const stats = calculateProcessStats(proc.startDate, proc.endDate, proc.actualProgress, baselineDate, holidays);
      const progressDate = calculateProgressDate(
        proc.startDate,
        proc.endDate,
        proc.actualProgress,
        baselineDate,
        holidays
      );
      const delayDays = calculateDelayDays(
        proc.startDate,
        proc.endDate,
        proc.actualProgress,
        stats.plannedProgress,
        holidays
      );

      points.push({
        id: row.id,
        label: `${proc.processType}`,
        isParent: false,
        y: row.y,
        progressDate,
        delayDays,
        actualProgress: proc.actualProgress,
        plannedProgress: stats.plannedProgress,
        baselineDate,
      });
    }
  }

  return points;
}

// 進捗率が指し示す日付位置の計算
function calculateProgressDate(
  startDate: string,
  endDate: string,
  actualProgress: number,
  baselineDate: string,
  holidays: Holiday[]
): string {
  if (!startDate || !endDate) return baselineDate;

  // 100%完了なら終了日以降
  if (actualProgress >= 100) {
    return endDate;
  }
  // 0%なら開始日
  if (actualProgress <= 0) {
    return startDate;
  }

  const allCalendarDays = getCalendarDays(startDate, endDate);
  if (allCalendarDays.length === 0) return baselineDate;

  // 稼働日ベースで進捗率に対応する日数分進んだ日付を探す
  const workingDays = allCalendarDays.filter((d) => isWorkingDay(d, holidays));
  if (workingDays.length === 0) return startDate;

  const targetWorkingDayIndex = Math.min(
    workingDays.length - 1,
    Math.floor((actualProgress / 100) * workingDays.length)
  );
  return workingDays[targetWorkingDayIndex] || startDate;
}

// 遅延日数の概算
function calculateDelayDays(
  startDate: string,
  endDate: string,
  actualProgress: number,
  plannedProgress: number,
  holidays: Holiday[]
): number {
  if (!startDate || !endDate) return 0;
  const totalWorkingDays = getWorkingDaysCount(startDate, endDate, holidays);
  if (totalWorkingDays === 0) return 0;

  // (実績進捗率 - 予定進捗率) * 総稼働日数
  const delay = ((actualProgress - plannedProgress) / 100) * totalWorkingDays;
  return Math.round(delay * 10) / 10;
}

// バーンダウンチャートデータの計算
export function computeBurnDownData(
  features: Feature[],
  selectedFeatureId: string | 'all',
  baselineDate: string,
  holidays: Holiday[]
): {
  data: BurnDownPoint[];
  totalWorkload: number;
  currentRemaining: number;
  completionRate: number;
} {
  const targetFeatures =
    selectedFeatureId === 'all'
      ? features
      : features.filter((f) => f.id === selectedFeatureId);

  const processes: TaskProcess[] = [];
  for (const f of targetFeatures) {
    processes.push(...f.processes);
  }

  if (processes.length === 0) {
    return { data: [], totalWorkload: 0, currentRemaining: 0, completionRate: 0 };
  }

  // プロジェクト全期間
  let minDate = baselineDate;
  let maxDate = baselineDate;
  let totalWorkload = 0;

  for (const p of processes) {
    totalWorkload += Number(p.plannedWorkload) || 0;
    if (p.startDate && p.startDate < minDate) minDate = p.startDate;
    if (p.endDate && p.endDate > maxDate) maxDate = p.endDate;
  }

  const allDays = getCalendarDays(minDate, maxDate);
  const totalWorkingDays = allDays.filter((d) => isWorkingDay(d, holidays)).length;

  let currentElapsedWorkingDays = 0;
  for (const d of allDays) {
    if (d <= baselineDate && isWorkingDay(d, holidays)) {
      currentElapsedWorkingDays++;
    }
  }

  // 各工程ごとの日別消化予定・実績
  const burnDownPoints: BurnDownPoint[] = [];
  let elapsedWorkDaysAcc = 0;

  for (const day of allDays) {
    const isW = isWorkingDay(day, holidays);
    if (isW) elapsedWorkDaysAcc++;

    // 理想残工数 (Ideal remaining): 稼働日に均等に減少
    const idealRemaining =
      totalWorkingDays > 0
        ? Math.max(0, Math.round((totalWorkload * (1 - elapsedWorkDaysAcc / totalWorkingDays)) * 10) / 10)
        : 0;

    // 予定残工数 (Planned remaining based on process schedules)
    let plannedCompletedSum = 0;
    for (const p of processes) {
      const stats = calculateProcessStats(p.startDate, p.endDate, 0, day, holidays);
      const plannedW = Number(p.plannedWorkload) || 0;
      plannedCompletedSum += plannedW * (stats.plannedProgress / 100);
    }
    const plannedRemaining = Math.max(0, Math.round((totalWorkload - plannedCompletedSum) * 10) / 10);

    // 実績残工数 (Actual remaining): baselineDate以前のみ記録
    let actualRemaining: number | null = null;
    if (day <= baselineDate) {
      let actualCompletedSum = 0;
      for (const p of processes) {
        const plannedW = Number(p.plannedWorkload) || 0;
        // 今日より前の日は、工程の進捗率を按分して推移させる
        if (day === baselineDate) {
          actualCompletedSum += plannedW * ((p.actualProgress || 0) / 100);
        } else {
          // 基準日より前の日の実績推移（進捗実績と予定から滑らかに算出）
          const stats = calculateProcessStats(p.startDate, p.endDate, p.actualProgress, day, holidays);
          // 当日の予定進捗比率に実績進捗率を掛け合わせる
          const ratio = stats.plannedProgress / 100;
          actualCompletedSum += plannedW * ((p.actualProgress || 0) / 100) * ratio;
        }
      }
      actualRemaining = Math.max(0, Math.round((totalWorkload - actualCompletedSum) * 10) / 10);
    }

    burnDownPoints.push({
      date: day,
      displayDate: day.slice(5), // MM-DD
      isWorkingDay: isW,
      idealRemaining,
      actualRemaining,
      plannedRemaining,
    });
  }

  // 現時点の残工数
  const todayPoint = burnDownPoints.find((p) => p.date === baselineDate);
  const currentRemaining = todayPoint?.actualRemaining ?? (burnDownPoints[burnDownPoints.length - 1]?.actualRemaining ?? 0);
  const completionRate = totalWorkload > 0 ? Math.round(((totalWorkload - currentRemaining) / totalWorkload) * 100) : 0;

  return {
    data: burnDownPoints,
    totalWorkload: Math.round(totalWorkload * 10) / 10,
    currentRemaining,
    completionRate,
  };
}

// プロジェクト全体のサマリー計算
export interface ProjectSummary {
  projectId: string;
  projectName: string;
  manager: string;
  totalPlannedWorkload: number;
  totalActualWorkload: number;
  workloadUnit: '人時' | '人日';
  plannedProgress: number; // 工数加重平均
  actualProgress: number;  // 工数加重平均
  status: ComputedProcessStats['status'];
  delayManDays: number;
  featureCount: number;
  processCount: number;
  earliestStartDate: string;
  latestEndDate: string;
  totalWorkingDays: number;
  totalStepCount: number;       // プロジェクト総Step数
  plannedProductivity?: number; // 予定生産性 (Step / 予定工数)
  actualProductivity?: number;  // 実績生産性 (Step / 実績工数)
}

export function computeFullProjectMetrics(project: Project, assigneeQuery?: string): ProjectSummary {
  const { features, settings, holidays } = project;
  const baselineDate = settings.baselineDate;
  const workloadUnit = settings.workloadUnit || '人日';
  const hoursPerDay = settings.hoursPerDay || 8;
  const query = (assigneeQuery || '').trim().toLowerCase();

  let totalPlannedWorkload = 0;
  let totalActualWorkload = 0;
  let weightedPlannedProgressSum = 0;
  let weightedActualProgressSum = 0;
  let totalDelayManDays = 0;
  let processCount = 0;

  let earliestStart = '';
  let latestEnd = '';

  let hasDelayed = false;
  let allCompleted = true;
  let anyStarted = false;

  let totalStepCount = 0;
  for (const feat of features) {
    if (feat.stepCount !== undefined && feat.stepCount !== null && !isNaN(Number(feat.stepCount))) {
      totalStepCount += Math.max(0, Number(feat.stepCount));
    }
  }

  for (const feat of features) {
    for (const proc of feat.processes) {
      if (query && !(proc.assignee || '').toLowerCase().includes(query)) {
        continue;
      }
      processCount++;
      const plannedW = Number(proc.plannedWorkload) || 0;
      const actualW = Number(proc.actualWorkload) || 0;
      const actualP = Number(proc.actualProgress) || 0;

      totalPlannedWorkload += plannedW;
      totalActualWorkload += actualW;

      const stats = calculateProcessStats(proc.startDate, proc.endDate, actualP, baselineDate, holidays);
      const weight = plannedW > 0 ? plannedW : 1;
      weightedPlannedProgressSum += stats.plannedProgress * weight;
      weightedActualProgressSum += actualP * weight;

      const delayDays = calculateDelayManDays(plannedW, stats.plannedProgress, actualP, workloadUnit, hoursPerDay);
      totalDelayManDays += delayDays;

      if (stats.status === 'delayed') hasDelayed = true;
      if (actualP < 100) allCompleted = false;
      if (actualP > 0) anyStarted = true;

      if (proc.startDate) {
        if (!earliestStart || proc.startDate < earliestStart) earliestStart = proc.startDate;
      }
      if (proc.endDate) {
        if (!latestEnd || proc.endDate > latestEnd) latestEnd = proc.endDate;
      }
    }
  }

  if (processCount === 0) {
    allCompleted = false;
  }

  const weightDivider = totalPlannedWorkload > 0 ? totalPlannedWorkload : (processCount || 1);
  const plannedProgress = processCount > 0 ? Math.round(weightedPlannedProgressSum / weightDivider) : 0;
  const actualProgress = processCount > 0 ? Math.round(weightedActualProgressSum / weightDivider) : 0;

  let status: ComputedProcessStats['status'] = 'not_started';
  if (allCompleted && processCount > 0) {
    status = 'completed';
  } else if (hasDelayed || totalDelayManDays > 0) {
    status = 'delayed';
  } else if (anyStarted) {
    status = 'on_track';
  }

  const totalWorkingDays = (earliestStart && latestEnd)
    ? getWorkingDaysCount(earliestStart, latestEnd, holidays)
    : 0;

  const roundedPlanned = Math.round(totalPlannedWorkload * 10) / 10;
  const roundedActual = Math.round(totalActualWorkload * 10) / 10;

  const plannedProductivity =
    totalStepCount > 0 && roundedPlanned > 0
      ? Math.round((totalStepCount / roundedPlanned) * 10) / 10
      : undefined;

  const actualProductivity =
    totalStepCount > 0 && roundedActual > 0
      ? Math.round((totalStepCount / roundedActual) * 10) / 10
      : undefined;

  return {
    projectId: project.id,
    projectName: project.name || settings.projectName,
    manager: project.manager || settings.manager || '未設定',
    totalPlannedWorkload: roundedPlanned,
    totalActualWorkload: roundedActual,
    workloadUnit,
    plannedProgress: Math.min(100, Math.max(0, plannedProgress)),
    actualProgress: Math.min(100, Math.max(0, actualProgress)),
    status,
    delayManDays: Math.round(totalDelayManDays * 10) / 10,
    featureCount: features.length,
    processCount,
    earliestStartDate: earliestStart,
    latestEndDate: latestEnd,
    totalWorkingDays,
    totalStepCount,
    plannedProductivity,
    actualProductivity,
  };
}
