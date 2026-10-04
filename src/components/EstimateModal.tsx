import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Calculator,
  Layers,
  FileText,
  Building2,
  User,
  Calendar,
  DollarSign,
  Sparkles,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Workflow,
} from 'lucide-react';
import { Estimate, EstimateFeature, EstimateProcess, Member, Project, ProcessStructurePattern, COMMON_PROCESS_SUGGESTIONS } from '../types';

interface EstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (estimate: Estimate, autoLink?: boolean) => void;
  estimateToEdit?: Estimate | null;
  members: Member[];
  existingEstimates: Estimate[];
  processPatterns?: ProcessStructurePattern[];
}

export const EstimateModal: React.FC<EstimateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  estimateToEdit,
  members,
  existingEstimates,
  processPatterns,
}) => {
  const isEdit = Boolean(estimateToEdit);
  const today = new Date().toISOString().slice(0, 10);

  // 1ヶ月後の日付
  const defaultValidUntil = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  // 次の自動採番
  const nextEstimateNumber = useMemo(() => {
    const existingNums = existingEstimates
      .map((e) => {
        const match = e.estimateNumber.match(/EST-(\d{4})-(\d+)/);
        return match ? parseInt(match[2], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0;
    const year = new Date().getFullYear();
    return `EST-${year}-${String(maxNum + 1).padStart(3, '0')}`;
  }, [existingEstimates]);

  // フォーム状態
  const [estimateNumber, setEstimateNumber] = useState('');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [clientName, setClientName] = useState('');
  const [manager, setManager] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [validUntil, setValidUntil] = useState(defaultValidUntil);
  const [status, setStatus] = useState<Estimate['status']>('draft');
  const [workloadUnit, setWorkloadUnit] = useState<'人日' | '人時'>('人日');
  const [unitPrice, setUnitPrice] = useState<number>(50000);
  const [taxRate, setTaxRate] = useState<number>(0.1);
  const [notes, setNotes] = useState('');
  const [features, setFeatures] = useState<EstimateFeature[]>([]);
  const [expandedFeatureIndices, setExpandedFeatureIndices] = useState<Set<number>>(new Set([0]));
  const [error, setError] = useState('');

  // 担当者マスタから選任可能なメンバー一覧
  const eligibleAssignees = useMemo(() => {
    return members;
  }, [members]);

  // 担当者の有効単価算出ヘルパー
  const computeFeaturePrice = (assigneeName?: string, currentUnit: '人日' | '人時' = workloadUnit, basePrice: number = unitPrice) => {
    if (assigneeName) {
      const mem = members.find((m) => m.name === assigneeName);
      if (mem && mem.unitPrice !== undefined) {
        if (currentUnit === '人時') {
          return Math.round(mem.unitPrice / (mem.dailyWorkingHours || 8));
        }
        return mem.unitPrice;
      }
    }
    return basePrice;
  };

  // 初期化
  useEffect(() => {
    if (estimateToEdit) {
      setEstimateNumber(estimateToEdit.estimateNumber || '');
      setTitle(estimateToEdit.title || '');
      setStartDate(estimateToEdit.startDate || estimateToEdit.issueDate || today);
      setClientName(estimateToEdit.clientName || '');
      setManager(estimateToEdit.manager || (members[0]?.name || '田中 敏夫'));
      setIssueDate(estimateToEdit.issueDate || today);
      setValidUntil(estimateToEdit.validUntil || defaultValidUntil);
      setStatus(estimateToEdit.status || 'draft');
      setWorkloadUnit(estimateToEdit.workloadUnit || '人日');
      setUnitPrice(estimateToEdit.unitPrice || 50000);
      setTaxRate(estimateToEdit.taxRate !== undefined ? estimateToEdit.taxRate : 0.1);
      setNotes(estimateToEdit.notes || '');
      setFeatures(
        Array.isArray(estimateToEdit.features)
          ? JSON.parse(JSON.stringify(estimateToEdit.features))
          : []
      );
      setError('');
    } else {
      setEstimateNumber(nextEstimateNumber);
      setTitle('');
      setStartDate(today);
      setClientName('');
      setManager(members[0]?.name || '田中 敏夫');
      setIssueDate(today);
      setValidUntil(defaultValidUntil);
      setStatus('draft');
      setWorkloadUnit('人日');
      setUnitPrice(50000);
      setTaxRate(0.1);
      setNotes('');
      // 初期で1つの機能行を用意（デフォルトで設計・実装・テストの3工程を登録）
      const defaultAssignee = members.find((m) => m.role === '主任' || m.role === '担当')?.name || '';
      const initialPrice = computeFeaturePrice(defaultAssignee, '人日', 50000);
      const initialProcesses: EstimateProcess[] = [
        {
          id: `est-p-${Date.now()}-1`,
          name: '基本・詳細設計',
          workload: 3,
          assignee: defaultAssignee,
          unitPrice: initialPrice,
          amount: 3 * initialPrice,
          notes: '',
        },
        {
          id: `est-p-${Date.now()}-2`,
          name: '実装',
          workload: 5,
          assignee: defaultAssignee,
          unitPrice: initialPrice,
          amount: 5 * initialPrice,
          notes: '',
        },
        {
          id: `est-p-${Date.now()}-3`,
          name: '単体テスト',
          workload: 2,
          assignee: defaultAssignee,
          unitPrice: initialPrice,
          amount: 2 * initialPrice,
          notes: '',
        },
      ];
      setFeatures([
        {
          id: `est-f-${Date.now()}-1`,
          name: '',
          category: '一般機能',
          assignee: defaultAssignee,
          stepCount: undefined,
          estimatedWorkload: 10, // 3 + 5 + 2 = 10
          unitPrice: initialPrice,
          estimatedAmount: Math.round(10 * initialPrice),
          description: '',
          processes: initialProcesses,
        },
      ]);
      setExpandedFeatureIndices(new Set([0]));
      setError('');
    }
  }, [estimateToEdit, isOpen, nextEstimateNumber, members, today, defaultValidUntil]);

  // アコーディオン開閉
  const toggleExpandFeature = (idx: number) => {
    setExpandedFeatureIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // 工数単位変更ハンドラ
  const handleWorkloadUnitChange = (newUnit: '人日' | '人時') => {
    const factor = newUnit === '人時' && workloadUnit === '人日' ? 8 : (newUnit === '人日' && workloadUnit === '人時' ? 1 / 8 : 1);
    setWorkloadUnit(newUnit);
    setFeatures((prev) =>
      prev.map((f) => {
        let updatedProcesses = f.processes;
        if (updatedProcesses && updatedProcesses.length > 0) {
          updatedProcesses = updatedProcesses.map((p) => {
            const newWl = Math.max(0.1, Math.round(p.workload * factor * 10) / 10);
            const newPrice = computeFeaturePrice(p.assignee || f.assignee, newUnit, unitPrice);
            return {
              ...p,
              workload: newWl,
              unitPrice: newPrice,
              amount: Math.round(newWl * newPrice),
            };
          });
        }
        const totalWl = updatedProcesses && updatedProcesses.length > 0
          ? Math.round(updatedProcesses.reduce((sum, p) => sum + p.workload, 0) * 10) / 10
          : Math.max(0.1, Math.round(f.estimatedWorkload * factor * 10) / 10);
        const price = computeFeaturePrice(f.assignee, newUnit, unitPrice);
        const totalAmount = updatedProcesses && updatedProcesses.length > 0
          ? updatedProcesses.reduce((sum, p) => sum + (p.amount || 0), 0)
          : Math.round(totalWl * price);

        return {
          ...f,
          unitPrice: price,
          estimatedWorkload: totalWl,
          estimatedAmount: totalAmount,
          processes: updatedProcesses,
        };
      })
    );
  };

  // 単価変更時に機能・工程の金額を再計算
  const handleUnitPriceChange = (newPrice: number) => {
    setUnitPrice(newPrice);
    setFeatures((prev) =>
      prev.map((f) => {
        let updatedProcesses = f.processes;
        if (updatedProcesses && updatedProcesses.length > 0) {
          updatedProcesses = updatedProcesses.map((p) => {
            if (!p.assignee) {
              return {
                ...p,
                unitPrice: newPrice,
                amount: Math.round(p.workload * newPrice),
              };
            }
            return p;
          });
        }
        if (!f.assignee) {
          const totalAmount = updatedProcesses && updatedProcesses.length > 0
            ? updatedProcesses.reduce((sum, p) => sum + (p.amount || 0), 0)
            : Math.round(f.estimatedWorkload * newPrice);
          return {
            ...f,
            unitPrice: newPrice,
            estimatedAmount: totalAmount,
            processes: updatedProcesses,
          };
        }
        return {
          ...f,
          processes: updatedProcesses,
        };
      })
    );
  };

  // 機能の追加
  const handleAddFeature = () => {
    const defaultAssignee = members.find((m) => m.role === '主任' || m.role === '担当')?.name || '';
    const price = computeFeaturePrice(defaultAssignee, workloadUnit, unitPrice);
    const initialProcesses: EstimateProcess[] = [
      {
        id: `est-p-${Date.now()}-1`,
        name: '基本・詳細設計',
        workload: workloadUnit === '人日' ? 3 : 24,
        assignee: defaultAssignee,
        unitPrice: price,
        amount: Math.round((workloadUnit === '人日' ? 3 : 24) * price),
        notes: '',
      },
      {
        id: `est-p-${Date.now()}-2`,
        name: '実装',
        workload: workloadUnit === '人日' ? 5 : 40,
        assignee: defaultAssignee,
        unitPrice: price,
        amount: Math.round((workloadUnit === '人日' ? 5 : 40) * price),
        notes: '',
      },
      {
        id: `est-p-${Date.now()}-3`,
        name: '単体テスト',
        workload: workloadUnit === '人日' ? 2 : 16,
        assignee: defaultAssignee,
        unitPrice: price,
        amount: Math.round((workloadUnit === '人日' ? 2 : 16) * price),
        notes: '',
      },
    ];
    const totalWl = initialProcesses.reduce((sum, p) => sum + p.workload, 0);
    const totalAmount = initialProcesses.reduce((sum, p) => sum + (p.amount || 0), 0);

    setFeatures((prev) => {
      const nextIdx = prev.length;
      setExpandedFeatureIndices((ePrev) => new Set([...ePrev, nextIdx]));
      return [
        ...prev,
        {
          id: `est-f-${Date.now()}-${prev.length + 1}`,
          name: '',
          category: '一般機能',
          assignee: defaultAssignee,
          stepCount: undefined,
          estimatedWorkload: totalWl,
          unitPrice: price,
          estimatedAmount: totalAmount,
          description: '',
          processes: initialProcesses,
        },
      ];
    });
  };

  // 機能の更新
  const handleUpdateFeature = (idx: number, patch: Partial<EstimateFeature>) => {
    setFeatures((prev) => {
      const next = [...prev];
      const target = { ...next[idx], ...patch };

      // 担当者が変更された場合、担当者マスタの単価を自動連動
      if (patch.assignee !== undefined) {
        target.unitPrice = computeFeaturePrice(patch.assignee, workloadUnit, unitPrice);
      }

      // 工程がない場合のみ、工数または単価変更時に金額を直接再計算
      if (!target.processes || target.processes.length === 0) {
        if (
          patch.estimatedWorkload !== undefined ||
          patch.assignee !== undefined ||
          patch.unitPrice !== undefined
        ) {
          const p = target.unitPrice || unitPrice;
          target.estimatedAmount = Math.round(target.estimatedWorkload * p);
        }
      } else {
        // 工程がある場合は各工程の工数・金額合計を担保
        target.estimatedWorkload = Math.round(target.processes.reduce((sum, p) => sum + (Number(p.workload) || 0), 0) * 10) / 10;
        target.estimatedAmount = Math.round(target.processes.reduce((sum, p) => sum + (Number(p.amount) || (p.workload * (p.unitPrice || unitPrice))), 0));
      }

      next[idx] = target;
      return next;
    });
  };

  // 工程の追加（機能内）
  const handleAddProcess = (featureIdx: number) => {
    setFeatures((prev) => {
      const next = [...prev];
      const feat = { ...next[featureIdx] };
      const curProcesses = Array.isArray(feat.processes) ? [...feat.processes] : [];
      const defaultAssignee = feat.assignee || (members[0]?.name || '');
      const price = computeFeaturePrice(defaultAssignee, workloadUnit, feat.unitPrice || unitPrice);
      const newProcessWorkload = workloadUnit === '人日' ? 2 : 16;

      const suggestions = ['要件定義・設計', '実装', '単体テスト', '結合テスト', '総合テスト'];
      const nextName = suggestions[curProcesses.length] || '追加工程';

      curProcesses.push({
        id: `est-p-${Date.now()}-${curProcesses.length + 1}`,
        name: nextName,
        workload: newProcessWorkload,
        assignee: defaultAssignee,
        unitPrice: price,
        amount: Math.round(newProcessWorkload * price),
        notes: '',
      });

      feat.processes = curProcesses;
      // 工数は各工程の合計を自動計算！
      feat.estimatedWorkload = Math.round(curProcesses.reduce((sum, p) => sum + (Number(p.workload) || 0), 0) * 10) / 10;
      feat.estimatedAmount = Math.round(curProcesses.reduce((sum, p) => sum + (Number(p.amount) || (p.workload * (p.unitPrice || price))), 0));
      next[featureIdx] = feat;
      return next;
    });

    setExpandedFeatureIndices((prev) => new Set([...prev, featureIdx]));
  };

  // 標準5工程を一括セット
  const handlePopulateStandardProcesses = (featureIdx: number) => {
    setFeatures((prev) => {
      const next = [...prev];
      const feat = { ...next[featureIdx] };
      const defaultAssignee = feat.assignee || (members[0]?.name || '');
      const price = computeFeaturePrice(defaultAssignee, workloadUnit, feat.unitPrice || unitPrice);
      const currentWl = feat.estimatedWorkload > 0 ? feat.estimatedWorkload : (workloadUnit === '人日' ? 10 : 80);

      const templates = [
        { name: '基本・詳細設計', ratio: 0.25 },
        { name: '設計レビュー', ratio: 0.10 },
        { name: '実装', ratio: 0.40 },
        { name: '実装レビュー', ratio: 0.10 },
        { name: '単体テスト・検証', ratio: 0.15 },
      ];

      const generated: EstimateProcess[] = templates.map((t, pIdx) => {
        const pWl = Math.max(0.5, Math.round(currentWl * t.ratio * 10) / 10);
        const pPrice = computeFeaturePrice(defaultAssignee, workloadUnit, price);
        return {
          id: `est-p-${Date.now()}-${pIdx + 1}`,
          name: t.name,
          workload: pWl,
          assignee: defaultAssignee,
          unitPrice: pPrice,
          amount: Math.round(pWl * pPrice),
          notes: '',
        };
      });

      feat.processes = generated;
      feat.estimatedWorkload = Math.round(generated.reduce((sum, p) => sum + p.workload, 0) * 10) / 10;
      feat.estimatedAmount = Math.round(generated.reduce((sum, p) => sum + (p.amount || p.workload * p.unitPrice!), 0));
      next[featureIdx] = feat;
      return next;
    });

    setExpandedFeatureIndices((prev) => new Set([...prev, featureIdx]));
  };

  // 工程の更新
  const handleUpdateProcess = (featureIdx: number, processIdx: number, patch: Partial<EstimateProcess>) => {
    setFeatures((prev) => {
      const next = [...prev];
      const feat = { ...next[featureIdx] };
      if (!feat.processes) return prev;
      const nextProcesses = [...feat.processes];
      const target = { ...nextProcesses[processIdx], ...patch };

      if (patch.assignee !== undefined) {
        target.unitPrice = computeFeaturePrice(patch.assignee, workloadUnit, feat.unitPrice || unitPrice);
      }

      if (patch.workload !== undefined || patch.unitPrice !== undefined || patch.assignee !== undefined) {
        const p = target.unitPrice || computeFeaturePrice(target.assignee, workloadUnit, feat.unitPrice || unitPrice);
        target.amount = Math.round(target.workload * p);
      }

      nextProcesses[processIdx] = target;
      feat.processes = nextProcesses;

      // 工数は各工程の合計を自動反映！
      feat.estimatedWorkload = Math.round(nextProcesses.reduce((sum, p) => sum + (Number(p.workload) || 0), 0) * 10) / 10;
      feat.estimatedAmount = Math.round(nextProcesses.reduce((sum, p) => sum + (Number(p.amount) || (p.workload * (p.unitPrice || unitPrice))), 0));

      next[featureIdx] = feat;
      return next;
    });
  };

  // 工程の削除
  const handleDeleteProcess = (featureIdx: number, processIdx: number) => {
    setFeatures((prev) => {
      const next = [...prev];
      const feat = { ...next[featureIdx] };
      if (!feat.processes) return prev;
      const nextProcesses = feat.processes.filter((_, i) => i !== processIdx);
      feat.processes = nextProcesses;

      if (nextProcesses.length > 0) {
        feat.estimatedWorkload = Math.round(nextProcesses.reduce((sum, p) => sum + (Number(p.workload) || 0), 0) * 10) / 10;
        feat.estimatedAmount = Math.round(nextProcesses.reduce((sum, p) => sum + (Number(p.amount) || (p.workload * (p.unitPrice || unitPrice))), 0));
      } else {
        feat.processes = [];
        feat.estimatedAmount = Math.round(feat.estimatedWorkload * (feat.unitPrice || unitPrice));
      }
      next[featureIdx] = feat;
      return next;
    });
  };

  // 機能内の工程をすべてクリア
  const handleClearProcesses = (featureIdx: number) => {
    setFeatures((prev) => {
      const next = [...prev];
      const feat = { ...next[featureIdx] };
      feat.processes = [];
      feat.estimatedAmount = Math.round(feat.estimatedWorkload * (feat.unitPrice || unitPrice));
      next[featureIdx] = feat;
      return next;
    });
  };

  // 工程構成マスタのパターンを機能に適用
  const handleApplyPattern = (featureIdx: number, patternId: string) => {
    if (!processPatterns) return;
    const pat = processPatterns.find((p) => p.id === patternId);
    if (!pat || !pat.processes || pat.processes.length === 0) return;

    setFeatures((prev) => {
      const next = [...prev];
      const feat = { ...next[featureIdx] };
      const defaultAssignee = feat.assignee || (members[0]?.name || '');
      const price = computeFeaturePrice(defaultAssignee, workloadUnit, feat.unitPrice || unitPrice);
      const totalPatDays = pat.processes.reduce((sum, p) => sum + (p.defaultDays || 1), 0);
      const baseWl = feat.estimatedWorkload > 0 ? feat.estimatedWorkload : (workloadUnit === '人日' ? 10 : 80);

      const generated: EstimateProcess[] = pat.processes.map((p, pIdx) => {
        const ratio = (p.defaultDays || 1) / (totalPatDays || 1);
        const pWl = Math.max(0.5, Math.round(baseWl * ratio * 10) / 10);
        const pPrice = computeFeaturePrice(defaultAssignee, workloadUnit, price);
        return {
          id: `est-p-${Date.now()}-${pIdx + 1}`,
          name: p.name,
          workload: pWl,
          assignee: defaultAssignee,
          unitPrice: pPrice,
          amount: Math.round(pWl * pPrice),
          notes: p.description || '',
        };
      });

      feat.processPatternId = pat.id;
      feat.processes = generated;
      feat.estimatedWorkload = Math.round(generated.reduce((sum, p) => sum + p.workload, 0) * 10) / 10;
      feat.estimatedAmount = Math.round(generated.reduce((sum, p) => sum + (p.amount || 0), 0));
      next[featureIdx] = feat;
      return next;
    });

    setExpandedFeatureIndices((prev) => new Set([...prev, featureIdx]));
  };

  // 機能の削除
  const handleDeleteFeature = (idx: number) => {
    if (features.length <= 1) {
      setError('少なくとも1つの機能が必要です');
      return;
    }
    setFeatures((prev) => prev.filter((_, i) => i !== idx));
    setError('');
  };

  // サマリー計算
  const summary = useMemo(() => {
    const totalFeatures = features.length;
    const totalSteps = features.reduce((acc, f) => acc + (f.stepCount || 0), 0);
    const totalWorkload = Math.round(features.reduce((acc, f) => acc + f.estimatedWorkload, 0) * 10) / 10;
    const subtotal = features.reduce(
      (acc, f) => acc + (f.estimatedAmount || f.estimatedWorkload * unitPrice),
      0
    );
    const taxAmount = Math.round(subtotal * taxRate);
    const totalAmount = subtotal + taxAmount;
    const productivity = totalWorkload > 0 && totalSteps > 0
      ? Math.round((totalSteps / totalWorkload) * 10) / 10
      : undefined;

    return {
      totalFeatures,
      totalSteps,
      totalWorkload,
      subtotal,
      taxAmount,
      totalAmount,
      productivity,
    };
  }, [features, unitPrice, taxRate]);

  if (!isOpen) return null;

  const handleSubmit = (autoLink = false) => {
    if (!estimateNumber.trim()) {
      setError('見積管理番号を入力してください');
      return;
    }
    // 重複チェック
    const isDuplicate = existingEstimates.some(
      (e) =>
        e.estimateNumber.trim().toLowerCase() === estimateNumber.trim().toLowerCase() &&
        e.id !== estimateToEdit?.id
    );
    if (isDuplicate) {
      setError(`見積管理番号「${estimateNumber.trim()}」は既に使用されています`);
      return;
    }

    if (!title.trim()) {
      setError('見積件名（プロジェクト名）を入力してください');
      return;
    }

    if (!startDate || !startDate.trim()) {
      setError('プロジェクト開始日は必須です。開始日を入力してください');
      return;
    }

    const validFeatures = features.filter((f) => f.name.trim());
    if (validFeatures.length === 0) {
      setError('少なくとも1つの機能名を入力してください');
      return;
    }

    const payload: Estimate = {
      id: estimateToEdit?.id || `est-${Date.now()}`,
      estimateNumber: estimateNumber.trim(),
      title: title.trim(),
      startDate: startDate.trim(),
      clientName: clientName.trim() || '未指定顧客',
      manager: manager.trim() || (members[0]?.name || '田中 敏夫'),
      issueDate,
      validUntil,
      status: autoLink ? 'linked' : status,
      workloadUnit,
      unitPrice,
      taxRate,
      notes: notes.trim(),
      features: validFeatures.map((f, i) => {
        const featPrice = f.unitPrice || computeFeaturePrice(f.assignee, workloadUnit, unitPrice);
        const validProcesses = Array.isArray(f.processes) && f.processes.length > 0
          ? f.processes
              .filter((p) => p.name && p.name.trim())
              .map((p, pIdx) => {
                const pPrice = p.unitPrice || computeFeaturePrice(p.assignee || f.assignee, workloadUnit, featPrice);
                const pWl = Math.max(0.1, Number(p.workload) || 1);
                return {
                  id: p.id || `est-p-${Date.now()}-${pIdx + 1}`,
                  name: p.name.trim(),
                  workload: pWl,
                  assignee: p.assignee?.trim() || f.assignee?.trim() || undefined,
                  unitPrice: pPrice,
                  amount: p.amount || Math.round(pWl * pPrice),
                  notes: p.notes?.trim() || undefined,
                };
              })
          : undefined;

        const featWl = validProcesses && validProcesses.length > 0
          ? Math.round(validProcesses.reduce((sum, p) => sum + p.workload, 0) * 10) / 10
          : Math.max(0.1, Number(f.estimatedWorkload) || 1);

        const featAmount = validProcesses && validProcesses.length > 0
          ? validProcesses.reduce((sum, p) => sum + (p.amount || 0), 0)
          : Math.round(featWl * featPrice);

        return {
          ...f,
          name: f.name.trim(),
          category: f.category?.trim() || '一般機能',
          assignee: f.assignee?.trim() || undefined,
          stepCount: f.stepCount !== undefined && f.stepCount > 0 ? f.stepCount : undefined,
          estimatedWorkload: featWl,
          unitPrice: featPrice,
          estimatedAmount: featAmount,
          processes: validProcesses,
        };
      }),
      linkedProjectId: estimateToEdit?.linkedProjectId,
      linkedProjectName: estimateToEdit?.linkedProjectName,
      linkedAt: estimateToEdit?.linkedAt,
      createdAt: estimateToEdit?.createdAt || today,
      updatedAt: today,
    };

    onSave(payload, autoLink);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* モーダルヘッダー */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {isEdit ? '概算見積の編集' : '新規概算見積の登録'}
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-900/80 text-indigo-200 border border-indigo-700">
                  {estimateNumber || '番号未設定'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                プロジェクト進捗管理で利用するプロジェクト・機能・Step数・工数を登録し、ワンクリックで連携できます
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* フォーム本文 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800">
          {/* セクション1: 見積基本情報 */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>基本情報 ＆ 見積管理番号</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* 見積管理番号 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>見積管理番号 <span className="text-rose-500">*</span></span>
                  <button
                    type="button"
                    onClick={() => setEstimateNumber(nextEstimateNumber)}
                    className="text-[10px] text-indigo-600 hover:underline cursor-pointer"
                  >
                    自動採番
                  </button>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={estimateNumber}
                    onChange={(e) => setEstimateNumber(e.target.value)}
                    placeholder="例: EST-2026-001"
                    className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* 見積件名（プロジェクト名） */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  見積件名 / プロジェクト名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例: 基幹ECリニューアルプロジェクト"
                  className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              {/* 顧客名 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  <span>顧客名 / 発注元企業</span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="例: 株式会社ワールドコマース"
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              {/* 見積担当者 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>見積担当者 (PM)</span>
                </label>
                <select
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                  {members.length === 0 && <option value="田中 敏夫">田中 敏夫 (部長)</option>}
                </select>
              </div>

              {/* ステータス */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  見積ステータス
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Estimate['status'])}
                  className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
                >
                  <option value="draft">📝 下書き (作成中)</option>
                  <option value="submitted">📤 提出済 (提案中)</option>
                  <option value="approved">🎉 受注・承認済 (内諾)</option>
                  <option value="linked">🚀 プロジェクト連携済</option>
                  <option value="rejected">❌ 失注 / 見送り</option>
                </select>
              </div>

              {/* 見積作成日 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>見積作成日</span>
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              {/* プロジェクト開始日 (必須) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-indigo-600" />
                    <span>プロジェクト開始日</span>
                  </span>
                  <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1 py-0.2 rounded border border-rose-200">*必須</span>
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold text-indigo-950 bg-indigo-50/70 border border-indigo-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              {/* 有効期限 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>見積有効期限</span>
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              {/* 工数単位 ＆ 想定単価 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    工数単位
                  </label>
                  <select
                    value={workloadUnit}
                    onChange={(e) => setWorkloadUnit(e.target.value as '人日' | '人時')}
                    className="w-full px-2.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
                  >
                    <option value="人日">人日 (日単位)</option>
                    <option value="人時">人時 (時間単位)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    単価 (円/{workloadUnit})
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1000"
                    value={unitPrice}
                    onChange={(e) => handleUnitPriceChange(Math.max(1, parseInt(e.target.value, 10) || 50000))}
                    className="w-full px-2.5 py-2 text-xs font-mono font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* セクション2: 概算機能一覧（プロジェクト進捗管理で利用する機能の登録） */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>登録機能一覧 (進捗管理の機能・Step数・工数と連携)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ここで登録した機能・Step数・工数は、プロジェクト進捗管理のWBSにそのまま反映されます
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddFeature}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>機能を追加</span>
              </button>
            </div>

            {/* 機能・工程テーブル */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <datalist id="estimate-process-suggestions">
                {COMMON_PROCESS_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>

              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[240px]">機能名 / 工程展開 <span className="text-rose-500">*</span></th>
                    <th className="py-2.5 px-2 w-28">カテゴリ</th>
                    <th className="py-2.5 px-2 w-36">機能担当者</th>
                    <th className="py-2.5 px-2 w-24 text-right">Step数 (行)</th>
                    <th className="py-2.5 px-2 w-32 text-right">概算工数({workloadUnit})</th>
                    <th className="py-2.5 px-2 w-24 text-right">想定生産性</th>
                    <th className="py-2.5 px-2 w-28 text-right">概算金額(円)</th>
                    <th className="py-2.5 px-1.5 w-10 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {features.map((f, idx) => {
                    const prod = f.estimatedWorkload > 0 && f.stepCount && f.stepCount > 0
                      ? Math.round((f.stepCount / f.estimatedWorkload) * 10) / 10
                      : null;
                    const isExpanded = expandedFeatureIndices.has(idx);
                    const hasProcesses = Array.isArray(f.processes) && f.processes.length > 0;

                    return (
                      <React.Fragment key={f.id || idx}>
                        {/* 機能メイン行 */}
                        <tr className={`hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-indigo-50/20' : ''}`}>
                          {/* 番号 */}
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] align-top">
                            {idx + 1}
                          </td>

                          {/* 機能名 ＆ 工程アコーディオン */}
                          <td className="py-2 px-3 align-top">
                            <div className="space-y-1.5">
                              <input
                                type="text"
                                value={f.name}
                                onChange={(e) => handleUpdateFeature(idx, { name: e.target.value })}
                                placeholder="例: ユーザー認証・会員管理機能"
                                className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                              />
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandFeature(idx)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                                    isExpanded
                                      ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                                      : hasProcesses
                                      ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                                  }`}
                                  title="機能内の工程一覧を展開・編集"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-indigo-600" />
                                  )}
                                  <span>
                                    {hasProcesses
                                      ? `工程内訳 (${f.processes!.length}工程)`
                                      : '+ 工程を登録'}
                                  </span>
                                </button>

                                {hasProcesses && (
                                  <span className="text-[11px] text-slate-500 font-mono">
                                    工程合計: <strong className="text-indigo-700">{f.estimatedWorkload}</strong> {workloadUnit}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* カテゴリ */}
                          <td className="py-2 px-2 align-top">
                            <input
                              type="text"
                              value={f.category || ''}
                              onChange={(e) => handleUpdateFeature(idx, { category: e.target.value })}
                              placeholder="共通基盤"
                              className="w-full px-2 py-1.5 text-xs text-slate-700 bg-white border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                            />
                          </td>

                          {/* 担当者 */}
                          <td className="py-2 px-2 align-top">
                            <select
                              value={f.assignee || ''}
                              onChange={(e) => handleUpdateFeature(idx, { assignee: e.target.value || undefined })}
                              className="w-full px-2 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
                            >
                              <option value="">未設定</option>
                              {eligibleAssignees.map((m) => (
                                <option key={m.id} value={m.name}>
                                  {m.name} ({m.role})
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Step数 */}
                          <td className="py-2 px-2 text-right align-top">
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={f.stepCount !== undefined ? f.stepCount : ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0);
                                handleUpdateFeature(idx, { stepCount: val });
                              }}
                              placeholder="Step数"
                              className="w-full px-2 py-1.5 text-right font-mono text-xs font-semibold text-indigo-700 bg-white border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                            />
                          </td>

                          {/* 概算工数（工程がある場合は各工程の工数合計を表示！） */}
                          <td className="py-2 px-2 text-right align-top">
                            {hasProcesses ? (
                              <div className="flex flex-col items-end">
                                <div
                                  className="w-full px-2 py-1.5 text-right font-mono text-xs font-bold text-indigo-950 bg-indigo-50/90 border border-indigo-300 rounded flex items-center justify-between shadow-2xs"
                                  title="登録された各工程の工数の自動合計値です。工程一覧で各工程の工数を変更できます"
                                >
                                  <span className="text-[10px] text-indigo-600 font-extrabold">Σ</span>
                                  <span>{f.estimatedWorkload} <span className="text-[10px] font-normal text-slate-500">{workloadUnit}</span></span>
                                </div>
                                <span className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                                  各工程の合計
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-end gap-1">
                                <input
                                  type="number"
                                  min="0.1"
                                  step={workloadUnit === '人日' ? '0.5' : '1'}
                                  value={f.estimatedWorkload}
                                  onChange={(e) =>
                                    handleUpdateFeature(idx, {
                                      estimatedWorkload: Math.max(0.1, parseFloat(e.target.value) || 0),
                                    })
                                  }
                                  className="w-full px-2 py-1.5 text-right font-mono text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddProcess(idx)}
                                  className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                                >
                                  + 工程を登録
                                </button>
                              </div>
                            )}
                          </td>

                          {/* 想定生産性 */}
                          <td className="py-2 px-2 text-right font-mono text-[11px] text-slate-600 align-top pt-3">
                            {prod ? (
                              <span className="font-bold text-emerald-700" title={`1${workloadUnit}あたり ${prod} Step`}>
                                {prod} <span className="text-[10px] text-slate-400 font-normal">S/{workloadUnit}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          {/* 概算金額 */}
                          <td className="py-2 px-2 text-right font-mono text-xs font-bold text-slate-900 align-top pt-2.5">
                            ¥{(f.estimatedAmount || f.estimatedWorkload * unitPrice).toLocaleString()}
                          </td>

                          {/* 削除 */}
                          <td className="py-2 px-1.5 text-center align-top pt-2.5">
                            <button
                              type="button"
                              onClick={() => handleDeleteFeature(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                              title="この機能を削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>

                        {/* 展開時：工程登録・内訳編集サブテーブル */}
                        {isExpanded && (
                          <tr className="bg-slate-50/90 border-b border-indigo-100">
                            <td colSpan={9} className="p-3 pl-6 pr-4">
                              <div className="bg-white rounded-xl border border-indigo-200 shadow-xs overflow-hidden">
                                {/* 工程ヘッダーバー */}
                                <div className="px-4 py-2.5 bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Workflow className="w-4 h-4 text-indigo-600 shrink-0" />
                                    <span className="text-xs font-bold text-slate-900">
                                      【{f.name || `機能 ${idx + 1}`}】の登録工程一覧
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-100/80 border border-indigo-200 px-2 py-0.5 rounded-full">
                                      {f.processes?.length || 0}工程
                                    </span>
                                    <span className="text-xs text-slate-600 font-medium">
                                      各工程の工数合計: <strong className="text-indigo-900 font-mono text-sm">{f.estimatedWorkload}</strong> {workloadUnit}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 flex-wrap">
                                    {/* 標準5工程を展開 */}
                                    <button
                                      type="button"
                                      onClick={() => handlePopulateStandardProcesses(idx)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold transition-colors cursor-pointer"
                                      title="設計・設計レビュー・実装・実装レビュー・単体テストの標準5工程を展開します"
                                    >
                                      <Sparkles className="w-3 h-3 text-amber-500" />
                                      <span>標準5工程を展開</span>
                                    </button>

                                    {/* 工程構成マスタから読込 */}
                                    {processPatterns && processPatterns.length > 0 && (
                                      <select
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            handleApplyPattern(idx, e.target.value);
                                            e.target.value = '';
                                          }
                                        }}
                                        defaultValue=""
                                        className="px-2 py-1 rounded bg-white text-slate-700 border border-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
                                        title="工程構成マスタのパターンを機能に適用"
                                      >
                                        <option value="" disabled>工程マスタから読込...</option>
                                        {processPatterns.map((pat) => (
                                          <option key={pat.id} value={pat.id}>
                                            {pat.name} ({pat.processes.length}工程)
                                          </option>
                                        ))}
                                      </select>
                                    )}

                                    {/* 工程を追加 */}
                                    <button
                                      type="button"
                                      onClick={() => handleAddProcess(idx)}
                                      className="inline-flex items-center gap-1 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>工程を追加</span>
                                    </button>
                                  </div>
                                </div>

                                {/* 工程一覧テーブル */}
                                {hasProcesses ? (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                                        <tr>
                                          <th className="py-2 px-3 w-8 text-center">#</th>
                                          <th className="py-2 px-3 min-w-[160px]">工程名 <span className="text-rose-500">*</span></th>
                                          <th className="py-2 px-2 w-36">工程担当者</th>
                                          <th className="py-2 px-2 w-28 text-right">工数 ({workloadUnit})</th>
                                          <th className="py-2 px-2 w-28 text-right">単価 (円/{workloadUnit})</th>
                                          <th className="py-2 px-3 w-28 text-right">金額 (円)</th>
                                          <th className="py-2 px-3">備考・作業内容</th>
                                          <th className="py-2 px-2 w-10 text-center">削除</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 bg-white">
                                        {f.processes!.map((proc, pIdx) => (
                                          <tr key={proc.id || pIdx} className="hover:bg-slate-50/80 transition-colors">
                                            {/* 工程番号 */}
                                            <td className="py-1.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                                              {pIdx + 1}
                                            </td>

                                            {/* 工程名 */}
                                            <td className="py-1.5 px-3">
                                              <input
                                                type="text"
                                                list="estimate-process-suggestions"
                                                value={proc.name}
                                                onChange={(e) => handleUpdateProcess(idx, pIdx, { name: e.target.value })}
                                                placeholder="例: 基本設計"
                                                className="w-full px-2 py-1 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                              />
                                            </td>

                                            {/* 工程担当者 */}
                                            <td className="py-1.5 px-2">
                                              <select
                                                value={proc.assignee || ''}
                                                onChange={(e) => handleUpdateProcess(idx, pIdx, { assignee: e.target.value || undefined })}
                                                className="w-full px-2 py-1 text-xs text-slate-800 bg-white border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                              >
                                                <option value="">{f.assignee ? `(機能担当者: ${f.assignee})` : '未設定'}</option>
                                                {eligibleAssignees.map((m) => (
                                                  <option key={m.id} value={m.name}>
                                                    {m.name} ({m.role})
                                                  </option>
                                                ))}
                                              </select>
                                            </td>

                                            {/* 工数 */}
                                            <td className="py-1.5 px-2 text-right">
                                              <input
                                                type="number"
                                                min="0.1"
                                                step={workloadUnit === '人日' ? '0.5' : '1'}
                                                value={proc.workload}
                                                onChange={(e) =>
                                                  handleUpdateProcess(idx, pIdx, {
                                                    workload: Math.max(0.1, parseFloat(e.target.value) || 0),
                                                  })
                                                }
                                                className="w-full px-2 py-1 text-right font-mono text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                              />
                                            </td>

                                            {/* 単価 */}
                                            <td className="py-1.5 px-2 text-right font-mono text-[11px] text-slate-600">
                                              <input
                                                type="number"
                                                min="1"
                                                step="1000"
                                                value={proc.unitPrice || unitPrice}
                                                onChange={(e) =>
                                                  handleUpdateProcess(idx, pIdx, {
                                                    unitPrice: Math.max(1, parseInt(e.target.value, 10) || 0),
                                                  })
                                                }
                                                className="w-full px-2 py-1 text-right font-mono text-xs text-slate-700 bg-white border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                              />
                                            </td>

                                            {/* 金額 */}
                                            <td className="py-1.5 px-3 text-right font-mono text-xs font-bold text-slate-900">
                                              ¥{(proc.amount || Math.round(proc.workload * (proc.unitPrice || unitPrice))).toLocaleString()}
                                            </td>

                                            {/* 備考 */}
                                            <td className="py-1.5 px-3">
                                              <input
                                                type="text"
                                                value={proc.notes || ''}
                                                onChange={(e) => handleUpdateProcess(idx, pIdx, { notes: e.target.value })}
                                                placeholder="備考・作業前提"
                                                className="w-full px-2 py-1 text-xs text-slate-600 bg-white border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                              />
                                            </td>

                                            {/* 削除 */}
                                            <td className="py-1.5 px-2 text-center">
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteProcess(idx, pIdx)}
                                                className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                                title="この工程を削除"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot className="bg-slate-50 border-t border-slate-200 text-slate-700 font-bold text-xs">
                                        <tr>
                                          <td colSpan={3} className="py-2.5 px-3 text-right text-slate-600">
                                            各工程の工数合計:
                                          </td>
                                          <td className="py-2.5 px-2 text-right font-mono text-indigo-700 font-bold text-sm bg-indigo-50/50">
                                            {f.estimatedWorkload} {workloadUnit}
                                          </td>
                                          <td className="py-2.5 px-2 text-right text-slate-500 text-[11px]">
                                            金額合計:
                                          </td>
                                          <td className="py-2.5 px-3 text-right font-mono text-indigo-950 font-bold text-sm bg-indigo-50/50">
                                            ¥{(f.estimatedAmount || 0).toLocaleString()}
                                          </td>
                                          <td colSpan={2} className="py-2.5 px-3 text-right">
                                            <button
                                              type="button"
                                              onClick={() => handleClearProcesses(idx)}
                                              className="text-[11px] text-slate-400 hover:text-rose-600 underline cursor-pointer"
                                            >
                                              工程をクリア (直接工数入力に戻す)
                                            </button>
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="py-6 px-4 text-center text-slate-500 text-xs space-y-2">
                                    <p>この機能には工程がまだ登録されていません。工程を登録すると工数は各工程の合計として自動計算されます。</p>
                                    <div className="flex items-center justify-center gap-2 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => handleAddProcess(idx)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold cursor-pointer text-xs"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>工程を追加する</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handlePopulateStandardProcesses(idx)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold cursor-pointer text-xs"
                                      >
                                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                        <span>標準5工程をセット</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* セクション3: 見積集計サマリー ＆ 前提条件 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 前提条件・備考 */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                前提条件 / 特記事項 / スコープ注記
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="例: 上記概算は要件定義前の想定規模に基づきます。インフラ構築およびサードパーティAPI利用料は別途。"
                className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            {/* 見積サマリー計算パネル */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-700">登録機能数 / 総Step数:</span>
                <span className="font-mono font-bold text-indigo-700">
                  {summary.totalFeatures}機能 / {summary.totalSteps > 0 ? `${summary.totalSteps.toLocaleString()} Step` : 'Step未入力'}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-600">概算総工数 / 想定平均生産性:</span>
                <span className="font-mono font-bold text-slate-800">
                  {summary.totalWorkload} {workloadUnit}
                  {summary.productivity && (
                    <span className="text-emerald-700 ml-1">
                      ({summary.productivity} Step/{workloadUnit})
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>小計 (税抜):</span>
                <span className="font-mono text-slate-800 font-semibold">
                  ¥{summary.subtotal.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                <span>消費税 ({(taxRate * 100).toFixed(0)}%):</span>
                <span className="font-mono">¥{summary.taxAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t-2 border-slate-300 text-sm font-bold text-slate-900">
                <span>概算見積合計 (税込):</span>
                <span className="font-mono text-indigo-900 text-base">
                  ¥{summary.totalAmount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>保存後いつでも「プロジェクト進捗管理」に連携してWBSを展開できます</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 text-slate-300" />
              <span>見積を保存</span>
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              title="見積を保存し、プロジェクト進捗管理に即座に新規プロジェクトとして連携します"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>保存して進捗管理へ即時連携</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
