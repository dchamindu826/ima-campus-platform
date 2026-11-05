import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Download, Edit2, Trash2, Box, X, Loader2, Check, BarChart3, ChevronRight, BookOpen, Plus, FileText, ArrowLeft, Briefcase, GraduationCap, Users, CreditCard, Edit3 } from 'lucide-react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';

// Helper component for Stock Images
const LiveTuteImage = ({ stock }) => {
    const [imgSrc, setImgSrc] = useState(null);
    const [errorStage, setErrorStage] = useState(0);
    const baseUrl = axios.defaults.baseURL;

    useEffect(() => {
        let tCover = null;
        if (stock.course?.groupPrices) {
            try {
                const groupPrices = typeof stock.course.groupPrices === 'string' 
                    ? JSON.parse(stock.course.groupPrices) 
                    : stock.course.groupPrices;
                const gpData = groupPrices.find(p => parseInt(p.groupId) === stock.course?.group?.id);
                if (gpData?.tuteCover) tCover = gpData.tuteCover;
            } catch (e) { console.error(e); }
        }
        
        if (!tCover || tCover === 'default-tute.png' || tCover === 'null') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setImgSrc(null);
        } else {
            setImgSrc(`${baseUrl}/storage/documents/${tCover}`);
        }
    }, [stock, baseUrl]);

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

