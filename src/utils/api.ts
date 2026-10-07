import { Feature, Holiday, Member, Project, ProjectSettings, WbsSnapshot, ProcessStructurePattern, Estimate, EstimateFeature } from '../types';
import { INITIAL_FEATURES, INITIAL_HOLIDAYS, INITIAL_MEMBERS, INITIAL_PROJECTS, INITIAL_SETTINGS, INITIAL_SNAPSHOTS, INITIAL_PROCESS_STRUCTURE_PATTERNS, INITIAL_ESTIMATES } from '../data/initialData';

const LOCAL_PROJECTS_KEY = 'wbs_multi_projects_v1';
const LOCAL_STORAGE_KEY = 'wbs_app_data_v1';
const LOCAL_PROCESS_PATTERNS_KEY = 'wbs_process_patterns_v1';
const LOCAL_ESTIMATES_KEY = 'wbs_estimates_v1';

export interface AppData {
  features: Feature[];
  holidays: Holiday[];
  settings: ProjectSettings;
  project?: Project;
}

// ローカルストレージから全プロジェクト読み込み
export function loadProjectsFromLocalStorage(): { projects: Project[]; activeProjectId: string } | null {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('LocalStorage load projects failed:', err);
  }
  return null;
}

// ローカルストレージへ全プロジェクト保存
export function saveProjectsToLocalStorage(projects: Project[], activeProjectId: string): void {
  try {
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify({ projects, activeProjectId }));
  } catch (err) {
    console.error('LocalStorage save projects failed:', err);
  }
}

// プロジェクト一覧取得
export async function fetchProjects(): Promise<{ projects: Project[]; activeProjectId: string }> {
  try {
    const res = await fetch('/api/projects');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.projects) && data.projects.length > 0) {
        saveProjectsToLocalStorage(data.projects, data.activeProjectId || data.projects[0].id);
        return {
          projects: data.projects,
          activeProjectId: data.activeProjectId || data.projects[0].id,
        };
      }
    }
  } catch (err) {
    console.warn('API fetchProjects failed, trying local storage:', err);
  }

  const local = loadProjectsFromLocalStorage();
  if (local && local.projects.length > 0) return local;

  return {
    projects: INITIAL_PROJECTS,
    activeProjectId: INITIAL_PROJECTS[0].id,
  };
}

// 新規プロジェクト作成
export async function createProjectApi(params: {
  name: string;
  manager: string;
  description?: string;
  workloadUnit?: '人時' | '人日';
  hoursPerDay?: number;
  weeklyMeetingHours?: { [dayOfWeek: number]: number };
}): Promise<Project | null> {
  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      const local = loadProjectsFromLocalStorage();
      if (local && Array.isArray(local.projects)) {
        saveProjectsToLocalStorage([data.project, ...local.projects], 'all');
      }
      return data.project;
    }
  } catch (err) {
    console.warn('API createProject failed, creating locally:', err);
  }

  // オフライン・フォールバック
  const today = new Date().toISOString().slice(0, 10);
  const newProject: Project = {
    id: `proj-${Date.now()}`,
    name: params.name.trim(),
    manager: params.manager.trim() || '未設定',
    description: params.description?.trim() || '',
    createdAt: today,
    updatedAt: today,
    settings: {
      projectName: params.name.trim(),
      manager: params.manager.trim() || '未設定',
      workloadUnit: params.workloadUnit || '人日',
      hoursPerDay: params.hoursPerDay || 8,
      baselineDate: today,
      showLightningLine: true,
      showBurnDown: false,
      zoomLevel: 'day',
    },
    features: [],
    holidays: [...INITIAL_HOLIDAYS],
  };

  const local = loadProjectsFromLocalStorage() || { projects: INITIAL_PROJECTS, activeProjectId: '' };
  const updatedProjects = [newProject, ...local.projects];
  saveProjectsToLocalStorage(updatedProjects, newProject.id);
  return newProject;
}

