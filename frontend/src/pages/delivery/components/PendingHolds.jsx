import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, MapPin, Phone, Package, Filter, Calendar, Save, Trash2, Box, Eye, Check, Clock, AlertTriangle, ArrowLeft, Loader2, ArrowRight, UserCheck, X, History, ChevronDown, ChevronUp, CheckCircle2, MessageSquare, Settings, Layers, Edit2, Printer, ScanBarcode, BookOpen } from 'lucide-react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';

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
            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-white/10 border border-transparent dark:border-white/20">
                <BookOpen size={20} className="text-gray-400 dark:text-slate-400"/>
            </div>
        );
    }

    return <img src={imgSrc} onError={handleError} alt="Cover" className="w-full h-full object-cover" />;
};

export default function PendingHolds({ searchQuery, isReadOnly }) {
    const [loading, setLoading] = useState(true);
    const [businesses, setBusinesses] = useState([]);
    const [selectedBiz, setSelectedBiz] = useState(null);
    
    const [allDeliveries, setAllDeliveries] = useState([]); 
    const [deliveries, setDeliveries] = useState([]);
    const [activePayTab, setActivePayTab] = useState('All');
    const [selectedBatchFilter, setSelectedBatchFilter] = useState('All');
    const [apiBatches, setApiBatches] = useState([]);
    const [sortBy, setSortBy] = useState('oldest');
    
    const [viewType, setViewType] = useState('Pending'); 
    const [isEditOrderMode, setIsEditOrderMode] = useState(false);
    const [businessOrders, setBusinessOrders] = useState({});
    const [isSavingOrders, setIsSavingOrders] = useState(false);

    const toggleEditOrderMode = () => {
        if (!isEditOrderMode) {
            const initialOrders = {};
            businesses.forEach(b => { initialOrders[b.id] = b.itemOrder || 1; });
            setBusinessOrders(initialOrders);
        }
        setIsEditOrderMode(!isEditOrderMode);
    };

    const handleSaveOrders = async () => {
        setIsSavingOrders(true);
        try {
            const ordersArray = Object.keys(businessOrders).map(id => ({ id, itemOrder: businessOrders[id] }));
            await axios.put('/admin/businesses/reorder', { orders: ordersArray });
            toast.success("Business display order updated");
            setIsEditOrderMode(false);
            fetchAllInitialData(); 
        } catch (error) {
            toast.error("Failed to update business order");
        } finally {
            setIsSavingOrders(false);
        }
    };

    const getBizLogoUrl = (imageName) => (!imageName || imageName === 'default.png' || imageName === 'null') ? '/logo.png' : `${axios.defaults.baseURL.replace('/api', '')}/storage/icons/${imageName}`;

    useEffect(() => {
        fetchAllInitialData();

        const handleReset = () => {
            setSelectedBiz(null);
            setDeliveries([]);
            fetchAllInitialData();
        };

        window.addEventListener('reset-pending-holds', handleReset);
        return () => window.removeEventListener('reset-pending-holds', handleReset);
    }, []);

    useEffect(() => {
        if (selectedBiz) {
            fetchDeliveriesForBiz(selectedBiz, false);
        }
    }, [viewType, allDeliveries]);

    const fetchAllInitialData = async () => {
        setLoading(true);
        try {
            const [bizRes, allDelRes] = await Promise.all([
                axios.get('/admin/businesses'),
                axios.get('/admin/delivery/pending') 
            ]);
            setBusinesses(bizRes.data?.data || bizRes.data || []);
            setAllDeliveries(allDelRes.data || []);
        } catch (error) {
            toast.error("Failed to load initial data.");
        } finally {
            setLoading(false);
        }
    };

    const fetchDeliveriesForBiz = async (bizId, isNewBiz = false) => {
        setSelectedBiz(bizId);
        const bizDeliveries = allDeliveries.filter(d => d.businessId === bizId && d.status === viewType);
        setDeliveries(bizDeliveries);
        
        if (isNewBiz) {
            setActivePayTab('All'); 
            setSelectedBatchFilter('All');
        }
        
        try {
            const res = await axios.get(`/admin/batches/${bizId}`);
            setApiBatches(res.data?.batches || res.data || []);
        } catch (error) {
            console.error("Failed to load batches", error);
        }
    };

    const processedDeliveries = useMemo(() => {
        const counts = {};
        const upgradeKeys = new Set();
        
        deliveries.forEach(d => {
            const key = d.phone ? d.phone.trim() : d.studentName?.trim();
            if(key) {
                counts[key] = (counts[key] || 0) + 1;
                if (d.isUpgrade) upgradeKeys.add(key);
            }
        });

        const sorted = [...deliveries].sort((a, b) => {
            if (sortBy === 'alphabetical') {
                const nameA = a.studentName || '';
                const nameB = b.studentName || '';
                return nameA.localeCompare(nameB);
            }
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.id || 0);
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.id || 0);
            if (sortBy === 'newest') {
                if (timeB !== timeA) return timeB - timeA;
                return (b.id || 0) - (a.id || 0);
            }
            // Default: 'oldest' (First In, First Out - Earliest arrived pending orders first)
            if (timeA !== timeB) return timeA - timeB;
            return (a.id || 0) - (b.id || 0);
        });

        return sorted.map(d => {
            const key = d.phone ? d.phone.trim() : d.studentName?.trim();
            const isUpgradeRelated = upgradeKeys.has(key);
            
            return {
                ...d,
                isUpgrade: isUpgradeRelated, // Mark all related orders as upgrade to show the badge
                isMix: !isUpgradeRelated && counts[key] > 1 
            };
        });
    }, [deliveries, sortBy]);

    const availableBatches = useMemo(() => {
        if (apiBatches.length > 0) {
            return ['All', ...apiBatches.map(b => b.name).sort()];
        }
        const batches = new Set(processedDeliveries.map(d => d.batchName).filter(Boolean));
        return ['All', ...Array.from(batches).sort()];
    }, [processedDeliveries, apiBatches]);

    const isSearching = Boolean(searchQuery && searchQuery.trim().length > 0);

    // Global Search across BOTH Pending & Hold orders
    const globalSearchResults = useMemo(() => {
        if (!isSearching) return [];
        const searchLower = searchQuery.toLowerCase().trim();
        const pool = selectedBiz
            ? allDeliveries.filter(d => d.businessId === selectedBiz)
            : allDeliveries;

        const matches = pool.filter(order => {
            const studentName = (order.studentName || '').toLowerCase();
            const phone = (order.phone || '').toLowerCase();
            const idStr = (order.id || '').toString();
            const batch = (order.batchName || '').toLowerCase();
            const labelAddress = (order.labelAddress || order.address || '').toLowerCase();
            const itemsStr = (order.items || []).map(i => (i.tuteName || '').toLowerCase() + ' ' + (i.courseName || '').toLowerCase()).join(' ');

            return studentName.includes(searchLower) ||
                   phone.includes(searchLower) ||
                   idStr.includes(searchLower) ||
                   batch.includes(searchLower) ||
                   labelAddress.includes(searchLower) ||
                   itemsStr.includes(searchLower);
        });

        const sortedMatches = [...matches].sort((a, b) => {
            if (sortBy === 'alphabetical') {
                const nameA = a.studentName || '';
                const nameB = b.studentName || '';
                return nameA.localeCompare(nameB);
            }
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.id || 0);
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.id || 0);
            if (sortBy === 'newest') {
                if (timeB !== timeA) return timeB - timeA;
                return (b.id || 0) - (a.id || 0);
            }
            // Default: 'oldest' (FIFO)
            if (timeA !== timeB) return timeA - timeB;
            return (a.id || 0) - (b.id || 0);
        });

        const counts = {};
        const upgradeKeys = new Set();
        sortedMatches.forEach(d => {
            const key = d.phone ? d.phone.trim() : d.studentName?.trim();
            if (key) {
                counts[key] = (counts[key] || 0) + 1;
                if (d.isUpgrade) upgradeKeys.add(key);
            }
        });

        return sortedMatches.map(d => {
            const key = d.phone ? d.phone.trim() : d.studentName?.trim();
            const isUpgradeRelated = upgradeKeys.has(key);
            const bizObj = businesses.find(b => b.id === d.businessId);
            return {
                ...d,
                isUpgrade: isUpgradeRelated,
                isMix: !isUpgradeRelated && counts[key] > 1,
                bizName: bizObj ? bizObj.name : ''
            };
        });
    }, [searchQuery, isSearching, selectedBiz, allDeliveries, businesses, sortBy]);

    const baseFilteredDeliveries = processedDeliveries.filter(order => {
        if (selectedBatchFilter !== 'All' && order.batchName !== selectedBatchFilter) return false;

        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = order.studentName?.toLowerCase().includes(searchLower) || 
                              order.id?.toString().includes(searchLower) ||
                              order.phone?.includes(searchQuery);
        return matchesSearch;
    });

    // 🔥 FIX: Tab counts updated to use baseFilteredDeliveries
    const tabCounts = {
        All: baseFilteredDeliveries.filter(d => !d.isMix).length,
        Mixed: baseFilteredDeliveries.filter(d => d.isMix).length,
        Monthly: baseFilteredDeliveries.filter(d => !d.isMix && d.paymentType === 'Monthly').length,
        Full: baseFilteredDeliveries.filter(d => !d.isMix && d.paymentType === 'Full').length,
        Installment: baseFilteredDeliveries.filter(d => !d.isMix && d.paymentType === 'Installment').length,
    };

    const filteredDeliveries = baseFilteredDeliveries.filter(order => {
        let matchesTab = false;
        
        if (activePayTab === 'All') {
            matchesTab = !order.isMix; // All tab eke Mix ewa pennanne na
        } else if (activePayTab === 'Mixed') {
            matchesTab = order.isMix; // Mix tab ekata witharai
        } else {
            matchesTab = !order.isMix && order.paymentType === activePayTab;
        }

        return matchesTab;
    });

    if (loading && !selectedBiz) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-accent" size={40}/></div>;

    return (
        <div className="animate-fade-in font-sans relative z-10">
            
            {/* Active Search Results View across BOTH Pending & Hold */}
            {isSearching ? (
                <div className="space-y-6">
                    <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl border border-brand-accent/30 p-6 rounded-[2rem] shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                                <Search size={24} className="text-brand-accent"/>
                                Search Results for "{searchQuery}"
                            </h3>
                            <p className="text-xs font-bold text-gray-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
                                Showing matching orders across BOTH Pending & On Hold ({globalSearchResults.length} found)
                            </p>
                        </div>
                        {selectedBiz && (
                            <button onClick={() => setSelectedBiz(null)} className="px-4 py-2 rounded-xl text-xs font-black bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20 border border-brand-accent/20 transition-all">
                                Clear Business Filter
                            </button>
                        )}
                    </div>

                    {globalSearchResults.length === 0 ? (
                        <div className="text-center py-24 bg-white/50 dark:bg-white/[0.02] backdrop-blur-xl rounded-[2rem] border border-gray-200 dark:border-white/5 shadow-sm">
                            <p className="text-gray-500 dark:text-slate-400 font-bold text-xl flex flex-col items-center justify-center gap-4">
                                <Search size={40} className="text-gray-400/50" />
                                No orders found matching "{searchQuery}" in Pending or On Hold.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {globalSearchResults.map(order => (
                                <OrderCard 
                                    key={order.id} 
                                    order={order} 
                                    isReadOnly={isReadOnly}
                                    onRefresh={() => fetchAllInitialData().then(() => {
                                        if(selectedBiz) fetchDeliveriesForBiz(selectedBiz);
                                    })} 
                                />
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {!selectedBiz && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                            <div className="flex gap-4 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl p-2 rounded-2xl border border-gray-200 dark:border-white/10 w-max shadow-lg transition-colors">
                                <button
                                    onClick={() => { setViewType('Pending'); setSelectedBiz(null); }}
                                    className={`px-8 py-3 rounded-xl font-black text-sm tracking-widest uppercase transition-all flex items-center gap-2 ${viewType === 'Pending' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30 scale-105' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'}`}
                                >
                                    <Clock size={18}/> Pending Orders
                                </button>
                                <button
                                    onClick={() => { setViewType('Hold'); setSelectedBiz(null); }}
                                    className={`px-8 py-3 rounded-xl font-black text-sm tracking-widest uppercase transition-all flex items-center gap-2 ${viewType === 'Hold' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 scale-105' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'}`}
                                >
                                    <AlertTriangle size={18}/> On Hold Orders
                                </button>
                            </div>

                            <div className="flex items-center gap-3">
                                {isEditOrderMode ? (
                                    <>
                                        <button onClick={toggleEditOrderMode} className="px-5 py-2.5 rounded-xl font-black text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                                            Cancel
                                        </button>
                                        <button onClick={handleSaveOrders} disabled={isSavingOrders} className="px-5 py-2.5 rounded-xl font-black text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2">
                                            {isSavingOrders ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>} Save Orders
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={toggleEditOrderMode} className="px-5 py-2.5 rounded-xl font-black text-sm text-brand-accent bg-brand-accent/10 hover:bg-brand-accent/20 border border-brand-accent/20 transition-colors flex items-center gap-2 shadow-sm">
                                        <Settings size={16}/> Edit Business Order
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {!selectedBiz ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {businesses.map(biz => {
                                const pendingCount = allDeliveries.filter(d => d.businessId === biz.id && d.status === 'Pending').length;
                                const holdCount = allDeliveries.filter(d => d.businessId === biz.id && d.status === 'Hold').length;
                                const totalBizCount = pendingCount + holdCount;

                                return (
                                    <div 
                                        key={biz.id} 
                                        onClick={(e) => {
                                            if(isEditOrderMode) return;
                                            fetchDeliveriesForBiz(biz.id, true);
                                        }}
                                        className={`relative bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl border p-8 rounded-[2rem] ${isEditOrderMode ? 'cursor-default ring-2 ring-brand-accent/50' : 'cursor-pointer hover:shadow-2xl hover:border-brand-accent/50 dark:hover:border-brand-accent/70'} transition-all shadow-sm flex flex-col items-center justify-center text-center group border-gray-200 dark:border-white/10`}
                                    >
                                        {isEditOrderMode ? (
                                            <div className="absolute -top-3 -right-3 z-20 shadow-xl rounded-xl">
                                                <div className="bg-white dark:bg-[#1a1a2e] p-2 rounded-xl border-2 border-brand-accent shadow-sm flex flex-col items-center gap-1" onClick={e=>e.stopPropagation()}>
                                                    <span className="text-[10px] font-black text-brand-accent uppercase tracking-widest leading-none">Order #</span>
                                                    <input 
                                                        type="number" 
                                                        min="1"
                                                        value={businessOrders[biz.id] || ''}
                                                        onChange={(e) => setBusinessOrders({...businessOrders, [biz.id]: e.target.value})}
                                                        className="w-16 h-8 bg-brand-accent/10 border-none rounded-lg text-sm font-black text-center outline-none text-brand-accent focus:ring-2 focus:ring-brand-accent"
                                                    />
                                                </div>
                                            </div>
                                        ) : (!isEditOrderMode && (pendingCount > 0 || holdCount > 0) && (
                                            <div className="absolute -top-3 -right-3 z-10 flex items-center gap-1.5">
                                                {pendingCount > 0 && (
                                                    <span 
                                                        title={`${pendingCount} Pending Orders`}
                                                        className="animate-pulse border-4 border-white dark:border-[#1a1a2e] text-white text-xs font-black min-w-[2.5rem] h-10 px-2 flex items-center justify-center rounded-full shadow-xl bg-brand-accent"
                                                    >
                                                        {pendingCount}
                                                    </span>
                                                )}
                                                {holdCount > 0 && (
                                                    <span 
                                                        title={`${holdCount} On Hold Orders`}
                                                        className="animate-pulse border-4 border-white dark:border-[#1a1a2e] text-white text-xs font-black min-w-[2.5rem] h-10 px-2 flex items-center justify-center rounded-full shadow-xl bg-orange-500"
                                                    >
                                                        {holdCount}
                                                    </span>
                                                )}
                                            </div>
                                        ))}

                                        <div className="w-28 h-28 bg-white/50 dark:bg-black/20 rounded-2xl p-3 border border-gray-100 dark:border-white/5 group-hover:scale-105 transition-transform mb-4 shadow-sm backdrop-blur-sm">
                                            <img 
                                                src={getBizLogoUrl(biz.logo)} 
                                                alt={biz.name} 
                                                onError={(e) => { e.target.onerror = null; e.target.src = '/logo.png'; }} 
                                                className="w-full h-full object-contain drop-shadow-sm dark:drop-shadow-lg" 
                                            />
                                        </div>
                                        <h3 className="text-xl font-black text-gray-900 dark:text-white transition-colors">{biz.name}</h3>
                                        <div className="mt-3 px-4 py-1.5 rounded-full border transition-colors shadow-sm backdrop-blur-md bg-white/80 dark:bg-black/40 border-gray-200 dark:border-white/10 flex items-center gap-2 text-xs font-black">
                                            <span className="text-rose-600 dark:text-rose-400 font-extrabold">{pendingCount} Pending</span>
                                            <span className="text-gray-400 dark:text-white/20">•</span>
                                            <span className="text-amber-500 dark:text-amber-400 font-extrabold">{holdCount} On Hold</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div>
                            <div className="flex flex-col gap-4 mb-8">
                                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                                    <div className="flex flex-wrap gap-4 items-center shrink-0 w-full xl:w-auto">
                                        <button onClick={() => {setSelectedBiz(null); setDeliveries([]); fetchAllInitialData();}} className="text-base font-bold text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 bg-white/80 dark:bg-white/[0.05] backdrop-blur-xl border border-gray-200 dark:border-white/10 px-6 py-3 rounded-2xl transition-all shadow-md hover:shadow-lg shrink-0">
                                            <ArrowLeft size={18}/> Back to Businesses
                                        </button>
                                        
                                        <div className="flex flex-col sm:flex-row gap-3 items-center bg-white/60 dark:bg-black/20 p-2 rounded-xl border border-gray-200 dark:border-white/10 shadow-inner w-full sm:w-auto">
                                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Batch:</span>
                                                <select 
                                                    className="w-full sm:w-auto bg-white/80 dark:bg-black/40 text-gray-800 dark:text-gray-200 text-sm font-bold rounded-lg px-3 py-1.5 border border-gray-200 dark:border-white/10 focus:outline-none focus:border-brand-accent cursor-pointer"
                                                    value={selectedBatchFilter}
                                                    onChange={(e) => setSelectedBatchFilter(e.target.value)}
                                                >
                                                    {availableBatches.map(b => (
                                                        <option key={b} value={b}>{b}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="h-4 w-px bg-gray-300 dark:bg-white/10 hidden sm:block"></div>

                                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Sort:</span>
                                                <select 
                                                    className="w-full sm:w-auto bg-white/80 dark:bg-black/40 text-gray-800 dark:text-gray-200 text-sm font-bold rounded-lg px-3 py-1.5 border border-gray-200 dark:border-white/10 focus:outline-none focus:border-brand-accent cursor-pointer font-sans"
                                                    value={sortBy}
                                                    onChange={(e) => setSortBy(e.target.value)}
                                                    title="Change pending order sort priority"
                                                >
                                                    <option value="oldest">⏳ Earliest Orders (FIFO)</option>
                                                    <option value="newest">⚡ Newest Orders</option>
                                                    <option value="alphabetical">🔤 Student Name (A-Z)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-3 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl p-2 rounded-2xl border border-gray-200 dark:border-white/10 w-full shadow-lg transition-colors overflow-x-auto">
                                    {['All', 'Mixed', 'Monthly', 'Full', 'Installment'].map(tab => (
                                        <button 
                                            key={tab} 
                                            onClick={() => setActivePayTab(tab)}
                                            className={`flex-1 xl:flex-none px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${activePayTab === tab ? (tab === 'Mixed' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 scale-105' : 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30 scale-105') : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10'}`}
                                        >
                                            {tab === 'Mixed' && <Layers size={16} className={activePayTab === tab ? 'text-white' : 'text-rose-500 dark:text-rose-400'}/>}
                                            {tab !== 'Mixed' && tab} 
                                            <span className={`px-2.5 py-1 rounded-lg text-sm font-black transition-colors ${activePayTab === tab ? 'bg-black/20 text-white shadow-inner' : 'bg-gray-200/80 dark:bg-black/30 text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-white/10'}`}>
                                                {tabCounts[tab]}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {filteredDeliveries.length === 0 ? (
                                <div className="text-center py-24 bg-white/50 dark:bg-white/[0.02] backdrop-blur-xl rounded-[2rem] border border-gray-200 dark:border-white/5 shadow-sm transition-colors">
                                    <p className="text-gray-500 dark:text-slate-400 font-bold text-xl flex flex-col items-center justify-center gap-4">
                                        <Check size={40} className="text-emerald-500/50" />
                                        No {viewType.toLowerCase()} deliveries for {activePayTab !== 'All' ? activePayTab : 'this category'}.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {filteredDeliveries.map(order => (
                                        <OrderCard 
                                            key={order.id} 
                                            order={order} 
                                            isReadOnly={isReadOnly}
                                            onRefresh={() => fetchAllInitialData().then(() => fetchDeliveriesForBiz(selectedBiz))} 
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ---------------- Order Card Component ----------------
function OrderCard({ order, onRefresh, isReadOnly }) {
    const [barcode, setBarcode] = useState('');
    const [isHolding, setIsHolding] = useState(false);
    const [holdReason, setHoldReason] = useState('Out of Stock');
    const [isProcessing, setIsProcessing] = useState(false);
    const barcodeInputRef = useRef(null);

    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [tempName, setTempName] = useState(order.studentName);
    const [tempHouseNo, setTempHouseNo] = useState(order.originalAddress?.houseNo || '');
    const [tempStreet, setTempStreet] = useState(order.originalAddress?.street || '');
    const [tempCity, setTempCity] = useState(order.originalAddress?.city || '');
    const [tempDistrict, setTempDistrict] = useState(order.originalAddress?.district || '');
    const tempAddress = [tempHouseNo, tempStreet, tempCity, tempDistrict].filter(Boolean).join(', ') || order.labelAddress || order.address;
    const [tempPhone, setTempPhone] = useState(order.phone);

    const [packRemark, setPackRemark] = useState(() => {
        return localStorage.getItem(`draft_pack_remark_${order.id}`) || '';
    });
    const [showPackRemark, setShowPackRemark] = useState(false);

    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [studentHistory, setStudentHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const [holdRemark, setHoldRemark] = useState(() => {
        return localStorage.getItem(`draft_hold_remark_${order.id}`) || '';
    });

    const getBizLogoUrl = (logo) => logo ? `${axios.defaults.baseURL}/storage/images/${logo}` : '/logo.png';
    const getLecImgUrl = (imageName) => (!imageName || imageName === 'default.png' || imageName === 'null') ? '/logo.png' : `${axios.defaults.baseURL}/storage/icons/${imageName}`;

    const handleRemarkChange = (e) => {
        const val = e.target.value;
        setHoldRemark(val);
        localStorage.setItem(`draft_hold_remark_${order.id}`, val);
    };

    const handlePackRemarkChange = (e) => {
        const val = e.target.value;
        setPackRemark(val);
        localStorage.setItem(`draft_pack_remark_${order.id}`, val);
    };

    const fetchStudentHistory = async () => {
        if (!isHistoryOpen) {
            setIsHistoryOpen(true);
            if (studentHistory.length === 0) {
                setHistoryLoading(true);
                try {
                    // pass studentId directly for fast query if available
                    const sId = order.studentId || order.payment?.studentId;
                    const res = await axios.get(`/admin/delivery/history-advanced?studentId=${sId}&limit=50`);
                    setStudentHistory(res.data.data || []);
                } catch (error) {
                    toast.error("Failed to load student history.");
                } finally {
                    setHistoryLoading(false);
                }
            }
        } else {
            setIsHistoryOpen(false);
        }
    };

    const handleLabelAction = (isPrint = true) => {
        const baseUrl = window.location.origin; 
        const bgImageUrl = `${baseUrl}/sticker-bg.png`; 
        const windowPrint = window.open('', '', 'width=850,height=500');
        
        windowPrint.document.write(`
            <html>
                <head>
                    <title>${isPrint ? 'Print' : 'Preview'} Label - ${order.id}</title>
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
                                <div class="text-item">${tempName}</div>
                                <div class="text-item">${tempAddress}</div>
                                <div class="text-item">${tempPhone}</div>
                            </div>
                            <div class="ref-id">REF: ${order.id}</div>
                        </div>
                    </div>
                </body>
            </html>
        `);
        windowPrint.document.close();
        windowPrint.focus();
        
        if (isPrint) {
            setTimeout(() => { 
                windowPrint.print(); 
                windowPrint.close(); 
                if(barcodeInputRef.current) barcodeInputRef.current.focus();
            }, 500);
        }
    };

    const handlePack = async (e) => {
        if (e && e.key !== 'Enter') return;
        if (!barcode.trim()) return toast.error("Please scan or enter tracking number.");
        
        setIsProcessing(true);
        try {
            await axios.post('/admin/delivery/pack', { deliveryId: order.id, trackingNumber: barcode, packRemark });
            toast.success("Packed & Stock Deducted!");
            localStorage.removeItem(`draft_pack_remark_${order.id}`);
            onRefresh(); 
        } catch (error) {
            toast.error("Failed to update status.");
        } finally {
            setIsProcessing(false);
        }
    };

    const submitHold = async () => {
        setIsProcessing(true);
        try {
            await axios.post('/admin/delivery/hold', { 
                deliveryId: order.id, 
                reason: holdReason, 
                remark: holdRemark 
            });
            toast.success("Order Placed on Hold.");
            localStorage.removeItem(`draft_hold_remark_${order.id}`); 
            setIsHolding(false);
            onRefresh();
        } catch (error) {
            toast.error("Failed to hold order.");
        } finally {
            setIsProcessing(false);
        }
    };

    const cancelEdit = () => {
        setTempName(order.studentName);
        setTempHouseNo(order.originalAddress?.houseNo || '');
        setTempStreet(order.originalAddress?.street || '');
        setTempCity(order.originalAddress?.city || '');
        setTempDistrict(order.originalAddress?.district || '');
        setTempPhone(order.phone);
        setIsEditingInfo(false);
    };

    const saveEdit = async () => {
        try {
            await axios.put(`/admin/delivery/${order.id}/label`, {
                labelName: tempName,
                labelPhone: tempPhone,
                houseNo: tempHouseNo,
                street: tempStreet,
                city: tempCity,
                district: tempDistrict
            });
            toast.success('Label details updated!');
            setIsEditingInfo(false);
            if(onRefresh) onRefresh();
        } catch (error) {
            console.error('Save Edit Error:', error);
            toast.error('Failed to save label details');
        }
    };

    let cardStyle = 'bg-white/80 dark:bg-white/[0.02] backdrop-blur-2xl border-gray-200 dark:border-white/10 hover:border-brand-accent/50 dark:hover:border-brand-accent/50 shadow-lg'; 
    let typeBadgeStyle = 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-white/10';

    const copyToClipboard = (text, label) => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                toast.success(`${label} copied!`);
            }).catch(() => fallbackCopy(text, label));
        } else {
            fallbackCopy(text, label);
        }
    };

    const fallbackCopy = (text, label) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            if (document.execCommand('copy')) {
                toast.success(`${label} copied!`);
            } else {
                toast.error(`Failed to copy ${label}`);
            }
        } catch (err) {
            toast.error(`Error copying ${label}`);
        }
        document.body.removeChild(textArea);
    };

    if (order.hasDuplicate) {
        cardStyle = 'bg-rose-50/90 dark:bg-rose-950/25 backdrop-blur-2xl border-2 border-rose-400 dark:border-rose-500/60 shadow-xl shadow-rose-500/10';
        typeBadgeStyle = 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/40';
    } else if (order.status === 'Hold') {
        cardStyle = 'bg-orange-50/90 dark:bg-orange-950/20 backdrop-blur-2xl border-orange-200 dark:border-orange-500/30 hover:border-orange-300 dark:hover:border-orange-500/50 shadow-lg shadow-orange-500/5';
        typeBadgeStyle = 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/30';
    } else if (order.isUpgrade) {
        cardStyle = 'bg-fuchsia-50/90 dark:bg-fuchsia-950/20 backdrop-blur-2xl border-fuchsia-200 dark:border-fuchsia-500/30 hover:border-fuchsia-300 dark:hover:border-fuchsia-500/50 shadow-lg shadow-fuchsia-500/5';
        typeBadgeStyle = 'bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-500/30';
    } else if (order.isMix) {
        cardStyle = 'bg-rose-50/90 dark:bg-rose-950/20 backdrop-blur-2xl border-rose-200 dark:border-rose-500/30 hover:border-rose-300 dark:hover:border-rose-500/50 shadow-lg shadow-rose-500/5';
        typeBadgeStyle = 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30';
    } else if (order.paymentType === 'Monthly') {
        typeBadgeStyle = 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30';
    } else if (order.paymentType === 'Full') {
        typeBadgeStyle = 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30';
    } else if (order.paymentType === 'Installment') {
        typeBadgeStyle = 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30';
    }

    return (
        <div className={`border p-6 rounded-[2rem] flex flex-col xl:flex-row items-start justify-between gap-6 transition-all ${cardStyle}`}>
            <div className="flex-1 w-full">
                
                {order.hasDuplicate && (
                    <div className="mb-5 p-4 rounded-2xl bg-rose-100 dark:bg-rose-950/50 border-2 border-rose-400 dark:border-rose-500/50 text-rose-900 dark:text-rose-200 flex items-start gap-3 shadow-md">
                        <AlertTriangle size={20} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        <div>
                            <div className="font-black text-sm uppercase tracking-wide text-rose-700 dark:text-rose-300 flex items-center gap-2">
                                ⚠️ DUPLICATE DELIVERY WARNING (කලින් යවපු Tutes හමුවුණා)
                            </div>
                            <p className="mt-1 text-xs font-bold text-rose-800 dark:text-rose-200/90 leading-relaxed">
                                මේ ළමයාට මීට කලින් ලබාදුන් Tute එකක් හෝ කිහිපයක් නැවත මෙම Order එකට ඇතුළත්ව ඇත. Pack කිරීමට පෙර පරීක්ෂා කරන්න!
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex gap-5 items-start border-b border-gray-200 dark:border-white/10 pb-6 mb-6 transition-colors">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border-2 mt-1 shadow-md backdrop-blur-md ${order.hasDuplicate ? 'border-rose-400 dark:border-rose-500/50 bg-rose-100/90 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' : (order.status === 'Hold' ? 'border-orange-300 dark:border-orange-500/40 bg-orange-100/80 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400' : 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-100/80 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400')}`}>
                        {order.hasDuplicate ? <AlertTriangle size={26} strokeWidth={2.5}/> : (order.status === 'Hold' ? <AlertTriangle size={26} strokeWidth={2.5}/> : <Check size={26} strokeWidth={2.5}/>)}
                    </div>
                    <div className="flex-1 w-full">
                        {!isEditingInfo ? (
                            <div className="relative group w-full">
                                <h4 className="font-black text-2xl text-gray-900 dark:text-white flex flex-wrap items-center gap-3 transition-colors mb-2">
                                    <span 
                                        className="cursor-pointer hover:text-brand-accent transition-colors underline-offset-4 hover:underline" 
                                        onClick={() => copyToClipboard(tempName, "Name")}
                                        title="Click to copy Name"
                                    >
                                        {tempName}
                                    </span>
                                    <span className={`text-[11px] font-black px-3 py-1.5 rounded-lg border tracking-widest uppercase shadow-sm flex items-center gap-1.5 transition-colors ${typeBadgeStyle}`}>
                                        {order.isUpgrade ? `UPGRADE ORDER • ${order.paymentType}` : (order.isMix ? `MIXED ORDER • ${order.paymentType}` : order.paymentType)}
                                    </span>
                                    {order.hasDuplicate && (
                                        <span className="text-[11px] font-black text-white bg-rose-600 dark:bg-rose-600 px-3 py-1.5 rounded-lg border border-rose-700 dark:border-rose-500 uppercase tracking-widest shadow-md flex items-center gap-1.5 animate-pulse">
                                            <AlertTriangle size={12} className="text-white"/> DUPLICATE ALERT
                                        </span>
                                    )}
                                    {order.status === 'Hold' ? (
                                        <span className="text-[11px] font-black text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-500/20 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-500/30 uppercase tracking-widest shadow-sm flex items-center gap-1">
                                            <AlertTriangle size={12}/> ON HOLD
                                        </span>
                                    ) : (
                                        <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/30 uppercase tracking-widest shadow-sm flex items-center gap-1">
                                            <Clock size={12}/> PENDING
                                        </span>
                                    )}
                                    {order.bizName && (
                                        <span className="text-[11px] font-black text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-500/30 uppercase tracking-widest shadow-sm">
                                            {order.bizName}
                                        </span>
                                    )}
                                    <span className="text-[11px] font-black text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-500/20 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-500/30 uppercase tracking-widest shadow-sm transition-colors backdrop-blur-md">BATCH: {order.batchName}</span>
                                    {order.groupName && order.groupName !== 'No Group' && (
                                        <span className="text-[11px] font-black text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-500/20 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-500/30 uppercase tracking-widest shadow-sm transition-colors backdrop-blur-md">MONTH: {order.groupName}</span>
                                    )}
                                    {order.createdAt && (
                                        <span 
                                            className="text-[11px] font-black text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-500/30 uppercase tracking-widest shadow-sm transition-colors backdrop-blur-md flex items-center gap-1.5"
                                            title={`Order Placed: ${new Date(order.createdAt).toLocaleString()}`}
                                        >
                                            <Calendar size={12}/> ORDERED: {new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                    )}
                                </h4>
                                <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed w-11/12 font-bold bg-white/60 dark:bg-black/20 p-2.5 rounded-xl border border-gray-200 dark:border-white/5 inline-block transition-colors shadow-sm backdrop-blur-md">
                                    <span 
                                        className="cursor-pointer hover:text-brand-accent transition-colors underline-offset-4 hover:underline"
                                        onClick={() => copyToClipboard(tempAddress, "Address")}
                                        title="Click to copy Address"
                                    >
                                        {tempAddress}
                                    </span> 
                                    <span className="mx-2 text-gray-400 dark:text-white/20">•</span> 
                                    <span 
                                        className="text-emerald-600 dark:text-emerald-400 font-black cursor-pointer hover:text-emerald-500 hover:underline underline-offset-4 transition-colors"
                                        onClick={() => copyToClipboard(tempPhone, "Phone")}
                                        title="Click to copy Phone"
                                    >
                                        {tempPhone}
                                    </span>
                                </p>
                                
                                {order.status === 'Hold' && (
                                    <div className="mt-4 bg-orange-50/80 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 p-4 rounded-2xl shadow-inner inline-block w-full transition-colors backdrop-blur-md">
                                        <h5 className="text-orange-700 dark:text-orange-400 font-black text-sm flex items-center gap-2 mb-2"><AlertTriangle size={18}/> Delivery On Hold</h5>
                                        <div className="ml-7 text-xs text-orange-800 dark:text-orange-200/80 font-bold space-y-1">
                                            <p><span className="text-orange-600 dark:text-orange-400/80 font-black uppercase tracking-wider">Reason:</span> {order.holdReason}</p>
                                            {order.holdRemark && <p><span className="text-orange-600 dark:text-orange-400/80 font-black uppercase tracking-wider">Remark:</span> {order.holdRemark}</p>}
                                        </div>
                                    </div>
                                )}

                                {!isReadOnly && (
                                    <button onClick={() => setIsEditingInfo(true)} title="Edit Details for Sticker" className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 bg-brand-accent text-white p-2.5 rounded-xl hover:bg-brand-accentHover transition-all shadow-lg scale-95 hover:scale-100">
                                        <Edit2 size={18}/>
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="bg-white/80 dark:bg-black/30 p-5 rounded-2xl border border-brand-accent/50 shadow-inner backdrop-blur-xl transition-colors">
                                <h4 className="text-xs text-brand-accent font-black uppercase tracking-widest mb-4 flex items-center gap-2"><Edit2 size={14}/> Edit Details for Sticker</h4>
                                <div className="space-y-3">
                                    <input type="text" value={tempName} onChange={(e)=>setTempName(e.target.value)} className="w-full bg-white dark:bg-black/40 text-sm text-gray-900 dark:text-white p-3 border border-gray-300 dark:border-white/10 rounded-xl outline-none focus:border-brand-accent dark:focus:border-brand-accent font-bold transition-colors shadow-sm" placeholder="Student Name"/>
                                    <input type="text" value={tempPhone} onChange={(e)=>setTempPhone(e.target.value)} className="w-full bg-white dark:bg-black/40 text-sm text-gray-900 dark:text-white p-3 border border-gray-300 dark:border-white/10 rounded-xl outline-none focus:border-brand-accent dark:focus:border-brand-accent font-bold transition-colors shadow-sm" placeholder="Phone Number"/>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input type="text" value={tempHouseNo} onChange={(e)=>setTempHouseNo(e.target.value)} className="w-full bg-white dark:bg-black/40 text-sm text-gray-900 dark:text-white p-3 border border-gray-300 dark:border-white/10 rounded-xl outline-none focus:border-brand-accent dark:focus:border-brand-accent font-bold transition-colors shadow-sm" placeholder="House No"/>
                                        <input type="text" value={tempStreet} onChange={(e)=>setTempStreet(e.target.value)} className="w-full bg-white dark:bg-black/40 text-sm text-gray-900 dark:text-white p-3 border border-gray-300 dark:border-white/10 rounded-xl outline-none focus:border-brand-accent dark:focus:border-brand-accent font-bold transition-colors shadow-sm" placeholder="Street"/>
                                        <input type="text" value={tempCity} onChange={(e)=>setTempCity(e.target.value)} className="w-full bg-white dark:bg-black/40 text-sm text-gray-900 dark:text-white p-3 border border-gray-300 dark:border-white/10 rounded-xl outline-none focus:border-brand-accent dark:focus:border-brand-accent font-bold transition-colors shadow-sm" placeholder="City"/>
                                        <input type="text" value={tempDistrict} onChange={(e)=>setTempDistrict(e.target.value)} className="w-full bg-white dark:bg-black/40 text-sm text-gray-900 dark:text-white p-3 border border-gray-300 dark:border-white/10 rounded-xl outline-none focus:border-brand-accent dark:focus:border-brand-accent font-bold transition-colors shadow-sm" placeholder="District"/>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-4">
                                    <button onClick={saveEdit} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black py-3 rounded-xl flex justify-center items-center gap-2 shadow-lg shadow-emerald-600/20 transition-colors"><Save size={16}/> Save Edit</button>
                                    <button onClick={cancelEdit} className="px-5 bg-gray-500 dark:bg-slate-700 hover:bg-gray-600 dark:hover:bg-slate-600 text-white rounded-xl flex justify-center items-center font-bold transition-colors shadow-md"><X size={18}/></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {order.items?.filter((item, index, self) => 
                        index === self.findIndex((t) => t.tuteName === item.tuteName)
                    ).map((item, i) => (
                        <div key={i} className={`flex items-center justify-between p-3.5 rounded-2xl shadow-sm transition-colors group ${item.isDuplicate ? 'bg-rose-100/80 dark:bg-rose-950/40 border-2 border-rose-400 dark:border-rose-500/60 shadow-rose-500/10' : 'bg-white/60 dark:bg-black/20 backdrop-blur-md border border-gray-200 dark:border-white/5 hover:bg-white/80 dark:hover:bg-white/5'}`}>
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                
                                <div className="shrink-0 w-12 h-16 bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg flex items-center justify-center overflow-hidden shadow-sm relative z-10 hover:z-50 transition-all duration-300 hover:scale-[2.5] hover:translate-x-4 hover:-translate-y-2 origin-left cursor-zoom-in">
                                    <DeliveryItemImage coverName={item.tuteImage} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h5 className="text-[14px] font-black text-gray-900 dark:text-white truncate tracking-wide flex items-center gap-2 mb-1.5 transition-colors">
                                        <BookOpen size={14} className={item.isDuplicate ? "text-rose-600 dark:text-rose-400 shrink-0" : "text-brand-accent shrink-0"}/>{item.tuteName}
                                    </h5>
                                    <p className="text-[11px] font-bold text-gray-700 dark:text-slate-300 truncate bg-gray-200/80 dark:bg-white/10 inline-block px-2.5 py-0.5 rounded shadow-sm transition-colors">{item.courseName}</p>
                                    <p className="text-[10px] font-black text-brand-accent dark:text-brand-accent uppercase tracking-widest truncate mt-1.5 transition-colors">{item.lecturerName}</p>

                                    {item.isDuplicate && item.duplicateDetails && (
                                        <div className="mt-2 text-[11px] font-black text-rose-800 dark:text-rose-200 bg-rose-200/80 dark:bg-rose-900/40 px-2.5 py-1 rounded-lg border border-rose-400 dark:border-rose-500/40 flex items-center gap-1.5 shadow-sm">
                                            <AlertTriangle size={13} className="shrink-0 text-rose-600 dark:text-rose-300"/>
                                            <span>Already Delivered in <strong>ORD-{item.duplicateDetails.orderId}</strong> ({item.duplicateDetails.groupName}) on {item.duplicateDetails.date}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="shrink-0 pl-3 border-l border-gray-200 dark:border-white/10 ml-3 transition-colors">
                                <img 
                                    src={getLecImgUrl(item.lecturerImage)} 
                                    onError={(e) => { e.target.onerror = null; e.target.src = '/logo.png'; }} 
                                    className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-brand-darkCard bg-gray-100 dark:bg-black/40 shadow-md transition-colors" 
                                    alt="Lecturer"
                                    title={item.lecturerName}
                                />
                            </div>
                        </div>
                    ))}
                </div>
                
                {order.lastDelivery ? (
                    <div className="mt-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-200/60 dark:border-blue-500/20 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:shadow-md transition-all group" onClick={fetchStudentHistory}>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm group-hover:scale-105 transition-transform">
                                <History size={20} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h6 className="text-sm font-black text-blue-900 dark:text-blue-100">Last Delivery</h6>
                                    <span className="text-[10px] bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-black tracking-widest uppercase">{order.lastDelivery.paymentMonth} ({order.lastDelivery.paymentType})</span>
                                </div>
                                <p className="text-xs text-blue-700/80 dark:text-blue-300/70 font-bold">
                                    Packed on {new Date(order.lastDelivery.packedAt).toLocaleDateString('en-GB')} • <span className="font-black text-indigo-700 dark:text-indigo-400">{order.lastDelivery.trackingNumber ? `TRK: ${order.lastDelivery.trackingNumber}` : 'No Tracking No'}</span>
                                </p>
                                {order.lastDelivery.packRemark ? (
                                    <p className="text-[10px] text-yellow-700 dark:text-yellow-400 font-bold mt-1 bg-yellow-50 dark:bg-yellow-500/10 px-2 py-0.5 rounded inline-block border border-yellow-200 dark:border-yellow-500/20">
                                        <span className="font-black uppercase tracking-widest">Remark:</span> {order.lastDelivery.packRemark}
                                    </p>
                                ) : (
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mt-1 bg-gray-50 dark:bg-gray-500/10 px-2 py-0.5 rounded inline-block border border-gray-200 dark:border-gray-500/20">
                                        <span className="font-black uppercase tracking-widest">Remark:</span> N/A
                                    </p>
                                )}
                            </div>
                        </div>
                        <button className="text-xs font-black text-blue-600 dark:text-blue-400 bg-white dark:bg-blue-500/10 hover:bg-blue-50 dark:hover:bg-blue-500/20 px-4 py-2.5 rounded-xl border border-blue-200 dark:border-blue-500/30 shadow-sm transition-colors flex items-center gap-2">
                            VIEW ALL <Eye size={14}/>
                        </button>
                    </div>
                ) : (
                    <div className="mt-5 flex justify-end">
                        <button onClick={fetchStudentHistory} className="text-xs font-black text-brand-accent hover:text-brand-accentHover flex items-center gap-2 bg-brand-accentLight/50 dark:bg-brand-accent/10 px-4 py-2.5 rounded-xl transition-colors border border-brand-accent/20 shadow-sm">
                            <History size={14}/> View Past Deliveries
                        </button>
                    </div>
                )}
            </div>
            
            <div className="flex flex-col items-stretch w-full xl:w-[360px] shrink-0 bg-white/50 dark:bg-black/20 backdrop-blur-xl p-6 rounded-3xl border border-gray-200 dark:border-white/10 gap-5 shadow-lg transition-colors">
                
                <div className="flex gap-3">
                            <button onClick={() => handleLabelAction(false)} className="flex-1 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-gray-800 dark:text-slate-200 font-black py-4 px-4 rounded-2xl transition-all text-sm border border-gray-200 dark:border-white/10 shadow-sm flex items-center justify-center gap-2" title="Preview Sticker">
                                <Eye size={18}/> View
                            </button>
                            <button onClick={() => handleLabelAction(true)} className="flex-[2] bg-gray-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white font-black py-4 rounded-2xl transition-all text-sm uppercase tracking-widest shadow-lg shadow-gray-900/20 dark:shadow-none flex items-center justify-center gap-2 border border-transparent dark:border-slate-500">
                                <Printer size={18}/> Print Label
                            </button>
                </div>

                <div className="relative">
                    <ScanBarcode size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-emerald-400/50"/>
                    <input 
                        ref={barcodeInputRef}
                        type="text" 
                        placeholder="Scan Barcode here..." 
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        onKeyDown={handlePack}
                        disabled={isReadOnly}
                        className="w-full bg-white dark:bg-black/40 border-2 border-emerald-400 dark:border-emerald-500/30 rounded-2xl pl-12 pr-4 py-4 text-base text-emerald-700 dark:text-emerald-400 font-black outline-none focus:border-emerald-500 dark:focus:border-emerald-400 placeholder-gray-400 dark:placeholder-slate-500 uppercase tracking-widest text-center shadow-inner transition-colors"
                    />
                </div>

                {!isReadOnly && (
                    <div className="flex flex-col gap-2">
                        <button onClick={() => setShowPackRemark(!showPackRemark)} className="text-xs font-bold text-gray-500 dark:text-slate-400 flex items-center justify-end gap-1 hover:text-gray-700 dark:hover:text-white transition-colors">
                            {showPackRemark ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} {showPackRemark ? 'Hide Internal Remark' : 'Add Internal Remark (Delivery Only)'}
                        </button>
                        
                        {showPackRemark && (
                            <textarea 
                                value={packRemark} 
                                onChange={handlePackRemarkChange} 
                                placeholder="Type internal remark here... (Saved in History)" 
                                rows="2" 
                                className="w-full bg-gray-50 dark:bg-black/40 border border-gray-300 dark:border-white/10 rounded-2xl p-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-500 resize-none placeholder-gray-400 dark:placeholder-slate-500 shadow-sm transition-colors animate-fade-in"
                            ></textarea>
                        )}
                        
                        <button disabled={isProcessing} onClick={() => handlePack()} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl transition-all text-sm uppercase tracking-widest shadow-lg shadow-emerald-600/30 dark:shadow-none flex justify-center items-center gap-2 border border-transparent dark:border-emerald-500/50">
                            {isProcessing ? <Loader2 size={18} className="animate-spin"/> : <Check size={20}/>} Mark as Packed
                        </button>
                    </div>
                )}

                {order.status !== 'Hold' && !isReadOnly && (
                    <button onClick={() => setIsHolding(true)} className="w-full bg-orange-50/80 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 font-black py-4 rounded-2xl transition-all text-sm uppercase tracking-widest border border-orange-200 dark:border-orange-500/30 shadow-sm flex justify-center items-center gap-2">
                        <AlertTriangle size={18}/> Hold Order
                    </button>
                )}

            </div>

            {isHolding && createPortal(
                <div className="fixed inset-0 z-[9999] bg-gray-900/60 dark:bg-[#0a0f1c]/95 flex items-center justify-center p-4 backdrop-blur-md transition-colors animate-fade-in">
                    <div className="bg-white dark:bg-[#15192b] border border-gray-200 dark:border-orange-500/30 rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 transition-colors">
                        <h3 className="text-2xl font-black text-orange-600 dark:text-orange-400 flex items-center gap-3 mb-4"><AlertTriangle size={28}/> Hold Delivery</h3>
                        <p className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-6 bg-orange-50 dark:bg-orange-500/10 p-4 rounded-xl border border-orange-200 dark:border-orange-500/20 shadow-sm transition-colors leading-relaxed">Holding this will immediately notify the student on their dashboard.</p>
                        
                        <label className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 block transition-colors">Select Reason</label>
                        <select value={holdReason} onChange={(e) => setHoldReason(e.target.value)} className="w-full bg-gray-50 dark:bg-black/40 border border-gray-300 dark:border-white/10 rounded-2xl p-4 text-gray-900 dark:text-white mb-5 outline-none focus:border-orange-500 dark:focus:border-orange-500 text-sm font-bold shadow-sm transition-colors">
                            <option value="Out of Stock">Tute Out of Stock</option>
                            <option value="Address Issue">Address Missing / Issue</option>
                            <option value="Payment Verification">Payment Verification Failed</option>
                            <option value="Other">Other</option>
                        </select>

                        {holdReason === 'Other' && (
                            <textarea 
                                value={holdRemark} 
                                onChange={handleRemarkChange} 
                                placeholder="Type reason here... (Draft saves automatically)" 
                                rows="3" 
                                className="w-full bg-gray-50 dark:bg-black/40 border border-gray-300 dark:border-white/10 rounded-2xl p-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-orange-500 dark:focus:border-orange-500 mb-5 resize-none placeholder-gray-400 dark:placeholder-slate-500 shadow-sm transition-colors"
                            ></textarea>
                        )}

                        <div className="flex gap-4 mt-2">
                            <button onClick={() => setIsHolding(false)} className="flex-1 py-4 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-2xl text-gray-700 dark:text-slate-300 font-black transition-all text-sm uppercase tracking-widest border border-gray-200 dark:border-white/10">Cancel</button>
                            <button disabled={isProcessing} onClick={submitHold} className="flex-[1.5] bg-orange-600 hover:bg-orange-500 text-white rounded-2xl py-4 font-black transition-all shadow-lg shadow-orange-600/30 dark:shadow-none text-sm uppercase tracking-widest flex justify-center items-center gap-2 border border-transparent dark:border-orange-500/50">
                                {isProcessing ? <Loader2 size={20} className="animate-spin"/> : "Confirm Hold"}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {isHistoryOpen && createPortal(
                <div className="fixed inset-0 z-[9999] bg-gray-900/60 dark:bg-[#0a0f1c]/95 flex items-center justify-center p-4 backdrop-blur-md transition-colors animate-fade-in">
                    <div className="bg-white dark:bg-[#15192b] border border-gray-200 dark:border-white/10 rounded-[2rem] p-8 w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 transition-colors flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3"><History size={28} className="text-brand-accent"/> Past Deliveries: {order.studentName}</h3>
                            <button onClick={() => setIsHistoryOpen(false)} className="text-gray-400 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 bg-gray-100 dark:bg-white/5 p-2 rounded-xl transition-colors shadow-sm">
                                <X size={20}/>
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            {historyLoading ? (
                                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-accent" size={40}/></div>
                            ) : studentHistory.length === 0 ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl py-12">
                                    <BookOpen size={40} className="text-gray-300 dark:text-slate-600 mb-3"/>
                                    <p className="text-gray-500 dark:text-slate-400 font-bold text-lg">No past deliveries found for this student.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {studentHistory.map(hist => (
                                        <div key={hist.id} className="bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl p-5 flex flex-col md:flex-row justify-between gap-4 items-start md:items-center hover:border-brand-accent/30 transition-colors">
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="font-black text-gray-900 dark:text-white">ORD-{hist.id}</span>
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${
                                                        hist.status === 'Received' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200' 
                                                        : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200'
                                                    }`}>
                                                        {hist.status === 'Received' ? 'Delivered' : hist.status}
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-slate-400 font-bold">
                                                        {new Date(hist.packedAt || hist.updatedAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {hist.items?.map((item, idx) => (
                                                        <span key={idx} className="bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-slate-300 text-xs font-bold px-2.5 py-1 rounded border border-gray-200 dark:border-white/10 flex items-center gap-1.5">
                                                            <BookOpen size={12} className="text-brand-accent"/> {item.tuteName} (x{item.quantity})
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="shrink-0 flex flex-col gap-2 items-end">
                                                {hist.trackingNumber ? (
                                                    <div className="bg-gray-50 dark:bg-black/40 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/5 text-center min-w-[120px]">
                                                        <p className="text-[10px] text-gray-500 dark:text-slate-400 font-black uppercase tracking-widest mb-1">Tracking</p>
                                                        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-black tracking-wider">{hist.trackingNumber}</p>
                                                    </div>
                                                ) : (
                                                    <div className="bg-gray-50 dark:bg-black/40 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/5 text-center min-w-[120px]">
                                                        <p className="text-[10px] text-gray-500 dark:text-slate-400 font-black uppercase tracking-widest mb-1">Tracking</p>
                                                        <p className="text-sm text-gray-400 dark:text-gray-500 font-black tracking-wider">N/A</p>
                                                    </div>
                                                )}
                                                
                                                {hist.packRemark ? (
                                                    <div className="text-[10px] bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 p-2 rounded-lg border border-yellow-200 dark:border-yellow-500/20 max-w-[200px] min-w-[120px] break-words text-left">
                                                        <span className="font-black uppercase tracking-widest block mb-0.5 text-[9px]">Remark:</span>
                                                        {hist.packRemark}
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] bg-gray-50 dark:bg-gray-500/10 text-gray-500 dark:text-gray-400 p-2 rounded-lg border border-gray-200 dark:border-gray-500/20 max-w-[200px] min-w-[120px] break-words text-left">
                                                        <span className="font-black uppercase tracking-widest block mb-0.5 text-[9px]">Remark:</span>
                                                        N/A
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}