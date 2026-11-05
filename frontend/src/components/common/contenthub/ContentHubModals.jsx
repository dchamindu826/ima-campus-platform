import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, UploadCloud, Users, UserPlus, CheckCircle, Plus, Edit3, Trash2, CreditCard, MessageSquare, MonitorPlay, ExternalLink, Ban, BookOpen, Building2, User, Layers, Save, FolderOpen, Clock, Trophy, Sparkles, FileSignature, FileText, Download, Loader2, Search, ChevronDown, Check } from 'lucide-react';
import api from '../../../api/axios'; 

function LecturerSearchableSelect({ editData, editMode, setEditData, masterTutes }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedName, setSelectedName] = useState(editData?.lecturerName || '');
    const dropdownRef = React.useRef(null);
    const searchInputRef = React.useRef(null);
    const hiddenSelectRef = React.useRef(null);

    useEffect(() => {
        setSelectedName(editData?.lecturerName || '');
    }, [editData?.lecturerName]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (name) => {
        setSelectedName(name);
        if (editMode && setEditData) {
            setEditData(prev => ({ ...prev, lecturerName: name }));
        }
        if (hiddenSelectRef.current) {
            hiddenSelectRef.current.value = name;
            hiddenSelectRef.current.dispatchEvent(new Event('change', { bubbles: true }));
        }
        setIsOpen(false);
        setSearch('');
    };

    const filtered = (masterTutes || []).filter(l => 
        (l.name || '').toLowerCase().includes(search.toLowerCase())
    );

    const isLegacy = selectedName && !masterTutes?.some(l => l.name === selectedName);

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Hidden native select for FormData and querySelector compatibility */}
            <select
                ref={hiddenSelectRef}
                name="lecturerName"
                value={selectedName}
                onChange={(e) => handleSelect(e.target.value)}
                className="hidden"
            >
                <option value="">Select Lecturer</option>
                {isLegacy && <option value={selectedName}>{selectedName} (Legacy)</option>}
                {masterTutes?.map((lec, i) => (
                    <option key={i} value={lec.name}>{lec.name}</option>
                ))}
            </select>

            {/* Custom Interactive Trigger Button */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-black/60 border rounded-xl p-3 text-sm text-white flex items-center justify-between gap-2 shadow-inner transition-all cursor-pointer ${
                    isOpen ? 'border-amber-400 ring-1 ring-amber-400/30' : 'border-white/10 hover:border-white/20'
                }`}
            >
                <div className="flex items-center gap-2 truncate">
                    <User size={15} className={selectedName ? 'text-amber-400' : 'text-slate-500'} />
                    <span className={`truncate font-medium ${selectedName ? 'text-white font-bold' : 'text-slate-400'}`}>
                        {selectedName ? (isLegacy ? `${selectedName} (Legacy)` : selectedName) : 'Select Lecturer'}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    {selectedName && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSelect('');
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title="Clear selection"
                        >
                            <X size={13} />
                        </button>
                    )}
                    <ChevronDown size={15} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-amber-400' : ''}`} />
                </div>
            </div>

            {/* Searchable Dropdown Popover */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-slate-900/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in duration-150">
                    {/* Search Bar at Top */}
                    <div className="p-2.5 border-b border-white/10 bg-slate-950/70">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search lecturer by name..."
                                className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 pr-7 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-56 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                        {/* None / Reset Option */}
                        <div
                            onClick={() => handleSelect('')}
                            className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                !selectedName ? 'bg-amber-400/20 text-amber-300 font-bold' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                            }`}
                        >
                            <span>-- No Lecturer (Optional) --</span>
                            {!selectedName && <Check size={13} className="text-amber-400" />}
                        </div>

                        {/* Legacy Option */}
                        {isLegacy && (
                            <div
                                onClick={() => handleSelect(selectedName)}
                                className="px-3 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer bg-yellow-500/10 text-yellow-300 font-bold hover:bg-yellow-500/20"
                            >
                                <span className="truncate">{selectedName} (Legacy)</span>
                                <Check size={13} className="text-yellow-400" />
                            </div>
                        )}

                        {/* Filtered Lecturer Items */}
                        {filtered.length === 0 ? (
                            <div className="px-3 py-4 text-center text-xs text-slate-400">
                                No lecturers found matching "{search}"
                            </div>
                        ) : (
                            filtered.map((lec, i) => {
                                const isSelected = selectedName === lec.name;
                                return (
                                    <div
                                        key={i}
                                        onClick={() => handleSelect(lec.name)}
                                        className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                            isSelected 
                                                ? 'bg-amber-400 text-slate-950 font-black shadow-sm' 
                                                : 'text-slate-200 hover:bg-white/10 hover:text-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            {lec.image ? (
                                                <img src={lec.image} alt={lec.name} className="w-5 h-5 rounded-full object-cover shrink-0 border border-white/20" />
                                            ) : (
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                                                    isSelected ? 'bg-slate-950 text-amber-400' : 'bg-white/10 text-slate-300'
                                                }`}>
                                                    {lec.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="truncate">{lec.name}</span>
                                        </div>
                                        {isSelected && <Check size={13} className="text-slate-950 shrink-0" />}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-3 py-1.5 bg-black/40 border-t border-white/5 text-[10px] text-slate-400 flex items-center justify-between">
                        <span>{masterTutes?.length || 0} lecturers available</span>
                        {search && <span>{filtered.length} matching</span>}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ContentHubModals({ state, actions }) {
    const [modalTimerMode, setModalTimerMode] = useState('FLEXIBLE');
    const [modalPaperType, setModalPaperType] = useState('MCQ'); // 'MCQ' | 'STRUCTURED' | 'BOTH'
    const [modalCategory, setModalCategory] = useState('WEEKLY'); // 'WEEKLY' | 'MONTHLY'
    const [modalWeeklyLeaderboard, setModalWeeklyLeaderboard] = useState(true); // Whether Weekly test publishes to leaderboard
    const [modalQuestionCount, setModalQuestionCount] = useState('4'); // Number of questions in paper
    const [modalManualParticipantCount, setModalManualParticipantCount] = useState('');
    const [modalBreakIntervalMinutes, setModalBreakIntervalMinutes] = useState('15');
    const [modalStructuredUploadMinutes, setModalStructuredUploadMinutes] = useState('15');
    const [modalDurationHours, setModalDurationHours] = useState('1');
    const [modalDurationMinutes, setModalDurationMinutes] = useState('0');
    
    // Separate durations & marks for MCQ + Structured Both
    const [modalMcqDurationHours, setModalMcqDurationHours] = useState('1');
    const [modalMcqDurationMinutes, setModalMcqDurationMinutes] = useState('0');
    const [modalStructuredDurationHours, setModalStructuredDurationHours] = useState('2');
    const [modalStructuredDurationMinutes, setModalStructuredDurationMinutes] = useState('0');
    const [modalMcqMarks, setModalMcqMarks] = useState('50');
    const [modalStructuredMarks, setModalStructuredMarks] = useState('50');
    const [modalTotalMarks, setModalTotalMarks] = useState('100');
    const [modalCourseType, setModalCourseType] = useState('1');
    const [modalGroupClassType, setModalGroupClassType] = useState('1');
    const [folderTitleValue, setFolderTitleValue] = useState('');
    const [folderApplyAllSubjects, setFolderApplyAllSubjects] = useState(true);
    const [folderApplyBothTypes, setFolderApplyBothTypes] = useState(true);

    const defaultGradingScale = [
        { grade: 'A', min: 75, max: 100 },
        { grade: 'B', min: 65, max: 74 },
        { grade: 'C', min: 55, max: 64 },
        { grade: 'S', min: 35, max: 54 },
        { grade: 'F', min: 0, max: 34 }
    ];
    const [modalGradingScale, setModalGradingScale] = useState(defaultGradingScale);

    const handleUpdateGradeTier = (index, field, value) => {
        setModalGradingScale(prev => {
            const updated = [...prev];
            updated[index] = { 
                ...updated[index], 
                [field]: field === 'grade' ? value : (value === '' ? '' : parseFloat(value)) 
            };
            return updated;
        });
    };

    const handleAddGradeTier = () => {
        setModalGradingScale(prev => [
            ...prev,
            { grade: 'New', min: 0, max: 0 }
        ]);
    };

    const handleRemoveGradeTier = (index) => {
        setModalGradingScale(prev => prev.filter((_, i) => i !== index));
    };

    const handleResetStandardGrade = () => {
        setModalGradingScale(defaultGradingScale);
    };

    const getGradeBadgeStyle = (grade) => {
        const g = (grade || '').trim().toUpperCase();
        if (g.startsWith('A')) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
        if (g.startsWith('B')) return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
        if (g.startsWith('C')) return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
        if (g.startsWith('S') || g.startsWith('D')) return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
    };

    const {
        isSystemAdmin, businesses, managersList, batches, lessonGroups, postsList, showBusinessModal, showAssignModal, showBatchModal, showGroupModal,
        showCourseModal, showLessonGroupModal, showContentModal, showPostModal, showManagePostsModal, previewData, editMode, editData, selectedLogoName,
        selectedGroupPrices, discountRules, contentType, prefilledFolder, selectedBatchesForContent, massAssignSubjects, postBizId, postBatches, showInstallmentModal,
        existingInstallments, editInstallmentId, installmentSubjectCount, installmentSteps, activeBusiness, activeBatch, activeSubject, loading, showLecturerModal, masterTutes,
        hubBatchConfigs = {}, hubActiveBatchTab = null, parentFolderForSub = null, selectedFolderParentId = '',
        selectedClassType, isSubmittingFolder, isSubmittingContent, isSubmittingCourse, contentTab
    } = state || {};

    useEffect(() => {
        if (showLessonGroupModal) {
            setFolderTitleValue(editData?.title || editData?.name || '');
            if (editMode || selectedFolderParentId) {
                setFolderApplyAllSubjects(false);
                setFolderApplyBothTypes(false);
            } else {
                setFolderApplyAllSubjects(true);
                setFolderApplyBothTypes(true);
            }
        }
    }, [showLessonGroupModal, editData, editMode, selectedFolderParentId]);

    useEffect(() => {
        if (showCourseModal) {
            if (editMode && editData?.courseType) {
                setModalCourseType(String(editData.courseType));
            } else {
                setModalCourseType(selectedClassType === 'paper' ? '2' : '1');
            }
        }
    }, [showCourseModal, editMode, editData, selectedClassType]);

    useEffect(() => {
        if (showGroupModal) {
            if (editMode && editData?.classType) {
                setModalGroupClassType(String(editData.classType));
            } else {
                setModalGroupClassType(selectedClassType === 'paper' ? '2' : '1');
            }
        }
    }, [showGroupModal, editMode, editData, selectedClassType]);

    useEffect(() => {
        if (editData) {
            setModalCategory(editData?.paper?.category || 'WEEKLY');
            setModalManualParticipantCount(editData?.paper?.manualParticipantCount ? String(editData.paper.manualParticipantCount) : '');
            setModalBreakIntervalMinutes(editData?.paper?.breakIntervalMinutes !== null && editData?.paper?.breakIntervalMinutes !== undefined ? String(editData.paper.breakIntervalMinutes) : '15');
            setModalStructuredUploadMinutes(editData?.paper?.structuredUploadMinutes !== null && editData?.paper?.structuredUploadMinutes !== undefined ? String(editData.paper.structuredUploadMinutes) : '15');
            setModalTimerMode(editData?.paper?.timerMode || 'FLEXIBLE');
            const pType = editData?.paper?.paperType || (editData.contentType === 'sPaper' ? 'STRUCTURED' : (editData.contentType === 'paper' ? 'MCQ' : 'MCQ'));
            setModalPaperType(pType);
            const totalMins = editData?.paper?.durationMinutes || editData?.paperTime || 60;
            setModalDurationHours(String(Math.floor(totalMins / 60)));
            setModalDurationMinutes(String(totalMins % 60));

            const mcqMins = editData?.paper?.paperType === 'MCQ' 
                ? (editData?.paper?.durationMinutes || editData?.paper?.mcqDurationMinutes || editData?.paperTime || 60)
                : (editData?.paper?.mcqDurationMinutes ?? 60);
            setModalMcqDurationHours(String(Math.floor(mcqMins / 60)));
            setModalMcqDurationMinutes(String(mcqMins % 60));

            const structMins = editData?.paper?.paperType === 'STRUCTURED'
                ? (editData?.paper?.durationMinutes || editData?.paper?.structuredDurationMinutes || editData?.paperTime || 120)
                : (editData?.paper?.structuredDurationMinutes ?? 120);
            setModalStructuredDurationHours(String(Math.floor(structMins / 60)));
            setModalStructuredDurationMinutes(String(structMins % 60));

            const mMarks = editData?.paper?.totalMcqMarks ?? 50;
            const sMarks = editData?.paper?.totalStructuredMarks ?? 50;
            const tMarks = editData?.paper?.totalMarks ?? (mMarks + sMarks);
            setModalMcqMarks(String(mMarks));
            setModalStructuredMarks(String(sMarks));
            setModalTotalMarks(String(tMarks));

            setModalWeeklyLeaderboard(editData?.paper?.hasLeaderboard !== undefined ? Boolean(editData.paper.hasLeaderboard) : true);
            setModalQuestionCount(editData?.questionCount ? String(editData.questionCount) : '4');

            if (editData?.paper?.gradingScale) {
                try {
                    const parsed = typeof editData.paper.gradingScale === 'string'
                        ? JSON.parse(editData.paper.gradingScale)
                        : editData.paper.gradingScale;
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setModalGradingScale(parsed);
                    } else {
                        setModalGradingScale(defaultGradingScale);
                    }
                } catch (e) {
                    setModalGradingScale(defaultGradingScale);
                }
            } else {
                setModalGradingScale(defaultGradingScale);
            }
        } else {
            setModalCategory('WEEKLY');
            setModalWeeklyLeaderboard(true);
            setModalQuestionCount('4');
            setModalManualParticipantCount('');
            setModalBreakIntervalMinutes('15');
            setModalStructuredUploadMinutes('15');
            setModalTimerMode('FLEXIBLE');
            setModalPaperType('MCQ');
            setModalDurationHours('1');
            setModalDurationMinutes('0');
            setModalMcqDurationHours('1');
            setModalMcqDurationMinutes('0');
            setModalStructuredDurationHours('2');
            setModalStructuredDurationMinutes('0');
            setModalMcqMarks('50');
            setModalStructuredMarks('50');
            setModalTotalMarks('100');
            setModalGradingScale(defaultGradingScale);
        }
    }, [editData, showContentModal]);

    const {
        setShowBusinessModal, setShowAssignModal, setShowBatchModal, setShowGroupModal, setShowCourseModal, setShowLessonGroupModal, setShowContentModal,
        setShowPostModal, setShowManagePostsModal, setPreviewData, setSelectedLogoName, setContentType, setPostBizId,
        handlePostSubmit, handleBusinessSubmit, handleAssignManagers, handleBatchSubmit, handleGroupSubmit, handleCourseSubmit, handleLessonGroupSubmit, handleMassAssignSubmit,
        getPostImageUrl, getEmbedUrl, deleteItem, fetchPosts, addDiscountRule, removeDiscountRule, handleDiscountRuleChange, addInstallmentStep, removeInstallmentStep,
        toggleGroupPrice, updateGroupData, toggleMassAssignSubject, getTypeInt, setPrefilledFolder, setSelectedBatchesForContent, setMassAssignSubjects,
        setShowInstallmentModal, handleEditInstallment, handleDeleteInstallment, handleInstallmentSubmit, setInstallmentSubjectCount, setInstallmentSteps, setEditInstallmentId, getBatchStreams,
        setEditData, setDiscountRules, setSelectedGroupPrices, setShowLecturerModal, handleLecturerSubmit, setHubBatchConfigs, setHubActiveBatchTab,
        setSelectedFolderParentId, setEditMode, setParentFolderForSub
    } = actions;

    const getBaseUrl = () => {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            let url = api.defaults.baseURL || 'http://localhost:5000/api';
            return url.endsWith('/') ? url.slice(0, -1) : url;
        }
        return 'https://imacampus.online/api';
    };

    const normalizeFolderTitle = (title) => {
        if (!title) return '';
        return title
            .toLowerCase()
            .replace(/octomber/gi, 'october')
            .replace(/septeber/gi, 'september')
            .replace(/[\s_-]+/g, ' ')
            .replace(/\b(month|batch|මාසය|මාස|පාඩම|පාඩම්)\b/gi, '')
            .trim();
    };

    const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    const sinhalaMonths = ["ජනවාරි", "පෙබරවාරි", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝස්තු", "සැප්තැම්බර්", "ඔක්තෝබර්", "නොවැම්බර්", "දෙසැම්බර්"];

    const getSelectedFolderValue = () => {
        if (!editMode) return prefilledFolder ? String(prefilledFolder) : '';

        const currentTypeGroups = (lessonGroups || []).filter(g => parseInt(g.type) === getTypeInt(contentType) || (contentType === 'document' && parseInt(g.type) === 2));
        const targetId = editData?.contentGroupId ?? editData?.content_group_id;

        if (targetId) {
            const matchedById = currentTypeGroups.find(g => 
                String(g.id) === String(targetId) || 
                (g.allIds && g.allIds.some(id => String(id) === String(targetId)))
            );
            if (matchedById) return String(matchedById.id);
        }

        const targetTitle = editData?.groupTitle || editData?.group?.title;
        if (targetTitle) {
            const rawTarget = targetTitle.trim().toLowerCase();
            const normTarget = normalizeFolderTitle(targetTitle);
            const matched = currentTypeGroups.find(g => {
                const rawG = (g.title || g.name || '').trim().toLowerCase();
                const normG = normalizeFolderTitle(g.title || g.name);
                return rawG === rawTarget || (normTarget && normG && normG === normTarget);
            });
            if (matched) return String(matched.id);
        }

        // Smart Month fallback
        let targetMonthIdx = -1;
        if (editData?.date) {
            try {
                const d = new Date(editData.date);
                if (!isNaN(d.getTime())) targetMonthIdx = d.getMonth();
            } catch (err) {}
        }
        if (targetMonthIdx === -1 && editData?.title) {
            const titleLower = editData.title.toLowerCase();
            targetMonthIdx = monthNames.findIndex(m => titleLower.includes(m));
            if (targetMonthIdx === -1) targetMonthIdx = sinhalaMonths.findIndex(m => titleLower.includes(m));
        }
        if (targetMonthIdx !== -1) {
            const engMonth = monthNames[targetMonthIdx];
            const sinMonth = sinhalaMonths[targetMonthIdx];
            const matchedMonth = currentTypeGroups.find(g => {
                if (g.parentId) return false;
                const gTitle = (g.title || g.name || '').toLowerCase();
                const gNorm = normalizeFolderTitle(g.title || g.name);
                return gTitle.includes(engMonth) || gTitle.includes(sinMonth) ||
                       gNorm.includes(engMonth) || gNorm.includes(sinMonth);
            });
            if (matchedMonth) return String(matchedMonth.id);
        }

        return targetId ? String(targetId) : '';
    };

    const activeHubBatch = hubActiveBatchTab || activeBatch?.id || (batches.length > 0 ? batches[0].id : null);
    
    const handleHubSubjectToggle = (batchId, subjectId, courseCode) => {
        setHubBatchConfigs(prev => {
            const safePrev = prev || {};
            const batchConfig = safePrev[batchId] || {};
            const initialFolder = prefilledFolder ? String(prefilledFolder) : '';
            const subjectConfig = batchConfig[subjectId] || { isChecked: false, folderId: initialFolder, courseCode };
            return {
                ...safePrev,
                [batchId]: {
                    ...batchConfig,
                    [subjectId]: { 
                        ...subjectConfig, 
                        isChecked: !subjectConfig.isChecked, 
                        folderId: subjectConfig.folderId || initialFolder,
                        courseCode 
                    }
                }
            };
        });
    };

    const handleHubFolderChange = (batchId, subjectId, folderId, courseCode) => {
        setHubBatchConfigs(prev => {
            const safePrev = prev || {};
            const batchConfig = safePrev[batchId] || {};
            const subjectConfig = batchConfig[subjectId] || { isChecked: true, folderId: '', courseCode };
            return {
                ...safePrev,
                [batchId]: {
                    ...batchConfig,
                    [subjectId]: { ...subjectConfig, isChecked: true, folderId, courseCode }
                }
            };
        });
    };

    const modalContent = (
        <>
            {/* ADD CONTENT MODAL */}
            {showContentModal && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
                    <div className="bg-[#090E17]/95 border border-white/10 rounded-2xl sm:rounded-[2rem] w-full max-w-7xl max-h-[92vh] sm:max-h-[95vh] flex flex-col shadow-[0_10px_50px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-3xl">
                        <div className="p-4 sm:p-6 md:p-8 border-b border-white/10 flex justify-between items-center bg-white/[0.02] rounded-t-2xl sm:rounded-t-[2rem]">
                            <h3 className="text-lg sm:text-2xl font-extrabold text-white flex items-center gap-2.5 sm:gap-3 drop-shadow-sm"><Plus className="text-green-400 w-6 h-6 sm:w-7 sm:h-7" /> {editMode ? 'Edit Content' : 'Add Content (Multi-Batch)'}</h3>
                            <button onClick={() => { setShowContentModal(false); setContentType(''); setPrefilledFolder(''); setMassAssignSubjects([]); setSelectedBatchesForContent([]); if (setHubBatchConfigs) setHubBatchConfigs({}); if (setHubActiveBatchTab) setHubActiveBatchTab(null); }} className="text-gray-400 hover:text-white bg-white/5 border border-white/10 p-2 sm:p-2.5 rounded-xl transition-all hover:bg-red-500/20 hover:border-red-500/30 outline-none"><X size={18}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 custom-scrollbar">
                            <form key={`form-${editMode ? editData?.id : 'new'}`} onSubmit={handleMassAssignSubmit} className="space-y-8 max-w-6xl mx-auto">
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Content Type *</label>
                                        <select value={contentType} onChange={e => setContentType(e.target.value)} disabled={editMode} className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-green-500 disabled:opacity-50 shadow-inner cursor-pointer appearance-none">
                                            <option value="" disabled className="bg-slate-800 text-white">Select Type</option>
                                            <option value="live" className="bg-slate-800 text-white">Live Class</option><option value="recording" className="bg-slate-800 text-white">Recording</option>
                                            <option value="document" className="bg-slate-800 text-white">Document / PDF</option>
                                            <option value="testRanking" className="bg-slate-800 text-white font-bold">🏆 Test Ranking</option>
                                            {editMode && (contentType === 'paper' || contentType === 'sPaper') && (
                                                <option value={contentType} className="bg-slate-800 text-white">Test Ranking (Legacy)</option>
                                            )}
                                        </select>
                                    </div>
                                    
                                    {contentType && (
                                        <div className="flex-1 animate-in fade-in duration-300">
                                            <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Target Folder (Current Batch)</label>
                                            <select 
                                                name="contentGroupId" 
                                                value={getSelectedFolderValue()} 
                                                onChange={(e) => { 
                                                    const val = e.target.value;
                                                    if (editMode) { 
                                                        setEditData(prev => ({...prev, contentGroupId: val, content_group_id: val, groupTitle: null }));
                                                    } else { 
                                                        setPrefilledFolder(val); 
                                                        // Sync to all checked subjects in hubBatchConfigs
                                                        setHubBatchConfigs(prev => {
                                                            const updated = { ...prev };
                                                            Object.keys(updated).forEach(bId => {
                                                                Object.keys(updated[bId] || {}).forEach(cId => {
                                                                    if (updated[bId][cId]?.isChecked) {
                                                                        updated[bId][cId] = { ...updated[bId][cId], folderId: val };
                                                                    }
                                                                });
                                                            });
                                                            return updated;
                                                        });
                                                    } 
                                                }} 
                                                className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-green-500 shadow-inner cursor-pointer"
                                            >
                                                <option value="" className="bg-slate-800 text-white">No Folder (Uncategorized)</option>
                                                {(() => {
                                                    const rawRoots = (lessonGroups || []).filter(g => (parseInt(g.type) === getTypeInt(contentType) || (contentType === 'document' && parseInt(g.type) === 2)) && !g.parentId);
                                                    const seenTitles = new Set();
                                                    const uniqueRoots = [];
                                                    rawRoots.forEach(rf => {
                                                        const tKey = normalizeFolderTitle(rf.title || rf.name) || (rf.title || rf.name || '').trim().toLowerCase();
                                                        if (!seenTitles.has(tKey)) {
                                                            seenTitles.add(tKey);
                                                            uniqueRoots.push(rf);
                                                        }
                                                    });

                                                    const selectedVal = getSelectedFolderValue();
                                                    const allRenderedOptionIds = new Set();

                                                    const renderedOptions = uniqueRoots.map(rootFolder => {
                                                        allRenderedOptionIds.add(String(rootFolder.id));
                                                        const allIds = rootFolder.allIds || [rootFolder.id];
                                                        allIds.forEach(id => allRenderedOptionIds.add(String(id)));

                                                        const subs = (lessonGroups || []).filter(g => (parseInt(g.type) === getTypeInt(contentType) || (contentType === 'document' && parseInt(g.type) === 2)) && g.parentId && (allIds.includes(g.parentId) || String(g.parentId) === String(rootFolder.id)));
                                                        const seenSubTitles = new Set();
                                                        const uniqueSubs = [];
                                                        subs.forEach(sf => {
                                                            const stKey = normalizeFolderTitle(sf.title || sf.name) || (sf.title || sf.name || '').trim().toLowerCase();
                                                            if (!seenSubTitles.has(stKey)) {
                                                                seenSubTitles.add(stKey);
                                                                uniqueSubs.push(sf);
                                                            }
                                                        });

                                                        uniqueSubs.forEach(sf => {
                                                            allRenderedOptionIds.add(String(sf.id));
                                                            if (sf.allIds) sf.allIds.forEach(id => allRenderedOptionIds.add(String(id)));
                                                        });

                                                        return (
                                                            <React.Fragment key={rootFolder.id}>
                                                                <option value={String(rootFolder.id)} className="bg-slate-800 text-white font-bold">
                                                                    📁 {rootFolder.title || rootFolder.name}
                                                                </option>
                                                                {uniqueSubs.map(sub => (
                                                                    <option key={sub.id} value={String(sub.id)} className="bg-slate-900 text-indigo-300 font-semibold">
                                                                        &nbsp;&nbsp;&nbsp;&nbsp;↳ 📂 {sub.title || sub.name} (Sub-folder)
                                                                    </option>
                                                                ))}
                                                            </React.Fragment>
                                                        );
                                                    });

                                                    const hasSelectedInOptions = !selectedVal || allRenderedOptionIds.has(String(selectedVal));

                                                    return (
                                                        <>
                                                            {!hasSelectedInOptions && selectedVal && (
                                                                <option value={selectedVal} className="bg-slate-800 text-amber-300 font-bold">
                                                                    📁 {editData?.groupTitle || editData?.group?.title || `Current Folder (${selectedVal})`}
                                                                </option>
                                                            )}
                                                            {renderedOptions}
                                                        </>
                                                    );
                                                })()}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {contentType && (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-black/30 p-6 md:p-8 rounded-[2rem] border border-white/5 shadow-inner">
                                            <div className="md:col-span-3">
                                                <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Title *</label>
                                                <input type="text" name="title" defaultValue={editData?.title} required className="w-full bg-black/60 border border-white/10 focus:border-green-500 focus:bg-black/80 rounded-xl p-4 text-white outline-none shadow-inner transition-all" />
                                            </div>
                                            <div className="md:col-span-1">
                                                <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Display Order *</label>
                                                <input type="number" name="itemOrder" defaultValue={editData?.itemOrder || 1} required className="w-full bg-black/60 border border-white/10 focus:border-green-500 focus:bg-black/80 rounded-xl p-4 text-white outline-none shadow-inner transition-all" />
                                            </div>
                                            
                                            {(contentType === 'live' || contentType === 'recording') && (
                                                <div className="md:col-span-2 space-y-4">
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">URL Link *</label>
                                                        <input type="url" name="link" defaultValue={editData?.link} required className="w-full bg-black/60 border border-white/10 focus:border-green-500 focus:bg-black/80 rounded-xl p-4 text-white outline-none shadow-inner transition-all" />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">YouTube Link (Optional)</label>
                                                        <input type="url" name="youtubeLink" defaultValue={editData?.youtubeLink} className="w-full bg-black/60 border border-white/10 focus:border-red-500 focus:bg-black/80 rounded-xl p-4 text-white outline-none shadow-inner transition-all" placeholder="https://www.youtube.com/watch?v=..." />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Vimeo Link (Optional)</label>
                                                        <input type="url" name="vimeoLink" defaultValue={editData?.vimeoLink} className="w-full bg-black/60 border border-white/10 focus:border-blue-500 focus:bg-black/80 rounded-xl p-4 text-white outline-none shadow-inner transition-all" placeholder="https://vimeo.com/..." />
                                                    </div>
                                                </div>
                                            )}

                                            {contentType === 'recording' && (
                                                <div className="md:col-span-4">
                                                    <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Meeting ID</label>
                                                    <input type="text" name="zoomMeetingId" defaultValue={editData?.meetingId} className="w-full bg-black/60 border border-white/10 focus:border-green-500 focus:bg-black/80 rounded-xl p-4 text-white outline-none shadow-inner transition-all" />
                                                </div>
                                            )}

                                            {(contentType === 'live' || contentType === 'recording' || contentType === 'document' || contentType === 'testRanking' || contentType === 'sPaper' || contentType === 'paper') && (
                                                <div className="md:col-span-4">
                                                    <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Thumbnail Image (Optional) {editMode && <span className="text-green-400 font-normal ml-2 normal-case">(Leave empty to keep existing)</span>}</label>
                                                    <input type="file" name="thumbnail" accept="image/*" className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-gray-400 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:bg-white/10 file:text-white shadow-inner cursor-pointer" />
                                                </div>
                                            )}

                                            {/* Document File Upload */}
                                            {contentType === 'document' && (
                                                <div className="md:col-span-4">
                                                    <label className="text-sm font-bold text-gray-300 mb-2 block uppercase tracking-wider">
                                                        Document File Upload {editMode && <span className="text-green-400 font-normal ml-2 normal-case">(Leave empty to keep existing)</span>}
                                                    </label>
                                                    <input 
                                                        type="file" 
                                                        name="file" 
                                                        required={!editMode} 
                                                        className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-gray-300 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:bg-white/10 file:text-white shadow-inner cursor-pointer text-sm" 
                                                    />
                                                </div>
                                            )}

                                            {/* Dedicated Structure / Essay Question Paper & Question Count (No MCQ paper upload) */}
                                            {(contentType === 'testRanking' || contentType === 'sPaper' || contentType === 'paper') && (
                                                <div className="md:col-span-4 bg-gradient-to-r from-purple-950/30 via-slate-900/60 to-indigo-950/30 border border-purple-500/30 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3.5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                                                                <FileSignature size={20} />
                                                            </div>
                                                            <div>
                                                                <h4 className="text-sm sm:text-base font-black text-white tracking-wide uppercase">
                                                                    Structure / Essay Master Question Paper (PDF)
                                                                </h4>
                                                                <p className="text-xs sm:text-sm text-slate-400">
                                                                    Upload the question paper PDF. Students will view this to write answers and upload answer sheets.
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {editMode && (editData?.paper?.structuredPaperFile || editData?.fileName) && (
                                                            <div className="flex items-center gap-2 bg-purple-500/20 border border-purple-500/40 px-3 py-1.5 rounded-xl shrink-0">
                                                                <span className="text-xs text-purple-300 font-semibold">Current:</span>
                                                                <span className="text-xs font-mono font-bold text-white max-w-[200px] truncate">
                                                                    {editData?.paper?.structuredPaperFile || editData?.fileName}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start pt-1">
                                                        {/* Question Paper PDF file */}
                                                        <div className="md:col-span-2 space-y-2">
                                                            <label className="text-xs sm:text-sm font-bold text-purple-300 block uppercase tracking-wider">
                                                                Question Paper PDF * {editMode && (editData?.paper?.structuredPaperFile || editData?.fileName) && <span className="text-purple-400 font-normal lowercase">(Leave empty to keep existing)</span>}
                                                            </label>
                                                            <input 
                                                                type="file" 
                                                                name="structuredFile" 
                                                                accept=".pdf" 
                                                                required={!editMode && !editData?.paper?.structuredPaperFile && !editData?.fileName}
                                                                className="w-full bg-black/60 border border-purple-500/40 focus:border-purple-400 rounded-xl p-3 text-slate-200 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:bg-purple-600/30 file:text-purple-200 file:font-bold hover:file:bg-purple-600/50 shadow-inner cursor-pointer text-xs sm:text-sm transition-all" 
                                                            />
                                                            <p className="text-xs text-slate-400">
                                                                PDF format only. Master sheet downloaded or viewed in split-view by students.
                                                            </p>
                                                        </div>

                                                        {/* Number of Essay Questions in the paper */}
                                                        <div className="space-y-2 bg-black/40 border border-white/10 rounded-2xl p-4 shadow-inner">
                                                            <label className="text-xs sm:text-sm font-bold text-amber-400 block uppercase tracking-wider">
                                                                Total Questions (ප්‍රශ්න ගණන) *
                                                            </label>
                                                            <div className="relative">
                                                                <input 
                                                                    type="number" 
                                                                    name="questionCount" 
                                                                    min="1" 
                                                                    max="50" 
                                                                    required
                                                                    value={modalQuestionCount} 
                                                                    onChange={(e) => setModalQuestionCount(e.target.value)} 
                                                                    placeholder="e.g. 4" 
                                                                    className="w-full bg-black/70 border border-amber-500/40 focus:border-amber-400 rounded-xl p-3 text-white outline-none shadow-inner text-base sm:text-lg font-black" 
                                                                />
                                                                <span className="absolute right-3.5 top-3.5 text-xs text-slate-400 font-bold uppercase">Questions</span>
                                                            </div>
                                                            <p className="text-[11px] sm:text-xs text-slate-400 leading-snug">
                                                                Paper Guiders will award marks question-by-question based on this count.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="md:col-span-4">
                                                <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Date</label>
                                                <input type={contentType==='document' ? "month":"date"} name="date" defaultValue={editData?.date ? (contentType==='document' ? editData.date.substring(0, 7) : editData.date.split('T')[0]) : ''} required className="w-full bg-black/60 border border-white/10 focus:border-green-500 focus:bg-black/80 rounded-xl p-4 text-white outline-none shadow-inner cursor-pointer transition-all appearance-none" />
                                            </div>

                                            {contentType === 'live' && (
                                                <>
                                                    <div className="md:col-span-2"><label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Start Time</label><input type="time" name="startTime" defaultValue={editData?.startTime} className="w-full bg-black/60 border border-white/10 focus:border-green-500 focus:bg-black/80 rounded-xl p-4 text-white outline-none shadow-inner cursor-pointer transition-all appearance-none" /></div>
                                                    <div className="md:col-span-2"><label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">End Time</label><input type="time" name="endTime" defaultValue={editData?.endTime} className="w-full bg-black/60 border border-white/10 focus:border-green-500 focus:bg-black/80 rounded-xl p-4 text-white outline-none shadow-inner cursor-pointer transition-all appearance-none" /></div>
                                                    <div className="md:col-span-4 mt-2">
                                                        <label className="flex items-center gap-4 cursor-pointer w-max group bg-white/5 p-4 rounded-2xl border border-white/10 hover:border-white/20 transition-all shadow-sm mb-4">
                                                            <div className="relative flex items-center justify-center">
                                                                <input type="checkbox" id="autoDeleteToggle" defaultChecked={!!editData?.autoDeleteHours} className="peer w-6 h-6 appearance-none bg-black/60 border-2 border-slate-500 rounded-lg checked:bg-green-500 checked:border-green-500 transition-colors" onChange={(e) => { document.getElementById('autoDeleteInputContainer').style.display = e.target.checked ? 'block' : 'none'; if(!e.target.checked) document.getElementById('autoDeleteHoursInput').value = ''; }} />
                                                                <CheckCircle size={16} className="text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity"/>
                                                            </div>
                                                            <span className="text-base font-bold text-slate-200">Enable Auto Delete Link</span>
                                                        </label>
                                                        <div id="autoDeleteInputContainer" style={{ display: editData?.autoDeleteHours ? 'block' : 'none' }}>
                                                            <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Auto Delete (Hours after End Time)</label>
                                                            <input type="number" step="0.1" id="autoDeleteHoursInput" name="autoDeleteHours" placeholder="e.g. 3 (Link deletes 3 hours after End Time)" defaultValue={editData?.autoDeleteHours} className="w-full bg-black/60 border border-white/10 focus:border-green-500 focus:bg-black/80 rounded-xl p-4 text-white outline-none shadow-inner transition-all appearance-none" />
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {(contentType === 'testRanking' || contentType === 'paper' || contentType === 'sPaper') && (
                                                <div className="md:col-span-4 bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-black/80 border border-amber-500/30 rounded-3xl p-6 sm:p-8 space-y-8 shadow-2xl">
                                                    {/* Section Header */}
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
                                                        <div className="flex items-center gap-3.5">
                                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
                                                                <Trophy size={24} />
                                                            </div>
                                                            <div>
                                                                <h3 className="text-base sm:text-lg font-black uppercase tracking-wider text-white">
                                                                    Test Ranking & Assessment Setup
                                                                </h3>
                                                                <p className="text-xs sm:text-sm text-slate-400">
                                                                    Configure category, leaderboard publishing, exam duration, and scoring rules.
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <input type="hidden" name="paperType" value={modalPaperType} />
                                                        <input type="hidden" name="category" value={modalCategory} />
                                                        <input type="hidden" name="paperCategory" value={modalCategory} />
                                                        <input type="hidden" name="hasLeaderboard" value={modalCategory === 'WEEKLY' ? (modalWeeklyLeaderboard ? '1' : '0') : '1'} />
                                                        <input type="hidden" name="passMarks" value="0" />
                                                    </div>

                                                    {/* 1. TEST CATEGORY & LEADERBOARD VISIBILITY */}
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                                                <Sparkles size={16} className="text-amber-400" /> 1. Test Category (Ranking Pool) *
                                                            </label>
                                                            <span className="text-xs text-slate-400">Select weekly or monthly exam tier</span>
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            {/* Weekly Test Card */}
                                                            <div
                                                                onClick={() => setModalCategory('WEEKLY')}
                                                                className={`cursor-pointer p-5 rounded-2xl border-2 transition-all flex items-start gap-4 ${
                                                                    modalCategory === 'WEEKLY'
                                                                        ? 'bg-amber-500/15 border-amber-500 ring-4 ring-amber-500/20 text-white shadow-xl shadow-amber-500/10'
                                                                        : 'bg-black/40 border-white/10 text-slate-400 hover:text-white hover:border-white/25'
                                                                }`}
                                                            >
                                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shrink-0 ${
                                                                    modalCategory === 'WEEKLY' ? 'bg-amber-500 text-black shadow-md' : 'bg-white/5 text-slate-400'
                                                                }`}>
                                                                    ⚡
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between">
                                                                        <p className="text-sm sm:text-base font-black text-white uppercase tracking-wider">Weekly Test</p>
                                                                        {modalCategory === 'WEEKLY' && (
                                                                            <span className="text-xs bg-amber-500 text-black font-extrabold px-2.5 py-0.5 rounded-full shadow-sm">
                                                                                Selected
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                                                                        Standard weekly syllabus assessment paper.
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Monthly Test Card */}
                                                            <div
                                                                onClick={() => setModalCategory('MONTHLY')}
                                                                className={`cursor-pointer p-5 rounded-2xl border-2 transition-all flex items-start gap-4 ${
                                                                    modalCategory === 'MONTHLY'
                                                                        ? 'bg-indigo-500/15 border-indigo-500 ring-4 ring-indigo-500/20 text-white shadow-xl shadow-indigo-500/10'
                                                                        : 'bg-black/40 border-white/10 text-slate-400 hover:text-white hover:border-white/25'
                                                                }`}
                                                            >
                                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shrink-0 ${
                                                                    modalCategory === 'MONTHLY' ? 'bg-indigo-500 text-white shadow-md' : 'bg-white/5 text-slate-400'
                                                                }`}>
                                                                    🏆
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between">
                                                                        <p className="text-sm sm:text-base font-black text-white uppercase tracking-wider">Monthly Test</p>
                                                                        {modalCategory === 'MONTHLY' && (
                                                                            <span className="text-xs bg-indigo-500 text-white font-extrabold px-2.5 py-0.5 rounded-full shadow-sm">
                                                                                Selected
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                                                                        Major monthly milestone examination. Automatically published to Monthly Leaderboard.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* WEEKLY TEST LEADERBOARD TOGGLE (When WEEKLY is selected) */}
                                                        {modalCategory === 'WEEKLY' && (
                                                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-3 animate-in fade-in">
                                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                                                    <label className="text-xs sm:text-sm font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                                                                        <Trophy size={16} className="text-amber-400" /> Weekly Test Leaderboard Publishing *
                                                                    </label>
                                                                    <span className="text-xs text-amber-200/70">Decide if this weekly test appears on the live student leaderboard</span>
                                                                </div>

                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                                                                    {/* Option 1: Publish to Leaderboard */}
                                                                    <div
                                                                        onClick={() => setModalWeeklyLeaderboard(true)}
                                                                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-start gap-3.5 ${
                                                                            modalWeeklyLeaderboard
                                                                                ? 'bg-amber-500/20 border-amber-400 text-white shadow-md'
                                                                                : 'bg-black/50 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                                                                        }`}
                                                                    >
                                                                        <div className="mt-0.5">
                                                                            <input 
                                                                                type="radio" 
                                                                                name="weeklyLeaderboardRadio" 
                                                                                checked={modalWeeklyLeaderboard} 
                                                                                onChange={() => setModalWeeklyLeaderboard(true)} 
                                                                                className="w-4 h-4 accent-amber-400 cursor-pointer" 
                                                                            />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2">
                                                                                <p className="text-xs sm:text-sm font-extrabold text-white">
                                                                                    Publish to Live Leaderboard
                                                                                </p>
                                                                                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                                                                                    Ranked
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                                                                Scores and ranks will be visible on the public student leaderboard.
                                                                            </p>
                                                                        </div>
                                                                    </div>

                                                                    {/* Option 2: Practice / No Leaderboard */}
                                                                    <div
                                                                        onClick={() => setModalWeeklyLeaderboard(false)}
                                                                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-start gap-3.5 ${
                                                                            !modalWeeklyLeaderboard
                                                                                ? 'bg-purple-500/20 border-purple-400 text-white shadow-md'
                                                                                : 'bg-black/50 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                                                                        }`}
                                                                    >
                                                                        <div className="mt-0.5">
                                                                            <input 
                                                                                type="radio" 
                                                                                name="weeklyLeaderboardRadio" 
                                                                                checked={!modalWeeklyLeaderboard} 
                                                                                onChange={() => setModalWeeklyLeaderboard(false)} 
                                                                                className="w-4 h-4 accent-purple-400 cursor-pointer" 
                                                                            />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2">
                                                                                <p className="text-xs sm:text-sm font-extrabold text-white">
                                                                                    Practice / Homework Only
                                                                                </p>
                                                                                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
                                                                                    No Leaderboard
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                                                                Self-study / homework only. No public student ranking will be generated.
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* OFFICIAL CANDIDATE COUNT (STAFF COUNT) */}
                                                    <div className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-2.5">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                                                <Users size={16} className="text-emerald-400" /> Total Official Candidates (Staff Count)
                                                            </label>
                                                            <span className="text-xs text-slate-400 font-medium">Optional</span>
                                                        </div>
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                                            <input
                                                                type="number"
                                                                name="manualParticipantCount"
                                                                value={modalManualParticipantCount}
                                                                onChange={(e) => setModalManualParticipantCount(e.target.value)}
                                                                placeholder="e.g. 350 (Total test-takers across all batches)"
                                                                className="flex-1 bg-black/60 border border-white/10 focus:border-amber-500 focus:bg-black/90 rounded-xl p-3.5 text-sm sm:text-base font-bold text-white outline-none shadow-inner"
                                                            />
                                                            <div className="text-xs sm:text-sm text-slate-300">
                                                                Students will see: <span className="text-amber-400 font-black">Rank #X of {modalManualParticipantCount || '350'} Candidates</span>.
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 2. TEST FORMAT SELECTOR */}
                                                    <div className="space-y-4 pt-2 border-t border-white/10">
                                                        <label className="text-xs sm:text-sm font-bold text-slate-200 block uppercase tracking-wider">
                                                            2. Test Format *
                                                        </label>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                            {/* Format 1: Structure Essay Only */}
                                                            <div 
                                                                onClick={() => setModalPaperType('STRUCTURED')}
                                                                className={`cursor-pointer border-2 rounded-2xl p-5 flex flex-col gap-2.5 transition-all ${
                                                                    modalPaperType === 'STRUCTURED'
                                                                        ? 'bg-purple-500/20 border-purple-500 ring-4 ring-purple-500/20 shadow-xl text-white'
                                                                        : 'bg-black/40 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2.5 font-black text-sm sm:text-base text-white">
                                                                        <FileSignature size={18} className="text-purple-400" /> Structure Essay Only
                                                                    </div>
                                                                    <input 
                                                                        type="radio" 
                                                                        name="paperTypeRadio" 
                                                                        checked={modalPaperType === 'STRUCTURED'} 
                                                                        onChange={() => setModalPaperType('STRUCTURED')} 
                                                                        className="w-4 h-4 accent-purple-500 cursor-pointer" 
                                                                    />
                                                                </div>
                                                                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                                                    Download/view question PDF, write answers on paper, and upload answer sheets for lecturer evaluation.
                                                                </p>
                                                            </div>

                                                            {/* Format 2: MCQ + Structured Both */}
                                                            <div 
                                                                onClick={() => setModalPaperType('BOTH')}
                                                                className={`cursor-pointer border-2 rounded-2xl p-5 flex flex-col gap-2.5 transition-all ${
                                                                    modalPaperType === 'BOTH'
                                                                        ? 'bg-amber-500/20 border-amber-500 ring-4 ring-amber-500/20 shadow-xl text-white'
                                                                        : 'bg-black/40 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2.5 font-black text-sm sm:text-base text-white">
                                                                        <Sparkles size={18} className="text-amber-400" /> MCQ + Structured Both
                                                                    </div>
                                                                    <input 
                                                                        type="radio" 
                                                                        name="paperTypeRadio" 
                                                                        checked={modalPaperType === 'BOTH'} 
                                                                        onChange={() => setModalPaperType('BOTH')} 
                                                                        className="w-4 h-4 accent-amber-500 cursor-pointer" 
                                                                    />
                                                                </div>
                                                                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                                                    Complete examination with Part 1 (Online MCQs) and Part 2 (Structured Essay PDF upload).
                                                                </p>
                                                            </div>

                                                            {/* Format 3: MCQ Only */}
                                                            <div 
                                                                onClick={() => setModalPaperType('MCQ')}
                                                                className={`cursor-pointer border-2 rounded-2xl p-5 flex flex-col gap-2.5 transition-all ${
                                                                    modalPaperType === 'MCQ'
                                                                        ? 'bg-emerald-500/20 border-emerald-500 ring-4 ring-emerald-500/20 shadow-xl text-white'
                                                                        : 'bg-black/40 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2.5 font-black text-sm sm:text-base text-white">
                                                                        <CheckCircle size={18} className="text-emerald-400" /> MCQ Only
                                                                    </div>
                                                                    <input 
                                                                        type="radio" 
                                                                        name="paperTypeRadio" 
                                                                        checked={modalPaperType === 'MCQ'} 
                                                                        onChange={() => setModalPaperType('MCQ')} 
                                                                        className="w-4 h-4 accent-emerald-500 cursor-pointer" 
                                                                    />
                                                                </div>
                                                                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                                                    Interactive online questions with option choices. Automatically marked upon submission.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 3. TIMER & SCHEDULE RULES */}
                                                    <div className="space-y-4 pt-2 border-t border-white/10">
                                                        <label className="text-xs sm:text-sm font-bold text-slate-200 block uppercase tracking-wider">
                                                            3. Execution Schedule & Timer Mode *
                                                        </label>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            {/* Flexible Start Option */}
                                                            <div 
                                                                onClick={() => setModalTimerMode('FLEXIBLE')}
                                                                className={`cursor-pointer border-2 rounded-2xl p-5 flex items-start gap-4 transition-all ${
                                                                    modalTimerMode === 'FLEXIBLE' 
                                                                        ? 'bg-blue-500/20 border-blue-500 ring-4 ring-blue-500/20 text-white shadow-lg' 
                                                                        : 'bg-black/40 border-white/10 text-slate-400 hover:border-white/20'
                                                                }`}
                                                            >
                                                                <input 
                                                                    type="radio" 
                                                                    name="timerMode" 
                                                                    value="FLEXIBLE" 
                                                                    checked={modalTimerMode === 'FLEXIBLE'} 
                                                                    onChange={() => setModalTimerMode('FLEXIBLE')} 
                                                                    className="mt-1 w-4 h-4 accent-blue-500 cursor-pointer" 
                                                                />
                                                                <div>
                                                                    <p className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                                                                        <Sparkles size={16} className="text-blue-400" /> Flexible Start (Individual Countdown)
                                                                    </p>
                                                                    <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                                                                        Students can start at any convenient time. Countdown starts immediately when they click 'Start Exam'.
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Scheduled Start Option */}
                                                            <div 
                                                                onClick={() => setModalTimerMode('SCHEDULED')}
                                                                className={`cursor-pointer border-2 rounded-2xl p-5 flex items-start gap-4 transition-all ${
                                                                    modalTimerMode === 'SCHEDULED' 
                                                                        ? 'bg-amber-500/20 border-amber-500 ring-4 ring-amber-500/20 text-white shadow-lg' 
                                                                        : 'bg-black/40 border-white/10 text-slate-400 hover:border-white/20'
                                                                }`}
                                                            >
                                                                <input 
                                                                    type="radio" 
                                                                    name="timerMode" 
                                                                    value="SCHEDULED" 
                                                                    checked={modalTimerMode === 'SCHEDULED'} 
                                                                    onChange={() => setModalTimerMode('SCHEDULED')} 
                                                                    className="mt-1 w-4 h-4 accent-amber-500 cursor-pointer" 
                                                                />
                                                                <div>
                                                                    <p className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                                                                        <Clock size={16} className="text-amber-400" /> Scheduled Start (Synchronized Time)
                                                                    </p>
                                                                    <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                                                                        Synchronized countdown to exact date & time. Everyone starts at the exact same moment.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* If Scheduled Mode: Show Scheduled Start Time picker */}
                                                    {modalTimerMode === 'SCHEDULED' && (
                                                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-2.5 animate-in fade-in">
                                                            <label className="text-xs sm:text-sm font-bold text-amber-300 block uppercase tracking-wider">Scheduled Start Time *</label>
                                                            <input 
                                                                type="time" 
                                                                name="scheduledStartTime" 
                                                                defaultValue={editData?.paper?.scheduledStartTime ? new Date(editData.paper.scheduledStartTime).toTimeString().slice(0, 5) : ''} 
                                                                required={modalTimerMode === 'SCHEDULED'}
                                                                className="w-full bg-black/60 border border-amber-500/40 focus:border-amber-400 focus:bg-black/90 rounded-xl p-4 text-white outline-none shadow-inner text-base font-bold cursor-pointer" 
                                                            />
                                                            <p className="text-xs text-slate-300 italic">Synchronized to the Date selected above in the form.</p>
                                                        </div>
                                                    )}

                                                    {/* 4. EXAM DURATION & BUFFER WINDOWS */}
                                                    {modalPaperType === 'BOTH' ? (
                                                        <div className="space-y-4 pt-2 border-t border-white/10">
                                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                                                <label className="text-xs sm:text-sm font-bold text-slate-200 block uppercase tracking-wider">
                                                                    4. Exam Durations (Part 1 & Part 2) *
                                                                </label>
                                                                {(() => {
                                                                    const mcqMins = (parseInt(modalMcqDurationHours || 0) * 60) + parseInt(modalMcqDurationMinutes || 0);
                                                                    const structMins = (parseInt(modalStructuredDurationHours || 0) * 60) + parseInt(modalStructuredDurationMinutes || 0);
                                                                    const totalMins = mcqMins + structMins;
                                                                    return (
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className="text-xs font-bold text-slate-300 bg-white/5 border border-white/10 px-3 py-1 rounded-xl">
                                                                                MCQ: {modalMcqDurationHours || 0}h {modalMcqDurationMinutes || 0}m + Essay: {modalStructuredDurationHours || 0}h {modalStructuredDurationMinutes || 0}m
                                                                            </span>
                                                                            <span className="text-xs sm:text-sm font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1 rounded-xl shadow-sm">
                                                                                Total: {Math.floor(totalMins / 60)}h {totalMins % 60}m ({totalMins} Mins)
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                {/* Part 1 MCQ Duration Card */}
                                                                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 space-y-3.5 shadow-inner">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs sm:text-sm font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                                                                            <CheckCircle size={16} /> Part 1 (MCQ) Duration
                                                                        </span>
                                                                        <span className="text-xs font-extrabold text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-lg">
                                                                            {(parseInt(modalMcqDurationHours || 0) * 60) + parseInt(modalMcqDurationMinutes || 0)} Mins
                                                                        </span>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div>
                                                                            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Hours</label>
                                                                            <div className="relative">
                                                                                <input 
                                                                                    type="number" 
                                                                                    min="0" 
                                                                                    max="24" 
                                                                                    step="1" 
                                                                                    value={modalMcqDurationHours} 
                                                                                    onChange={(e) => setModalMcqDurationHours(e.target.value)} 
                                                                                    className="w-full bg-black/60 border border-emerald-500/30 focus:border-emerald-400 rounded-xl p-3 text-white outline-none text-sm sm:text-base font-bold" 
                                                                                />
                                                                                <span className="absolute right-3.5 top-3.5 text-xs text-slate-500 font-bold">Hrs</span>
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Minutes</label>
                                                                            <div className="relative">
                                                                                <input 
                                                                                    type="number" 
                                                                                    min="0" 
                                                                                    max="59" 
                                                                                    step="5" 
                                                                                    value={modalMcqDurationMinutes} 
                                                                                    onChange={(e) => setModalMcqDurationMinutes(e.target.value)} 
                                                                                    className="w-full bg-black/60 border border-emerald-500/30 focus:border-emerald-400 rounded-xl p-3 text-white outline-none text-sm sm:text-base font-bold" 
                                                                                />
                                                                                <span className="absolute right-3.5 top-3.5 text-xs text-slate-500 font-bold">Mins</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Part 2 Structured Duration Card */}
                                                                <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-5 space-y-3.5 shadow-inner">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs sm:text-sm font-black text-purple-400 uppercase tracking-wider flex items-center gap-2">
                                                                            <FileSignature size={16} /> Part 2 (Structured Essay) Duration
                                                                        </span>
                                                                        <span className="text-xs font-extrabold text-purple-300 bg-purple-500/20 px-3 py-1 rounded-lg">
                                                                            {(parseInt(modalStructuredDurationHours || 0) * 60) + parseInt(modalStructuredDurationMinutes || 0)} Mins
                                                                        </span>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div>
                                                                            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Hours</label>
                                                                            <div className="relative">
                                                                                <input 
                                                                                    type="number" 
                                                                                    min="0" 
                                                                                    max="24" 
                                                                                    step="1" 
                                                                                    value={modalStructuredDurationHours} 
                                                                                    onChange={(e) => setModalStructuredDurationHours(e.target.value)} 
                                                                                    className="w-full bg-black/60 border border-purple-500/30 focus:border-purple-400 rounded-xl p-3 text-white outline-none text-sm sm:text-base font-bold" 
                                                                                />
                                                                                <span className="absolute right-3.5 top-3.5 text-xs text-slate-500 font-bold">Hrs</span>
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Minutes</label>
                                                                            <div className="relative">
                                                                                <input 
                                                                                    type="number" 
                                                                                    min="0" 
                                                                                    max="59" 
                                                                                    step="5" 
                                                                                    value={modalStructuredDurationMinutes} 
                                                                                    onChange={(e) => setModalStructuredDurationMinutes(e.target.value)} 
                                                                                    className="w-full bg-black/60 border border-purple-500/30 focus:border-purple-400 rounded-xl p-3 text-white outline-none text-sm sm:text-base font-bold" 
                                                                                />
                                                                                <span className="absolute right-3.5 top-3.5 text-xs text-slate-500 font-bold">Mins</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Interval Break & Dedicated Upload Window */}
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                                                                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs sm:text-sm font-black text-indigo-300 uppercase tracking-wider">
                                                                            ☕ Break Between MCQ & Essay *
                                                                        </span>
                                                                        <span className="text-xs font-extrabold text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-lg">
                                                                            {modalBreakIntervalMinutes || 15} Mins
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-slate-300 leading-relaxed">
                                                                        Rest interval given to students after submitting Part 1 before Part 2 begins.
                                                                    </p>
                                                                    <div className="relative pt-1">
                                                                        <input 
                                                                            type="number" 
                                                                            min="0" 
                                                                            max="180" 
                                                                            step="5" 
                                                                            name="breakIntervalMinutes"
                                                                            value={modalBreakIntervalMinutes} 
                                                                            onChange={(e) => setModalBreakIntervalMinutes(e.target.value)} 
                                                                            className="w-full bg-black/60 border border-indigo-500/40 focus:border-indigo-400 rounded-xl p-3 text-white outline-none text-sm font-bold pr-16" 
                                                                        />
                                                                        <span className="absolute right-3.5 top-4 text-xs text-slate-400 font-bold">Mins</span>
                                                                    </div>
                                                                </div>

                                                                <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 sm:p-5 space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs sm:text-sm font-black text-rose-300 uppercase tracking-wider">
                                                                            📤 Dedicated Upload Window (Part 2) *
                                                                        </span>
                                                                        <span className="text-xs font-extrabold text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded-lg">
                                                                            {modalStructuredUploadMinutes || 15} Mins
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-slate-300 leading-relaxed">
                                                                        Buffer window for photographing and uploading answer sheets after writing ends.
                                                                    </p>
                                                                    <div className="relative pt-1">
                                                                        <input 
                                                                            type="number" 
                                                                            min="5" 
                                                                            max="120" 
                                                                            step="5" 
                                                                            name="structuredUploadMinutes"
                                                                            value={modalStructuredUploadMinutes} 
                                                                            onChange={(e) => setModalStructuredUploadMinutes(e.target.value)} 
                                                                            className="w-full bg-black/60 border border-rose-500/40 focus:border-rose-400 rounded-xl p-3 text-white outline-none text-sm font-bold pr-16" 
                                                                        />
                                                                        <span className="absolute right-3.5 top-4 text-xs text-slate-400 font-bold">Mins</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <input 
                                                                type="hidden" 
                                                                name="mcqDurationMinutes" 
                                                                value={(parseInt(modalMcqDurationHours || 0) * 60) + parseInt(modalMcqDurationMinutes || 0)} 
                                                            />
                                                            <input 
                                                                type="hidden" 
                                                                name="structuredDurationMinutes" 
                                                                value={(parseInt(modalStructuredDurationHours || 0) * 60) + parseInt(modalStructuredDurationMinutes || 0)} 
                                                            />
                                                            <input 
                                                                type="hidden" 
                                                                name="paperTime" 
                                                                value={Math.max(1, ((parseInt(modalMcqDurationHours || 0) * 60) + parseInt(modalMcqDurationMinutes || 0)) + ((parseInt(modalStructuredDurationHours || 0) * 60) + parseInt(modalStructuredDurationMinutes || 0)))} 
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-4 pt-2 border-t border-white/10">
                                                            <div className="flex items-center justify-between">
                                                                <label className="text-xs sm:text-sm font-bold text-slate-200 block uppercase tracking-wider">
                                                                    4. Exam Duration & Upload Buffer *
                                                                </label>
                                                                <span className="text-xs sm:text-sm font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1 rounded-xl">
                                                                    Writing Duration: {modalDurationHours || 0}h {modalDurationMinutes || 0}m ({(parseInt(modalDurationHours || 0) * 60) + parseInt(modalDurationMinutes || 0)} Minutes)
                                                                </span>
                                                            </div>

                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                                <div>
                                                                    <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Hours</label>
                                                                    <div className="relative">
                                                                        <input 
                                                                            type="number" 
                                                                            min="0"
                                                                            max="24"
                                                                            step="1"
                                                                            value={modalDurationHours}
                                                                            onChange={(e) => setModalDurationHours(e.target.value)}
                                                                            placeholder="Hours (e.g. 2)" 
                                                                            required
                                                                            className="w-full bg-black/60 border border-white/10 focus:border-green-500 rounded-xl p-3.5 text-white outline-none shadow-inner text-sm sm:text-base font-bold" 
                                                                        />
                                                                        <span className="absolute right-4 top-3.5 text-xs text-slate-500 font-bold">Hours</span>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Minutes</label>
                                                                    <div className="relative">
                                                                        <input 
                                                                            type="number" 
                                                                            min="0" 
                                                                            max="59" 
                                                                            step="5" 
                                                                            value={modalDurationMinutes} 
                                                                            onChange={(e) => setModalDurationMinutes(e.target.value)} 
                                                                            placeholder="Minutes (e.g. 0)" 
                                                                            required
                                                                            className="w-full bg-black/60 border border-white/10 focus:border-green-500 rounded-xl p-3.5 text-white outline-none shadow-inner text-sm sm:text-base font-bold" 
                                                                        />
                                                                        <span className="absolute right-4 top-3.5 text-xs text-slate-500 font-bold">Mins</span>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="text-xs font-semibold text-rose-300 mb-1.5 block">Upload Buffer (Answer Upload)</label>
                                                                    <div className="relative">
                                                                        <input 
                                                                            type="number" 
                                                                            min="5" 
                                                                            max="120" 
                                                                            step="5" 
                                                                            name="structuredUploadMinutes"
                                                                            value={modalStructuredUploadMinutes} 
                                                                            onChange={(e) => setModalStructuredUploadMinutes(e.target.value)} 
                                                                            placeholder="15" 
                                                                            className="w-full bg-black/60 border border-rose-500/40 focus:border-rose-400 rounded-xl p-3.5 text-white outline-none shadow-inner text-sm sm:text-base font-bold" 
                                                                        />
                                                                        <span className="absolute right-4 top-3.5 text-xs text-rose-400 font-bold">Mins Upload</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <input 
                                                                type="hidden" 
                                                                name="paperTime" 
                                                                value={Math.max(1, (parseInt(modalDurationHours || 0) * 60) + parseInt(modalDurationMinutes || 0))} 
                                                            />
                                                            <input 
                                                                type="hidden" 
                                                                name="durationMinutes" 
                                                                value={Math.max(1, (parseInt(modalDurationHours || 0) * 60) + parseInt(modalDurationMinutes || 0))} 
                                                            />
                                                            <input 
                                                                type="hidden" 
                                                                name="structuredDurationMinutes" 
                                                                value={Math.max(1, (parseInt(modalDurationHours || 0) * 60) + parseInt(modalDurationMinutes || 0))} 
                                                            />
                                                            <input 
                                                                type="hidden" 
                                                                name="mcqDurationMinutes" 
                                                                value={Math.max(1, (parseInt(modalDurationHours || 0) * 60) + parseInt(modalDurationMinutes || 0))} 
                                                            />
                                                        </div>
                                                    )}

                                                    {/* 5. MARKS CONFIGURATION (NO PASS MARKS) */}
                                                    {modalPaperType === 'BOTH' ? (
                                                        <div className="space-y-4 pt-2 border-t border-white/10">
                                                            <label className="text-xs sm:text-sm font-bold text-slate-200 block uppercase tracking-wider">
                                                                5. Marks Configuration (Part 1 & Part 2 Breakdown) *
                                                            </label>
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                                {/* MCQ Marks */}
                                                                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 sm:p-5 space-y-2">
                                                                    <label className="text-xs sm:text-sm font-bold text-emerald-400 block flex items-center gap-1.5 uppercase tracking-wider">
                                                                        <CheckCircle size={15} /> Part 1 (MCQ) Marks
                                                                    </label>
                                                                    <input 
                                                                        type="number" 
                                                                        name="totalMcqMarks" 
                                                                        value={modalMcqMarks} 
                                                                        onChange={(e) => {
                                                                            setModalMcqMarks(e.target.value);
                                                                            const nT = (parseFloat(e.target.value || 0) + parseFloat(modalStructuredMarks || 0));
                                                                            setModalTotalMarks(String(nT));
                                                                        }}
                                                                        placeholder="e.g. 50" 
                                                                        className="w-full bg-black/60 border border-emerald-500/30 focus:border-emerald-400 rounded-xl p-3.5 text-white outline-none shadow-inner text-base sm:text-lg font-black" 
                                                                    />
                                                                </div>

                                                                {/* Structured Marks */}
                                                                <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4 sm:p-5 space-y-2">
                                                                    <label className="text-xs sm:text-sm font-bold text-purple-400 block flex items-center gap-1.5 uppercase tracking-wider">
                                                                        <FileSignature size={15} /> Part 2 (Essay) Marks
                                                                    </label>
                                                                    <input 
                                                                        type="number" 
                                                                        name="totalStructuredMarks" 
                                                                        value={modalStructuredMarks} 
                                                                        onChange={(e) => {
                                                                            setModalStructuredMarks(e.target.value);
                                                                            const nT = (parseFloat(modalMcqMarks || 0) + parseFloat(e.target.value || 0));
                                                                            setModalTotalMarks(String(nT));
                                                                        }}
                                                                        placeholder="e.g. 50" 
                                                                        className="w-full bg-black/60 border border-purple-500/30 focus:border-purple-400 rounded-xl p-3.5 text-white outline-none shadow-inner text-base sm:text-lg font-black" 
                                                                    />
                                                                </div>

                                                                {/* Total Paper Marks */}
                                                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 sm:p-5 space-y-2">
                                                                    <label className="text-xs sm:text-sm font-bold text-amber-400 block uppercase tracking-wider">
                                                                        Total Combined Marks
                                                                    </label>
                                                                    <input 
                                                                        type="number" 
                                                                        name="totalMarks" 
                                                                        value={modalTotalMarks} 
                                                                        onChange={(e) => setModalTotalMarks(e.target.value)}
                                                                        placeholder="e.g. 100" 
                                                                        className="w-full bg-black/60 border border-amber-500/30 focus:border-amber-400 rounded-xl p-3.5 text-white outline-none shadow-inner text-base sm:text-lg font-black" 
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-4 pt-2 border-t border-white/10">
                                                            <div className="max-w-md">
                                                                <label className="text-xs sm:text-sm font-bold text-slate-200 mb-2 block uppercase tracking-wider">
                                                                    5. Total Paper Marks *
                                                                </label>
                                                                <input 
                                                                    type="number" 
                                                                    name="totalMarks" 
                                                                    value={modalTotalMarks}
                                                                    onChange={(e) => setModalTotalMarks(e.target.value)}
                                                                    placeholder="e.g. 100" 
                                                                    required
                                                                    className="w-full bg-black/60 border border-white/10 focus:border-amber-400 rounded-xl p-4 text-white outline-none shadow-inner text-base sm:text-lg font-black" 
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* 6. GRADE BOUNDARIES & GRADING SCALE */}
                                                    <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900/70 to-purple-950/30 border border-indigo-500/30 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
                                                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-500/20 pb-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                                                                    <Trophy size={18} />
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-xs sm:text-sm font-bold text-indigo-200 tracking-wide uppercase flex items-center gap-2">
                                                                        6. Grade Boundaries & Grading Scale
                                                                        <span className="text-[11px] font-semibold normal-case text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                                                                            Score % Ranges
                                                                        </span>
                                                                    </h4>
                                                                    <p className="text-xs text-slate-400">
                                                                        Student grade badges according to marks percentage thresholds.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={handleResetStandardGrade}
                                                                    className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                                                                    title="Reset to default A, B, C, S, F"
                                                                >
                                                                    Reset Default
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleAddGradeTier}
                                                                    className="text-xs font-bold text-indigo-300 hover:text-white px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 transition-colors flex items-center gap-1.5 shadow-sm"
                                                                >
                                                                    <Plus size={14} /> Add Grade
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Grade Tiers Grid */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                                                            {modalGradingScale.map((tier, idx) => {
                                                                const badgeStyle = getGradeBadgeStyle(tier.grade);
                                                                return (
                                                                    <div 
                                                                        key={idx} 
                                                                        className="relative bg-black/50 border border-white/10 hover:border-indigo-500/40 rounded-xl p-3.5 flex flex-col justify-between transition-all group"
                                                                    >
                                                                        <div className="flex items-center justify-between gap-2 mb-2.5">
                                                                            <div className="flex items-center gap-2 flex-1">
                                                                                <span className={`px-2.5 py-1 rounded-lg text-sm font-black border ${badgeStyle} shadow-sm min-w-[32px] text-center`}>
                                                                                    {tier.grade || '?'}
                                                                                </span>
                                                                                <input
                                                                                    type="text"
                                                                                    value={tier.grade}
                                                                                    onChange={(e) => handleUpdateGradeTier(idx, 'grade', e.target.value)}
                                                                                    placeholder="Grade"
                                                                                    className="w-full bg-white/5 border border-white/10 focus:border-indigo-400 rounded-lg px-2.5 py-1 text-white font-bold text-sm uppercase outline-none"
                                                                                />
                                                                            </div>
                                                                            {modalGradingScale.length > 1 && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleRemoveGradeTier(idx)}
                                                                                    className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                                                                                    title="Remove grade tier"
                                                                                >
                                                                                    <Trash2 size={15} />
                                                                                </button>
                                                                            )}
                                                                        </div>

                                                                        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300">
                                                                            <div className="flex-1 space-y-1">
                                                                                <span className="text-[11px] text-slate-400 block uppercase font-bold">Min %</span>
                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    max="100"
                                                                                    value={tier.min}
                                                                                    onChange={(e) => handleUpdateGradeTier(idx, 'min', e.target.value)}
                                                                                    placeholder="0"
                                                                                    className="w-full bg-black/60 border border-white/10 focus:border-indigo-400 rounded-lg px-1 py-1.5 text-center text-white font-black text-xs sm:text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-inner"
                                                                                />
                                                                            </div>
                                                                            <span className="text-slate-500 pt-4 font-black">-</span>
                                                                            <div className="flex-1 space-y-1">
                                                                                <span className="text-[11px] text-slate-400 block uppercase font-bold text-center">Max %</span>
                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    max="100"
                                                                                    value={tier.max}
                                                                                    onChange={(e) => handleUpdateGradeTier(idx, 'max', e.target.value)}
                                                                                    placeholder="100"
                                                                                    className="w-full bg-black/60 border border-white/10 focus:border-indigo-400 rounded-lg px-1 py-1.5 text-center text-white font-black text-xs sm:text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-inner"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Hidden input to pass to FormData */}
                                                        <input type="hidden" name="gradingScale" value={JSON.stringify(modalGradingScale)} />
                                                    </div>

                                                    {/* Instructions */}
                                                    <div>
                                                        <label className="text-xs sm:text-sm font-bold text-slate-200 mb-2 block uppercase tracking-wider">
                                                            Instructions for Students (Optional)
                                                        </label>
                                                        <textarea 
                                                            name="instructions" 
                                                            rows="2" 
                                                            defaultValue={editData?.paper?.instructions || ''} 
                                                            placeholder="e.g. Read each question carefully. Countdown begins once started. Submit your answers before time expires." 
                                                            className="w-full bg-black/60 border border-white/10 focus:border-green-500 rounded-xl p-3.5 text-white outline-none shadow-inner text-sm leading-relaxed"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="md:col-span-4 mt-4">
                                                <label className="flex items-center gap-4 cursor-pointer w-max group bg-white/5 p-4 rounded-2xl border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all shadow-sm">
                                                    <div className="relative flex items-center justify-center">
                                                        <input type="checkbox" name="isFree" value="1" defaultChecked={editData?.isFree} className="peer w-6 h-6 appearance-none bg-black/60 border-2 border-slate-500 rounded-lg checked:bg-green-500 checked:border-green-500 transition-colors" />
                                                        <CheckCircle size={16} className="text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity"/>
                                                    </div>
                                                    <span className="text-base font-bold text-slate-200 group-hover:text-white transition-colors">Mark as Free Content (Open for all)</span>
                                                </label>
                                            </div>
                                        </div>

                                        <input type="hidden" name="selectedCourses" value={JSON.stringify(massAssignSubjects)} />
                                        
                                        <div className="pt-8 border-t border-white/10 mt-8">
                                            <div className="flex justify-between items-end mb-6">
                                                <h4 className="text-xl font-extrabold text-white flex items-center gap-3 drop-shadow-sm"><BookOpen size={24} className="text-blue-400"/> Assign to Subjects</h4>
                                            </div>

                                            {editMode ? (
                                                <>
                                                    <div className="bg-black/30 p-6 md:p-8 rounded-[2rem] mb-6 border border-white/5 shadow-inner">
                                                        <label className="text-xs font-bold text-gray-400 mb-4 block uppercase tracking-wider">Share with multiple Batches (Merge Content):</label>
                                                        <div className="flex flex-wrap gap-4">
                                                            {batches.map(b => (
                                                                <label key={`b-sel-${b.id}`} className={`flex items-center gap-3 px-5 py-3 rounded-xl cursor-pointer transition-all border shadow-sm ${selectedBatchesForContent.includes(b.id) ? 'bg-blue-500/20 border-blue-500/50 text-white' : 'bg-black/50 border-white/10 text-gray-400 hover:bg-black/70 hover:text-gray-300'}`}>
                                                                    <input type="checkbox" className="hidden" 
                                                                        checked={selectedBatchesForContent.includes(b.id)} 
                                                                        onChange={(e) => {
                                                                            if(e.target.checked) {
                                                                                setSelectedBatchesForContent([...selectedBatchesForContent, b.id]);
                                                                            } else {
                                                                                setSelectedBatchesForContent(selectedBatchesForContent.filter(id => id !== b.id));
                                                                                // Remove courses belonging to this batch from massAssignSubjects
                                                                                const batchCourseIds = new Set();
                                                                                b.groups?.forEach(g => g.courses?.forEach(c => batchCourseIds.add(c.id)));
                                                                                setMassAssignSubjects(prev => prev.filter(cId => !batchCourseIds.has(cId)));
                                                                            }
                                                                        }} 
                                                                    />
                                                                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors ${selectedBatchesForContent.includes(b.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-500'}`}>
                                                                        {selectedBatchesForContent.includes(b.id) && <CheckCircle size={12} className="text-white"/>}
                                                                    </div>
                                                                    <span className="font-bold text-sm">{b.name}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="bg-black/30 rounded-[2rem] p-6 md:p-8 border border-white/5 space-y-8 shadow-inner">
                                                        {batches.filter(b => selectedBatchesForContent.includes(b.id)).map(selectedBatch => (
                                                            <div key={`batch-group-${selectedBatch.id}`} className="mb-6">
                                                                <h4 className="text-xl font-extrabold text-blue-400 mb-6 border-b border-white/10 pb-3 drop-shadow-sm">{selectedBatch.name}</h4>
                                                                
                                                                {selectedBatch.groups?.length === 0 && <p className="text-sm text-slate-500 font-medium">No groups in this batch.</p>}

                                                                {selectedBatch.groups?.map((group, gIdx) => (
                                                                    <div key={`g-assign-${gIdx}`} className="mb-8 ml-2 md:ml-6">
                                                                        <h5 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2 flex-wrap">
                                                                            <span>{group.name}</span>
                                                                            <span className="text-[10px] font-bold text-slate-400 bg-white/10 px-3 py-1 rounded-lg border border-white/10 uppercase tracking-wider shadow-inner">{group.type === 1 ? 'Monthly' : 'Full'}</span>
                                                                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded border ${parseInt(group.classType || 1, 10) === 2 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                                                                                {parseInt(group.classType || 1, 10) === 2 ? '📝 Paper Group' : '📘 Theory Group'}
                                                                            </span>
                                                                        </h5>
                                                                        
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                                                            {group.courses?.map((course, cIdx) => (
                                                                                <label key={`c-assign-${cIdx}`} className={`flex items-center gap-4 cursor-pointer p-4 rounded-2xl border transition-all shadow-sm group ${massAssignSubjects.includes(course.id) ? 'bg-blue-600/20 border-blue-500/50' : 'bg-black/50 border-white/10 hover:border-white/30 hover:bg-black/70'}`}>
                                                                                    <div className="relative flex items-center justify-center shrink-0">
                                                                                        <input type="checkbox" checked={massAssignSubjects.includes(course.id)} onChange={() => toggleMassAssignSubject(course.id)} className="peer w-6 h-6 appearance-none bg-black/60 border-2 border-slate-500 rounded-lg checked:bg-blue-500 checked:border-blue-500 transition-colors" />
                                                                                        <CheckCircle size={16} className="text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity"/>
                                                                                    </div>
                                                                                    <span className={`text-sm font-bold truncate transition-colors flex-1 ${massAssignSubjects.includes(course.id) ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{course.name}</span>
                                                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border shrink-0 ${parseInt(course.courseType || 1, 10) === 2 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                                                                                        {parseInt(course.courseType || 1, 10) === 2 ? 'Paper' : 'Theory'}
                                                                                    </span>
                                                                                </label>
                                                                            ))}
                                                                            {group.courses?.length === 0 && <p className="text-xs text-slate-500 font-medium">No subjects in this group.</p>}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="bg-black/30 rounded-[2rem] p-6 md:p-8 border border-white/5 space-y-8 shadow-inner">
                                                    {/* Batch Tabs */}
                                                    <div className="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-4">
                                                        {batches.map(b => (
                                                            <button 
                                                                key={`hub-tab-${b.id}`} 
                                                                type="button"
                                                                onClick={() => setHubActiveBatchTab(b.id)}
                                                                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all outline-none ${activeHubBatch === b.id ? 'bg-blue-600 text-white shadow-[0_4px_15px_rgba(37,99,235,0.4)]' : 'bg-black/40 text-gray-400 border border-white/10 hover:text-white hover:bg-black/60 hover:border-white/20'}`}
                                                            >
                                                                {b.name}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* Active Batch Content */}
                                                    {batches.map(batch => {
                                                        if(batch.id !== activeHubBatch) return null;
                                                        
                                                        const bConfig = (hubBatchConfigs && hubBatchConfigs[batch.id]) || {};

                                                        return (
                                                            <div key={`hub-batch-view-${batch.id}`} className="space-y-6">
                                                                {batch.groups?.length === 0 && <p className="text-sm text-slate-500 font-medium">No groups in this batch.</p>}

                                                                {batch.groups?.map(group => (
                                                                    <div key={`hub-group-${group.id}`} className="bg-white/5 border border-white/10 rounded-[1.5rem] p-5 shadow-sm">
                                                                        <h5 className="text-lg font-bold text-white mb-4 flex items-center gap-3 flex-wrap">
                                                                            <span>{group.name}</span> 
                                                                            <span className="text-[10px] font-bold text-slate-400 bg-black/60 px-3 py-1 rounded-lg border border-white/10 uppercase tracking-wider">{group.type === 1 ? 'Monthly' : 'Full'}</span>
                                                                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded border ${parseInt(group.classType || 1, 10) === 2 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                                                                                {parseInt(group.classType || 1, 10) === 2 ? '📝 Paper Group' : '📘 Theory Group'}
                                                                            </span>
                                                                        </h5>
                                                                        
                                                                        <div className="space-y-4">
                                                                            {group.courses?.map(course => {
                                                                                const subjectConfig = bConfig[course.id] || { isChecked: false, folderId: '' };
                                                                                const courseCode = course.code || `SUB_${course.id}`;
                                                                                // Filter folders that have matching courseCode or matching type
                                                                                const availableFolders = lessonGroups.filter(lg => 
                                                                                    parseInt(lg.type) === getTypeInt(contentType) &&
                                                                                    (!lg.courseCode || lg.courseCode === courseCode || lg.courseCode === course.code || (activeSubject && lg.courseCode === (activeSubject.code || `SUB_${activeSubject.id}`)))
                                                                                );

                                                                                return (
                                                                                    <div key={`hub-subject-${course.id}`} className={`p-4 rounded-2xl border transition-all ${subjectConfig.isChecked ? 'bg-blue-600/10 border-blue-500/50' : 'bg-black/40 border-white/10 hover:border-white/30'}`}>
                                                                                        <label className="flex items-center gap-4 cursor-pointer w-full group">
                                                                                            <div className="relative flex items-center justify-center shrink-0">
                                                                                                <input 
                                                                                                    type="checkbox" 
                                                                                                    checked={subjectConfig.isChecked}
                                                                                                    onChange={() => handleHubSubjectToggle(batch.id, course.id, courseCode)}
                                                                                                    className="peer w-6 h-6 appearance-none bg-black/60 border-2 border-slate-500 rounded-lg checked:bg-blue-500 checked:border-blue-500 transition-colors" 
                                                                                                />
                                                                                                <CheckCircle size={16} className="text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity"/>
                                                                                            </div>
                                                                                            <span className={`text-sm font-bold truncate transition-colors flex-1 ${subjectConfig.isChecked ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{course.name}</span>
                                                                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border shrink-0 ${parseInt(course.courseType || 1, 10) === 2 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                                                                                                {parseInt(course.courseType || 1, 10) === 2 ? 'Paper' : 'Theory'}
                                                                                            </span>
                                                                                        </label>

                                                                                        {subjectConfig.isChecked && (
                                                                                            <div className="mt-4 ml-10 flex gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                                                                <select 
                                                                                                    value={subjectConfig.folderId}
                                                                                                    onChange={(e) => handleHubFolderChange(batch.id, course.id, e.target.value, courseCode)}
                                                                                                    className="flex-1 bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500 text-sm appearance-none"
                                                                                                >
                                                                                                    <option value="" className="bg-slate-900">Select Folder</option>
                                                                                                    <option value="uncategorized" className="bg-slate-900 text-yellow-400 font-bold">No Folder (Uncategorized)</option>
                                                                                                    {(() => {
                                                                                                        const rawRfs = availableFolders.filter(f => !f.parentId);
                                                                                                        const seenTitles = new Set();
                                                                                                        const uniqueRfs = [];
                                                                                                        rawRfs.forEach(rf => {
                                                                                                            const tKey = normalizeFolderTitle(rf.title || rf.name) || (rf.title || rf.name || '').trim().toLowerCase();
                                                                                                            if (!seenTitles.has(tKey)) {
                                                                                                                seenTitles.add(tKey);
                                                                                                                uniqueRfs.push(rf);
                                                                                                            }
                                                                                                        });

                                                                                                        return uniqueRfs.map(rf => {
                                                                                                            const allIds = rf.allIds || [rf.id];
                                                                                                            const sfs = availableFolders.filter(f => f.parentId && (allIds.includes(f.parentId) || String(f.parentId) === String(rf.id)));
                                                                                                            const seenSubTitles = new Set();
                                                                                                            const uniqueSubs = [];
                                                                                                            sfs.forEach(sf => {
                                                                                                                const stKey = normalizeFolderTitle(sf.title || sf.name) || (sf.title || sf.name || '').trim().toLowerCase();
                                                                                                                if (!seenSubTitles.has(stKey)) {
                                                                                                                    seenSubTitles.add(stKey);
                                                                                                                    uniqueSubs.push(sf);
                                                                                                                }
                                                                                                            });

                                                                                                            return (
                                                                                                                <React.Fragment key={`hf-${rf.id}`}>
                                                                                                                    <option value={rf.id} className="bg-slate-900 font-bold">📁 {rf.name || rf.title}</option>
                                                                                                                    {uniqueSubs.map(sf => (
                                                                                                                        <option key={`hf-sub-${sf.id}`} value={sf.id} className="bg-slate-950 text-indigo-300">
                                                                                                                            &nbsp;&nbsp;&nbsp;&nbsp;↳ 📂 {sf.name || sf.title}
                                                                                                                        </option>
                                                                                                                    ))}
                                                                                                                </React.Fragment>
                                                                                                            );
                                                                                                        });
                                                                                                    })()}
                                                                                                </select>
                                                                                                <button type="button" onClick={() => { setShowLessonGroupModal(true); setPrefilledFolder(courseCode); }} className="flex-shrink-0 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors border border-white/10 flex items-center gap-2 outline-none">
                                                                                                    <Plus size={16}/> New
                                                                                                </button>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-6 pb-4">
                                            <button 
                                                type="submit" 
                                                disabled={isSubmittingContent}
                                                className="w-full bg-green-600/90 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-lg py-4 rounded-2xl shadow-[0_4px_15px_rgba(22,163,74,0.4)] mt-4 transition-transform hover:scale-[1.01] outline-none tracking-wide uppercase border border-transparent flex items-center justify-center gap-2"
                                            >
                                                {isSubmittingContent ? (
                                                    <>
                                                        <Loader2 size={20} className="animate-spin" />
                                                        <span>Saving Content...</span>
                                                    </>
                                                ) : (
                                                    <span>{editMode ? 'Update Content' : 'Publish Content'}</span>
                                                )}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* SETUP BUSINESS MODAL */}
            {showBusinessModal && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-[#090E17]/95 border border-white/10 rounded-[2rem] p-6 md:p-8 w-full max-w-6xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh] backdrop-blur-3xl">
                        <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4 shrink-0">
                            <h3 className="text-2xl font-extrabold text-white flex items-center gap-3 drop-shadow-sm"><Building2 className="text-blue-400"/> {editMode ? 'Edit Business Configuration' : 'Setup New Business'}</h3>
                            <button onClick={() => setShowBusinessModal(false)} className="text-gray-400 hover:text-white bg-white/5 p-2.5 rounded-xl border border-white/10 transition-all hover:bg-red-500/20 hover:border-red-500/30 outline-none"><X size={20}/></button>
                        </div>
                        
                        <form onSubmit={handleBusinessSubmit} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                            <div className="flex flex-col lg:flex-row gap-10">
                                <div className="flex-1 space-y-6">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-white/10 pb-2 drop-shadow-sm">Basic Information</h4>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="col-span-2">
                                            <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Business Name *</label>
                                            <input type="text" name="name" defaultValue={editData?.name} required className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 transition-all shadow-inner" placeholder="e.g. Science Academy" />
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                            <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Category *</label>
                                            <select name="category" defaultValue={editData?.category || "Advance Level"} required onChange={(e) => { document.getElementById('streamsDiv').style.display = (e.target.value === 'Advance Level' || e.target.value === 'AL') ? 'block' : 'none'; }} className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-brand-accent cursor-pointer shadow-inner appearance-none">
                                                <option value="Advance Level" className="bg-slate-800 text-white">Advance Level</option>
                                                <option value="Ordinary Level" className="bg-slate-800 text-white">Ordinary Level</option>
                                                <option value="Others" className="bg-slate-800 text-white">Others</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                            <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Medium *</label>
                                            <select name="medium" defaultValue={editData?.isEnglish ? 'English' : 'Sinhala'} required className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-brand-accent cursor-pointer shadow-inner appearance-none">
                                                <option value="Sinhala" className="bg-slate-800 text-white">Sinhala Medium</option>
                                                <option value="English" className="bg-slate-800 text-white">English Medium</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Merchant ID (Payment Gateway)</label>
                                            <select name="merchantId" defaultValue={editData?.merchantId || ""} className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-brand-accent cursor-pointer shadow-inner appearance-none">
                                                <option value="" className="bg-slate-800 text-white">Default / Unassigned</option>
                                                <option value="14008328" className="bg-slate-800 text-white">14008328 - IMA Arts New</option>
                                                <option value="14008329" className="bg-slate-800 text-white">14008329 - IMA OL New</option>
                                                <option value="14008330" className="bg-slate-800 text-white">14008330 - IMA Commerce New</option>
                                                <option value="14008331" className="bg-slate-800 text-white">14008331 - IMA Tech New</option>
                                                <option value="14008332" className="bg-slate-800 text-white">14008332 - IMA Education New</option>
                                                <option value="14008333" className="bg-slate-800 text-white">14008333 - IMA English New</option>
                                                <option value="14008334" className="bg-slate-800 text-white">14008334 - IMA Fast Track New</option>
                                                <option value="14008335" className="bg-slate-800 text-white">14008335 - Iddamalgoda Media Academy New</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Description (Optional)</label>
                                        <textarea name="description" defaultValue={editData?.description} rows="4" className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 resize-none shadow-inner transition-all"></textarea>
                                    </div>
                                </div>

                                <div className="w-full lg:w-[450px] space-y-6 shrink-0">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-white/10 pb-2 drop-shadow-sm">Branding & Logic</h4>
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Business Logo *</label>
                                        <label className="flex items-center justify-center h-28 border-2 border-dashed border-white/20 rounded-xl bg-black/40 cursor-pointer hover:bg-black/60 transition-colors hover:border-brand-accent/50 shadow-inner">
                                            <div className="flex flex-col items-center gap-2">
                                                <UploadCloud size={28} className="text-brand-accent drop-shadow-sm"/>
                                                <span className="text-xs text-slate-300 font-bold">{selectedLogoName || "Select Image File"}</span>
                                            </div>
                                            <input type="file" name="logo" accept="image/*" className="hidden" onChange={(e) => setSelectedLogoName(e.target.files[0]?.name || "")} />
                                        </label>
                                    </div>

                                    <div id="streamsDiv" style={{display: (editData?.category === 'Advance Level' || editData?.category === 'AL' || !editData) ? 'block' : 'none'}} className="bg-blue-500/10 p-5 rounded-2xl border border-blue-500/20 shadow-inner">
                                        <label className="text-xs font-extrabold text-blue-300 mb-4 block uppercase tracking-widest drop-shadow-sm">A/L Streams (Select all that apply)</label>
                                        <div className="flex flex-wrap gap-3">
                                            {['Art', 'Commerce', 'Tech', 'Bio', 'Maths'].map(s => (
                                                <label key={s} className="flex items-center gap-2 cursor-pointer text-white text-xs font-bold bg-black/50 px-4 py-2.5 rounded-xl border border-white/10 hover:bg-black/70 transition-colors shadow-sm">
                                                    <input type="checkbox" name={`stream_${s}`} value={s} defaultChecked={editData?.streams?.includes(s)} className="w-4 h-4 accent-blue-500 transition-transform"/> {s}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="bg-orange-500/10 p-5 rounded-2xl border border-orange-500/20 shadow-inner">
                                        <label className="flex items-start gap-4 cursor-pointer group">
                                            <input type="checkbox" name="isDiscountEnabledForInstallments" value="1" defaultChecked={editData?.isDiscountEnabledForInstallments} className="w-6 h-6 accent-orange-500 mt-0.5 shrink-0 transition-transform"/>
                                            <div>
                                                <span className="text-sm font-extrabold text-white group-hover:text-orange-300 transition-colors drop-shadow-sm">Allow Installment Discounts?</span>
                                                <p className="text-[11px] text-orange-200/70 mt-1.5 font-bold leading-relaxed">If ticked, students paying via installments will still receive the bundle discount.</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-white/10 mt-6 shrink-0">
                                <button type="submit" className="w-full bg-brand-accent/90 hover:bg-brand-accent text-white font-extrabold py-4 text-lg rounded-2xl shadow-[0_4px_15px_rgba(225,29,72,0.4)] transition-transform hover:scale-[1.01] uppercase tracking-wide flex justify-center items-center gap-2 outline-none border border-transparent">
                                    {editMode ? 'Update Business Settings' : 'Initialize New Business'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ASSIGN MANAGERS MODAL */}
            {showAssignModal && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-[#090E17]/95 border border-white/10 rounded-[2rem] p-8 w-full max-w-3xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] flex flex-col backdrop-blur-3xl">
                        <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                            <h3 className="text-2xl font-extrabold text-white flex items-center gap-3 drop-shadow-sm"><UserPlus className="text-blue-400"/> Assign Managers</h3>
                            <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-white bg-white/5 p-2.5 rounded-xl border border-white/10 transition-all hover:bg-red-500/20 hover:border-red-500/30 outline-none"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleAssignManagers} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Head Manager</label>
                                    <select name="head_manager" defaultValue={editData?.head_manager_id || ""} className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-blue-500 shadow-inner cursor-pointer appearance-none">
                                        <option value="" className="bg-slate-800 text-white">-- Select Manager --</option>
                                        {managersList.filter(m => m.role === 'Manager' || m.role === 'MANAGER').map(m => <option key={m.id} value={m.id} className="bg-slate-800 text-white">{m.firstName} {m.lastName}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Assistant Manager</label>
                                    <select name="ass_manager" defaultValue={editData?.ass_manager_id || ""} className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-blue-500 shadow-inner cursor-pointer appearance-none">
                                        <option value="" className="bg-slate-800 text-white">-- Select Asst. Manager --</option>
                                        {managersList.filter(m => m.role === 'Ass Manager' || m.role === 'ASS_MANAGER').map(m => <option key={m.id} value={m.id} className="bg-slate-800 text-white">{m.firstName} {m.lastName}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-brand-accent/90 hover:bg-brand-accent text-white font-extrabold py-4 text-lg rounded-2xl shadow-[0_4px_15px_rgba(225,29,72,0.4)] transition-transform hover:scale-[1.01] uppercase tracking-wide outline-none border border-transparent">Assign Staff</button>
                        </form>
                    </div>
                </div>
            )}

            {/* BATCH MODAL */}
            {showBatchModal && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-[#090E17]/95 border border-white/10 rounded-[2rem] p-8 w-full max-w-4xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] flex flex-col backdrop-blur-3xl">
                        <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                            <h3 className="text-2xl font-extrabold text-white flex items-center gap-3 drop-shadow-sm"><Layers className="text-blue-400"/> {editMode ? 'Edit Batch' : 'New Batch'}</h3>
                            <button onClick={() => setShowBatchModal(false)} className="text-gray-400 hover:text-white bg-white/5 p-2.5 rounded-xl border border-white/10 transition-colors hover:bg-red-500/20 hover:border-red-500/30 outline-none"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleBatchSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Batch Name *</label><input type="text" name="name" defaultValue={editData?.name} required className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 shadow-inner transition-all" /></div>
                                <div><label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Logo Image (Optional)</label>
                                <input type="file" name="logo" className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-sm text-gray-400 file:bg-white/10 file:text-white file:border-0 file:rounded-lg file:px-4 file:py-2 file:mr-4 cursor-pointer shadow-inner transition-all" onChange={(e) => setSelectedLogoName(e.target.files[0]?.name || "")} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Batch Type *</label>
                                    <select name="type" defaultValue={editData?.type ? String(editData.type) : "3"} required className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-brand-accent shadow-inner cursor-pointer appearance-none transition-all">
                                        <option value="3" className="bg-slate-800 text-white">Theory and Paper (All-in-One)</option>
                                        <option value="1" className="bg-slate-800 text-white">Theory only</option>
                                        <option value="2" className="bg-slate-800 text-white">Paper only</option>
                                        <option value="4" className="bg-slate-800 text-white">Others</option>
                                    </select>
                                </div>
                                <div><label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Display Order</label><input type="number" name="itemOrder" defaultValue={editData?.itemOrder || "1"} className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 shadow-inner transition-all" /></div>
                                
                                {/* Start Month and End Month */}
                                <div>
                                    <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Start Month</label>
                                    <select name="startMonth" defaultValue={editData?.startMonth || ""} className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 shadow-inner transition-all appearance-none cursor-pointer">
                                        <option value="" className="bg-slate-800 text-gray-400">Select Start Month</option>
                                        {["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"].map(m => (
                                            <option key={m} value={m} className="bg-slate-800 text-white">{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">End Month</label>
                                    <select name="endMonth" defaultValue={editData?.endMonth || ""} className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 shadow-inner transition-all appearance-none cursor-pointer">
                                        <option value="" className="bg-slate-800 text-gray-400">Select End Month</option>
                                        {["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"].map(m => (
                                            <option key={m} value={m} className="bg-slate-800 text-white">{m}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="md:col-span-2"><label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Description</label><textarea name="description" defaultValue={editData?.description} rows="3" className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 resize-none shadow-inner transition-all"></textarea></div>
                            </div>
                            <button type="submit" className="w-full bg-brand-accent/90 hover:bg-brand-accent text-white font-extrabold py-4 text-lg rounded-2xl shadow-[0_4px_15px_rgba(225,29,72,0.4)] mt-6 outline-none transition-transform hover:scale-[1.01] uppercase tracking-wider border border-transparent">{editMode ? 'Update Batch' : 'Create Batch'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* PAYMENT GROUP MODAL */}
            {showGroupModal && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-[#090E17]/95 border border-white/10 rounded-[2rem] p-6 md:p-8 w-full max-w-5xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col backdrop-blur-3xl">
                        <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4 shrink-0">
                            <h3 className="text-2xl font-extrabold text-white flex items-center gap-3 drop-shadow-sm">
                                <Layers className={modalGroupClassType === '2' ? 'text-amber-400' : 'text-blue-400'}/> 
                                {editMode ? `Edit ${modalGroupClassType === '2' ? 'Paper' : 'Theory'} Payment Group` : (modalGroupClassType === '2' ? 'New Paper Class Payment Group' : 'New Theory Class Payment Group')}
                            </h3>
                            <button onClick={() => setShowGroupModal(false)} className="text-gray-400 hover:text-white bg-white/5 p-2.5 rounded-xl border border-white/10 transition-colors hover:bg-red-500/20 hover:border-red-500/30 outline-none"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleGroupSubmit} className="space-y-8 flex-1">
                            <input type="hidden" name="classType" value={modalGroupClassType} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Group Name *</label><input type="text" name="name" defaultValue={editData?.name} placeholder={modalGroupClassType === '2' ? "e.g. 2026 Paper Class Monthly Jan" : "e.g. 2026 Monthly Jan"} required className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 shadow-inner transition-all" /></div>
                                <div><label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Order Number</label><input type="number" name="itemOrder" defaultValue={editData?.itemOrder || "1"} className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 shadow-inner transition-all" /></div>
                                <div>
                                    <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Payment Type *</label>
                                    <select name="paymentType" defaultValue={editData?.type === 1 ? "Monthly" : "Full Payment"} required className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-brand-accent cursor-pointer shadow-inner appearance-none transition-all">
                                        <option value="Monthly" className="bg-slate-800 text-white">Monthly Payment</option><option value="Full Payment" className="bg-slate-800 text-white">Full Payment</option>
                                    </select>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">Class Stream / Type *</label>
                                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded border ${
                                            modalGroupClassType === '2' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                                        }`}>
                                            {modalGroupClassType === '2' ? '📝 Paper Group' : '📘 Theory Group'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setModalGroupClassType('1')}
                                            className={`p-3.5 rounded-xl border font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all outline-none ${
                                                modalGroupClassType === '1'
                                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400/50 shadow-[0_4px_15px_rgba(37,99,235,0.4)]'
                                                    : 'bg-black/40 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                            }`}
                                        >
                                            <BookOpen size={16} className={modalGroupClassType === '1' ? 'text-blue-200' : ''}/>
                                            <span>📘 Theory Class</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setModalGroupClassType('2')}
                                            className={`p-3.5 rounded-xl border font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all outline-none ${
                                                modalGroupClassType === '2'
                                                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white border-amber-400/50 shadow-[0_4px_15px_rgba(245,158,11,0.4)]'
                                                    : 'bg-black/40 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                            }`}
                                        >
                                            <FileSignature size={16} className={modalGroupClassType === '2' ? 'text-amber-200' : ''}/>
                                            <span>📝 Paper Class</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div id="discountRulesSection" className="bg-blue-500/10 border border-blue-500/20 p-6 md:p-8 rounded-[2rem] shadow-inner">
                                <div className="flex justify-between items-center mb-6">
                                    <div><h4 className="text-lg font-extrabold text-blue-400 uppercase tracking-widest drop-shadow-sm">Bundle Discount Rules {modalGroupClassType === '2' ? '(Paper Class)' : '(Theory Class)'}</h4></div>
                                    <button type="button" onClick={addDiscountRule} className="bg-blue-600/90 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 outline-none shadow-sm border border-transparent"><Plus size={18}/> Add Rule</button>
                                </div>
                                <div className="space-y-4">
                                    {discountRules.map((rule, idx) => (
                                        <div key={idx} className="flex flex-col lg:flex-row gap-3 items-end bg-black/40 p-4 rounded-2xl border border-white/10 shadow-sm">
                                            <div className="w-full lg:w-32"><label className="text-[11px] font-bold text-gray-400 mb-1.5 block uppercase tracking-wider">Subjects *</label><input type="number" value={rule.courseCount ?? ''} onChange={(e) => handleDiscountRuleChange(idx, 'courseCount', e.target.value)} placeholder="e.g. 3" className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500 shadow-inner transition-all" /></div>
                                            <div className="flex-1 w-full"><label className="text-[11px] font-bold text-emerald-400 mb-1.5 block uppercase tracking-wider">Total Package Price (Option 1)</label><input type="number" value={rule.packagePrice ?? ''} onChange={(e) => handleDiscountRuleChange(idx, 'packagePrice', e.target.value)} placeholder="e.g. 60000" className="w-full bg-black/60 border border-emerald-500/30 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500 shadow-inner transition-all" /></div>
                                            <div className="flex-1 w-full"><label className="text-[11px] font-bold text-gray-400 mb-1.5 block uppercase tracking-wider">Price/Sub (Option 2)</label><input type="number" value={rule.pricePerCourse ?? ''} onChange={(e) => handleDiscountRuleChange(idx, 'pricePerCourse', e.target.value)} placeholder="e.g. 20000" className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500 shadow-inner transition-all" /></div>
                                            <div className="flex-1 w-full"><label className="text-[11px] font-bold text-gray-400 mb-1.5 block uppercase tracking-wider">Fixed Off (Option 3)</label><input type="number" value={rule.fixedDiscount ?? ''} onChange={(e) => handleDiscountRuleChange(idx, 'fixedDiscount', e.target.value)} placeholder="e.g. 5000" className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500 shadow-inner transition-all" /></div>
                                            <button type="button" onClick={() => removeDiscountRule(idx)} className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white p-3 rounded-xl transition-colors w-full lg:w-auto flex justify-center outline-none shadow-sm shrink-0"><Trash2 size={20}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-4 mt-6 shrink-0">
                                <button type="submit" className={`w-full ${modalGroupClassType === '2' ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-[0_4px_15px_rgba(245,158,11,0.4)]' : 'bg-brand-accent/90 hover:bg-brand-accent shadow-[0_4px_15px_rgba(225,29,72,0.4)]'} text-white font-extrabold py-4 text-lg rounded-2xl outline-none transition-transform hover:scale-[1.01] uppercase tracking-wide border border-transparent`}>{editMode ? 'Update Group' : (modalGroupClassType === '2' ? 'Create Paper Class Group' : 'Create Theory Class Group')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SETUP INSTALLMENTS MODAL */}
            {showInstallmentModal && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-[#090E17]/95 border border-white/10 rounded-[2rem] p-6 md:p-8 w-full max-w-7xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col backdrop-blur-3xl">
                        <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4 shrink-0"><h3 className="text-2xl font-extrabold text-white flex items-center gap-3 drop-shadow-sm"><CreditCard className="text-orange-400"/> Setup Installments</h3><button onClick={() => setShowInstallmentModal(false)} className="text-gray-400 hover:text-white bg-white/5 p-2.5 rounded-xl border border-white/10 transition-colors hover:bg-red-500/20 hover:border-red-500/30 outline-none"><X size={20}/></button></div>
                        
                        <div className="flex flex-col lg:flex-row gap-8 items-start">
                            {/* LEFT COLUMN - EXISTING PLANS */}
                            <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-4">
                                <h4 className="text-sm font-extrabold text-orange-400 mb-2 uppercase tracking-widest drop-shadow-sm px-2">Existing Plans</h4>
                                {existingInstallments.length > 0 ? (
                                    <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
                                        {existingInstallments.map(plan => (
                                            <div key={plan.id} className="flex flex-col gap-4 bg-[#0F1523] p-5 rounded-2xl border border-white/10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] hover:border-orange-500/50 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-orange-500/10 text-orange-400 p-3 rounded-xl border border-orange-500/20">
                                                        <CreditCard size={24} />
                                                    </div>
                                                    <div>
                                                        <h5 className="font-extrabold text-white text-lg drop-shadow-sm">{plan.subjectCount} Subjects</h5>
                                                        <p className="text-xs font-bold text-gray-400 mt-1">{JSON.parse(plan.details).length} Steps Configured</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 w-full">
                                                    <button type="button" onClick={() => handleEditInstallment(plan)} className="flex-1 text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/30 hover:border-blue-500/50 py-2 rounded-xl transition-all outline-none font-bold text-xs flex items-center justify-center gap-2"><Edit3 size={14}/> Edit</button>
                                                    <button type="button" onClick={() => handleDeleteInstallment(plan.id)} className="flex-1 text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/30 hover:border-red-500/50 py-2 rounded-xl transition-all outline-none font-bold text-xs flex items-center justify-center gap-2"><Trash2 size={14}/> Delete</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                                        <p className="text-sm font-bold text-gray-500">No installment plans configured.</p>
                                    </div>
                                )}
                            </div>

                            {/* RIGHT COLUMN - SETUP FORM */}
                            <div className="w-full flex-1">
                                <form onSubmit={handleInstallmentSubmit} className="space-y-6">
                                    <div className="bg-black/40 p-6 rounded-[2rem] border border-white/10 shadow-inner">
                                        <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Trigger Subject Count * (e.g. 3)</label>
                                        <input type="number" name="subjectCount" value={installmentSubjectCount} onChange={(e) => setInstallmentSubjectCount(e.target.value)} placeholder="Number of subjects needed to trigger installment" required className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-orange-500 shadow-inner transition-all focus:bg-black/80" />
                                    </div>
                                    
                                    <div className="bg-orange-500/10 p-6 md:p-8 rounded-[2rem] border border-orange-500/20 shadow-inner">
                                        <div className="flex justify-between items-center mb-8">
                                            <h4 className="text-lg font-extrabold text-orange-400 uppercase tracking-widest drop-shadow-sm">Installment Steps</h4>
                                            <button type="button" onClick={addInstallmentStep} className="bg-orange-600/90 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm outline-none border border-transparent"><Plus size={18}/> Add Step</button>
                                        </div>
                                        <div className="space-y-4">
                                            {installmentSteps.map((step, idx) => (
                                                <div key={idx} className="bg-black/50 p-5 rounded-2xl border border-white/10 shadow-sm">
                                                    <div className="flex flex-col sm:flex-row gap-5 items-center mb-4">
                                                        <div className="font-extrabold text-slate-400 w-full sm:w-16 uppercase tracking-wider text-xs">Step {step.step}:</div>
                                                        <div className="flex-1 w-full">
                                                            <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Amount (Rs) *</label>
                                                            <input type="number" required value={step.amount} onChange={(e) => { const newSteps=[...installmentSteps]; newSteps[idx].amount=e.target.value; setInstallmentSteps(newSteps); }} className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 text-sm text-white outline-none focus:border-orange-500 shadow-inner transition-all focus:bg-black/80" />
                                                        </div>
                                                        <div className="w-full sm:w-40">
                                                            <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider" title="Gap from previous payment">Gap (Days) *</label>
                                                            <input type="number" required value={step.gapDays} onChange={(e) => { const newSteps=[...installmentSteps]; newSteps[idx].gapDays=e.target.value; setInstallmentSteps(newSteps); }} className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 text-sm text-white outline-none focus:border-orange-500 shadow-inner transition-all focus:bg-black/80" />
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-2 mt-2 ml-0 sm:ml-20">
                                                        <span className="text-[11px] font-extrabold text-orange-400 uppercase tracking-widest border-b border-orange-500/20 pb-1 w-max">Finance Matrix Mapping (e.g. 1-4)</span>
                                                        <div className="flex flex-wrap gap-4">
                                                            <div className="flex-1 min-w-[120px]">
                                                                <label className="text-[10px] font-bold text-gray-400 mb-1 block">Normal Range</label>
                                                                <input type="text" placeholder="Auto" value={step.rangeNormal || ''} onChange={(e) => { const newSteps=[...installmentSteps]; newSteps[idx].rangeNormal=e.target.value; setInstallmentSteps(newSteps); }} className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-orange-500 shadow-inner transition-all focus:bg-black/80" />
                                                            </div>
                                                            <div className="flex-1 min-w-[120px]">
                                                                <label className="text-[10px] font-bold text-gray-400 mb-1 block">Upgraded after 1 Month</label>
                                                                <input type="text" placeholder="Auto" value={step.rangeUp1 || ''} onChange={(e) => { const newSteps=[...installmentSteps]; newSteps[idx].rangeUp1=e.target.value; setInstallmentSteps(newSteps); }} className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-orange-500 shadow-inner transition-all focus:bg-black/80" />
                                                            </div>
                                                            <div className="flex-1 min-w-[120px]">
                                                                <label className="text-[10px] font-bold text-gray-400 mb-1 block">Upgraded after 2 Months</label>
                                                                <input type="text" placeholder="Auto" value={step.rangeUp2 || ''} onChange={(e) => { const newSteps=[...installmentSteps]; newSteps[idx].rangeUp2=e.target.value; setInstallmentSteps(newSteps); }} className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-orange-500 shadow-inner transition-all focus:bg-black/80" />
                                                            </div>
                                                            {installmentSteps.length > 1 && (
                                                                <div className="flex items-end">
                                                                    <button type="button" onClick={() => removeInstallmentStep(idx)} className="text-red-400 bg-red-500/10 border border-transparent hover:bg-red-500/30 hover:border-red-500/50 p-2.5 rounded-xl transition-all flex justify-center outline-none h-max"><Trash2 size={18}/></button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-extrabold py-4 rounded-2xl shadow-[0_5px_20px_rgba(249,115,22,0.4)] transition-all flex items-center justify-center gap-3 outline-none"><Save size={20}/> {editInstallmentId ? 'Update Installment Plan' : 'Save Installment Plan'}</button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SUBJECT MODAL */}
            {showCourseModal && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
                    <div className="bg-[#090E17]/95 border border-white/10 rounded-3xl p-5 sm:p-6 md:p-8 w-full max-w-7xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] max-h-[95vh] overflow-y-auto custom-scrollbar flex flex-col backdrop-blur-3xl">
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4 shrink-0"><h3 className="text-xl sm:text-2xl font-extrabold text-white drop-shadow-sm">{editMode ? (modalCourseType === '2' ? 'Edit Paper Subject' : 'Edit Theory Subject') : (modalCourseType === '2' ? 'New Paper Subject' : 'New Theory Subject')}</h3><button onClick={() => setShowCourseModal(false)} className="text-gray-400 hover:text-white bg-white/5 p-2 rounded-xl border border-white/10 transition-colors hover:bg-red-500/20 hover:border-red-500/30 outline-none"><X size={20}/></button></div>
                        <form onSubmit={handleCourseSubmit} className="space-y-6 flex-1">
                            <input type="hidden" name="courseType" value={modalCourseType} />
                            <div className="flex flex-col xl:flex-row gap-6 xl:gap-8">
                                <div className="w-full xl:w-[45%] space-y-5">
                                    {/* Class Stream (Theory / Paper) Selector */}
                                    <div className="bg-white/[0.04] border border-white/10 p-4 sm:p-5 rounded-2xl shadow-inner">
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse"></span>
                                                Class Stream / Type *
                                            </label>
                                            <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded border ${
                                                modalCourseType === '2' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                                            }`}>
                                                {modalCourseType === '2' ? '📝 Paper Class' : '📘 Theory Class'}
                                            </span>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setModalCourseType('1')}
                                                className={`p-3.5 rounded-xl border font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all outline-none ${
                                                    modalCourseType === '1'
                                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400/50 shadow-[0_4px_15px_rgba(37,99,235,0.4)]'
                                                        : 'bg-black/40 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                                }`}
                                            >
                                                <BookOpen size={16} className={modalCourseType === '1' ? 'text-blue-200' : ''}/>
                                                <span>📘 Theory Class</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setModalCourseType('2')}
                                                className={`p-3.5 rounded-xl border font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all outline-none ${
                                                    modalCourseType === '2'
                                                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white border-amber-400/50 shadow-[0_4px_15px_rgba(245,158,11,0.4)]'
                                                        : 'bg-black/40 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                                }`}
                                            >
                                                <FileSignature size={16} className={modalCourseType === '2' ? 'text-amber-200' : ''}/>
                                                <span>📝 Paper Class</span>
                                            </button>
                                        </div>
                                    </div>
                                    {(activeBusiness?.category === 'Advance Level' || activeBusiness?.category === 'AL') && (
                                        <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-3xl shadow-inner">
                                            <label className="text-xs font-bold text-blue-300 mb-4 block uppercase tracking-widest drop-shadow-sm">Select A/L Streams (Can select multiple) *</label>
                                            <div className="flex flex-wrap gap-4">
                                                {getBatchStreams().map(s => (
                                                    <label key={s} className="flex items-center gap-2 cursor-pointer text-white font-bold bg-black/40 p-3.5 rounded-xl border border-white/10 hover:bg-black/60 shadow-sm transition-colors">
                                                        <input type="checkbox" name="streams" value={s} defaultChecked={editData?.streams?.includes(s) || editData?.stream === s} className="w-4 h-4 accent-blue-500 transition-transform"/> {s}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 gap-5">
                                        <div><label className="text-xs font-bold text-slate-300 mb-1.5 block uppercase tracking-wider">Subject Name *</label><input type="text" name="name" defaultValue={editData?.name} required className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 shadow-inner transition-all" /></div>
                                        <div><label className="text-xs font-bold text-slate-300 mb-1.5 block uppercase tracking-wider">Subject Code (Optional)</label><input type="text" name="code" defaultValue={editData?.code} className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 shadow-inner transition-all" /></div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-300 mb-1.5 block uppercase tracking-wider">Start Month</label>
                                                <select name="startMonth" defaultValue={editData?.startMonth || ""} className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 shadow-inner transition-all cursor-pointer">
                                                    <option value="" className="bg-slate-800 text-white">Select Month</option>
                                                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                                                        <option key={m} value={m} className="bg-slate-800 text-white">{m}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-300 mb-1.5 block uppercase tracking-wider">End Month</label>
                                                <select name="endMonth" defaultValue={editData?.endMonth || ""} className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 shadow-inner transition-all cursor-pointer">
                                                    <option value="" className="bg-slate-800 text-white">Select Month</option>
                                                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                                                        <option key={m} value={m} className="bg-slate-800 text-white">{m}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div><label className="text-xs font-bold text-slate-300 mb-1.5 block uppercase tracking-wider">Description</label><textarea name="description" defaultValue={editData?.description} rows="3" className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 resize-none shadow-inner transition-all"></textarea></div>
                                    </div>
                                    <div className="mt-4">
                                        <label className="flex items-start gap-4 cursor-pointer group bg-orange-500/10 p-5 rounded-2xl border border-orange-500/20 hover:bg-orange-500/20 transition-all shadow-sm">
                                            <input type="checkbox" name="isDiscountExcluded" value="true" defaultChecked={editData?.isDiscountExcluded} className="w-6 h-6 accent-orange-500 mt-0.5 shrink-0 transition-transform" />
                                            <div>
                                                <span className="text-sm font-extrabold text-orange-400 group-hover:text-orange-300 transition-colors drop-shadow-sm">Exclude from Bundle Discounts</span>
                                                <p className="text-[11px] text-orange-200/60 mt-1.5 font-bold leading-relaxed">If ticked, this subject will NOT be counted for bundle discounts when students enroll.</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div className="w-full xl:w-[55%] space-y-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-black/40 p-5 rounded-3xl border border-white/5 shadow-inner">
                                        <div>
                                            <label className="text-xs font-bold text-slate-300 mb-1.5 block uppercase tracking-wider">Lecturer Name (Optional)</label>
                                            <LecturerSearchableSelect 
                                                editData={editData} 
                                                editMode={editMode} 
                                                setEditData={setEditData} 
                                                masterTutes={masterTutes} 
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Lecturer Image (Optional)</label>
                                            {editMode && editData?.groupPrices && (() => {
                                                try {
                                                    const parsed = typeof editData.groupPrices === 'string' ? JSON.parse(editData.groupPrices) : editData.groupPrices;
                                                    if (parsed?.[0]?.lecturerImage) {
                                                        return <p className="text-[10px] text-green-400 font-bold mb-2 border border-green-500/20 bg-green-500/10 px-3 py-1.5 rounded-lg inline-block drop-shadow-sm">Current: {parsed[0].lecturerImage}</p>;
                                                    }
                                                } catch(e) {}
                                                return null;
                                            })()}
                                            <input type="file" name="lecturerImage" accept="image/*" className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-sm text-gray-400 file:bg-white/10 file:text-white file:border-0 file:rounded-lg file:px-4 file:py-2 file:mr-4 cursor-pointer shadow-inner transition-all" />
                                        </div>
                                    </div>

                                    <div className="bg-black/30 p-5 rounded-3xl border border-white/10 shadow-inner">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                                            <h4 className="text-base font-extrabold text-slate-200 uppercase tracking-wider drop-shadow-sm">Assign to Groups & Pricing *</h4>
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border w-max ${modalCourseType === '2' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                                                {modalCourseType === '2' ? 'Showing Paper Groups' : 'Showing Theory Groups'}
                                            </span>
                                        </div>
                                        <div className="space-y-4">
                                            {(() => {
                                                const targetClass = parseInt(modalCourseType || 1, 10);
                                                const matchingGroups = (activeBatch?.groups || []).filter(g => parseInt(g.classType || 1, 10) === targetClass);

                                                if (matchingGroups.length === 0) {
                                                    return (
                                                        <div className="text-center py-6 bg-amber-500/10 rounded-2xl border border-amber-500/20 p-5">
                                                            <p className="text-amber-300 text-sm font-bold">
                                                                No {targetClass === 2 ? 'Paper Class' : 'Theory Class'} payment groups found!
                                                            </p>
                                                            <p className="text-xs text-slate-400 mt-1 mb-4">
                                                                Please create a {targetClass === 2 ? 'Paper Class' : 'Theory Class'} payment group first to assign pricing and tutes for this subject.
                                                            </p>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setShowCourseModal(false);
                                                                    setEditData(null);
                                                                    setSelectedClassType(targetClass === 2 ? 'paper' : 'theory');
                                                                    setShowGroupModal(true);
                                                                }}
                                                                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all shadow-md ${
                                                                    targetClass === 2
                                                                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
                                                                        : 'bg-blue-600 hover:bg-blue-500'
                                                                }`}
                                                            >
                                                                + Create First {targetClass === 2 ? 'Paper' : 'Theory'} Payment Group
                                                            </button>
                                                        </div>
                                                    );
                                                }

                                                return matchingGroups.map(g => (
                                                <div key={g.id} className={`flex flex-col p-4 sm:p-5 rounded-2xl border transition-all shadow-sm ${selectedGroupPrices[g.id] !== undefined ? 'bg-blue-500/10 border-blue-500/40' : 'bg-black/40 border-white/5 hover:border-white/20'}`}>
                                                    <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 w-full">
                                                        <label className="flex items-center gap-3 cursor-pointer min-w-[200px] group">
                                                            <input type="checkbox" checked={selectedGroupPrices[g.id] !== undefined} onChange={() => toggleGroupPrice(g.id)} className="hidden" />
                                                            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors ${selectedGroupPrices[g.id] !== undefined ? 'bg-blue-500 border-blue-500' : 'border-slate-500 group-hover:border-slate-400'}`}>{selectedGroupPrices[g.id] !== undefined && <CheckCircle size={12} className="text-white"/>}</div>
                                                            <span className="text-sm sm:text-base font-extrabold text-slate-300 group-hover:text-white transition-colors drop-shadow-sm">{g.name}</span>
                                                        </label>
                                                        
                                                        {selectedGroupPrices[g.id] !== undefined && (
                                                            <div className="flex-1 w-full flex flex-col sm:flex-row items-center gap-3 animate-in fade-in duration-200">
                                                                <input type="number" required placeholder={`Price (LKR)`} value={selectedGroupPrices[g.id].price} onChange={(e) => updateGroupData(g.id, 'price', e.target.value)} className="w-full sm:w-1/2 bg-black/60 border border-blue-500/50 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-blue-400 shadow-inner transition-all" />
                                                                
                                                                <label className="flex items-center justify-center gap-2 cursor-pointer bg-orange-500/10 border border-orange-500/30 px-4 py-3 rounded-xl hover:bg-orange-500/20 transition-colors w-full sm:w-1/2 h-full shadow-sm">
                                                                    <input type="checkbox" checked={selectedGroupPrices[g.id].deliverTute} onChange={(e) => updateGroupData(g.id, 'deliverTute', e.target.checked)} className="accent-orange-500 w-4 h-4 transition-transform" />
                                                                    <span className="text-[10px] sm:text-[11px] font-extrabold text-orange-400 uppercase tracking-widest whitespace-nowrap drop-shadow-sm">Deliver Tute</span>
                                                                </label>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {selectedGroupPrices[g.id] !== undefined && selectedGroupPrices[g.id].deliverTute && (
                                                        <div className="mt-4 pt-4 border-t border-blue-500/20">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Allocated Tutes ({(selectedGroupPrices[g.id].tutes || []).length}/5)</label>
                                                                {(selectedGroupPrices[g.id].tutes || []).length < 5 && (
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => {
                                                                            const currentTutes = selectedGroupPrices[g.id].tutes || [];
                                                                            updateGroupData(g.id, 'tutes', [...currentTutes, { name: '', cover: null }]);
                                                                        }} 
                                                                        className="text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-500 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                                                                    >
                                                                        <Plus size={12}/> Add Tute
                                                                    </button>
                                                                )}
                                                            </div>
                                                            
                                                            {(selectedGroupPrices[g.id].tutes || []).map((tuteItem, tIndex) => (
                                                                <div key={tIndex} className="bg-black/30 border border-white/5 p-4 rounded-xl mb-3 relative group">
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => {
                                                                            const currentTutes = [...(selectedGroupPrices[g.id].tutes || [])];
                                                                            currentTutes.splice(tIndex, 1);
                                                                            updateGroupData(g.id, 'tutes', currentTutes);
                                                                            if (tIndex === 0) {
                                                                                const first = currentTutes[0];
                                                                                updateGroupData(g.id, 'tuteName', first ? first.name : '');
                                                                                updateGroupData(g.id, 'tuteCover', first ? first.cover : null);
                                                                            }
                                                                        }} 
                                                                        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-md transition-colors opacity-50 group-hover:opacity-100"
                                                                    >
                                                                        <X size={14}/>
                                                                    </button>

                                                                    <select 
                                                                        value={tuteItem.name || ''} 
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            const currentTutes = [...(selectedGroupPrices[g.id].tutes || [])];
                                                                            currentTutes[tIndex] = { ...currentTutes[tIndex], name: val };
                                                                            
                                                                            const lecName = editData?.lecturerName || document.querySelector('select[name="lecturerName"]')?.value;
                                                                            const mtd = masterTutes?.find(l => l.name === lecName);
                                                                            if (mtd) {
                                                                                const tuteData = mtd.tutes?.find(t => t.name === val);
                                                                                if (tuteData) {
                                                                                    currentTutes[tIndex].cover = tuteData.image || null;
                                                                                }
                                                                            }
                                                                            updateGroupData(g.id, 'tutes', currentTutes);

                                                                            if (tIndex === 0) {
                                                                                updateGroupData(g.id, 'tuteName', val);
                                                                                updateGroupData(g.id, 'tuteCover', currentTutes[0].cover);
                                                                                if (mtd) updateGroupData(g.id, 'lecturerImage', mtd.image || null);
                                                                            }
                                                                        }}
                                                                        className="w-full bg-black/60 border border-orange-500/30 rounded-xl p-3 pr-10 text-sm text-white font-bold outline-none focus:border-orange-500 shadow-inner transition-all cursor-pointer"
                                                                    >
                                                                        <option value="" disabled className="bg-slate-800 text-slate-400">Select Tute</option>
                                                                        {(() => {
                                                                            const currentVal = tuteItem.name;
                                                                            const currLecName = editData?.lecturerName || document.querySelector('select[name="lecturerName"]')?.value;
                                                                            const lecData = masterTutes?.find(l => l.name === currLecName);
                                                                            
                                                                            const options = [];
                                                                            let hasLegacy = false;

                                                                            if (currentVal && (!lecData || !lecData.tutes?.some(t => t.name === currentVal))) {
                                                                                hasLegacy = true;
                                                                                options.push(<option key="legacy" value={currentVal} className="bg-slate-800 text-yellow-400">{currentVal} (Legacy)</option>);
                                                                            }

                                                                            if (!lecData || !lecData.tutes || lecData.tutes.length === 0) {
                                                                                if (!hasLegacy) options.push(<option key="empty" value="" disabled className="bg-slate-800 text-red-400">No tutes found for selected lecturer</option>);
                                                                            } else {
                                                                                options.push(...lecData.tutes.map((t, idx) => (
                                                                                    <option key={idx} value={t.name} className="bg-slate-800 text-white">{t.name}</option>
                                                                                )));
                                                                            }
                                                                            return options;
                                                                        })()}
                                                                    </select>

                                                                    {tuteItem.name && (
                                                                        <div className="mt-3 flex items-center gap-4">
                                                                            {tuteItem.cover ? (
                                                                                <img 
                                                                                    src={api.defaults.baseURL ? `${api.defaults.baseURL.replace('/api', '')}/storage/documents/${tuteItem.cover}` : `https://imacampus.online/storage/documents/${tuteItem.cover}`} 
                                                                                    onError={(e) => {
                                                                                        if (e.target.src.includes('/storage/documents/')) {
                                                                                            e.target.src = e.target.src.replace('/storage/documents/', '/storage/images/');
                                                                                        } else if (e.target.src.includes('/storage/images/')) {
                                                                                            e.target.src = e.target.src.replace('/storage/images/', '/storage/icons/');
                                                                                        } else {
                                                                                            e.target.onerror = null;
                                                                                            e.target.style.display = 'none';
                                                                                        }
                                                                                    }}
                                                                                    alt="Tute Cover" 
                                                                                    className="w-16 h-20 sm:w-20 sm:h-24 object-cover rounded-lg shadow-md border border-orange-500/30 bg-slate-900" 
                                                                                />
                                                                            ) : (
                                                                                <div className="w-16 h-20 sm:w-20 sm:h-24 bg-slate-800/80 rounded-lg flex flex-col items-center justify-center border border-dashed border-orange-500/30">
                                                                                    <span className="text-[8px] text-slate-400 font-bold tracking-wider">NO COVER</span>
                                                                                </div>
                                                                            )}
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider mb-0.5">Tute {tIndex + 1}</p>
                                                                                <p className="text-sm font-bold text-white truncate">{tuteItem.name}</p>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            
                                                            {(selectedGroupPrices[g.id].tutes || []).length === 0 && (
                                                                <div className="p-4 border border-dashed border-slate-600 rounded-xl text-center">
                                                                    <p className="text-xs text-slate-400 font-bold mb-2">No tutes allocated yet.</p>
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => {
                                                                            updateGroupData(g.id, 'tutes', [{ name: '', cover: null }]);
                                                                        }} 
                                                                        className="text-[11px] font-bold text-blue-400 hover:text-blue-300 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                                                                    >
                                                                        <Plus size={14}/> Add First Tute
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ));
                                        })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-6 border-t border-white/10 mt-6 shrink-0">
                                <button type="submit" disabled={isSubmittingCourse} className={`w-full bg-brand-accent/90 hover:bg-brand-accent text-white font-extrabold py-3.5 text-base sm:text-lg rounded-2xl shadow-[0_4px_15px_rgba(225,29,72,0.4)] transition-transform hover:scale-[1.01] uppercase tracking-wide outline-none border border-transparent ${isSubmittingCourse ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {isSubmittingCourse ? 'Saving Subject...' : (editMode ? 'Update Subject' : 'Save Subject')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ADD/EDIT FOLDER MODAL */}
            {showLessonGroupModal && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-[#090E17]/95 border border-white/10 rounded-[2rem] p-6 sm:p-8 w-full max-w-2xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] flex flex-col backdrop-blur-3xl max-h-[92vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                            <div>
                                <h3 className="text-2xl font-extrabold text-white drop-shadow-sm flex items-center gap-2.5">
                                    <FolderOpen className={selectedFolderParentId ? "text-indigo-400" : "text-brand-accent"} size={26} />
                                    {editMode ? (selectedFolderParentId ? 'Edit Sub-folder' : 'Edit Folder') : (selectedFolderParentId ? 'New Sub-folder' : 'New Folder')}
                                </h3>
                                {selectedFolderParentId && (
                                    <p className="text-xs text-indigo-400 font-semibold mt-1">
                                        Inside: <span className="font-bold underline">{lessonGroups.find(g => String(g.id) === String(selectedFolderParentId))?.title || 'Selected Main Folder'}</span>
                                    </p>
                                )}
                            </div>
                            <button 
                                type="button"
                                onClick={() => {
                                    setShowLessonGroupModal(false);
                                    if (setEditMode) setEditMode(false);
                                    if (setEditData) setEditData(null);
                                    if (setParentFolderForSub) setParentFolderForSub(null);
                                    if (setSelectedFolderParentId) setSelectedFolderParentId('');
                                }} 
                                className="text-gray-400 hover:text-white bg-white/5 p-2.5 rounded-xl border border-white/10 transition-colors hover:bg-red-500/20 hover:border-red-500/30 outline-none"
                            >
                                <X size={20}/>
                            </button>
                        </div>
                        <form onSubmit={handleLessonGroupSubmit} className="space-y-5">
                            <div>
                                <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">
                                    Folder Location / Parent Folder
                                </label>
                                <select 
                                    name="parentId" 
                                    value={selectedFolderParentId ? String(selectedFolderParentId) : ''} 
                                    onChange={(e) => setSelectedFolderParentId(e.target.value)} 
                                    className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 sm:p-4 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 shadow-inner cursor-pointer"
                                >
                                    <option value="" className="bg-slate-900 text-white font-bold">
                                        📁 Root Folder (Main Level)
                                    </option>
                                    {lessonGroups
                                        .filter(g => parseInt(g.type) === getTypeInt(contentTab || contentType || 'recording') && !g.parentId && (!editData || g.id !== editData.id))
                                        .map(root => (
                                            <option key={root.id} value={String(root.id)} className="bg-slate-900 text-indigo-300 font-semibold">
                                                ↳ 📂 Inside Sub-folder of: {root.title || root.name}
                                            </option>
                                        ))}
                                </select>
                                <p className="text-[11px] text-gray-400 mt-1">
                                    Select a parent folder above to place this as a Sub-folder, or choose "Root Folder" for a top-level folder.
                                </p>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                        {selectedFolderParentId ? 'Sub-folder Title *' : 'Folder Title *'}
                                    </label>
                                    <span className="text-[10px] text-gray-400 font-medium">Click quick suggestion or type</span>
                                </div>
                                <input 
                                    type="text" 
                                    name="title" 
                                    value={folderTitleValue} 
                                    onChange={(e) => setFolderTitleValue(e.target.value)}
                                    placeholder={selectedFolderParentId ? "e.g. Unit 01 Discussions" : "e.g. OCTOBER MONTH"} 
                                    required 
                                    className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 sm:p-4 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 shadow-inner transition-all font-semibold" 
                                />
                                
                                {/* Quick suggestion chips */}
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {[
                                        "OCTOBER MONTH", "NOVEMBER MONTH", "DECEMBER MONTH",
                                        "JANUARY MONTH", "FEBRUARY MONTH", "Unit 01", "Unit 02", "Past Papers", "Discussion"
                                    ].map((chip) => (
                                        <button
                                            key={chip}
                                            type="button"
                                            onClick={() => setFolderTitleValue(chip)}
                                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/5 hover:bg-brand-accent/20 text-slate-300 hover:text-white border border-white/10 hover:border-brand-accent/30 transition-all cursor-pointer"
                                        >
                                            + {chip}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Display Order</label>
                                <input type="number" name="order" defaultValue={editData?.itemOrder || "1"} className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 sm:p-4 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 shadow-inner transition-all" />
                            </div>

                            {/* Automation Toggles (Only for New Root Folders) */}
                            {!selectedFolderParentId && !editMode && (
                                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3.5 shadow-sm">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-accent flex items-center gap-1.5">
                                        ⚡ Quick Automation & Sync
                                    </span>
                                    
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            name="applyToAllSubjects"
                                            checked={folderApplyAllSubjects} 
                                            onChange={(e) => setFolderApplyAllSubjects(e.target.checked)} 
                                            className="w-4 h-4 mt-0.5 rounded text-brand-accent bg-black/60 border-white/20 focus:ring-0 cursor-pointer shrink-0"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-white group-hover:text-brand-accent transition-colors">
                                                Available in all subjects of this batch
                                            </span>
                                            <span className="text-[11px] text-gray-400">
                                                Creates once for the whole batch so all subjects (Media, Econ, ICT, etc.) see this folder immediately.
                                            </span>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            name="applyToBothTypes"
                                            checked={folderApplyBothTypes} 
                                            onChange={(e) => setFolderApplyBothTypes(e.target.checked)} 
                                            className="w-4 h-4 mt-0.5 rounded text-brand-accent bg-black/60 border-white/20 focus:ring-0 cursor-pointer shrink-0"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-white group-hover:text-brand-accent transition-colors">
                                                Create in both Recordings & Documents tabs
                                            </span>
                                            <span className="text-[11px] text-gray-400">
                                                Saves time by automatically creating this folder in both video recordings and document notes.
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            )}
                            
                            <div>
                                <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Share with other Batches (Optional)</label>
                                <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar p-3 bg-black/40 border border-white/5 rounded-xl">
                                    {batches.filter(b => b.id !== activeBatch?.id).map(b => (
                                        <label key={`share-folder-b-${b.id}`} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                                            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors ${selectedBatchesForContent.includes(b.id) ? 'bg-brand-accent border-brand-accent' : 'border-slate-500'}`}>
                                                {selectedBatchesForContent.includes(b.id) && <CheckCircle size={12} className="text-white"/>}
                                            </div>
                                            <span className="text-sm text-gray-300">{b.name}</span>
                                            <input type="checkbox" className="hidden" checked={selectedBatchesForContent.includes(b.id)} 
                                                onChange={(e) => {
                                                    if(e.target.checked) setSelectedBatchesForContent([...selectedBatchesForContent, b.id]);
                                                    else setSelectedBatchesForContent(selectedBatchesForContent.filter(id => id !== b.id));
                                                }}
                                            />
                                        </label>
                                    ))}
                                    {batches.filter(b => b.id !== activeBatch?.id).length === 0 && <span className="text-xs text-gray-500">No other batches available</span>}
                                </div>
                            </div>
                            <button 
                                type="submit" 
                                disabled={isSubmittingFolder}
                                className="w-full bg-brand-accent/90 hover:bg-brand-accent disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold py-4 text-base sm:text-lg rounded-2xl shadow-[0_4px_15px_rgba(225,29,72,0.4)] mt-4 outline-none transition-transform hover:scale-[1.01] uppercase tracking-wide border border-transparent flex items-center justify-center gap-2"
                            >
                                {isSubmittingFolder ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        <span>Saving Folder...</span>
                                    </>
                                ) : (
                                    <span>{editMode ? (selectedFolderParentId ? 'Update Sub-folder' : 'Update Folder') : (selectedFolderParentId ? 'Create Sub-folder' : 'Create Folder')}</span>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* LECTURER MODAL */}
            {showLecturerModal && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-[#090E17]/95 border border-white/10 rounded-[2rem] p-8 w-full max-w-2xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] flex flex-col backdrop-blur-3xl">
                        <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                            <h3 className="text-2xl font-extrabold text-white drop-shadow-sm">{editMode ? 'Edit Lecturer' : 'New Lecturer'}</h3>
                            <button type="button" onClick={() => setShowLecturerModal(false)} className="text-gray-400 hover:text-white bg-white/5 p-2.5 rounded-xl border border-white/10 transition-colors hover:bg-red-500/20 hover:border-red-500/30 outline-none"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleLecturerSubmit} className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Lecturer Name *</label>
                                <input type="text" name="name" defaultValue={editData?.name} required placeholder="e.g. Dr. Kamal" className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 shadow-inner transition-all" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">Phone Number (Optional)</label>
                                <input type="text" name="phone" defaultValue={editData?.phone} placeholder="e.g. 0712345678" className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-brand-accent focus:bg-black/80 shadow-inner transition-all" />
                            </div>
                            <button type="submit" className="w-full bg-brand-accent/90 hover:bg-brand-accent text-white font-extrabold py-4 text-lg rounded-2xl shadow-[0_4px_15px_rgba(225,29,72,0.4)] mt-6 outline-none transition-transform hover:scale-[1.01] uppercase tracking-wide border border-transparent">
                                {editMode ? 'Update Lecturer' : 'Add Lecturer'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* PREVIEW MODAL */}
            {previewData && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-[#090E17]/95 border border-white/10 rounded-[2rem] w-full max-w-7xl h-[85vh] flex flex-col shadow-[0_10px_50px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-3xl">
                        <div className="p-6 md:p-8 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                            <h3 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-3 drop-shadow-sm"><MonitorPlay size={28} className="text-blue-400"/> {previewData.title}</h3>
                            <div className="flex gap-3">
                                <a href={previewData.fileName ? `${getBaseUrl()}/storage/documents/${previewData.fileName}` : previewData.link} target="_blank" rel="noreferrer" className="bg-brand-accent/90 hover:bg-brand-accent text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-[0_4px_15px_rgba(225,29,72,0.4)] outline-none border border-transparent">
                                    <ExternalLink size={18}/> Open External
                                </a>
                                <button onClick={() => setPreviewData(null)} className="text-gray-400 hover:text-white bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 p-2.5 rounded-xl transition-all shadow-sm outline-none"><X size={20}/></button>
                            </div>
                        </div>
                        <div className="flex-1 bg-black/40 p-6 relative flex items-center justify-center shadow-inner">
                            {previewData.fileName ? (
                                <iframe src={`${getBaseUrl()}/storage/documents/${previewData.fileName}`} className="w-full h-full rounded-2xl bg-white shadow-inner border border-white/10" title="Document Preview" />
                            ) : previewData.link ? (
                                <iframe src={getEmbedUrl(previewData.link)} className="w-full h-full rounded-2xl bg-black border border-white/10 shadow-inner" title="Video/Live Preview" allowFullScreen />
                            ) : (
                                <div className="text-center text-slate-500"><Ban size={64} className="mx-auto mb-4 opacity-40"/><p className="text-xl font-bold">No preview available.</p></div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    return createPortal(modalContent, document.body);
}