// プロジェクト情報更新（名前、管理者、概要、設定、機能群）
export async function updateProjectApi(
  id: string,
  params: {
    name?: string;
    manager?: string;
    description?: string;
    settings?: Partial<ProjectSettings>;
    features?: Feature[];
  }
): Promise<Project | null> {
  try {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      return data.project;
    }
  } catch (err) {
    console.warn('API updateProject failed, fallback to local:', err);
  }

  const local = loadProjectsFromLocalStorage();
  if (local) {
    const idx = local.projects.findIndex((p) => p.id === id);
    if (idx !== -1) {
      const existing = local.projects[idx];
      const updated: Project = {
        ...existing,
        name: params.name !== undefined ? params.name : existing.name,
        manager: params.manager !== undefined ? params.manager : existing.manager,
        description: params.description !== undefined ? params.description : existing.description,
        features: params.features !== undefined ? params.features : existing.features,
        settings: {
          ...existing.settings,
          ...(params.settings || {}),
          projectName: params.name !== undefined ? params.name : existing.settings.projectName,
          manager: params.manager !== undefined ? params.manager : existing.settings.manager,
        },
        updatedAt: new Date().toISOString().slice(0, 10),
      };
      local.projects[idx] = updated;
      saveProjectsToLocalStorage(local.projects, local.activeProjectId);
      return updated;
    }
  }
  return null;
}

// プロジェクト削除（見積管理と連携されていても見積自体は削除しない）
export async function deleteProjectApi(id: string, currentEstimates?: Estimate[]): Promise<boolean> {
  try {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      // サーバーから返却された最新の見積一覧（リンク解除済）をローカルに反映
      if (Array.isArray(data.estimates)) {
        saveEstimatesToLocalStorage(data.estimates);
      }
      if (Array.isArray(data.projects)) {
        saveProjectsToLocalStorage(data.projects, data.activeProjectId || 'all');
      }
      return true;
    }
  } catch (err) {
    console.warn('API deleteProject failed, fallback to local:', err);
  }

  const local = loadProjectsFromLocalStorage();
  if (local) {
    const filtered = local.projects.filter((p) => p.id !== id);
    const newActiveId = local.activeProjectId === id ? (filtered[0]?.id || '') : local.activeProjectId;
    saveProjectsToLocalStorage(filtered, newActiveId);

    // 見積管理データは削除せず、連携情報のみ解除
    const baseEstimates = currentEstimates || loadEstimatesFromLocalStorage();
    const updatedEstimates = baseEstimates.map((est) => {
      if (est.linkedProjectId === id) {
        return {
          ...est,
          linkedProjectId: undefined,
          linkedProjectName: undefined,
          linkedAt: undefined,
          status: (est.status === 'linked' ? 'approved' : est.status) as any,
        };
      }
      return est;
    });
    saveEstimatesToLocalStorage(updatedEstimates);

    return true;
  }
  return false;
}

