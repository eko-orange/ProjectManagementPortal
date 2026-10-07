import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { INITIAL_FEATURES, INITIAL_HOLIDAYS, INITIAL_MEMBERS, INITIAL_PROJECTS, INITIAL_SETTINGS, INITIAL_SNAPSHOTS, INITIAL_PROCESS_STRUCTURE_PATTERNS, INITIAL_ESTIMATES } from './src/data/initialData';
import { Member, Project, WbsSnapshot, Holiday, Feature, ProcessStructurePattern, Estimate, EstimateFeature } from './src/types';
import { autoScheduleProcesses } from './src/utils/dateUtils';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// データ永続化ディレクトリとファイル
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'project_store.json');

// ストア定義（複数プロジェクト対応 + 工程構成マスタ対応 + 見積管理対応）
interface AppStore {
  projects: Project[];
  activeProjectId: string;
  processPatterns?: ProcessStructurePattern[];
  estimates?: Estimate[];
}

function loadStore(): AppStore {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      // 既存の複数プロジェクト形式の場合
      if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
        const enrichedProjects = parsed.projects.map((p: Project) => ({
          ...p,
          settings: {
            ...INITIAL_SETTINGS,
            ...p.settings,
            weeklyMeetingHours: p.settings?.weeklyMeetingHours || INITIAL_SETTINGS.weeklyMeetingHours,
          },
          members: Array.isArray(p.members) && p.members.length > 0 ? p.members : [...INITIAL_MEMBERS],
          snapshots: Array.isArray(p.snapshots) ? p.snapshots : (p.id === 'proj-1' ? [...INITIAL_SNAPSHOTS] : []),
        }));
        return {
          projects: enrichedProjects,
          activeProjectId: parsed.activeProjectId || parsed.projects[0].id,
          processPatterns: Array.isArray(parsed.processPatterns) && parsed.processPatterns.length > 0
            ? parsed.processPatterns
            : JSON.parse(JSON.stringify(INITIAL_PROCESS_STRUCTURE_PATTERNS)),
          estimates: Array.isArray(parsed.estimates)
            ? parsed.estimates
            : JSON.parse(JSON.stringify(INITIAL_ESTIMATES)),
        };
      }
      // 旧形式（単一プロジェクト）からのマイグレーション
      if (parsed.features && parsed.settings) {
        const migratedProject: Project = {
          id: 'proj-1',
          name: parsed.settings.projectName || '基幹ECリニューアルプロジェクト',
          manager: parsed.settings.manager || '田中 敏夫',
          description: 'ECサイトのフルリプレイス。マイクロサービス化および決済刷新。',
          createdAt: '2026-08-01',
          updatedAt: new Date().toISOString().slice(0, 10),
          settings: {
            ...parsed.settings,
            manager: parsed.settings.manager || '田中 敏夫',
          },
          features: parsed.features,
          holidays: parsed.holidays || INITIAL_HOLIDAYS,
          members: [...INITIAL_MEMBERS],
          snapshots: [...INITIAL_SNAPSHOTS],
        };
        const defaultStore: AppStore = {
          projects: [migratedProject, ...INITIAL_PROJECTS.slice(1)],
          activeProjectId: 'proj-1',
          processPatterns: JSON.parse(JSON.stringify(INITIAL_PROCESS_STRUCTURE_PATTERNS)),
          estimates: JSON.parse(JSON.stringify(INITIAL_ESTIMATES)),
        };
        saveStore(defaultStore);
        return defaultStore;
      }
    }
  } catch (err) {
    console.error('Error loading data file, falling back to defaults:', err);
  }

  const defaultStore: AppStore = {
    projects: JSON.parse(JSON.stringify(INITIAL_PROJECTS)),
    activeProjectId: INITIAL_PROJECTS[0].id,
    processPatterns: JSON.parse(JSON.stringify(INITIAL_PROCESS_STRUCTURE_PATTERNS)),
    estimates: JSON.parse(JSON.stringify(INITIAL_ESTIMATES)),
  };
  saveStore(defaultStore);
  return defaultStore;
}

function saveStore(store: AppStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save project data to disk:', err);
  }
}

let currentStore: AppStore = loadStore();

function getActiveProject(projectId?: string): Project {
  if (projectId) {
    const found = currentStore.projects.find((p) => p.id === projectId);
    if (found) return found;
  }
  const active = currentStore.projects.find((p) => p.id === currentStore.activeProjectId);
  if (active) return active;
  if (currentStore.projects.length > 0) return currentStore.projects[0];

  // 存在しない場合のフォールバック作成
  const fallback: Project = JSON.parse(JSON.stringify(INITIAL_PROJECTS[0]));
  currentStore.projects.push(fallback);
  currentStore.activeProjectId = fallback.id;
  saveStore(currentStore);
  return fallback;
}

// --- API ルート ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// プロジェクト一覧取得
app.get('/api/projects', (req, res) => {
  res.json({
    projects: currentStore.projects,
    activeProjectId: currentStore.activeProjectId,
  });
});

// 特定プロジェクト取得
app.get('/api/projects/:id', (req, res) => {
  const project = currentStore.projects.find((p) => p.id === req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'プロジェクトが見つかりません' });
  }
  res.json({ project });
});

