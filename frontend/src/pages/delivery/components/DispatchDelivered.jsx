import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Truck, CheckCircle, ArrowLeft, Loader2, Package, Eye, X, BookOpen, MapPin, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';
import { ClassTagBadge, ClassTagFilter, matchesClassTag } from './ClassTag';

export default function DispatchDelivered({ searchQuery }) {
    // SMART IMAGE COMPONENT FOR PENDING ITEMS
    const DeliveryItemImage = ({ coverName }) => {
        const [imgSrc, setImgSrc] = useState(null);
        const [errorStage, setErrorStage] = useState(0);

        useEffect(() => {
            if (!coverName || coverName === 'default-tute.png' || coverName === 'null') {
                setImgSrc(null);
            } else {
                setImgSrc(`${axios.defaults.baseURL}/storage/documents/${coverName}`);
            }
        }, [coverName]);

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

        if (!imgSrc) {
            return (
                <div className="w-12 h-16 flex items-center justify-center bg-gray-100 dark:bg-white/10 border border-transparent dark:border-white/20 rounded-xl shrink-0">
                    <BookOpen size={20} className="text-gray-400 dark:text-slate-400"/>
                </div>
            );
        }

        return <img src={imgSrc} onError={handleError} alt="Cover" className="w-12 h-16 object-cover rounded-xl border border-gray-200 dark:border-white/10 shrink-0" />;
    };

    const [loading, setLoading] = useState(true);
    const [businesses, setBusinesses] = useState([]);
    const [selectedBiz, setSelectedBiz] = useState(null);
    
    const [allDeliveries, setAllDeliveries] = useState([]); 
    const [deliveries, setDeliveries] = useState([]);
    const [apiBatches, setApiBatches] = useState([]);

    // Handlers
    const [viewType, setViewType] = useState('Dispatch'); 
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [selectedBatchFilter, setSelectedBatchFilter] = useState('All');
    const [classFilter, setClassFilter] = useState('All'); // Theory / Paper / Both
    
    // Pagination & Date Filter States
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const getBizLogoUrl = (imageName) => (!imageName || imageName === 'default.png' || imageName === 'null') ? '/logo.png' : `${axios.defaults.baseURL}/storage/icons/${imageName}`;
    const getTuteImgUrl = (imageName) => (!imageName || imageName === 'default-tute.png' || imageName === 'null') ? '/default-tute.png' : `${axios.defaults.baseURL}/storage/documents/${imageName}`;

    useEffect(() => {
        fetchAllInitialData();
    }, []);

    useEffect(() => {
        if (selectedBiz) fetchDeliveriesForBiz(selectedBiz);
    }, [viewType, allDeliveries]);

    const fetchAllInitialData = async () => {
        setLoading(true);
        try {
            const [bizRes, allDelRes] = await Promise.all([
                axios.get('/admin/businesses'),
                axios.get('/admin/delivery/dispatch') 
            ]);
            setBusinesses(bizRes.data?.data || bizRes.data || []);
            setAllDeliveries(allDelRes.data || []);
        } catch (error) {
            toast.error("Failed to load dispatch data.");
        } finally {
            setLoading(false);
        }
    };

    const fetchDeliveriesForBiz = async (bizId) => {
        setSelectedBiz(bizId);
        
        const bizDeliveries = allDeliveries.filter(d => {
            if (d.businessId !== bizId) return false;
            if (viewType === 'Dispatch') {
                return d.status === 'Packed' || d.status === 'On the way';
            }
            return d.status === 'Received'; // Delivered view
        });
        
        setDeliveries(bizDeliveries);
        
        setSelectedBatchFilter('All');
        setCurrentPage(1);

        try {
            const res = await axios.get(`/admin/batches/${bizId}`);
            setApiBatches(res.data?.batches || res.data || []);
        } catch (error) {
            console.error("Failed to load batches", error);
        }
    };

    // Filter Logic
    
    const availableBatches = React.useMemo(() => {
        if (apiBatches.length > 0) {
            return ['All', ...apiBatches.map(b => b.name).sort()];
        }
        const batches = new Set(deliveries.map(d => d.batchName).filter(Boolean));
        return ['All', ...Array.from(batches).sort()];
    }, [deliveries, apiBatches]);

    const filteredDeliveries = deliveries.filter(order => {
        
        if (selectedBatchFilter !== 'All' && order.batchName !== selectedBatchFilter) return false;
        if (!matchesClassTag(order, classFilter)) return false;

        const matchesSearch = order.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              order.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              order.id?.toString().includes(searchQuery.toLowerCase());
                              
        let matchesDate = true;
        if (dateRange.start && dateRange.end) {
            const orderDate = new Date(order.updatedAt).setHours(0,0,0,0);
            const sDate = new Date(dateRange.start).setHours(0,0,0,0);
            const eDate = new Date(dateRange.end).setHours(23,59,59,999);
            matchesDate = orderDate >= sDate && orderDate <= eDate;
        }

        return matchesSearch && matchesDate;
    });

    // Pagination Logic
    const totalPages = Math.ceil(filteredDeliveries.length / itemsPerPage) || 1;
    const paginatedDeliveries = filteredDeliveries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    if (loading && !selectedBiz) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-accent" size={40}/></div>;

    return (
        <div className="animate-fade-in font-sans relative z-10">
            
            {/* 🔥 Glassmorphic Toggle Buttons 🔥 */}
            {!selectedBiz && (
                <div className="flex gap-4 mb-8 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl p-2 rounded-2xl border border-gray-200 dark:border-white/10 w-max shadow-lg transition-colors">
                    <button onClick={() => { setViewType('Dispatch'); setSelectedBiz(null); }} className={`px-8 py-3 rounded-xl font-black text-sm tracking-widest uppercase transition-all flex items-center gap-2 ${viewType === 'Dispatch' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30 scale-105' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'}`}>
                        <Truck size={18}/> Dispatched
                    </button>
                    <button onClick={() => { setViewType('Delivered'); setSelectedBiz(null); }} className={`px-8 py-3 rounded-xl font-black text-sm tracking-widest uppercase transition-all flex items-center gap-2 ${viewType === 'Delivered' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 scale-105' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'}`}>
                        <CheckCircle size={18}/> Delivered
                    </button>
                </div>
            )}

            {!selectedBiz ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {businesses.map(biz => {
                        const bizStatusCount = allDeliveries.filter(d => {
                            if (d.businessId !== biz.id) return false;
                            if (viewType === 'Dispatch') {
                                return d.status === 'Packed' || d.status === 'On the way';
                            }
                            return d.status === 'Received';
                        }).length;

                        return (
                            <div key={biz.id} onClick={() => fetchDeliveriesForBiz(biz.id)} className={`relative bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl border p-8 rounded-[2rem] cursor-pointer transition-all shadow-sm hover:shadow-2xl flex flex-col items-center justify-center text-center group ${viewType === 'Delivered' ? 'border-gray-200 dark:border-emerald-500/30 hover:border-emerald-500 dark:hover:border-emerald-500/60' : 'border-gray-200 dark:border-white/10 hover:border-brand-accent/50 dark:hover:border-brand-accent/70'}`}>
                                {bizStatusCount > 0 && (
                                    <span className={`absolute -top-3 -right-3 animate-pulse border-4 border-white dark:border-[#1a1a2e] text-white text-base font-black w-10 h-10 flex items-center justify-center rounded-full shadow-xl z-10 ${viewType === 'Delivered' ? 'bg-emerald-500' : 'bg-brand-accent'}`}>
                                        {bizStatusCount}
                                    </span>
                                )}

                                <div className="w-28 h-28 bg-white/50 dark:bg-black/20 rounded-2xl p-3 border border-gray-100 dark:border-white/5 group-hover:scale-105 transition-transform mb-4 shadow-sm backdrop-blur-sm">
                                    <img src={getBizLogoUrl(biz.logo)} alt={biz.name} onError={(e) => { e.target.onerror = null; e.target.src = '/logo.png'; }} className="w-full h-full object-contain drop-shadow-sm dark:drop-shadow-lg" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 dark:text-white transition-colors">{biz.name}</h3>
                                <p className={`text-sm font-bold mt-3 px-4 py-1.5 rounded-full border transition-colors shadow-sm backdrop-blur-md ${viewType === 'Delivered' ? 'bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20' : 'bg-gray-100/80 dark:bg-white/5 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10'}`}>
                                    {bizStatusCount} {viewType} Orders
                                </p>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div>
                    <div className="flex flex-col gap-4 mb-8">
                        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                            <div className="flex flex-wrap gap-4 items-center shrink-0 w-full xl:w-auto">
                                <button onClick={() => {setSelectedBiz(null); setDeliveries([]);}} className="text-base font-bold text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 bg-white/80 dark:bg-white/[0.05] backdrop-blur-xl border border-gray-200 dark:border-white/10 px-6 py-3 rounded-2xl transition-all shadow-md hover:shadow-lg shrink-0">
                                    <ArrowLeft size={18}/> Back to Businesses
                                </button>
                                
                                <div className="flex flex-col sm:flex-row gap-3 items-center bg-white/60 dark:bg-black/20 p-2 rounded-xl border border-gray-200 dark:border-white/10 shadow-inner w-full sm:w-auto">
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Batch:</span>
                                        <select 
                                            className="w-full sm:w-auto bg-white/80 dark:bg-black/40 text-gray-800 dark:text-gray-200 text-sm font-bold rounded-lg px-3 py-1.5 border border-gray-200 dark:border-white/10 focus:outline-none focus:border-brand-accent cursor-pointer"
                                            value={selectedBatchFilter}
                                            onChange={(e) => {
                                                setSelectedBatchFilter(e.target.value); 
                                                setCurrentPage(1);
                                            }}
                                        >
                                            {availableBatches.map(b => (
                                                <option key={b} value={b}>{b}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <ClassTagFilter value={classFilter} onChange={(v) => { setClassFilter(v); setCurrentPage(1); }} orders={deliveries.filter(o => selectedBatchFilter === 'All' || o.batchName === selectedBatchFilter)} />
                                </div>
                            </div>
                            
                            {/* 🔥 Glassmorphic Date Filter 🔥 */}
                            <div className="flex items-center bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-white/10 p-1.5 shadow-lg transition-colors w-full xl:w-auto overflow-x-auto">
                            <Calendar className="text-gray-400 dark:text-slate-400 ml-3" size={18}/>
                            <input type="date" value={dateRange.start} onChange={e => {
                                setDateRange({...dateRange, start: e.target.value}); 
                                setCurrentPage(1);
                            }} className="bg-transparent text-sm text-gray-700 dark:text-slate-200 outline-none px-3 py-2 [color-scheme:light] dark:[color-scheme:dark] font-bold"/>
                            <span className="text-gray-400 dark:text-slate-600 font-black px-1">-</span>
                            <input type="date" value={dateRange.end} onChange={e => {
                                setDateRange({...dateRange, end: e.target.value}); 
                                setCurrentPage(1);
                            }} className="bg-transparent text-sm text-gray-700 dark:text-slate-200 outline-none px-3 py-2 [color-scheme:light] dark:[color-scheme:dark] font-bold"/>
                            {(dateRange.start || dateRange.end) && (
                                <button onClick={() => {
                                    setDateRange({start:'', end:''}); 
                                    setCurrentPage(1);
                                }} className="mr-2 p-1.5 rounded-lg text-gray-400 dark:text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/20 dark:hover:text-red-400 transition-colors"><X size={16}/></button>
                            )}
                        </div>
                    </div>
                    </div>

                    {paginatedDeliveries.length === 0 ? (
                        <div className="text-center py-24 bg-white/50 dark:bg-white/[0.02] backdrop-blur-xl rounded-[2rem] border border-gray-200 dark:border-white/5 shadow-sm transition-colors">
                            <p className="text-gray-500 dark:text-slate-400 font-bold text-xl flex flex-col items-center gap-4">
                                <CheckCircle size={40} className={viewType === 'Delivered' ? 'text-emerald-500/50' : 'text-brand-accent/50'} />
                                No {viewType.toLowerCase()} records found.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {paginatedDeliveries.map((order, idx) => (
                                <div key={idx} className={`bg-white/80 dark:bg-white/[0.02] backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-6 rounded-[2rem] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-lg transition-all ${viewType === 'Delivered' ? 'hover:border-emerald-500/50 dark:hover:border-emerald-500/50' : 'hover:border-brand-accent/50 dark:hover:border-brand-accent/50'}`}>
                                    <div className="flex gap-5 items-center w-full sm:w-auto">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border shadow-md backdrop-blur-md ${viewType === 'Delivered' ? 'bg-emerald-100/80 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-400' : 'bg-brand-accentLight/80 dark:bg-brand-accent/20 border-brand-accent/30 dark:border-brand-accent/40 text-brand-accent dark:text-brand-accent'}`}>
                                            <Package size={26} strokeWidth={2.5}/>
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-black text-xl text-gray-900 dark:text-white mb-2 flex flex-wrap items-center gap-2.5 transition-colors">
                                                {order.studentName}
                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border transition-colors shadow-sm ${viewType === 'Delivered' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30' : 'bg-brand-accentLight dark:bg-brand-accent/20 text-brand-accent dark:text-brand-accent border-brand-accent/30 dark:border-brand-accent/30'}`}>
                                                    {viewType}
                                                </span>
                                                <ClassTagBadge tag={order.classTag} small />
                                            </h4>
                                            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-slate-300 font-bold tracking-wide transition-colors">
                                                <span className="bg-white/60 dark:bg-black/20 px-2 py-0.5 rounded-md border border-gray-200 dark:border-white/5">REF: <span className="text-gray-900 dark:text-white">ORD-{order.id}</span></span>
                                                <span className="text-gray-400 dark:text-white/20">•</span> 
                                                <span>Tracking: <span className={`${viewType === 'Delivered' ? 'text-emerald-600 dark:text-emerald-400' : 'text-brand-accent'} font-black`}>{order.trackingNumber || 'N/A'}</span></span>
                                                
                                                {order.packRemark && (
                                                    <>
                                                        <span className="text-gray-400 dark:text-white/20">•</span> 
                                                        <span className="bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded border border-yellow-200 dark:border-yellow-500/20 text-[10px] font-black uppercase tracking-widest max-w-[200px] truncate" title={order.packRemark}>
                                                            Remark: {order.packRemark}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <button onClick={() => setSelectedOrder(order)} className="bg-white/80 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-slate-200 font-black py-3.5 px-6 rounded-xl transition-all text-xs uppercase tracking-widest border border-gray-200 dark:border-white/10 flex items-center gap-2 w-full sm:w-auto justify-center shadow-sm">
                                        <Eye size={18}/> View Details
                                    </button>
                                </div>
                            ))}

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex justify-between items-center mt-8 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl p-4 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm transition-colors">
                                    <span className="text-sm text-gray-500 dark:text-slate-400 font-bold">Showing Page <strong className="text-gray-900 dark:text-white">{currentPage}</strong> of <strong className="text-gray-900 dark:text-white">{totalPages}</strong></span>
                                    <div className="flex gap-2">
                                        <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 disabled:opacity-50 text-gray-700 dark:text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-colors shadow-sm"><ChevronLeft size={16}/> Prev</button>
                                        <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 disabled:opacity-50 text-gray-700 dark:text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-colors shadow-sm">Next <ChevronRight size={16}/></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* View Details Modal */}
            {selectedOrder && createPortal(
                <div className="fixed inset-0 z-[9999] bg-gray-900/60 dark:bg-[#0a0f1c]/90 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in transition-colors">
                    <div className="bg-white dark:bg-[#15192b] border border-gray-200 dark:border-white/10 rounded-[2.5rem] p-8 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col transition-colors">
                        
                        <div className="flex justify-between items-center mb-6 pb-5 border-b border-gray-200 dark:border-white/10 shrink-0 transition-colors">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3 transition-colors">
                                <Package size={26} className={viewType === 'Delivered' ? 'text-emerald-500' : 'text-brand-accent'}/> Order Details
                            </h3>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 bg-gray-100 dark:bg-white/5 p-2.5 rounded-xl transition-colors">
                                <X size={22}/>
                            </button>
                        </div>

                        <div className="overflow-y-auto custom-scrollbar pr-2 flex-1 space-y-6">
                            <div className="bg-gray-50 dark:bg-white/5 p-5 rounded-2xl border border-gray-100 dark:border-white/5 transition-colors shadow-sm">
                                <div className="flex gap-4 mb-4">
                                    <MapPin size={22} className={`${viewType === 'Delivered' ? 'text-emerald-500' : 'text-brand-accent'} mt-1`}/>
                                    <div>
                                        <p className="text-gray-900 dark:text-white font-black text-xl transition-colors">{selectedOrder.studentName}</p>
                                        <p className="text-gray-600 dark:text-slate-300 text-sm mt-1.5 font-bold transition-colors">{selectedOrder.address}</p>
                                        <p className={`${viewType === 'Delivered' ? 'text-emerald-600 dark:text-emerald-400' : 'text-brand-accent'} font-black text-sm mt-1.5`}>{selectedOrder.phone}</p>
                                    </div>
                                </div>
                                <div className="mt-5 flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-white/10">
                                    <span className="bg-white dark:bg-black/30 text-gray-700 dark:text-slate-300 text-xs px-3 py-1.5 rounded-lg font-black uppercase tracking-widest border border-gray-200 dark:border-white/5 transition-colors">{selectedOrder.paymentType} Payment</span>
                                    <span className="bg-white dark:bg-black/30 text-gray-700 dark:text-slate-300 text-xs px-3 py-1.5 rounded-lg font-black uppercase tracking-widest border border-gray-200 dark:border-white/5 transition-colors">REF: ORD-{selectedOrder.id}</span>
                                </div>
                                {selectedOrder.packRemark ? (
                                    <div className="mt-4 text-xs bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 p-3 rounded-xl border border-yellow-200 dark:border-yellow-500/20 break-words font-bold">
                                        <span className="font-black uppercase tracking-widest block mb-1">Internal Remark:</span>
                                        {selectedOrder.packRemark}
                                    </div>
                                ) : (
                                    <div className="mt-4 text-xs bg-gray-50 dark:bg-gray-500/10 text-gray-500 dark:text-gray-400 p-3 rounded-xl border border-gray-200 dark:border-gray-500/20 break-words font-bold">
                                        <span className="font-black uppercase tracking-widest block mb-1">Internal Remark:</span>
                                        N/A
                                    </div>
                                )}
                            </div>

                            <div>
                                <h4 className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-4 transition-colors">Included Tutes</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {selectedOrder.items?.filter((item, index, self) => 
                                        index === self.findIndex((t) => t.tuteName === item.tuteName)
                                    ).map((item, i) => (
                                        <div key={i} className="flex items-center gap-4 bg-white/60 dark:bg-black/20 backdrop-blur-md border border-gray-200 dark:border-white/5 p-3.5 rounded-2xl transition-colors hover:bg-white/80 dark:hover:bg-white/5 shadow-sm">
                                            <DeliveryItemImage coverName={item.tuteImage} />
                                            <div className="overflow-hidden">
                                                <p className="text-sm font-black text-gray-900 dark:text-white truncate transition-colors mb-1">{item.tuteName} <span className={viewType === 'Delivered' ? 'text-emerald-600 dark:text-emerald-400' : 'text-brand-accent'}>x{item.quantity}</span></p>
                                                <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-widest truncate transition-colors">{item.courseName}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-5 border-t border-gray-200 dark:border-white/10 shrink-0 transition-colors">
                            <button onClick={() => setSelectedOrder(null)} className="w-full bg-gray-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white font-black py-4 rounded-xl transition-all uppercase tracking-widest shadow-lg shadow-gray-900/20 dark:shadow-none">
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}