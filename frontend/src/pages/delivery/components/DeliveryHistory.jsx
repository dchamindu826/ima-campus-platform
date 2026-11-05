import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Calendar, ChevronLeft, ChevronRight, CheckCircle, X, Globe, Copy, Loader2, Download, CreditCard, Printer, BookOpen, MessageSquare, Edit3 } from 'lucide-react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';

export default function DeliveryHistory({ isReadOnly }) {
    const [loading, setLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [businesses, setBusinesses] = useState([]);
    const [batches, setBatches] = useState([]);
    
    // Pagination & Filters
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filters, setFilters] = useState({
        search: '', businessId: '', batchId: '', paymentType: '', status: '', startDate: '', endDate: ''
    });

    const [isIframeOpen, setIsIframeOpen] = useState(false);
    const [confirmingId, setConfirmingId] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null);

    // Edit Tracking State
    const [editModal, setEditModal] = useState(null);
    const [trackingInput, setTrackingInput] = useState('');
    const [remarkInput, setRemarkInput] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    // Proxy URL for Courier
    const COURIER_URL = `${axios.defaults.baseURL.replace('/api', '')}/api/courier-proxy/client/signIn.php#you_must_login_first`;

    useEffect(() => {
        fetchBusinesses();
    }, []);

    useEffect(() => {
        if (filters.businessId) fetchBatches(filters.businessId);
        else setBatches([]);
    }, [filters.businessId]);

    useEffect(() => {
        const delay = setTimeout(() => { fetchHistory(); }, 500);
        return () => clearTimeout(delay);
    }, [page, filters]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && confirmModal) {
                e.preventDefault();
                handleManualConfirm(confirmModal);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [confirmModal]);

    const fetchBusinesses = async () => {
        try {
            const res = await axios.get('/admin/businesses');
            setBusinesses(res.data?.data || res.data || []);
        } catch (error) { console.error(error); }
    };

    const fetchBatches = async (bizId) => {
        try {
            const res = await axios.get(`/admin/batches/${bizId}`);
            setBatches(res.data?.batches || res.data || []);
        } catch (error) { console.error(error); }
    };

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 15, ...filters });
            const res = await axios.get(`/admin/delivery/history-advanced?${params.toString()}`);
            setHistoryData(res.data.data || []);
            setTotalPages(res.data.totalPages || 1);
        } catch (error) { toast.error("Failed to load history data"); } 
        finally { setLoading(false); }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1); 
    };

    const copyToClipboard = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        toast.success(`Copied: ${text}`, { style: { background: '#1e293b', color: '#fff' }});
    };

    const handleExportCSV = async () => {
        setExportLoading(true);
        try {
            const params = new URLSearchParams({ page: 1, limit: 10000, ...filters });
            const res = await axios.get(`/admin/delivery/history-advanced?${params.toString()}`);
            const data = res.data.data;

            if (!data || data.length === 0) {
                toast.error("No data available to export!");
                setExportLoading(false);
                return;
            }

            const headers = ["Order ID", "Student Name", "Phone", "Address", "Business", "Batch", "Payment Type", "Status", "Tracking Number", "Subjects Included"];
            
            const csvRows = data.map(row => {
                const subjectsStr = row.items ? row.items.map(i => `${i.tuteName} (x${i.quantity})`).join(' | ') : 'N/A';
                
                return [
                    `ORD-${row.id}`,
                    `"${row.studentName}"`,
                    `"${row.phone}"`,
                    `"${row.address || 'N/A'}"`, 
                    `"${row.businessName}"`,
                    `"${row.batchName}"`,
                    `"${row.paymentType}"`,
                    `"${row.status}"`,
                    `"${row.trackingNumber || 'N/A'}"`,
                    `"${subjectsStr}"`
                ].join(',');
            });

            const csvContent = [headers.join(','), ...csvRows].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `Delivery_Export_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Export successful!");
        } catch (error) {
            toast.error("Failed to export data");
        } finally {
            setExportLoading(false);
        }
    };

    const handleManualConfirm = async (deliveryId) => {
        setConfirmingId(deliveryId);
        try {
            await axios.put(`/admin/delivery/manual-confirm/${deliveryId}`);
            toast.success("Order marked as Delivered!");
            setConfirmModal(null);
            fetchHistory(); 
        } catch (error) {
            toast.error("Failed to update status");
        } finally {
            setConfirmingId(null);
        }
    };
    const handleUpdateTracking = async () => {
        if (!editModal) return;
        setIsUpdating(true);
        try {
            await axios.put(`/admin/delivery/update-tracking/${editModal.id}`, {
                trackingNumber: trackingInput,
                packRemark: remarkInput
            });
            toast.success("Tracking info updated successfully!");
            setEditModal(null);
            fetchHistory();
        } catch (error) {
            toast.error("Failed to update tracking info");
        } finally {
            setIsUpdating(false);
        }
    };

    // 🔥 Print Label Function for History 🔥
    const printLabel = (order) => {
        const baseUrl = window.location.origin; 
        const bgImageUrl = `${baseUrl}/sticker-bg.png`; 
        const windowPrint = window.open('', '', 'width=850,height=500');
        
        windowPrint.document.write(`
            <html>
                <head>
                    <title>Print Label - ${order.id}</title>
                    <style>
                        @page { size: 2in 4in; margin: 0; }
                        body { 
                            font-family: 'Arial', sans-serif; 
                            margin: 0; padding: 0;
                            width: 2in; height: 4in; 
                            -webkit-print-color-adjust: exact !important; 
                        }
                        .label-container {
                            width: 2in; 
                            height: 4in;
                            background-image: url('${bgImageUrl}');
                            background-size: 100% 100%;
                            background-repeat: no-repeat;
                            position: relative;
                            overflow: hidden;
                        }
                        .content-wrapper {
                            position: absolute;
                            width: 4in;
                            height: 2in;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%) rotate(-90deg);
                        }
                        .details-block {
                            position: absolute;
                            top: 5mm; 
                            left: 8mm; 
                            width: 80mm;
                            display: flex;
                            flex-direction: column;
                            gap: 4px; 
                        }
                        .text-item { 
                            font-size: 9pt; 
                            font-weight: bold; 
                            line-height: 1.4;
                            color: black;
                        }
                        .ref-id {
                            position: absolute;
                            bottom: 3mm;
                            right: 5mm;
                            font-size: 8pt;
                            font-weight: bold;
                            color: black;
                        }
                    </style>
                </head>
                <body>
                    <div class="label-container">
                        <div class="content-wrapper">
                            <div class="details-block">
                                <div class="text-item">${order.studentName || 'Student'}</div>
                                <div class="text-item">${order.labelAddress || order.address || 'No Address Provided'}</div>
                                <div class="text-item">${order.phone || 'No Phone'}</div>
                            </div>
                            <div class="ref-id">REF: ${order.id}</div>
                        </div>
                    </div>
                </body>
            </html>
        `);
        windowPrint.document.close();
        windowPrint.focus();
        
        setTimeout(() => { 
            windowPrint.print(); 
            windowPrint.close(); 
        }, 500);
    };

    return (
        <div className="animate-fade-in font-sans h-[85vh] flex flex-col gap-5 relative z-10">
            
            {/* 🔥 Glassmorphic Filters Section 🔥 */}
            <div className="bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl p-5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-lg flex flex-col lg:flex-row justify-between gap-4 shrink-0 items-start lg:items-center transition-colors">
                
                <div className="flex flex-wrap items-center gap-3 w-full lg:flex-1">
                    <div className="relative min-w-[200px] flex-1 lg:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400" size={16}/>
                        <input 
                            type="text" placeholder="Search ID, Student..." 
                            value={filters.search} onChange={e => handleFilterChange('search', e.target.value)}
                            className="w-full bg-white/80 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-colors shadow-sm"
                        />
                    </div>

                    <select value={filters.businessId} onChange={e => handleFilterChange('businessId', e.target.value)} className="min-w-[140px] flex-1 lg:flex-none bg-white/80 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-700 dark:text-slate-300 outline-none focus:border-brand-accent transition-colors shadow-sm">
                        <option value="">All Businesses</option>
                        {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>

                    <select value={filters.batchId} onChange={e => handleFilterChange('batchId', e.target.value)} disabled={!filters.businessId} className="min-w-[140px] flex-1 lg:flex-none bg-white/80 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-700 dark:text-slate-300 outline-none focus:border-brand-accent disabled:opacity-50 transition-colors shadow-sm">
                        <option value="">All Batches</option>
                        {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>

                    <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="min-w-[140px] flex-1 lg:flex-none bg-white/80 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-700 dark:text-slate-300 outline-none focus:border-brand-accent transition-colors shadow-sm">
                        <option value="">All Statuses</option>
                        <option value="Packed">Packed</option>
                        <option value="Dispatched">Dispatched (On the way)</option>
                        <option value="Delivered">Delivered (Received)</option>
                        <option value="Not Received">Not Received</option>
                        <option value="Returned">Returned</option>
                    </select>

                    <div className="flex items-center bg-white/80 dark:bg-black/40 rounded-xl border border-gray-200 dark:border-white/10 p-1 shrink-0 w-full sm:w-auto shadow-sm transition-colors">
                        <Calendar className="text-gray-400 dark:text-slate-400 ml-2" size={14}/>
                        <input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} className="bg-transparent text-sm text-gray-700 dark:text-slate-300 outline-none px-2 py-1.5 [color-scheme:light] dark:[color-scheme:dark] w-full sm:w-auto"/>
                        <span className="text-gray-400 dark:text-slate-500">-</span>
                        <input type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)} className="bg-transparent text-sm text-gray-700 dark:text-slate-300 outline-none px-2 py-1.5 [color-scheme:light] dark:[color-scheme:dark] w-full sm:w-auto"/>
                        {(filters.startDate || filters.endDate) && (
                            <button onClick={() => {handleFilterChange('startDate', ''); handleFilterChange('endDate', '');}} className="mr-2 text-gray-400 hover:text-red-500 transition-colors"><X size={16}/></button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto shrink-0 justify-end mt-2 lg:mt-0 pt-2 lg:pt-0 transition-colors">
                    <button 
                        onClick={() => setIsIframeOpen(!isIframeOpen)}
                        className={`px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-md border flex items-center justify-center gap-2 flex-1 lg:flex-none ${isIframeOpen ? 'bg-brand-accent text-white border-brand-accentHover' : 'bg-white/80 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-white/10'}`}
                    >
                        <Globe size={18}/> Web
                    </button>
                    <button 
                        onClick={handleExportCSV}
                        disabled={exportLoading}
                        className="px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-md border flex items-center justify-center gap-2 bg-emerald-500/90 dark:bg-emerald-500/20 text-white dark:text-emerald-400 hover:bg-emerald-600 dark:hover:bg-emerald-500/30 border-emerald-500/30 disabled:opacity-50 flex-1 lg:flex-none"
                    >
                        {exportLoading ? <Loader2 size={18} className="animate-spin"/> : <Download size={18}/>}
                        Export
                    </button>
                </div>
            </div>

            {/* Split Content Area */}
            <div className="flex flex-col lg:flex-row flex-1 gap-5 min-h-0">
                
                {/* 🔥 Glassmorphic Table Container 🔥 */}
                <div className={`flex flex-col bg-white/60 dark:bg-white/[0.02] backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-xl overflow-hidden transition-all duration-500 ${isIframeOpen ? 'w-full lg:w-[55%] xl:w-[60%]' : 'w-full'}`}>
                    <div className="overflow-y-auto custom-scrollbar flex-1">
                        <table className="w-full text-left border-collapse min-w-[950px]">
                            <thead className="bg-white/80 dark:bg-black/40 backdrop-blur-md sticky top-0 z-10 transition-colors">
                                <tr className="text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-white/10">
                                    <th className="p-5 font-black whitespace-nowrap">Packed Date / ID</th>
                                    <th className="p-5 font-black whitespace-nowrap">Student</th>
                                    <th className="p-5 font-black whitespace-nowrap">Subjects</th>
                                    <th className="p-5 font-black whitespace-nowrap">Plan Type</th>
                                    <th className="p-5 font-black whitespace-nowrap">Batch & Status</th>
                                    <th className="p-5 font-black whitespace-nowrap">Tracking</th>
                                    <th className="p-5 font-black text-center whitespace-nowrap">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5 transition-colors">
                                {loading ? (
                                    <tr><td colSpan="7" className="p-10 text-center"><Loader2 className="animate-spin text-brand-accent mx-auto" size={30}/></td></tr>
                                ) : historyData.length === 0 ? (
                                    <tr><td colSpan="7" className="p-10 text-center text-gray-500 dark:text-slate-400 font-bold">No history data found.</td></tr>
                                ) : (
                                    historyData.map((row) => (
                                        <tr key={row.id} className="hover:bg-white/40 dark:hover:bg-white/[0.05] transition-colors">
                                            <td className="p-4 pl-5 font-black text-gray-900 dark:text-white text-sm whitespace-nowrap">
                                                {row.packedAt ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span>{new Date(row.packedAt).toLocaleDateString()}</span>
                                                        <span className="text-[10px] text-gray-500 font-bold uppercase">ORD-{row.id}</span>
                                                    </div>
                                                ) : (
                                                    <span>ORD-{row.id}</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2 group/remark relative w-max">
                                                    <p className="text-sm font-bold text-gray-800 dark:text-slate-200 truncate max-w-[150px]">{row.studentName}</p>
                                                    {row.packRemark && (
                                                        <>
                                                            <div className="text-brand-accent cursor-help bg-brand-accent/10 p-1 rounded-md border border-brand-accent/20">
                                                                <MessageSquare size={12} />
                                                            </div>
                                                            <div className="absolute top-full left-0 mt-2 w-max max-w-[250px] hidden group-hover/remark:block z-[9999] bg-white/95 dark:bg-black/90 backdrop-blur-xl border border-gray-200 dark:border-white/10 shadow-xl p-3 rounded-xl transition-colors">
                                                                <p className="text-[10px] font-black text-gray-500 dark:text-slate-400 mb-1 uppercase tracking-widest">Internal Remark</p>
                                                                <p className="text-xs font-bold text-gray-800 dark:text-slate-200">{row.packRemark}</p>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">{row.phone}</p>
                                            </td>
                                            
                                            <td className="p-4">
                                                {row.items && row.items.length > 0 ? (
                                                    <div className="relative group/subject flex flex-wrap gap-1.5 w-max">
                                                        <span className="bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-slate-300 text-[10px] font-bold px-2.5 py-1 rounded border border-gray-200 dark:border-white/5 truncate max-w-[140px] transition-colors flex items-center gap-1.5">
                                                            <BookOpen size={10} className="text-brand-accent"/> {row.items[0].tuteName}
                                                        </span>
                                                        {row.items.length > 1 && (
                                                            <span className="bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-slate-300 text-[10px] font-bold px-2 py-1 rounded cursor-help shadow-sm border border-gray-300 dark:border-white/5 transition-colors">
                                                                +{row.items.length - 1} More
                                                            </span>
                                                        )}
                                                        
                                                        {row.items.length > 1 && (
                                                            <div className="absolute top-full left-0 mt-2 w-max max-w-[250px] hidden group-hover/subject:block z-[9999] bg-white/95 dark:bg-black/90 backdrop-blur-xl border border-gray-200 dark:border-white/10 shadow-xl p-3 rounded-xl transition-colors">
                                                                <p className="text-[10px] font-black text-gray-500 dark:text-slate-400 mb-2 uppercase tracking-widest">Included Subjects</p>
                                                                <ul className="space-y-1.5">
                                                                    {row.items.map((item, idx) => (
                                                                        <li key={idx} className="text-xs font-bold text-gray-800 dark:text-slate-200 bg-gray-50 dark:bg-white/5 p-2 rounded-lg border border-gray-100 dark:border-white/5 flex justify-between items-center gap-3 transition-colors">
                                                                            <span className="truncate">{item.tuteName}</span> 
                                                                            <span className="text-brand-accent bg-brand-accentLight dark:bg-brand-accent/10 border border-brand-accent/20 px-1.5 py-0.5 rounded text-[10px]">x{item.quantity}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 dark:text-slate-500 text-xs font-bold">N/A</span>
                                                )}
                                            </td>

                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <CreditCard size={14} className={
                                                        row.paymentType === 'Monthly' ? 'text-brand-accent' 
                                                        : row.paymentType === 'Installment' ? 'text-purple-500 dark:text-purple-400' 
                                                        : 'text-orange-500 dark:text-orange-400'
                                                    }/>
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border transition-colors shadow-sm
                                                        ${row.paymentType === 'Monthly' ? 'bg-brand-accentLight dark:bg-brand-accent/10 text-brand-accent border-brand-accent/20' 
                                                        : row.paymentType === 'Installment' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20'
                                                        : 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20'}`}>
                                                        {row.paymentType || 'N/A'}
                                                    </span>
                                                </div>
                                            </td>
                                            
                                            <td className="p-4">
                                                <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-widest mb-1.5 transition-colors">{row.batchName}</p>
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border transition-colors shadow-sm
                                                    ${row.status === 'Received' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' 
                                                    : row.status === 'Hold' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20'
                                                    : row.status === 'Pending' ? 'bg-gray-100 dark:bg-slate-500/10 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-500/20'
                                                    : row.status === 'Not Received' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'
                                                    : row.status === 'Returned' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                                                    : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'}`}>
                                                    {row.status === 'Received' ? 'Delivered' : row.status}
                                                </span>
                                            </td>

                                            <td className="p-4">
                                                <div className="flex items-start justify-between gap-3 group/tracking relative">
                                                    <div>
                                                        {row.trackingNumber ? (
                                                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-black/30 w-max px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/5 transition-colors">
                                                                <span className="text-emerald-600 dark:text-emerald-400 font-black text-xs tracking-widest">{row.trackingNumber}</span>
                                                                <button onClick={() => copyToClipboard(row.trackingNumber)} className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1 bg-white dark:bg-white/5 border border-gray-200 dark:border-transparent rounded-md shadow-sm" title="Copy">
                                                                    <Copy size={12}/>
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 dark:text-slate-500 font-bold text-xs bg-gray-50 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/5 transition-colors">N/A</span>
                                                        )}
                                                        {row.packRemark && (
                                                            <div className="mt-2 text-[10px] bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 p-2 rounded-lg border border-yellow-200 dark:border-yellow-500/20 max-w-[180px] break-words">
                                                                <span className="font-black uppercase tracking-widest block mb-0.5 text-[9px]">Remark:</span>
                                                                {row.packRemark}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!isReadOnly && (
                                                        <button 
                                                            onClick={() => {
                                                                setTrackingInput(row.trackingNumber || '');
                                                                setRemarkInput(row.packRemark || '');
                                                                setEditModal(row);
                                                            }}
                                                            className="opacity-0 group-hover/tracking:opacity-100 transition-opacity bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-400 hover:text-brand-accent dark:text-slate-400 dark:hover:text-brand-accent p-1.5 rounded-md border border-gray-200 dark:border-transparent shadow-sm shrink-0" 
                                                            title="Edit Tracking & Remark"
                                                        >
                                                            <Edit3 size={14}/>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="p-4 text-center">
                                                {/* 🔥 Action Buttons: Confirm & Print 🔥 */}
                                                <div className="flex items-center justify-center gap-2">
                                                    <button 
                                                        onClick={() => printLabel(row)} 
                                                        className="bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 p-2 rounded-lg transition-colors border border-gray-200 dark:border-white/5 shadow-sm" 
                                                        title="Print Sticker"
                                                    >
                                                        <Printer size={16} />
                                                    </button>
                                                    {row.status !== 'Received' ? (
                                                        !isReadOnly ? (
                                                            <button 
                                                                onClick={() => setConfirmModal(row.id)}
                                                                className="bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-400 hover:text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-500/30 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                                            >
                                                                <CheckCircle size={14}/> Confirm
                                                            </button>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 uppercase tracking-widest transition-colors shadow-sm">
                                                                Pending
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-500/20 uppercase tracking-widest transition-colors flex items-center gap-1.5 shadow-sm">
                                                            <CheckCircle size={14}/> Done
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="bg-white/80 dark:bg-black/40 backdrop-blur-md p-4 border-t border-gray-200 dark:border-white/10 flex justify-between items-center shrink-0 transition-colors">
                            <span className="text-sm text-gray-500 dark:text-slate-400 font-bold">Page <strong className="text-gray-900 dark:text-white">{page}</strong> of <strong className="text-gray-900 dark:text-white">{totalPages}</strong></span>
                            <div className="flex gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50 text-gray-700 dark:text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-colors border border-gray-200 dark:border-white/5 shadow-sm"><ChevronLeft size={16}/> Prev</button>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50 text-gray-700 dark:text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-colors border border-gray-200 dark:border-white/5 shadow-sm">Next <ChevronRight size={16}/></button>
                            </div>
                        </div>
                    )}
                </div>

                {isIframeOpen && (
                    <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col bg-white/60 dark:bg-white/[0.02] backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-[2rem] overflow-hidden shadow-xl animate-in slide-in-from-right-8 duration-500 min-h-[500px] lg:min-h-0 transition-colors">
                        <div className="bg-white/80 dark:bg-black/40 backdrop-blur-md p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center shrink-0 transition-colors">
                            <span className="text-brand-accent font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                <Globe size={18}/> Courier Portal
                            </span>
                            <button onClick={() => setIsIframeOpen(false)} className="text-gray-400 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 bg-gray-100 dark:bg-white/5 p-2 rounded-xl transition-colors shadow-sm">
                                <X size={18}/>
                            </button>
                        </div>
                        <div className="flex-1 w-full relative">
                            <div className="absolute inset-0 flex items-center justify-center z-0 transition-colors">
                                <Loader2 size={30} className="animate-spin text-gray-400 dark:text-slate-500"/>
                            </div>
                            <iframe 
                                src={COURIER_URL} 
                                sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                                className="w-full h-full relative z-10 border-0" 
                                title="Courier Tracking"
                            />
                        </div>
                    </div>
                )}

            </div>

            {confirmModal && createPortal(
                <div className="fixed inset-0 z-[99999] bg-gray-900/60 dark:bg-[#0a0f1c]/90 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in transition-colors">
                    <div className="bg-white dark:bg-[#15192b] border border-gray-200 dark:border-emerald-500/30 rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 flex flex-col items-center text-center transition-colors">
                        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center border-2 border-emerald-200 dark:border-emerald-500/30 text-emerald-500 dark:text-emerald-400 mb-4 shadow-sm dark:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-colors">
                            <CheckCircle size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 transition-colors">Are you sure?</h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 font-medium leading-relaxed transition-colors">
                            You are about to manually mark Order <strong className="text-gray-900 dark:text-white">ORD-{confirmModal}</strong> as Delivered.
                            <br/><br/>
                            <span className="bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-md text-xs border border-gray-200 dark:border-transparent transition-colors">Press <strong className="text-gray-900 dark:text-white">Enter</strong> to confirm</span>
                        </p>
                        <div className="flex gap-3 w-full">
                            <button onClick={() => setConfirmModal(null)} className="flex-1 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-white border border-gray-200 dark:border-transparent font-bold py-3.5 rounded-xl transition-all text-sm shadow-sm dark:shadow-none">Cancel</button>
                            <button onClick={() => handleManualConfirm(confirmModal)} disabled={confirmingId === confirmModal} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl transition-all shadow-md text-sm flex justify-center items-center gap-2">
                                {confirmingId === confirmModal ? <Loader2 size={16} className="animate-spin"/> : "Yes, Confirm"}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* 🔥 Edit Tracking & Remark Modal 🔥 */}
            {editModal && createPortal(
                <div className="fixed inset-0 z-[99999] bg-slate-900/60 dark:bg-slate-900/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-brand-darkCard border border-gray-200 dark:border-brand-darkBorder rounded-[2rem] p-6 md:p-8 w-full max-w-md shadow-2xl transition-colors">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                                <Edit3 className="text-brand-accent" size={24} /> Edit Tracking Details
                            </h3>
                            <button onClick={() => setEditModal(null)} className="text-gray-400 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors bg-gray-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-white/10 p-2 rounded-xl outline-none"><X size={20} /></button>
                        </div>
                        
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-xs text-gray-600 dark:text-slate-400 font-extrabold uppercase tracking-widest mb-1.5 block">Tracking Number</label>
                                <input
                                    type="text"
                                    value={trackingInput}
                                    onChange={(e) => setTrackingInput(e.target.value)}
                                    placeholder="e.g. DPD-883719"
                                    className="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-colors shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-600 dark:text-slate-400 font-extrabold uppercase tracking-widest mb-1.5 block">Internal Remark (Optional)</label>
                                <textarea
                                    value={remarkInput}
                                    onChange={(e) => setRemarkInput(e.target.value)}
                                    placeholder="Any special notes..."
                                    rows="3"
                                    className="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-colors shadow-sm custom-scrollbar resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setEditModal(null)} className="flex-1 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-white font-extrabold py-3.5 rounded-xl transition-all shadow-sm">Cancel</button>
                            <button 
                                onClick={handleUpdateTracking} 
                                disabled={isUpdating}
                                className="flex-1 bg-brand-accent hover:bg-brand-accentDark text-white font-extrabold py-3.5 rounded-xl shadow-lg shadow-brand-accent/30 hover:shadow-brand-accent/50 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {isUpdating ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />} Update
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}