// 新規プロジェクト作成
app.post('/api/projects', (req, res) => {
  const { name, manager, description, workloadUnit, hoursPerDay, weeklyMeetingHours } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'プロジェクト名は必須です' });
  }

  const today = new Date().toISOString().slice(0, 10);
  const newId = `proj-${Date.now()}`;
  const newProject: Project = {
    id: newId,
    name: name.trim(),
    manager: (manager || '未設定').trim(),
    description: (description || '').trim(),
    createdAt: today,
    updatedAt: today,
    settings: {
      projectName: name.trim(),
      manager: (manager || '未設定').trim(),
      workloadUnit: workloadUnit === '人時' ? '人時' : '人日',
      hoursPerDay: Number(hoursPerDay) || 8,
      weeklyMeetingHours: weeklyMeetingHours || { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      baselineDate: today,
      showLightningLine: true,
      showBurnDown: false,
      zoomLevel: 'day',
    },
    features: [],
    holidays: [...INITIAL_HOLIDAYS],
    members: Array.isArray(currentStore.projects[0]?.members) && currentStore.projects[0].members.length > 0
      ? JSON.parse(JSON.stringify(currentStore.projects[0].members))
      : JSON.parse(JSON.stringify(INITIAL_MEMBERS)),
  };

  currentStore.projects.unshift(newProject);
  currentStore.activeProjectId = newId;
  saveStore(currentStore);

  res.status(201).json({ success: true, project: newProject });
});

// プロジェクト情報更新（名前、管理者、概要、設定など）
app.put('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const index = currentStore.projects.findIndex((p) => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'プロジェクトが見つかりません' });
  }

  const existing = currentStore.projects[index];
  const { name, manager, description, settings, features } = req.body;

  const updatedName = name !== undefined ? name.trim() : existing.name;
  const updatedManager = manager !== undefined ? manager.trim() : existing.manager;
  const updatedDescription = description !== undefined ? description.trim() : existing.description;

  const mergedSettings = {
    ...existing.settings,
    ...(settings || {}),
    projectName: updatedName,
    manager: updatedManager,
  };

  const updatedProject: Project = {
    ...existing,
    name: updatedName,
    manager: updatedManager,
    description: updatedDescription,
    features: Array.isArray(features) ? features : existing.features,
    settings: mergedSettings,
    updatedAt: new Date().toISOString().slice(0, 10),
  };

  currentStore.projects[index] = updatedProject;
  saveStore(currentStore);

  res.json({ success: true, project: updatedProject });
});

// プロジェクト削除（見積連携があっても見積自体は保持して削除しない）
app.delete('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const projectToDelete = currentStore.projects.find((p) => p.id === id);
  if (!projectToDelete) {
    return res.status(404).json({ error: '削除対象のプロジェクトが見つかりません' });
  }

  // 見積管理との連携がある場合でも、見積データ自体は削除しない（紐付け情報のみ解除しステータスを受注承認済に戻す）
  if (Array.isArray(currentStore.estimates)) {
    currentStore.estimates = currentStore.estimates.map((est) => {
      if (est.linkedProjectId === id || (projectToDelete.estimateId && est.id === projectToDelete.estimateId)) {
        return {
          ...est,
          linkedProjectId: undefined,
          linkedProjectName: undefined,
          linkedAt: undefined,
          status: est.status === 'linked' ? 'approved' : est.status,
        };
      }
      return est;
    });
  }

  // プロジェクトを削除
  currentStore.projects = currentStore.projects.filter((p) => p.id !== id);

  // もし全プロジェクトが無くなった場合、初期の空プロジェクトを1件作成して画面が壊れないようにする
  if (currentStore.projects.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const newEmptyProject: Project = {
      id: `proj-${Date.now()}`,
      name: '新規プロジェクト',
      manager: '田中 敏夫',
      description: '',
      createdAt: today,
      updatedAt: today,
      settings: {
        ...INITIAL_SETTINGS,
        projectName: '新規プロジェクト',
      },
      features: [],
      holidays: [...INITIAL_HOLIDAYS],
      members: JSON.parse(JSON.stringify(INITIAL_MEMBERS)),
    };
    currentStore.projects = [newEmptyProject];
  }

  if (currentStore.activeProjectId === id || !currentStore.projects.some((p) => p.id === currentStore.activeProjectId)) {
    currentStore.activeProjectId = currentStore.projects[0].id;
  }

  saveStore(currentStore);
  res.json({
    success: true,
    deletedId: id,
    activeProjectId: currentStore.activeProjectId,
    projects: currentStore.projects,
    estimates: currentStore.estimates,
  });
});

// 特定プロジェクトのWBS一括保存
app.post('/api/projects/:id/wbs', (req, res) => {
  const { id } = req.params;
  const index = currentStore.projects.findIndex((p) => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'プロジェクトが見つかりません' });
  }

  const { features, settings } = req.body;
  if (features) currentStore.projects[index].features = features;
  if (settings) {
    currentStore.projects[index].settings = {
      ...currentStore.projects[index].settings,
      ...settings,
    };
    if (settings.projectName) {
      currentStore.projects[index].name = settings.projectName;
    }
    if (settings.manager) {
      currentStore.projects[index].manager = settings.manager;
    }
  }
  currentStore.projects[index].updatedAt = new Date().toISOString().slice(0, 10);
  saveStore(currentStore);

  res.json({ success: true, project: currentStore.projects[index] });
});

