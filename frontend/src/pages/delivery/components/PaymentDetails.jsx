import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Loader2, Download, Filter, Search, CheckCircle, Clock, Check, AlertTriangle, Layers, Wallet } from 'lucide-react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function PaymentDetails({ isReadOnly }) {
    const [loading, setLoading] = useState(true);
    const [businesses, setBusinesses] = useState([]);
    const [selectedBiz, setSelectedBiz] = useState(null);
    const [payments, setPayments] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activePayTab, setActivePayTab] = useState('All');
    const [installmentNo, setInstallmentNo] = useState('All');
    const [selectedBatch, setSelectedBatch] = useState('All');

    const getBizLogoUrl = (imageName) => (!imageName || imageName === 'default.png' || imageName === 'null') ? '/logo.png' : `${axios.defaults.baseURL}/storage/icons/${imageName}`;

    useEffect(() => {
        fetchBusinesses();
    }, []);

    useEffect(() => {
        if (selectedBiz) {
            fetchPaymentsForBiz(selectedBiz);
        }
    }, [selectedBiz]);

    const fetchBusinesses = async () => {
        setLoading(true);
        try {
            const bizRes = await axios.get('/admin/businesses');
            setBusinesses(bizRes.data?.data || bizRes.data || []);
        } catch (error) {
            toast.error("Failed to load businesses.");
        } finally {
            setLoading(false);
        }
    };

    const fetchPaymentsForBiz = async (bizId) => {
        setLoading(true);
        try {
            const res = await axios.get('/admin/delivery/payment-details', {
                params: { businessId: bizId }
            });
            setPayments(res.data || []);
            setActivePayTab('All');
            setInstallmentNo('All');
            setSelectedBatch('All');
        } catch (error) {
            toast.error("Failed to load payment details.");
        } finally {
            setLoading(false);
        }
    };

    const uniqueBatches = useMemo(() => {
        const batches = [...new Set(payments.map(p => p.batchName).filter(Boolean))];
        return batches.sort();
    }, [payments]);

    const tabCounts = useMemo(() => {
        const counts = { All: 0, Mixed: 0, 1: 0, 2: 0, 3: 0 }; // 1=Monthly, 2=Installment, 3=Full
        payments.forEach(p => {
            if (selectedBatch !== 'All' && p.batchName !== selectedBatch) return;

            if (p.isMix) counts.Mixed++;
            else {
                counts.All++;
                if (p.paymentType === 1 || p.paymentType === '1' || p.paymentType === 'Monthly') counts[1]++;
                if (p.paymentType === 2 || p.paymentType === '2' || p.paymentType === 'Installment') counts[2]++;
                if (p.paymentType === 3 || p.paymentType === '3' || p.paymentType === 'Full') counts[3]++;
            }
        });
        return counts;
    }, [payments, selectedBatch]);

    const filteredPayments = useMemo(() => {
        return payments.filter(pay => {
            if (selectedBatch !== 'All' && pay.batchName !== selectedBatch) return false;

            let matchesTab = false;
            let typeStr = (pay.paymentType === 1 || pay.paymentType === '1' || pay.paymentType === 'Monthly') ? 'Monthly' : 
                          ((pay.paymentType === 2 || pay.paymentType === '2' || pay.paymentType === 'Installment') ? 'Installment' : 'Full');

            if (activePayTab === 'All') matchesTab = !pay.isMix;
            else if (activePayTab === 'Mixed') matchesTab = pay.isMix;
            else matchesTab = !pay.isMix && typeStr === activePayTab;

            let matchesInstallment = true;
            if ((activePayTab === 'Monthly' || activePayTab === 'Installment') && installmentNo !== 'All') {
                matchesInstallment = parseInt(pay.installmentNo) === parseInt(installmentNo);
            }

            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = pay.studentName?.toLowerCase().includes(searchLower) || 
                                  pay.studentId?.toLowerCase().includes(searchLower) ||
                                  pay.phone?.includes(searchQuery);

            return matchesTab && matchesInstallment && matchesSearch;
        });
    }, [payments, activePayTab, installmentNo, searchQuery, selectedBatch]);

    const uniqueInstallments = useMemo(() => {
        if (activePayTab === 'All' || activePayTab === 'Mixed' || activePayTab === 'Full') return [];
        const typesToMatch = activePayTab === 'Monthly' ? [1, '1', 'Monthly'] : [2, '2', 'Installment'];
        const applicable = payments.filter(p => !p.isMix && typesToMatch.includes(p.paymentType) && (selectedBatch === 'All' || p.batchName === selectedBatch));
        const insts = [...new Set(applicable.map(p => parseInt(p.installmentNo) || 1))];
        return insts.sort((a, b) => a - b);
    }, [payments, activePayTab, selectedBatch]);

    const handleExport = () => {
        if (filteredPayments.length === 0) {
            toast.error("No data to export!");
            return;
        }

        const dataToExport = filteredPayments.map(p => ({
            "Reference ID": `ORD-${p.id}`,
            "Student Name": p.studentName,
            "Student ID": p.studentId,
            "Phone": p.phone,
            "Address": p.address,
            "Batch": p.batchName,
            "Payment Type": (p.paymentType === 1 || p.paymentType === '1' || p.paymentType === 'Monthly') ? 'Monthly' : ((p.paymentType === 2 || p.paymentType === '2' || p.paymentType === 'Installment') ? 'Installment' : 'Full'),
            "Installment No": p.installmentNo,
            "Payment Date": p.paymentDate,
            "Delivery Status": p.status,
            "Is Mixed Order": p.isMix ? "Yes" : "No"
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Payment Details");
        XLSX.writeFile(workbook, `Delivery_Payment_Details_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    if (loading && !selectedBiz) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-accent" size={40}/></div>;

    return (
        <div className="animate-fade-in font-sans relative z-10">
            {!selectedBiz ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-6">
                    {businesses.map(biz => (
                        <div 
                            key={biz.id} 
                            onClick={() => setSelectedBiz(biz.id)}
                            className="relative bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-8 rounded-[2rem] cursor-pointer transition-all shadow-sm hover:shadow-2xl hover:border-brand-accent/50 dark:hover:border-brand-accent/70 flex flex-col items-center justify-center text-center group"
                        >
                            <div className="w-28 h-28 bg-white/50 dark:bg-black/20 rounded-2xl p-3 border border-gray-100 dark:border-white/5 group-hover:scale-105 transition-transform mb-4 shadow-sm backdrop-blur-sm">
                                <img 
                                    src={getBizLogoUrl(biz.logo)} 
                                    alt={biz.name} 
                                    onError={(e) => { e.target.onerror = null; e.target.src = '/logo.png'; }} 
                                    className="w-full h-full object-contain drop-shadow-sm dark:drop-shadow-lg" 
                                />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white transition-colors">{biz.name}</h3>
                            <p className="text-sm font-bold mt-3 px-4 py-1.5 rounded-full border bg-gray-100/80 dark:bg-white/5 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 transition-colors shadow-sm backdrop-blur-md">
                                View Payment Details
                            </p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 mb-6">
                        <button onClick={() => {setSelectedBiz(null); setPayments([]);}} className="text-base font-bold text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 bg-white/80 dark:bg-white/[0.05] backdrop-blur-xl border border-gray-200 dark:border-white/10 px-6 py-3 rounded-2xl transition-all shrink-0 shadow-md hover:shadow-lg">
                            <ArrowLeft size={18}/> Back
                        </button>

                        <div className="flex flex-wrap gap-3 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl p-2 rounded-2xl border border-gray-200 dark:border-white/10 shadow-lg transition-colors flex-1 xl:flex-none">
                            {[
                                { name: 'All', count: tabCounts.All },
                                { name: 'Mixed', count: tabCounts.Mixed },
                                { name: 'Monthly', count: tabCounts[1] },
                                { name: 'Installment', count: tabCounts[2] },
                                { name: 'Full', count: tabCounts[3] }
                            ].map(tab => (
                                <button 
                                    key={tab.name} 
                                    onClick={() => { setActivePayTab(tab.name); setInstallmentNo('All'); }}
                                    className={`px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${activePayTab === tab.name ? (tab.name === 'Mixed' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 scale-105' : 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30 scale-105') : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10'}`}
                                >
                                    {tab.name === 'Mixed' && <Layers size={16} className={activePayTab === tab.name ? 'text-white' : 'text-rose-500'}/>}
                                    {tab.name !== 'Mixed' && tab.name} 
                                    <span className={`px-2.5 py-1 rounded-lg text-sm font-black transition-colors ${activePayTab === tab.name ? 'bg-black/20 text-white shadow-inner' : 'bg-gray-200/80 dark:bg-black/30 text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-white/10'}`}>
                                        {tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <button onClick={handleExport} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3.5 rounded-2xl font-black transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 text-sm uppercase tracking-widest border border-transparent">
                            <Download size={18}/> Export Excel
                        </button>
                    </div>

                    {/* Secondary Filters */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-brand-accent/70" size={20}/>
                            <input 
                                type="text" 
                                placeholder="Search Name, Phone, or Student ID..." 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)} 
                                className="w-full bg-white/80 dark:bg-black/40 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-2xl pl-12 pr-5 py-3.5 text-gray-900 dark:text-white outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-colors text-sm font-black placeholder-gray-400 dark:placeholder-slate-500 shadow-sm" 
                            />
                        </div>

                        {uniqueBatches.length > 0 && (
                            <div className="relative min-w-[200px]">
                                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                                <select 
                                    value={selectedBatch} 
                                    onChange={(e) => setSelectedBatch(e.target.value)}
                                    className="w-full bg-white/80 dark:bg-black/40 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-2xl pl-11 pr-5 py-3.5 text-gray-900 dark:text-white outline-none focus:border-brand-accent transition-colors text-sm font-black appearance-none shadow-sm cursor-pointer"
                                >
                                    <option value="All">All Batches</option>
                                    {uniqueBatches.map(b => (
                                        <option key={b} value={b}>{b}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {(activePayTab === 'Monthly' || activePayTab === 'Installment') && uniqueInstallments.length > 0 && (
                            <div className="relative min-w-[200px]">
                                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                                <select 
                                    value={installmentNo} 
                                    onChange={(e) => setInstallmentNo(e.target.value)}
                                    className="w-full bg-white/80 dark:bg-black/40 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-2xl pl-11 pr-5 py-3.5 text-gray-900 dark:text-white outline-none focus:border-brand-accent transition-colors text-sm font-black appearance-none shadow-sm cursor-pointer"
                                >
                                    <option value="All">All Installments</option>
                                    {uniqueInstallments.map(num => (
                                        <option key={num} value={num}>Installment / Month {num}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-accent" size={40}/></div>
                    ) : filteredPayments.length === 0 ? (
                        <div className="text-center py-24 bg-white/50 dark:bg-white/[0.02] backdrop-blur-xl rounded-[2rem] border border-gray-200 dark:border-white/5 shadow-sm transition-colors">
                            <p className="text-gray-500 dark:text-slate-400 font-bold text-xl flex flex-col items-center justify-center gap-4">
                                <AlertTriangle size={40} className="text-brand-accent/50" />
                                No payment details found for the selected criteria.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto custom-scrollbar bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl rounded-[2rem] border border-gray-200 dark:border-white/10 shadow-lg">
                            <table className="w-full text-left border-collapse min-w-[900px]">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400 font-black">
                                        <th className="p-5 pl-8">Student</th>
                                        <th className="p-5">Student ID</th>
                                        <th className="p-5">Payment Date</th>
                                        <th className="p-5">Type / Inst. No</th>
                                        <th className="p-5">Delivery Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPayments.map((pay, i) => {
                                        let typeColor = 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30';
                                        let typeText = (pay.paymentType === 1 || pay.paymentType === '1' || pay.paymentType === 'Monthly') ? 'Monthly' : ((pay.paymentType === 2 || pay.paymentType === '2' || pay.paymentType === 'Installment') ? 'Installment' : 'Full');
                                        
                                        if (typeText === 'Full') typeColor = 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30';
                                        if (typeText === 'Installment') typeColor = 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30';
                                        if (pay.isMix) typeColor = 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30';

                                        let statusColor = 'text-gray-500';
                                        if (pay.status === 'Received') statusColor = 'text-emerald-500';
                                        else if (pay.status === 'Pending') statusColor = 'text-blue-500';
                                        else if (pay.status === 'Hold') statusColor = 'text-orange-500';

                                        return (
                                            <tr key={i} className="border-b border-gray-100 dark:border-white/5 hover:bg-white/40 dark:hover:bg-white/5 transition-colors">
                                                <td className="p-5 pl-8">
                                                    <div className="font-black text-gray-900 dark:text-white">{pay.studentName}</div>
                                                    <div className="text-xs font-bold text-gray-500 dark:text-slate-400 mt-1">{pay.phone}</div>
                                                </td>
                                                <td className="p-5">
                                                    <span className="font-bold text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-black/30 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-xs tracking-wider">
                                                        {pay.studentId}
                                                    </span>
                                                </td>
                                                <td className="p-5 font-bold text-gray-600 dark:text-slate-300 text-sm">
                                                    {pay.paymentDate}
                                                </td>
                                                <td className="p-5">
                                                    <div className="flex flex-col items-start gap-1">
                                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border tracking-widest uppercase shadow-sm ${typeColor}`}>
                                                            {pay.isMix ? `MIXED • ${typeText}` : typeText}
                                                        </span>
                                                        {typeText !== 'Full' && (
                                                            <span className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                                                                No: {pay.installmentNo}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-5">
                                                    <span className={`font-black text-sm uppercase tracking-wider ${statusColor}`}>
                                                        {pay.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
