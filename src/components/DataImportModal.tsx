import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  Layers,
  Users,
  Calendar,
  Info,
  ChevronRight,
  Database,
  Clock,
  CalendarDays,
  Workflow,
} from 'lucide-react';
import { Holiday, Member, Project, ProcessStructurePattern } from '../types';
import {
  parseHolidaysCsv,
  parseMembersCsv,
  parseWbsCsv,
  parseProcessStructureCsv,
  downloadHolidaysTemplateCsv,
  downloadMembersTemplateCsv,
  downloadWbsTemplateCsv,
  downloadProcessStructureTemplateCsv,
  ParsedWbsRow,
} from '../utils/csvHelper';
import { importHolidaysApi, importMembersApi, importWbsApi, importProcessPatternsApi } from '../utils/api';

export type ImportTabType = 'wbs' | 'members' | 'holidays' | 'process_structure';

interface DataImportModalProps {
  isOpen?: boolean;
  onClose: () => void;
  initialTab?: ImportTabType;
  holidays?: Holiday[];
  members?: Member[];
  projects?: Project[];
  onImportComplete: (type: ImportTabType, message: string) => void;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({
  isOpen = true,
  onClose,
  initialTab = 'wbs',
  projects,
  onImportComplete,
}) => {
  const [activeTab, setActiveTab] = useState<ImportTabType>(initialTab);
  const [encoding, setEncoding] = useState<'utf-8' | 'shift-jis'>('utf-8');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  // 工数単位の選択状態（人日 または 人時）
  const defaultUnit = projects?.[0]?.settings?.workloadUnit || '人日';
  const [workloadUnit, setWorkloadUnit] = useState<'人日' | '人時'>(defaultUnit);
  const [fileName, setFileName] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // 各種パース結果キャッシュ
  const [parsedHolidays, setParsedHolidays] = useState<Holiday[]>([]);
  const [parsedMembers, setParsedMembers] = useState<Member[]>([]);
  const [parsedWbsRows, setParsedWbsRows] = useState<ParsedWbsRow[]>([]);
  const [parsedProjects, setParsedProjects] = useState<Project[]>([]);
  const [parsedPatterns, setParsedPatterns] = useState<ProcessStructurePattern[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [totalRowsCount, setTotalRowsCount] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isOpen === false) return null;

  // タブ切替時にファイルをリセット
  const handleTabChange = (tab: ImportTabType) => {
    setActiveTab(tab);
    resetFileState();
  };

  const resetFileState = () => {
    setFileName('');
    setRawText('');
    setErrorMessage('');
    setParsedHolidays([]);
    setParsedMembers([]);
    setParsedWbsRows([]);
    setParsedProjects([]);
    setParsedPatterns([]);
    setParseErrors([]);
    setTotalRowsCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ファイル読み込み処理
  const processFile = (file: File, enc: 'utf-8' | 'shift-jis') => {
    setFileName(file.name);
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      setRawText(text);
      parseFileContent(text, activeTab, workloadUnit);
    };
    reader.onerror = () => {
      setErrorMessage('ファイルの読み込みに失敗しました。');
    };

    if (enc === 'shift-jis') {
      reader.readAsText(file, 'shift-jis');
    } else {
      reader.readAsText(file, 'utf-8');
    }
  };

  // テキスト解析
  const parseFileContent = (
    text: string,
    tab: ImportTabType,
    unit: '人日' | '人時' = workloadUnit
  ) => {
    try {
      if (tab === 'holidays') {
        const result = parseHolidaysCsv(text);
        setParsedHolidays(result.holidays);
        setParseErrors(result.errors);
        setTotalRowsCount(result.totalRows);
      } else if (tab === 'members') {
        const result = parseMembersCsv(text);
        setParsedMembers(result.members);
        setParseErrors(result.errors);
        setTotalRowsCount(result.totalRows);
      } else if (tab === 'wbs') {
        const result = parseWbsCsv(text, '田中 敏夫', unit);
        setParsedWbsRows(result.rows);
        setParsedProjects(result.projects);
        setParseErrors(result.errors);
        setTotalRowsCount(result.totalRows);
      } else if (tab === 'process_structure') {
        const result = parseProcessStructureCsv(text);
        setParsedPatterns(result.patterns);
        setParseErrors(result.errors);
        setTotalRowsCount(result.totalRows);
      }
    } catch (err: any) {
      setErrorMessage(`CSVの解析中にエラーが発生しました: ${err.message}`);
    }
  };

  // 工数単位変更ハンドラ（変更時に即時再パース）
  const handleWorkloadUnitChange = (newUnit: '人日' | '人時') => {
    setWorkloadUnit(newUnit);
    if (rawText && activeTab === 'wbs') {
      parseFileContent(rawText, 'wbs', newUnit);
    }
  };

  // エンコーディング変更時の再パース
  const handleEncodingChange = (newEnc: 'utf-8' | 'shift-jis') => {
    setEncoding(newEnc);
    if (fileInputRef.current?.files?.[0]) {
      processFile(fileInputRef.current.files[0], newEnc);
    }
  };

  // ファイル選択ハンドラ
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file, encoding);
    }
  };

  // ドラッグ＆ドロップハンドラ
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file, encoding);
    }
  };

  // テンプレートダウンロード
  const handleDownloadTemplate = () => {
    if (activeTab === 'wbs') downloadWbsTemplateCsv(workloadUnit);
    if (activeTab === 'members') downloadMembersTemplateCsv();
    if (activeTab === 'holidays') downloadHolidaysTemplateCsv();
    if (activeTab === 'process_structure') downloadProcessStructureTemplateCsv();
  };

  // 取り込み実行
  const handleExecuteImport = async () => {
    setIsProcessing(true);
    setErrorMessage('');

    try {
      if (activeTab === 'wbs') {
        if (parsedProjects.length === 0) {
          setErrorMessage('有効なプロジェクト・工程データがありません。');
          setIsProcessing(false);
          return;
        }
        const res = await importWbsApi(parsedProjects, importMode, workloadUnit);
        if (res.success) {
          onImportComplete(
            'wbs',
            `${parsedProjects.length}件のプロジェクト（合計${parsedWbsRows.length}件の工程データ / 単位: ${workloadUnit}）を取り込みました。`
          );
          onClose();
        } else {
          setErrorMessage(res.error || 'WBSデータの取り込みに失敗しました。');
        }
      } else if (activeTab === 'members') {
        if (parsedMembers.length === 0) {
          setErrorMessage('有効な担当者データがありません。');
          setIsProcessing(false);
          return;
        }
        const res = await importMembersApi(parsedMembers, importMode);
        if (res.success) {
          onImportComplete(
            'members',
            `${parsedMembers.length}名の担当者マスタ情報を取り込みました。`
          );
          onClose();
        } else {
          setErrorMessage(res.error || '担当者マスタの取り込みに失敗しました。');
        }
      } else if (activeTab === 'holidays') {
        if (parsedHolidays.length === 0) {
          setErrorMessage('有効な休日データがありません。');
          setIsProcessing(false);
          return;
        }
        const res = await importHolidaysApi(parsedHolidays, importMode);
        if (res.success) {
          onImportComplete(
            'holidays',
            `${parsedHolidays.length}件の休日カレンダー情報を取り込みました。`
          );
          onClose();
        } else {
          setErrorMessage(res.error || '休日データの取り込みに失敗しました。');
        }
      } else if (activeTab === 'process_structure') {
        if (parsedPatterns.length === 0) {
          setErrorMessage('有効な工程構成パターンデータがありません。');
          setIsProcessing(false);
          return;
        }
        const res = await importProcessPatternsApi(parsedPatterns, importMode);
        if (res.success) {
          const totalProcs = parsedPatterns.reduce((s, p) => s + p.processes.length, 0);
          onImportComplete(
            'process_structure',
            `${parsedPatterns.length}件の工程構成パターン（合計${totalProcs}工程）を取り込みました。`
          );
          onClose();
        } else {
          setErrorMessage(res.error || '工程構成マスタの取り込みに失敗しました。');
        }
      }
    } catch (err: any) {
      setErrorMessage(`取り込み実行中にエラーが発生しました: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 現在のタブの取り込み対象件数
  const validDataCount =
    activeTab === 'wbs'
      ? parsedWbsRows.length
      : activeTab === 'members'
      ? parsedMembers.length
      : activeTab === 'holidays'
      ? parsedHolidays.length
      : parsedPatterns.reduce((sum, p) => sum + p.processes.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* モーダルヘッダー */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                CSV取り込み
                <span className="text-xs font-normal text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded-full border border-indigo-700/50">
                  インポート
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                プロジェクト進捗・工程、担当者マスタ、休日カレンダーのCSVデータを取り込みます
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* タブナビゲーション */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 pt-2 gap-2">
          <button
            type="button"
            onClick={() => handleTabChange('wbs')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-t border-x cursor-pointer ${
              activeTab === 'wbs'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>プロジェクト・機能・工程進捗</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('members')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-t border-x cursor-pointer ${
              activeTab === 'members'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4 text-indigo-600" />
            <span>担当者マスタ</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('holidays')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-t border-x cursor-pointer ${
              activeTab === 'holidays'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>休日管理カレンダー</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('process_structure')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-t border-x cursor-pointer ${
              activeTab === 'process_structure'
                ? 'bg-white text-emerald-700 border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <Workflow className="w-4 h-4 text-emerald-600" />
            <span>工程構成マスタ</span>
          </button>
        </div>

        {/* モーダルコンテンツ本体 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-700">
          {/* 説明＆テンプレートダウンロードエリア */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-indigo-950">
                  {activeTab === 'wbs' && 'プロジェクト・機能・工程進捗データのCSV取り込み'}
                  {activeTab === 'members' && '担当者マスタ（氏名・役職・所属・稼働時間）のCSV取り込み'}
                  {activeTab === 'holidays' && '休日管理カレンダー（日付・祝日・会社休日）のCSV取り込み'}
                  {activeTab === 'process_structure' && '工程構成マスタ（パターン名・初期デフォルト・工程名・標準工数）のCSV取り込み'}
                </p>
                <p className="text-[11px] text-indigo-800/80 mt-0.5">
                  Excel等で作成・編集したCSVファイルをアップロードしてください。専用テンプレートをご利用いただけます。
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-lg font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                title={
                  activeTab === 'wbs'
                    ? `工数単位「${workloadUnit}」に対応したテンプレートCSVをダウンロード`
                    : 'テンプレートCSVをダウンロード'
                }
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {activeTab === 'wbs'
                    ? `テンプレートCSV (${workloadUnit}) をDL`
                    : 'テンプレートCSVをダウンロード'}
                </span>
              </button>
            </div>
          </div>

          {/* WBS専用：工数単位の選択カード（人日 または 人時） */}
          {activeTab === 'wbs' && (
            <div className="bg-indigo-50/80 p-3.5 rounded-xl border border-indigo-200 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="text-indigo-950 font-bold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>工数単位の選択（人日 / 人時）</span>
                  <span className="text-[10px] bg-indigo-200/80 text-indigo-900 px-1.5 py-0.5 rounded font-bold">
                    選択必須
                  </span>
                </label>
                <span className="text-[11px] text-indigo-700 font-medium">
                  現在の選択単位: <span className="font-bold underline text-indigo-900">{workloadUnit}</span>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 人日 選択肢 */}
                <label
                  onClick={() => handleWorkloadUnitChange('人日')}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    workloadUnit === '人日'
                      ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="workloadUnitSelection"
                    value="人日"
                    checked={workloadUnit === '人日'}
                    onChange={() => handleWorkloadUnitChange('人日')}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold text-slate-900 text-xs">人日（日単位）</span>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded font-mono font-semibold">
                        標準: 1日 = 8h
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      CSVの予定工数・実績工数を「<strong className="text-slate-800">人日（日）</strong>」として取り込みます（例: 工数 5 ＝ 5人日）
                    </p>
                  </div>
                </label>

                {/* 人時 選択肢 */}
                <label
                  onClick={() => handleWorkloadUnitChange('人時')}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    workloadUnit === '人時'
                      ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="workloadUnitSelection"
                    value="人時"
                    checked={workloadUnit === '人時'}
                    onChange={() => handleWorkloadUnitChange('人時')}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold text-slate-900 text-xs">人時（時間単位）</span>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded font-mono font-semibold">
                        時間 (hours)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      CSVの予定工数・実績工数を「<strong className="text-slate-800">人時（時間）</strong>」として取り込みます（例: 工数 40 ＝ 40時間）
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* 取り込み設定バー（文字コード ＆ モード選択） */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            {/* 文字コード選択 */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">文字コード（エンコーディング）</label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-300">
                  <input
                    type="radio"
                    name="encoding"
                    value="utf-8"
                    checked={encoding === 'utf-8'}
                    onChange={() => handleEncodingChange('utf-8')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>UTF-8 (推奨・標準)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-300">
                  <input
                    type="radio"
                    name="encoding"
                    value="shift-jis"
                    checked={encoding === 'shift-jis'}
                    onChange={() => handleEncodingChange('shift-jis')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Shift_JIS (Excel用)</span>
                </label>
              </div>
            </div>

            {/* 取り込みモード */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">取り込み方式</label>
              <div className="flex items-center gap-2">
                <label
                  className={`flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-lg border transition-colors ${
                    importMode === 'append'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-medium'
                      : 'bg-white border-slate-300 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>既存データに追加・更新</span>
                </label>
                <label
                  className={`flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-lg border transition-colors ${
                    importMode === 'replace'
                      ? 'bg-rose-50 border-rose-300 text-rose-900 font-medium'
                      : 'bg-white border-slate-300 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span>全データを総入れ替え</span>
                </label>
              </div>
            </div>
          </div>

          {/* ファイルドロップ＆選択エリア */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/50 scale-[1.005]'
                : fileName
                ? 'border-emerald-400 bg-emerald-50/30'
                : 'border-slate-300 hover:border-indigo-400 bg-slate-50/40'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,text/csv"
              className="hidden"
              id="csv-file-upload"
            />

            {fileName ? (
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-full">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{fileName}</p>
                  <p className="text-xs text-emerald-700 font-medium mt-0.5 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    読み込み成功: {validDataCount} 件のデータを検出
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
                  >
                    別のファイルを選択
                  </button>
                  <button
                    type="button"
                    onClick={resetFileState}
                    className="px-3 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 font-semibold rounded-lg text-xs cursor-pointer"
                  >
                    クリア
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2.5">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    CSVファイルをここにドラッグ＆ドロップ
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">またはファイルブラウザから選択してください</p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>ファイルを選択</span>
                </button>
              </div>
            )}
          </div>

          {/* エラー表示 */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">エラー</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* パースエラー/警告リスト */}
          {parseErrors.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>スキップまたは警告のある行 ({parseErrors.length}件)</span>
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 max-h-24 overflow-y-auto pl-1">
                {parseErrors.slice(0, 5).map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
                {parseErrors.length > 5 && (
                  <li className="text-amber-600 italic font-medium">
                    他 {parseErrors.length - 5} 件のエラーがあります
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* 解析データプレビューテーブル */}
          {validDataCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span>データプレビュー（先頭表示）</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    全 {validDataCount} 件中 最大5件を表示中
                  </span>
                </h4>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-56 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  {/* WBS タブ */}
                  {activeTab === 'wbs' && (
                    <>
                      <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2">プロジェクト</th>
                          <th className="p-2">機能名</th>
                          <th className="p-2 text-right">Step数</th>
                          <th className="p-2">工程</th>
                          <th className="p-2">担当者</th>
                          <th className="p-2 text-right">
                            予定工数 ({workloadUnit})
                          </th>
                          <th className="p-2 text-right">進捗率</th>
                          <th className="p-2">期間</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedWbsRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 font-medium text-slate-800">{row.projectName}</td>
                            <td className="p-2 text-slate-700">{row.featureName}</td>
                            <td className="p-2 text-right font-mono text-indigo-700 font-semibold">
                              {row.stepCount !== undefined && row.stepCount !== null
                                ? row.stepCount.toLocaleString()
                                : '-'}
                            </td>
                            <td className="p-2">
                              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded">
                                {row.processType}
                              </span>
                            </td>
                            <td className="p-2 text-slate-600">{row.assignee || '未定'}</td>
                            <td className="p-2 text-right font-mono font-medium">
                              {row.plannedWorkload}{' '}
                              <span className="text-[10px] text-slate-400 font-normal">
                                {workloadUnit}
                              </span>
                            </td>
                            <td className="p-2 text-right font-semibold text-emerald-600 font-mono">
                              {row.actualProgress}%
                            </td>
                            <td className="p-2 text-slate-500 font-mono text-[10px]">
                              {row.startDate} ~ {row.endDate}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {/* 担当者マスタ タブ */}
                  {activeTab === 'members' && (
                    <>
                      <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2">氏名</th>
                          <th className="p-2">役職</th>
                          <th className="p-2">所属部署</th>
                          <th className="p-2 text-right">所定時間</th>
                          <th className="p-2">個別休暇日数</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedMembers.slice(0, 5).map((m, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 font-bold text-slate-800">{m.name}</td>
                            <td className="p-2">
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-semibold text-[10px]">
                                {m.role}
                              </span>
                            </td>
                            <td className="p-2 text-slate-600">{m.department}</td>
                            <td className="p-2 text-right font-mono">{m.dailyWorkingHours}h</td>
                            <td className="p-2 text-slate-500">
                              {(m.individualHolidays || []).length > 0
                                ? `${(m.individualHolidays || []).length}日 登録済`
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {/* 休日管理 タブ */}
                  {activeTab === 'holidays' && (
                    <>
                      <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2">日付</th>
                          <th className="p-2">休日名称</th>
                          <th className="p-2">種別</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedHolidays.slice(0, 5).map((h, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 font-mono font-bold text-slate-800">{h.date}</td>
                            <td className="p-2 text-slate-700 font-medium">{h.name}</td>
                            <td className="p-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  h.type === 'national'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-indigo-100 text-indigo-700'
                                }`}
                              >
                                {h.type === 'national' ? '国民の祝日' : '会社指定休日'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {/* 工程構成マスタ タブ */}
                  {activeTab === 'process_structure' && (
                    <>
                      <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2">パターン名</th>
                          <th className="p-2 text-center">初期デフォルト</th>
                          <th className="p-2 text-center">順序</th>
                          <th className="p-2">工程名</th>
                          <th className="p-2 text-right">標準日数</th>
                          <th className="p-2">備考・概要</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedPatterns.flatMap((pat) =>
                          pat.processes.map((proc, pIdx) => ({
                            patName: pat.name,
                            isDefault: pat.isDefault,
                            order: pIdx + 1,
                            name: proc.name,
                            days: proc.defaultDays,
                            desc: proc.description || '',
                          }))
                        ).slice(0, 6).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 font-medium text-slate-800">{row.patName}</td>
                            <td className="p-2 text-center">
                              {row.isDefault ? (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px]">
                                  ★ デフォルト
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">-</span>
                              )}
                            </td>
                            <td className="p-2 text-center font-mono font-semibold text-slate-500">{row.order}</td>
                            <td className="p-2">
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 font-semibold rounded">
                                {row.name}
                              </span>
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-slate-800">{row.days}日</td>
                            <td className="p-2 text-slate-500 text-[10px]">{row.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>

        {/* フッター操作バー */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {importMode === 'replace' ? (
              <span className="text-rose-600 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                ※注意: 既存の{activeTab === 'wbs' ? 'プロジェクトデータ' : activeTab === 'members' ? '担当者データ' : activeTab === 'holidays' ? '休日データ' : '工程構成マスタ'}はクリアされます
              </span>
            ) : (
              <span>※既存データを保持したまま、一致する項目を更新・新規項目を追加します</span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
            >
              閉じる
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={validDataCount === 0 || isProcessing}
              className={`px-5 py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 ${
                validDataCount > 0 && !isProcessing
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>取り込み処理中...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>
                    取り込みを実行する ({validDataCount}件
                    {activeTab === 'wbs' ? ` / ${workloadUnit}` : ''})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