// 特定プロジェクトの担当者マスタ取得
app.get('/api/projects/:id/members', (req, res) => {
  const { id } = req.params;
  const project = currentStore.projects.find((p) => p.id === id);
  if (!project) {
    return res.status(404).json({ error: 'プロジェクトが見つかりません' });
  }
  res.json({ members: project.members || INITIAL_MEMBERS });
});

// 特定プロジェクトの担当者マスタ更新
app.post('/api/projects/:id/members', (req, res) => {
  const { id } = req.params;
  const project = currentStore.projects.find((p) => p.id === id);
  if (!project) {
    return res.status(404).json({ error: 'プロジェクトが見つかりません' });
  }
  const { members } = req.body;
  if (Array.isArray(members)) {
    project.members = members;
    // 他のプロジェクトでも共有できるように同期
    currentStore.projects.forEach((p) => {
      p.members = members;
    });
    saveStore(currentStore);
  }
  res.json({ success: true, members: project.members });
});

// 特定プロジェクトのWBS履歴（スナップショット）一覧取得
app.get('/api/projects/:id/snapshots', (req, res) => {
  const { id } = req.params;
  const project = currentStore.projects.find((p) => p.id === id);
  if (!project) {
    return res.status(404).json({ error: 'プロジェクトが見つかりません' });
  }
  res.json({ snapshots: project.snapshots || [] });
});

// 特定プロジェクトのWBSスナップショット新規保存
app.post('/api/projects/:id/snapshots', (req, res) => {
  const { id } = req.params;
  const project = currentStore.projects.find((p) => p.id === id);
  if (!project) {
    return res.status(404).json({ error: 'プロジェクトが見つかりません' });
  }

  const { versionName, notes, features, settings } = req.body;
  if (!versionName || !versionName.trim()) {
    return res.status(400).json({ error: 'バージョン名は必須です' });
  }

  const targetFeatures = features || project.features || [];
  const targetSettings = settings || project.settings;

  const now = new Date();
  const dateFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const totalPlannedWorkload = targetFeatures.reduce(
    (sum: number, f: any) => sum + (f.processes || []).reduce((pSum: number, p: any) => pSum + (Number(p.plannedWorkload) || 0), 0),
    0
  );
  const totalProcessesCount = targetFeatures.reduce(
    (sum: number, f: any) => sum + (f.processes || []).length,
    0
  );

  const newSnapshot: WbsSnapshot = {
    id: `snap-${Date.now()}`,
    projectId: id,
    projectName: project.name,
    versionName: versionName.trim(),
    notes: (notes || '').trim(),
    createdAt: now.toISOString(),
    createdDate: dateFormatted,
    features: JSON.parse(JSON.stringify(targetFeatures)),
    settings: JSON.parse(JSON.stringify(targetSettings)),
    featuresCount: targetFeatures.length,
    totalProcessesCount,
    totalPlannedWorkload,
  };

  if (!project.snapshots) {
    project.snapshots = [];
  }
  project.snapshots.unshift(newSnapshot);
  saveStore(currentStore);

  res.status(201).json({ success: true, snapshot: newSnapshot, snapshots: project.snapshots });
});

// スナップショットのWBSを現行WBSへ復元（ロールバック）
app.post('/api/projects/:id/snapshots/:snapshotId/restore', (req, res) => {
  const { id, snapshotId } = req.params;
  const project = currentStore.projects.find((p) => p.id === id);
  if (!project) {
    return res.status(404).json({ error: 'プロジェクトが見つかりません' });
  }

  const snapshot = (project.snapshots || []).find((s) => s.id === snapshotId);
  if (!snapshot) {
    return res.status(404).json({ error: '指定されたスナップショット履歴が見つかりません' });
  }

  // 現行WBSをスナップショットの内容で復元
  project.features = JSON.parse(JSON.stringify(snapshot.features));
  if (snapshot.settings) {
    project.settings = {
      ...project.settings,
      ...JSON.parse(JSON.stringify(snapshot.settings)),
    };
  }
  project.updatedAt = new Date().toISOString().slice(0, 10);
  saveStore(currentStore);

  res.json({
    success: true,
    message: `「${snapshot.versionName}」の状態に復元しました`,
    project,
  });
});

// スナップショット削除
app.delete('/api/projects/:id/snapshots/:snapshotId', (req, res) => {
  const { id, snapshotId } = req.params;
  const project = currentStore.projects.find((p) => p.id === id);
  if (!project) {
    return res.status(404).json({ error: 'プロジェクトが見つかりません' });
  }

  project.snapshots = (project.snapshots || []).filter((s) => s.id !== snapshotId);
  saveStore(currentStore);

  res.json({ success: true, snapshots: project.snapshots });
});

