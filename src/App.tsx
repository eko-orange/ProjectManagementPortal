import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Feature, Holiday, Project, ProjectSettings, TaskProcess, Member, WbsSnapshot, ProcessStructurePattern, Estimate, EstimateFeature } from './types';
import { INITIAL_FEATURES, INITIAL_HOLIDAYS, INITIAL_PROJECTS, INITIAL_SETTINGS, INITIAL_MEMBERS, INITIAL_PROCESS_STRUCTURE_PATTERNS, INITIAL_ESTIMATES } from './data/initialData';
import {
  addWorkingDays,
  getTodayString,
  autoRescheduleFeatureDirect,
  autoRescheduleAllFeaturesDirect,
  autoRescheduleAllProjectsDirect,
  calculateAutoEndDateForProcess,
} from './utils/dateUtils';
import {
  fetchProjects,
  createProjectApi,
  updateProjectApi,
  deleteProjectApi,
  saveProjectWbsApi,
  saveHolidaysData,
  resetAllData,
  clearAllDataExceptHolidays,
  saveMembersApi,
  createSnapshotApi,
  restoreSnapshotApi,
  deleteSnapshotApi,
  fetchProcessPatternsApi,
  saveProcessPatternsApi,
  fetchEstimatesApi,
  saveEstimatesApi,
  createEstimateApi,
  updateEstimateApi,
  deleteEstimateApi,
  linkEstimateToProjectApi,
} from './utils/api';
import { Header } from './components/Header';
import { WbsGrid } from './components/WbsGrid';
import { BurnDownChart } from './components/BurnDownChart';
import { HolidayModal } from './components/HolidayModal';
import { AddFeatureModal } from './components/AddFeatureModal';
import { ProjectModal } from './components/ProjectModal';
import { MemberMasterModal } from './components/MemberMasterModal';
import { ProcessStructureMasterModal } from './components/ProcessStructureMasterModal';
import { WbsHistoryModal } from './components/WbsHistoryModal';
import { AutoScheduleModal } from './components/AutoScheduleModal';
import { MeetingHoursModal } from './components/MeetingHoursModal';
import { DataImportModal, ImportTabType } from './components/DataImportModal';
import { MainMenu } from './components/MainMenu';
import { EstimateManager } from './components/EstimateManager';
import { EstimateModal } from './components/EstimateModal';
import { LinkEstimateModal } from './components/LinkEstimateModal';
import { exportWbsToCsv, exportMembersToCsv, exportHolidaysToCsv, exportProcessStructureToCsv } from './utils/csvHelper';
import { AlertTriangle, Trash2, RotateCcw, Check, X, ShieldAlert, Sparkles } from 'lucide-react';

