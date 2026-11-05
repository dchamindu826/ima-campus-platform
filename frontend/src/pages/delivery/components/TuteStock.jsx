import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Download, Edit2, Trash2, Box, X, Loader2, Check, BarChart3, ChevronRight, BookOpen, Plus, FileText, ArrowLeft, Users, CreditCard, Edit3, Search, Layers } from 'lucide-react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';

const LiveTuteImage = ({ stock, masterData }) => {
    const [imgSrc, setImgSrc] = useState(null);
    const [errorStage, setErrorStage] = useState(0);

    useEffect(() => {
        let coverName = null;
        let actualTuteName = stock.tuteName?.replace(/\[.*?\]/g, '').trim();

        // 1. Get mapping from groupPrices
        if (stock.course?.groupPrices && stock.course?.groupId) {
            try {
                const gp = JSON.parse(stock.course.groupPrices);
                const match = gp.find(g => parseInt(g.groupId) === parseInt(stock.course.groupId));
                if (match) {
                    if (match.tuteName) {
                        actualTuteName = match.tuteName; 
                    }
                    if (match.tuteCover && match.tuteCover !== 'default-tute.png' && match.tuteCover !== 'null') {
                        coverName = match.tuteCover;
                    }
                }
            } catch(e) {}
        }

        // 2. Resolve against MasterTutes using mapped name
        if (masterData && stock.course?.lecturerName) {
            const lec = masterData.find(l => l.name === stock.course.lecturerName);
            if (lec) {
                const tData = lec.tutes?.find(t => t.name === actualTuteName || t.name === stock.tuteName);
                if (tData && tData.image) {
                    coverName = tData.image;
                }
            }
        }

        // 3. Overwrite with TuteStock's own image if explicitly set (Highest priority, just like Deliveries)
        if (stock.tuteImage && stock.tuteImage !== 'default-tute.png' && stock.tuteImage !== 'null') {
            coverName = stock.tuteImage;
        }

        if (!coverName || coverName === 'default-tute.png' || coverName === 'null') {
            setImgSrc(null);
        } else {
            const baseUrl = axios.defaults.baseURL.replace('/api', '');
            setImgSrc(`${baseUrl}/storage/documents/${coverName}`);
        }
    }, [stock, masterData]);

    const handleError = () => {
        if (errorStage === 0 && imgSrc) {
            setImgSrc(imgSrc.replace('/storage/documents/', '/storage/images/'));
            setErrorStage(1);
        } else if (errorStage === 1 && imgSrc) {
            setImgSrc(imgSrc.replace('/storage/images/', '/storage/icons/'));
            setErrorStage(2);
        } else {
            setImgSrc(null);
        }
    };

    if (!imgSrc) return <span className="text-[10px] text-gray-500 dark:text-slate-500 font-medium whitespace-nowrap text-center px-1">No Cover</span>;

    return <img src={imgSrc} onError={handleError} alt="Cover" className="w-full h-full object-cover" />;
};

const LecturerImage = ({ image, name }) => {
    const [imgSrc, setImgSrc] = useState(null);
    const [errorStage, setErrorStage] = useState(0);

    useEffect(() => {
        if (!image || image === 'null' || image === 'default.png') {
            setImgSrc(null);
        } else {
            const baseUrl = axios.defaults.baseURL.replace('/api', '');
            setImgSrc(`${baseUrl}/storage/icons/${image}`);
        }
    }, [image]);

    const handleError = () => {
        const baseUrl = axios.defaults.baseURL.replace('/api', '');
        if (errorStage === 0 && imgSrc) {
            setImgSrc(`${baseUrl}/storage/images/${image}`);
            setErrorStage(1);
        } else if (errorStage === 1 && imgSrc) {
            setImgSrc(`${baseUrl}/storage/documents/${image}`);
            setErrorStage(2);
        } else {
            setImgSrc(null);
        }
    };

    if (!imgSrc) {
        return (
            <div className="w-24 h-24 bg-gradient-to-br from-brand-accent to-purple-600 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-lg mb-4 transition-transform group-hover:scale-110 duration-300 shrink-0">
                {name.substring(0, 2).toUpperCase()}
            </div>
        );
    }

    return (
        <div className="w-24 h-24 rounded-2xl overflow-hidden mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300 shrink-0 bg-gray-100 dark:bg-black/20">
            <img src={imgSrc} onError={handleError} alt={name} className="w-full h-full object-cover" />
        </div>
    );
};