// プロジェクトのWBS保存
export async function saveProjectWbsApi(
  projectId: string,
  features: Feature[],
  settings: ProjectSettings
): Promise<boolean> {
  try {
    const res = await fetch(`/api/projects/${projectId}/wbs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features, settings }),
    });
    if (res.ok) return true;
  } catch (err) {
    console.warn('API saveProjectWbs failed, updating local storage:', err);
  }

  const local = loadProjectsFromLocalStorage();
  if (local) {
    const idx = local.projects.findIndex((p) => p.id === projectId);
    if (idx !== -1) {
      local.projects[idx].features = features;
      local.projects[idx].settings = { ...local.projects[idx].settings, ...settings };
      local.projects[idx].name = settings.projectName;
      if (settings.manager) local.projects[idx].manager = settings.manager;
      local.projects[idx].updatedAt = new Date().toISOString().slice(0, 10);
      saveProjectsToLocalStorage(local.projects, local.activeProjectId);
      return true;
    }
  }
  return false;
}

// --- 互換用関数 ---
export function loadFromLocalStorage(): AppData | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('LocalStorage load failed:', err);
  }
  return null;
}

export function saveToLocalStorage(data: AppData): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('LocalStorage save failed:', err);
  }
}

export async function fetchProjectData(projectId?: string): Promise<AppData> {
  try {
    const url = projectId ? `/api/wbs?projectId=${encodeURIComponent(projectId)}` : '/api/wbs';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.features && data.settings) {
        return data;
      }
    }
  } catch (err) {
    console.warn('API fetch failed, trying local storage or defaults:', err);
  }

  return {
    features: INITIAL_FEATURES,
    holidays: INITIAL_HOLIDAYS,
    settings: INITIAL_SETTINGS,
  };
}

export async function saveProjectData(features: Feature[], settings: ProjectSettings): Promise<boolean> {
  try {
    const res = await fetch('/api/wbs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features, settings }),
    });
    return res.ok;
  } catch (err) {
    console.warn('API save failed:', err);
    return false;
  }
}

export async function saveHolidaysData(holidays: Holiday[]): Promise<boolean> {
  try {
    const res = await fetch('/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holidays }),
    });
    return res.ok;
  } catch (err) {
    console.warn('API holiday save failed:', err);
    return false;
  }
}

export async function resetAllData(): Promise<AppData> {
  try {
    const res = await fetch('/api/reset-all', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      return {
        features: INITIAL_FEATURES,
        holidays: INITIAL_HOLIDAYS,
        settings: INITIAL_SETTINGS,
      };
    }
  } catch (err) {
    console.warn('API reset failed:', err);
  }

  return {
    features: JSON.parse(JSON.stringify(INITIAL_FEATURES)),
    holidays: JSON.parse(JSON.stringify(INITIAL_HOLIDAYS)),
    settings: JSON.parse(JSON.stringify(INITIAL_SETTINGS)),
  };
}

// 休日管理以外のデータをクリア（データリセット）
export async function clearAllDataExceptHolidays(): Promise<boolean> {
  try {
    const res = await fetch('/api/clear-data', { method: 'POST' });
    if (res.ok) {
      return true;
    }
  } catch (err) {
    console.warn('API clear-data failed, falling back to local storage reset:', err);
  }

  // オフライン・フォールバック
  try {
    const local = loadProjectsFromLocalStorage();
    const preservedHolidays = local?.projects[0]?.holidays || INITIAL_HOLIDAYS;
    const today = new Date().toISOString().slice(0, 10);
    const cleanProject: Project = {
      id: `proj-${Date.now()}`,
      name: '新規プロジェクト',
      manager: '田中 敏夫',
      description: '',
      createdAt: today,
      updatedAt: today,
      settings: {
        projectName: '新規プロジェクト',
        manager: '田中 敏夫',
        workloadUnit: '人日',
        hoursPerDay: 8,
        baselineDate: today,
        showLightningLine: true,
        showBurnDown: false,
        zoomLevel: 'day',
      },
      features: [],
      snapshots: [],
      holidays: preservedHolidays,
      members: JSON.parse(JSON.stringify(INITIAL_MEMBERS)),
    };
    saveProjectsToLocalStorage([cleanProject], cleanProject.id);
    return true;
  } catch (err) {
    console.error('Failed to clear local storage data:', err);
    return false;
  }
}

// --- 担当者マスタ API ---

// 担当者一覧取得
export async function fetchProjectMembersApi(projectId: string): Promise<Member[]> {
  try {
    const res = await fetch(`/api/projects/${projectId}/members`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.members)) {
        return data.members;
      }
    }
  } catch (err) {
    console.warn('fetchProjectMembersApi failed, fallback to local:', err);
  }

  // フォールバック
  const local = loadProjectsFromLocalStorage();
  if (local) {
    const p = local.projects.find((proj) => proj.id === projectId);
    if (p && Array.isArray(p.members) && p.members.length > 0) {
      return p.members;
    }
  }

  return INITIAL_MEMBERS;
}

// 担当者一覧保存
export async function saveProjectMembersApi(projectId: string, members: Member[]): Promise<boolean> {
  try {
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members }),
    });
    return res.ok;
  } catch (err) {
    console.warn('saveProjectMembersApi failed:', err);
    return false;
  }
}

// --- WBS履歴・スナップショット API ---

// スナップショット一覧取得
export async function fetchProjectSnapshotsApi(projectId: string): Promise<WbsSnapshot[]> {
  try {
    const res = await fetch(`/api/projects/${projectId}/snapshots`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.snapshots)) {
        return data.snapshots;
      }
    }
  } catch (err) {
    console.warn('fetchProjectSnapshotsApi failed, fallback to local:', err);
  }

  const local = loadProjectsFromLocalStorage();
  if (local) {
    const p = local.projects.find((proj) => proj.id === projectId);
    if (p && Array.isArray(p.snapshots)) {
      return p.snapshots;
    }
  }

  return projectId === 'proj-1' ? INITIAL_SNAPSHOTS : [];
}

// スナップショット新規保存
export async function createProjectSnapshotApi(
  projectId: string,
  versionName: string,
  notes?: string,
  features?: Feature[],
  settings?: ProjectSettings
): Promise<WbsSnapshot | null> {
  try {
    const res = await fetch(`/api/projects/${projectId}/snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionName, notes, features, settings }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.snapshot;
    }
  } catch (err) {
    console.warn('createProjectSnapshotApi failed:', err);
  }
  return null;
}

