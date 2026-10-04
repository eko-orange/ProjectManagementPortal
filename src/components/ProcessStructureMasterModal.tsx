import React, { useState, useMemo, useRef } from 'react';
import {
  ProcessStructurePattern,
  ProcessMasterItem,
  COMMON_PROCESS_SUGGESTIONS,
} from '../types';
import { INITIAL_PROCESS_STRUCTURE_PATTERNS } from '../data/initialData';
import {
  exportProcessStructureToCsv,
  parseProcessStructureCsv,
  downloadProcessStructureTemplateCsv,
} from '../utils/csvHelper';
import {
  Workflow,
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Check,
  Copy,
  Star,
  RotateCcw,
  Sparkles,
  Layers,
  Info,
  Clock,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Upload,
} from 'lucide-react';

interface ProcessStructureMasterModalProps {
  patterns: ProcessStructurePattern[];
  workloadUnit?: '人時' | '人日';
  hoursPerDay?: number;
  onOpenCsvImport?: () => void;
  onSavePatterns: (patterns: ProcessStructurePattern[]) => void;
  onClose: () => void;
}

export const ProcessStructureMasterModal: React.FC<ProcessStructureMasterModalProps> = ({
  patterns: initialPatterns,
  workloadUnit = '人日',
  hoursPerDay = 8,
  onOpenCsvImport,
  onSavePatterns,
  onClose,
}) => {
  // ローカル編集用パターンリスト
  const [patterns, setPatterns] = useState<ProcessStructurePattern[]>(() => {
    if (Array.isArray(initialPatterns) && initialPatterns.length > 0) {
      return JSON.parse(JSON.stringify(initialPatterns));
    }
    return JSON.parse(JSON.stringify(INITIAL_PROCESS_STRUCTURE_PATTERNS));
  });

  // 選択中のパターンID
  const [selectedPatternId, setSelectedPatternId] = useState<string>(() => {
    const defaultPat = (patterns || []).find((p) => p.isDefault);
    return defaultPat ? defaultPat.id : patterns[0]?.id || '';
  });

  // ドラッグ＆ドロップ用状態
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // 通知トースト
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // CSV出力ハンドラ
  const handleExportCsv = () => {
    exportProcessStructureToCsv(patterns);
    showToast('工程構成マスタのCSVを出力しました');
  };

  // テンプレートCSVダウンロード
  const handleDownloadTemplate = () => {
    downloadProcessStructureTemplateCsv();
    showToast('テンプレートCSVをダウンロードしました');
  };

  // CSV直接取り込みハンドラ
  const handleDirectCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) || '';
      try {
        const parsed = parseProcessStructureCsv(text);
        if (parsed.patterns.length === 0) {
          alert('有効な工程構成データが検出されませんでした。');
          return;
        }

        const modeChoice = confirm(
          `CSVから ${parsed.patterns.length} 件の工程構成パターンを検出しました。\n\n` +
          `【OK】: 既存のパターンに新しいパターンを追加・更新します\n` +
          `【キャンセル】: 既存パターンをすべて置き換えます`
        );

        if (modeChoice) {
          // 追加・マージ
          const map = new Map<string, ProcessStructurePattern>();
          patterns.forEach((p) => map.set(p.name.trim(), p));
          parsed.patterns.forEach((p) => map.set(p.name.trim(), p));
          const merged = Array.from(map.values());
          setPatterns(merged);
          setSelectedPatternId(parsed.patterns[0].id);
          showToast(`CSVから ${parsed.patterns.length} 件のパターンを追加・更新しました`);
        } else {
          // 置き換え
          setPatterns(parsed.patterns);
          setSelectedPatternId(parsed.patterns[0].id);
          showToast(`CSVから ${parsed.patterns.length} 件のパターンに置き換えました`);
        }
      } catch (err: any) {
        alert(`CSVの解析に失敗しました: ${err.message}`);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  // 選択中パターンの取得
  const selectedPattern = useMemo(() => {
    return patterns.find((p) => p.id === selectedPatternId) || patterns[0];
  }, [patterns, selectedPatternId]);

  // 選択中パターンの更新補助関数
  const updateSelectedPattern = (updater: (prev: ProcessStructurePattern) => ProcessStructurePattern) => {
    if (!selectedPattern) return;
    setPatterns((prev) =>
      prev.map((p) => (p.id === selectedPattern.id ? updater(p) : p))
    );
  };

  // デフォルトパターンの切り替え
  const handleSetDefaultPattern = (patternId: string) => {
    setPatterns((prev) =>
      prev.map((p) => ({
        ...p,
        isDefault: p.id === patternId,
      }))
    );
    showToast('新規機能作成時の初期表示パターンに設定しました');
  };

  // パターン名・説明の更新
  const handleUpdatePatternMeta = (field: 'name' | 'description', val: string) => {
    updateSelectedPattern((p) => ({
      ...p,
      [field]: val,
    }));
  };

  // 新規パターンの追加
  const handleAddNewPattern = () => {
    const newId = `pattern-${Date.now()}`;
    const newPattern: ProcessStructurePattern = {
      id: newId,
      name: `新規工程パターン ${patterns.length + 1}`,
      description: '独自の工程構成と標準工数',
      isDefault: patterns.length === 0,
      processes: [
        { id: `proc-${Date.now()}-1`, name: '設計', defaultDays: 5, description: '基本・詳細設計' },
        { id: `proc-${Date.now()}-2`, name: '実装', defaultDays: 8, description: 'コーディング' },
        { id: `proc-${Date.now()}-3`, name: '単体テスト', defaultDays: 4, description: '動作検証' },
      ],
    };

    setPatterns((prev) => [...prev, newPattern]);
    setSelectedPatternId(newId);
    showToast('新しい工程構成パターンを追加しました');
  };

  // パターンの複製
  const handleDuplicatePattern = (pat: ProcessStructurePattern) => {
    const newId = `pattern-${Date.now()}`;
    const duplicated: ProcessStructurePattern = {
      ...JSON.parse(JSON.stringify(pat)),
      id: newId,
      name: `${pat.name} (コピー)`,
      isDefault: false,
    };

    setPatterns((prev) => [...prev, duplicated]);
    setSelectedPatternId(newId);
    showToast(`「${pat.name}」を複製しました`);
  };

  // パターンの削除
  const handleDeletePattern = (patternId: string) => {
    if (patterns.length <= 1) {
      alert('最低1つの工程構成パターンが必要です');
      return;
    }

    const target = patterns.find((p) => p.id === patternId);
    if (!target) return;

    if (!confirm(`工程構成パターン「${target.name}」を削除してもよろしいですか？`)) {
      return;
    }

    const remaining = patterns.filter((p) => p.id !== patternId);
    // 削除対象がデフォルトだった場合、先頭をデフォルトにする
    if (target.isDefault && remaining.length > 0) {
      remaining[0].isDefault = true;
    }

    setPatterns(remaining);
    setSelectedPatternId(remaining[0].id);
    showToast('パターンを削除しました');
  };

  // 全パターンを初期値に復元
  const handleResetAllPatterns = () => {
    if (confirm('すべての工程構成パターンを初期標準状態にリセットしますか？')) {
      const initial = JSON.parse(JSON.stringify(INITIAL_PROCESS_STRUCTURE_PATTERNS));
      setPatterns(initial);
      setSelectedPatternId(initial[0].id);
      showToast('初期標準パターンにリセットしました');
    }
  };

  // 選択中パターンを標準6工程にリセット
  const handleResetCurrentToStandard = () => {
    if (!selectedPattern) return;
    if (confirm(`「${selectedPattern.name}」の工程を標準6工程（設計〜単体テストレビュー）に再設定しますか？`)) {
      const standard6: ProcessMasterItem[] = [
        { id: `proc-${Date.now()}-1`, name: '設計', defaultDays: 5, description: '仕様書作成・画面設計・詳細設計' },
        { id: `proc-${Date.now()}-2`, name: '設計レビュー', defaultDays: 2, description: '仕様レビュー・設計書承認' },
        { id: `proc-${Date.now()}-3`, name: '実装', defaultDays: 8, description: '機能の実装・プログラミング' },
        { id: `proc-${Date.now()}-4`, name: '実装レビュー', defaultDays: 2, description: 'コードレビュー・プルリク承認' },
        { id: `proc-${Date.now()}-5`, name: '単体テスト', defaultDays: 4, description: 'テストコード作成・単体検証' },
        { id: `proc-${Date.now()}-6`, name: '単体テストレビュー', defaultDays: 2, description: 'テスト結果検証・エビデンス確認' },
      ];
      updateSelectedPattern((p) => ({
        ...p,
        processes: standard6,
      }));
      showToast('標準6工程に再設定しました');
    }
  };

  // 工程の変更
  const handleUpdateProcess = (procId: string, field: keyof ProcessMasterItem, val: any) => {
    updateSelectedPattern((p) => ({
      ...p,
      processes: p.processes.map((proc) =>
        proc.id === procId ? { ...proc, [field]: val } : proc
      ),
    }));
  };

  // 工程の削除
  const handleDeleteProcess = (procId: string) => {
    if (!selectedPattern) return;
    if (selectedPattern.processes.length <= 1) {
      alert('最低1つの工程が必要です');
      return;
    }
    updateSelectedPattern((p) => ({
      ...p,
      processes: p.processes.filter((proc) => proc.id !== procId),
    }));
  };

  // 工程の追加
  const handleAddProcess = (presetName: string = '新規工程', defaultDays: number = 3, desc: string = '') => {
    const newProc: ProcessMasterItem = {
      id: `proc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: presetName,
      defaultDays,
      description: desc,
    };
    updateSelectedPattern((p) => ({
      ...p,
      processes: [...p.processes, newProc],
    }));
  };

  // 工程の並び順移動（上へ）
  const handleMoveUp = (index: number) => {
    if (index <= 0 || !selectedPattern) return;
    updateSelectedPattern((p) => {
      const next = [...p.processes];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return { ...p, processes: next };
    });
  };

  // 工程の並び順移動（下へ）
  const handleMoveDown = (index: number) => {
    if (!selectedPattern || index >= selectedPattern.processes.length - 1) return;
    updateSelectedPattern((p) => {
      const next = [...p.processes];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return { ...p, processes: next };
    });
  };

  // ドラッグ＆ドロップ
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex || !selectedPattern) {
      setDraggedIndex(null);
      return;
    }
    updateSelectedPattern((p) => {
      const next = [...p.processes];
      const [removed] = next.splice(draggedIndex, 1);
      next.splice(targetIndex, 0, removed);
      return { ...p, processes: next };
    });
    setDraggedIndex(null);
  };

  // 保存して閉じる
  const handleSaveAndApply = () => {
    // 少なくとも1つはisDefaultをtrueにする
    const hasDefault = patterns.some((p) => p.isDefault);
    const validatedPatterns = patterns.map((p, idx) => ({
      ...p,
      isDefault: hasDefault ? p.isDefault : idx === 0,
      processes: p.processes.map((proc) => ({
        ...proc,
        name: proc.name.trim() || '未設定工程',
        defaultDays: Math.max(0.5, Number(proc.defaultDays) || 1),
      })),
    }));

    onSavePatterns(validatedPatterns);
    onClose();
  };

  // 合計工数の計算
  const totalDays = useMemo(() => {
    if (!selectedPattern) return 0;
    return selectedPattern.processes.reduce((sum, p) => sum + (Number(p.defaultDays) || 0), 0);
  }, [selectedPattern]);

  const totalHours = totalDays * hoursPerDay;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl flex flex-col max-h-[92vh] overflow-hidden text-slate-800">
        
        {/* モーダルヘッダー */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shadow-inner">
              <Workflow className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  工程構成マスタ管理
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                  マスタ設定
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                新規機能追加時に自動生成・初期表示される工程構成と標準所要日数を一元管理します
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CSV管理アクションバー */}
        <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-700 font-medium">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold text-slate-800">CSVデータ連携:</span>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Excel等で編集した工程構成を取り込んだり、現在のマスタをCSV出力して共有できます
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-indigo-900 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Excel等で編集するためのサンプルCSVテンプレートをダウンロード"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
              <span>雛形ダウンロード</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="現在の工程構成マスタ全パターンをCSVファイルとして出力"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>CSV出力</span>
            </button>

            {onOpenCsvImport ? (
              <div className="inline-flex rounded-lg shadow-2xs">
                <button
                  type="button"
                  onClick={onOpenCsvImport}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-l-lg text-xs font-bold transition-colors cursor-pointer"
                  title="プレビュー確認・エラー検出付きでCSVデータを取り込み"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>CSV取り込み</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-r-lg border-l border-indigo-500 text-xs font-medium transition-colors cursor-pointer"
                  title="CSVファイルを即座に読み込んで編集画面に反映"
                >
                  即時読込
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                title="CSVファイルから工程構成パターンを取り込み（追加または置換）"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>CSV取り込み</span>
              </button>
            )}

            {/* 直接ファイル選択用の隠しinput */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,text/csv"
              onChange={handleDirectCsvImport}
              className="hidden"
            />
          </div>
        </div>

        {/* トースト表示 */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white text-xs font-semibold py-1.5 px-4 text-center shrink-0 flex items-center justify-center gap-2 animate-in slide-in-from-top-2 duration-150">
            <Check className="w-3.5 h-3.5" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* メインボディ：2カラムレイアウト（左：パターン一覧、右：工程構成編集） */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200">
          
          {/* 左カラム：パターン一覧 (320px) */}
          <div className="w-full md:w-80 bg-slate-50/70 p-4 flex flex-col shrink-0 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>工程構成パターン ({patterns.length}件)</span>
              </div>
              <button
                type="button"
                onClick={handleAddNewPattern}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-md transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>パターン追加</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
              ★マークの付いたパターンが、新規機能追加モーダルの初期表示として適用されます。
            </p>

            {/* パターンリスト */}
            <div className="space-y-2 flex-1">
              {patterns.map((pat) => {
                const isSelected = pat.id === selectedPatternId;
                const pCount = pat.processes.length;
                const pDays = pat.processes.reduce((sum, p) => sum + (Number(p.defaultDays) || 0), 0);

                return (
                  <div
                    key={pat.id}
                    onClick={() => setSelectedPatternId(pat.id)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all relative ${
                      isSelected
                        ? 'bg-white border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                        : 'bg-white hover:bg-slate-100/80 border-slate-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="font-bold text-xs text-slate-900 line-clamp-1">
                        {pat.name}
                      </div>
                      {pat.isDefault && (
                        <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                          <span>初期デフォルト</span>
                        </span>
                      )}
                    </div>

                    {pat.description && (
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                        {pat.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-slate-500">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded">
                          {pCount}工程
                        </span>
                        <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                          計{pDays}日 ({pDays * hoursPerDay}h)
                        </span>
                      </div>

                      {/* アクションボタン（複製・削除） */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleDuplicatePattern(pat)}
                          title="このパターンを複製"
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {patterns.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeletePattern(pat.id)}
                            title="このパターンを削除"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 左下：初期標準に全復元 */}
            <div className="mt-4 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleResetAllPatterns}
                className="w-full text-center text-[11px] text-slate-500 hover:text-rose-700 py-1.5 rounded hover:bg-rose-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>すべてのパターンを初期標準にリセット</span>
              </button>
            </div>
          </div>

          {/* 右カラム：選択中パターンの詳細・工程一覧編集 */}
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            
            {/* 上部：パターンメタ設定バー */}
            {selectedPattern && (
              <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col gap-3 shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      パターン名
                    </label>
                    <input
                      type="text"
                      value={selectedPattern.name}
                      onChange={(e) => handleUpdatePatternMeta('name', e.target.value)}
                      placeholder="例: 標準開発パターン（設計〜単体テスト）"
                      className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-2xs"
                    />
                  </div>

                  {/* デフォルト設定トグルボタン */}
                  <div className="sm:self-end">
                    {selectedPattern.isDefault ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
                        <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                        <span>新規機能作成時の初期表示に指定中</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultPattern(selectedPattern.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-300 hover:border-amber-400 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      >
                        <Star className="w-4 h-4 text-slate-400 hover:text-amber-500" />
                        <span>★ このパターンを初期表示にする</span>
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    パターンの説明・用途
                  </label>
                  <input
                    type="text"
                    value={selectedPattern.description || ''}
                    onChange={(e) => handleUpdatePatternMeta('description', e.target.value)}
                    placeholder="例: 仕様書作成からコード実装・単体テストまでを含む標準的な6工程構成"
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-1 text-xs text-slate-700 shadow-2xs"
                  />
                </div>
              </div>
            )}

            {/* 中部：工程一覧テーブル（スクロールエリア） */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>工程構成リスト</span>
                    <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-mono text-[11px]">
                      全 {selectedPattern?.processes.length || 0} 工程
                    </span>
                  </h3>
                  <span className="text-slate-400 text-xs">|</span>
                  <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5 font-mono">
                    <span>合計標準工数:</span>
                    <strong className="text-indigo-700 font-bold">{totalDays}人日</strong>
                    <span className="text-slate-400 font-normal">({totalHours}時間)</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetCurrentToStandard}
                    className="text-[11px] text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer font-medium"
                    title="標準6工程（設計・レビュー・実装・レビュー・単体テスト・レビュー）にリセット"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>標準6工程にリセット</span>
                  </button>
                </div>
              </div>

              {/* 工程リストテーブル */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 text-[11px]">
                      <th className="py-2 px-2.5 text-center w-12 font-bold">順序</th>
                      <th className="py-2 px-3 font-bold min-w-[160px]">
                        工程名 <span className="text-rose-500">*</span>
                      </th>
                      <th className="py-2 px-3 font-bold w-36">
                        標準所要日数 <span className="text-rose-500">*</span>
                      </th>
                      <th className="py-2 px-3 font-bold">
                        工程の概要・作業内容メモ
                      </th>
                      <th className="py-2 px-2.5 text-center w-20 font-bold">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {selectedPattern?.processes.map((proc, index) => {
                      const isFirst = index === 0;
                      const isLast = index === selectedPattern.processes.length - 1;
                      const procDays = Number(proc.defaultDays) || 1;
                      const procHours = procDays * hoursPerDay;

                      return (
                        <tr
                          key={proc.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDrop={(e) => handleDrop(e, index)}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            draggedIndex === index ? 'opacity-40 bg-indigo-50' : ''
                          }`}
                        >
                          {/* 順序・ドラッグ・移動ボタン */}
                          <td className="py-2 px-2 text-center align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <span className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600">
                                <GripVertical className="w-3.5 h-3.5" />
                              </span>
                              <span className="font-mono font-bold text-slate-500 text-[11px] w-4">
                                {index + 1}
                              </span>
                            </div>
                          </td>

                          {/* 工程名 */}
                          <td className="py-2 px-3 align-middle">
                            <div className="relative">
                              <input
                                type="text"
                                list="common-process-suggestions"
                                value={proc.name}
                                onChange={(e) => handleUpdateProcess(proc.id, 'name', e.target.value)}
                                placeholder="例: 設計, 実装"
                                className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-900 shadow-2xs"
                              />
                            </div>
                          </td>

                          {/* 標準所要日数 */}
                          <td className="py-2 px-3 align-middle">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0.5"
                                max="120"
                                step="0.5"
                                value={proc.defaultDays}
                                onChange={(e) =>
                                  handleUpdateProcess(
                                    proc.id,
                                    'defaultDays',
                                    Math.max(0.5, parseFloat(e.target.value) || 1)
                                  )
                                }
                                className="w-20 bg-white border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-md px-2 py-1 text-xs font-mono font-bold text-slate-900 shadow-2xs text-right"
                              />
                              <div className="text-[10px] text-slate-500 font-mono leading-tight whitespace-nowrap">
                                <span>人日</span>
                                <span className="block text-slate-400">({procHours}h)</span>
                              </div>
                            </div>
                          </td>

                          {/* 工程メモ */}
                          <td className="py-2 px-3 align-middle">
                            <input
                              type="text"
                              value={proc.description || ''}
                              onChange={(e) => handleUpdateProcess(proc.id, 'description', e.target.value)}
                              placeholder="作業概要・成果物メモ（任意）"
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-md px-2.5 py-1 text-xs text-slate-600 shadow-2xs placeholder:text-slate-300"
                            />
                          </td>

                          {/* 操作（上へ・下へ・削除） */}
                          <td className="py-2 px-2 text-center align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                disabled={isFirst}
                                onClick={() => handleMoveUp(index)}
                                title="上へ移動"
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded disabled:opacity-30 disabled:pointer-events-none"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={isLast}
                                onClick={() => handleMoveDown(index)}
                                title="下へ移動"
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded disabled:opacity-30 disabled:pointer-events-none"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProcess(proc.id)}
                                title="この工程を削除"
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* クイック追加・工程追加セクション */}
              <div className="mt-4 p-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/70">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    <span>定型工程のクイック追加（ワンクリックで工程を追加できます）:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddProcess('新規工程', 3, '')}
                    className="inline-flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>空の工程を追加</span>
                  </button>
                </div>

                {/* よく使われる工程チップス */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { name: '要件定義', days: 5, desc: '要求仕様の整理・定義' },
                    { name: '基本設計', days: 5, desc: 'アーキテクチャ・画面設計' },
                    { name: '詳細設計', days: 5, desc: '内部ロジック・DB設計' },
                    { name: '設計レビュー', days: 2, desc: '設計書レビュー' },
                    { name: '実装', days: 8, desc: 'プログラム作成' },
                    { name: '実装レビュー', days: 2, desc: 'コードレビュー' },
                    { name: '単体テスト', days: 4, desc: '単体検証・エビデンス' },
                    { name: '単体テストレビュー', days: 2, desc: 'テスト結果合否確認' },
                    { name: '結合テスト', days: 5, desc: '機能連携テスト' },
                    { name: '総合テスト', days: 5, desc: 'シナリオ・非機能テスト' },
                    { name: '受入テスト', days: 3, desc: 'ユーザー検証' },
                    { name: 'リリース準備', days: 2, desc: 'デプロイ・手順書確認' },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleAddProcess(preset.name, preset.days, preset.desc)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-indigo-50 hover:text-indigo-800 border border-slate-200 hover:border-indigo-300 px-2 py-1 rounded-md transition-all cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3 h-3 text-slate-400" />
                      <span>{preset.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono font-normal">
                        ({preset.days}日)
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ガイドライン説明 */}
              <div className="mt-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 text-amber-900 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11px]">
                  <strong>マスタの連動について:</strong>
                  ここで設定した工程構成は、WBS画面の「機能追加」ボタンを押した際に初期値として自動ロードされます。
                  複数パターンがある場合は機能追加モーダル上でも切り替え可能です。また、各機能ごとの工程追加・削除・工数微調整は従来通り機能登録時にも自由に行えます。
                </div>
              </div>
            </div>

            {/* 下部：フッターアクションバー */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                <span>選択中:</span>
                <strong className="text-slate-800">{selectedPattern?.name}</strong>
                {selectedPattern?.isDefault && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded">
                    ★ 初期適用
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndApply}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>工程構成マスタを保存して適用</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 工程名補完用datalist */}
      <datalist id="common-process-suggestions">
        {COMMON_PROCESS_SUGGESTIONS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
};