export default function TuteStock({ isReadOnly }) {
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [globalStock, setGlobalStock] = useState([]);
    const [masterData, setMasterData] = useState([]);
    const [showTuteModal, setShowTuteModal] = useState(false);
    const [tuteFormData, setTuteFormData] = useState({ id: null, courseId: '', tuteName: '', itemOrder: 1, imageFile: null, imageFile2: null });
    const [showLecModal, setShowLecModal] = useState(false);
    const [lecFormData, setLecFormData] = useState({ oldName: '', newName: '', imageFile: null });
    
    // View Level State (1: Lecturer, 2: Payment Type, 3: Stocks)
    const [viewLevel, setViewLevel] = useState(1);
    const [selectedLecturer, setSelectedLecturer] = useState(null);
    const [selectedPaymentGroup, setSelectedPaymentGroup] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Modals & Inputs
    const [stockInputs, setStockInputs] = useState({}); 
    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState({ id: null, qty: '', reason: '' });
    
    // Reports
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportFilters, setReportFilters] = useState({ dateType: 'this_month', startDate: '', endDate: '', businessId: '', batchId: '', paymentType: '' });
    const [reportData, setReportData] = useState([]);
    const [reportLoading, setReportLoading] = useState(false);

    useEffect(() => {
        fetchGlobalStock();
        setMonthDates('this_month');
    }, []);

    const fetchGlobalStock = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/admin/delivery/stock/global');
            if (Array.isArray(res.data)) { setGlobalStock(res.data); } else { setGlobalStock(res.data.stocks || []); setMasterData(res.data.masterData || []); }
        } catch { toast.error("Failed to load global stock"); } 
        finally { setLoading(false); }
    };

    // Derived Data for Drill-Down
    const lecturers = useMemo(() => {
        const lecMap = new Map();
        const lecImages = new Map();
        globalStock.forEach(s => {
            const name = s.course?.lecturerName || "Unknown Lecturer";
            const biz = s.course?.group?.batch?.business?.name || "Unknown";
            if (!lecMap.has(name)) lecMap.set(name, new Set());
            if (biz !== "Unknown") lecMap.get(name).add(biz);
            if (!lecImages.has(name) && s.course?.groupPrices) {
                try {
                    const gp = JSON.parse(s.course.groupPrices);
                    const lImg = gp.find(g => g.lecturerImage)?.lecturerImage;
                    if (lImg && lImg !== 'null' && lImg !== 'default.png') lecImages.set(name, lImg);
                } catch(e) {}
            }
        });

        // Also add lecturers from masterData that might not have any stock yet
        if (Array.isArray(masterData)) {
            masterData.forEach(mData => {
                if (mData && mData.name && !lecMap.has(mData.name)) {
                    lecMap.set(mData.name, new Set());
                }
            });
        }

        return Array.from(lecMap.keys()).sort().map(name => {
            const mData = masterData && Array.isArray(masterData) ? masterData.find(m => m.name === name) : null;
            return {
                name,
                image: lecImages.get(name) || mData?.image || null,
                businesses: Array.from(lecMap.get(name))
            };
        });
    }, [globalStock, masterData]);

    const filteredLecturers = useMemo(() => {
        if (!searchQuery) return lecturers;
        return lecturers.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [lecturers, searchQuery]);

    const paymentGroups = useMemo(() => {
        if (!selectedLecturer) return [];
        const pgs = new Set(['Monthly', 'Full Payment']); // Always show default groups so users can add new tutes
        globalStock.forEach(s => {
            const lec = s.course?.lecturerName || "Unknown Lecturer";
            if (lec === selectedLecturer) {
                pgs.add(s.course?.group?.type === 1 ? 'Monthly' : s.course?.group?.type === 2 ? 'Full Payment' : 'Unknown');
            }
        });
        return Array.from(pgs).filter(p => p !== 'Unknown').sort().reverse();
    }, [globalStock, selectedLecturer]);

    const finalStocks = useMemo(() => {
        if (!selectedLecturer || !selectedPaymentGroup) return [];
        
        const filtered = globalStock.filter(s => {
            const lec = s.course?.lecturerName || "Unknown Lecturer";
            const pg = s.course?.group?.type === 1 ? 'Monthly' : s.course?.group?.type === 2 ? 'Full Payment' : 'Unknown';
            
            let matchesSearch = true;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const courseName = (s.course?.name || "").toLowerCase();
                const tuteName = (s.tuteName || "").toLowerCase();
                matchesSearch = courseName.includes(q) || tuteName.includes(q);
            }

            return lec === selectedLecturer && pg === selectedPaymentGroup && matchesSearch;
        });

        // Group duplicates by normalized TuteName to fix double/triple duplicate UI issues
        const grouped = {};
        filtered.forEach(s => {
            const normalizedName = (s.tuteName || "").toLowerCase().replace(/\s+/g, ' ').trim();
            if (!grouped[normalizedName]) {
                // First occurrence, clone it to avoid mutating global state
                grouped[normalizedName] = { 
                    ...s, 
                    course: { ...s.course },
                    originalIds: [s.id], 
                    courseIds: [s.courseId] 
                };
            } else {
                // Duplicate found: sum the quantities and add IDs to tracking arrays
                grouped[normalizedName].availableQuantity += s.availableQuantity;
                grouped[normalizedName].originalIds.push(s.id);
                grouped[normalizedName].courseIds.push(s.courseId);
                // Keep the highest itemOrder
                if ((s.itemOrder || 1) > (grouped[normalizedName].itemOrder || 1)) {
                    grouped[normalizedName].itemOrder = s.itemOrder;
                }
                // Keep image if not present
                if (s.tuteImage && s.tuteImage !== 'null' && (!grouped[normalizedName].tuteImage || grouped[normalizedName].tuteImage === 'null')) {
                    grouped[normalizedName].tuteImage = s.tuteImage;
                }
            }
        });

        return Object.values(grouped).sort((a, b) => (a.itemOrder || 1) - (b.itemOrder || 1));
    }, [globalStock, selectedLecturer, selectedPaymentGroup, searchQuery]);

    // Navigation Handlers
    const handleLecturerClick = (lecName) => {
        setSelectedLecturer(lecName);
        
        setSelectedPaymentGroup(null);
        setSearchQuery('');
        setViewLevel(2);
    };

    const handlePaymentGroupClick = (pg) => {
        setSelectedPaymentGroup(pg);
        setSearchQuery('');
        setViewLevel(3);
    };

    const goToLevel = (level) => {
        setSearchQuery('');
        if (level === 1) {
            setSelectedLecturer(null); setSelectedPaymentGroup(null);
            setViewLevel(1);
        } else if (level === 2 && selectedLecturer) {
            setSelectedPaymentGroup(null);
            setViewLevel(2);
        }
    };

    // Stock Operations
    
    const handleDeleteLecturer = async (oldName) => {
        if (!window.confirm(`Are you sure you want to delete ${oldName}?`)) return;
        setActionLoading(true);
        try {
            await axios.delete(`/lecturer/delete/${encodeURIComponent(oldName)}`);
            toast.success("Lecturer deleted");
            fetchGlobalStock();
        } catch { toast.error("Failed to delete"); }
        finally { setActionLoading(false); }
    };

    const handleLecSubmit = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const fd = new FormData();
            fd.append('oldName', lecFormData.oldName);
            fd.append('newName', lecFormData.newName);
            if (lecFormData.imageFile) fd.append('image', lecFormData.imageFile);
            await axios.put('/lecturer/update', fd);
            toast.success("Lecturer updated");
            setShowLecModal(false);
            fetchGlobalStock();
        } catch { toast.error("Failed to update lecturer"); }
        finally { setActionLoading(false); }
    };

    const handleTuteSubmit = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const fd = new FormData();
            if (tuteFormData.id) fd.append('id', tuteFormData.id);
            if (tuteFormData.courseId) fd.append('courseId', tuteFormData.courseId);
            if (tuteFormData.lecturerName) fd.append('lecturerName', tuteFormData.lecturerName);
            if (tuteFormData.paymentGroup) fd.append('paymentGroup', tuteFormData.paymentGroup);
            fd.append('tuteName', tuteFormData.tuteName);
            fd.append('itemOrder', tuteFormData.itemOrder);
            if (tuteFormData.imageFile) fd.append('tuteImage', tuteFormData.imageFile);
            if (tuteFormData.imageFile2) fd.append('tuteImage2', tuteFormData.imageFile2);
            
            if (tuteFormData.id) {
                await axios.put('/edit-tute', fd);
                toast.success("Tute Updated");
            } else {
                await axios.post('/create-tute', fd);
                toast.success("Tute Created");
            }
            setShowTuteModal(false);
            fetchGlobalStock();
        } catch { toast.error("Failed to save tute"); }
        finally { setActionLoading(false); }
    };

    const handleAddStock = async (stockId) => {
        const qty = parseInt(stockInputs[stockId]);
        if (!qty || isNaN(qty) || qty <= 0) return toast.error("Enter a valid quantity!");
        setActionLoading(true);
        try {
            await axios.post('/admin/delivery/stock/add', { stockId, quantity: qty, reason: "New printed stock added" });
            toast.success("Stock Added Successfully!");
            setStockInputs(prev => ({ ...prev, [stockId]: '' }));
            fetchGlobalStock();
        } catch { toast.error("Failed to update stock"); } 
        finally { setActionLoading(false); }
    };

    const handleEditStockSubmit = async (e) => {
        e.preventDefault();
        if (!editData.reason) return toast.error("A reason is required!");
        setActionLoading(true);
        try {
            await axios.put('/admin/delivery/stock/edit', { 
                stockId: editData.id, 
                originalIds: editData.originalIds,
                newQuantity: editData.qty, 
                reason: editData.reason 
            });
            toast.success("Stock Adjusted!");
            setShowEditModal(false);
            fetchGlobalStock();
        } catch { toast.error("Failed to adjust stock"); } 
        finally { setActionLoading(false); }
    };

    const handleDeleteStock = async (stockId) => {
        const reason = window.prompt("Why are you deleting this item? (Required)");
        if (!reason) return toast.error("Deletion cancelled.");
        try {
            await axios.delete(`/delete-tute/${stockId}`);
            toast.success("Stock Item Deleted!");
            fetchGlobalStock();
        } catch { toast.error("Failed to delete item"); }
    };

    const handleClearAllStock = async () => {
        if (!window.confirm("⚠️ ARE YOU SURE YOU WANT TO CLEAR ALL TUTE STOCK?\n\nThis will remove all stock items so you can start fresh. Past/Pending Deliveries will NOT be affected.")) return;
        setActionLoading(true);
        try {
            await axios.delete('/admin/delivery/stock/clear-all');
            toast.success("All TuteStock records cleared!");
            fetchGlobalStock();
        } catch {
            toast.error("Failed to clear stock");
        } finally {
            setActionLoading(false);
        }
    };

    // Report Functions
    const setMonthDates = (type) => {
        const today = new Date();
        let start, end;
        if (type === 'this_month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        } else if (type === 'last_month') {
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            end = new Date(today.getFullYear(), today.getMonth(), 0);
        } else return;
        setReportFilters(prev => ({ ...prev, dateType: type, startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] }));
    };

    const generateReport = async () => {
        setReportLoading(true);
        try {
            const params = new URLSearchParams({
                startDate: reportFilters.startDate, endDate: reportFilters.endDate,
                paymentType: reportFilters.paymentType
            });
            const res = await axios.get(`/admin/delivery/stock/report?${params.toString()}`);
            setReportData(res.data || []);
            if(res.data.length === 0) toast("No deliveries found for this criteria.", { icon: 'ℹ️' });
        } catch { toast.error("Failed to generate report"); } 
        finally { setReportLoading(false); }
    };

    const exportReportCSV = () => {
        if(reportData.length === 0) return toast.error("No data to export");
        const headers = ["Business", "Batch", "Payment Group", "Subject Name", "Tute Name", "Total Delivered/Packed", "Remaining Stock"];
        const rows = reportData.map(r => `"${r.businessName}","${r.batchName}","${r.paymentType}","${r.courseName}","${r.tuteName}","${r.deliveredQty}","${r.currentStock}"`);
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Delivery_Report_${reportFilters.startDate}_to_${reportFilters.endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const Breadcrumbs = () => (
        <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm transition-colors text-xs font-bold text-gray-500 dark:text-slate-400">
            <button onClick={() => goToLevel(1)} className={`hover:text-brand-accent transition-colors flex items-center gap-1.5 ${viewLevel === 1 ? 'text-brand-accent font-black' : ''}`}>
                <Users size={14} className={viewLevel === 1 ? "text-brand-accent" : "opacity-50"}/> Lecturers
            </button>
            {selectedLecturer && <>
                <ChevronRight size={14} className="opacity-50"/>
                <button onClick={() => goToLevel(2)} className={`hover:text-brand-accent transition-colors flex items-center gap-1.5 ${viewLevel === 2 ? 'text-brand-accent font-black' : ''}`}>
                    <Layers size={14} className={viewLevel === 2 ? "text-brand-accent" : "opacity-50"}/> {selectedLecturer}
                </button>
            </>}
            {selectedPaymentGroup && <>
                <ChevronRight size={14} className="opacity-50"/>
                <span className="text-brand-accent font-black flex items-center gap-1.5">
                    <BookOpen size={14}/> {selectedPaymentGroup}
                </span>
            </>}
        </div>
    );

    const getAutoCourseId = () => {
        const matchingStock = globalStock.find(s => {
            const lec = s.course?.lecturerName || "Unknown Lecturer";
            const pg = s.course?.group?.type === 1 ? 'Monthly' : s.course?.group?.type === 2 ? 'Full Payment' : 'Unknown';
            return lec === selectedLecturer && pg === selectedPaymentGroup;
        });
        return matchingStock ? matchingStock.course?.id : '';
    };

    return (
        <div className="w-full text-gray-900 dark:text-slate-200 animate-in fade-in duration-300 font-sans h-[85vh] flex flex-col transition-colors relative z-10">
            
            {/* Top Toolbar */}
            <div className="mb-4 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {viewLevel > 1 && (
                        <button onClick={() => goToLevel(viewLevel - 1)} className="p-2.5 bg-white/80 dark:bg-black/30 backdrop-blur-md rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:text-brand-accent dark:hover:text-brand-accent transition-all shadow-sm shrink-0 hover:scale-105 active:scale-95">
                            <ArrowLeft size={18}/>
                        </button>
                    )}
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={18}/>
                        <input 
                            type="text" 
                            placeholder={viewLevel === 1 ? "Search lecturers..." : "Search tutes..."} 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            className="w-full bg-white/80 dark:bg-black/40 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-gray-900 dark:text-slate-200 outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-all shadow-sm font-semibold placeholder-gray-400 dark:placeholder-slate-500" 
                        />
                    </div>
                </div>
                {!isReadOnly && (
                    <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
                        <button onClick={handleClearAllStock} className="bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30 px-4 py-2.5 rounded-xl transition-all font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 shrink-0 justify-center">
                            <Trash2 size={16}/> Clear Stock
                        </button>
                        {viewLevel === 1 && (
                            <button onClick={() => { setLecFormData({ oldName: '', newName: '', imageFile: null }); setShowLecModal(true); }} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl transition-all font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-purple-600/30 hover:scale-105 active:scale-95 shrink-0 justify-center">
                                <Plus size={16}/> Add Lecturer
                            </button>
                        )}
                        {viewLevel === 3 && (
                            <button onClick={() => { setTuteFormData({ id: null, courseId: getAutoCourseId(), lecturerName: selectedLecturer, paymentGroup: selectedPaymentGroup, tuteName: '', itemOrder: 1, imageFile: null, imageFile2: null }); setShowTuteModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-all font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-600/30 hover:scale-105 active:scale-95 shrink-0 justify-center">
                                <Plus size={16}/> Add New Tute
                            </button>
                        )}
                    </div>
                )}
            </div>

            <Breadcrumbs />

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
                {loading ? (
                    <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin text-brand-accent" size={36}/></div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* LEVEL 1: LECTURERS */}
                        {viewLevel === 1 && (
                            <>
                                {filteredLecturers.length === 0 ? (
                                    <div className="text-center py-20 text-gray-500 dark:text-slate-400"><Users size={40} className="mx-auto mb-3 opacity-50"/>No lecturers found.</div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                        {filteredLecturers.map((lec, idx) => (
                                            <div key={idx} className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-[1.5rem] p-6 cursor-pointer group transition-all shadow-sm hover:shadow-lg hover:border-brand-accent/50 flex flex-col items-center text-center relative overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                <div className="absolute top-2 right-2 flex gap-1 z-20">
                                                    <button onClick={(e) => { e.stopPropagation(); setLecFormData({ oldName: lec.name, newName: lec.name, imageFile: null }); setShowLecModal(true); }} className="p-1.5 bg-gray-200/50 hover:bg-amber-500/20 text-amber-600 rounded-lg transition-colors"><Edit2 size={14}/></button>
                                                    {!isReadOnly && <button onClick={(e) => { e.stopPropagation(); handleDeleteLecturer(lec.name); }} className="p-1.5 bg-gray-200/50 hover:bg-rose-500/20 text-rose-600 rounded-lg transition-colors"><Trash2 size={14}/></button>}
                                                </div>
                                                <div onClick={() => handleLecturerClick(lec.name)} className="flex flex-col items-center w-full z-10">
                                                    <LecturerImage image={lec.image} name={lec.name} />
                                                    <h3 className="font-black text-lg text-gray-900 dark:text-slate-100 mb-1 line-clamp-1" title={lec.name}>
                                                        {lec.name.split(' ').length > 3 ? lec.name.split(' ').slice(0, 3).join(' ') + '...' : lec.name}
                                                    </h3>
                                                    {lec.businesses.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 justify-center mt-1 mb-2">
                                                            {lec.businesses.map((b, i) => <span key={i} className="text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded-full">{b}</span>)}
                                                        </div>
                                                    )}
                                                    <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-lg mt-2">View Lecturer Details</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* LEVEL 2: PAYMENT TYPES */}
                        {viewLevel === 2 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-4xl mx-auto mt-6">
                                {paymentGroups.length === 0 ? (
                                     <div className="col-span-1 sm:col-span-2 text-center py-20 text-gray-500 dark:text-slate-400"><CreditCard size={40} className="mx-auto mb-3 opacity-50"/>No payment groups found for this lecturer.</div>
                                ) : paymentGroups.map(pg => {
                                    const isMonthly = pg === 'Monthly';
                                    return (
                                        <div key={pg} onClick={() => handlePaymentGroupClick(pg)} className={`bg-white/80 dark:bg-white/[0.02] backdrop-blur-2xl border ${isMonthly ? 'border-blue-200 dark:border-blue-500/20 hover:border-blue-500/50' : 'border-purple-200 dark:border-purple-500/20 hover:border-purple-500/50'} rounded-[2rem] p-10 cursor-pointer group transition-all shadow-md hover:shadow-2xl text-center relative overflow-hidden`}>
                                            <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full -mr-8 -mt-8 opacity-10 transition-transform group-hover:scale-125 ${isMonthly ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                                            <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-6 border shadow-lg relative z-10 transition-transform group-hover:-translate-y-2 duration-300 ${isMonthly ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white border-blue-600/50' : 'bg-gradient-to-br from-purple-400 to-purple-600 text-white border-purple-600/50'}`}>
                                                <CreditCard size={36} />
                                            </div>
                                            <h3 className="font-black text-3xl text-gray-900 dark:text-slate-100 mb-3 relative z-10">{pg}</h3>
                                            <p className="text-sm font-bold text-gray-500 dark:text-slate-400 relative z-10">Manage tute stock for {pg} students</p>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* LEVEL 3: STOCKS */}
                        {viewLevel === 3 && (
                            <>
                                {finalStocks.length === 0 ? (
                                    <div className="text-center py-24 bg-white/50 dark:bg-white/[0.02] backdrop-blur-xl rounded-[2rem] border border-gray-200 dark:border-white/5 transition-colors shadow-sm">
                                        <FileText size={40} className="text-gray-400 dark:text-slate-600 mx-auto mb-4 transition-colors opacity-50"/>
                                        <p className="text-gray-500 dark:text-slate-400 text-base font-bold transition-colors">No stock items found for this selection.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                                        {finalStocks.map(stock => {
                                            const isLow = stock.availableQuantity <= 10;
                                            const paymentGroup = selectedPaymentGroup;
                                            const paymentColor = paymentGroup === 'Monthly' ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30' : 'bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30';
                                            
                                            return (
                                                <div key={stock.id} className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-2xl hover:bg-white dark:hover:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-[1.5rem] p-5 flex flex-col md:flex-row items-center justify-between gap-5 transition-all group shadow-sm hover:shadow-lg overflow-hidden">
                                                    
                                                    {/* Left: Tute Info */}
                                                    <div className="flex items-center gap-5 flex-1 min-w-0 w-full transition-colors">
                                                        <div className="flex -space-x-8 hover:space-x-2 transition-all">
                                                            <div className="w-16 h-24 bg-gray-100 dark:bg-black/40 rounded-xl border border-gray-200 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative z-10">
                                                                <LiveTuteImage stock={stock} masterData={masterData} />
                                                            </div>
                                                            {stock.tuteImage2 && stock.tuteImage2 !== 'null' && (
                                                                <div className="w-16 h-24 bg-gray-100 dark:bg-black/40 rounded-xl border border-gray-200 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative z-0">
                                                                    <img src={`${axios.defaults.baseURL.replace('/api', '')}/storage/documents/${stock.tuteImage2}`} className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="flex flex-col justify-center min-w-0 flex-1 transition-colors">
                                                            <div className="flex flex-wrap items-center gap-2.5 mb-1.5 min-w-0">
                                                                <h4 className="font-black text-gray-900 dark:text-slate-100 text-base truncate" title={stock.course?.name}>{stock.course?.name || "Extra Material"}</h4>
                                                                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest whitespace-nowrap border shrink-0 transition-colors shadow-sm ${paymentColor}`}>
                                                                    {paymentGroup}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm font-bold text-gray-500 dark:text-slate-400 mt-0.5 truncate transition-colors">{stock.tuteName} <span className="ml-2 text-[10px] font-black bg-gray-200 dark:bg-slate-700 px-2 py-0.5 rounded-md">Order: {stock.itemOrder || 1}</span></p>
                                                            <div className="mt-3 flex items-center gap-2 transition-colors">
                                                                <span className={`px-3 py-1 rounded-lg text-xs font-black border uppercase tracking-widest shadow-sm transition-colors ${isLow ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>
                                                                    Stock: {stock.availableQuantity}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Right: Actions */}
                                                    <div className="flex items-center gap-2.5 shrink-0 bg-white dark:bg-black/30 backdrop-blur-md p-2 rounded-2xl border border-gray-100 dark:border-white/5 w-full md:w-auto justify-between md:justify-start transition-colors shadow-sm">
                                                        <div className="flex items-center rounded-lg px-1 flex-1 sm:flex-none transition-colors">
                                                            <input 
                                                                type="number" min="1" placeholder="Qty"
                                                                value={stockInputs[stock.id] || ''}
                                                                onChange={(e) => setStockInputs({...stockInputs, [stock.id]: e.target.value})}
                                                                className="w-16 h-10 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-slate-200 text-center text-sm font-black focus:border-brand-accent dark:focus:border-brand-accent outline-none transition-colors placeholder:text-gray-400 dark:placeholder-slate-500 shadow-inner" 
                                                            />
                                                        </div>
                                                        
                                                        {!isReadOnly && (
                                                            <>
                                                                <button onClick={() => handleAddStock(stock.id)} disabled={actionLoading} className="h-10 bg-brand-accent hover:bg-brand-accentHover text-white px-5 rounded-xl font-black text-xs uppercase tracking-widest transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-md hover:scale-105 active:scale-95 transition-transform">
                                                                    <Plus size={14} strokeWidth={3}/> Add
                                                                </button>
                                                                
                                                                <button onClick={() => { setEditData({ id: stock.id, originalIds: stock.originalIds, qty: stock.availableQuantity, reason: '' }); setShowEditModal(true); }} className="h-10 w-10 flex items-center justify-center text-gray-400 dark:text-slate-400 hover:text-brand-accent dark:hover:text-brand-accent hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-gray-200 dark:hover:border-white/10" title="Adjust Balance">
                                                                    <Box size={16}/>
                                                                </button>
                                                                <button onClick={() => { setTuteFormData({ id: stock.id, courseId: stock.courseId, tuteName: stock.tuteName, itemOrder: stock.itemOrder || 1, imageFile: null, imageFile2: null }); setShowTuteModal(true); }} className="h-10 w-10 flex items-center justify-center text-gray-400 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-500/20" title="Edit Details">
                                                                    <Edit2 size={16}/>
                                                                </button>
                                                                <button onClick={() => handleDeleteStock(stock.id)} className="h-10 w-10 flex items-center justify-center text-gray-400 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-500/20" title="Delete Material">
                                                                    <Trash2 size={16}/>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            {showReportModal && createPortal(
                <div className="fixed inset-0 z-[99] bg-gray-900/60 dark:bg-[#0a0f1c]/90 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in transition-colors">
                    <div className="bg-white dark:bg-[#15192b] border border-gray-200 dark:border-white/10 rounded-[2rem] p-8 w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl animate-in zoom-in-95 transition-colors">
                        
                        <div className="flex justify-between items-center mb-6 pb-5 border-b border-gray-200 dark:border-white/10 shrink-0 transition-colors">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-slate-100 flex items-center gap-3 transition-colors">
                                <BarChart3 size={28} className="text-brand-accent transition-colors"/> Advanced Delivery & Stock Report
                            </h3>
                            <button onClick={() => setShowReportModal(false)} className="text-gray-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 bg-gray-100 dark:bg-white/5 p-2.5 rounded-xl transition-colors"><X size={20}/></button>
                        </div>

                        <div className="bg-white/80 dark:bg-black/30 p-6 rounded-[1.5rem] border border-gray-200 dark:border-white/10 mb-6 shrink-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 transition-colors shadow-sm backdrop-blur-md">
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-slate-400 mb-2 block uppercase tracking-widest transition-colors">Time Period</label>
                                <div className="flex gap-2 mb-2">
                                    <button onClick={() => setMonthDates('this_month')} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors ${reportFilters.dateType === 'this_month' ? 'bg-brand-accent border-brand-accent text-white shadow-md' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/10'}`}>This Month</button>
                                    <button onClick={() => setMonthDates('last_month')} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors ${reportFilters.dateType === 'last_month' ? 'bg-brand-accent border-brand-accent text-white shadow-md' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/10'}`}>Last Month</button>
                                    <button onClick={() => setReportFilters({...reportFilters, dateType: 'custom'})} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors ${reportFilters.dateType === 'custom' ? 'bg-brand-accent border-brand-accent text-white shadow-md' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/10'}`}>Custom</button>
                                </div>
                                {reportFilters.dateType === 'custom' && (
                                    <div className="flex items-center gap-2">
                                        <input type="date" value={reportFilters.startDate} onChange={e => setReportFilters({...reportFilters, startDate: e.target.value})} className="flex-1 bg-white dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 dark:text-slate-300 outline-none focus:border-brand-accent dark:focus:border-brand-accent [color-scheme:light] dark:[color-scheme:dark] transition-colors shadow-inner"/>
                                        <span className="text-gray-400 dark:text-slate-500 font-black transition-colors">-</span>
                                        <input type="date" value={reportFilters.endDate} onChange={e => setReportFilters({...reportFilters, endDate: e.target.value})} className="flex-1 bg-white dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 dark:text-slate-300 outline-none focus:border-brand-accent dark:focus:border-brand-accent [color-scheme:light] dark:[color-scheme:dark] transition-colors shadow-inner"/>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-slate-400 mb-2 block uppercase tracking-widest transition-colors">Payment Type</label>
                                <select value={reportFilters.paymentType} onChange={e => setReportFilters({...reportFilters, paymentType: e.target.value})} className="w-full bg-white dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 dark:text-slate-200 outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-colors shadow-inner">
                                    <option value="">All Types</option>
                                    <option value="Full">Full Payment</option>
                                    <option value="Monthly">Monthly</option>
                                    <option value="Installment">Installment</option>
                                </select>
                            </div>
                            <div className="md:col-span-4 flex justify-end gap-3 mt-3 border-t border-gray-200 dark:border-white/10 pt-5 transition-colors">
                                <button onClick={exportReportCSV} disabled={reportData.length === 0} className="bg-white/80 dark:bg-white/5 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm">
                                    <Download size={16}/> Export CSV
                                </button>
                                <button onClick={generateReport} disabled={reportLoading} className="bg-brand-accent hover:bg-brand-accentHover text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-colors flex items-center gap-2 shadow-lg shadow-brand-accent/30">
                                    {reportLoading ? <Loader2 size={16} className="animate-spin"/> : <BarChart3 size={16}/>} Generate Report
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-white/10 relative transition-colors shadow-inner">
                            {reportLoading ? (
                                <div className="absolute inset-0 flex items-center justify-center"><Loader2 size={36} className="animate-spin text-brand-accent transition-colors"/></div>
                            ) : reportData.length === 0 ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 transition-colors">
                                    <FileText size={48} className="mb-4 opacity-40"/>
                                    <p className="text-base font-bold">Select filters and generate report.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-white/90 dark:bg-black/40 backdrop-blur-md sticky top-0 border-b border-gray-200 dark:border-white/10 z-10 transition-colors">
                                        <tr className="text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400">
                                            <th className="p-5 font-black">Business / Batch</th>
                                            <th className="p-5 font-black">Subject & Payment Grp</th>
                                            <th className="p-5 font-black">Material Name</th>
                                            <th className="p-5 font-black text-center">Total Delivered</th>
                                            <th className="p-5 font-black text-center">Remaining Stock</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-white/5 transition-colors">
                                        {reportData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-white/60 dark:hover:bg-white/[0.05] transition-colors">
                                                <td className="p-5 transition-colors">
                                                    <p className="font-black text-gray-900 dark:text-slate-200 text-sm transition-colors">{row.businessName}</p>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-slate-500 mt-1 transition-colors">{row.batchName}</p>
                                                </td>
                                                <td className="p-5 transition-colors">
                                                    <p className="font-bold text-gray-700 dark:text-slate-300 text-sm transition-colors mb-1.5">{row.courseName}</p>
                                                    <span className={`inline-block px-2.5 py-1 rounded-md border text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm ${row.paymentType === 'Monthly' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' : 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20'}`}>{row.paymentType}</span>
                                                </td>
                                                <td className="p-5 text-sm font-bold text-gray-600 dark:text-slate-400 transition-colors">{row.tuteName}</td>
                                                <td className="p-5 text-center border-l border-r border-gray-100 dark:border-white/5 transition-colors">
                                                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/20 transition-colors shadow-sm">{row.deliveredQty}</span>
                                                </td>
                                                <td className="p-5 text-center transition-colors">
                                                    <span className={`text-base font-black px-4 py-1.5 rounded-lg border transition-colors shadow-sm ${row.currentStock <= 10 ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' : 'text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-black/40 border-gray-200 dark:border-white/10'}`}>
                                                        {row.currentStock}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>, document.body
            )}

            {showEditModal && createPortal(
                <div className="fixed inset-0 z-[99] bg-gray-900/60 dark:bg-[#0a0f1c]/90 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in transition-colors">
                    <div className="bg-white dark:bg-[#15192b] border border-gray-200 dark:border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 transition-colors">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-white/10 pb-4">
                            <h3 className="text-xl font-black text-gray-900 dark:text-slate-100 flex items-center gap-3 transition-colors"><Edit3 size={24} className="text-brand-accent"/> Adjust Stock</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 bg-gray-100 dark:bg-white/5 p-2.5 rounded-xl transition-colors"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleEditStockSubmit} className="space-y-5">
                            <div>
                                <label className="text-xs font-black text-gray-500 dark:text-slate-400 mb-2 block uppercase tracking-widest transition-colors">New Total Quantity <span className="text-red-500">*</span></label>
                                <input type="number" required min="0" value={editData.qty} onChange={e => setEditData({...editData, qty: e.target.value})} className="w-full bg-white/80 dark:bg-black/40 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-xl p-4 text-gray-900 dark:text-slate-200 text-2xl font-black text-center outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-colors shadow-inner" />
                            </div>
                            <div>
                                <label className="text-xs font-black text-gray-500 dark:text-slate-400 mb-2 block uppercase tracking-widest transition-colors">Reason for change <span className="text-red-500">*</span></label>
                                <input type="text" required placeholder="e.g. Recounted, Damaged" value={editData.reason} onChange={e => setEditData({...editData, reason: e.target.value})} className="w-full bg-white/80 dark:bg-black/40 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-xl p-4 text-sm font-bold text-gray-900 dark:text-slate-200 outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-colors shadow-inner placeholder-gray-400 dark:placeholder-slate-600" />
                            </div>
                            <button type="submit" disabled={actionLoading} className="w-full bg-brand-accent hover:bg-brand-accentHover text-white rounded-xl py-4 font-black uppercase tracking-widest transition-colors mt-4 disabled:opacity-50 text-xs shadow-lg shadow-brand-accent/30 active:scale-95 transition-transform flex justify-center items-center gap-2">
                                {actionLoading ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>} Update Balance
                            </button>
                        </form>
                    </div>
                </div>, document.body
            )}
        
            {/* TUTE MODAL */}
            {showTuteModal && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowTuteModal(false)} />
                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white">{tuteFormData.id ? "Edit Tute" : "Create New Tute"}</h3>
                            <button onClick={() => setShowTuteModal(false)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar">
                            <form id="tuteForm" onSubmit={handleTuteSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Tute Name *</label>
                                    <input type="text" required value={tuteFormData.tuteName} onChange={e => setTuteFormData(p => ({...p, tuteName: e.target.value}))} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-pink-500 transition-colors text-slate-800 dark:text-slate-200" placeholder="e.g. Tute 01 - Intro" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Item Order (Sorting)</label>
                                    <input type="number" required value={tuteFormData.itemOrder} onChange={e => setTuteFormData(p => ({...p, itemOrder: e.target.value}))} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-pink-500 transition-colors text-slate-800 dark:text-slate-200" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Tute Cover Image (Optional)</label>
                                    <input type="file" accept="image/*" onChange={e => setTuteFormData(p => ({...p, imageFile: e.target.files[0]}))} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-pink-500 transition-colors text-slate-800 dark:text-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Tute Back Image / 2nd Image (Optional)</label>
                                    <input type="file" accept="image/*" onChange={e => setTuteFormData(p => ({...p, imageFile2: e.target.files[0]}))} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-pink-500 transition-colors text-slate-800 dark:text-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100" />
                                </div>
                            </form>
                        </div>
                        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                            <button form="tuteForm" type="submit" disabled={actionLoading} className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 disabled:opacity-50">
                                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (tuteFormData.id ? "Save Changes" : "Create Tute")}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* LECTURER MODAL */}
            {showLecModal && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowLecModal(false)} />
                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white">Edit Lecturer</h3>
                            <button onClick={() => setShowLecModal(false)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar">
                            <form id="lecForm" onSubmit={handleLecSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Lecturer Name *</label>
                                    <input type="text" required value={lecFormData.newName} onChange={e => setLecFormData(p => ({...p, newName: e.target.value}))} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-pink-500 transition-colors text-slate-800 dark:text-slate-200" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Profile Image (Optional)</label>
                                    <input type="file" accept="image/*" onChange={e => setLecFormData(p => ({...p, imageFile: e.target.files[0]}))} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-pink-500 transition-colors text-slate-800 dark:text-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100" />
                                </div>
                            </form>
                        </div>
                        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                            <button form="lecForm" type="submit" disabled={actionLoading} className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 disabled:opacity-50">
                                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
}