// 工程構成マスタ（新規機能時の初期工程構成パターン）取得
app.get('/api/process-patterns', (req, res) => {
  const patterns = Array.isArray(currentStore.processPatterns) && currentStore.processPatterns.length > 0
    ? currentStore.processPatterns
    : INITIAL_PROCESS_STRUCTURE_PATTERNS;
  res.json({ patterns });
});

// 工程構成マスタ保存
app.post('/api/process-patterns', (req, res) => {
  const { patterns } = req.body;
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return res.status(400).json({ error: '少なくとも1つの工程構成パターンが必要です' });
  }

  // 少なくとも1つはisDefaultがtrueであることを担保
  const hasDefault = patterns.some((p: any) => p.isDefault);
  const validatedPatterns = patterns.map((p: any, idx: number) => ({
    ...p,
    isDefault: hasDefault ? Boolean(p.isDefault) : idx === 0,
  }));

  currentStore.processPatterns = validatedPatterns;
  saveStore(currentStore);

  res.json({ success: true, patterns: validatedPatterns });
});

// アクティブプロジェクト切り替え
app.post('/api/projects/active', (req, res) => {
  const { projectId } = req.body;
  if (projectId && currentStore.projects.some((p) => p.id === projectId)) {
    currentStore.activeProjectId = projectId;
    saveStore(currentStore);
    return res.json({ success: true, activeProjectId: projectId });
  }
  res.status(400).json({ error: '無効なプロジェクトIDです' });
});

// --- 旧互換用API (現在のアクティブプロジェクトを対象) ---
app.get('/api/wbs', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const project = getActiveProject(projectId);
  res.json({
    features: project.features,
    settings: project.settings,
    holidays: project.holidays,
    project,
  });
});

app.post('/api/wbs', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const project = getActiveProject(projectId);
  const { features, settings } = req.body;
  if (features) project.features = features;
  if (settings) {
    project.settings = { ...project.settings, ...settings };
    if (settings.projectName) project.name = settings.projectName;
    if (settings.manager) project.manager = settings.manager;
  }
  project.updatedAt = new Date().toISOString().slice(0, 10);
  saveStore(currentStore);
  res.json({ success: true, features: project.features });
});

app.get('/api/holidays', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const project = getActiveProject(projectId);
  res.json({ holidays: project.holidays });
});

app.post('/api/holidays', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const project = getActiveProject(projectId);
  const { holidays } = req.body;
  if (Array.isArray(holidays)) {
    project.holidays = holidays;
    saveStore(currentStore);
  }
  res.json({ success: true, holidays: project.holidays });
});

app.post('/api/holidays/reset', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const project = getActiveProject(projectId);
  project.holidays = [...INITIAL_HOLIDAYS];
  saveStore(currentStore);
  res.json({ success: true, holidays: project.holidays });
});

app.get('/api/settings', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const project = getActiveProject(projectId);
  res.json({ settings: project.settings });
});

app.post('/api/settings', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const project = getActiveProject(projectId);
  const { settings } = req.body;
  if (settings) {
    project.settings = { ...project.settings, ...settings };
    if (settings.projectName) project.name = settings.projectName;
    if (settings.manager) project.manager = settings.manager;
    saveStore(currentStore);
  }
  res.json({ success: true, settings: project.settings });
});

// 初期データへ全リセット
app.post('/api/reset-all', (req, res) => {
  currentStore = {
    projects: JSON.parse(JSON.stringify(INITIAL_PROJECTS)),
    activeProjectId: INITIAL_PROJECTS[0].id,
    processPatterns: JSON.parse(JSON.stringify(INITIAL_PROCESS_STRUCTURE_PATTERNS)),
    estimates: JSON.parse(JSON.stringify(INITIAL_ESTIMATES)),
  };
  saveStore(currentStore);
  res.json({ success: true, store: currentStore });
});

// データリセット（休日管理以外のデータをクリア）
app.post('/api/clear-data', (req, res) => {
  // 現在設定されている休日データを退避して保持
  const preservedHolidays: Holiday[] =
    currentStore.projects.find((p) => Array.isArray(p.holidays) && p.holidays.length > 0)?.holidays ||
    INITIAL_HOLIDAYS;

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
    features: [], // 機能・WBS工程は完全クリア
    snapshots: [], // スナップショット履歴も完全クリア
    holidays: JSON.parse(JSON.stringify(preservedHolidays)), // 休日管理のデータのみ保持
    members: JSON.parse(JSON.stringify(INITIAL_MEMBERS)).map((m: Member) => ({
      ...m,
      individualHolidays: [], // 個別休暇も初期化
    })),
  };

  currentStore = {
    projects: [cleanProject],
    activeProjectId: cleanProject.id,
    processPatterns: currentStore.processPatterns,
    estimates: [],
  };
  saveStore(currentStore);
  res.json({ success: true, store: currentStore });
});

// --- 見積管理 (Estimate) API ---

// 見積一覧取得
app.get('/api/estimates', (req, res) => {
  if (!currentStore.estimates) {
    currentStore.estimates = JSON.parse(JSON.stringify(INITIAL_ESTIMATES));
    saveStore(currentStore);
  }
  res.json({ estimates: currentStore.estimates });
});

