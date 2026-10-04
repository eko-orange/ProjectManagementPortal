import { Holiday, ComputedProcessStats, Member, Project, Feature } from '../types';

// 日付フォーマットヘルパー (YYYY-MM-DD)
export function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 今日の日付文字列
export function getTodayString(): string {
  return formatDate(new Date());
}

// 文字列からDate生成 (ローカルTZ安全)
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0); // 正午で生成してタイムゾーンのずれを防ぐ
}

// 2つの日付の前後比較
export function compareDates(dateStr1: string, dateStr2: string): number {
  if (dateStr1 < dateStr2) return -1;
  if (dateStr1 > dateStr2) return 1;
  return 0;
}

// 土日判定
export function isWeekend(dateStr: string): boolean {
  const d = parseDate(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6; // 0: 日曜, 6: 土曜
}

// 休日判定（土日または登録休日）
export function isHoliday(dateStr: string, holidays: Holiday[]): { isHoliday: boolean; holidayName?: string; type?: string } {
  const holiday = holidays.find((h) => h.date === dateStr);
  if (holiday) {
    return { isHoliday: true, holidayName: holiday.name, type: holiday.type };
  }
  if (isWeekend(dateStr)) {
    const d = parseDate(dateStr);
    const name = d.getDay() === 0 ? '日曜日' : '土曜日';
    return { isHoliday: true, holidayName: name, type: 'weekend' };
  }
  return { isHoliday: false };
}

// 稼働日判定
export function isWorkingDay(dateStr: string, holidays: Holiday[]): boolean {
  return !isHoliday(dateStr, holidays).isHoliday;
}

// 2つの日付間のカレンダー全日数 (startからendまで、当日含む)
export function getCalendarDays(startDateStr: string, endDateStr: string): string[] {
  if (!startDateStr || !endDateStr) return [];
  if (startDateStr > endDateStr) {
    [startDateStr, endDateStr] = [endDateStr, startDateStr];
  }
  const result: string[] = [];
  const curr = parseDate(startDateStr);
  const end = parseDate(endDateStr);

  while (curr <= end) {
    result.push(formatDate(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return result;
}

// 2つの日付間の稼働日数（startからendまで、当日含む）
export function getWorkingDaysCount(startDateStr: string, endDateStr: string, holidays: Holiday[]): number {
  if (!startDateStr || !endDateStr) return 0;
  if (startDateStr > endDateStr) return 0;

  const days = getCalendarDays(startDateStr, endDateStr);
  let workingDays = 0;
  for (const day of days) {
    if (isWorkingDay(day, holidays)) {
      workingDays++;
    }
  }
  return workingDays;
}

// 予定進捗率および進捗状態の自動計算
export function calculateProcessStats(
  startDateStr: string,
  endDateStr: string,
  actualProgress: number,
  baselineDateStr: string,
  holidays: Holiday[]
): ComputedProcessStats {
  if (!startDateStr || !endDateStr) {
    return {
      totalPlannedDays: 0,
      elapsedPlannedDays: 0,
      plannedProgress: 0,
      delayRate: 0,
      status: 'not_started',
    };
  }

  // 1. 総予定稼働日数
  const totalPlannedDays = getWorkingDaysCount(startDateStr, endDateStr, holidays);

  // 2. 予定進捗率の計算
  let plannedProgress = 0;
  let elapsedPlannedDays = 0;

  if (baselineDateStr < startDateStr) {
    // 開始前
    plannedProgress = 0;
    elapsedPlannedDays = 0;
  } else if (baselineDateStr >= endDateStr) {
    // 終了日以降
    plannedProgress = 100;
    elapsedPlannedDays = totalPlannedDays;
  } else {
    // 開始日〜終了日の間
    elapsedPlannedDays = getWorkingDaysCount(startDateStr, baselineDateStr, holidays);
    if (totalPlannedDays <= 0) {
      plannedProgress = 100;
    } else {
      plannedProgress = Math.min(100, Math.max(0, Math.round((elapsedPlannedDays / totalPlannedDays) * 100)));
    }
  }

  // 3. 遅延差分（実績進捗率 - 予定進捗率）
  const delayRate = actualProgress - plannedProgress;

  // 4. ステータス判定
  let status: ComputedProcessStats['status'] = 'not_started';
  if (actualProgress >= 100) {
    status = 'completed';
  } else if (actualProgress === 0 && baselineDateStr < startDateStr) {
    status = 'not_started';
  } else if (delayRate < -10) {
    status = 'delayed'; // 10%以上の遅れ
  } else {
    status = 'on_track';
  }

  return {
    totalPlannedDays,
    elapsedPlannedDays,
    plannedProgress,
    delayRate,
    status,
  };
}

// 日付に日数を足す (YYYY-MM-DD)
export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

// 稼働日を加算して終了日を求める
export function addWorkingDays(startDateStr: string, workingDaysCount: number, holidays: Holiday[]): string {
  let count = 0;
  let curr = parseDate(startDateStr);

  while (count < workingDaysCount) {
    const dateStr = formatDate(curr);
    if (isWorkingDay(dateStr, holidays)) {
      count++;
    }
    if (count < workingDaysCount) {
      curr.setDate(curr.getDate() + 1);
    }
  }
  return formatDate(curr);
}

// 担当者ごとの休日（土日祝・会社休日＋担当者個別休暇）を考慮した稼働日判定
export function isMemberWorkingDay(
  dateStr: string,
  holidays: Holiday[],
  member?: Member | null
): { isWorkingDay: boolean; reason?: string; isIndividualHoliday?: boolean } {
  // 1. プロジェクト共通休日（土日・祝日・会社休日）
  const projectHol = isHoliday(dateStr, holidays);
  if (projectHol.isHoliday) {
    return { isWorkingDay: false, reason: projectHol.holidayName, isIndividualHoliday: false };
  }
  // 2. 担当者の個別休日（有休・代休など）
  if (member && member.individualHolidays && member.individualHolidays.length > 0) {
    const ind = member.individualHolidays.find((h) => h.date === dateStr);
    if (ind) {
      return {
        isWorkingDay: false,
        reason: `${member.name} 休暇 (${ind.name})`,
        isIndividualHoliday: true,
      };
    }
  }
  return { isWorkingDay: true };
}

// 担当者の稼働日を加算して終了日を算出
export function addWorkingDaysForMember(
  startDateStr: string,
  workingDaysCount: number,
  holidays: Holiday[],
  member?: Member | null
): string {
  if (workingDaysCount <= 0) return startDateStr;
  let count = 0;
  let curr = parseDate(startDateStr);

  while (count < workingDaysCount) {
    const dateStr = formatDate(curr);
    if (isMemberWorkingDay(dateStr, holidays, member).isWorkingDay) {
      count++;
    }
    if (count < workingDaysCount) {
      curr.setDate(curr.getDate() + 1);
    }
  }
  return formatDate(curr);
}

// 特定の日・担当者における実稼働可能時間（時間）を算出（休日なら0、平日は所定時間 - 曜日会議時間）
export function getDayWorkingCapacity(
  dateStr: string,
  holidays: Holiday[],
  member?: Member | null,
  defaultHoursPerDay: number = 8,
  weeklyMeetingHours?: { [dayOfWeek: number]: number }
): number {
  if (!isMemberWorkingDay(dateStr, holidays, member).isWorkingDay) {
    return 0;
  }
  const memberStandardHours = member?.dailyWorkingHours || defaultHoursPerDay;
  const d = parseDate(dateStr);
  const dayOfWeek = d.getDay(); // 0(日) - 6(土)
  const meetingHours = weeklyMeetingHours?.[dayOfWeek] || 0;
  return Math.max(0, memberStandardHours - meetingHours);
}

// 非稼働日または稼働枠0時間の場合、実稼働枠が存在する次の稼働日を探して返す
export function getNextEffectiveWorkingDay(
  dateStr: string,
  holidays: Holiday[],
  member?: Member | null,
  defaultHoursPerDay: number = 8,
  weeklyMeetingHours?: { [dayOfWeek: number]: number }
): string {
  let curr = parseDate(dateStr);
  let guard = 0; // 無限ループガード
  while (guard < 180) {
    const ds = formatDate(curr);
    const cap = getDayWorkingCapacity(ds, holidays, member, defaultHoursPerDay, weeklyMeetingHours);
    if (cap > 0) {
      return ds;
    }
    curr.setDate(curr.getDate() + 1);
    guard++;
  }
  return formatDate(curr);
}

// 非稼働日の場合、次の担当者稼働日を探して返す
export function getNextWorkingDayForMember(
  dateStr: string,
  holidays: Holiday[],
  member?: Member | null
): string {
  let curr = parseDate(dateStr);
  let guard = 0; // 無限ループガード
  while (!isMemberWorkingDay(formatDate(curr), holidays, member).isWorkingDay && guard < 120) {
    curr.setDate(curr.getDate() + 1);
    guard++;
  }
  return formatDate(curr);
}

// 自動スケジューリングの追加オプション
export interface AutoScheduleOptions {
  // すでに他の工程で使われている日別・担当者別の工数マップ
  // key: `${assignee}___${dateStr}` または `${dateStr}` => number
  existingUsageMap?: Record<string, number>;
  // 開始日の初期既使用工数（例: 別工程で1時間消化済み）
  initialUsedHoursOnStartDay?: number;
}

// 機能開始日と各工程の担当者・工数をもとに全工程を自動連鎖スケジューリングする関数
// （各工程の人日・人時は固定で、開始日や前工程・別工程の残工数枠から自動計算してスケジュール）
export function autoScheduleProcesses<T extends {
  id?: string;
  processType: string;
  assignee: string;
  plannedWorkload: number;
  startDate?: string;
  endDate?: string;
  [key: string]: any;
}>(
  featureStartDate: string,
  processes: T[],
  holidays: Holiday[],
  members: Member[] = [],
  workloadUnit: '人時' | '人日' = '人日',
  defaultHoursPerDay: number = 8,
  weeklyMeetingHours?: { [dayOfWeek: number]: number },
  options?: AutoScheduleOptions
): {
  scheduledProcesses: T[];
  featureEndDate: string;
  totalWorkload: number;
  lastDayRemainingHours: number;
  finalUsageMap: Record<string, number>;
} {
  let currentDay = featureStartDate;
  // その日に残っている実稼働可能時間（nullの場合は初回初期化）
  let remainingHoursInDay: number | null = null;
  let totalWorkload = 0;

  // 内部追跡用消費マップ（同一機能内の工程間、および既存使用分）
  const internalUsageMap: Record<string, number> = { ...(options?.existingUsageMap || {}) };

  const getUsedHoursOnDay = (assigneeName: string, dateStr: string): number => {
    const key = `${assigneeName.trim()}___${dateStr}`;
    return (internalUsageMap[key] || 0) + (internalUsageMap[dateStr] || 0);
  };

  const addUsedHoursOnDay = (assigneeName: string, dateStr: string, hours: number) => {
    const key = `${assigneeName.trim()}___${dateStr}`;
    internalUsageMap[key] = Math.round(((internalUsageMap[key] || 0) + hours) * 10) / 10;
  };

  const scheduled = processes.map((proc, procIdx) => {
    const member = members.find((m) => m.name === proc.assignee?.trim());
    const assigneeName = proc.assignee?.trim() || '未設定';
    const workloadVal = Math.max(0.1, Number(proc.plannedWorkload) || 1);
    totalWorkload += workloadVal;

    // 工数の時間換算:
    // 人時ならそのまま時間。人日なら 1人日 = defaultHoursPerDay(8時間)として時間に換算
    let workHours = workloadUnit === '人時'
      ? workloadVal
      : workloadVal * defaultHoursPerDay;

    // 1. 開始可能日の特定
    if (remainingHoursInDay === null || remainingHoursInDay <= 0.0001) {
      // 残り時間がない場合は、次の稼働可能日へスライド
      currentDay = getNextEffectiveWorkingDay(
        currentDay,
        holidays,
        member,
        defaultHoursPerDay,
        weeklyMeetingHours
      );
      const cap = getDayWorkingCapacity(
        currentDay,
        holidays,
        member,
        defaultHoursPerDay,
        weeklyMeetingHours
      );

      let alreadyUsed = getUsedHoursOnDay(assigneeName, currentDay);
      if (procIdx === 0 && options?.initialUsedHoursOnStartDay && currentDay === featureStartDate) {
        alreadyUsed += options.initialUsedHoursOnStartDay;
      }

      remainingHoursInDay = Math.max(0, cap - alreadyUsed);

      // もし既にその日の空き枠が尽きていれば、空きのある次の稼働日へ進める
      let guardLoop = 0;
      while (remainingHoursInDay <= 0.0001 && guardLoop < 365) {
        guardLoop++;
        currentDay = getNextEffectiveWorkingDay(
          addDays(currentDay, 1),
          holidays,
          member,
          defaultHoursPerDay,
          weeklyMeetingHours
        );
        const nextCap = getDayWorkingCapacity(
          currentDay,
          holidays,
          member,
          defaultHoursPerDay,
          weeklyMeetingHours
        );
        const nextUsed = getUsedHoursOnDay(assigneeName, currentDay);
        remainingHoursInDay = Math.max(0, nextCap - nextUsed);
      }
    } else {
      // 前工程の同日あまり時間がある場合
      const memberCap = getDayWorkingCapacity(
        currentDay,
        holidays,
        member,
        defaultHoursPerDay,
        weeklyMeetingHours
      );
      if (memberCap <= 0.0001) {
        // 現在の日付がこの担当者にとって非稼働日（個別有休等）の場合、次の稼働日へ進む
        currentDay = getNextEffectiveWorkingDay(
          addDays(currentDay, 1),
          holidays,
          member,
          defaultHoursPerDay,
          weeklyMeetingHours
        );
        const nextCap = getDayWorkingCapacity(
          currentDay,
          holidays,
          member,
          defaultHoursPerDay,
          weeklyMeetingHours
        );
        const nextUsed = getUsedHoursOnDay(assigneeName, currentDay);
        remainingHoursInDay = Math.max(0, nextCap - nextUsed);
      } else {
        // 同日のあまり時間を引き継ぐ（担当者の空き枠との最小値）
        const memberAvail = Math.max(0, memberCap - getUsedHoursOnDay(assigneeName, currentDay));
        remainingHoursInDay = Math.min(remainingHoursInDay, memberAvail);
        if (remainingHoursInDay <= 0.0001) {
          currentDay = getNextEffectiveWorkingDay(
            addDays(currentDay, 1),
            holidays,
            member,
            defaultHoursPerDay,
            weeklyMeetingHours
          );
          const nextCap = getDayWorkingCapacity(
            currentDay,
            holidays,
            member,
            defaultHoursPerDay,
            weeklyMeetingHours
          );
          const nextUsed = getUsedHoursOnDay(assigneeName, currentDay);
          remainingHoursInDay = Math.max(0, nextCap - nextUsed);
        }
      }
    }

    const procStartDate = currentDay;
    let procEndDate = currentDay;

    // 2. 時間割り当てループ（前工程のあまり時間・当日の残枠から順に消化）
    while (workHours > 0.0001) {
      const avail = remainingHoursInDay || 0;
      if (workHours <= avail + 0.0001) {
        // 当日の残枠内でこの工程が完了
        procEndDate = currentDay;
        addUsedHoursOnDay(assigneeName, currentDay, workHours);
        remainingHoursInDay = Math.max(0, avail - workHours);
        workHours = 0;

        // もし当日の稼働枠をちょうど使い切った場合、次工程は翌営業日以降から開始
        if (remainingHoursInDay <= 0.0001) {
          remainingHoursInDay = null; // リセットして次工程で満額チャージ
          currentDay = getNextEffectiveWorkingDay(
            addDays(currentDay, 1),
            holidays,
            member,
            defaultHoursPerDay,
            weeklyMeetingHours
          );
        }
      } else {
        // 当日枠を全消費して翌日へ継続
        addUsedHoursOnDay(assigneeName, currentDay, avail);
        workHours -= avail;
        procEndDate = currentDay;

        // 翌稼働日へ進める
        currentDay = getNextEffectiveWorkingDay(
          addDays(currentDay, 1),
          holidays,
          member,
          defaultHoursPerDay,
          weeklyMeetingHours
        );
        const nextCap = getDayWorkingCapacity(
          currentDay,
          holidays,
          member,
          defaultHoursPerDay,
          weeklyMeetingHours
        );
        const nextUsed = getUsedHoursOnDay(assigneeName, currentDay);
        remainingHoursInDay = Math.max(0, nextCap - nextUsed);

        let guardInner = 0;
        while (remainingHoursInDay <= 0.0001 && guardInner < 365) {
          guardInner++;
          currentDay = getNextEffectiveWorkingDay(
            addDays(currentDay, 1),
            holidays,
            member,
            defaultHoursPerDay,
            weeklyMeetingHours
          );
          const c = getDayWorkingCapacity(
            currentDay,
            holidays,
            member,
            defaultHoursPerDay,
            weeklyMeetingHours
          );
          const u = getUsedHoursOnDay(assigneeName, currentDay);
          remainingHoursInDay = Math.max(0, c - u);
        }
      }
    }

    return {
      ...proc,
      startDate: procStartDate,
      endDate: procEndDate,
    };
  });

  const lastProcess = scheduled[scheduled.length - 1];
  const featureEndDate = lastProcess ? lastProcess.endDate : featureStartDate;

  return {
    scheduledProcesses: scheduled,
    featureEndDate,
    totalWorkload,
    lastDayRemainingHours: remainingHoursInDay || 0,
    finalUsageMap: internalUsageMap,
  };
}

// 日別工数割り当てアイテム
export interface DailyAllocationItem {
  featureId?: string;
  featureName: string;
  processId?: string;
  processName: string;
  assignee: string;
  hours: number;
}

// 1日あたりの工数内訳・キャパシティサマリー
export interface AssigneeDailySummary {
  assignee: string;
  processHours: number;
  meetingHours: number;
  totalHours: number;
  standardCapacity: number;
  isOverCapacity: boolean;
  overHours: number;
}

export interface DayWorkloadSummary {
  date: string;
  dayOfWeek: number;
  meetingHours: number;
  processHours: number;
  totalHours: number;
  standardCapacity: number;
  isOverCapacity: boolean;
  overHours: number;
  processes: DailyAllocationItem[];
  assigneeBreakdown?: Record<string, AssigneeDailySummary>;
  holidayName?: string;
  isHoliday: boolean;
}

// プロジェクト群の機能・工程および定例会・休日設定から、全日付の予定工数内訳マップを生成
// （工程が重なるタイミングでも、会議時間と先行工程の消化枠を正しく考慮して残枠を配分）
export function computeDailyWorkloadMap(
  features: Feature[],
  holidays: Holiday[],
  members: Member[] = [],
  defaultHoursPerDay: number = 8,
  weeklyMeetingHours?: { [dayOfWeek: number]: number },
  workloadUnit: '人時' | '人日' = '人日'
): Record<string, DayWorkloadSummary> {
  const result: Record<string, DayWorkloadSummary> = {};

  // 担当者ごとの日別消費工数を追跡
  // key: `${assignee}___${dateStr}` => hours
  const memberDailyAlloc: Record<string, number> = {};

  // ヘルパー：日付サマリーの初期化または取得
  const getOrCreateDay = (dateStr: string): DayWorkloadSummary => {
    if (!result[dateStr]) {
      const d = parseDate(dateStr);
      const dayOfWeek = d.getDay();
      const hol = isHoliday(dateStr, holidays);
      const meetingH = weeklyMeetingHours?.[dayOfWeek] || 0;

      result[dateStr] = {
        date: dateStr,
        dayOfWeek,
        meetingHours: meetingH,
        processHours: 0,
        totalHours: meetingH,
        standardCapacity: defaultHoursPerDay,
        isOverCapacity: false,
        overHours: 0,
        processes: [],
        assigneeBreakdown: {},
        holidayName: hol.holidayName,
        isHoliday: hol.isHoliday,
      };
    }
    return result[dateStr];
  };

  // 全機能・工程を順次処理
  features.forEach((feature) => {
    (feature.processes || []).forEach((proc) => {
      if (!proc.startDate || !proc.endDate) return;

      const rawVal = Number(proc.plannedWorkload) || 0;
      if (rawVal <= 0) return;

      // 時間単位に換算
      const totalHours = workloadUnit === '人時' ? rawVal : rawVal * defaultHoursPerDay;
      const member = members.find((m) => m.name === proc.assignee?.trim());
      const assigneeName = proc.assignee?.trim() || '未設定';

      // 期間内の有効稼働日を抽出
      let curr = proc.startDate;
      const activeDays: string[] = [];
      const guardMax = 365;
      let guard = 0;

      while (curr <= proc.endDate && guard < guardMax) {
        if (isMemberWorkingDay(curr, holidays, member).isWorkingDay) {
          activeDays.push(curr);
        }
        curr = addDays(curr, 1);
        guard++;
      }

      if (activeDays.length === 0) {
        activeDays.push(proc.startDate);
      }

      // 各日に時間配分
      // 会議工数および同日に既に別工程／先行工程で使われた工数を差し引いた残工数枠から割り当て
      let remainingHours = totalHours;

      for (let i = 0; i < activeDays.length; i++) {
        const dStr = activeDays[i];
        const daySummary = getOrCreateDay(dStr);
        const dayCap = getDayWorkingCapacity(dStr, holidays, member, defaultHoursPerDay, weeklyMeetingHours);

        const allocKey = `${assigneeName}___${dStr}`;
        const alreadyAllocated = memberDailyAlloc[allocKey] || 0;
        const availableInDay = Math.max(0, dayCap - alreadyAllocated);

        let allocated = 0;
        if (i === activeDays.length - 1) {
          // 最終日: 残余時間を充当
          // （自動計算されていれば availableInDay 内に収まる。手動で短縮された場合は超過分も含む）
          allocated = remainingHours;
        } else {
          // 中間日: 当日の利用可能残枠（キャパ - 会議 - 既存割り当て）を上限に充当
          allocated = Math.min(remainingHours, availableInDay);
        }

        allocated = Math.round(allocated * 10) / 10;
        remainingHours = Math.max(0, remainingHours - allocated);
        memberDailyAlloc[allocKey] = Math.round(((memberDailyAlloc[allocKey] || 0) + allocated) * 10) / 10;

        daySummary.processes.push({
          featureId: feature.id,
          featureName: feature.name,
          processId: proc.id,
          processName: proc.processType,
          assignee: proc.assignee || '未設定',
          hours: allocated,
        });

        daySummary.processHours = Math.round((daySummary.processHours + allocated) * 10) / 10;
        daySummary.totalHours = Math.round((daySummary.meetingHours + daySummary.processHours) * 10) / 10;
      }
    });
  });

  // 各日付のサマリー調整（担当者ごとのキャパシティ判定 & 合計キャパシティ算出）
  Object.values(result).forEach((daySum) => {
    // その日のユニーク担当者を抽出
    const assigneeHoursMap: Record<string, number> = {};
    daySum.processes.forEach((p) => {
      const a = p.assignee || '未設定';
      assigneeHoursMap[a] = Math.round(((assigneeHoursMap[a] || 0) + p.hours) * 10) / 10;
    });

    const uniqueAssignees = Object.keys(assigneeHoursMap);
    const workerCount = Math.max(1, uniqueAssignees.length);
    // その日の標準総キャパシティ（人数 × 日所定時間）
    daySum.standardCapacity = workerCount * defaultHoursPerDay;

    // 個別担当者の超過チェック（各担当者「会議 + 工数」が所定稼働上限 defaultHoursPerDay を超えているか）
    let maxOverHours = 0;
    let hasOverCapacityMember = false;
    const assigneeBreakdown: Record<string, AssigneeDailySummary> = {};

    uniqueAssignees.forEach((a) => {
      const memberObj = members.find((m) => m.name === a);
      const memberCap = memberObj?.dailyWorkingHours || defaultHoursPerDay;
      const procH = assigneeHoursMap[a] || 0;
      const totalForMember = Math.round((procH + daySum.meetingHours) * 10) / 10;
      const isOver = totalForMember > memberCap + 0.0001;
      const overH = isOver ? Math.round((totalForMember - memberCap) * 10) / 10 : 0;

      if (isOver) {
        hasOverCapacityMember = true;
        if (overH > maxOverHours) maxOverHours = overH;
      }

      assigneeBreakdown[a] = {
        assignee: a,
        processHours: procH,
        meetingHours: daySum.meetingHours,
        totalHours: totalForMember,
        standardCapacity: memberCap,
        isOverCapacity: isOver,
        overHours: overH,
      };
    });

    daySum.assigneeBreakdown = assigneeBreakdown;

    // 日全体の合計が総キャパを超えているか、または特定メンバーが個別超過しているか
    daySum.isOverCapacity = hasOverCapacityMember || daySum.totalHours > daySum.standardCapacity;
    daySum.overHours = daySum.isOverCapacity
      ? Math.round(Math.max(maxOverHours, daySum.totalHours - daySum.standardCapacity) * 10) / 10
      : 0;
  });

  return result;
}

export interface MemberAssignmentInfo {
  projectId: string;
  projectName: string;
  featureId: string;
  featureName: string;
  processId: string;
  processType: string;
  startDate: string;
  endDate: string;
  plannedWorkload: number;
  isDirectlyOverlapped: boolean; // 追加される休日が期間内にあるか
}

// 担当者が割り当てられているプロジェクト・工程を検索
export function findAssignedProcessesForMember(
  projects: Project[],
  memberName: string,
  holidayDate?: string
): MemberAssignmentInfo[] {
  const assignments: MemberAssignmentInfo[] = [];
  const targetName = memberName.trim().toLowerCase();

  for (const proj of projects) {
    for (const feat of proj.features || []) {
      for (const proc of feat.processes || []) {
        if (proc.assignee && proc.assignee.trim().toLowerCase() === targetName) {
          const isOverlapped = Boolean(
            holidayDate &&
              proc.startDate &&
              proc.endDate &&
              holidayDate >= proc.startDate &&
              holidayDate <= proc.endDate
          );

          assignments.push({
            projectId: proj.id,
            projectName: proj.name,
            featureId: feat.id,
            featureName: feat.name,
            processId: proc.id,
            processType: proc.processType,
            startDate: proc.startDate,
            endDate: proc.endDate,
            plannedWorkload: proc.plannedWorkload,
            isDirectlyOverlapped: isOverlapped,
          });
        }
      }
    }
  }

  return assignments;
}

// 担当者への休日追加に伴い、該当プロジェクトの期間（開始〜終了）を再計算・調整
export function rescheduleProjectsForMemberHoliday(
  projects: Project[],
  memberName: string,
  updatedMembers: Member[],
  holidays: Holiday[]
): {
  updatedProjects: Project[];
  adjustedCount: number;
} {
  const targetName = memberName.trim().toLowerCase();
  let adjustedCount = 0;

  const updatedProjects = projects.map((proj) => {
    let projectModified = false;
    const nextFeatures = (proj.features || []).map((feat) => {
      // この機能に該当メンバーの工程が含まれているかチェック
      const hasMember = (feat.processes || []).some(
        (p) => p.assignee && p.assignee.trim().toLowerCase() === targetName
      );

      if (!hasMember || (feat.processes || []).length === 0) {
        return feat;
      }

      // 機能の開始日を取得
      const featureStart = feat.processes[0]?.startDate || getTodayString();
      const workloadUnit = proj.settings?.workloadUnit || '人日';
      const hoursPerDay = proj.settings?.hoursPerDay || 8;

      // 新しいメンバー情報（追加された休日を含む）で再スケジュール
      const scheduledResult = autoScheduleProcesses(
        featureStart,
        feat.processes,
        proj.holidays || holidays,
        updatedMembers,
        workloadUnit,
        hoursPerDay,
        proj.settings?.weeklyMeetingHours
      );

      // 日程に変更が生じたかチェック
      const datesChanged = scheduledResult.scheduledProcesses.some((np, idx) => {
        const op = feat.processes[idx];
        return op && (op.startDate !== np.startDate || op.endDate !== np.endDate);
      });

      if (datesChanged) {
        projectModified = true;
        adjustedCount++;
        return {
          ...feat,
          processes: scheduledResult.scheduledProcesses,
        };
      }

      return feat;
    });

    if (projectModified) {
      return {
        ...proj,
        features: nextFeatures,
        updatedAt: new Date().toISOString().slice(0, 10),
      };
    }
    return proj;
  });

  return {
    updatedProjects,
    adjustedCount,
  };
}

// 単一機能の自動リスケジュール
// （各工程の人日・人時は固定で、複数プロジェクトに跨る同一担当者の稼働枠・開始日の残工数から自動計算・別画面不要）
export function autoRescheduleFeatureDirect(
  feature: Feature,
  project: Project,
  holidays: Holiday[],
  members: Member[] = [],
  customStartDate?: string,
  allProjects?: Project[]
): Feature {
  if (!feature.processes || feature.processes.length === 0) return feature;

  const workloadUnit = project.settings?.workloadUnit || '人日';
  const hoursPerDay = project.settings?.hoursPerDay || 8;
  const weeklyMeetingHours = project.settings?.weeklyMeetingHours;
  const activeHolidays = project.holidays || holidays;
  const activeMembers = members.length > 0 ? members : (project.members || []);

  // 他の機能（本機能以外）の工程による既存日別・担当者別使用工数を算出
  // （同一プロジェクト内の他機能 ＋ 複数プロジェクトがある場合は他プロジェクトの全機能）
  const projectsToScan = allProjects && allProjects.length > 0 ? allProjects : [project];
  const otherFeatures: Feature[] = [];
  projectsToScan.forEach((p) => {
    (p.features || []).forEach((f) => {
      if (f.id !== feature.id) {
        otherFeatures.push(f);
      }
    });
  });

  const existingUsageMap: Record<string, number> = {};

  if (otherFeatures.length > 0) {
    const otherDailyMap = computeDailyWorkloadMap(
      otherFeatures,
      activeHolidays,
      activeMembers,
      hoursPerDay,
      weeklyMeetingHours,
      workloadUnit
    );

    Object.entries(otherDailyMap).forEach(([dateStr, daySum]) => {
      daySum.processes.forEach((p) => {
        const assignee = (p.assignee || '未設定').trim();
        const key = `${assignee}___${dateStr}`;
        existingUsageMap[key] = Math.round(((existingUsageMap[key] || 0) + p.hours) * 10) / 10;
      });
    });
  }

  // 開始日：指定日 > 最初の工程の開始日 > 機能の開始日 > ベースライン日 > 今日
  const firstProc = feature.processes[0];
  const startDate =
    customStartDate ||
    firstProc?.startDate ||
    project.settings?.baselineDate ||
    getTodayString();

  const res = autoScheduleProcesses(
    startDate,
    feature.processes,
    activeHolidays,
    activeMembers,
    workloadUnit,
    hoursPerDay,
    weeklyMeetingHours,
    {
      existingUsageMap,
    }
  );

  return {
    ...feature,
    processes: res.scheduledProcesses,
  };
}

// プロジェクト内の全機能を順番に自動リスケジュール
// （各工程の人日・人時は固定で、他プロジェクトの稼働も含めて担当者ごとに1人あたり1日8時間・会議は全員に加算して隙間なく連続自動計算）
export function autoRescheduleAllFeaturesDirect(
  project: Project,
  holidays: Holiday[],
  members: Member[] = [],
  allProjects?: Project[]
): Project {
  if (!project.features || project.features.length === 0) return project;

  const workloadUnit = project.settings?.workloadUnit || '人日';
  const hoursPerDay = project.settings?.hoursPerDay || 8;
  const weeklyMeetingHours = project.settings?.weeklyMeetingHours;
  const activeHolidays = project.holidays || holidays;
  const activeMembers = members.length > 0 ? members : (project.members || []);

  let accumulatedUsageMap: Record<string, number> = {};
  // 担当者ごとの最終作業状態（直前作業の終了日および残余時間）
  const assigneeLastState: Record<string, { endDate: string; remainingHours: number }> = {};

  // 複数プロジェクトに跨るタスクがある場合、他プロジェクトの全工程を既存使用分として蓄積
  if (allProjects && allProjects.length > 0) {
    const otherProjects = allProjects.filter((p) => p.id !== project.id);
    const otherFeatures: Feature[] = [];
    otherProjects.forEach((p) => {
      (p.features || []).forEach((f) => otherFeatures.push(f));
    });

    if (otherFeatures.length > 0) {
      const otherDailyMap = computeDailyWorkloadMap(
        otherFeatures,
        activeHolidays,
        activeMembers,
        hoursPerDay,
        weeklyMeetingHours,
        workloadUnit
      );

      Object.entries(otherDailyMap).forEach(([dateStr, daySum]) => {
        daySum.processes.forEach((p) => {
          const assignee = (p.assignee || '未設定').trim();
          const key = `${assignee}___${dateStr}`;
          accumulatedUsageMap[key] = Math.round(((accumulatedUsageMap[key] || 0) + p.hours) * 10) / 10;
        });
      });

      // 他プロジェクトにおける各担当者の最新作業終了日も把握する
      otherFeatures.forEach((f) => {
        (f.processes || []).forEach((p) => {
          const a = (p.assignee || '未設定').trim();
          if (p.endDate) {
            if (!assigneeLastState[a] || p.endDate > assigneeLastState[a].endDate) {
              assigneeLastState[a] = {
                endDate: p.endDate,
                remainingHours: 0,
              };
            }
          }
        });
      });
    }
  }

  const nextFeatures = project.features.map((feat) => {
    if (!feat.processes || feat.processes.length === 0) return feat;

    const firstProc = feat.processes[0];
    const firstAssignee = (firstProc.assignee || '未設定').trim();
    const desiredStart =
      firstProc.startDate ||
      project.settings?.baselineDate ||
      getTodayString();

    let actualStart = desiredStart;
    const lastState = assigneeLastState[firstAssignee];

    // 同一担当者の先行作業がある場合：
    // 先行作業の終了日が希望開始日以降なら、その担当者の終了日残枠または翌営業日から繋ぐ
    if (lastState && lastState.endDate >= desiredStart) {
      if (lastState.remainingHours > 0.0001) {
        actualStart = lastState.endDate;
      } else {
        actualStart = getNextEffectiveWorkingDay(
          addDays(lastState.endDate, 1),
          activeHolidays,
          activeMembers.find((m) => m.name === firstAssignee),
          hoursPerDay,
          weeklyMeetingHours
        );
      }
    }

    const res = autoScheduleProcesses(
      actualStart,
      feat.processes,
      activeHolidays,
      activeMembers,
      workloadUnit,
      hoursPerDay,
      weeklyMeetingHours,
      {
        existingUsageMap: accumulatedUsageMap,
      }
    );

    // 累積使用マップと担当者ごとの最終状態を更新
    accumulatedUsageMap = { ...(res.finalUsageMap || accumulatedUsageMap) };

    const lastProc = res.scheduledProcesses[res.scheduledProcesses.length - 1];
    const lastAssignee = (lastProc?.assignee || '未設定').trim();
    assigneeLastState[lastAssignee] = {
      endDate: res.featureEndDate,
      remainingHours: res.lastDayRemainingHours || 0,
    };

    return {
      ...feat,
      processes: res.scheduledProcesses,
    };
  });

  return {
    ...project,
    features: nextFeatures,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}

// 全プロジェクトを横断して一括自動リスケジュール
// （複数プロジェクトに跨る同一担当者の稼働上限8h・会議枠を厳密に考慮し、全プロジェクトの日程を順次再編成）
export function autoRescheduleAllProjectsDirect(
  projects: Project[],
  holidays: Holiday[],
  members: Member[] = []
): Project[] {
  let accumulatedUsageMap: Record<string, number> = {};
  const assigneeLastState: Record<string, { endDate: string; remainingHours: number }> = {};

  return projects.map((project) => {
    if (!project.features || project.features.length === 0) return project;

    const workloadUnit = project.settings?.workloadUnit || '人日';
    const hoursPerDay = project.settings?.hoursPerDay || 8;
    const weeklyMeetingHours = project.settings?.weeklyMeetingHours;
    const activeHolidays = project.holidays || holidays;
    const activeMembers = members.length > 0 ? members : (project.members || []);

    const nextFeatures = project.features.map((feat) => {
      if (!feat.processes || feat.processes.length === 0) return feat;

      const firstProc = feat.processes[0];
      const firstAssignee = (firstProc.assignee || '未設定').trim();
      const desiredStart =
        firstProc.startDate ||
        project.settings?.baselineDate ||
        getTodayString();

      let actualStart = desiredStart;
      const lastState = assigneeLastState[firstAssignee];

      if (lastState && lastState.endDate >= desiredStart) {
        if (lastState.remainingHours > 0.0001) {
          actualStart = lastState.endDate;
        } else {
          actualStart = getNextEffectiveWorkingDay(
            addDays(lastState.endDate, 1),
            activeHolidays,
            activeMembers.find((m) => m.name === firstAssignee),
            hoursPerDay,
            weeklyMeetingHours
          );
        }
      }

      const res = autoScheduleProcesses(
        actualStart,
        feat.processes,
        activeHolidays,
        activeMembers,
        workloadUnit,
        hoursPerDay,
        weeklyMeetingHours,
        {
          existingUsageMap: accumulatedUsageMap,
        }
      );

      accumulatedUsageMap = { ...(res.finalUsageMap || accumulatedUsageMap) };

      const lastProc = res.scheduledProcesses[res.scheduledProcesses.length - 1];
      const lastAssignee = (lastProc?.assignee || '未設定').trim();
      assigneeLastState[lastAssignee] = {
        endDate: res.featureEndDate,
        remainingHours: res.lastDayRemainingHours || 0,
      };

      return {
        ...feat,
        processes: res.scheduledProcesses,
      };
    });

    return {
      ...project,
      features: nextFeatures,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
  });
}

// 単一工程の終了予定日を自動算出する関数
// （開始日はユーザー編集可能、終了日は予定工数と会議時間・他工程のあまり枠に収まるかを計算して自動算出）
export function calculateAutoEndDateForProcess(
  startDate: string,
  plannedWorkload: number,
  assignee: string | undefined,
  processId: string | undefined,
  features: Feature[],
  holidays: Holiday[],
  members: Member[] = [],
  workloadUnit: '人時' | '人日' = '人日',
  defaultHoursPerDay: number = 8,
  weeklyMeetingHours?: { [dayOfWeek: number]: number }
): string {
  if (!startDate) return getTodayString();
  const rawWorkload = Number(plannedWorkload) || 0;
  if (rawWorkload <= 0) return startDate;

  // 工数を時間に換算
  const workHours = workloadUnit === '人時' ? rawWorkload : rawWorkload * defaultHoursPerDay;
  const targetAssignee = (assignee || '').trim();
  const member = members.find((m) => m.name === targetAssignee);

  // 他工程（自身以外の工程）による日別・担当者別使用工数を算出
  const otherFeatures: Feature[] = features.map((f) => ({
    ...f,
    processes: (f.processes || []).filter((p) => !processId || p.id !== processId),
  }));

  const otherDailyMap = computeDailyWorkloadMap(
    otherFeatures,
    holidays,
    members,
    defaultHoursPerDay,
    weeklyMeetingHours,
    workloadUnit
  );

  const getUsedByOthersOnDay = (dateStr: string): number => {
    if (!targetAssignee) return 0;
    const daySum = otherDailyMap[dateStr];
    if (!daySum) return 0;
    return daySum.processes
      .filter((p) => (p.assignee || '').trim() === targetAssignee)
      .reduce((sum, p) => sum + p.hours, 0);
  };

  // 開始日（非稼働日であれば次の有効稼働日へ）
  let currentDay = getNextEffectiveWorkingDay(
    startDate,
    holidays,
    member,
    defaultHoursPerDay,
    weeklyMeetingHours
  );

  let remainingHours = workHours;
  let procEndDate = currentDay;
  let guard = 0;

  while (remainingHours > 0.0001 && guard < 500) {
    guard++;
    // その日の標準実働可能時間（1日の所定稼働時間 - 定例会議時間）
    const dayCap = getDayWorkingCapacity(
      currentDay,
      holidays,
      member,
      defaultHoursPerDay,
      weeklyMeetingHours
    );

    if (dayCap <= 0.0001) {
      // 稼働枠がない日（休日または会議で満杯）は翌稼働日へ
      currentDay = getNextEffectiveWorkingDay(
        addDays(currentDay, 1),
        holidays,
        member,
        defaultHoursPerDay,
        weeklyMeetingHours
      );
      continue;
    }

    // 他工程で既に使われている時間
    const usedByOthers = getUsedByOthersOnDay(currentDay);
    // 会議および他工程のあまり（残り枠）
    const availableInDay = Math.max(0, dayCap - usedByOthers);

    if (availableInDay <= 0.0001) {
      // 他工程ですでにその日の枠が埋まっている場合は翌稼働日へ
      currentDay = getNextEffectiveWorkingDay(
        addDays(currentDay, 1),
        holidays,
        member,
        defaultHoursPerDay,
        weeklyMeetingHours
      );
      continue;
    }

    // 会議や他工程のあまりに収まるかを判定
    if (remainingHours <= availableInDay + 0.0001) {
      // 本日の残り枠内に完全に収まる
      procEndDate = currentDay;
      remainingHours = 0;
      break;
    } else {
      // 本日のあまり枠を消化して残りは翌稼働日以降へ繰り越し
      remainingHours = Math.round((remainingHours - availableInDay) * 10) / 10;
      procEndDate = currentDay;
      currentDay = getNextEffectiveWorkingDay(
        addDays(currentDay, 1),
        holidays,
        member,
        defaultHoursPerDay,
        weeklyMeetingHours
      );
    }
  }

  return procEndDate;
}

