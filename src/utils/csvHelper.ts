import { Holiday, Member, MemberRole, normalizeMemberRole, ProcessType, Project, Feature, TaskProcess, ProcessStructurePattern, ProcessMasterItem, Estimate, EstimateFeature } from '../types';

/**
 * RFC 4180準拠のCSV行パーサー
 * ダブルクォート内のカンマや改行、エスケープ「""」に対応
 */
export function parseCsvText(text: string): string[][] {
  // BOM除去
  const cleanText = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // 連続したダブルクォートをスキップ
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // CRLF
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((field) => field !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // 最後のフィールドと行を処理
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * 日付文字列の正規化 (YYYY-MM-DD)
 */
export function normalizeDateString(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  // YYYY/MM/DD や YYYY.MM.DD を YYYY-MM-DD に統一
  const normalized = trimmed.replace(/[\/\.]/g, '-');
  const parts = normalized.split('-');
  if (parts.length === 3) {
    const y = parts[0].padStart(4, '20');
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return trimmed;
}

// ----------------------------------------------------
// 1. 休日管理 CSV パース
// ----------------------------------------------------
export interface ParsedHolidayResult {
  holidays: Holiday[];
  errors: string[];
  totalRows: number;
}

export function parseHolidaysCsv(csvText: string): ParsedHolidayResult {
  const rows = parseCsvText(csvText);
  const errors: string[] = [];
  const holidays: Holiday[] = [];

  if (rows.length === 0) {
    return { holidays: [], errors: ['CSVデータが空です'], totalRows: 0 };
  }

  // ヘッダー判定
  let startIndex = 0;
  const firstRow = rows[0].map((c) => c.toLowerCase());
  if (
    firstRow.some(
      (c) =>
        c.includes('日付') ||
        c.includes('date') ||
        c.includes('休日') ||
        c.includes('名称')
    )
  ) {
    startIndex = 1;
  }

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;

    const rawDate = row[0] || '';
    const name = row[1] || '';
    const rawType = row[2] || '';

    const date = normalizeDateString(rawDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`行 ${i + 1}: 日付形式が不正です ("${rawDate}")。YYYY-MM-DD形式で指定してください。`);
      continue;
    }

    let type: 'national' | 'company' | 'weekend' = 'company';
    const typeLower = rawType.toLowerCase();
    if (
      typeLower.includes('祝') ||
      typeLower.includes('国民') ||
      typeLower.includes('national')
    ) {
      type = 'national';
    } else if (typeLower.includes('週') || typeLower.includes('週末') || typeLower.includes('weekend')) {
      type = 'weekend';
    } else {
      type = 'company';
    }

    holidays.push({
      id: `h-import-${date}-${Math.random().toString(36).slice(2, 7)}`,
      date,
      name: name.trim() || '会社休日',
      type,
    });
  }

  // 日付順にソート
  holidays.sort((a, b) => a.date.localeCompare(b.date));

  return {
    holidays,
    errors,
    totalRows: rows.length - startIndex,
  };
}

// ----------------------------------------------------
// 2. 担当者マスタ CSV パース
// ----------------------------------------------------
export interface ParsedMemberResult {
  members: Member[];
  errors: string[];
  totalRows: number;
}

export function parseMembersCsv(csvText: string): ParsedMemberResult {
  const rows = parseCsvText(csvText);
  const errors: string[] = [];
  const members: Member[] = [];

  if (rows.length === 0) {
    return { members: [], errors: ['CSVデータが空です'], totalRows: 0 };
  }

  let startIndex = 0;
  const firstRow = rows[0].map((c) => c.toLowerCase());
  if (
    firstRow.some(
      (c) =>
        c.includes('氏名') ||
        c.includes('名前') ||
        c.includes('役職') ||
        c.includes('部署')
    )
  ) {
    startIndex = 1;
  }

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0) continue;

    const name = row[0]?.trim() || '';
    if (!name) {
      errors.push(`行 ${i + 1}: 氏名が未入力です。`);
      continue;
    }

    const rawRole = row[1]?.trim() || '';
    const role: MemberRole = normalizeMemberRole(rawRole);

    const department = row[2]?.trim() || '開発推進部';
    const hoursNum = parseFloat(row[3]);
    const dailyWorkingHours = isNaN(hoursNum) || hoursNum <= 0 ? 8 : hoursNum;

    // 単価および個別休暇日の判定（ヘッダー順: 氏名,役職,部署,1日稼働時間,標準単価,個別休暇日 または 旧形式: 氏名,役職,部署,1日稼働時間,個別休暇日）
    let unitPrice: number | undefined = undefined;
    let individualHolidaysRaw = '';

    const col4 = row[4]?.trim() || '';
    const col5 = row[5]?.trim() || '';

    // col4が数値（単価）か日付文字列かを判定
    if (/^\d+(\.\d+)?$/.test(col4.replace(/[,¥円]/g, ''))) {
      unitPrice = parseFloat(col4.replace(/[,¥円]/g, '')) || undefined;
      individualHolidaysRaw = col5;
    } else {
      individualHolidaysRaw = col4;
      if (col5 && /^\d+(\.\d+)?$/.test(col5.replace(/[,¥円]/g, ''))) {
        unitPrice = parseFloat(col5.replace(/[,¥円]/g, '')) || undefined;
      }
    }

    // デフォルト単価が未設定の場合は役割に応じて標準設定
    if (unitPrice === undefined || isNaN(unitPrice)) {
      const defaultRolePrices: Record<string, number> = {
        '執行役員': 100000,
        '本部長': 85000,
        '副本部長': 75000,
        '部長': 70000,
        '課長': 60000,
        '主任': 55000,
        '担当': 48000,
        '研修生': 32000,
      };
      unitPrice = defaultRolePrices[role] || 50000;
    }

    const individualHolidays = [];
    if (individualHolidaysRaw) {
      const dates = individualHolidaysRaw.split(/[;|\/]/);
      for (const d of dates) {
        const norm = normalizeDateString(d);
        if (/^\d{4}-\d{2}-\d{2}$/.test(norm)) {
          individualHolidays.push({
            id: `ih-imp-${norm}-${Math.random().toString(36).slice(2, 6)}`,
            date: norm,
            name: '有給休暇',
          });
        }
      }
    }

    members.push({
      id: `mem-imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      role,
      department,
      dailyWorkingHours,
      unitPrice,
      individualHolidays,
    });
  }

  return {
    members,
    errors,
    totalRows: rows.length - startIndex,
  };
}

// ----------------------------------------------------
// 3. プロジェクト・機能・工程進捗 CSV パース
// ----------------------------------------------------
export interface ParsedWbsRow {
  projectName: string;
  featureName: string;
  stepCount?: number;
  processType: ProcessType;
  assignee: string;
  plannedWorkload: number;
  actualWorkload: number;
  startDate: string;
  endDate: string;
  actualProgress: number;
  notes: string;
}

export interface ParsedWbsResult {
  rows: ParsedWbsRow[];
  projects: Project[];
  errors: string[];
  totalRows: number;
}

export function parseWbsCsv(
  csvText: string,
  defaultManager: string = '田中 敏夫',
  workloadUnit: '人日' | '人時' = '人日',
  hoursPerDay: number = 8
): ParsedWbsResult {
  const allRows = parseCsvText(csvText);
  const errors: string[] = [];
  const parsedRows: ParsedWbsRow[] = [];

  if (allRows.length === 0) {
    return { rows: [], projects: [], errors: ['CSVデータが空です'], totalRows: 0 };
  }

  let startIndex = 0;
  const firstRow = allRows[0].map((c) => c.toLowerCase());
  const hasHeader = firstRow.some(
    (c) =>
      c.includes('プロジェクト') ||
      c.includes('機能') ||
      c.includes('工程') ||
      c.includes('担当') ||
      c.includes('step') ||
      c.includes('ステップ')
  );

  let colMap = {
    project: 0,
    feature: 1,
    step: -1,
    process: 2,
    assignee: 3,
    planned: 4,
    actual: 5,
    startDate: 6,
    endDate: 7,
    progress: 8,
    notes: 9,
  };

  if (hasHeader) {
    startIndex = 1;
    // ヘッダー行から各列インデックスを自動検出
    colMap = {
      project: -1,
      feature: -1,
      step: -1,
      process: -1,
      assignee: -1,
      planned: -1,
      actual: -1,
      startDate: -1,
      endDate: -1,
      progress: -1,
      notes: -1,
    };

    firstRow.forEach((c, idx) => {
      const col = c.trim();
      if (col.includes('プロジェクト')) {
        colMap.project = idx;
      } else if (col.includes('機能')) {
        colMap.feature = idx;
      } else if (col.includes('step') || col.includes('ステップ')) {
        colMap.step = idx;
      } else if (col.includes('工程')) {
        colMap.process = idx;
      } else if (col.includes('担当')) {
        colMap.assignee = idx;
      } else if (col.includes('予定工数') || (col.includes('予定') && !col.includes('日') && !col.includes('進捗'))) {
        colMap.planned = idx;
      } else if (col.includes('実績工数') || (col.includes('実績') && !col.includes('進捗'))) {
        colMap.actual = idx;
      } else if (col.includes('開始')) {
        colMap.startDate = idx;
      } else if (col.includes('終了')) {
        colMap.endDate = idx;
      } else if (col.includes('進捗')) {
        colMap.progress = idx;
      } else if (col.includes('備考') || col.includes('メモ')) {
        colMap.notes = idx;
      }
    });

    // 検出できなかった列に対するフォールバック
    if (colMap.project === -1) colMap.project = 0;
    if (colMap.feature === -1) colMap.feature = 1;
    // Step列があるか判定
    if (colMap.step !== -1 && colMap.process === -1) {
      colMap.process = colMap.step + 1;
    } else if (colMap.process === -1) {
      colMap.process = 2;
    }
    if (colMap.assignee === -1) colMap.assignee = colMap.process + 1;
    if (colMap.planned === -1) colMap.planned = colMap.assignee + 1;
    if (colMap.actual === -1) colMap.actual = colMap.planned + 1;
    if (colMap.startDate === -1) colMap.startDate = colMap.actual + 1;
    if (colMap.endDate === -1) colMap.endDate = colMap.startDate + 1;
    if (colMap.progress === -1) colMap.progress = colMap.endDate + 1;
    if (colMap.notes === -1) colMap.notes = colMap.progress + 1;
  } else {
    // ヘッダーなしの場合、列数が11列以上かつ3列目が数値ならStep数列ありと判定
    if (allRows[0].length >= 11 && !isNaN(Number(allRows[0][2])) && allRows[0][2].trim() !== '') {
      colMap = {
        project: 0,
        feature: 1,
        step: 2,
        process: 3,
        assignee: 4,
        planned: 5,
        actual: 6,
        startDate: 7,
        endDate: 8,
        progress: 9,
        notes: 10,
      };
    }
  }

  for (let i = startIndex; i < allRows.length; i++) {
    const r = allRows[i];
    if (r.length < 3) continue;

    const projectName = (r[colMap.project] || '新規プロジェクト').trim();
    const featureName = (r[colMap.feature] || '機能').trim();
    const processType = (r[colMap.process] || '実装').trim() as ProcessType;
    const assignee = (colMap.assignee !== -1 ? r[colMap.assignee] || '' : '').trim();

    // Step数
    let stepCount: number | undefined = undefined;
    if (colMap.step !== -1 && r[colMap.step] !== undefined && r[colMap.step].trim() !== '') {
      const parsedStep = parseInt(r[colMap.step].trim(), 10);
      if (!isNaN(parsedStep)) {
        stepCount = Math.max(0, parsedStep);
      }
    }

    const plannedWorkload = colMap.planned !== -1 ? parseFloat(r[colMap.planned]) : 0;
    const actualWorkload = colMap.actual !== -1 ? parseFloat(r[colMap.actual]) : 0;

    const startDate = normalizeDateString(colMap.startDate !== -1 ? r[colMap.startDate] || '' : '');
    const endDate = normalizeDateString(colMap.endDate !== -1 ? r[colMap.endDate] || '' : '');

    let actualProgress = colMap.progress !== -1 ? parseFloat(r[colMap.progress]) : 0;
    if (isNaN(actualProgress)) actualProgress = 0;
    actualProgress = Math.max(0, Math.min(100, actualProgress));

    const notes = (colMap.notes !== -1 ? r[colMap.notes] || '' : '').trim();

    if (!projectName || !featureName || !processType) {
      errors.push(`行 ${i + 1}: プロジェクト名・機能名・工程名は必須です。`);
      continue;
    }

    parsedRows.push({
      projectName,
      featureName,
      stepCount,
      processType,
      assignee,
      plannedWorkload: isNaN(plannedWorkload) ? 0 : plannedWorkload,
      actualWorkload: isNaN(actualWorkload) ? 0 : actualWorkload,
      startDate: startDate || new Date().toISOString().slice(0, 10),
      endDate: endDate || new Date().toISOString().slice(0, 10),
      actualProgress,
      notes,
    });
  }

  // プロジェクト・機能・工程ツリーを構築
  const projectMap = new Map<string, {
    projectName: string;
    featuresMap: Map<string, { stepCount?: number; processes: TaskProcess[] }>;
  }>();

  parsedRows.forEach((row) => {
    if (!projectMap.has(row.projectName)) {
      projectMap.set(row.projectName, {
        projectName: row.projectName,
        featuresMap: new Map<string, { stepCount?: number; processes: TaskProcess[] }>(),
      });
    }

    const p = projectMap.get(row.projectName)!;
    if (!p.featuresMap.has(row.featureName)) {
      p.featuresMap.set(row.featureName, {
        stepCount: row.stepCount,
        processes: [],
      });
    } else if (row.stepCount !== undefined && p.featuresMap.get(row.featureName)!.stepCount === undefined) {
      p.featuresMap.get(row.featureName)!.stepCount = row.stepCount;
    }

    const featData = p.featuresMap.get(row.featureName)!;
    featData.processes.push({
      id: `proc-imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      featureId: '', // 後で設定
      processType: row.processType,
      assignee: row.assignee,
      plannedWorkload: row.plannedWorkload,
      actualWorkload: row.actualWorkload,
      startDate: row.startDate,
      endDate: row.endDate,
      actualProgress: row.actualProgress,
      notes: row.notes,
    });
  });

  const today = new Date().toISOString().slice(0, 10);
  const projects: Project[] = [];

  let projCounter = 1;
  projectMap.forEach((pData, pName) => {
    const projId = `proj-imp-${Date.now()}-${projCounter++}`;
    const features: Feature[] = [];
    let featCounter = 1;

    pData.featuresMap.forEach((fData, fName) => {
      const featId = `feat-imp-${Date.now()}-${featCounter++}`;
      const attachedProcesses = fData.processes.map((pr) => ({
        ...pr,
        featureId: featId,
      }));

      features.push({
        id: featId,
        projectId: projId,
        name: fName,
        category: '共通機能',
        isExpanded: true,
        stepCount: fData.stepCount,
        processes: attachedProcesses,
      });
    });

    projects.push({
      id: projId,
      name: pName,
      manager: defaultManager,
      description: 'CSV取り込みにより登録されたプロジェクト',
      createdAt: today,
      updatedAt: today,
      settings: {
        projectName: pName,
        manager: defaultManager,
        workloadUnit,
        hoursPerDay,
        baselineDate: today,
        showLightningLine: true,
        showBurnDown: false,
        zoomLevel: 'day',
      },
      features,
      holidays: [],
      members: [],
      snapshots: [],
    });
  });

  return {
    rows: parsedRows,
    projects,
    errors,
    totalRows: allRows.length - startIndex,
  };
}

