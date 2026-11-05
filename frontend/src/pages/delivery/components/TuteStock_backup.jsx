import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Box, Plus, X, Loader2, ArrowLeft, Building2, Layers, BookOpen, FileText, ChevronRight, AlertTriangle, Edit3, Edit2, Trash2, BarChart3, Download, Filter, Check } from 'lucide-react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';

// SMART IMAGE COMPONENT
const LiveTuteImage = ({ stock }) => {
    const [imgSrc, setImgSrc] = useState(null);
    const [errorStage, setErrorStage] = useState(0);

    useEffect(() => {
        let coverName = stock.tuteImage; 
        if (stock.course?.groupPrices && stock.course?.groupId) {
            try {
                const gp = JSON.parse(stock.course.groupPrices);
                const match = gp.find(g => parseInt(g.groupId) === parseInt(stock.course.groupId));
                if (match && match.tuteCover && match.tuteCover !== 'default-tute.png' && match.tuteCover !== 'null') {
                    coverName = match.tuteCover;
                }
            } catch(e) {}
        }
        if (!coverName || coverName === 'default-tute.png' || coverName === 'null') {
            setImgSrc(null);
        } else {
            const baseUrl = axios.defaults.baseURL.replace('/api', '');
            setImgSrc(`${baseUrl}/storage/documents/${coverName}`);
        }
    }, [stock]);

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

export default function TuteStock({ searchQuery, isReadOnly }) {
    const [viewLevel, setViewLevel] = useState('businesses');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [businesses, setBusinesses] = useState([]);
    const [batches, setBatches] = useState([]);
    const [batchStock, setBatchStock] = useState([]);
    const [globalStock, setGlobalStock] = useState([]);
    const [selectedBiz, setSelectedBiz] = useState('');
    const [selectedBatch, setSelectedBatch] = useState('');
    const [stockInputs, setStockInputs] = useState({}); 
    const [viewPaymentFilter, setViewPaymentFilter] = useState('ALL');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState({ id: null, qty: '', reason: '' });
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportFilters, setReportFilters] = useState({ dateType: 'this_month', startDate: '', endDate: '', businessId: '', batchId: '', paymentType: '' });
    const [reportData, setReportData] = useState([]);
    const [reportLoading, setReportLoading] = useState(false);

    useEffect(() => {
        fetchInitialData();
        setMonthDates('this_month');
    }, []);

    useEffect(() => {
        if (selectedBiz) fetchBatches(selectedBiz);
        else { setBatches([]); setSelectedBatch(''); setBatchStock([]); }
    }, [selectedBiz]);

    useEffect(() => {
        if (selectedBatch) fetchBatchStock(selectedBatch);
        else setBatchStock([]);
    }, [selectedBatch]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const bizRes = await axios.get('/admin/businesses');
            setBusinesses(bizRes.data?.data || bizRes.data || []);
            const stockRes = await axios.get('/admin/delivery/stock/global');
            setGlobalStock(stockRes.data || []);
        } catch (error) { toast.error("Failed to load dashboard data"); } 
        finally { setLoading(false); }
    };

    const fetchBatches = async (bizId) => {
        if (!bizId) return; 
        try {
            const res = await axios.get(`/admin/batches/${bizId}`);
            setBatches(res.data?.batches || res.data || []);
            setSelectedBatch('');
            setViewLevel('batches');
        } catch (error) { toast.error("Failed to load batches"); }
    };

    const fetchBatchStock = async (batchId) => {
        if (!batchId) return;
        setLoading(true);
        try {
            const res = await axios.get(`/admin/delivery/stock/batch/${batchId}`);
            setBatchStock(res.data || []);
            setViewLevel('stock');
        } catch (error) { toast.error("Failed to load stock data"); } 
        finally { setLoading(false); }
    };

    const handleAddStock = async (stockId) => {
        const qty = parseInt(stockInputs[stockId]);
        if (!qty || isNaN(qty) || qty <= 0) return toast.error("Enter a valid quantity!");
        setActionLoading(true);
        try {
            await axios.post('/admin/delivery/stock/add', { stockId, quantity: qty, reason: "New printed stock added" });
            toast.success("Stock Added Successfully!");
            setStockInputs(prev => ({ ...prev, [stockId]: '' }));
            fetchBatchStock(selectedBatch);
            fetchInitialData(); 
        } catch (error) { toast.error("Failed to update stock"); } 
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
            fetchBatchStock(selectedBatch);
            fetchInitialData();
        } catch (error) { toast.error("Failed to adjust stock"); } 
        finally { setActionLoading(false); }
    };

    const handleDeleteStock = async (stockId) => {
        const reason = window.prompt("Why are you deleting this item? (Required)");
        if (!reason) return toast.error("Deletion cancelled.");
        try {
            await axios.delete(`/admin/delivery/stock/delete/${stockId}?reason=${encodeURIComponent(reason)}`);
            toast.success("Stock Item Deleted!");
            fetchBatchStock(selectedBatch);
            fetchInitialData();
        } catch (error) { toast.error("Failed to delete item"); }
    };

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
        } catch (error) { toast.error("Failed to generate report"); } 
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

    const globalLowStock = globalStock.filter(s => s.availableQuantity <= 10 && s.availableQuantity > 0);
    const globalOutStock = globalStock.filter(s => s.availableQuantity === 0);

    const filteredBatchStock = batchStock.filter(stock => {
        if (viewPaymentFilter === 'ALL') return true;
        const groupType = stock.course?.group?.type;
        if (viewPaymentFilter === 'Monthly') return groupType === 1;
        if (viewPaymentFilter === 'Full') return groupType === 2;
        return true;
    });

    return (
        <div className="w-full text-gray-900 dark:text-slate-200 animate-in fade-in duration-300 font-sans h-[85vh] flex flex-col transition-colors relative z-10">
            
            {/* 🔥 Glassmorphic Top Controls 🔥 */}
            <div className="mb-6 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl p-5 rounded-2xl border border-gray-200 dark:border-white/10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shadow-lg shrink-0 transition-colors">
                <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                    <div className="flex-1 relative">
                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400 mb-1.5 block transition-colors">Select Business</label>
                        <select value={selectedBiz} onChange={e => setSelectedBiz(e.target.value)} className="w-full sm:w-56 bg-white/80 dark:bg-black/40 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-slate-200 outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-all appearance-none cursor-pointer shadow-sm font-semibold">
                            <option value="">-- Choose Business --</option>
                            {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 relative">
                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400 mb-1.5 block transition-colors">Select Batch</label>
                        <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)} disabled={!selectedBiz} className="w-full sm:w-56 bg-white/80 dark:bg-black/40 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-slate-200 outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-all disabled:opacity-50 appearance-none cursor-pointer shadow-sm font-semibold">
                            <option value="">-- Choose Batch --</option>
                            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>

                    {selectedBatch && (
                        <div className="flex-1 relative animate-in fade-in slide-in-from-left-4">
                            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 mb-1.5 flex items-center gap-1 transition-colors"><Filter size={12}/> Filter by Payment</label>
                            <select value={viewPaymentFilter} onChange={e => setViewPaymentFilter(e.target.value)} className="w-full sm:w-56 bg-white/80 dark:bg-black/40 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-slate-200 outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-all appearance-none cursor-pointer shadow-sm font-semibold">
                                <option value="ALL">All Payments (Monthly + Full)</option>
                                <option value="Monthly">Monthly Payments Only</option>
                                <option value="Full">Full Payments Only</option>
                            </select>
                        </div>
                    )}
                </div>

                {!isReadOnly && (
                    <button onClick={() => setShowReportModal(true)} className="bg-brand-accent hover:bg-brand-accentHover text-white px-6 py-3 rounded-xl transition-all font-black text-sm flex items-center gap-2 w-full xl:w-auto justify-center mt-2 xl:mt-0 shrink-0 shadow-lg shadow-brand-accent/30 hover:scale-105 active:scale-95">
                        <Download size={18}/> Stock Reports
                    </button>
                )}
            </div>

            <div className="flex-1 flex flex-col min-h-0 relative">
                {!selectedBatch ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-white/50 dark:bg-white/[0.02] backdrop-blur-xl border border-gray-200 dark:border-white/5 rounded-[2rem] transition-colors shadow-sm">
                        <div className="w-24 h-24 bg-brand-accentLight/80 dark:bg-brand-accent/10 border border-brand-accent/20 rounded-3xl flex items-center justify-center mb-6 transition-colors shadow-md backdrop-blur-md"><Box className="text-brand-accent" size={40}/></div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-slate-100 mb-3 transition-colors">Inventory Management</h2>
                        <p className="text-gray-500 dark:text-slate-400 text-sm max-w-md mx-auto mb-10 font-bold transition-colors">Select a Business and a Batch from the top menu to easily add and manage tute stocks for subjects.</p>
                        
                        <div className="flex flex-wrap justify-center gap-5">
                            <div className="bg-white/80 dark:bg-black/20 backdrop-blur-md border border-gray-200 dark:border-white/10 p-5 rounded-2xl flex flex-col items-center min-w-[160px] transition-colors shadow-sm">
                                <span className="text-3xl font-black text-gray-900 dark:text-slate-100 mb-1.5 transition-colors">{globalStock.length}</span>
                                <span className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-widest transition-colors">Total Subjects</span>
                            </div>
                            <div className="bg-orange-50/80 dark:bg-orange-500/10 backdrop-blur-md border border-orange-200 dark:border-orange-500/20 p-5 rounded-2xl flex flex-col items-center min-w-[160px] transition-colors shadow-sm">
                                <span className="text-3xl font-black text-orange-600 dark:text-orange-400 mb-1.5 transition-colors">{globalLowStock.length}</span>
                                <span className="text-xs text-orange-600 dark:text-orange-500/80 font-bold uppercase tracking-widest transition-colors">Low Stock Items</span>
                            </div>
                            <div className="bg-red-50/80 dark:bg-red-500/10 backdrop-blur-md border border-red-200 dark:border-red-500/20 p-5 rounded-2xl flex flex-col items-center min-w-[160px] transition-colors shadow-sm">
                                <span className="text-3xl font-black text-red-600 dark:text-red-400 mb-1.5 transition-colors">{globalOutStock.length}</span>
                                <span className="text-xs text-red-600 dark:text-red-500/80 font-bold uppercase tracking-widest transition-colors">Out of Stock</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
                        <div className="mb-6 flex items-center justify-between pb-4 border-b border-gray-200 dark:border-white/10 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-brand-accentLight dark:bg-brand-accent/20 rounded-xl border border-brand-accent/20">
                                    <BookOpen size={22} className="text-brand-accent transition-colors"/>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-slate-100 transition-colors">Update Batch Inventory</h3>
                                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 font-bold transition-colors">Quickly adjust current stock quantities for the selected batch.</p>
                                </div>
                            </div>
                            <div className="bg-white/80 dark:bg-black/30 backdrop-blur-md px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-600 dark:text-slate-300 transition-colors shadow-sm">
                                Showing <span className="text-brand-accent font-black transition-colors mx-1">{filteredBatchStock.length}</span> Subjects
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-accent" size={32}/></div>
                        ) : filteredBatchStock.length === 0 ? (
                            <div className="text-center py-24 bg-white/50 dark:bg-white/[0.02] backdrop-blur-xl rounded-[2rem] border border-gray-200 dark:border-white/5 transition-colors shadow-sm">
                                <FileText size={40} className="text-gray-400 dark:text-slate-600 mx-auto mb-4 transition-colors opacity-50"/>
                                <p className="text-gray-500 dark:text-slate-400 text-base font-bold transition-colors">No inventory items found for this selection.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                                {filteredBatchStock.map(stock => {
                                    const isLow = stock.availableQuantity <= 10;
                                    const paymentGroup = stock.course?.group?.type === 1 ? 'Monthly' : stock.course?.group?.type === 2 ? 'Full Payment' : 'Unknown';
                                    const paymentColor = stock.course?.group?.type === 1 ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30' : 'bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30';
                                    
                                    return (
                                        /* 🔥 Glassmorphic Inventory Card 🔥 */
                                        <div key={stock.id} className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-2xl hover:bg-white dark:hover:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-[1.5rem] p-5 flex flex-col md:flex-row items-center justify-between gap-5 transition-all group shadow-sm hover:shadow-lg overflow-hidden">
                                            
                                            {/* Left: Tute Info (Flexible) */}
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
                                            
                                            {/* Right: Actions (Fixed space) */}
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
                    </div>
                )}
            </div>

            {/* 🔥 Glassmorphic Modals 🔥 */}
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