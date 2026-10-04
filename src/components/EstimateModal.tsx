import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Calculator, Layers, FileText, Building2, User, Calendar, DollarSign, Sparkles, Check, AlertCircle } from 'lucide-react';
import { Estimate, EstimateFeature, Member, Project } from '../types';

interface EstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (estimate: Estimate, autoLink?: boolean) => void;
  estimateToEdit?: Estimate | null;
  members: Member[];
  existingEstimates: Estimate[];
}

export const EstimateModal: React.FC<EstimateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  estimateToEdit,
  members,
  existingEstimates,
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
      // 初期で1つの機能行を用意（デフォルト担当者は主任等から初期候補）
      const defaultAssignee = members.find((m) => m.role === '主任' || m.role === '担当')?.name || '';
      const initialPrice = computeFeaturePrice(defaultAssignee, '人日', 50000);
      setFeatures([
        {
          id: `est-f-${Date.now()}-1`,
          name: '',
          category: '一般機能',
          assignee: defaultAssignee,
          stepCount: undefined,
          estimatedWorkload: 10,
          unitPrice: initialPrice,
          estimatedAmount: Math.round(10 * initialPrice),
          description: '',
        },
      ]);
      setError('');
    }
  }, [estimateToEdit, isOpen, nextEstimateNumber, members, today, defaultValidUntil]);

  // 工数単位変更ハンドラ
  const handleWorkloadUnitChange = (newUnit: '人日' | '人時') => {
    setWorkloadUnit(newUnit);
    // 担当者の日単価・時給単価を再計算
    setFeatures((prev) =>
      prev.map((f) => {
        const price = computeFeaturePrice(f.assignee, newUnit, unitPrice);
        return {
          ...f,
          unitPrice: price,
          estimatedAmount: Math.round(f.estimatedWorkload * price),
        };
      })
    );
  };

  // 単価変更時に機能の金額を再計算
  const handleUnitPriceChange = (newPrice: number) => {
    setUnitPrice(newPrice);
    setFeatures((prev) =>
      prev.map((f) => {
        // 担当者が未設定の行のみ全体基準単価を反映
        if (!f.assignee) {
          return {
            ...f,
            unitPrice: newPrice,
            estimatedAmount: Math.round(f.estimatedWorkload * newPrice),
          };
        }
        return f;
      })
    );
  };

  // 機能の追加
  const handleAddFeature = () => {
    const defaultAssignee = members.find((m) => m.role === '主任' || m.role === '担当')?.name || '';
    const price = computeFeaturePrice(defaultAssignee, workloadUnit, unitPrice);
    const wl = workloadUnit === '人日' ? 10 : 80;
    setFeatures((prev) => [
      ...prev,
      {
        id: `est-f-${Date.now()}-${prev.length + 1}`,
        name: '',
        category: '一般機能',
        assignee: defaultAssignee,
        stepCount: undefined,
        estimatedWorkload: wl,
        unitPrice: price,
        estimatedAmount: Math.round(wl * price),
        description: '',
      },
    ]);
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

      // 工数または担当者/単価が変わったら金額を自動再計算
      if (
        patch.estimatedWorkload !== undefined ||
        patch.assignee !== undefined ||
        patch.unitPrice !== undefined
      ) {
        const p = target.unitPrice || unitPrice;
        target.estimatedAmount = Math.round(target.estimatedWorkload * p);
      }
      next[idx] = target;
      return next;
    });
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
        const featWl = Math.max(0.1, Number(f.estimatedWorkload) || 1);
        return {
          ...f,
          name: f.name.trim(),
          category: f.category?.trim() || '一般機能',
          assignee: f.assignee?.trim() || undefined,
          stepCount: f.stepCount !== undefined && f.stepCount > 0 ? f.stepCount : undefined,
          estimatedWorkload: featWl,
          unitPrice: featPrice,
          estimatedAmount: f.estimatedAmount || Math.round(featWl * featPrice),
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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
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

            {/* 機能テーブル */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">機能名 <span className="text-rose-500">*</span></th>
                    <th className="py-2.5 px-2 w-32">カテゴリ</th>
                    <th className="py-2.5 px-2 w-28 text-right">Step数 (行)</th>
                    <th className="py-2.5 px-2 w-28 text-right">概算工数({workloadUnit})</th>
                    <th className="py-2.5 px-2 w-28 text-right">想定生産性</th>
                    <th className="py-2.5 px-2 w-32 text-right">概算金額(円)</th>
                    <th className="py-2.5 px-1.5 w-10 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {features.map((f, idx) => {
                    const prod = f.estimatedWorkload > 0 && f.stepCount && f.stepCount > 0
                      ? Math.round((f.stepCount / f.estimatedWorkload) * 10) / 10
                      : null;
                    return (
                      <tr key={f.id || idx} className="hover:bg-slate-50 transition-colors">
                        {/* 番号 */}
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>

                        {/* 機能名 */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={f.name}
                            onChange={(e) => handleUpdateFeature(idx, { name: e.target.value })}
                            placeholder="例: ユーザー認証・会員管理機能"
                            className="w-full px-2 py-1 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                          />
                        </td>

                        {/* カテゴリ */}
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={f.category || ''}
                            onChange={(e) => handleUpdateFeature(idx, { category: e.target.value })}
                            placeholder="共通基盤"
                            className="w-full px-2 py-1 text-xs text-slate-700 bg-white border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                          />
                        </td>

                        {/* Step数 */}
                        <td className="py-2 px-2 text-right">
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
                            className="w-full px-2 py-1 text-right font-mono text-xs font-semibold text-indigo-700 bg-white border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                          />
                        </td>

                        {/* 概算工数 */}
                        <td className="py-2 px-2 text-right">
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
                            className="w-full px-2 py-1 text-right font-mono text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                          />
                        </td>

                        {/* 想定生産性 */}
                        <td className="py-2 px-2 text-right font-mono text-[11px] text-slate-600">
                          {prod ? (
                            <span className="font-bold text-emerald-700" title={`1${workloadUnit}あたり ${prod} Step`}>
                              {prod} <span className="text-[10px] text-slate-400 font-normal">S/{workloadUnit}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* 概算金額 */}
                        <td className="py-2 px-2 text-right font-mono text-xs font-bold text-slate-900">
                          ¥{(f.estimatedAmount || f.estimatedWorkload * unitPrice).toLocaleString()}
                        </td>

                        {/* 削除 */}
                        <td className="py-2 px-1.5 text-center">
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