// スナップショットの復元（ロールバック）
export async function restoreProjectSnapshotApi(projectId: string, snapshotId: string): Promise<Project | null> {
  try {
    const res = await fetch(`/api/projects/${projectId}/snapshots/${snapshotId}/restore`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      return data.project;
    }
  } catch (err) {
    console.warn('restoreProjectSnapshotApi failed:', err);
  }
  return null;
}

// スナップショット削除
export async function deleteProjectSnapshotApi(projectId: string, snapshotId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/projects/${projectId}/snapshots/${snapshotId}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('deleteProjectSnapshotApi failed:', err);
    return false;
  }
}

// エイリアス関数エクスポート
export const saveMembersApi = saveProjectMembersApi;
export const createSnapshotApi = createProjectSnapshotApi;
export const restoreSnapshotApi = restoreProjectSnapshotApi;
export const deleteSnapshotApi = deleteProjectSnapshotApi;

// --- CSV一括取り込み・データ移行用API ---

// 1. WBSプロジェクト・機能・工程取り込み
export async function importWbsApi(
  projects: Project[],
  mode: 'replace' | 'append' = 'append',
  workloadUnit?: '人日' | '人時'
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const res = await fetch('/api/import/wbs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projects, mode, workloadUnit, syncWorkloadUnit: true }),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, count: data.count };
    } else {
      const err = await res.json();
      return { success: false, error: err.error || 'WBS取り込みに失敗しました' };
    }
  } catch (err: any) {
    console.warn('importWbsApi network failed:', err);
    return { success: false, error: err.message || '通信エラーが発生しました' };
  }
}

// 2. 担当者マスタ取り込み
export async function importMembersApi(
  members: Member[],
  mode: 'replace' | 'append' = 'append'
): Promise<{ success: boolean; count?: number; members?: Member[]; error?: string }> {
  try {
    const res = await fetch('/api/import/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members, mode }),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, count: data.count, members: data.members };
    } else {
      const err = await res.json();
      return { success: false, error: err.error || '担当者マスタ取り込みに失敗しました' };
    }
  } catch (err: any) {
    console.warn('importMembersApi network failed:', err);
    return { success: false, error: err.message || '通信エラーが発生しました' };
  }
}

// 3. 休日カレンダー取り込み
export async function importHolidaysApi(
  holidays: Holiday[],
  mode: 'replace' | 'append' = 'append'
): Promise<{ success: boolean; count?: number; holidays?: Holiday[]; error?: string }> {
  try {
    const res = await fetch('/api/import/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holidays, mode }),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, count: data.count, holidays: data.holidays };
    } else {
      const err = await res.json();
      return { success: false, error: err.error || '休日カレンダー取り込みに失敗しました' };
    }
  } catch (err: any) {
    console.warn('importHolidaysApi network failed:', err);
    return { success: false, error: err.message || '通信エラーが発生しました' };
  }
}