// ----------------------------------------------------
// テンプレートCSVダウンロード用ユーティリティ
// ----------------------------------------------------
export function downloadCsvFile(filename: string, csvContent: string): void {
  // BOM付きUTF-8
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadWbsTemplateCsv(unit: '人日' | '人時' = '人日'): void {
  const isHours = unit === '人時';
  const content = [
    `プロジェクト名,機能名,Step数,工程名,担当者,予定工数(${unit}),実績工数(${unit}),開始予定日,終了予定日,実績進捗率(%),備考`,
    `"新基幹システム開発","会員管理・認証機能",1200,"設計","佐藤 健一",${isHours ? 40 : 5},${isHours ? 40 : 5},"2026-10-01","2026-10-07",100,"基本設計完了"`,
    `"新基幹システム開発","会員管理・認証機能",1200,"設計レビュー","山田 太郎",${isHours ? 16 : 2},${isHours ? 16 : 2},"2026-10-08","2026-10-09",100,"指摘反映済"`,
    `"新基幹システム開発","会員管理・認証機能",1200,"実装","佐藤 健一",${isHours ? 64 : 8},${isHours ? 32 : 4},"2026-10-12","2026-10-21",50,"OAuth2.0連携対応中"`,
    `"新基幹システム開発","会員管理・認証機能",1200,"実装レビュー","田中 美咲",${isHours ? 16 : 2},0,"2026-10-22","2026-10-23",0,""`,
    `"新基幹システム開発","会員管理・認証機能",1200,"単体テスト","山本 健太",${isHours ? 32 : 4},0,"2026-10-26","2026-10-29",0,""`,
    `"新基幹システム開発","会員管理・認証機能",1200,"単体テストレビュー","佐藤 健一",${isHours ? 8 : 1},0,"2026-10-30","2026-10-30",0,""`,
    `"新基幹システム開発","商品カタログ機能",2400,"設計","田中 美咲",${isHours ? 48 : 6},${isHours ? 48 : 6},"2026-10-05","2026-10-12",100,"画面一覧設計"`,
    `"新基幹システム開発","商品カタログ機能",2400,"実装","小林 誠",${isHours ? 56 : 7},${isHours ? 16 : 2},"2026-10-13","2026-10-23",30,"API接続実装中"`,
  ].join('\n');
  downloadCsvFile(`WBS進捗データ_取り込みテンプレート(${unit}).csv`, content);
}

export function downloadMembersTemplateCsv(): void {
  const content = [
    '氏名,役職,部署,所定労働時間(h),標準単価(円/日),個別休暇日',
    '"木村 宗一郎","執行役員","経営企画室",8,100000,""',
    '"渡辺 浩司","本部長","開発統括本部",8,85000,""',
    '"田中 敏夫","部長","PMO推進部",8,70000,""',
    '"山田 太郎","課長","クラウド基盤部",8,60000,""',
    '"佐藤 健一","主任","基幹開発部",8,55000,"2026-10-15;2026-10-30"',
    '"田中 美咲","主任","UI/UX開発部",8,55000,"2026-10-20"',
    '"鈴木 一郎","担当","品質管理部",8,48000,""',
    '"高橋 涼介","担当","基幹開発部",6,45000,""',
    '"小林 誠","担当","プロダクト推進部",8,48000,""',
    '"山本 健太","研修生","品質管理部",8,32000,""',
  ].join('\n');
  downloadCsvFile('担当者マスタ_取り込みテンプレート.csv', content);
}

export function exportWbsToCsv(
  projects: Project[],
  selectedProjectId: string,
  baselineDate: string
): void {
  const headers = [
    'プロジェクト名',
    '機能名',
    'Step数',
    '工程名',
    '担当者',
    '予定工数',
    '実績工数',
    '開始予定日',
    '終了予定日',
    '実績進捗率(%)',
    '備考',
  ];

  const rows: string[][] = [headers];
  const projsToExport =
    selectedProjectId === 'all'
      ? projects
      : projects.filter((p) => p.id === selectedProjectId);

  projsToExport.forEach((proj) => {
    (proj.features || []).forEach((f) => {
      const stepStr = f.stepCount !== undefined && f.stepCount !== null ? String(f.stepCount) : '';
      f.processes.forEach((p) => {
        rows.push([
          `"${proj.name.replace(/"/g, '""')}"`,
          `"${f.name.replace(/"/g, '""')}"`,
          stepStr,
          `"${p.processType}"`,
          `"${(p.assignee || '').replace(/"/g, '""')}"`,
          `${p.plannedWorkload}`,
          `${p.actualWorkload}`,
          `${p.startDate || ''}`,
          `${p.endDate || ''}`,
          `${p.actualProgress}`,
          `"${(p.notes || '').replace(/"/g, '""')}"`,
        ]);
      });
    });
  });

  const content = rows.map((r) => r.join(',')).join('\n');
  const fileName =
    selectedProjectId === 'all'
      ? `全プロジェクト横断_WBS進捗_${baselineDate}.csv`
      : `${projsToExport[0]?.name || 'プロジェクト'}_WBS進捗_${baselineDate}.csv`;

  downloadCsvFile(fileName, content);
}

export function exportMembersToCsv(members: Member[]): void {
  const headers = ['氏名', '役職', '所属部署', '1日稼働時間(h)', '標準単価(円/日)', '個別休暇日'];
  const rows: string[][] = [headers];

  members.forEach((m) => {
    const individualHolidaysStr = (m.individualHolidays || []).map((h) => h.date).join(';');
    rows.push([
      `"${m.name.replace(/"/g, '""')}"`,
      `"${m.role.replace(/"/g, '""')}"`,
      `"${(m.department || '').replace(/"/g, '""')}"`,
      `${m.dailyWorkingHours || 8}`,
      `${m.unitPrice !== undefined ? m.unitPrice : ''}`,
      `"${individualHolidaysStr}"`,
    ]);
  });

  const content = rows.map((r) => r.join(',')).join('\n');
  const today = new Date().toISOString().slice(0, 10);
  downloadCsvFile(`担当者マスタ_${today}.csv`, content);
}

export function exportHolidaysToCsv(holidays: Holiday[]): void {
  const headers = ['日付', '休日名', '種別'];
  const rows: string[][] = [headers];

  holidays.forEach((h) => {
    const typeLabel = h.type === 'national' ? '祝日' : '会社休日';
    rows.push([
      `${h.date}`,
      `"${h.name.replace(/"/g, '""')}"`,
      `"${typeLabel}"`,
    ]);
  });

  const content = rows.map((r) => r.join(',')).join('\n');
  const today = new Date().toISOString().slice(0, 10);
  downloadCsvFile(`休日管理カレンダー_${today}.csv`, content);
}

export function downloadHolidaysTemplateCsv(): void {
  const content = [
    '日付,休日名,種別',
    '2026-01-01,"元日","祝日"',
    '2026-01-12,"成人の日","祝日"',
    '2026-02-11,"建国記念の日","祝日"',
    '2026-02-23,"天皇誕生日","祝日"',
    '2026-03-20,"春分の日","祝日"',
    '2026-04-29,"昭和の日","祝日"',
    '2026-05-03,"憲法記念日","祝日"',
    '2026-05-04,"みどりの日","祝日"',
    '2026-05-05,"こどもの日","祝日"',
    '2026-05-06,"振替休日","祝日"',
    '2026-08-13,"夏季休業","会社休日"',
    '2026-08-14,"夏季休業","会社休日"',
    '2026-09-15,"会社創立記念日","会社休日"',
    '2026-12-29,"年末年始休業","会社休日"',
    '2026-12-30,"年末年始休業","会社休日"',
    '2026-12-31,"年末年始休業","会社休日"',
  ].join('\n');
  downloadCsvFile('休日カレンダー_取り込みテンプレート.csv', content);
}

export function exportProcessStructureToCsv(patterns: ProcessStructurePattern[]): void {
  const headers = ['パターン名', '初期デフォルト', '順序', '工程名', '標準所要日数(日)', '備考'];
  const rows: string[][] = [headers];

  patterns.forEach((pat) => {
    pat.processes.forEach((proc, idx) => {
      rows.push([
        `"${pat.name.replace(/"/g, '""')}"`,
        pat.isDefault ? 'はい' : 'いいえ',
        `${idx + 1}`,
        `"${proc.name.replace(/"/g, '""')}"`,
        `${proc.defaultDays}`,
        `"${(proc.description || '').replace(/"/g, '""')}"`,
      ]);
    });
  });

  const content = rows.map((r) => r.join(',')).join('\n');
  const today = new Date().toISOString().slice(0, 10);
  downloadCsvFile(`工程構成マスタ_${today}.csv`, content);
}

// ----------------------------------------------------
// 4. 工程構成マスタ CSV パース
// ----------------------------------------------------
export interface ParsedProcessStructureResult {
  patterns: ProcessStructurePattern[];
  errors: string[];
  totalRows: number;
}

export function parseProcessStructureCsv(csvText: string): ParsedProcessStructureResult {
  const rows = parseCsvText(csvText);
  const errors: string[] = [];

  if (rows.length === 0) {
    return { patterns: [], errors: ['CSVデータが空です'], totalRows: 0 };
  }

  let startIndex = 0;
  let patternCol = -1;
  let defaultCol = -1;
  let orderCol = -1;
  let nameCol = -1;
  let daysCol = -1;
  let descCol = -1;

  // ヘッダー行の検出
  const firstRow = rows[0].map((c) => c.trim().toLowerCase());
  const hasHeader = firstRow.some((c) =>
    c.includes('パターン') ||
    c.includes('工程') ||
    c.includes('日数') ||
    c.includes('工数') ||
    c.includes('デフォルト') ||
    c.includes('順序')
  );

  if (hasHeader) {
    startIndex = 1;
    firstRow.forEach((c, idx) => {
      if (c.includes('パターン')) patternCol = idx;
      else if (c.includes('デフォルト') || c.includes('初期')) defaultCol = idx;
      else if (c.includes('順序') || c.includes('no') || c.includes('番号')) orderCol = idx;
      else if (c.includes('工程')) nameCol = idx;
      else if (c.includes('日') || c.includes('工数') || c.includes('所要')) daysCol = idx;
      else if (c.includes('備考') || c.includes('説明') || c.includes('メモ') || c.includes('概要')) descCol = idx;
    });
  }

  // カラム位置の自動判定フォールバック
  if (patternCol === -1 && nameCol === -1) {
    const colCount = rows[startIndex]?.length || rows[0]?.length || 0;
    if (colCount >= 5) {
      patternCol = 0;
      defaultCol = 1;
      orderCol = 2;
      nameCol = 3;
      daysCol = 4;
      descCol = colCount >= 6 ? 5 : -1;
    } else if (colCount === 4) {
      patternCol = 0;
      nameCol = 1;
      daysCol = 2;
      descCol = 3;
    } else {
      // 2~3列の簡易形式：工程名、日数、備考
      nameCol = 0;
      daysCol = 1;
      descCol = colCount >= 3 ? 2 : -1;
    }
  }

  interface TempPatternData {
    name: string;
    isDefault: boolean;
    processes: ProcessMasterItem[];
  }
  const patternMap = new Map<string, TempPatternData>();

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || row.every((c) => !c.trim())) continue;

    // パターン名
    const patternName = patternCol >= 0 && row[patternCol]?.trim()
      ? row[patternCol].trim()
      : '取り込み工程パターン';

    // デフォルト指定
    const rawDefault = defaultCol >= 0 ? row[defaultCol]?.trim().toLowerCase() : '';
    const isDefault =
      rawDefault === 'はい' ||
      rawDefault === 'yes' ||
      rawDefault === 'true' ||
      rawDefault === '1' ||
      rawDefault === '★' ||
      rawDefault.includes('デフォルト');

    // 工程名
    const procName = nameCol >= 0 ? row[nameCol]?.trim() : '';
    if (!procName) {
      errors.push(`行 ${i + 1}: 工程名が未入力のためスキップしました。`);
      continue;
    }

    // 標準日数
    const rawDays = daysCol >= 0 ? row[daysCol]?.trim() : '';
    const parsedDays = parseFloat(rawDays);
    const days = !isNaN(parsedDays) && parsedDays > 0 ? parsedDays : 1;

    // 備考
    const desc = descCol >= 0 ? row[descCol]?.trim() : '';

    if (!patternMap.has(patternName)) {
      patternMap.set(patternName, {
        name: patternName,
        isDefault,
        processes: [],
      });
    }

    const cur = patternMap.get(patternName)!;
    if (isDefault) {
      cur.isDefault = true;
    }

    cur.processes.push({
      id: `proc-imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: procName,
      defaultDays: days,
      description: desc,
      order: cur.processes.length + 1,
    });
  }

  const patterns: ProcessStructurePattern[] = [];
  patternMap.forEach((pData, pName) => {
    patterns.push({
      id: `pat-imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: pName,
      description: `CSV取り込みにより登録された工程パターン (${pData.processes.length}工程)`,
      isDefault: pData.isDefault,
      processes: pData.processes,
    });
  });

  // 少なくとも1つはisDefaultをtrueにする
  if (patterns.length > 0 && !patterns.some((p) => p.isDefault)) {
    patterns[0].isDefault = true;
  }

  return {
    patterns,
    errors,
    totalRows: rows.length - startIndex,
  };
}