// 単一見積取得
app.get('/api/estimates/:id', (req, res) => {
  const estimate = (currentStore.estimates || []).find((e) => e.id === req.params.id);
  if (!estimate) {
    return res.status(404).json({ error: '見積が見つかりません' });
  }
  res.json({ estimate });
});

// 新規見積作成 (一括保存にも対応)
app.post('/api/estimates', (req, res) => {
  // 一括保存の場合
  if (Array.isArray(req.body.estimates)) {
    currentStore.estimates = req.body.estimates;
    saveStore(currentStore);
    return res.json({ success: true, estimates: currentStore.estimates });
  }

  const estimateData: Estimate = req.body;
  if (!estimateData.title?.trim()) {
    return res.status(400).json({ error: '見積件名は必須です' });
  }
  if (!estimateData.startDate?.trim()) {
    return res.status(400).json({ error: 'プロジェクト開始日は必須です' });
  }

  const today = new Date().toISOString().slice(0, 10);
  const newEstimate: Estimate = {
    ...estimateData,
    id: estimateData.id || `est-${Date.now()}`,
    estimateNumber: estimateData.estimateNumber?.trim() || `EST-2026-${String(Date.now()).slice(-3)}`,
    title: estimateData.title.trim(),
    startDate: estimateData.startDate.trim(),
    clientName: (estimateData.clientName || '未指定').trim(),
    manager: (estimateData.manager || '田中 敏夫').trim(),
    issueDate: estimateData.issueDate || today,
    validUntil: estimateData.validUntil || today,
    status: estimateData.status || 'draft',
    workloadUnit: estimateData.workloadUnit || '人日',
    unitPrice: Number(estimateData.unitPrice) || 50000,
    taxRate: Number(estimateData.taxRate) || 0.1,
    notes: estimateData.notes || '',
    features: Array.isArray(estimateData.features) ? estimateData.features : [],
    createdAt: estimateData.createdAt || today,
    updatedAt: today,
  };

  if (!currentStore.estimates) {
    currentStore.estimates = [];
  }
  currentStore.estimates.unshift(newEstimate);
  saveStore(currentStore);

  res.status(201).json({ success: true, estimate: newEstimate });
});

// 見積一括更新
app.put('/api/estimates', (req, res) => {
  if (Array.isArray(req.body.estimates)) {
    currentStore.estimates = req.body.estimates;
    saveStore(currentStore);
    return res.json({ success: true, estimates: currentStore.estimates });
  }
  res.status(400).json({ error: '無効なデータ形式です' });
});

// 見積情報更新
app.put('/api/estimates/:id', (req, res) => {
  const { id } = req.params;
  if (!currentStore.estimates) {
    currentStore.estimates = JSON.parse(JSON.stringify(INITIAL_ESTIMATES));
  }
  const index = currentStore.estimates.findIndex((e) => e.id === id);
  if (index === -1) {
    return res.status(404).json({ error: '見積が見つかりません' });
  }

  const existing = currentStore.estimates[index];
  const updatedData: Partial<Estimate> = req.body;
  const today = new Date().toISOString().slice(0, 10);

  const updatedEstimate: Estimate = {
    ...existing,
    ...updatedData,
    id: existing.id, // ID不変
    startDate: updatedData.startDate !== undefined ? updatedData.startDate.trim() : existing.startDate,
    updatedAt: today,
  };

  currentStore.estimates[index] = updatedEstimate;

  // 連携先プロジェクトが存在する場合、プロジェクト名や見積番号を同期
  if (updatedEstimate.linkedProjectId) {
    const linkedProj = currentStore.projects.find((p) => p.id === updatedEstimate.linkedProjectId);
    if (linkedProj) {
      linkedProj.estimateNumber = updatedEstimate.estimateNumber;
      linkedProj.estimateTitle = updatedEstimate.title;
      linkedProj.updatedAt = today;
    }
  }

  saveStore(currentStore);
  res.json({ success: true, estimate: updatedEstimate });
});

