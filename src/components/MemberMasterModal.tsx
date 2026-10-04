import React, { useState } from 'react';
import {
  IndividualHoliday,
  Member,
  MemberRole,
  MEMBER_ROLES,
  MEMBER_ROLE_RANKS,
  PROJECT_MANAGER_ROLES,
  TASK_ASSIGNEE_ROLES,
  normalizeMemberRole,
  Project,
  Holiday,
} from '../types';
import {
  X,
  Plus,
  Trash2,
  Users,
  Calendar,
  Clock,
  Briefcase,
  Building,
  UserCheck,
  Search,
  Check,
  Edit2,
  CalendarOff,
  ShieldCheck,
  Award,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  Layers,
  Upload,
  DollarSign,
} from 'lucide-react';
import {
  getTodayString,
  findAssignedProcessesForMember,
  rescheduleProjectsForMemberHoliday,
  MemberAssignmentInfo,
} from '../utils/dateUtils';

interface MemberMasterModalProps {
  members: Member[];
  holidays?: Holiday[];
  projects?: Project[];
  onSaveMembers: (members: Member[]) => void;
  onAdjustProjectsSchedule?: (updatedProjects: Project[]) => void;
  onOpenCsvImport?: () => void;
  onClose: () => void;
}

export const MemberMasterModal: React.FC<MemberMasterModalProps> = ({
  members,
  holidays = [],
  projects = [],
  onSaveMembers,
  onAdjustProjectsSchedule,
  onOpenCsvImport,
  onClose,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string>(members[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');

  // 新規メンバー追加フォーム用状態
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<MemberRole>('担当');
  const [newMemberDepartment, setNewMemberDepartment] = useState('');
  const [newMemberHours, setNewMemberHours] = useState(8);
  const [newMemberUnitPrice, setNewMemberUnitPrice] = useState<number>(48000);

  // 選択中メンバーの個別休日追加フォーム用状態
  const [newHolidayDate, setNewHolidayDate] = useState(getTodayString());
  const [newHolidayName, setNewHolidayName] = useState('有給休暇');

  // 休日追加時のプロジェクト割当確認モーダル状態
  const [confirmHolidaySchedule, setConfirmHolidaySchedule] = useState<{
    member: Member;
    newHoliday: IndividualHoliday;
    updatedMembers: Member[];
    assignedList: MemberAssignmentInfo[];
  } | null>(null);

  // 通知トーストメッセージ
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'info' | 'warning';
    text: string;
  } | null>(null);

  // 編集モード
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<MemberRole>('担当');
  const [editDept, setEditDept] = useState('');
  const [editHours, setEditHours] = useState(8);
  const [editUnitPrice, setEditUnitPrice] = useState<number>(50000);

  // 選択中メンバー
  const selectedMember = members.find((m) => m.id === selectedMemberId) || members[0];

  // メンバー検索
  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.role && m.role.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.department && m.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // 新規メンバー登録
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    const newMember: Member = {
      id: `mem-${Date.now()}`,
      name: newMemberName.trim(),
      role: newMemberRole,
      department: newMemberDepartment.trim() || '開発部',
      dailyWorkingHours: Number(newMemberHours) || 8,
      unitPrice: Number(newMemberUnitPrice) || 50000,
      individualHolidays: [],
    };

    const updated = [...members, newMember];
    onSaveMembers(updated);
    setSelectedMemberId(newMember.id);
    setNewMemberName('');
    setNewMemberRole('担当');
    setNewMemberDepartment('');
    setNewMemberHours(8);
    setNewMemberUnitPrice(48000);
    setIsAddingMember(false);
  };

  // メンバー編集開始
  const handleStartEdit = (m: Member) => {
    setEditingMemberId(m.id);
    setEditName(m.name);
    setEditRole(normalizeMemberRole(m.role));
    setEditDept(m.department || '');
    setEditHours(m.dailyWorkingHours || 8);
    setEditUnitPrice(m.unitPrice !== undefined ? m.unitPrice : 50000);
  };

  // メンバー編集保存
  const handleSaveEdit = () => {
    if (!editName.trim() || !editingMemberId) return;

    const updated = members.map((m) =>
      m.id === editingMemberId
        ? {
            ...m,
            name: editName.trim(),
            role: editRole,
            department: editDept.trim(),
            dailyWorkingHours: Number(editHours) || 8,
            unitPrice: Number(editUnitPrice) || 50000,
          }
        : m
    );

    onSaveMembers(updated);
    setEditingMemberId(null);
  };

  // メンバー削除
  const handleDeleteMember = (memberId: string, memberName: string) => {
    if (members.length <= 1) {
      alert('担当者は最低1名必要です');
      return;
    }
    const updated = members.filter((m) => m.id !== memberId);
    onSaveMembers(updated);
    if (selectedMemberId === memberId) {
      setSelectedMemberId(updated[0]?.id || '');
    }
  };

  // 担当者固有の休日追加
  const handleAddIndividualHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !newHolidayDate || !newHolidayName.trim()) return;

    // 重複チェック
    const exists = selectedMember.individualHolidays.some((h) => h.date === newHolidayDate);
    if (exists) {
      alert(`${selectedMember.name} さんの ${newHolidayDate} は既に休日・休暇として登録されています`);
      return;
    }

    const newHol: IndividualHoliday = {
      id: `ih-${Date.now()}`,
      date: newHolidayDate,
      name: newHolidayName.trim(),
    };

    const updated = members.map((m) => {
      if (m.id !== selectedMember.id) return m;
      return {
        ...m,
        individualHolidays: [...m.individualHolidays, newHol].sort((a, b) => a.date.localeCompare(b.date)),
      };
    });

    // プロジェクトに担当者として割り当てられているか確認
    const assignedList = findAssignedProcessesForMember(projects, selectedMember.name, newHolidayDate);
    if (assignedList.length > 0) {
      // 割り当て済みの確認メッセージ・ダイアログを表示
      setConfirmHolidaySchedule({
        member: selectedMember,
        newHoliday: newHol,
        updatedMembers: updated,
        assignedList,
      });
      return;
    }

    // 割り当てられていない場合はそのまま保存
    onSaveMembers(updated);
    setNewHolidayName('有給休暇');
    setToastMessage({
      type: 'success',
      text: `${selectedMember.name} さんに休日（${newHolidayDate}）を追加しました。`,
    });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 期間調整をOKして休日追加
  const handleConfirmAdjust = () => {
    if (!confirmHolidaySchedule) return;
    const { member, updatedMembers, newHoliday } = confirmHolidaySchedule;

    // 1. メンバーマスタの保存
    onSaveMembers(updatedMembers);

    // 2. プロジェクトの開始〜終了期間の自動調整
    if (onAdjustProjectsSchedule && projects.length > 0) {
      const { updatedProjects, adjustedCount } = rescheduleProjectsForMemberHoliday(
        projects,
        member.name,
        updatedMembers,
        holidays
      );
      onAdjustProjectsSchedule(updatedProjects);
      setToastMessage({
        type: 'success',
        text: `${member.name} さんの休日（${newHoliday.date}）を追加し、該当プロジェクト（${adjustedCount}工程）の期間を自動調整しました。`,
      });
    } else {
      setToastMessage({
        type: 'success',
        text: `${member.name} さんの休日（${newHoliday.date}）を追加しました。`,
      });
    }

    setConfirmHolidaySchedule(null);
    setNewHolidayName('有給休暇');
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 期間調整をキャンセル（期間は調整せず、休日のみ追加）
  const handleCancelAdjust = () => {
    if (!confirmHolidaySchedule) return;
    const { member, updatedMembers, newHoliday } = confirmHolidaySchedule;

    // プロジェクト期間は調整せず、休日のみ登録
    onSaveMembers(updatedMembers);
    setToastMessage({
      type: 'info',
      text: `${member.name} さんの休日（${newHoliday.date}）を追加しました（プロジェクト期間の自動調整はスキップしました）。`,
    });

    setConfirmHolidaySchedule(null);
    setNewHolidayName('有給休暇');
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 休日追加そのものを中断（破棄）
  const handleDismissConfirm = () => {
    setConfirmHolidaySchedule(null);
  };

  // 担当者固有の休日削除
  const handleDeleteIndividualHoliday = (holidayId: string) => {
    if (!selectedMember) return;

    const updated = members.map((m) => {
      if (m.id !== selectedMember.id) return m;
      return {
        ...m,
        individualHolidays: m.individualHolidays.filter((h) => h.id !== holidayId),
      };
    });

    onSaveMembers(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden">
        {/* モーダルヘッダー */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">担当者マスタ管理</h2>
              <p className="text-xs text-slate-500">
                担当者の登録、1日あたりの実稼働時間、および個別休日（有給・シフト休など）を管理します
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenCsvImport && (
              <button
                type="button"
                onClick={onOpenCsvImport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                title="担当者マスタのCSV取り込み"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span>CSV取り込み</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* メインコンテンツ（2カラム構成） */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左カラム：担当者一覧 */}
          <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50/50">
            {/* 検索バー & 追加ボタン */}
            <div className="p-3 border-b border-slate-200 flex flex-col gap-2 bg-white">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="担当者を検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all"
                />
              </div>

              {!isAddingMember ? (
                <button
                  type="button"
                  onClick={() => setIsAddingMember(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新規担当者を追加</span>
                </button>
              ) : (
                <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-900">新規担当者登録</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingMember(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <form onSubmit={handleAddMember} className="space-y-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600">氏名 *</label>
                      <input
                        type="text"
                        required
                        placeholder="例: 佐藤 健一"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          役割/職種 (9段階) *
                        </label>
                        <select
                          value={newMemberRole}
                          onChange={(e) => setNewMemberRole(e.target.value as MemberRole)}
                          className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
                        >
                          {MEMBER_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role} (ランク{MEMBER_ROLE_RANKS[role]})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">実稼働(h/日)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="24"
                          value={newMemberHours}
                          onChange={(e) => setNewMemberHours(Number(e.target.value))}
                          className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      {PROJECT_MANAGER_ROLES.includes(newMemberRole) && (
                        <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded font-semibold">
                          PM管理者に選任可能
                        </span>
                      )}
                      {TASK_ASSIGNEE_ROLES.includes(newMemberRole) && (
                        <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold">
                          工程担当に選任可能
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600">部署</label>
                      <input
                        type="text"
                        placeholder="例: 基幹開発部"
                        value={newMemberDepartment}
                        onChange={(e) => setNewMemberDepartment(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-amber-500" />
                        標準単価 (円/日)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={newMemberUnitPrice}
                        onChange={(e) => setNewMemberUnitPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-slate-800"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
                    >
                      登録する
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* メンバーリスト */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredMembers.map((m) => {
                const isSelected = selectedMember?.id === m.id;
                const role = normalizeMemberRole(m.role);
                const isPM = PROJECT_MANAGER_ROLES.includes(role);
                const isTask = TASK_ASSIGNEE_ROLES.includes(role);

                let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                if (role === '社長' || role === '執行役員') {
                  badgeColor = 'bg-purple-100 text-purple-800 border-purple-300';
                } else if (role === '本部長' || role === '副本部長' || role === '部長') {
                  badgeColor = 'bg-blue-100 text-blue-800 border-blue-300';
                } else if (role === '課長' || role === '主任') {
                  badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                } else if (role === '担当') {
                  badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                } else if (role === '研修生') {
                  badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
                }

                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMemberId(m.id)}
                    className={`p-2.5 rounded-lg text-left transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-white border-indigo-400 shadow-xs ring-1 ring-indigo-400/30'
                        : 'bg-white/60 hover:bg-white border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <UserCheck className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                        {m.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        {m.dailyWorkingHours}h/日 {m.unitPrice ? `• ¥${(m.unitPrice).toLocaleString()}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center gap-1">
                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold border ${badgeColor}`}>
                          {role}
                        </span>
                        {isPM && (
                          <span className="text-[9px] px-1 py-0.2 bg-blue-50 text-blue-600 rounded font-medium">
                            PM可
                          </span>
                        )}
                        {isTask && !isPM && (
                          <span className="text-[9px] px-1 py-0.2 bg-emerald-50 text-emerald-600 rounded font-medium">
                            担当可
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-600 font-medium">
                        <CalendarOff className="w-3 h-3" />
                        {m.individualHolidays.length}日休
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 右カラム：選択中担当者の詳細 & 個別休日設定 */}
          <div className="flex-1 flex flex-col overflow-y-auto p-6 bg-white">
            {selectedMember ? (
              <div className="space-y-6 max-w-2xl">
                {/* 担当者基本情報カード */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm">
                        {selectedMember.name.slice(0, 2)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          {selectedMember.name}
                          <span className="text-xs font-normal text-slate-500">({selectedMember.department || '所属なし'})</span>
                        </h3>
                        <p className="text-xs text-slate-500">{selectedMember.role || '担当役割未設定'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {editingMemberId !== selectedMember.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(selectedMember)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>編集</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(selectedMember.id, selectedMember.name)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            title="担当者を削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer shadow-xs"
                          >
                            <Check className="w-3 h-3" />
                            <span>保存</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMemberId(null)}
                            className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-800 bg-slate-200 rounded-md cursor-pointer"
                          >
                            キャンセル
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 編集フォームまたは詳細情報 */}
                  {editingMemberId === selectedMember.id ? (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">氏名</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">実稼働時間 (h/日)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="24"
                          value={editHours}
                          onChange={(e) => setEditHours(Number(e.target.value))}
                          className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">役割/職種 (9段階) *</label>
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as MemberRole)}
                          className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded bg-white font-medium cursor-pointer"
                        >
                          {MEMBER_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role} (ランク{MEMBER_ROLE_RANKS[role]})
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                          {PROJECT_MANAGER_ROLES.includes(editRole) && (
                            <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded font-semibold">
                              PM管理者に選任可能
                            </span>
                          )}
                          {TASK_ASSIGNEE_ROLES.includes(editRole) && (
                            <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold">
                              工程担当に選任可能
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">部署</label>
                        <input
                          type="text"
                          value={editDept}
                          onChange={(e) => setEditDept(e.target.value)}
                          className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded bg-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-600 block mb-1 flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-amber-500" />
                          標準単価 (円/日)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={editUnitPrice}
                            onChange={(e) => setEditUnitPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            className="w-48 px-2.5 py-1 text-xs border border-slate-300 rounded bg-white font-mono font-bold text-slate-900"
                          />
                          <span className="text-[11px] text-slate-500 font-mono">
                            (時給換算: 約 ¥{Math.round((editUnitPrice || 0) / (editHours || 8)).toLocaleString()} / h)
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-500 font-semibold block flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-500" />
                          1日の実稼働時間
                        </span>
                        <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                          {selectedMember.dailyWorkingHours} 時間 / 日
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {selectedMember.dailyWorkingHours < 8 ? '※時短勤務' : '※標準稼働'}
                        </span>
                      </div>

                      <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-500 font-semibold block flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-amber-500" />
                          標準単価 (日単価)
                        </span>
                        <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block">
                          ¥{(selectedMember.unitPrice || 50000).toLocaleString()} <span className="text-[10px] font-normal text-slate-500">/ 日</span>
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                          (約 ¥{Math.round((selectedMember.unitPrice || 50000) / (selectedMember.dailyWorkingHours || 8)).toLocaleString()} / h)
                        </span>
                      </div>

                      <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-500 font-semibold block flex items-center gap-1">
                          <Briefcase className="w-3 h-3 text-emerald-500" />
                          役職 / 権限
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-bold text-slate-800">
                            {normalizeMemberRole(selectedMember.role)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            (ランク{MEMBER_ROLE_RANKS[normalizeMemberRole(selectedMember.role)]})
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {PROJECT_MANAGER_ROLES.includes(normalizeMemberRole(selectedMember.role)) && (
                            <span className="text-[9px] px-1 py-0.2 bg-blue-100 text-blue-800 font-semibold rounded">
                              PM指定可
                            </span>
                          )}
                          {TASK_ASSIGNEE_ROLES.includes(normalizeMemberRole(selectedMember.role)) && (
                            <span className="text-[9px] px-1 py-0.2 bg-emerald-100 text-emerald-800 font-semibold rounded">
                              工程担当可
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-1 truncate">
                          {selectedMember.department || '部署未割当'}
                        </span>
                      </div>

                      <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-500 font-semibold block flex items-center gap-1">
                          <CalendarOff className="w-3 h-3 text-rose-500" />
                          登録個別休日
                        </span>
                        <span className="text-sm font-bold text-rose-700 font-mono mt-0.5 block">
                          {selectedMember.individualHolidays.length} 日
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          WBS工程日程計算で自動除外
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 個別休日・休暇の管理セクション */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-indigo-600" />
                        <span>担当者固有の休日・休暇（有休・シフト休など）</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {selectedMember.name} さんの休暇日は、この担当者がアサインされた工程の日程計算時に自動スキップされます
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                      登録数: {selectedMember.individualHolidays.length} 件
                    </span>
                  </div>

                  {/* 休日追加フォーム */}
                  <form
                    onSubmit={handleAddIndividualHoliday}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-xs"
                  >
                    <div className="flex items-center gap-1 flex-1">
                      <label className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">日付:</label>
                      <input
                        type="date"
                        required
                        value={newHolidayDate}
                        onChange={(e) => setNewHolidayDate(e.target.value)}
                        className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex items-center gap-1 flex-1">
                      <label className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">理由/種別:</label>
                      <input
                        type="text"
                        required
                        placeholder="例: 有給休暇, 私用, 代休"
                        value={newHolidayName}
                        onChange={(e) => setNewHolidayName(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>休日追加</span>
                    </button>
                  </form>

                  {/* 登録済み個別休日リスト */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    {selectedMember.individualHolidays.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        <CalendarOff className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <span>登録されている個別休日・休暇はありません。</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          ※会社共通の土日祝日は「休日管理」から自動で考慮されます
                        </p>
                      </div>
                    ) : (
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                          <tr>
                            <th className="px-3 py-2 w-32">休暇日</th>
                            <th className="px-3 py-2">理由・休暇区分</th>
                            <th className="px-3 py-2 w-16 text-center">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedMember.individualHolidays.map((h) => (
                            <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-3 py-2 font-mono text-slate-800 font-medium">
                                {h.date}
                              </td>
                              <td className="px-3 py-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                  {h.name}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteIndividualHoliday(h.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title="削除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                担当者を選択してください
              </div>
            )}
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            登録担当者数: <strong className="text-slate-800">{members.length}</strong> 名
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            閉じる
          </button>
        </div>

        {/* 担当者割当確認ダイアログ（休日追加時のプロジェクト期間調整確認） */}
        {confirmHolidaySchedule && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden flex flex-col">
              {/* ダイアログヘッダー */}
              <div className="px-5 py-4 border-b border-slate-200 bg-amber-50/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      担当プロジェクト期間の調整確認
                    </h3>
                    <p className="text-xs text-slate-600">
                      担当者に割り当て済みの工程が見つかりました
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDismissConfirm}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                  title="閉じる"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ダイアログ本文 */}
              <div className="p-5 space-y-4 text-xs text-slate-700">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                  <p className="font-semibold text-slate-900">
                    <span className="text-indigo-700 font-bold">{confirmHolidaySchedule.member.name}</span> さんは現在、プロジェクトの工程に割り当てられています。
                  </p>
                  <p className="text-slate-600 text-[11px]">
                    追加される休日: <strong className="text-rose-600 font-mono">{confirmHolidaySchedule.newHoliday.date}</strong> ({confirmHolidaySchedule.newHoliday.name})
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      割り当て済みの工程 ({confirmHolidaySchedule.assignedList.length} 件):
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {confirmHolidaySchedule.assignedList.map((item, idx) => (
                      <div
                        key={`${item.projectId}-${item.processId}-${idx}`}
                        className="p-2 rounded-md bg-white border border-slate-200 text-xs shadow-2xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-[11px]">
                            {item.projectName}
                          </span>
                          {item.isDirectlyOverlapped && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              ⚡ 期間内に休日あり
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                          <span>{item.featureName}</span>
                          <span>•</span>
                          <span className="font-semibold text-indigo-700">{item.processType}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-500">
                            {item.startDate.slice(5)} 〜 {item.endDate.slice(5)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-slate-600 leading-relaxed bg-amber-50/50 p-2.5 rounded border border-amber-200/60 text-[11px]">
                  追加された休日に伴い、プロジェクトの開始〜終了の期間（スケジュール）を自動調整しますか？<br />
                  ・<strong>「OK（期間を調整する）」</strong>: 休日に応じて担当工程および後続工程の期間を自動延長・再計算します。<br />
                  ・<strong>「キャンセル（期間を調整しない）」</strong>: プロジェクトの期間は変更せず、休日のみ登録します。
                </p>
              </div>

              {/* ダイアログボタン群 */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCancelAdjust}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                  title="期間は調整せず、休日のみ登録します"
                >
                  キャンセル (調整しない)
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAdjust}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                  title="プロジェクトの工程期間を自動調整して休日を登録します"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>OK (期間を調整する)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 一時トースト通知 */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-70 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold animate-fadeIn bg-slate-900 text-white border border-slate-800">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage.text}</span>
          </div>
        )}
      </div>
    </div>
  );
};
