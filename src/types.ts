export type ProcessType =
  | '設計'
  | '設計レビュー'
  | '実装'
  | '実装レビュー'
  | '単体テスト'
  | '単体テストレビュー'
  | (string & {});

export const STANDARD_PROCESSES: string[] = [
  '設計',
  '設計レビュー',
  '実装',
  '実装レビュー',
  '単体テスト',
  '単体テストレビュー',
];

export const COMMON_PROCESS_SUGGESTIONS: string[] = [
  '要件定義',
  '基本設計',
  '詳細設計',
  '設計',
  '設計レビュー',
  '実装',
  '実装レビュー',
  '単体テスト',
  '単体テストレビュー',
  '結合テスト',
  '総合テスト',
  '受入テスト',
  'リリース準備',
];

// 工程構成マスタ内の単一工程定義
export interface ProcessMasterItem {
  id: string;
  name: string;             // 工程名（例: 設計, 実装）
  defaultDays: number;      // 標準所要日数（1日あたりの標準工数、人時換算時は×1日の稼働時間）
  description?: string;     // 備考・工程概要
  order?: number;           // 並び順
}

// 工程構成パターン（複数パターンを管理可能、1つをデフォルト初期表示に指定）
export interface ProcessStructurePattern {
  id: string;
  name: string;             // パターン名（例: 標準開発パターン、フルウォーターフォール等）
  description?: string;     // パターンの説明
  isDefault: boolean;       // 新規機能追加時の初期表示パターンか
  processes: ProcessMasterItem[];
}

export interface TaskProcess {
  id: string;
  featureId: string;
  processType: ProcessType;
  assignee: string;
  plannedWorkload: number; // 人時または人日
  actualWorkload: number;  // 人時または人日
  startDate: string;       // YYYY-MM-DD
  endDate: string;         // YYYY-MM-DD
  actualProgress: number;  // 0 - 100 (%) ユーザー直接入力
  notes?: string;
}

export type MainMenuView = 'wbs' | 'estimates' | 'members';

export type EstimateStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'linked';

export interface EstimateFeature {
  id: string;
  name: string;               // 機能名
  category?: string;          // カテゴリ/モジュール
  stepCount?: number;         // 想定Step数
  estimatedWorkload: number;  // 概算予定工数（人日または人時）
  assignee?: string;          // 担当者（担当者マスタから選任可能）
  unitPrice?: number;         // 個別単価（未設定時は担当者マスタ単価または見積全体の単価を適用）
  estimatedAmount?: number;   // 概算金額（工数×単価の自動計算）
  description?: string;       // 概要・前提条件
  processPatternId?: string;  // 適用した工程構成パターンID
}

export interface Estimate {
  id: string;
  estimateNumber: string;     // 見積管理番号（例: EST-2026-001）
  title: string;              // 見積件名（プロジェクト名）
  startDate: string;          // プロジェクト開始日（必須 YYYY-MM-DD）
  clientName: string;         // 顧客名 / 発注元企業
  manager: string;            // 見積担当者
  issueDate: string;          // 見積作成日（YYYY-MM-DD）
  validUntil: string;         // 有効期限（YYYY-MM-DD）
  status: EstimateStatus;     // ステータス（下書き / 提案中 / 内諾・受注 / 失注 / プロジェクト連携済）
  workloadUnit: '人日' | '人時';
  unitPrice: number;          // 想定基準単価（例: 50,000円/人日 または 6,250円/人時）
  taxRate: number;            // 消費税率（通常0.1 = 10%）
  notes?: string;             // 前提条件・特記事項
  features: EstimateFeature[];
  linkedProjectId?: string;   // 連携先プロジェクトID
  linkedProjectName?: string; // 連携先プロジェクト名
  linkedAt?: string;          // プロジェクト連携日時
  createdAt: string;
  updatedAt: string;
}

export interface Feature {
  id: string;
  projectId?: string; // 所属プロジェクトID
  name: string;
  category?: string;
  isExpanded: boolean;
  stepCount?: number; // 機能のStep数（行数）
  processes: TaskProcess[];
  estimateFeatureId?: string; // 連携元の見積機能ID
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: 'national' | 'company' | 'weekend';
}