// 見積削除（連携先プロジェクトがある場合、プロジェクト進捗管理からも対象プロジェクトを完全削除）
app.delete('/api/estimates/:id', (req, res) => {
  const { id } = req.params;
  if (!currentStore.estimates) return res.status(404).json({ error: '見積が見つかりません' });

  const index = currentStore.estimates.findIndex((e) => e.id === id);
  if (index === -1) {
    return res.status(404).json({ error: '見積が見つかりません' });
  }

  const deleted = currentStore.estimates.splice(index, 1)[0];

  // 見積管理でプロジェクト連携されていた場合、プロジェクト進捗管理からも削除する
  if (deleted.linkedProjectId) {
    const targetProjId = deleted.linkedProjectId;
    currentStore.projects = currentStore.projects.filter(
      (p) => p.id !== targetProjId && p.estimateId !== id
    );

    // プロジェクトが0件になった場合は新規プロジェクトを1件自動補填
    if (currentStore.projects.length === 0) {
      const today = new Date().toISOString().slice(0, 10);
      const newEmptyProject: Project = {
        id: `proj-${Date.now()}`,
        name: '新規プロジェクト',
        manager: '田中 敏夫',
        description: '',
        createdAt: today,
        updatedAt: today,
        settings: {
          ...INITIAL_SETTINGS,
          projectName: '新規プロジェクト',
        },
        features: [],
        holidays: [...INITIAL_HOLIDAYS],
        members: JSON.parse(JSON.stringify(INITIAL_MEMBERS)),
      };
      currentStore.projects = [newEmptyProject];
    }

    if (
      currentStore.activeProjectId === targetProjId ||
      !currentStore.projects.some((p) => p.id === currentStore.activeProjectId)
    ) {
      currentStore.activeProjectId = currentStore.projects[0].id;
    }
  } else {
    // 連携されていない場合は、万が一紐付いていた場合のプロジェクトの紐付け情報のみクリア
    currentStore.projects.forEach((p) => {
      if (p.estimateId === id) {
        delete p.estimateId;
        delete p.estimateNumber;
        delete p.estimateTitle;
      }
    });
  }

  saveStore(currentStore);
  res.json({
    success: true,
    deletedEstimate: deleted,
    projects: currentStore.projects,
    activeProjectId: currentStore.activeProjectId,
  });
});

// 見積からプロジェクト進捗管理へのワンクリック連携（開始日から各担当者の開始日〜終了日を自動スケジュールして登録）
app.post('/api/estimates/:id/link-project', (req, res) => {
  const { id } = req.params;
  const { targetProjectId } = req.body;

  if (!currentStore.estimates) {
    currentStore.estimates = JSON.parse(JSON.stringify(INITIAL_ESTIMATES));
  }
  const estimate = currentStore.estimates.find((e) => e.id === id);
  if (!estimate) {
    return res.status(404).json({ error: '見積が見つかりません' });
  }

  const today = new Date().toISOString().slice(0, 10);
  const projectStartDate = estimate.startDate || today;
  let targetProject: Project;

  const projectHolidays = [...INITIAL_HOLIDAYS];
  const projectMembers: Member[] = Array.isArray(currentStore.projects[0]?.members) && currentStore.projects[0].members.length > 0
    ? JSON.parse(JSON.stringify(currentStore.projects[0].members))
    : JSON.parse(JSON.stringify(INITIAL_MEMBERS));

  if (targetProjectId) {
    // 既存プロジェクトとの連携紐付け
    const found = currentStore.projects.find((p) => p.id === targetProjectId);
    if (!found) {
      return res.status(404).json({ error: '指定された連携先プロジェクトが見つかりません' });
    }
    targetProject = found;
    targetProject.estimateId = estimate.id;
    targetProject.estimateNumber = estimate.estimateNumber;
    targetProject.estimateTitle = estimate.title;
    targetProject.updatedAt = today;
  } else {
    // 新規プロジェクトを自動生成して連携
    const patterns = currentStore.processPatterns || INITIAL_PROCESS_STRUCTURE_PATTERNS;
    const defaultPattern = patterns.find((p) => p.isDefault) || patterns[0];
    const newProjId = `proj-${Date.now()}`;

    // 各機能・工程を開始日（estimate.startDate）から自動スケジュール
    let cumulativeUsageMap: Record<string, number> = {};

    const newFeatures: Feature[] = (estimate.features || []).map((ef, fIdx) => {
      const featId = `feat-${newProjId}-${fIdx + 1}`;
      const totalPatDays = defaultPattern.processes.reduce((sum, p) => sum + (p.defaultDays || 1), 0);
      const featureAssignee = ef.assignee?.trim() || '';

      let initialProcs: any[] = [];
      if (Array.isArray(ef.processes) && ef.processes.length > 0) {
        // 見積で登録された工程をそのままWBS工程として採用
        initialProcs = ef.processes.map((ep, pIdx) => {
          const procAssignee = (ep.assignee || featureAssignee || '').trim();
          const procWorkload = Math.max(0.1, Number(ep.workload) || 1);
          return {
            id: `proc-${featId}-${pIdx + 1}`,
            featureId: featId,
            processType: ep.name || '実装',
            assignee: procAssignee,
            plannedWorkload: procWorkload,
            actualWorkload: 0,
            startDate: projectStartDate,
            endDate: projectStartDate,
            actualProgress: 0,
            notes: ep.notes || '',
          };
        });
      } else {
        const totalPatDays = defaultPattern.processes.reduce((sum, p) => sum + (p.defaultDays || 1), 0);
        initialProcs = defaultPattern.processes.map((patProc, pIdx) => {
          const ratio = (patProc.defaultDays || 1) / (totalPatDays || 1);
          const workload = Math.max(0.5, Math.round((ef.estimatedWorkload || 10) * ratio * 10) / 10);
          return {
            id: `proc-${featId}-${pIdx + 1}`,
            featureId: featId,
            processType: patProc.name,
            assignee: featureAssignee, // 見積で指定された担当者を各工程に適用
            plannedWorkload: workload,
            actualWorkload: 0,
            startDate: projectStartDate,
            endDate: projectStartDate,
            actualProgress: 0,
            notes: patProc.description || '',
          };
        });
      }

      // 開始日から各担当者の開始日〜終了日を自動スケジュール
      const schedResult = autoScheduleProcesses(
        projectStartDate,
        initialProcs,
        projectHolidays,
        projectMembers,
        estimate.workloadUnit || '人日',
        8,
        undefined,
        { existingUsageMap: cumulativeUsageMap }
      );

      // 同一担当者の稼働時間が重複しないよう累積使用時間を保持
      cumulativeUsageMap = schedResult.finalUsageMap || cumulativeUsageMap;

      return {
        id: featId,
        projectId: newProjId,
        name: ef.name,
        category: ef.category || '一般機能',
        isExpanded: true,
        stepCount: ef.stepCount,
        estimateFeatureId: ef.id,
        processes: schedResult.scheduledProcesses,
      };
    });

    targetProject = {
      id: newProjId,
      name: estimate.title,
      manager: estimate.manager || '田中 敏夫',
      description: estimate.notes || `${estimate.clientName}向け見積(${estimate.estimateNumber})より進捗管理へ連携`,
      createdAt: today,
      updatedAt: today,
      estimateId: estimate.id,
      estimateNumber: estimate.estimateNumber,
      estimateTitle: estimate.title,
      settings: {
        ...INITIAL_SETTINGS,
        projectName: estimate.title,
        manager: estimate.manager || '田中 敏夫',
        workloadUnit: estimate.workloadUnit || '人日',
        baselineDate: projectStartDate,
        showLightningLine: true,
        showBurnDown: false,
        zoomLevel: 'day',
      },
      features: newFeatures,
      holidays: projectHolidays,
      members: projectMembers,
      snapshots: [],
    };

    currentStore.projects.unshift(targetProject);
    currentStore.activeProjectId = targetProject.id;
  }

  // 見積ステータスを連携済みに更新
  estimate.status = 'linked';
  estimate.linkedProjectId = targetProject.id;
  estimate.linkedProjectName = targetProject.name;
  estimate.linkedAt = today;
  estimate.updatedAt = today;

  saveStore(currentStore);
  res.json({ success: true, project: targetProject, estimate });
});

