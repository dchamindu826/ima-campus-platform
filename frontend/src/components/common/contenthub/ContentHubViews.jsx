import React from 'react';
import { ArrowUp, ArrowDown, FolderOpen, Folder, FolderPlus, Layers, BookOpen, Edit3, Trash2, ChevronRight, ChevronDown, GripVertical, CheckCircle, Video, MonitorPlay, FileText, FileSignature, Power, UserPlus, Plus, Users, User, Eye, EyeOff, Calendar, TrendingUp, Copy, Link, Building2, Sparkles, Trophy, Clock, Award, Unlink, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import UpgradePricingConfig from '../../admin/UpgradePricingConfig';

export default function ContentHubViews({ state, actions }) {
    const {
        isSystemAdmin, canManageBusiness, canManageBatches, canManageGroupsAndSubjects, canManageContent, isPaperMarkerOrGuider,
        viewLevel, activeBusiness, activeBatch, batchTab, activeSubject, contentTab, businesses, batches, uniqueSubjects,
        lessonGroups, subjectContents, editMode, openFolders, groupedSubjects, parentFolderForSub, selectedFolderParentId,
        selectedClassType, setSelectedClassType, theoryCount, paperCount
    } = state;

    const effectiveBatchTab = isPaperMarkerOrGuider ? 'subjects' : batchTab;
    const effectiveContentTab = isPaperMarkerOrGuider ? 'testRanking' : contentTab;

    const {
        openBusinessDetails, openBatchDetails, openContentsView, getImageUrl, getManagerName, toggleBusinessStatus, toggleBatchStatus, deleteItem, unlinkContent, fetchContents,
        setEditData, setEditMode, setSelectedLogoName, setShowBusinessModal, setShowAssignModal, setShowBatchModal, setShowGroupModal, setShowCourseModal,
        setShowLessonGroupModal, setShowContentModal, setPreviewData, setContentType, setPrefilledFolder, setSelectedBatchesForContent,
        toggleFolder, setBatchTab, setContentTab, isMatchedType, getFolderId, setDiscountRules, setSelectedGroupPrices, setMassAssignSubjects,
        openCreateSubFolderModal, setSelectedFolderParentId, openPaperBuilder, setHubBatchConfigs, setHubActiveBatchTab
    } = actions;

    // ⬆ ⬇ folder order: saves the new top-to-bottom order for every copy of each folder
    // (all subjects / recordings + documents), so staff and students see the same order.
    const moveFolder = async (list, index, dir) => {
        const target = index + dir;
        if (target < 0 || target >= list.length) return;
        const next = [...list];
        [next[index], next[target]] = [next[target], next[index]];
        try {
            await api.post('/v2/content/folders/reorder', { folders: next.map(f => (f.ids && f.ids.length ? f.ids : [f.id]).map(Number)) });
            toast.success('Folder order saved');
            fetchContents(activeSubject, activeBatch);
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Could not save the order');
        }
    };
    const byOrder = (a, b) => (Number(a.itemOrder) || 1) - (Number(b.itemOrder) || 1) || Number(a.id) - Number(b.id);
    const orderButtons = (list, index, small) => (
        <>
            <button title="Move up" disabled={index === 0} onClick={(e) => { e.stopPropagation(); moveFolder(list, index, -1); }} className={`text-slate-300 hover:bg-white/10 bg-white/5 ${small ? 'p-1.5 rounded-lg' : 'p-2 sm:p-2.5 rounded-xl'} transition-colors outline-none disabled:opacity-30 disabled:cursor-not-allowed`}><ArrowUp size={small ? 14 : 16} /></button>
            <button title="Move down" disabled={index === list.length - 1} onClick={(e) => { e.stopPropagation(); moveFolder(list, index, 1); }} className={`text-slate-300 hover:bg-white/10 bg-white/5 ${small ? 'p-1.5 rounded-lg' : 'p-2 sm:p-2.5 rounded-xl'} transition-colors outline-none disabled:opacity-30 disabled:cursor-not-allowed`}><ArrowDown size={small ? 14 : 16} /></button>
        </>
    );

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

    const isItemInFolder = (c, folder) => {
        const fId = c.content_group_id ?? c.contentGroupId ?? c.folder_id;
        if (fId) {
            const matchesId = String(fId) === String(folder.id) ||
                (folder.ids && folder.ids.includes(String(fId))) ||
                (folder.allIds && folder.allIds.some(id => String(id) === String(fId)));
            if (matchesId) return true;

            // If item has a specific folder ID assigned and that folder exists, DO NOT fallback to month!
            const folderExists = (lessonGroups || []).some(g =>
                String(g.id) === String(fId) ||
                (g.allIds && g.allIds.some(id => String(id) === String(fId)))
            );
            if (folderExists) return false;
        }

        const itemGroupTitle = c.groupTitle || c.group?.title;
        if (itemGroupTitle && folder?.title) {
            const rawItem = itemGroupTitle.trim().toLowerCase();
            const rawFolder = folder.title.trim().toLowerCase();
            if (rawItem === rawFolder) return true;

            const normItem = normalizeFolderTitle(itemGroupTitle);
            const normFolder = normalizeFolderTitle(folder.title);
            if (normItem && normFolder && normItem === normFolder) return true;

            // If item has a specific group title that matches another folder, DO NOT match month!
            const titleFolderExists = (lessonGroups || []).some(g => {
                const gRaw = (g.title || '').trim().toLowerCase();
                const gNorm = normalizeFolderTitle(g.title);
                return gRaw === rawItem || (normItem && gNorm && normItem === gNorm);
            });
            if (titleFolderExists) return false;
        }

        // Smart Month matching fallback for cross-batch or uncategorized items
        if (!folder?.parentId && folder?.title) {
            let targetMonthIdx = -1;
            if (c.date) {
                try {
                    const d = new Date(c.date);
                    if (!isNaN(d.getTime())) targetMonthIdx = d.getMonth();
                } catch (err) { }
            }
            if (targetMonthIdx === -1 && c.title) {
                const titleLower = c.title.toLowerCase();
                targetMonthIdx = monthNames.findIndex(m => titleLower.includes(m));
                if (targetMonthIdx === -1) {
                    targetMonthIdx = sinhalaMonths.findIndex(m => titleLower.includes(m));
                }
            }
            if (targetMonthIdx !== -1) {
                const engMonth = monthNames[targetMonthIdx];
                const sinMonth = sinhalaMonths[targetMonthIdx];
                const fTitleLower = folder.title.toLowerCase();
                const fNorm = normalizeFolderTitle(folder.title);
                if (fTitleLower.includes(engMonth) || fTitleLower.includes(sinMonth) ||
                    fNorm.includes(engMonth) || fNorm.includes(sinMonth)) {
                    return true;
                }
            }
        }

        return false;
    };

    const isUncategorized = (c) => {
        const activeFolders = (lessonGroups || []).filter(f => isMatchedType(f));
        if (activeFolders.length === 0) return true;
        const cFolderId = c.content_group_id ?? c.contentGroupId ?? c.folder_id;
        if (cFolderId && activeFolders.some(f => String(f.id) === String(cFolderId) || (f.allIds && f.allIds.some(id => String(id) === String(cFolderId))))) {
            return false;
        }
        const hasMatch = activeFolders.some(folder => isItemInFolder(c, folder));
        return !hasMatch;
    };

    const formatDuration = (mins) => {
        if (!mins) return '60 Mins';
        const m = parseInt(mins);
        const hours = Math.floor(m / 60);
        const remMins = m % 60;
        if (hours > 0 && remMins > 0) return `${hours}h ${remMins}m`;
        if (hours > 0) return `${hours} ${hours === 1 ? 'Hour' : 'Hours'}`;
        return `${remMins} Mins`;
    };

    const isTestType = (tab, c) => {
        return tab === 'testRanking' || tab === 'paper' || tab === 'sPaper' ||
            ['testRanking', 'rankingTest', 'test', 'paper', 'sPaper', '4', '5'].includes(String(c?.contentType));
    };

    const renderTestBadges = (content) => {
        const pType = content?.paper?.paperType || (content?.contentType === 'sPaper' || content?.contentType === '4' ? 'STRUCTURED' : 'MCQ');
        const duration = content?.paper?.durationMinutes || content?.paperTime || 60;
        const isScheduled = content?.paper?.timerMode === 'SCHEDULED';
        const startTime = content?.paper?.scheduledStartTime;
        const category = content?.paper?.category || 'WEEKLY';
        const candidateCount = content?.paper?.manualParticipantCount;

        return (
            <div className="space-y-1.5 mb-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider border flex items-center gap-1 ${category === 'MONTHLY'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        }`}>
                        {category === 'MONTHLY' ? '🏆 Monthly Test' : '⚡ Weekly Test'}
                    </span>

                    {pType === 'STRUCTURED' ? (
                        <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                            <FileSignature size={11} /> Structure Essay
                        </span>
                    ) : pType === 'BOTH' ? (
                        <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Sparkles size={11} className="text-amber-400" /> MCQ + Structured
                        </span>
                    ) : (
                        <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle size={11} /> MCQ Only
                        </span>
                    )}

                    <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-white/5 text-slate-300 border border-white/10 flex items-center gap-1">
                        <Clock size={10} className="text-amber-400" /> {formatDuration(duration)}
                    </span>

                    {candidateCount && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-white/5 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                            <Users size={10} className="text-emerald-400" /> {candidateCount} Candidates
                        </span>
                    )}
                </div>

                {isScheduled && startTime && (
                    <div className="text-[10px] text-amber-300/90 font-medium flex items-center gap-1 truncate">
                        <span>⏰ Starts: {new Date(startTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                )}
            </div>
        );
    };

    const copyToClipboard = (text) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                toast.success("Link copied to clipboard!");
            }).catch(err => {
                toast.error("Failed to copy link");
            });
            return;
        }
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            toast.success("Link copied to clipboard!");
        } catch (err) {
            toast.error("Failed to copy link");
        }
        document.body.removeChild(textArea);
    };

    const openEditContentModal = (content) => {
        setEditData(content);
        setEditMode(true);
        setShowContentModal(true);
        setContentType(contentTab);
        setPrefilledFolder(content.contentGroupId ? String(content.contentGroupId) : (content.content_group_id ? String(content.content_group_id) : ''));

        if (content.assignedCourses && content.assignedCourses.length > 0) {
            setMassAssignSubjects(content.assignedCourses);
        } else {
            setMassAssignSubjects(activeSubject?.allCourseIds || [activeSubject?.id]);
        }

        const batchSet = new Set();
        if (activeBatch?.id) batchSet.add(activeBatch.id);
        if (content.batchId) batchSet.add(Number(content.batchId));

        let addBatches = [];
        try {
            if (Array.isArray(content.additionalBatchIds)) {
                addBatches = content.additionalBatchIds;
            } else if (typeof content.additionalBatchIds === 'string') {
                addBatches = JSON.parse(content.additionalBatchIds);
            }
        } catch (e) {
            if (typeof content.additionalBatchIds === 'string') {
                addBatches = content.additionalBatchIds.split(',').map(s => s.trim()).filter(Boolean);
            }
        }
        addBatches.forEach(bId => { if (bId) batchSet.add(Number(bId)); });

        if (Array.isArray(batches) && Array.isArray(content.assignedCourses)) {
            const assignedSet = new Set(content.assignedCourses.map(Number));
            batches.forEach(b => {
                const hasCourse = (b.groups || []).some(g => (g.courses || []).some(c => assignedSet.has(Number(c.id))));
                if (hasCourse) batchSet.add(b.id);
            });
        }
        setSelectedBatchesForContent(Array.from(batchSet));
    };