export const DAY_OF_WEEK_NAMES = ['日', '月', '火', '水', '木', '金', '土'] as const;

export interface ProjectSettings {
  projectName: string;
  manager?: string; // プロジェクト管理者
  workloadUnit: '人時' | '人日';
  hoursPerDay: number; // デフォルト8時間
  weeklyMeetingHours?: { [dayOfWeek: number]: number }; // 0:日, 1:月, ... 6:土 (単位: 時間)
  baselineDate: string; // YYYY-MM-DD (通常は今日)
  showLightningLine: boolean;
  showBurnDown: boolean;
  zoomLevel: 'day' | 'week';
}

export interface IndividualHoliday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string; // 休暇理由 (有休、代休、特別休暇など)
}

// 役職・職種（9段階：上から順に高位）
export const MEMBER_ROLES = [
  '社長',
  '執行役員',
  '本部長',
  '副本部長',
  '部長',
  '課長',
  '主任',
  '担当',
  '研修生',
] as const;

export type MemberRole = typeof MEMBER_ROLES[number];

// 役職の序列（数値が小さいほど上位）
export const MEMBER_ROLE_RANKS: Record<MemberRole, number> = {
  社長: 1,
  執行役員: 2,
  本部長: 3,
  副本部長: 4,
  部長: 5,
  課長: 6,
  主任: 7,
  担当: 8,
  研修生: 9,
};

// プロジェクト管理者に指定可能な役割（本部長、副本部長、部長、課長）
export const PROJECT_MANAGER_ROLES: MemberRole[] = [
  '本部長',
  '副本部長',
  '部長',
  '課長',
];

// 機能・工程の担当者に指定可能な役割（課長、主任、担当、研修生）
export const TASK_ASSIGNEE_ROLES: MemberRole[] = [
  '課長',
  '主任',
  '担当',
  '研修生',
];

// 役職文字列の正規化（旧データとの後方互換用）
export function normalizeMemberRole(role?: string): MemberRole {
  if (!role) return '担当';
  if (MEMBER_ROLES.includes(role as MemberRole)) {
    return role as MemberRole;
  }
  for (const r of MEMBER_ROLES) {
    if (role.includes(r)) {
      return r;
    }
  }
  return '担当';
}

export interface Member {
  id: string;
  name: string;
  role: MemberRole; // 9つの役職から選択
  department?: string; // 所属部署
  dailyWorkingHours: number; // 1日の実稼働時間 (デフォルト8時間、時短6時間など)
  unitPrice?: number; // 標準単価 (円/日、見積管理の工数掛け合わせ計算用)
  individualHolidays: IndividualHoliday[];
}

export interface WbsSnapshot {
  id: string;
  projectId: string;
  projectName: string;
  versionName: string; // バージョン名 (例: 初版計画, 第1回リスケ後など)
  notes?: string;      // リスケ理由や変更内容メモ
  createdAt: string;   // ISO文字列
  createdDate: string; // YYYY-MM-DD HH:mm
  features: Feature[];
  settings: ProjectSettings;
  featuresCount: number;
  totalProcessesCount: number;
  totalPlannedWorkload: number;
}

export interface Project {
  id: string;
  name: string;
  manager: string; // プロジェクト管理者
  description?: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  features: Feature[];
  holidays: Holiday[];
  members?: Member[];
  snapshots?: WbsSnapshot[];
  // 見積連携情報
  estimateId?: string;      // 連携元見積ID
  estimateNumber?: string;  // 見積管理番号（例: EST-2026-001）
  estimateTitle?: string;   // 連携見積件名
}

export interface ComputedProcessStats {
  totalPlannedDays: number;
  elapsedPlannedDays: number;
  plannedProgress: number; // 自動計算される予定進捗率 (0 - 100)
  delayRate: number;       // 実績進捗率 - 予定進捗率 (負なら遅延)
  status: 'not_started' | 'on_track' | 'delayed' | 'completed';
}

export interface BurnDownPoint {
  date: string;
  displayDate: string;
  isWorkingDay: boolean;
  idealRemaining: number;
  actualRemaining: number | null; // 今日以降はnull
  plannedRemaining: number;
}