// --- CSVデータ移行・インポートAPI ---

// 1. WBS進捗・プロジェクト取り込み
app.post('/api/import/wbs', (req, res) => {
  const { projects: importedProjects, mode = 'append', targetProjectId, workloadUnit, syncWorkloadUnit = true } = req.body;

  if (!Array.isArray(importedProjects) || importedProjects.length === 0) {
    return res.status(400).json({ error: '取り込み対象のプロジェクトデータがありません' });
  }

  const today = new Date().toISOString().slice(0, 10);
  const commonMembers = currentStore.projects[0]?.members || INITIAL_MEMBERS;
  const commonHolidays = currentStore.projects[0]?.holidays || INITIAL_HOLIDAYS;

  if (mode === 'replace') {
    // 全プロジェクトを総入れ替え
    const newProjects: Project[] = importedProjects.map((p, idx) => ({
      ...p,
      id: p.id || `proj-imp-${Date.now()}-${idx + 1}`,
      createdAt: p.createdAt || today,
      updatedAt: today,
      settings: {
        ...p.settings,
        workloadUnit: workloadUnit || p.settings?.workloadUnit || '人日',
      },
      members: JSON.parse(JSON.stringify(commonMembers)),
      holidays: JSON.parse(JSON.stringify(commonHolidays)),
      snapshots: [],
    }));

    currentStore.projects = newProjects;
    currentStore.activeProjectId = newProjects[0].id;
    saveStore(currentStore);
    return res.json({ success: true, count: newProjects.length, store: currentStore });
  } else {
    // 既存データに追加・マージ (append)
    importedProjects.forEach((impProj) => {
      // 同名プロジェクトがあるか
      const existingIdx = currentStore.projects.findIndex(
        (p) => p.name.trim().toLowerCase() === impProj.name.trim().toLowerCase()
      );

      if (existingIdx !== -1) {
        // 既存プロジェクトに機能を追加・マージ
        const target = currentStore.projects[existingIdx];
        if (!target.features) target.features = [];

        // 工数単位の同期
        if (syncWorkloadUnit && (impProj.settings?.workloadUnit || workloadUnit)) {
          if (!target.settings) {
            target.settings = { ...impProj.settings };
          }
          target.settings.workloadUnit = impProj.settings?.workloadUnit || workloadUnit || target.settings.workloadUnit;
        }

        (impProj.features || []).forEach((impFeat: Feature) => {
          const featIdx = target.features.findIndex((f) => f.name.trim() === impFeat.name.trim());
          if (featIdx !== -1) {
            // 同名機能内の工程を追加または更新
            const targetFeat = target.features[featIdx];
            impFeat.processes.forEach((impProc) => {
              const procIdx = targetFeat.processes.findIndex(
                (pr) => pr.processType === impProc.processType && pr.assignee === impProc.assignee
              );
              if (procIdx !== -1) {
                targetFeat.processes[procIdx] = { ...impProc, featureId: targetFeat.id };
              } else {
                targetFeat.processes.push({ ...impProc, featureId: targetFeat.id });
              }
            });
          } else {
            // 新規機能として追加
            target.features.push({
              ...impFeat,
              projectId: target.id,
              processes: impFeat.processes.map((pr) => ({ ...pr, featureId: impFeat.id })),
            });
          }
        });
        target.updatedAt = today;
      } else {
        // 新規プロジェクトとして追加
        currentStore.projects.push({
          ...impProj,
          id: impProj.id || `proj-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: today,
          updatedAt: today,
          members: JSON.parse(JSON.stringify(commonMembers)),
          holidays: JSON.parse(JSON.stringify(commonHolidays)),
          snapshots: [],
        });
      }
    });

    saveStore(currentStore);
    return res.json({ success: true, count: importedProjects.length, store: currentStore });
  }
});

// 2. 担当者マスタ取り込み
app.post('/api/import/members', (req, res) => {
  const { members: importedMembers, mode = 'append' } = req.body;

  if (!Array.isArray(importedMembers) || importedMembers.length === 0) {
    return res.status(400).json({ error: '取り込み対象の担当者データがありません' });
  }

  let finalMembers: Member[] = [];

  if (mode === 'replace') {
    // 担当者マスタを総入れ替え
    finalMembers = importedMembers;
  } else {
    // 既存の担当者に追加・更新
    const existingMembers = currentStore.projects[0]?.members || INITIAL_MEMBERS;
    const memberMap = new Map<string, Member>();
    existingMembers.forEach((m) => memberMap.set(m.name.trim(), { ...m }));

    importedMembers.forEach((imp) => {
      const key = imp.name.trim();
      if (memberMap.has(key)) {
        const current = memberMap.get(key)!;
        memberMap.set(key, {
          ...current,
          role: imp.role || current.role,
          department: imp.department || current.department,
          dailyWorkingHours: imp.dailyWorkingHours || current.dailyWorkingHours,
          individualHolidays: [
            ...(current.individualHolidays || []),
            ...(imp.individualHolidays || []),
          ],
        });
      } else {
        memberMap.set(key, imp);
      }
    });

    finalMembers = Array.from(memberMap.values());
  }

  // 全プロジェクトの担当者マスタに反映
  currentStore.projects.forEach((p) => {
    p.members = JSON.parse(JSON.stringify(finalMembers));
  });
  saveStore(currentStore);

  res.json({ success: true, count: finalMembers.length, members: finalMembers });
});

// 3. 休日管理カレンダー取り込み
app.post('/api/import/holidays', (req, res) => {
  const { holidays: importedHolidays, mode = 'append' } = req.body;

  if (!Array.isArray(importedHolidays) || importedHolidays.length === 0) {
    return res.status(400).json({ error: '取り込み対象の休日データがありません' });
  }

  let finalHolidays: Holiday[] = [];

  if (mode === 'replace') {
    // 休日カレンダーを総入れ替え
    finalHolidays = importedHolidays;
  } else {
    // 既存休日に追加・更新
    const existingHolidays = currentStore.projects[0]?.holidays || INITIAL_HOLIDAYS;
    const holidayMap = new Map<string, Holiday>();
    existingHolidays.forEach((h) => holidayMap.set(h.date, { ...h }));

    importedHolidays.forEach((h) => {
      holidayMap.set(h.date, h);
    });

    finalHolidays = Array.from(holidayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  // 全プロジェクトの休日に反映
  currentStore.projects.forEach((p) => {
    p.holidays = JSON.parse(JSON.stringify(finalHolidays));
  });
  saveStore(currentStore);

  res.json({ success: true, count: finalHolidays.length, holidays: finalHolidays });
});

// 4. 工程構成マスタ取り込み
app.post('/api/import/process-patterns', (req, res) => {
  const { patterns: importedPatterns, mode = 'append' } = req.body;

  if (!Array.isArray(importedPatterns) || importedPatterns.length === 0) {
    return res.status(400).json({ error: '取り込み対象の工程構成データがありません' });
  }

  let finalPatterns: ProcessStructurePattern[] = [];

  if (mode === 'replace') {
    finalPatterns = importedPatterns;
  } else {
    // 既存パターンにマージまたは追加
    const existing = currentStore.processPatterns || INITIAL_PROCESS_STRUCTURE_PATTERNS;
    const patternMap = new Map<string, ProcessStructurePattern>();
    existing.forEach((p) => patternMap.set(p.name.trim(), { ...p }));

    importedPatterns.forEach((p) => {
      patternMap.set(p.name.trim(), p);
    });

    finalPatterns = Array.from(patternMap.values());
  }

  // 少なくとも1つはisDefaultがtrueであることを担保
  const hasDefault = finalPatterns.some((p) => p.isDefault);
  finalPatterns = finalPatterns.map((p, idx) => ({
    ...p,
    isDefault: hasDefault ? Boolean(p.isDefault) : idx === 0,
  }));

  currentStore.processPatterns = finalPatterns;
  saveStore(currentStore);

  res.json({ success: true, count: finalPatterns.length, patterns: finalPatterns });
});

// --- Vite ミドルウェアまたは本番用静的ファイル配信 ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WBS Progress Management Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