export function downloadProcessStructureTemplateCsv(): void {
  const content = [
    'パターン名,初期デフォルト,順序,工程名,標準所要日数(日),備考',
    '"標準開発パターン（設計〜単体テスト）","はい",1,"設計",5,"仕様書作成・画面設計・詳細設計"',
    '"標準開発パターン（設計〜単体テスト）","はい",2,"設計レビュー",2,"仕様レビュー・設計書承認"',
    '"標準開発パターン（設計〜単体テスト）","はい",3,"実装",8,"機能の実装・プログラミング"',
    '"標準開発パターン（設計〜単体テスト）","はい",4,"実装レビュー",2,"コードレビュー・プルリク承認"',
    '"標準開発パターン（設計〜単体テスト）","はい",5,"単体テスト",4,"テストコード作成・単体検証"',
    '"標準開発パターン（設計〜単体テスト）","はい",6,"単体テストレビュー",2,"テスト結果検証・エビデンス確認"',
    '"軽量・小規模改修","いいえ",1,"実装",3,"修正コード作成・実装"',
    '"軽量・小規模改修","いいえ",2,"実装レビュー",1,"修正内容レビュー"',
    '"軽量・小規模改修","いいえ",3,"単体テスト",2,"動作検証・デグレ確認"',
    '"軽量・小規模改修","いいえ",4,"単体テストレビュー",1,"テスト確認・承認"',
  ].join('\n');
  downloadCsvFile('工程構成マスタ_取り込みテンプレート.csv', content);
}