export default function App() {
  // メインメニュー / プロジェクト進捗管理 / 見積管理 画面切り替え状態
  const [currentView, setCurrentView] = useState<'menu' | 'wbs' | 'estimates'>('menu');

  // 見積管理データ状態
  const [estimates, setEstimates] = useState<Estimate[]>(INITIAL_ESTIMATES);
  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
  const [estimateToEdit, setEstimateToEdit] = useState<Estimate | null>(null);

  // 見積連携設定モーダル状態
  const [isLinkEstimateModalOpen, setIsLinkEstimateModalOpen] = useState(false);
  const [projectForLinkEstimate, setProjectForLinkEstimate] = useState<Project | null>(null);

  // 複数プロジェクト状態
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  // 選択中のプロジェクトID ('all' = すべてのプロジェクト横断表示)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // プロジェクト作成・編集モーダル状態
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);

  // 担当者フィルター状態（全体進捗率およびWbsGridと同期）
  const [assigneeFilter, setAssigneeFilter] = useState('');

  // 機能追加モーダル状態
  const [isAddFeatureOpen, setIsAddFeatureOpen] = useState(false);
  const [targetProjectIdForAdd, setTargetProjectIdForAdd] = useState<string>('');

  // 休日管理モーダル状態
  const [isHolidaysOpen, setIsHolidaysOpen] = useState(false);

  // 担当者マスタモーダル状態（メインメニューへ移動）
  const [isMemberMasterOpen, setIsMemberMasterOpen] = useState(false);

  // 工程構成マスタモーダル状態
  const [isProcessStructureOpen, setIsProcessStructureOpen] = useState(false);
  // 工程構成パターン一覧
  const [processPatterns, setProcessPatterns] = useState<ProcessStructurePattern[]>(INITIAL_PROCESS_STRUCTURE_PATTERNS);

  // WBS履歴保存・復元モーダル状態
  const [isWbsHistoryOpen, setIsWbsHistoryOpen] = useState(false);

  // 定例会・会議時間設定モーダル状態
  const [isMeetingHoursModalOpen, setIsMeetingHoursModalOpen] = useState(false);

  // 自動日程計算モーダル状態
  const [autoScheduleTarget, setAutoScheduleTarget] = useState<{
    feature: Feature;
    project: Project;
  } | null>(null);

  // データリセット確認カスタムモーダル
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);
  // 初期デモ状態へ復元確認カスタムモーダル
  const [isResetDemoModalOpen, setIsResetDemoModalOpen] = useState(false);

  // CSVデータ取り込み（データ移行）モーダル状態
  const [isDataImportOpen, setIsDataImportOpen] = useState(false);
  const [importModalInitialTab, setImportModalInitialTab] = useState<ImportTabType>('wbs');

  // トースト通知メッセージ
  const [appToast, setAppToast] = useState<{
    type: 'success' | 'info' | 'error';
    title: string;
    description?: string;
  } | null>(null);

  // 保存タイマーRef (Debounce)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 初期データ読み込み
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      const [data, patterns, loadedEstimates] = await Promise.all([
        fetchProjects(),
        fetchProcessPatternsApi(),
        fetchEstimatesApi(),
      ]);
      if (isMounted) {
        if (data.projects && data.projects.length > 0) {
          setProjects(data.projects);
        }
        if (Array.isArray(patterns) && patterns.length > 0) {
          setProcessPatterns(patterns);
        }
        if (Array.isArray(loadedEstimates) && loadedEstimates.length > 0) {
          setEstimates(loadedEstimates);
        }
        setIsLoading(false);
        setLastSavedAt(new Date());
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // 現在アクティブなプロジェクト（個別選択時）または第1プロジェクト
  const currentProject = useMemo(() => {
    if (selectedProjectId !== 'all') {
      const found = projects.find((p) => p.id === selectedProjectId);
      if (found) return found;
    }
    return projects[0] || {
      id: 'proj-1',
      name: INITIAL_SETTINGS.projectName,
      manager: INITIAL_SETTINGS.manager || '田中 敏夫',
      description: '',
      createdAt: '2026-08-01',
      updatedAt: '2026-09-09',
      settings: INITIAL_SETTINGS,
      features: INITIAL_FEATURES,
      holidays: INITIAL_HOLIDAYS,
    };
  }, [projects, selectedProjectId]);

  // 表示対象の機能リスト（ヘッダー集計用）
  const activeFeatures = useMemo(() => {
    if (selectedProjectId === 'all') {
      return projects.flatMap((p) => p.features || []);
    }
    return currentProject.features || [];
  }, [projects, selectedProjectId, currentProject]);

  const settings = currentProject.settings || INITIAL_SETTINGS;
  const holidays = currentProject.holidays || INITIAL_HOLIDAYS;
  const currentMembers = useMemo(() => {
    return currentProject.members && currentProject.members.length > 0
      ? currentProject.members
      : INITIAL_MEMBERS;
  }, [currentProject.members]);
  const currentSnapshots = useMemo(() => {
    return currentProject.snapshots || [];
  }, [currentProject.snapshots]);

  // デフォルト工程構成パターンの工程数（ヘッダーバッジ表示用）
  const defaultProcessesCount = useMemo(() => {
    const found = processPatterns.find((p) => p.isDefault);
    return (found || processPatterns[0])?.processes?.length || 6;
  }, [processPatterns]);

  // 担当者フィルター適用後の機能・工程リスト（ヘッダー進捗率集計用）
  const filteredFeaturesForHeader = useMemo(() => {
    const query = assigneeFilter.trim().toLowerCase();
    if (!query) return activeFeatures;

    return activeFeatures
      .map((f) => {
        const matched = f.processes.filter((p) =>
          (p.assignee || '').toLowerCase().includes(query)
        );
        if (matched.length === 0) return null;
        return {
          ...f,
          isExpanded: true,
          processes: matched,
        };
      })
      .filter((f): f is Feature => f !== null);
  }, [activeFeatures, assigneeFilter]);

  // 一括展開/折りたたみ判定
  const isAllExpanded =
    activeFeatures.length > 0 && activeFeatures.every((f) => f.isExpanded);

  // データ保存のデバウンス実行
  const triggerAutoSave = useCallback(
    (targetProjId: string, newFeatures: Feature[], newSettings: ProjectSettings) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      setIsSaving(true);

      // ローカルの projects state を即時更新
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== targetProjId) return p;
          return {
            ...p,
            name: newSettings.projectName,
            manager: newSettings.manager || p.manager,
            features: newFeatures,
            settings: newSettings,
            updatedAt: new Date().toISOString().slice(0, 10),
          };
        })
      );

      saveTimeoutRef.current = setTimeout(async () => {
        await saveProjectWbsApi(targetProjId, newFeatures, newSettings);
        setIsSaving(false);
        setLastSavedAt(new Date());
      }, 600);
    },
    []
  );

  // プロジェクト選択
  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
  };

  // 新規プロジェクト作成モーダルを開く
  const handleOpenCreateModal = () => {
    setProjectToEdit(null);
    setIsProjectModalOpen(true);
  };

  // プロジェクト編集モーダルを開く
  const handleOpenEditModal = (projectOrId: Project | string) => {
    if (typeof projectOrId === 'string') {
      const p = projects.find((item) => item.id === projectOrId);
      if (p) {
        setProjectToEdit(p);
        setIsProjectModalOpen(true);
      }
    } else {
      setProjectToEdit(projectOrId);
      setIsProjectModalOpen(true);
    }
  };

  // 人日・人時の工数相互変換（1日 = 8時間で計算）
  const convertWorkload = (
    val: number,
    fromUnit: '人時' | '人日',
    toUnit: '人時' | '人日',
    hoursPerDay: number = 8
  ): number => {
    if (fromUnit === toUnit) return val;
    const num = Number(val) || 0;
    if (toUnit === '人時') {
      // 人日 -> 人時 (× 8)
      return Math.round(num * hoursPerDay * 10) / 10;
    } else {
      // 人時 -> 人日 (÷ 8)
      return Math.round((num / hoursPerDay) * 100) / 100;
    }
  };

  // プロジェクト作成・更新の保存ハンドラ
  const handleSaveProjectModal = async (data: {
    name: string;
    manager: string;
    description: string;
    workloadUnit: '人時' | '人日';
    hoursPerDay: number;
    weeklyMeetingHours?: { [dayOfWeek: number]: number };
    estimateId?: string;
    estimateNumber?: string;
    estimateTitle?: string;
  }) => {
    if (projectToEdit) {
      // 編集時：工数単位が変更された場合は工数数値を一括換算
      const fromUnit = projectToEdit.settings?.workloadUnit || '人日';
      const toUnit = data.workloadUnit;
      const hours = data.hoursPerDay || 8;

      let nextFeatures = projectToEdit.features || [];
      if (fromUnit !== toUnit) {
        nextFeatures = nextFeatures.map((f) => ({
          ...f,
          processes: f.processes.map((p) => ({
            ...p,
            plannedWorkload: convertWorkload(p.plannedWorkload, fromUnit, toUnit, hours),
            actualWorkload: convertWorkload(p.actualWorkload, fromUnit, toUnit, hours),
          })),
        }));
      }

      const updated = await updateProjectApi(projectToEdit.id, {
        name: data.name,
        manager: data.manager,
        description: data.description,
        features: nextFeatures,
        settings: {
          ...projectToEdit.settings,
          projectName: data.name,
          manager: data.manager,
          workloadUnit: data.workloadUnit,
          hoursPerDay: data.hoursPerDay,
          weeklyMeetingHours: data.weeklyMeetingHours || projectToEdit.settings?.weeklyMeetingHours,
        },
      });
      if (updated) {
        const enriched: Project = {
          ...updated,
          estimateId: data.estimateId,
          estimateNumber: data.estimateNumber,
          estimateTitle: data.estimateTitle,
        };
        setProjects((prev) => prev.map((p) => (p.id === enriched.id ? enriched : p)));
        setAppToast({
          type: 'success',
          title: 'プロジェクト情報を更新しました',
          description: fromUnit !== toUnit
            ? `工数表示を【${toUnit}】に切り替え、数値を自動換算しました。`
            : undefined,
        });
      }
    } else {
      // 新規作成
      const created = await createProjectApi({
        name: data.name,
        manager: data.manager,
        description: data.description,
        workloadUnit: data.workloadUnit,
        hoursPerDay: data.hoursPerDay,
        weeklyMeetingHours: data.weeklyMeetingHours,
      });
      if (created) {
        const withMeetings: Project = {
          ...created,
          estimateId: data.estimateId,
          estimateNumber: data.estimateNumber,
          estimateTitle: data.estimateTitle,
          settings: {
            ...created.settings,
            weeklyMeetingHours: data.weeklyMeetingHours || created.settings?.weeklyMeetingHours,
          },
        };
        // 既存の登録プロジェクトリストに新しいプロジェクトを追加
        setProjects((prev) => [withMeetings, ...prev]);
        // 登録済みプロジェクトが画面から消えないよう、すべてのプロジェクト横断表示（'all'）を維持
        setSelectedProjectId('all');
        setAppToast({
          type: 'success',
          title: `新規プロジェクト「${created.name}」を作成しました`,
          description: data.estimateNumber
            ? `見積管理番号【${data.estimateNumber}】と連携して作成されました。`
            : '単体登録プロジェクトとして作成されました。',
        });
      }
    }
    setIsProjectModalOpen(false);
    setProjectToEdit(null);
  };

  // 見積保存ハンドラ
  const handleSaveEstimate = async (estimate: Estimate, autoLink?: boolean) => {
    setIsSaving(true);
    const isExisting = estimates.some((e) => e.id === estimate.id);
    let saved: Estimate | null = null;
    if (isExisting) {
      saved = await updateEstimateApi(estimate.id, estimate);
    } else {
      saved = await createEstimateApi(estimate);
    }
    const finalEst = saved || estimate;
    setEstimates((prev) => {
      const exists = prev.some((e) => e.id === finalEst.id);
      if (exists) {
        return prev.map((e) => (e.id === finalEst.id ? finalEst : e));
      }
      return [finalEst, ...prev];
    });

    if (autoLink) {
      await handleLinkEstimateToProject(finalEst.id);
    } else {
      setAppToast({
        type: 'success',
        title: '概算見積を保存しました',
        description: `${finalEst.estimateNumber}: ${finalEst.title}`,
      });
    }
    setIsSaving(false);
  };

  // 見積からプロジェクト進捗管理へのワンクリック連携ハンドラ
  const handleLinkEstimateToProject = async (estimateId: string, targetProjId?: string) => {
    setIsLoading(true);
    const result = await linkEstimateToProjectApi(estimateId, targetProjId);
    if (result.success && result.project) {
      setProjects((prev) => {
        const idx = prev.findIndex((p) => p.id === result.project!.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = result.project!;
          return next;
        }
        return [result.project!, ...prev];
      });

      if (result.estimate) {
        setEstimates((prev) =>
          prev.map((e) => (e.id === result.estimate!.id ? result.estimate! : e))
        );
      }

      setSelectedProjectId(result.project.id);
      setCurrentView('wbs');
      setAppToast({
        type: 'success',
        title: 'プロジェクト進捗管理へ連携完了',
        description: `${result.estimate?.estimateNumber || ''} を「${result.project.name}」としてWBSに反映しました。`,
      });
    } else {
      setAppToast({
        type: 'error',
        title: '連携に失敗しました',
        description: result.error || 'エラーが発生しました',
      });
    }
    setIsLoading(false);
  };

  // 見積複製ハンドラ
  const handleDuplicateEstimate = async (estimate: Estimate) => {
    const year = new Date().getFullYear();
    const maxNum = Math.max(
      0,
      ...estimates
        .map((e) => {
          const match = e.estimateNumber.match(/EST-(\d{4})-(\d+)/);
          return match ? parseInt(match[2], 10) : 0;
        })
        .filter((n) => !isNaN(n))
    );
    const duplicated: Estimate = {
      ...estimate,
      id: `est-${Date.now()}`,
      estimateNumber: `EST-${year}-${String(maxNum + 1).padStart(3, '0')}`,
      title: `${estimate.title} (コピー)`,
      status: 'draft',
      linkedProjectId: undefined,
      linkedProjectName: undefined,
      linkedAt: undefined,
      features: estimate.features.map((f, i) => ({
        ...f,
        id: `est-f-${Date.now()}-${i + 1}`,
      })),
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    await handleSaveEstimate(duplicated, false);
  };

  // 見積削除ハンドラ
  const handleDeleteEstimate = async (id: string) => {
    const target = estimates.find((e) => e.id === id);
    await deleteEstimateApi(id);
    setEstimates((prev) => prev.filter((e) => e.id !== id));
    setProjects((prev) =>
      prev.map((p) => {
        if (p.estimateId === id) {
          return {
            ...p,
            estimateId: undefined,
            estimateNumber: undefined,
            estimateTitle: undefined,
          };
        }
        return p;
      })
    );
    setAppToast({
      type: 'info',
      title: '見積を削除しました',
      description: target?.estimateNumber,
    });
  };

  // 見積CSV取り込みハンドラ
  const handleImportEstimates = (imported: Estimate[]) => {
    setEstimates((prev) => {
      const map = new Map<string, Estimate>();
      prev.forEach((e) => map.set(e.estimateNumber, e));
      imported.forEach((e) => map.set(e.estimateNumber, e));
      const next = Array.from(map.values());
      saveEstimatesApi(next);
      return next;
    });
    setAppToast({
      type: 'success',
      title: '見積CSV取り込み完了',
      description: `${imported.length}件の見積データを取り込みました。`,
    });
  };

  // プロジェクト進捗管理側から既存見積と紐付け
  const handleLinkToExistingEstimate = async (projId: string, estId: string) => {
    await handleLinkEstimateToProject(estId, projId);
  };

  // プロジェクト進捗管理側から新規見積を逆生成
  const handleCreateEstimateFromProject = async (proj: Project) => {
    const today = new Date().toISOString().slice(0, 10);
    const year = new Date().getFullYear();
    const maxNum = Math.max(
      0,
      ...estimates
        .map((e) => {
          const match = e.estimateNumber.match(/EST-(\d{4})-(\d+)/);
          return match ? parseInt(match[2], 10) : 0;
        })
        .filter((n) => !isNaN(n))
    );
    const newEstNum = `EST-${year}-${String(maxNum + 1).padStart(3, '0')}`;

    const estFeatures: EstimateFeature[] = (proj.features || []).map((f, idx) => {
      const plannedWorkload = f.processes.reduce((sum, p) => sum + (p.plannedWorkload || 0), 0);
      return {
        id: `est-f-${Date.now()}-${idx + 1}`,
        name: f.name,
        category: f.category || '一般機能',
        stepCount: f.stepCount,
        estimatedWorkload: plannedWorkload || 10,
        unitPrice: 50000,
        estimatedAmount: (plannedWorkload || 10) * 50000,
        description: '',
      };
    });

    const newEst: Estimate = {
      id: `est-${Date.now()}`,
      estimateNumber: newEstNum,
      title: proj.name,
      clientName: '未指定顧客',
      manager: proj.manager || '田中 敏夫',
      issueDate: today,
      validUntil: today,
      status: 'linked',
      workloadUnit: proj.settings?.workloadUnit || '人日',
      unitPrice: 50000,
      taxRate: 0.1,
      notes: `プロジェクト「${proj.name}」より自動生成`,
      features: estFeatures,
      linkedProjectId: proj.id,
      linkedProjectName: proj.name,
      linkedAt: today,
      createdAt: today,
      updatedAt: today,
    };

    await handleSaveEstimate(newEst, false);

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== proj.id) return p;
        return {
          ...p,
          estimateId: newEst.id,
          estimateNumber: newEst.estimateNumber,
          estimateTitle: newEst.title,
        };
      })
    );

    setAppToast({
      type: 'success',
      title: 'プロジェクトから見積を作成・連携しました',
      description: `${newEst.estimateNumber}: ${newEst.title}`,
    });
  };

  // プロジェクト進捗管理側から見積連携を解除
  const handleUnlinkEstimate = (projId: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projId) return p;
        return {
          ...p,
          estimateId: undefined,
          estimateNumber: undefined,
          estimateTitle: undefined,
        };
      })
    );
    setEstimates((prev) =>
      prev.map((e) => {
        if (e.linkedProjectId === projId) {
          return {
            ...e,
            status: 'approved',
            linkedProjectId: undefined,
            linkedProjectName: undefined,
            linkedAt: undefined,
          };
        }
        return e;
      })
    );
    setAppToast({
      type: 'info',
      title: '見積連携を解除しました',
      description: '単体登録プロジェクトに変更されました',
    });
  };

  // プロジェクト削除
  const handleDeleteProject = async (projectId: string) => {
    if (confirm('このプロジェクトを削除しますか？')) {
      const success = await deleteProjectApi(projectId);
      if (success) {
        setProjects((prev) => {
          const next = prev.filter((p) => p.id !== projectId);
          if (selectedProjectId === projectId) {
            setSelectedProjectId('all');
          }
          return next;
        });
      }
    }
  };

  // 設定更新ハンドラ（全プロジェクト横断または個別プロジェクトに適用）
  // 人日・人時が切り替わった場合は、予定工数および実績工数を 1日 = 8時間で自動換算
  const handleUpdateSettings = (newSettings: Partial<ProjectSettings>) => {
    const isUnitChanging =
      newSettings.workloadUnit !== undefined &&
      newSettings.workloadUnit !== settings.workloadUnit;

    const fromUnit = settings.workloadUnit || '人日';
    const toUnit = newSettings.workloadUnit || fromUnit;
    const hours = settings.hoursPerDay || 8;

    if (selectedProjectId === 'all') {
      // 全プロジェクトに適用
      setProjects((prev) =>
        prev.map((p) => {
          let nextFeatures = p.features || [];
          if (isUnitChanging) {
            const pFromUnit = p.settings?.workloadUnit || '人日';
            nextFeatures = nextFeatures.map((f) => ({
              ...f,
              processes: f.processes.map((proc) => ({
                ...proc,
                plannedWorkload: convertWorkload(proc.plannedWorkload, pFromUnit, toUnit, hours),
                actualWorkload: convertWorkload(proc.actualWorkload, pFromUnit, toUnit, hours),
              })),
            }));
          }
          const updatedSettings = { ...p.settings, ...newSettings };
          triggerAutoSave(p.id, nextFeatures, updatedSettings);
          return { ...p, features: nextFeatures, settings: updatedSettings };
        })
      );
    } else {
      let nextFeatures = currentProject.features || [];
      if (isUnitChanging) {
        nextFeatures = nextFeatures.map((f) => ({
          ...f,
          processes: f.processes.map((proc) => ({
            ...proc,
            plannedWorkload: convertWorkload(proc.plannedWorkload, fromUnit, toUnit, hours),
            actualWorkload: convertWorkload(proc.actualWorkload, fromUnit, toUnit, hours),
          })),
        }));
      }
      const updatedSettings = { ...settings, ...newSettings };
      triggerAutoSave(currentProject.id, nextFeatures, updatedSettings);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === currentProject.id
            ? { ...p, features: nextFeatures, settings: updatedSettings }
            : p
        )
      );
    }

    if (isUnitChanging) {
      setAppToast({
        type: 'info',
        title: `工数単位を【${toUnit}】に切り替えました`,
        description: `予定・実績の工数数値を1日＝${hours}時間で自動換算しました。`,
      });
    }
  };

  // 定例会・会議時間設定の保存ハンドラ
  const handleSaveWeeklyMeetingHours = (weeklyMeetingHours: { [dayOfWeek: number]: number }) => {
    if (selectedProjectId === 'all') {
      setProjects((prev) =>
        prev.map((p) => {
          const nextSettings = { ...p.settings, weeklyMeetingHours };
          triggerAutoSave(p.id, p.features || [], nextSettings);
          return { ...p, settings: nextSettings };
        })
      );
    } else {
      const nextSettings = { ...currentProject.settings, weeklyMeetingHours };
      triggerAutoSave(currentProject.id, currentProject.features || [], nextSettings);
      setProjects((prev) =>
        prev.map((p) => (p.id === currentProject.id ? { ...p, settings: nextSettings } : p))
      );
    }
    setAppToast({
      type: 'success',
      title: '定例会・会議時間設定を保存しました',
      description: '全曜日の会議時間を反映し、WBSの日程自動計算を更新しました。',
    });
  };

  // 機能の更新 (開閉状態など)
  const handleUpdateFeature = (
    projectId: string,
    featureId: string,
    updated: Partial<Feature>
  ) => {
    const targetProj = projects.find((p) => p.id === projectId);
    if (!targetProj) return;

    const nextFeatures = (targetProj.features || []).map((f) =>
      f.id === featureId ? { ...f, ...updated } : f
    );
    triggerAutoSave(projectId, nextFeatures, targetProj.settings);
  };

  // 単一工程の更新（進捗率、担当者、工数、日程など）
  const handleUpdateProcess = (
    projectId: string,
    featureId: string,
    processId: string,
    updated: Partial<TaskProcess>
  ) => {
    const targetProj = projects.find((p) => p.id === projectId);
    if (!targetProj) return;

    let updatedWithAutoEnd = { ...updated };
    // 開始日・予定工数・担当者が変更され、かつ終了日が明示指定されていない場合は会議や他工程の残枠から自動算出
    if (
      (updated.startDate !== undefined ||
        updated.plannedWorkload !== undefined ||
        updated.assignee !== undefined) &&
      updated.endDate === undefined
    ) {
      const currentProc = (targetProj.features || [])
        .find((f) => f.id === featureId)
        ?.processes.find((p) => p.id === processId);

      if (currentProc) {
        const start = updated.startDate ?? currentProc.startDate;
        const workload = updated.plannedWorkload ?? currentProc.plannedWorkload;
        const assignee = updated.assignee ?? currentProc.assignee;
        const autoEndDate = calculateAutoEndDateForProcess(
          start,
          workload,
          assignee,
          processId,
          targetProj.features || [],
          targetProj.holidays || holidays,
          targetProj.members || currentMembers,
          targetProj.settings?.workloadUnit || '人日',
          targetProj.settings?.hoursPerDay || 8,
          targetProj.settings?.weeklyMeetingHours
        );
        updatedWithAutoEnd.endDate = autoEndDate;
      }
    }

    const nextFeatures = (targetProj.features || []).map((f) => {
      if (f.id !== featureId) return f;
      const nextProcesses = f.processes.map((p) =>
        p.id === processId ? { ...p, ...updatedWithAutoEnd } : p
      );
      return { ...f, processes: nextProcesses };
    });
    triggerAutoSave(projectId, nextFeatures, targetProj.settings);
  };

  // 機能削除
  const handleDeleteFeature = (projectId: string, featureId: string) => {
    const targetProj = projects.find((p) => p.id === projectId);
    if (!targetProj) return;

    const nextFeatures = (targetProj.features || []).filter((f) => f.id !== featureId);
    triggerAutoSave(projectId, nextFeatures, targetProj.settings);
  };

  // 工程の任意追加（機能追加後：1行だけ確実に新規工程を追加）
  const handleAddProcess = (projectId: string, featureId: string, processName: string = '新規工程') => {
    const targetProj = projects.find((p) => p.id === projectId);
    if (!targetProj) return;

    const feature = (targetProj.features || []).find((f) => f.id === featureId);
    if (!feature) return;

    // 最後の工程の日程情報などを引き継ぐか、今日の日付をデフォルトにする
    const lastProc = feature.processes[feature.processes.length - 1];
    const procHolidays = targetProj.holidays || holidays;
    const newStartDate = lastProc ? addWorkingDays(lastProc.endDate, 1, procHolidays) : getTodayString();
    const newAssignee = lastProc?.assignee || '';
    const newPlannedWorkload = 3;
    const newEndDate = calculateAutoEndDateForProcess(
      newStartDate,
      newPlannedWorkload,
      newAssignee,
      undefined,
      targetProj.features || [],
      procHolidays,
      targetProj.members || currentMembers,
      targetProj.settings?.workloadUnit || '人日',
      targetProj.settings?.hoursPerDay || 8,
      targetProj.settings?.weeklyMeetingHours
    );

    const newProc: TaskProcess = {
      id: `proc-${featureId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      featureId,
      processType: processName,
      assignee: newAssignee,
      plannedWorkload: newPlannedWorkload,
      actualWorkload: 0,
      startDate: newStartDate,
      endDate: newEndDate,
      actualProgress: 0,
      notes: '',
    };

    const nextFeatures = (targetProj.features || []).map((f) => {
      if (f.id !== featureId) return f;
      return {
        ...f,
        isExpanded: true,
        processes: [...f.processes, newProc],
      };
    });

    triggerAutoSave(projectId, nextFeatures, targetProj.settings);
  };

  // 工程の削除（機能追加後）
  const handleDeleteProcess = (projectId: string, featureId: string, processId: string) => {
    const targetProj = projects.find((p) => p.id === projectId);
    if (!targetProj) return;

    const nextFeatures = (targetProj.features || []).map((f) => {
      if (f.id !== featureId) return f;
      return {
        ...f,
        processes: f.processes.filter((p) => p.id !== processId),
      };
    });

    triggerAutoSave(projectId, nextFeatures, targetProj.settings);
  };

  // 新規機能追加モーダルを開く
  const handleOpenAddFeature = (projectId?: string) => {
    const targetId = projectId || (selectedProjectId !== 'all' ? selectedProjectId : projects[0]?.id || 'proj-1');
    setTargetProjectIdForAdd(targetId);
    setIsAddFeatureOpen(true);
  };

  // 新規機能追加の確定
  const handleAddFeature = (newFeature: Feature) => {
    const targetProjId = targetProjectIdForAdd || (selectedProjectId !== 'all' ? selectedProjectId : projects[0]?.id || 'proj-1');
    const targetProj = projects.find((p) => p.id === targetProjId);
    if (!targetProj) return;

    const nextFeatures = [...(targetProj.features || []), { ...newFeature, projectId: targetProjId }];
    triggerAutoSave(targetProjId, nextFeatures, targetProj.settings);
    setIsAddFeatureOpen(false);
  };

  // 全展開/全折りたたみ
  const handleToggleAllExpand = (expand: boolean) => {
    setProjects((prev) =>
      prev.map((p) => {
        const nextFeatures = (p.features || []).map((f) => ({ ...f, isExpanded: expand }));
        triggerAutoSave(p.id, nextFeatures, p.settings);
        return { ...p, features: nextFeatures };
      })
    );
  };

  // 休日保存
  const handleSaveHolidays = async (newHolidays: Holiday[]) => {
    setIsSaving(true);
    setProjects((prev) =>
      prev.map((p) => ({ ...p, holidays: newHolidays }))
    );
    await saveHolidaysData(newHolidays);
    setIsSaving(false);
    setLastSavedAt(new Date());
  };

  // 休日リセット
  const handleResetHolidays = async () => {
    if (confirm('登録済み休日を初期標準祝日に戻しますか？')) {
      await handleSaveHolidays(INITIAL_HOLIDAYS);
    }
  };

  // 担当者マスタ保存
  const handleSaveMembers = async (newMembers: Member[]) => {
    setIsSaving(true);
    setProjects((prev) =>
      prev.map((p) =>
        p.id === currentProject.id
          ? { ...p, members: newMembers, updatedAt: new Date().toISOString().slice(0, 10) }
          : p
      )
    );
    await saveMembersApi(currentProject.id, newMembers);
    setIsSaving(false);
    setLastSavedAt(new Date());
  };

  // 工程構成マスタ保存
  const handleSaveProcessPatterns = async (newPatterns: ProcessStructurePattern[]) => {
    setIsSaving(true);
    setProcessPatterns(newPatterns);
    await saveProcessPatternsApi(newPatterns);
    setIsSaving(false);
    setLastSavedAt(new Date());
    setAppToast({
      type: 'success',
      title: '工程構成マスタを保存しました',
      description: '新規機能作成時の初期工程・工数構成に直ちに反映されます。',
    });
    setTimeout(() => setAppToast(null), 4000);
  };

  // 担当者休日追加に伴うプロジェクト期間調整の反映
  const handleAdjustProjectsSchedule = async (updatedProjects: Project[]) => {
    setIsSaving(true);
    setProjects(updatedProjects);
    // 各プロジェクトのWBSと設定をサーバーへ保存
    for (const proj of updatedProjects) {
      await saveProjectWbsApi(proj.id, proj.features || [], proj.settings);
    }
    setIsSaving(false);
    setLastSavedAt(new Date());
  };

  // WBSスナップショット作成
  const handleCreateSnapshot = async (
    versionName: string,
    notes: string
  ): Promise<boolean> => {
    setIsSaving(true);
    const result = await createSnapshotApi(
      currentProject.id,
      versionName,
      notes,
      currentProject.features,
      currentProject.settings
    );
    if (result) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === currentProject.id
            ? {
                ...p,
                snapshots: [result, ...(p.snapshots || [])],
                updatedAt: new Date().toISOString().slice(0, 10),
              }
            : p
        )
      );
      setIsSaving(false);
      setLastSavedAt(new Date());
      return true;
    }
    setIsSaving(false);
    return false;
  };

  // WBSスナップショット復元
  const handleRestoreSnapshot = async (snapshotId: string): Promise<boolean> => {
    setIsSaving(true);
    const restoredProj = await restoreSnapshotApi(currentProject.id, snapshotId);
    if (restoredProj) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === currentProject.id
            ? {
                ...p,
                features: restoredProj.features || p.features,
                settings: restoredProj.settings || p.settings,
                updatedAt: new Date().toISOString().slice(0, 10),
              }
            : p
        )
      );
      setIsSaving(false);
      setLastSavedAt(new Date());
      return true;
    }
    setIsSaving(false);
    return false;
  };

  // WBSスナップショット削除
  const handleDeleteSnapshot = async (snapshotId: string): Promise<boolean> => {
    const ok = await deleteSnapshotApi(currentProject.id, snapshotId);
    if (ok) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === currentProject.id
            ? {
                ...p,
                snapshots: (p.snapshots || []).filter((s) => s.id !== snapshotId),
              }
            : p
        )
      );
      return true;
    }
    return false;
  };

  // 機能単位の直接自動リスケジュール（各工程の人日・人時は固定、複数プロジェクトの稼働を考慮して残工数から自動計算・別画面なし）
  const handleDirectAutoSchedule = (feature: Feature, project: Project) => {
    const updatedFeature = autoRescheduleFeatureDirect(
      feature,
      project,
      holidays,
      currentMembers,
      undefined,
      projects
    );

    setProjects((prev) => {
      const targetProj = prev.find((p) => p.id === project.id);
      if (!targetProj) return prev;

      const nextFeatures = (targetProj.features || []).map((f) =>
        f.id === feature.id ? updatedFeature : f
      );

      triggerAutoSave(project.id, nextFeatures, targetProj.settings);

      return prev.map((p) =>
        p.id === project.id
          ? {
              ...p,
              features: nextFeatures,
              updatedAt: new Date().toISOString().slice(0, 10),
            }
          : p
      );
    });

    setAppToast({
      type: 'success',
      title: `「${feature.name}」を自動リスケしました`,
      description: '他プロジェクトの担当者稼働も含め、固定工数・残工数から全工程の日程を即座に再計算しました。',
    });
    setTimeout(() => setAppToast(null), 4000);
  };

  // プロジェクト全体の全機能を一括自動リスケジュール（別画面なし）
  const handleDirectAutoScheduleAll = (project: Project) => {
    const updatedProject = autoRescheduleAllFeaturesDirect(
      project,
      holidays,
      currentMembers,
      projects
    );

    setProjects((prev) => {
      triggerAutoSave(project.id, updatedProject.features, updatedProject.settings);
      return prev.map((p) => (p.id === project.id ? updatedProject : p));
    });

    setAppToast({
      type: 'success',
      title: `プロジェクト「${project.name}」の全工程を一括自動リスケしました`,
      description: '他プロジェクトの担当者稼働枠も含め、1人1日8時間・会議枠を厳密に考慮して一括自動スケジュールしました。',
    });
    setTimeout(() => setAppToast(null), 4000);
  };

  // 全プロジェクトを横断して一括自動リスケジュール
  const handleDirectAutoScheduleAllProjects = () => {
    const updatedProjects = autoRescheduleAllProjectsDirect(
      projects,
      holidays,
      currentMembers
    );

    setProjects(updatedProjects);
    updatedProjects.forEach((proj) => {
      triggerAutoSave(proj.id, proj.features, proj.settings);
    });

    setAppToast({
      type: 'success',
      title: '全プロジェクトを一括自動リスケしました',
      description: '複数プロジェクトに跨る同一担当者の稼働上限（1人1日8h・会議枠）を厳密に考慮し、全日程を再編成しました。',
    });
    setTimeout(() => setAppToast(null), 4000);
  };

  // （後方互換用）自動日程計算の反映
  const handleApplyAutoSchedule = (
    featureId: string,
    scheduledProcesses: TaskProcess[]
  ) => {
    if (!autoScheduleTarget) return;
    const { project } = autoScheduleTarget;

    setProjects((prev) => {
      const targetProj = prev.find((p) => p.id === project.id);
      if (!targetProj) return prev;

      const nextFeatures = (targetProj.features || []).map((f) => {
        if (f.id !== featureId) return f;
        return {
          ...f,
          processes: scheduledProcesses,
        };
      });

      triggerAutoSave(project.id, nextFeatures, targetProj.settings);

      return prev.map((p) =>
        p.id === project.id
          ? {
              ...p,
              features: nextFeatures,
              updatedAt: new Date().toISOString().slice(0, 10),
            }
          : p
      );
    });

    setAutoScheduleTarget(null);
  };

  // 全データ初期化（初期デモデータへ復元）モーダルを開く
  const handleOpenResetDemoModal = () => {
    setIsResetDemoModalOpen(true);
  };

  // 全データ初期化（初期デモデータへ復元）実行
  const executeResetDemoData = async () => {
    setIsLoading(true);
    setIsResetDemoModalOpen(false);
    try {
      await resetAllData();
      const [fresh, freshPatterns, freshEstimates] = await Promise.all([
        fetchProjects(),
        fetchProcessPatternsApi(),
        fetchEstimatesApi(),
      ]);
      setProjects(fresh.projects || INITIAL_PROJECTS);
      if (freshPatterns && freshPatterns.length > 0) {
        setProcessPatterns(freshPatterns);
      }
      setEstimates(freshEstimates || INITIAL_ESTIMATES);
      setSelectedProjectId('all');
      setLastSavedAt(new Date());
      setAppToast({
        type: 'success',
        title: '初期状態へ復元完了',
        description: 'プロジェクト、見積管理、工程構成マスタを初期状態に復元しました。',
      });
      setTimeout(() => setAppToast(null), 5000);
    } catch (err) {
      console.error('復元失敗:', err);
      setAppToast({
        type: 'error',
        title: '復元エラー',
        description: '初期データの復元中にエラーが発生しました。',
      });
      setTimeout(() => setAppToast(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // データリセット（休日管理以外のデータをクリア）モーダルを開く
  const handleOpenClearDataModal = () => {
    setIsClearDataModalOpen(true);
  };

  // データリセット（休日管理以外のデータをクリア）実行
  const executeClearAllData = async () => {
    setIsLoading(true);
    setIsClearDataModalOpen(false);
    try {
      await clearAllDataExceptHolidays();
      const fresh = await fetchProjects();
      setProjects(fresh.projects || INITIAL_PROJECTS);
      setEstimates([]);
      setSelectedProjectId('all');
      setLastSavedAt(new Date());
      setAppToast({
        type: 'success',
        title: 'データリセット完了',
        description: '休日管理以外の全データ（プロジェクト・見積）をクリアしました。新規入力が可能です。',
      });
      setTimeout(() => setAppToast(null), 5000);
    } catch (err) {
      console.error('クリア失敗:', err);
      setAppToast({
        type: 'error',
        title: 'リセットエラー',
        description: 'データクリア中にエラーが発生しました。',
      });
      setTimeout(() => setAppToast(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // CSV取り込み（データ移行）モーダルを開く
  const handleOpenImportData = (initialTab: ImportTabType = 'wbs') => {
    setImportModalInitialTab(initialTab);
    setIsDataImportOpen(true);
  };

  // CSV取り込み完了後のデータ再取得とトースト通知
  const handleImportComplete = async (type: ImportTabType, message: string) => {
    setIsLoading(true);
    try {
      const fresh = await fetchProjects();
      setProjects(fresh.projects || INITIAL_PROJECTS);
      if (type === 'process_structure') {
        const freshPatterns = await fetchProcessPatternsApi();
        setProcessPatterns(freshPatterns);
      }
      setLastSavedAt(new Date());
      setAppToast({
        type: 'success',
        title: 'CSV取り込み完了',
        description: message,
      });
      setTimeout(() => setAppToast(null), 6000);
    } catch (err) {
      console.error('取り込み後のデータリフレッシュエラー:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // CSVエクスポート
  const handleExportWbsCsv = () => {
    exportWbsToCsv(projects, selectedProjectId, settings.baselineDate);
  };

  const handleExportMembersCsv = () => {
    exportMembersToCsv(currentMembers);
  };

  const handleExportHolidaysCsv = () => {
    exportHolidaysToCsv(holidays);
  };

  const handleExportProcessStructureCsv = () => {
    exportProcessStructureToCsv(processPatterns);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm font-medium">WBSプロジェクトデータを読み込み中...</p>
        </div>
      </div>
    );
  }

  // メイン統合ビュー（メインメニュー・概算見積管理・WBS進捗管理）
  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-100 font-sans text-slate-800">
      {/* 1. メインメニュー画面 */}
      {currentView === 'menu' && (
        <MainMenu
          projects={projects}
          estimates={estimates}
          members={currentMembers}
          holidays={holidays}
          processPatterns={processPatterns}
          onNavigateToWbs={(projId) => {
            if (projId) setSelectedProjectId(projId);
            setCurrentView('wbs');
          }}
          onNavigateToEstimates={() => setCurrentView('estimates')}
          onOpenCreateProject={handleOpenCreateModal}
          onOpenCreateEstimate={() => {
            setEstimateToEdit(null);
            setIsEstimateModalOpen(true);
          }}
          onOpenMemberMaster={() => setIsMemberMasterOpen(true)}
          onOpenHolidayModal={() => setIsHolidaysOpen(true)}
          onOpenProcessStructureModal={() => setIsProcessStructureOpen(true)}
          onOpenImportData={(tab) => handleOpenImportData(tab || 'wbs')}
          onExportMembersCsv={handleExportMembersCsv}
          onOpenResetDemoModal={handleOpenResetDemoModal}
          onOpenClearDataModal={handleOpenClearDataModal}
        />
      )}

      {/* 2. 見積管理画面 */}
      {currentView === 'estimates' && (
        <EstimateManager
          estimates={estimates}
          projects={projects}
          members={currentMembers}
          onOpenCreateModal={() => {
            setEstimateToEdit(null);
            setIsEstimateModalOpen(true);
          }}
          onOpenEditModal={(est) => {
            setEstimateToEdit(est);
            setIsEstimateModalOpen(true);
          }}
          onDeleteEstimate={handleDeleteEstimate}
          onDuplicateEstimate={handleDuplicateEstimate}
          onLinkEstimateToProject={handleLinkEstimateToProject}
          onNavigateToWbs={(projId) => {
            if (projId) setSelectedProjectId(projId);
            setCurrentView('wbs');
          }}
          onNavigateToMainMenu={() => setCurrentView('menu')}
          onNavigateToMembers={() => setIsMemberMasterOpen(true)}
          onImportEstimates={handleImportEstimates}
        />
      )}

      {/* 3. プロジェクト進捗管理画面（WBS・ガント・イナズマ線） */}
      {currentView === 'wbs' && (
        <>
          {/* 上部ヘッダーコントロール（プロジェクト横断セレクター＆管理バー付き） */}
          <Header
            settings={settings}
            features={filteredFeaturesForHeader}
            holidays={holidays}
            assigneeFilter={assigneeFilter}
            onClearAssigneeFilter={() => setAssigneeFilter('')}
            allProjects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={handleSelectProject}
            onOpenCreateProject={handleOpenCreateModal}
            onOpenEditProject={handleOpenEditModal}
            onUpdateSettings={handleUpdateSettings}
            onOpenAddFeature={() => handleOpenAddFeature()}
            onOpenHolidays={() => setIsHolidaysOpen(true)}
            onOpenMemberMaster={() => setIsMemberMasterOpen(true)}
            onOpenProcessStructureMaster={() => setIsProcessStructureOpen(true)}
            onOpenMeetingHours={() => setIsMeetingHoursModalOpen(true)}
            onOpenWbsHistory={() => setIsWbsHistoryOpen(true)}
            onNavigateToMainMenu={() => setCurrentView('menu')}
            onNavigateToEstimates={() => setCurrentView('estimates')}
            onOpenLinkEstimateModal={(proj) => {
              setProjectForLinkEstimate(proj);
              setIsLinkEstimateModalOpen(true);
            }}
            membersCount={currentMembers.length}
            snapshotsCount={currentSnapshots.length}
            defaultProcessesCount={defaultProcessesCount}
            onToggleAllExpand={handleToggleAllExpand}
            isAllExpanded={isAllExpanded}
            onResetData={handleOpenResetDemoModal}
            onClearAllData={handleOpenClearDataModal}
            onExportCsv={handleExportWbsCsv}
            onExportWbsCsv={handleExportWbsCsv}
            onExportMembersCsv={handleExportMembersCsv}
            onExportHolidaysCsv={handleExportHolidaysCsv}
            onExportProcessStructureCsv={handleExportProcessStructureCsv}
            onOpenImportData={handleOpenImportData}
            isSaving={isSaving}
            lastSavedAt={lastSavedAt}
          />

          {/* バーンダウンチャート表示領域（オプション機能） */}
          {settings.showBurnDown && (
            <BurnDownChart
              features={filteredFeaturesForHeader}
              settings={settings}
              holidays={holidays}
              onClose={() => handleUpdateSettings({ showBurnDown: false })}
            />
          )}

          {/* メインスプレッドシート＆ガント＆イナズマ線グリッド（複数プロジェクト統合） */}
          <main className="flex-1 flex flex-col overflow-hidden min-h-0">
            <WbsGrid
              projects={projects}
              selectedProjectId={selectedProjectId}
              onSelectProject={handleSelectProject}
              settings={settings}
              holidays={holidays}
              members={currentMembers}
              assigneeFilter={assigneeFilter}
              onAssigneeFilterChange={setAssigneeFilter}
              onUpdateFeature={handleUpdateFeature}
              onUpdateProcess={handleUpdateProcess}
              onDeleteFeature={handleDeleteFeature}
              onAddProcess={handleAddProcess}
              onDeleteProcess={handleDeleteProcess}
              onOpenAddFeature={handleOpenAddFeature}
              onOpenEditProject={handleOpenEditModal}
              onAutoSchedule={handleDirectAutoSchedule}
              onAutoScheduleAll={handleDirectAutoScheduleAll}
              onAutoScheduleAllProjects={handleDirectAutoScheduleAllProjects}
            />
          </main>
        </>
      )}

      {/* 概算見積 作成・編集モーダル */}
      {isEstimateModalOpen && (
        <EstimateModal
          isOpen={isEstimateModalOpen}
          onClose={() => {
            setIsEstimateModalOpen(false);
            setEstimateToEdit(null);
          }}
          onSave={handleSaveEstimate}
          estimateToEdit={estimateToEdit}
          members={currentMembers}
          existingEstimates={estimates}
        />
      )}

      {/* プロジェクト側からの見積連携設定モーダル */}
      {isLinkEstimateModalOpen && (
        <LinkEstimateModal
          isOpen={isLinkEstimateModalOpen}
          onClose={() => {
            setIsLinkEstimateModalOpen(false);
            setProjectForLinkEstimate(null);
          }}
          project={projectForLinkEstimate}
          estimates={estimates}
          onLinkToExistingEstimate={handleLinkToExistingEstimate}
          onCreateEstimateFromProject={handleCreateEstimateFromProject}
          onUnlinkEstimate={handleUnlinkEstimate}
        />
      )}

      {/* 機能追加モーダル */}
      {isAddFeatureOpen && (
        <AddFeatureModal
          holidays={holidays}
          members={currentMembers}
          workloadUnit={settings.workloadUnit}
          hoursPerDay={settings.hoursPerDay || 8}
          weeklyMeetingHours={settings.weeklyMeetingHours}
          processPatterns={processPatterns}
          onOpenProcessMaster={() => setIsProcessStructureOpen(true)}
          onAddFeature={handleAddFeature}
          onClose={() => setIsAddFeatureOpen(false)}
        />
      )}

      {/* 定例会・会議時間設定モーダル */}
      {isMeetingHoursModalOpen && (
        <MeetingHoursModal
          isOpen={isMeetingHoursModalOpen}
          settings={settings}
          weeklyMeetingHours={settings.weeklyMeetingHours}
          hoursPerDay={settings.hoursPerDay || 8}
          projectName={settings.projectName}
          onSave={handleSaveWeeklyMeetingHours}
          onClose={() => setIsMeetingHoursModalOpen(false)}
        />
      )}

      {/* 休日管理モーダル */}
      {isHolidaysOpen && (
        <HolidayModal
          holidays={holidays}
          onSaveHolidays={handleSaveHolidays}
          onResetHolidays={handleResetHolidays}
          onOpenCsvImport={() => handleOpenImportData('holidays')}
          onClose={() => setIsHolidaysOpen(false)}
        />
      )}

      {/* 担当者マスタモーダル */}
      {isMemberMasterOpen && (
        <MemberMasterModal
          members={currentMembers}
          holidays={holidays}
          projects={projects}
          onSaveMembers={handleSaveMembers}
          onAdjustProjectsSchedule={handleAdjustProjectsSchedule}
          onOpenCsvImport={() => handleOpenImportData('members')}
          onClose={() => setIsMemberMasterOpen(false)}
        />
      )}

      {/* 工程構成マスタモーダル */}
      {isProcessStructureOpen && (
        <ProcessStructureMasterModal
          patterns={processPatterns}
          workloadUnit={settings.workloadUnit}
          hoursPerDay={settings.hoursPerDay || 8}
          onOpenCsvImport={() => handleOpenImportData('process_structure')}
          onSavePatterns={handleSaveProcessPatterns}
          onClose={() => setIsProcessStructureOpen(false)}
        />
      )}

      {/* CSV取り込みモーダル */}
      {isDataImportOpen && (
        <DataImportModal
          isOpen={isDataImportOpen}
          initialTab={importModalInitialTab}
          holidays={holidays}
          members={currentMembers}
          projects={projects}
          onImportComplete={handleImportComplete}
          onClose={() => setIsDataImportOpen(false)}
        />
      )}

      {/* WBS履歴管理・スナップショット保存モーダル */}
      {isWbsHistoryOpen && (
        <WbsHistoryModal
          currentProject={currentProject}
          currentFeatures={currentProject.features || []}
          currentSettings={settings}
          snapshots={currentSnapshots}
          onSaveSnapshot={handleCreateSnapshot}
          onRestoreSnapshot={handleRestoreSnapshot}
          onDeleteSnapshot={handleDeleteSnapshot}
          onClose={() => setIsWbsHistoryOpen(false)}
        />
      )}

      {/* 自動日程計算（リスケジュール）モーダル */}
      {autoScheduleTarget && (
        <AutoScheduleModal
          feature={autoScheduleTarget.feature}
          holidays={holidays}
          members={currentMembers}
          workloadUnit={settings.workloadUnit}
          dailyStandardHours={settings.hoursPerDay || settings.dailyWorkingHours || 8}
          settings={settings}
          onApplySchedule={handleApplyAutoSchedule}
          onClose={() => setAutoScheduleTarget(null)}
        />
      )}

      {/* プロジェクト作成・編集モーダル */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => {
          setIsProjectModalOpen(false);
          setProjectToEdit(null);
        }}
        onSave={handleSaveProjectModal}
        projectToEdit={projectToEdit}
        members={currentMembers}
        estimates={estimates}
      />

      {/* データリセット確認モーダル */}
      {isClearDataModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
            {/* ヘッダー */}
            <div className="px-6 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">データリセットの確認</h3>
                  <p className="text-xs text-rose-600 font-medium">全プロジェクトデータの消去</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsClearDataModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-lg transition-colors cursor-pointer"
                title="閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 本文 */}
            <div className="p-6 space-y-4 text-xs text-slate-700">
              {/* 最重要注意文 */}
              <div className="bg-rose-50/90 border-2 border-rose-300 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-sm text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>休日管理以外のデータはクリアします</span>
                </div>
                <p className="text-rose-700 text-[11px] leading-relaxed pl-5.5">
                  現在登録されているすべてのプロジェクト、機能、工程、進捗実績、スナップショット履歴が完全に消去され、新規白紙状態になります。
                </p>
              </div>

              {/* 保持されるデータの案内 */}
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-start gap-2 text-emerald-800 text-[11px] leading-relaxed">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>休日管理データは保持されます</strong><br />
                  会社共通の休日カレンダー（土日・祝祭日・創立記念日・年末年始など）の登録内容はそのまま残りますので、カレンダーの再登録は不要です。
                </span>
              </div>

              <p className="text-slate-600 text-[11px]">
                本当にデータをリセットしてよろしいですか？この操作は取り消せません。
              </p>
            </div>

            {/* フッター */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsClearDataModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={executeClearAllData}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>データリセットを実行する</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 初期状態へ復元確認モーダル */}
      {isResetDemoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
            {/* ヘッダー */}
            <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">初期状態への復元確認</h3>
                  <p className="text-xs text-indigo-600 font-medium">3プロジェクトデモ構成へ復元</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResetDemoModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-lg transition-colors cursor-pointer"
                title="閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 本文 */}
            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2">
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                  以下の初期サンプル構成に復元されます：
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 text-[11px]">
                  <li><strong>担当者マスタ</strong>: 執行役員、本部長、副本部長、部長、課長、主任、担当、研修生</li>
                  <li><strong>3つのプロジェクト</strong>:
                    <ul className="pl-4 list-disc space-y-0.5 mt-0.5 text-slate-500">
                      <li>基幹ECリニューアルプロジェクト (管理者: 部長)</li>
                      <li>社内勤怠・経費精算DXアプリ (管理者: 課長)</li>
                      <li>顧客サポートポータル構築 (管理者: 副本部長)</li>
                    </ul>
                  </li>
                  <li>各プロジェクトの機能・工程に各役職の担当者が割り当てられた状態</li>
                </ul>
              </div>

              <p className="text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-[11px]">
                ⚠️ 現在入力・変更されたデータは上書きされ、初期状態に戻ります。
              </p>
            </div>

            {/* フッター */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsResetDemoModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={executeResetDemoData}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>初期状態に復元する</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* アプリ共通トースト通知 */}
      {appToast && (
        <div className="fixed bottom-6 right-6 z-70 flex items-start gap-3 p-4 rounded-xl shadow-xl text-xs max-w-sm bg-slate-900 text-white border border-slate-800">
          {appToast.type === 'success' && <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
          {appToast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
          {appToast.type === 'info' && <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />}
          <div className="space-y-0.5 flex-1">
            <h4 className="font-bold text-white text-xs">{appToast.title}</h4>
            {appToast.description && <p className="text-slate-300 text-[11px] leading-relaxed">{appToast.description}</p>}
          </div>
          <button
            type="button"
            onClick={() => setAppToast(null)}
            className="text-slate-400 hover:text-white -mr-1 -mt-1 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