export default function TuteStock({ isReadOnly }) {
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    
    // Data State
    const [businesses, setBusinesses] = useState([]);
    const [batches, setBatches] = useState([]);
    const [batchStock, setBatchStock] = useState([]);
    
    // View Level State (1: Business, 2: Batch, 3: Lecturer, 4: Subject, 5: Payment Type, 6: Stocks)
    const [viewLevel, setViewLevel] = useState(1);
    const [selectedBusiness, setSelectedBusiness] = useState(null);
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [selectedLecturer, setSelectedLecturer] = useState(null);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [selectedPaymentGroup, setSelectedPaymentGroup] = useState(null);

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
        fetchInitialData();
        setMonthDates('this_month');
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const bizRes = await axios.get('/admin/businesses');
            setBusinesses(bizRes.data?.data || bizRes.data || []);
        } catch { toast.error("Failed to load dashboard data"); } 
        finally { setLoading(false); }
    };

    const fetchBatches = async (bizId) => {
        setLoading(true);
        try {
            const res = await axios.get(`/admin/batches/${bizId}`);
            setBatches(res.data?.batches || res.data || []);
        } catch { toast.error("Failed to load batches"); }
        finally { setLoading(false); }
    };

    const fetchBatchStock = async (batchId) => {
        setLoading(true);
        try {
            const res = await axios.get(`/admin/delivery/stock/batch/${batchId}`);
            setBatchStock(res.data || []);
        } catch { toast.error("Failed to load stock data"); } 
        finally { setLoading(false); }
    };

    // Derived Data for Drill-Down
    const lecturers = useMemo(() => {
        if (viewLevel < 3 || !batchStock.length) return [];
        const lecs = new Set();
        batchStock.forEach(s => lecs.add(s.course?.lecturerName || "Unknown Lecturer"));
        return Array.from(lecs).sort();
    }, [batchStock, viewLevel]);

    const subjects = useMemo(() => {
        if (viewLevel < 4 || !selectedLecturer || !batchStock.length) return [];
        const subs = new Map();
        batchStock.forEach(s => {
            const lec = s.course?.lecturerName || "Unknown Lecturer";
            if (lec === selectedLecturer && s.course?.group) {
                subs.set(s.course.group.id, s.course.group);
            }
        });
        return Array.from(subs.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [batchStock, selectedLecturer, viewLevel]);

    const paymentGroups = useMemo(() => {
        if (viewLevel < 5 || !selectedSubject || !batchStock.length) return [];
        const pgs = new Set();
        batchStock.forEach(s => {
            const lec = s.course?.lecturerName || "Unknown Lecturer";
            if (lec === selectedLecturer && s.course?.group?.id === selectedSubject.id) {
                pgs.add(s.course.group.type === 1 ? 'Monthly' : s.course.group.type === 2 ? 'Full Payment' : 'Unknown');
            }
        });
        return Array.from(pgs).sort();
    }, [batchStock, selectedLecturer, selectedSubject, viewLevel]);

    const finalStocks = useMemo(() => {
        if (viewLevel < 6 || !selectedPaymentGroup || !batchStock.length) return [];
        return batchStock.filter(s => {
            const lec = s.course?.lecturerName || "Unknown Lecturer";
            const pg = s.course?.group?.type === 1 ? 'Monthly' : s.course?.group?.type === 2 ? 'Full Payment' : 'Unknown';
            return lec === selectedLecturer && s.course?.group?.id === selectedSubject.id && pg === selectedPaymentGroup;
        });
    }, [batchStock, selectedLecturer, selectedSubject, selectedPaymentGroup, viewLevel]);

    // Navigation Handlers
    const handleBusinessClick = (biz) => {
        setSelectedBusiness(biz);
        setBatches([]); setBatchStock([]);
        setSelectedBatch(null); setSelectedLecturer(null); setSelectedSubject(null); setSelectedPaymentGroup(null);
        setViewLevel(2);
        fetchBatches(biz.id);
    };

    const handleBatchClick = (batch) => {
        setSelectedBatch(batch);
        setBatchStock([]);
        setSelectedLecturer(null); setSelectedSubject(null); setSelectedPaymentGroup(null);
        setViewLevel(3);
        fetchBatchStock(batch.id);
    };

    const handleLecturerClick = (lec) => {
        setSelectedLecturer(lec);
        setSelectedSubject(null); setSelectedPaymentGroup(null);
        setViewLevel(4);
    };

    const handleSubjectClick = (sub) => {
        setSelectedSubject(sub);
        setSelectedPaymentGroup(null);
        setViewLevel(5);
    };

    const handlePaymentGroupClick = (pg) => {
        setSelectedPaymentGroup(pg);
        setViewLevel(6);
    };

    const goToLevel = (level) => {
        if (level === 1) {
            setSelectedBusiness(null); setSelectedBatch(null); setSelectedLecturer(null); setSelectedSubject(null); setSelectedPaymentGroup(null);
            setViewLevel(1);
        } else if (level === 2 && selectedBusiness) {
            setSelectedBatch(null); setSelectedLecturer(null); setSelectedSubject(null); setSelectedPaymentGroup(null);
            setViewLevel(2);
        } else if (level === 3 && selectedBatch) {
            setSelectedLecturer(null); setSelectedSubject(null); setSelectedPaymentGroup(null);
            setViewLevel(3);
        } else if (level === 4 && selectedLecturer) {
            setSelectedSubject(null); setSelectedPaymentGroup(null);
            setViewLevel(4);
        } else if (level === 5 && selectedSubject) {
            setSelectedPaymentGroup(null);
            setViewLevel(5);
        }
    };

    // Stock Operations
    const handleAddStock = async (stockId) => {
        const qty = parseInt(stockInputs[stockId]);
        if (!qty || isNaN(qty) || qty <= 0) return toast.error("Enter a valid quantity!");
        setActionLoading(true);
        try {
            await axios.post('/admin/delivery/stock/add', { stockId, quantity: qty, reason: "New printed stock added" });
            toast.success("Stock Added Successfully!");
            setStockInputs(prev => ({ ...prev, [stockId]: '' }));
            fetchBatchStock(selectedBatch.id);
            fetchInitialData(); 
        } catch { toast.error("Failed to update stock"); } 
        finally { setActionLoading(false); }
    };

    const handleEditStockSubmit = async (e) => {
        e.preventDefault();
        if (!editData.reason) return toast.error("A reason is required!");
        setActionLoading(true);
        try {
            await axios.put('/admin/delivery/stock/edit', { stockId: editData.id, newQuantity: editData.qty, reason: editData.reason });
            toast.success("Stock Adjusted!");
            setShowEditModal(false);
            fetchBatchStock(selectedBatch.id);
            fetchInitialData();
        } catch { toast.error("Failed to adjust stock"); } 
        finally { setActionLoading(false); }
    };

    const handleDeleteStock = async (stockId) => {
        const reason = window.prompt("Why are you deleting this item? (Required)");
        if (!reason) return toast.error("Deletion cancelled.");
        try {
            await axios.delete(`/admin/delivery/stock/delete/${stockId}?reason=${encodeURIComponent(reason)}`);
            toast.success("Stock Item Deleted!");
            fetchBatchStock(selectedBatch.id);
            fetchInitialData();
        } catch { toast.error("Failed to delete item"); }
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
                businessId: reportFilters.businessId, batchId: reportFilters.batchId, paymentType: reportFilters.paymentType
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

    const getBizLogoUrl = (imageName) => (!imageName || imageName === 'default.png' || imageName === 'null') ? '/logo.png' : `${axios.defaults.baseURL}/storage/icons/${imageName}`;

    // Helper rendering methods for UI parts
    const Breadcrumbs = () => (
        <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm transition-colors text-xs font-bold text-gray-500 dark:text-slate-400">
            <button onClick={() => goToLevel(1)} className={`hover:text-brand-accent transition-colors ${viewLevel === 1 ? 'text-brand-accent font-black' : ''}`}>Businesses</button>
            {selectedBusiness && <>
                <ChevronRight size={14} className="opacity-50"/>
                <button onClick={() => goToLevel(2)} className={`hover:text-brand-accent transition-colors ${viewLevel === 2 ? 'text-brand-accent font-black' : ''}`}>{selectedBusiness.name}</button>
            </>}
            {selectedBatch && <>
                <ChevronRight size={14} className="opacity-50"/>
                <button onClick={() => goToLevel(3)} className={`hover:text-brand-accent transition-colors ${viewLevel === 3 ? 'text-brand-accent font-black' : ''}`}>{selectedBatch.name}</button>
            </>}
            {selectedLecturer && <>
                <ChevronRight size={14} className="opacity-50"/>
                <button onClick={() => goToLevel(4)} className={`hover:text-brand-accent transition-colors ${viewLevel === 4 ? 'text-brand-accent font-black' : ''}`}>{selectedLecturer}</button>
            </>}
            {selectedSubject && <>
                <ChevronRight size={14} className="opacity-50"/>
                <button onClick={() => goToLevel(5)} className={`hover:text-brand-accent transition-colors ${viewLevel === 5 ? 'text-brand-accent font-black' : ''}`}>{selectedSubject.name}</button>
            </>}
            {selectedPaymentGroup && <>
                <ChevronRight size={14} className="opacity-50"/>
                <span className="text-brand-accent font-black">{selectedPaymentGroup}</span>
            </>}
        </div>
    );

    return (
        <div className="w-full text-gray-900 dark:text-slate-200 animate-in fade-in duration-300 font-sans h-[85vh] flex flex-col transition-colors relative z-10">
            
            {/* Top Toolbar */}
            <div className="mb-4 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    {viewLevel > 1 && (
                        <button onClick={() => goToLevel(viewLevel - 1)} className="p-2 bg-white/80 dark:bg-black/30 backdrop-blur-md rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:text-brand-accent dark:hover:text-brand-accent transition-all shadow-sm">
                            <ArrowLeft size={18}/>
                        </button>
                    )}
                    <h2 className="text-2xl font-black text-gray-900 dark:text-slate-100 flex items-center gap-2">
                        <Box size={24} className="text-brand-accent"/>
                        Tute Stock Center
                    </h2>
                </div>
                {!isReadOnly && (
                    <button onClick={() => setShowReportModal(true)} className="bg-brand-accent hover:bg-brand-accentHover text-white px-5 py-2.5 rounded-xl transition-all font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-brand-accent/30 hover:scale-105 active:scale-95 shrink-0">
                        <Download size={16}/> Stock Reports
                    </button>
                )}
            </div>

            <Breadcrumbs />

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
                {loading ? (
                    <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin text-brand-accent" size={36}/></div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* LEVEL 1: BUSINESSES */}
                        {viewLevel === 1 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                                {businesses.map(biz => (
                                    <div key={biz.id} onClick={() => handleBusinessClick(biz)} className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-2xl hover:bg-white dark:hover:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 cursor-pointer group transition-all shadow-sm hover:shadow-xl hover:-translate-y-1">
                                        <div className="w-20 h-20 bg-gray-50 dark:bg-black/40 rounded-2xl flex items-center justify-center p-3 border border-gray-200 dark:border-white/5 shadow-inner transition-colors group-hover:scale-110 duration-300">
                                            <img src={getBizLogoUrl(biz.logo)} alt={biz.name} className="max-w-full max-h-full object-contain drop-shadow-md" />
                                        </div>
                                        <h3 className="font-black text-lg text-gray-900 dark:text-slate-100 text-center line-clamp-1">{biz.name}</h3>
                                        <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-lg">Select Business</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* LEVEL 2: BATCHES */}
                        {viewLevel === 2 && (
                            <>
                                {batches.length === 0 ? (
                                    <div className="text-center py-20 text-gray-500 dark:text-slate-400"><Briefcase size={40} className="mx-auto mb-3 opacity-50"/>No batches found.</div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                        {batches.map(batch => (
                                            <div key={batch.id} onClick={() => handleBatchClick(batch)} className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-3xl p-6 cursor-pointer group transition-all shadow-sm hover:shadow-lg hover:border-brand-accent/50 text-left">
                                                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mb-4 border border-blue-200 dark:border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white transition-colors shadow-sm">
                                                    <GraduationCap size={24} />
                                                </div>
                                                <h3 className="font-black text-xl text-gray-900 dark:text-slate-100 mb-1">{batch.name}</h3>
                                                <p className="text-sm font-bold text-gray-500 dark:text-slate-400 line-clamp-2">{batch.description || 'No description available'}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* LEVEL 3: LECTURERS */}
                        {viewLevel === 3 && (
                            <>
                                {lecturers.length === 0 ? (
                                    <div className="text-center py-20 text-gray-500 dark:text-slate-400"><Users size={40} className="mx-auto mb-3 opacity-50"/>No lecturers found.</div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                        {lecturers.map((lec, idx) => (
                                            <div key={idx} onClick={() => handleLecturerClick(lec)} className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-3xl p-6 cursor-pointer group transition-all shadow-sm hover:shadow-lg hover:border-brand-accent/50 flex items-center gap-5">
                                                <div className="w-16 h-16 bg-gradient-to-br from-brand-accent to-purple-600 rounded-full flex items-center justify-center text-white font-black text-xl shadow-lg shrink-0">
                                                    {lec.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-lg text-gray-900 dark:text-slate-100">{lec}</h3>
                                                    <span className="text-[10px] uppercase tracking-widest font-bold text-brand-accent bg-brand-accent/10 px-2.5 py-0.5 rounded-md mt-1 inline-block">Lecturer</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* LEVEL 4: SUBJECTS */}
                        {viewLevel === 4 && (
                            <>
                                {subjects.length === 0 ? (
                                    <div className="text-center py-20 text-gray-500 dark:text-slate-400"><BookOpen size={40} className="mx-auto mb-3 opacity-50"/>No subjects found.</div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {subjects.map(sub => (
                                            <div key={sub.id} onClick={() => handleSubjectClick(sub)} className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-3xl p-6 cursor-pointer group transition-all shadow-sm hover:shadow-lg hover:border-brand-accent/50 text-left relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-accent/5 dark:bg-brand-accent/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                                                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center mb-4 border border-indigo-200 dark:border-indigo-500/20 shadow-sm relative z-10">
                                                    <BookOpen size={24} />
                                                </div>
                                                <h3 className="font-black text-xl text-gray-900 dark:text-slate-100 mb-1 relative z-10">{sub.name}</h3>
                                                <p className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest relative z-10">Subject / Group</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* LEVEL 5: PAYMENT TYPES */}
                        {viewLevel === 5 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto mt-10">
                                {paymentGroups.map(pg => {
                                    const isMonthly = pg === 'Monthly';
                                    return (
                                        <div key={pg} onClick={() => handlePaymentGroupClick(pg)} className={`bg-white/80 dark:bg-white/[0.02] backdrop-blur-2xl border ${isMonthly ? 'border-blue-200 dark:border-blue-500/20 hover:border-blue-500/50' : 'border-purple-200 dark:border-purple-500/20 hover:border-purple-500/50'} rounded-3xl p-8 cursor-pointer group transition-all shadow-sm hover:shadow-xl text-center relative overflow-hidden`}>
                                            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-5 border shadow-md ${isMonthly ? 'bg-blue-500 text-white border-blue-600' : 'bg-purple-500 text-white border-purple-600'}`}>
                                                <CreditCard size={32} />
                                            </div>
                                            <h3 className="font-black text-2xl text-gray-900 dark:text-slate-100 mb-2">{pg}</h3>
                                            <p className="text-sm font-bold text-gray-500 dark:text-slate-400">View tute stock for {pg} students</p>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* LEVEL 6: STOCKS */}
                        {viewLevel === 6 && (
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
                                                        <div className="w-16 h-24 bg-gray-100 dark:bg-black/40 rounded-xl border border-gray-200 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative">
                                                            <LiveTuteImage stock={stock} />
                                                        </div>
                                                        
                                                        <div className="flex flex-col justify-center min-w-0 flex-1 transition-colors">
                                                            <div className="flex flex-wrap items-center gap-2.5 mb-1.5 min-w-0">
                                                                <h4 className="font-black text-gray-900 dark:text-slate-100 text-base truncate" title={stock.course?.name}>{stock.course?.name || "Extra Material"}</h4>
                                                                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest whitespace-nowrap border shrink-0 transition-colors shadow-sm ${paymentColor}`}>
                                                                    {paymentGroup}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm font-bold text-gray-500 dark:text-slate-400 mt-0.5 truncate transition-colors">{stock.tuteName}</p>
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
                                                                
                                                                <button onClick={() => { setEditData({ id: stock.id, qty: stock.availableQuantity, reason: '' }); setShowEditModal(true); }} className="h-10 w-10 flex items-center justify-center text-gray-400 dark:text-slate-400 hover:text-brand-accent dark:hover:text-brand-accent hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-gray-200 dark:hover:border-white/10" title="Adjust Balance">
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
                                <label className="text-xs font-bold text-gray-500 dark:text-slate-400 mb-2 block uppercase tracking-widest transition-colors">Business</label>
                                <select value={reportFilters.businessId} onChange={e => {setReportFilters({...reportFilters, businessId: e.target.value, batchId: ''}); fetchBatches(e.target.value);}} className="w-full bg-white dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 dark:text-slate-200 outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-colors shadow-inner">
                                    <option value="">All Businesses</option>
                                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
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
        </div>
    );
}