// --- 工程構成マスタ API ---

// 工程構成パターン一覧取得
export async function fetchProcessPatternsApi(): Promise<ProcessStructurePattern[]> {
  try {
    const res = await fetch('/api/process-patterns');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.patterns) && data.patterns.length > 0) {
        try {
          localStorage.setItem(LOCAL_PROCESS_PATTERNS_KEY, JSON.stringify(data.patterns));
        } catch (e) {
          // ignore
        }
        return data.patterns;
      }
    }
  } catch (err) {
    console.warn('fetchProcessPatternsApi failed, trying localStorage:', err);
  }

  try {
    const raw = localStorage.getItem(LOCAL_PROCESS_PATTERNS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('LocalStorage load process patterns failed:', e);
  }

  return INITIAL_PROCESS_STRUCTURE_PATTERNS;
}

// 工程構成パターン一覧保存
export async function saveProcessPatternsApi(patterns: ProcessStructurePattern[]): Promise<boolean> {
  try {
    localStorage.setItem(LOCAL_PROCESS_PATTERNS_KEY, JSON.stringify(patterns));
  } catch (e) {
    console.error('LocalStorage save process patterns failed:', e);
  }

  try {
    const res = await fetch('/api/process-patterns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patterns }),
    });
    return res.ok;
  } catch (err) {
    console.warn('saveProcessPatternsApi failed:', err);
    return false;
  }
}

// 4. 工程構成マスタ取り込み (インポート)
export async function importProcessPatternsApi(
  patterns: ProcessStructurePattern[],
  mode: 'replace' | 'append' = 'append'
): Promise<{ success: boolean; count?: number; patterns?: ProcessStructurePattern[]; error?: string }> {
  try {
    const res = await fetch('/api/import/process-patterns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patterns, mode }),
    });
    if (res.ok) {
      const data = await res.json();
      try {
        localStorage.setItem(LOCAL_PROCESS_PATTERNS_KEY, JSON.stringify(data.patterns));
      } catch (e) {
        // ignore
      }
      return { success: true, count: data.count, patterns: data.patterns };
    } else {
      const err = await res.json();
      return { success: false, error: err.error || '工程構成マスタの取り込みに失敗しました' };
    }
  } catch (err: any) {
    console.warn('importProcessPatternsApi network failed, saving locally:', err);
    try {
      localStorage.setItem(LOCAL_PROCESS_PATTERNS_KEY, JSON.stringify(patterns));
      return { success: true, count: patterns.length, patterns };
    } catch (e: any) {
      return { success: false, error: e.message || 'ローカル保存に失敗しました' };
    }
  }
}

// --- 見積管理 (Estimate) API ---

// ローカルストレージから見積一覧読み込み
export function loadEstimatesFromLocalStorage(): Estimate[] {
  try {
    const raw = localStorage.getItem(LOCAL_ESTIMATES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('LocalStorage load estimates failed:', err);
  }
  return INITIAL_ESTIMATES;
}

// ローカルストレージへ見積一覧保存
export function saveEstimatesToLocalStorage(estimates: Estimate[]): void {
  try {
    localStorage.setItem(LOCAL_ESTIMATES_KEY, JSON.stringify(estimates));
  } catch (err) {
    console.error('LocalStorage save estimates failed:', err);
  }
}

// 見積一覧一括保存
export async function saveEstimatesApi(estimates: Estimate[]): Promise<boolean> {
  saveEstimatesToLocalStorage(estimates);
  try {
    const res = await fetch('/api/estimates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estimates }),
    });
    return res.ok;
  } catch (err) {
    console.warn('API saveEstimates failed:', err);
    return false;
  }
}