// --- 見積データ CSV入出力 ---

export function exportEstimatesToCsv(estimates: Estimate[]): void {
  const rows: string[] = [
    '見積管理番号,見積件名,プロジェクト開始日,顧客名,見積担当者,作成日,有効期限,ステータス,工数単位,基準単価,機能名,カテゴリ,担当者,Step数,概算工数,概算金額,備考,進捗連携状況',
  ];

  estimates.forEach((est) => {
    const statusLabel =
      est.status === 'linked'
        ? 'プロジェクト連携済'
        : est.status === 'approved'
        ? '受注・承認済'
        : est.status === 'submitted'
        ? '提出済'
        : est.status === 'rejected'
        ? '失注'
        : '下書き';

    const linkInfo = est.linkedProjectName
      ? `連携済(${est.linkedProjectName})`
      : '未連携';

    if (est.features.length === 0) {
      rows.push(
        [
          `"${est.estimateNumber}"`,
          `"${est.title}"`,
          `"${est.startDate || est.issueDate || ''}"`,
          `"${est.clientName}"`,
          `"${est.manager}"`,
          `"${est.issueDate}"`,
          `"${est.validUntil}"`,
          `"${statusLabel}"`,
          `"${est.workloadUnit}"`,
          est.unitPrice,
          '""',
          '""',
          '""',
          '',
          0,
          0,
          `"${(est.notes || '').replace(/"/g, '""')}"`,
          `"${linkInfo}"`,
        ].join(',')
      );
    } else {
      est.features.forEach((f) => {
        rows.push(
          [
            `"${est.estimateNumber}"`,
            `"${est.title}"`,
            `"${est.startDate || est.issueDate || ''}"`,
            `"${est.clientName}"`,
            `"${est.manager}"`,
            `"${est.issueDate}"`,
            `"${est.validUntil}"`,
            `"${statusLabel}"`,
            `"${est.workloadUnit}"`,
            est.unitPrice,
            `"${f.name}"`,
            `"${f.category || ''}"`,
            `"${f.assignee || ''}"`,
            f.stepCount !== undefined ? f.stepCount : '',
            f.estimatedWorkload,
            f.estimatedAmount || f.estimatedWorkload * (f.unitPrice || est.unitPrice),
            `"${(f.description || est.notes || '').replace(/"/g, '""')}"`,
            `"${linkInfo}"`,
          ].join(',')
        );
      });
    }
  });

  const today = new Date().toISOString().slice(0, 10);
  downloadCsvFile(`概算見積一覧_${today}.csv`, rows.join('\n'));
}