const renderContentCard = (content) => {
    const currentSubjectCourseIds = new Set((activeSubject?.allCourseIds || [activeSubject?.id]).map(Number));
    const hasOutsideCourses = (content.assignedCourses || []).some(cId => !currentSubjectCourseIds.has(Number(cId)));

    let hasMultipleBatches = false;
    try {
        if (Array.isArray(content.additionalBatchIds)) {
            hasMultipleBatches = content.additionalBatchIds.length > 0;
        } else if (typeof content.additionalBatchIds === 'string' && content.additionalBatchIds.trim() !== '') {
            const parsed = JSON.parse(content.additionalBatchIds);
            hasMultipleBatches = Array.isArray(parsed) && parsed.length > 0;
        }
    } catch (e) {
        hasMultipleBatches = Boolean(content.additionalBatchIds);
    }

    const isSharedContent = hasOutsideCourses || hasMultipleBatches;

    return (
        <div key={content.id} className="bg-white/[0.05] border border-white/10 rounded-2xl sm:rounded-[2rem] overflow-hidden hover:border-white/30 transition-all shadow-sm hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] group flex flex-col relative backdrop-blur-md">
            {/* Drag handle */}
            {canManageContent && (
                <div className="absolute top-2.5 left-2.5 z-10 bg-black/50 p-1.5 rounded-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity cursor-grab shadow-sm border border-white/10">
                    <GripVertical size={14} className="text-white" />
                </div>
            )}

            {/* Thumbnail Image Section */}
            <div className="h-36 sm:h-40 w-full bg-black/40 relative overflow-hidden shrink-0 border-b border-white/5">
                {content.thumbnail ? (
                    <img src={`${getBaseUrl()}/storage/documents/${content.thumbnail}`} alt="Thumbnail" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-800/50 to-black flex items-center justify-center opacity-80 group-hover:scale-105 transition-transform duration-500">
                        <MonitorPlay size={36} className="text-white/20" />
                    </div>
                )}

                {/* Shared Badge */}
                {isSharedContent && (
                    <div className="absolute top-2.5 left-2.5 z-10 bg-indigo-600/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-indigo-400/40 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white shadow-md flex items-center gap-1">
                        <Share2 size={11} className="text-indigo-200" /> Shared
                    </div>
                )}

                {/* Date Badge */}
                <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
                    {content.date ? content.date.split('T')[0] : 'No Date'}
                </div>
            </div>

            {/* Content Details */}
            <div className="p-3.5 sm:p-5 flex-1 flex flex-col justify-between">
                <h4 className="text-xs sm:text-base font-extrabold text-white mb-2 line-clamp-2 leading-snug group-hover:text-brand-accent transition-colors drop-shadow-sm" title={content.title}>
                    {content.title}
                </h4>

                {/* Test Badges and Info */}
                {isTestType(effectiveContentTab, content) && renderTestBadges(content)}

                {/* Action Buttons */}
                {isTestType(effectiveContentTab, content) && (
                    <button
                        onClick={() => openPaperBuilder(content)}
                        className="w-full bg-gradient-to-r from-brand-accent/20 to-amber-500/20 hover:from-brand-accent hover:to-amber-600 border border-brand-accent/40 text-white font-extrabold py-2.5 rounded-xl text-[10px] sm:text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 mb-2 mt-auto active:scale-95 group/btn"
                    >
                        <Trophy size={14} className="text-amber-400 group-hover/btn:scale-110 transition-transform" />
                        Manage Test & Rankings
                    </button>
                )}

                <div className="pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-1.5 mt-auto">
                    <button onClick={() => {
                        let fileUrl = content.fileName ? `${getBaseUrl()}/storage/documents/${content.fileName}` : content.link;
                        setPreviewData({ ...content, link: fileUrl });
                    }} className="flex-1 bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500 hover:text-white py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-sm outline-none text-center">
                        PREVIEW
                    </button>
                    <button onClick={() => {
                        let fileUrl = content.fileName ? `${getBaseUrl()}/storage/documents/${content.fileName}` : content.link;
                        copyToClipboard(fileUrl);
                    }} className="flex-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-sm outline-none flex items-center justify-center gap-1">
                        <Copy size={12} /> COPY
                    </button>

                    {(content.contentType === 'live' || String(content.contentType) === '1') && (
                        <button
                            onClick={() => copyToClipboard(`${window.location.origin}/live/${content.id}`)}
                            title="Link for students: login → payment check → Join Now (Zoom link stays hidden)"
                            className="w-full bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500 hover:text-white py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-sm outline-none flex items-center justify-center gap-1 order-first"
                        >
                            <Link size={12} /> Copy Student Join Link
                        </button>
                    )}

                    {canManageContent && (
                        <div className="flex gap-1">
                            {isSharedContent && unlinkContent && (
                                <button
                                    onClick={() => unlinkContent(content, activeSubject)}
                                    title="Unlink from this class only (keeps in other classes)"
                                    className="bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-white p-2 rounded-lg sm:rounded-xl transition-colors shadow-sm outline-none"
                                >
                                    <Unlink size={16} />
                                </button>
                            )}
                            <button onClick={() => openEditContentModal(content)} className="bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white p-2 rounded-lg sm:rounded-xl transition-colors shadow-sm outline-none" title="Edit Content">
                                <Edit3 size={16} />
                            </button>
                            <button onClick={() => {
                                if (isSharedContent) {
                                    const proceed = window.confirm(
                                        `⚠️ WARNING: "${content.title}" is SHARED across multiple classes or batches!\n\nDeleting here will permanently DELETE it from ALL classes and batches.\n\n💡 If you only want to remove it from this class, click CANCEL and click the yellow Unlink (broken chain) button instead.\n\nDo you really want to permanently delete it everywhere?`
                                    );
                                    if (!proceed) return;
                                }
                                deleteItem('/admin/content/delete', { content_id: content.id }, "Content Deleted");
                            }} className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white p-2 rounded-lg sm:rounded-xl transition-colors shadow-sm outline-none" title={isSharedContent ? "Permanently Delete Everywhere" : "Delete Content"}>
                                <Trash2 size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

return (
    <div className="w-full space-y-8 relative z-10">

        {/* BUSINESSES VIEW */}
        {viewLevel === 'businesses' && (
            businesses?.length === 0 ? <p className="text-center text-gray-400 py-16 bg-white/[0.02] backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-sm text-lg font-bold">No businesses created yet.</p> :
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                    {businesses?.map((biz) => (
                        <div key={biz.id} className="group bg-white/[0.05] backdrop-blur-2xl hover:border-brand-accent/50 border border-white/10 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2rem] flex flex-col gap-4 sm:gap-6 transition-all shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:shadow-lg relative overflow-hidden">

                            {/* Glow Effect */}
                            <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-20 pointer-events-none rounded-full bg-brand-accent transition-opacity group-hover:opacity-40"></div>

                            <div className="flex items-center gap-3 sm:gap-5 relative z-10">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black/20 rounded-xl sm:rounded-2xl flex items-center justify-center p-2.5 sm:p-3 border border-white/10 transition-colors shrink-0 shadow-inner">
                                    <img src={getImageUrl(biz.logo)} onError={(e) => { e.target.src = '/logo.png'; }} alt="Logo" className="max-w-full max-h-full object-contain drop-shadow-md" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-1.5 sm:mb-2 truncate drop-shadow-sm" title={biz.name}>{biz.name}</h3>
                                    <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-blue-500/20 inline-block truncate max-w-full shadow-sm">{biz.category}</span>
                                </div>
                            </div>

                            <div className="bg-black/20 p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-white/5 space-y-2 sm:space-y-3 text-xs sm:text-sm relative z-10 shadow-inner">
                                <div className="flex justify-between items-center"><span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Head Manager</span> <span className="text-white font-extrabold truncate pl-2">{getManagerName(biz.head_manager_id)}</span></div>
                                <div className="flex justify-between items-center"><span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Asst Manager</span> <span className="text-white font-extrabold truncate pl-2">{getManagerName(biz.ass_manager_id)}</span></div>
                            </div>

                            {canManageBusiness && (
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-auto relative z-10">
                                    <button onClick={() => { setEditData(biz); setShowAssignModal(true); }} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-xs sm:text-sm font-bold flex justify-center items-center gap-2 transition-colors border border-white/10 outline-none shadow-sm" title="Assign Managers"><UserPlus size={16} /></button>
                                    <button onClick={() => alert('Payment Route Check:\n\nThis business is currently routing payments to Merchant ID:\n' + (biz.merchantId || 'Default (14008328)'))} className="text-amber-400 bg-amber-500/10 hover:bg-amber-500 hover:text-white p-3 rounded-xl transition-colors border border-transparent hover:border-amber-500/50 outline-none shadow-sm" title="Verify Payment Route"><Link size={18} /></button>
                                    <button onClick={() => { setEditData(biz); setEditMode(true); setSelectedLogoName(""); setShowBusinessModal(true); }} className="text-blue-400 bg-blue-500/10 hover:bg-blue-500 hover:text-white p-3 rounded-xl transition-colors border border-transparent hover:border-blue-500/50 outline-none shadow-sm" title="Edit Business"><Edit3 size={18} /></button>
                                    <button onClick={() => toggleBusinessStatus(biz)} className={"p-3 rounded-xl border transition-colors outline-none shadow-sm " + (biz.status === 1 ? 'text-green-400 bg-green-500/10 border-green-500/20 hover:bg-green-500 hover:text-white' : 'text-gray-400 bg-white/5 border-white/10 hover:bg-white/20 hover:text-white')} title={biz.status === 1 ? "Hide from Students" : "Show to Students"}>{biz.status === 1 ? (<Eye size={18} />) : (<EyeOff size={18} />)}</button>
                                    <button onClick={() => deleteItem('/admin/business/delete', { business_id: biz.id }, "Business Deleted")} className="text-red-400 bg-red-500/10 hover:bg-red-500 hover:text-white p-3 rounded-xl border border-transparent hover:border-red-500/50 transition-colors outline-none shadow-sm" title="Delete Business"><Trash2 size={18} /></button>
                                </div>
                            )}
                            <button onClick={() => openBusinessDetails(biz)} className="w-full bg-brand-accent/90 hover:bg-brand-accent text-white py-3.5 sm:py-4 rounded-xl text-xs sm:text-sm md:text-base font-extrabold flex justify-center items-center gap-2 transition-transform hover:scale-[1.02] shadow-[0_4px_15px_rgba(225,29,72,0.4)] mt-1 outline-none relative z-10 uppercase tracking-wide border border-transparent">Manage Batches <ChevronRight size={18} /></button>
                        </div>
                    ))}
                </div>
        )}

        {/* BATCHES VIEW */}
        {viewLevel === 'batches' && (
            <div className="space-y-4 sm:space-y-6">
                {/* Multi-Business Quick Switcher Bar */}
                {businesses?.length > 1 && (
                    <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 p-3.5 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 sm:p-2.5 bg-brand-accent/10 rounded-xl border border-brand-accent/20 text-brand-accent">
                                <Building2 size={18} className="sm:w-5 sm:h-5" />
                            </div>
                            <div>
                                <div className="text-[10px] sm:text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">Current Business</div>
                                <div className="text-sm sm:text-base font-extrabold text-white">{activeBusiness?.name || "Select Business"}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0 hidden sm:inline">Switch:</label>
                            <select
                                value={activeBusiness?.id || ""}
                                onChange={(e) => {
                                    const selected = businesses.find(b => String(b.id) === String(e.target.value));
                                    if (selected) openBusinessDetails(selected);
                                }}
                                className="w-full sm:w-auto bg-black/60 border border-white/20 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-white font-bold outline-none focus:border-brand-accent cursor-pointer shadow-inner appearance-none transition-all"
                            >
                                {businesses.map((b) => (
                                    <option key={b.id} value={b.id} className="bg-slate-900 text-white font-medium">
                                        {b.name} ({b.category || 'General'})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {batches?.length === 0 ? (
                    <p className="text-center text-gray-400 py-16 bg-white/[0.02] backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-sm text-lg font-bold">
                        No batches available for {activeBusiness?.name || 'this business'} yet.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                        {batches?.map((batch) => (
                            <div key={batch.id} className="group bg-white/[0.05] backdrop-blur-2xl hover:border-brand-accent/50 border border-white/10 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2rem] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 transition-all shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:shadow-lg relative overflow-hidden">

                                <div className="absolute top-0 left-0 w-2.5 sm:w-3 h-full bg-brand-accent opacity-80"></div>

                                <div className="flex items-center gap-3 sm:gap-5 overflow-hidden w-full sm:w-auto pl-2 relative z-10">
                                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-black/20 rounded-xl sm:rounded-2xl flex items-center justify-center p-2.5 sm:p-3 border border-white/10 transition-colors shrink-0 shadow-inner">
                                        <img src={getImageUrl(batch.logo || batch.business?.logo || activeBusiness?.logo)} onError={(e) => { e.target.src = '/logo.png'; }} alt="Logo" className="max-w-full max-h-full object-contain drop-shadow-md" />
                                    </div>
                                    <div className="flex-1 overflow-hidden pr-2">
                                        <h3 className="text-lg sm:text-xl font-extrabold text-white mb-1.5 sm:mb-2 truncate drop-shadow-sm" title={batch.name}>{batch.name}</h3>
                                        <p className="text-[10px] sm:text-[11px] text-brand-accent font-black uppercase tracking-widest bg-brand-accent/10 border border-brand-accent/20 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md inline-block truncate max-w-full shadow-sm">{batch.groups?.length || 0} Groups Assigned</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto mt-2 sm:mt-0 shrink-0 relative z-10">
                                    {canManageBatches && (
                                        <>
                                            <button onClick={() => toggleBatchStatus(batch)} className={"p-3 rounded-xl border transition-colors outline-none shadow-sm " + (batch.status === 1 ? 'text-green-400 bg-green-500/10 border-green-500/20 hover:bg-green-500 hover:text-white' : 'text-gray-400 bg-white/5 border-white/10 hover:bg-white/20 hover:text-white')} title={batch.status === 1 ? "Hide from Students" : "Show to Students"}>{batch.status === 1 ? (<Eye size={18} />) : (<EyeOff size={18} />)}</button>
                                            <button onClick={() => { setEditData(batch); setEditMode(true); setSelectedLogoName(""); setShowBatchModal(true); }} className="text-blue-400 bg-blue-500/10 border border-transparent hover:border-blue-500/50 hover:bg-blue-500 hover:text-white p-3 rounded-xl transition-colors outline-none shadow-sm"><Edit3 size={18} /></button>
                                            <button onClick={() => deleteItem('/admin/batch/delete', { batch_id: batch.id }, "Batch Deleted")} className="text-red-400 bg-red-500/10 border border-transparent hover:border-red-500/50 hover:bg-red-500 hover:text-white p-3 rounded-xl transition-colors outline-none shadow-sm"><Trash2 size={18} /></button>
                                        </>
                                    )}
                                    <button onClick={() => openBatchDetails(batch)} className="flex-1 sm:flex-none bg-brand-accent/90 hover:bg-brand-accent text-white px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl text-xs sm:text-sm font-extrabold flex justify-center items-center gap-2 transition-transform hover:scale-[1.02] sm:ml-2 shadow-[0_4px_15px_rgba(225,29,72,0.4)] outline-none uppercase tracking-wide border border-transparent">{isPaperMarkerOrGuider ? 'View Subjects' : 'Manage'} <ChevronRight size={18} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* BATCH DETAILS VIEW */}
        {viewLevel === 'batch_details' && (
            <div className="flex flex-col h-full animate-fade-in relative z-10">

                {/* TABS (Mobile Horizontal Scrollable) */}
                {!isPaperMarkerOrGuider && (
                    <div className="flex overflow-x-auto custom-scrollbar gap-2 md:gap-3 mb-6 md:mb-8 bg-white/[0.05] backdrop-blur-2xl p-2 sm:p-2.5 rounded-2xl sm:rounded-[1.5rem] w-full md:w-max border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.2)] shrink-0 whitespace-nowrap">
                        <button onClick={() => setBatchTab('groups')} className={`px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-extrabold text-xs md:text-sm uppercase tracking-wide flex items-center gap-2 transition-all outline-none border border-transparent shrink-0 ${effectiveBatchTab === 'groups' ? 'bg-brand-accent/90 text-white shadow-[0_4px_15px_rgba(225,29,72,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}><Layers size={16} className="sm:w-4 sm:h-4" /> Groups</button>
                        <button onClick={() => setBatchTab('subjects')} className={`px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-extrabold text-xs md:text-sm uppercase tracking-wide flex items-center gap-2 transition-all outline-none border border-transparent shrink-0 ${effectiveBatchTab === 'subjects' ? 'bg-brand-accent/90 text-white shadow-[0_4px_15px_rgba(225,29,72,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}><BookOpen size={16} className="sm:w-4 sm:h-4" /> Subjects</button>
                        <button onClick={() => setBatchTab('upgrade-pricing')} className={`px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-extrabold text-xs md:text-sm uppercase tracking-wide flex items-center gap-2 transition-all outline-none border border-transparent shrink-0 ${effectiveBatchTab === 'upgrade-pricing' ? 'bg-brand-accent/90 text-white shadow-[0_4px_15px_rgba(225,29,72,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}><TrendingUp size={16} className="sm:w-4 sm:h-4" /> Upgrade Prices</button>
                    </div>
                )}

                {/* CLASS MODE SWITCHER BAR (Theory Class / Paper Class) - Available for both Groups and Subjects */}
                {(() => {
                    // Always allow both Theory and Paper Class options for all batches
                    const showTheoryTab = true;
                    const showPaperTab = true;
                    const theoryGroupsCount = (activeBatch?.groups || []).filter(g => parseInt(g.classType || 1, 10) === 1).length;
                    const paperGroupsCount = (activeBatch?.groups || []).filter(g => parseInt(g.classType || 1, 10) === 2).length;

                    if ((effectiveBatchTab === 'groups' || effectiveBatchTab === 'subjects')) {
                        return (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-3 sm:p-4 rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.25)] mb-6">
                                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                    <span className="text-xs font-black uppercase tracking-wider text-gray-400 pl-1 hidden sm:inline-block">Class Stream:</span>
                                    <div className="inline-flex p-1.5 rounded-xl bg-black/40 border border-white/10 gap-1.5 w-full sm:w-auto">
                                        {showTheoryTab && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedClassType('theory')}
                                                className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 rounded-lg font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all outline-none ${selectedClassType === 'theory'
                                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_4px_15px_rgba(37,99,235,0.4)] border border-blue-400/40'
                                                        : 'text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
                                                    }`}
                                            >
                                                <BookOpen size={16} className={selectedClassType === 'theory' ? 'text-blue-200' : ''} />
                                                <span>Theory Class</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${selectedClassType === 'theory' ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
                                                    }`}>
                                                    {effectiveBatchTab === 'groups' ? `${theoryGroupsCount} Groups` : `${theoryCount} Subjects`}
                                                </span>
                                            </button>
                                        )}
                                        {showPaperTab && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedClassType('paper')}
                                                className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 rounded-lg font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all outline-none ${selectedClassType === 'paper'
                                                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_4px_15px_rgba(245,158,11,0.4)] border border-amber-400/40'
                                                        : 'text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
                                                    }`}
                                            >
                                                <FileSignature size={16} className={selectedClassType === 'paper' ? 'text-amber-200' : ''} />
                                                <span>Paper Class</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${selectedClassType === 'paper' ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
                                                    }`}>
                                                    {effectiveBatchTab === 'groups' ? `${paperGroupsCount} Groups` : `${paperCount} Subjects`}
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-gray-400 justify-end pr-1">
                                    <span className="hidden sm:inline">Active Mode:</span>
                                    <span className={`font-extrabold uppercase px-3 py-1.5 rounded-lg text-[11px] shadow-sm flex items-center gap-1.5 ${selectedClassType === 'paper'
                                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                            : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                        }`}>
                                        {selectedClassType === 'paper' ? <FileSignature size={13} /> : <BookOpen size={13} />}
                                        {selectedClassType === 'paper' ? 'Paper Class View' : 'Theory Class View'}
                                    </span>
                                </div>
                            </div>
                        );
                    }
                    return null;
                })()}

                <div className="space-y-6">

                    {/* GROUPS TAB */}
                    {effectiveBatchTab === 'groups' && (() => {
                        const targetClass = selectedClassType === 'paper' ? 2 : 1;
                        const currentGroups = (activeBatch?.groups || []).filter(g => parseInt(g.classType || 1, 10) === targetClass);

                        if (currentGroups.length === 0) {
                            return (
                                <div className="text-center py-16 bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-white/10 shadow-sm flex flex-col items-center justify-center gap-4">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-inner ${selectedClassType === 'paper' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                        }`}>
                                        {selectedClassType === 'paper' ? <FileSignature size={32} /> : <BookOpen size={32} />}
                                    </div>
                                    <div>
                                        <p className="text-white text-lg font-extrabold">
                                            No {selectedClassType === 'paper' ? 'Paper Class' : 'Theory Class'} Payment Groups Created Yet
                                        </p>
                                        <p className="text-gray-400 text-sm max-w-md mt-1">
                                            Create payment plans and bundle discount rules for this {selectedClassType === 'paper' ? 'Paper Class' : 'Theory Class'} stream.
                                        </p>
                                    </div>
                                    {canManageGroupsAndSubjects && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditData(null);
                                                setEditMode(false);
                                                setShowGroupModal(true);
                                                setDiscountRules([{ courseCount: '', packagePrice: '', pricePerCourse: '', fixedDiscount: '' }]);
                                            }}
                                            className={`mt-2 ${selectedClassType === 'paper' ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-[0_4px_15px_rgba(245,158,11,0.4)]' : 'bg-brand-accent/90 hover:bg-brand-accent shadow-[0_4px_15px_rgba(225,29,72,0.4)]'} text-white px-6 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all outline-none border border-transparent hover:scale-105`}
                                        >
                                            <Plus size={16} /> Create First {selectedClassType === 'paper' ? 'Paper' : 'Theory'} Group
                                        </button>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {currentGroups.map((group) => {
                                    const isMonthly = group.type === 1;
                                    return (
                                        <div key={group.id} className={`group bg-gradient-to-br from-white/[0.05] to-transparent backdrop-blur-3xl border border-white/10 p-6 md:p-8 rounded-[2rem] flex flex-col justify-between gap-6 transition-all duration-500 hover:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] hover:-translate-y-2 relative overflow-hidden ${isMonthly ? 'hover:border-blue-500/50' : 'hover:border-brand-accent/50'}`}>
                                            {/* Background Subtle Gradient Glow */}
                                            <div className={`absolute -top-32 -right-32 w-64 h-64 rounded-full blur-[100px] opacity-20 pointer-events-none transition-opacity duration-500 group-hover:opacity-60 ${isMonthly ? 'bg-blue-500' : 'bg-brand-accent'}`}></div>

                                            <div className="flex justify-between items-start relative z-10">
                                                <div className="overflow-hidden pr-4">
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <div className={`p-3 rounded-2xl shadow-inner border ${isMonthly ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-brand-accent/20 text-brand-accent border-brand-accent/30'}`}>
                                                            <Layers size={24} />
                                                        </div>
                                                        <h3 className="text-2xl md:text-3xl font-black text-white truncate drop-shadow-md tracking-tight" title={group.name}>{group.name}</h3>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-lg border ${isMonthly ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-brand-accent/20 text-brand-accent border-brand-accent/30'}`}>
                                                            {isMonthly ? 'Monthly Payment' : 'Full Payment'}
                                                        </span>
                                                        <span className={`text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${parseInt(group.classType || 1, 10) === 2 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                                                            {parseInt(group.classType || 1, 10) === 2 ? '📝 Paper Class' : '📘 Theory Class'}
                                                        </span>
                                                    </div>
                                                </div>
                                                {canManageGroupsAndSubjects && (
                                                    <div className="flex flex-col sm:flex-row gap-2 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => { setEditData(group); setEditMode(true); setDiscountRules(group.discount_rules ? JSON.parse(group.discount_rules) : []); setShowGroupModal(true); }} className="text-gray-400 bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-blue-500/20 hover:text-blue-400 p-2.5 rounded-xl transition-all outline-none shadow-sm flex items-center justify-center"><Edit3 size={18} /></button>
                                                        <button onClick={() => deleteItem('/course-setup/group', { group_id: group.id }, "Group Deleted")} className="text-gray-400 bg-white/5 border border-white/10 hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-400 p-2.5 rounded-xl transition-all outline-none shadow-sm flex items-center justify-center"><Trash2 size={18} /></button>
                                                    </div>
                                                )}
                                            </div>

                                            {group.discount_rules && JSON.parse(group.discount_rules).length > 0 && (
                                                <div className="pt-5 border-t border-white/10 relative z-10 mt-auto">
                                                    <p className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest mb-3">Active Bundle Discounts</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {JSON.parse(group.discount_rules).map((rule, ridx) => {
                                                            const hasPackage = rule.packagePrice && parseFloat(rule.packagePrice) > 0;
                                                            const hasFixed = rule.fixedDiscount && parseFloat(rule.fixedDiscount) > 0;
                                                            let displayTxt = '';
                                                            if (hasPackage) {
                                                                displayTxt = 'Total Rs ' + Number(rule.packagePrice).toLocaleString();
                                                            } else if (hasFixed) {
                                                                displayTxt = 'Get Rs ' + Number(rule.fixedDiscount).toLocaleString() + ' Off';
                                                            } else {
                                                                displayTxt = '@ Rs ' + Number(rule.pricePerCourse).toLocaleString() + ' / ea';
                                                            }
                                                            return (
                                                                <span key={ridx} className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 px-3 py-2 rounded-xl border border-emerald-500/20 shadow-sm">
                                                                    <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md">Buy {rule.courseCount}+</span> {displayTxt}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        );
                    })()}



                    {/* SUBJECTS TAB */}
                    {effectiveBatchTab === 'subjects' && (() => {
                        return (
                            <div className="space-y-6">

                                {Object.keys(groupedSubjects).length === 0 ? (
                                    <div className="text-center py-16 bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-white/10 shadow-sm flex flex-col items-center justify-center gap-4">
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-inner ${selectedClassType === 'paper' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                            }`}>
                                            {selectedClassType === 'paper' ? <FileSignature size={32} /> : <BookOpen size={32} />}
                                        </div>
                                        <div>
                                            <p className="text-white text-lg font-extrabold">
                                                No {selectedClassType === 'paper' ? 'Paper Class' : 'Theory Class'} Subjects Created Yet
                                            </p>
                                            <p className="text-gray-400 text-sm max-w-md mt-1">
                                                Add subjects and assign them to payment groups for this {selectedClassType === 'paper' ? 'Paper Class' : 'Theory Class'} stream.
                                            </p>
                                        </div>
                                        {canManageGroupsAndSubjects && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditData(null);
                                                    setEditMode(false);
                                                    setSelectedGroupPrices({});
                                                    setShowCourseModal(true);
                                                }}
                                                className={`mt-2 ${selectedClassType === 'paper' ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-[0_4px_15px_rgba(245,158,11,0.4)]' : 'bg-brand-accent/90 hover:bg-brand-accent shadow-[0_4px_15px_rgba(225,29,72,0.4)]'} text-white px-6 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all outline-none border border-transparent hover:scale-105`}
                                            >
                                                <Plus size={16} /> Create First {selectedClassType === 'paper' ? 'Paper' : 'Theory'} Subject
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        {Object.keys(groupedSubjects).map((streamName, idx) => (
                                            <div key={idx} className="bg-black/20 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-white/5 shadow-inner">
                                                {(activeBusiness?.category === 'Advance Level' || activeBusiness?.category === 'AL') && (
                                                    <h3 className="text-lg font-extrabold text-brand-accent mb-6 flex items-center gap-3 uppercase tracking-widest drop-shadow-sm"><Layers size={24} /> {streamName} Stream</h3>
                                                )}
                                                <div className="grid grid-cols-1 gap-5">
                                                    {groupedSubjects[streamName].map((sub) => {
                                                        let courseImage = null;
                                                        try { if (sub.groupPrices && sub.groupPrices.length > 0 && sub.groupPrices[0].lecturerImage) { courseImage = sub.groupPrices[0].lecturerImage; } } catch (e) { }

                                                        return (
                                                            <div key={sub.id} className="bg-white/[0.05] hover:border-brand-accent/40 border border-white/10 p-6 rounded-2xl flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 transition-all shadow-sm hover:shadow-md overflow-hidden group backdrop-blur-md">

                                                                <div className="flex items-center gap-4 w-full xl:w-auto overflow-hidden">
                                                                    {canManageGroupsAndSubjects && <div className="cursor-move text-slate-600 group-hover:text-brand-accent transition-colors shrink-0 hidden sm:block"><GripVertical size={24} /></div>}

                                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-5 w-full">
                                                                        {courseImage ? (
                                                                            <img src={getImageUrl(courseImage)} alt="Lecturer" className="w-16 h-16 rounded-full object-cover border-2 border-white/10 shrink-0 shadow-sm" />
                                                                        ) : (
                                                                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shrink-0 shadow-sm">
                                                                                <User size={28} className="text-slate-500" />
                                                                            </div>
                                                                        )}

                                                                        <div className="flex flex-col overflow-hidden w-full">
                                                                            <div className="flex flex-wrap items-center gap-2.5 mb-1">
                                                                                <h3 className="text-lg font-extrabold text-white truncate max-w-full xl:max-w-[400px] drop-shadow-sm" title={sub.name}>{sub.name}</h3>
                                                                                {sub.code && <span className="text-[10px] font-black uppercase tracking-widest text-brand-accent bg-brand-accent/10 px-2.5 py-1 rounded-md border border-brand-accent/20 shrink-0 w-max shadow-sm">{sub.code}</span>}
                                                                                {parseInt(sub.courseType || 1) === 2 ? (
                                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1">
                                                                                        <FileSignature size={11} /> Paper Class
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-300 bg-blue-500/15 border border-blue-500/30 px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1">
                                                                                        <BookOpen size={11} /> Theory Class
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            {sub.lecturerName && <span className="text-sm font-bold text-gray-400 mb-1">{sub.lecturerName}</span>}

                                                                            <div className="flex flex-wrap gap-2 mt-2">
                                                                                {sub.activeMonths && (
                                                                                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 flex items-center gap-1.5 shadow-sm backdrop-blur-sm">
                                                                                        <Calendar size={12} className="text-emerald-400 shrink-0" />
                                                                                        Active: {sub.activeMonths} {sub.activeMonths === 1 ? 'Month' : 'Months'}
                                                                                        {sub.startMonth && sub.endMonth && (
                                                                                            <span className="text-slate-400 lowercase font-extrabold"> ({sub.startMonth} - {sub.endMonth})</span>
                                                                                        )}
                                                                                    </span>
                                                                                )}
                                                                                {sub.groupPrices.map((gp, i) => (
                                                                                    <span key={i} className="text-[11px] font-bold text-slate-300 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2 whitespace-nowrap shadow-sm backdrop-blur-sm">
                                                                                        {gp.groupName}: <span className="text-brand-accent font-black">Rs {gp.price}</span>
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-wrap sm:flex-nowrap gap-3 items-center w-full xl:w-auto justify-end mt-4 xl:mt-0 shrink-0 border-t xl:border-none border-white/5 pt-5 xl:pt-0">
                                                                    <button onClick={() => openContentsView(sub)} className="flex-1 sm:flex-none bg-green-600/90 hover:bg-green-500 text-white px-6 py-3.5 rounded-xl text-sm font-extrabold uppercase tracking-wide flex justify-center items-center gap-2 transition-transform hover:scale-[1.02] shadow-[0_4px_15px_rgba(22,163,74,0.4)] border border-transparent outline-none"><MonitorPlay size={18} /> Manage Content</button>
                                                                    {canManageGroupsAndSubjects && (
                                                                        <>
                                                                            <button onClick={() => {
                                                                                setEditData(sub); setEditMode(true);
                                                                                const gPrices = {};
                                                                                sub.groupPrices.forEach(p => {
                                                                                    let parsedTutes = p.tutes || [];
                                                                                    if (parsedTutes.length === 0 && p.tuteName) {
                                                                                        parsedTutes = [{ name: p.tuteName, cover: p.tuteCover || null }];
                                                                                    }
                                                                                    gPrices[p.groupId] = {
                                                                                        price: p.price, deliverTute: p.deliverTute === true || p.deliverTute === 'true',
                                                                                        tuteName: p.tuteName || '', tuteCover: p.tuteCover || null, tuteFile: null,
                                                                                        tutes: parsedTutes
                                                                                    };
                                                                                });
                                                                                setSelectedGroupPrices(gPrices); setShowCourseModal(true);
                                                                            }} className="text-blue-400 bg-blue-500/10 hover:bg-blue-500 hover:text-white border border-transparent hover:border-blue-500/50 p-3.5 rounded-xl transition-colors outline-none shadow-sm"><Edit3 size={18} /></button>
                                                                            <button onClick={() => deleteItem('/admin/course/delete', { course_id: sub.id }, "Subject Deleted")} className="text-red-400 bg-red-500/10 hover:bg-red-500 hover:text-white border border-transparent hover:border-red-500/50 p-3.5 rounded-xl transition-colors outline-none shadow-sm"><Trash2 size={18} /></button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* UPGRADE PRICING TAB */}
                    {effectiveBatchTab === 'upgrade-pricing' && (
                        <UpgradePricingConfig activeBatch={activeBatch} uniqueSubjects={uniqueSubjects} />
                    )}
                </div>
            </div>
        )}

        {/* CONTENTS VIEW */}
        {viewLevel === 'contents' && (
            <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl sm:rounded-[2rem] flex flex-col min-h-[500px] sm:min-h-[600px] overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] relative z-10">

                {/* Content Tabs Header */}
                <div className="flex overflow-x-auto custom-scrollbar border-b border-white/10 bg-black/20 p-2.5 sm:p-4 gap-2 sm:gap-3 shrink-0">
                    {(isPaperMarkerOrGuider
                        ? [{ id: 'testRanking', label: 'Test Ranking', icon: Trophy }]
                        : [{ id: 'recording', label: 'Recordings', icon: MonitorPlay }, { id: 'live', label: 'Live Classes', icon: Video },
                        { id: 'document', label: 'Documents', icon: FileText }, { id: 'testRanking', label: 'Test Ranking', icon: Trophy }
                        ]
                    ).map(tab => (
                        <button key={tab.id} onClick={() => setContentTab(tab.id)} className={`flex items-center gap-2 sm:gap-3 px-3.5 sm:px-6 py-2.5 sm:py-3.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap uppercase tracking-wider outline-none border border-transparent shrink-0 ${effectiveContentTab === tab.id ? 'bg-brand-accent/90 text-white shadow-[0_4px_15px_rgba(225,29,72,0.4)]' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border-white/10'}`}>
                            <tab.icon size={16} className="sm:w-[18px] sm:h-[18px]" /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* 🔥 STATS WIDGET: Display content allocation counts by Payment Group */}
                {!isPaperMarkerOrGuider && (
                    <div className="bg-black/30 border-b border-white/5 p-3 sm:p-4 flex flex-wrap gap-2 sm:gap-4 items-center text-xs">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1 flex items-center gap-1.5"><Layers size={13} className="text-brand-accent" /> Allocation Stats:</span>
                        {activeSubject?.groupPrices?.map((gp, idx) => {
                            const count = subjectContents.filter(c => isMatchedType(c) && c.assignedCourses && c.assignedCourses.includes(gp.courseId)).length;
                            const isMonthly = gp.groupType === 1;
                            return (
                                <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg sm:rounded-xl border shadow-inner ${isMonthly ? 'bg-blue-500/10 border-blue-500/20' : 'bg-brand-accent/10 border-brand-accent/20'}`}>
                                    <span className="text-[10px] sm:text-xs font-bold text-slate-300 uppercase">{gp.groupName}</span>
                                    <span className={`text-xs font-black px-1.5 py-0.5 rounded-md ${isMonthly ? 'bg-blue-500/20 text-blue-400' : 'bg-brand-accent/20 text-brand-accent'}`}>{count}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="p-3.5 sm:p-6 md:p-8 space-y-6 sm:space-y-10 overflow-y-auto custom-scrollbar">

                    {/* ORGANIZED FOLDERS */}
                    {(() => {
                        const rawRootFolders = (lessonGroups || []).filter(g => isMatchedType(g) && (!g.parentId || !(lessonGroups || []).some(p => String(p.id) === String(g.parentId))));
                        const mergedRootFoldersMap = new Map();
                        rawRootFolders.forEach(f => {
                            const titleKey = normalizeFolderTitle(f.title || f.name) || (f.title || f.name || '').trim().toLowerCase();
                            if (!mergedRootFoldersMap.has(titleKey)) {
                                mergedRootFoldersMap.set(titleKey, { ...f, ids: [String(f.id), ...(f.allIds ? f.allIds.map(String) : [])] });
                            } else {
                                const existing = mergedRootFoldersMap.get(titleKey);
                                const toAdd = [String(f.id), ...(f.allIds ? f.allIds.map(String) : [])];
                                toAdd.forEach(id => {
                                    if (!existing.ids.includes(id)) existing.ids.push(id);
                                });
                            }
                        });
                        const organizedRootFolders = Array.from(mergedRootFoldersMap.values()).sort(byOrder);

                        if (organizedRootFolders.length === 0) return null;

                        return (
                            <div className="space-y-4 sm:space-y-6">
                                <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest pl-1 sm:pl-2 drop-shadow-sm">Organized Folders</h4>

                                {organizedRootFolders.map((folder, folderIndex) => {
                                    const rawSubFolders = (lessonGroups || []).filter(g => isMatchedType(g) && g.parentId && folder.ids.includes(String(g.parentId)));
                                    const mergedSubMap = new Map();
                                    rawSubFolders.forEach(sf => {
                                        const subTitleKey = normalizeFolderTitle(sf.title || sf.name) || (sf.title || sf.name || '').trim().toLowerCase();
                                        if (!mergedSubMap.has(subTitleKey)) {
                                            mergedSubMap.set(subTitleKey, { ...sf, ids: [String(sf.id), ...(sf.allIds ? sf.allIds.map(String) : [])] });
                                        } else {
                                            const existing = mergedSubMap.get(subTitleKey);
                                            const toAdd = [String(sf.id), ...(sf.allIds ? sf.allIds.map(String) : [])];
                                            toAdd.forEach(id => {
                                                if (!existing.ids.includes(id)) existing.ids.push(id);
                                            });
                                        }
                                    });
                                    const subFolders = Array.from(mergedSubMap.values()).sort(byOrder);

                                    const isItemMatch = (c, fObj) => {
                                        const cFolderId = c.content_group_id ?? c.contentGroupId ?? c.folder_id;
                                        if (cFolderId) {
                                            const isDirectMatch = (fObj.ids && fObj.ids.includes(String(cFolderId))) ||
                                                (fObj.allIds && fObj.allIds.some(id => String(id) === String(cFolderId))) ||
                                                String(cFolderId) === String(fObj.id);
                                            if (isDirectMatch) return true;
                                            const folderExists = (lessonGroups || []).some(g => String(g.id) === String(cFolderId) || (g.allIds && g.allIds.some(id => String(id) === String(cFolderId))));
                                            if (folderExists) return false;
                                        }
                                        return isItemInFolder(c, fObj);
                                    };

                                    const directContents = subjectContents.filter(c =>
                                        isMatchedType(c) &&
                                        isItemMatch(c, folder) &&
                                        !subFolders.some(sf => isItemMatch(c, sf))
                                    );

                                    return (
                                        <div key={folder.id} className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-[2rem] overflow-hidden transition-all shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                                            <div className="flex flex-wrap justify-between items-center cursor-pointer p-3.5 sm:p-5 bg-white/[0.05] hover:bg-white/10 transition-colors gap-3" onClick={() => toggleFolder(folder.id)}>
                                                <div className="flex items-center gap-2.5 sm:gap-4 overflow-hidden">
                                                    <div className={`p-2.5 sm:p-3 rounded-xl transition-colors shadow-sm shrink-0 ${openFolders[folder.id] ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/30' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                                                        <FolderOpen size={20} className="sm:w-6 sm:h-6" />
                                                    </div>
                                                    <h4 className={`text-sm sm:text-lg font-extrabold transition-colors truncate max-w-[130px] sm:max-w-[300px] md:max-w-[400px] drop-shadow-sm ${openFolders[folder.id] ? 'text-brand-accent' : 'text-slate-200'}`} title={folder.title || folder.name}>{folder.title || folder.name}</h4>
                                                    <ChevronDown size={18} className={`text-gray-400 transition-transform shrink-0 ${openFolders[folder.id] ? 'rotate-180 text-brand-accent' : ''}`} />
                                                </div>
                                                <div className="flex gap-1.5 sm:gap-2 items-center shrink-0">
                                                    {canManageContent && (
                                                        <>
                                                            <button onClick={(e) => { e.stopPropagation(); openCreateSubFolderModal(folder); }} className="bg-indigo-600/90 hover:bg-indigo-500 text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs uppercase tracking-wider font-extrabold flex items-center gap-1.5 transition-colors shadow-[0_4px_15px_rgba(99,102,241,0.4)] border border-transparent outline-none" title="Create Sub-folder inside this folder"><FolderPlus size={14} /> <span className="hidden xs:inline">+ Sub-folder</span></button>
                                                            <button onClick={(e) => {
                                                                e.stopPropagation();
                                                                setContentType(contentTab);
                                                                setPrefilledFolder(String(folder.id));
                                                                setSelectedBatchesForContent([activeBatch.id]);
                                                                setMassAssignSubjects(activeSubject?.allCourseIds || [activeSubject.id]);
                                                                if (setHubBatchConfigs) setHubBatchConfigs({});
                                                                if (setHubActiveBatchTab) setHubActiveBatchTab(activeBatch?.id || null);
                                                                setShowContentModal(true);
                                                                setEditMode(false);
                                                            }} className="bg-green-600/90 hover:bg-green-500 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs uppercase tracking-wider font-extrabold flex items-center gap-1.5 transition-colors shadow-[0_4px_15px_rgba(22,163,74,0.4)] border border-transparent outline-none"><Plus size={14} /> <span className="hidden xs:inline">Add Content</span></button>
                                                            {orderButtons(organizedRootFolders, folderIndex, false)}
                                                            <button onClick={(e) => { e.stopPropagation(); setEditData(folder); setSelectedFolderParentId(folder.parentId ? String(folder.parentId) : ''); setEditMode(true); setShowLessonGroupModal(true); }} className="text-blue-400 hover:bg-blue-500 hover:text-white bg-blue-500/10 border border-transparent hover:border-blue-500/50 p-2 sm:p-2.5 rounded-xl transition-colors outline-none shadow-sm"><Edit3 size={16} /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); deleteItem('/admin/content-group/delete', { contentGroupId: folder.id }, "Folder Deleted"); }} className="text-red-400 hover:bg-red-500 hover:text-white bg-red-500/10 border border-transparent hover:border-red-500/50 p-2 sm:p-2.5 rounded-xl transition-colors outline-none shadow-sm"><Trash2 size={16} /></button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {openFolders[folder.id] && (
                                                <div className="border-t border-white/10 bg-black/20 p-3.5 sm:p-6 md:p-8 space-y-6 shadow-inner">

                                                    {/* NESTED SUB-FOLDERS */}
                                                    {subFolders.length > 0 && (
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <h5 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                                                    <Folder size={14} /> Sub-folders ({subFolders.length})
                                                                </h5>
                                                                {canManageContent && (
                                                                    <button onClick={() => openCreateSubFolderModal(folder)} className="text-indigo-400 hover:text-indigo-300 text-xs font-bold flex items-center gap-1">
                                                                        <Plus size={12} /> Add Sub-folder
                                                                    </button>
                                                                )}
                                                            </div>

                                                            <div className="space-y-3 pl-2 sm:pl-4 border-l-2 border-indigo-500/30">
                                                                {subFolders.map((subFolder, subIndex) => {
                                                                    const subContents = subjectContents.filter(c => isMatchedType(c) && isItemMatch(c, subFolder));

                                                                    return (
                                                                        <div key={subFolder.id} className="bg-white/[0.03] border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden transition-all">
                                                                            <div className="flex flex-wrap justify-between items-center cursor-pointer p-3 sm:p-4 bg-white/[0.04] hover:bg-white/[0.08] transition-colors gap-2" onClick={() => toggleFolder(subFolder.id)}>
                                                                                <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                                                                                    <div className={`p-2 rounded-lg transition-colors shrink-0 ${openFolders[subFolder.id] ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/40' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                                                                                        <FolderOpen size={16} />
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2 truncate">
                                                                                        <h5 className={`text-xs sm:text-sm font-bold truncate ${openFolders[subFolder.id] ? 'text-indigo-300' : 'text-slate-300'}`} title={subFolder.title || subFolder.name}>{subFolder.title || subFolder.name}</h5>
                                                                                        <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/30 shrink-0">Sub-folder</span>
                                                                                    </div>
                                                                                    <ChevronDown size={14} className={`text-gray-400 transition-transform shrink-0 ${openFolders[subFolder.id] ? 'rotate-180 text-indigo-400' : ''}`} />
                                                                                </div>
                                                                                <div className="flex gap-1.5 items-center shrink-0">
                                                                                    {canManageContent && (
                                                                                        <>
                                                                                            <button onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                setContentType(contentTab);
                                                                                                setPrefilledFolder(String(subFolder.id));
                                                                                                setSelectedBatchesForContent([activeBatch.id]);
                                                                                                setMassAssignSubjects(activeSubject?.allCourseIds || [activeSubject.id]);
                                                                                                if (setHubBatchConfigs) setHubBatchConfigs({});
                                                                                                if (setHubActiveBatchTab) setHubActiveBatchTab(activeBatch?.id || null);
                                                                                                setShowContentModal(true);
                                                                                                setEditMode(false);
                                                                                            }} className="bg-green-600/90 hover:bg-green-500 text-white px-2.5 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-extrabold flex items-center gap-1 transition-colors shadow-sm border border-transparent outline-none"><Plus size={12} /> Add Content</button>
                                                                                            {orderButtons(subFolders, subIndex, true)}
                                                                                            <button onClick={(e) => { e.stopPropagation(); setEditData(subFolder); setSelectedFolderParentId(subFolder.parentId ? String(subFolder.parentId) : ''); setEditMode(true); setShowLessonGroupModal(true); }} className="text-blue-400 hover:bg-blue-500 hover:text-white bg-blue-500/10 p-1.5 rounded-lg transition-colors outline-none shadow-sm"><Edit3 size={14} /></button>
                                                                                            <button onClick={(e) => { e.stopPropagation(); deleteItem('/admin/content-group/delete', { contentGroupId: subFolder.id }, "Sub-folder Deleted"); }} className="text-red-400 hover:bg-red-500 hover:text-white bg-red-500/10 p-1.5 rounded-lg transition-colors outline-none shadow-sm"><Trash2 size={14} /></button>
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            {openFolders[subFolder.id] && (
                                                                                <div className="border-t border-white/10 bg-black/40 p-3 sm:p-5 shadow-inner">
                                                                                    {subContents.length > 0 ? (
                                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                                                                                            {subContents.sort((a, b) => (a.itemOrder || 1) - (b.itemOrder || 1)).map(renderContentCard)}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <p className="text-xs text-gray-400 py-4 text-center font-bold bg-white/5 rounded-xl border border-white/10">This sub-folder is empty.</p>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* DIRECT MAIN FOLDER CONTENTS */}
                                                    {directContents.length > 0 && (
                                                        <div className="space-y-3">
                                                            {subFolders.length > 0 && (
                                                                <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                                    <Layers size={14} /> Main Folder Items ({directContents.length})
                                                                </h5>
                                                            )}
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-6">
                                                                {directContents.sort((a, b) => (a.itemOrder || 1) - (b.itemOrder || 1)).map(renderContentCard)}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {subFolders.length === 0 && directContents.length === 0 && (
                                                        <div className="py-8 text-center bg-white/5 rounded-2xl border border-white/10 space-y-3">
                                                            <p className="text-xs sm:text-sm text-gray-400 font-bold">This folder is empty.</p>
                                                            {canManageContent && (
                                                                <div className="flex justify-center gap-3">
                                                                    <button onClick={() => openCreateSubFolderModal(folder)} className="bg-indigo-600/80 hover:bg-indigo-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"><FolderPlus size={14} /> Create Sub-folder</button>
                                                                    <button onClick={() => {
                                                                        setContentType(contentTab);
                                                                        setPrefilledFolder(String(folder.id));
                                                                        setSelectedBatchesForContent([activeBatch.id]);
                                                                        setMassAssignSubjects(activeSubject?.allCourseIds || [activeSubject.id]);
                                                                        if (setHubBatchConfigs) setHubBatchConfigs({});
                                                                        if (setHubActiveBatchTab) setHubActiveBatchTab(activeBatch?.id || null);
                                                                        setShowContentModal(true);
                                                                        setEditMode(false);
                                                                    }} className="bg-green-600/80 hover:bg-green-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"><Plus size={14} /> Add Content</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {/* UNCATEGORIZED ITEMS */}
                    <div className="mt-8 sm:mt-12">
                        <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3 sm:mb-4 pl-1 sm:pl-2 drop-shadow-sm">Uncategorized Items</h4>
                        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-[2rem] p-3.5 sm:p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-6">
                                {subjectContents
                                    .filter(c => isMatchedType(c) && isUncategorized(c))
                                    .sort((a, b) => (a.itemOrder || 1) - (b.itemOrder || 1))
                                    .map(renderContentCard)}
                            </div>
                            {subjectContents.filter(c => isMatchedType(c) && isUncategorized(c)).length === 0 && <p className="text-xs sm:text-sm text-gray-400 py-6 text-center font-bold bg-white/5 rounded-2xl border border-white/10 shadow-inner">No uncategorized items.</p>}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
);
}