// 見積一覧取得
export async function fetchEstimatesApi(): Promise<Estimate[]> {
  try {
    const res = await fetch('/api/estimates');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.estimates)) {
        saveEstimatesToLocalStorage(data.estimates);
        return data.estimates;
      }
    }
  } catch (err) {
    console.warn('API fetchEstimates failed, trying localStorage:', err);
  }
  return loadEstimatesFromLocalStorage();
}

// 見積新規作成
export async function createEstimateApi(estimate: Estimate): Promise<Estimate | null> {
  try {
    const res = await fetch('/api/estimates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(estimate),
    });
    if (res.ok) {
      const data = await res.json();
      const current = loadEstimatesFromLocalStorage();
      saveEstimatesToLocalStorage([data.estimate, ...current.filter((e) => e.id !== data.estimate.id)]);
      return data.estimate;
    }
  } catch (err) {
    console.warn('API createEstimate failed, creating locally:', err);
  }

  const current = loadEstimatesFromLocalStorage();
  const updated = [estimate, ...current.filter((e) => e.id !== estimate.id)];
  saveEstimatesToLocalStorage(updated);
  return estimate;
}

// 見積更新
export async function updateEstimateApi(id: string, estimate: Partial<Estimate>): Promise<Estimate | null> {
  try {
    const res = await fetch(`/api/estimates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(estimate),
    });
    if (res.ok) {
      const data = await res.json();
      const current = loadEstimatesFromLocalStorage();
      const idx = current.findIndex((e) => e.id === id);
      if (idx !== -1) {
        current[idx] = data.estimate;
        saveEstimatesToLocalStorage([...current]);
      }
      return data.estimate;
    }
  } catch (err) {
    console.warn('API updateEstimate failed, updating locally:', err);
  }

  const current = loadEstimatesFromLocalStorage();
  const idx = current.findIndex((e) => e.id === id);
  if (idx !== -1) {
    const updated = { ...current[idx], ...estimate, updatedAt: new Date().toISOString().slice(0, 10) };
    current[idx] = updated;
    saveEstimatesToLocalStorage([...current]);
    return updated;
  }
  return null;
}

// 見積削除（プロジェクト連携されている場合はプロジェクト進捗管理からも削除）
export async function deleteEstimateApi(id: string): Promise<boolean> {
  const current = loadEstimatesFromLocalStorage();
  const target = current.find((e) => e.id === id);

  try {
    const res = await fetch(`/api/estimates/${id}`, { method: 'DELETE' });
    if (res.ok) {
      saveEstimatesToLocalStorage(current.filter((e) => e.id !== id));
      if (target?.linkedProjectId) {
        const local = loadProjectsFromLocalStorage();
        if (local) {
          const filtered = local.projects.filter(
            (p) => p.id !== target.linkedProjectId && p.estimateId !== id
          );
          saveProjectsToLocalStorage(filtered, filtered[0]?.id || '');
        }
      }
      return true;
    }
  } catch (err) {
    console.warn('API deleteEstimate failed, deleting locally:', err);
  }

  saveEstimatesToLocalStorage(current.filter((e) => e.id !== id));
  if (target?.linkedProjectId) {
    const local = loadProjectsFromLocalStorage();
    if (local) {
      const filtered = local.projects.filter(
        (p) => p.id !== target.linkedProjectId && p.estimateId !== id
      );
      saveProjectsToLocalStorage(filtered, filtered[0]?.id || '');
    }
  }
  return true;
}

// 見積からプロジェクト進捗管理へのワンクリック連携
export async function linkEstimateToProjectApi(
  estimateId: string,
  targetProjectId?: string
): Promise<{ success: boolean; project?: Project; estimate?: Estimate; error?: string }> {
  try {
    const res = await fetch(`/api/estimates/${estimateId}/link-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetProjectId }),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, project: data.project, estimate: data.estimate };
    } else {
      const err = await res.json();
      return { success: false, error: err.error || '連携に失敗しました' };
    }
  } catch (err: any) {
    console.warn('linkEstimateToProjectApi network failed:', err);
    return { success: false, error: err.message || '通信エラーが発生しました' };
  }
}