export function downloadEstimatesTemplateCsv(): void {
  const content = [
    '見積管理番号,見積件名,プロジェクト開始日,顧客名,見積担当者,作成日,有効期限,ステータス,工数単位,基準単価,機能名,カテゴリ,担当者,Step数,概算工数,概算金額,備考',
    '"EST-2026-101","AIチャット自動化システム","2026-10-05","サンプル商事株式会社","田中 敏夫","2026-10-01","2026-11-30","受注・承認済","人日",50000,"FAQ検索機能","共通基盤","佐藤 健一",2000,18,990000,"ナレッジ検索と自動レコメンド"',
    '"EST-2026-101","AIチャット自動化システム","2026-10-05","サンプル商事株式会社","田中 敏夫","2026-10-01","2026-11-30","受注・承認済","人日",50000,"オペレーター転送機能","連携機能","鈴木 一郎",1500,14,672000,"有人エスカレーション"',
  ].join('\n');
  downloadCsvFile('概算見積_取り込みテンプレート.csv', content);
}

export function parseEstimatesCsv(csvText: string): {
  estimates: Estimate[];
  errors: string[];
  totalRows: number;
} {
  const rows = parseCsvText(csvText);
  const errors: string[] = [];
  if (rows.length === 0) {
    return { estimates: [], errors: ['CSVファイルが空です'], totalRows: 0 };
  }

  const isHeader =
    rows[0][0]?.includes('見積') || rows[0][1]?.includes('件名') || rows[0][0]?.includes('EST');
  const startIndex = isHeader ? 1 : 0;

  // ヘッダーカラムインデックスの自動判定
  const headerRow = isHeader ? rows[0].map((c) => c.toLowerCase()) : [];
  const hasStartDateInCol2 = headerRow[2]?.includes('開始') || headerRow[2]?.includes('start');

  const estimateMap = new Map<string, { estimate: Estimate; features: EstimateFeature[] }>();
  const today = new Date().toISOString().slice(0, 10);

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2 || !row.some((cell) => cell.trim())) continue;

    let estNum = '';
    let title = '';
    let startDate = '';
    let clientName = '';
    let manager = '';
    let issueDate = '';
    let validUntil = '';
    let rawStatus = '';
    let workloadUnit: '人日' | '人時' = '人日';
    let unitPrice = 50000;
    let featName = '';
    let featCategory = '一般機能';
    let featAssignee = '';
    let featSteps: number | undefined = undefined;
    let featWorkload = 0;
    let featAmount = 0;
    let notes = '';

    if (hasStartDateInCol2 || (row[2] && /^\d{4}-\d{2}-\d{2}$/.test(row[2].trim()))) {
      // 新形式: 見積管理番号, 見積件名, プロジェクト開始日, 顧客名, 見積担当者, 作成日, 有効期限, ステータス, 工数単位, 基準単価, 機能名, カテゴリ, 担当者, Step数, 概算工数, 概算金額, 備考
      estNum = row[0]?.trim() || `EST-2026-${String(Date.now()).slice(-3)}`;
      title = row[1]?.trim() || '新規見積';
      startDate = normalizeDateString(row[2]?.trim() || today);
      clientName = row[3]?.trim() || '未指定顧客';
      manager = row[4]?.trim() || '田中 敏夫';
      issueDate = row[5]?.trim() || today;
      validUntil = row[6]?.trim() || today;
      rawStatus = row[7]?.trim() || '下書き';
      workloadUnit = (row[8]?.trim() === '人時' ? '人時' : '人日');
      unitPrice = parseFloat(row[9]?.replace(/[^0-9.]/g, '') || '50000') || 50000;

      featName = row[10]?.trim();
      featCategory = row[11]?.trim() || '一般機能';
      featAssignee = row[12]?.trim() || '';
      featSteps = row[13]?.trim() ? Math.max(0, parseInt(row[13].replace(/[^0-9]/g, ''), 10) || 0) : undefined;
      featWorkload = parseFloat(row[14]?.replace(/[^0-9.]/g, '') || '0') || 0;
      featAmount = parseFloat(row[15]?.replace(/[^0-9.]/g, '') || '0') || featWorkload * unitPrice;
      notes = row[16]?.trim() || '';
    } else {
      // 旧形式: 見積管理番号, 見積件名, 顧客名, 見積担当者, 作成日, 有効期限, ステータス, 工数単位, 単価, 機能名, カテゴリ, Step数, 概算工数, 概算金額, 備考
      estNum = row[0]?.trim() || `EST-2026-${String(Date.now()).slice(-3)}`;
      title = row[1]?.trim() || '新規見積';
      clientName = row[2]?.trim() || '未指定顧客';
      manager = row[3]?.trim() || '田中 敏夫';
      issueDate = row[4]?.trim() || today;
      startDate = issueDate; // 旧形式時は作成日を開始日初期値に
      validUntil = row[5]?.trim() || today;
      rawStatus = row[6]?.trim() || '下書き';
      workloadUnit = (row[7]?.trim() === '人時' ? '人時' : '人日');
      unitPrice = parseFloat(row[8]?.replace(/[^0-9.]/g, '') || '50000') || 50000;

      featName = row[9]?.trim();
      featCategory = row[10]?.trim() || '一般機能';
      featSteps = row[11]?.trim() ? Math.max(0, parseInt(row[11].replace(/[^0-9]/g, ''), 10) || 0) : undefined;
      featWorkload = parseFloat(row[12]?.replace(/[^0-9.]/g, '') || '0') || 0;
      featAmount = parseFloat(row[13]?.replace(/[^0-9.]/g, '') || '0') || featWorkload * unitPrice;
      notes = row[14]?.trim() || '';
    }

    let status: Estimate['status'] = 'draft';
    if (rawStatus.includes('連携')) status = 'linked';
    else if (rawStatus.includes('受注') || rawStatus.includes('承認') || rawStatus.includes('approved')) status = 'approved';
    else if (rawStatus.includes('提出') || rawStatus.includes('提案') || rawStatus.includes('submitted')) status = 'submitted';
    else if (rawStatus.includes('失注') || rawStatus.includes('rejected')) status = 'rejected';

    if (!estimateMap.has(estNum)) {
      const newEst: Estimate = {
        id: `est-csv-${Date.now()}-${estimateMap.size}`,
        estimateNumber: estNum,
        title,
        startDate: startDate || today,
        clientName,
        manager,
        issueDate,
        validUntil,
        status,
        workloadUnit,
        unitPrice,
        taxRate: 0.1,
        notes,
        features: [],
        createdAt: today,
        updatedAt: today,
      };
      estimateMap.set(estNum, { estimate: newEst, features: [] });
    }

    if (featName) {
      const entry = estimateMap.get(estNum)!;
      entry.features.push({
        id: `est-f-csv-${Date.now()}-${entry.features.length}`,
        name: featName,
        category: featCategory,
        assignee: featAssignee || undefined,
        stepCount: featSteps,
        estimatedWorkload: featWorkload,
        unitPrice,
        estimatedAmount: featAmount,
        description: notes,
      });
    }
  }

  const finalEstimates: Estimate[] = [];
  estimateMap.forEach(({ estimate, features }) => {
    finalEstimates.push({
      ...estimate,
      features,
    });
  });

  return {
    estimates: finalEstimates,
    errors,
    totalRows: rows.length - startIndex,
  };
}




