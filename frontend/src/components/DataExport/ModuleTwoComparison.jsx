import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import { Loader2, GitCompare, Users, Target, UserPlus } from 'lucide-react';

export default function ModuleTwoComparison({ businesses, selectedBusiness }) {
    const [batchA, setBatchA] = useState('');
    const [batchB, setBatchB] = useState('');
    const [loading, setLoading] = useState(false);
    const [comparisonData, setComparisonData] = useState(null);

    const selectedBizObj = businesses.find(b => String(b.id) === String(selectedBusiness));
    const availableBatches = selectedBizObj && selectedBizObj.batches ? selectedBizObj.batches : [];

    const fetchComparison = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/admin/data-export/compare-batches', {
                headers: { Authorization: `Bearer ${token}` },
                params: { businessId: selectedBusiness, batchAId: batchA, batchBId: batchB }
            });
            setComparisonData(res.data);
        } catch (error) {
            console.error("Comparison Error:", error);
            toast.error("Failed to load batch comparison");
        }
        setLoading(false);
    };

    useEffect(() => {
        if (selectedBusiness && batchA && batchB && batchA !== batchB) {
            fetchComparison();
        } else {
            setComparisonData(null);
        }
    }, [selectedBusiness, batchA, batchB]);

    if (!selectedBusiness) {
        return (
            <div className="flex flex-col justify-center items-center h-64 bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-sm m-2">
                <GitCompare className="text-slate-500 opacity-50 mb-3" size={48} />
                <span className="text-slate-400 text-sm font-medium">Please select a Campaign (Business) above first.</span>
            </div>
        );
    }

    const renderCard = (title, icon, valA, valB, colorClass) => {
        const diff = valB - valA;
        const diffStr = diff > 0 ? `+${diff}` : diff;
        const diffColor = diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-slate-500';

        return (
            <div className={`p-5 rounded-2xl border border-slate-700/50 bg-[#0f172a] shadow-lg relative overflow-hidden group`}>
                <div className={`absolute top-0 right-0 w-32 h-32 bg-${colorClass}-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-${colorClass}-500/10`}></div>
                
                <h4 className={`text-[10px] font-black text-${colorClass}-400 uppercase tracking-widest mb-4 flex items-center gap-2`}>
                    {icon} {title}
                </h4>
                
                <div className="flex justify-between items-end relative z-10">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{comparisonData?.batchA?.batchName || 'Batch A'}</span>
                        <span className="text-2xl font-black text-white">{valA}</span>
                    </div>
                    
                    <div className="flex flex-col items-center px-4">
                        <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-1">Diff</span>
                        <span className={`text-lg font-black ${diffColor}`}>{diffStr}</span>
                    </div>

                    <div className="flex flex-col text-right">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{comparisonData?.batchB?.batchName || 'Batch B'}</span>
                        <span className="text-2xl font-black text-white">{valB}</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 mt-2 pb-6">
            
            <div className="bg-[#1e293b] p-6 rounded-[2rem] border border-slate-700/50 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <GitCompare className="text-purple-400" size={24} />
                        Batch Comparison Engine
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Select two batches to compare their retention, drops, and conversions.</p>
                </div>

                <div className="flex items-center gap-3">
                    <select 
                        value={batchA} 
                        onChange={(e) => setBatchA(e.target.value)}
                        className="bg-black/40 border border-slate-700 text-xs font-bold text-white rounded-xl py-2 px-4 outline-none w-48 focus:border-indigo-500 transition-colors"
                    >
                        <option value="">Select Base Batch</option>
                        {availableBatches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>

                    <div className="text-slate-500 font-black">VS</div>

                    <select 
                        value={batchB} 
                        onChange={(e) => setBatchB(e.target.value)}
                        className="bg-black/40 border border-slate-700 text-xs font-bold text-white rounded-xl py-2 px-4 outline-none w-48 focus:border-purple-500 transition-colors"
                    >
                        <option value="">Select Target Batch</option>
                        {availableBatches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading && (
                <div className="flex justify-center py-12">
                    <Loader2 className="animate-spin text-purple-500" size={40} />
                </div>
            )}

            {!loading && comparisonData && (!comparisonData.batchA || !comparisonData.batchB) && (
                <div className="text-center py-12 text-slate-400 text-sm font-medium bg-[#1e293b] rounded-3xl border border-slate-700/50">
                    One or both of the selected batches could not be found or have no data.
                </div>
            )}

            {!loading && comparisonData && comparisonData.batchA && comparisonData.batchB && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderCard('Free Seminar Leads', <Users size={16}/>, comparisonData.batchA.freeSem, comparisonData.batchB.freeSem, 'indigo')}
                    {renderCard('Open Seminar Leads', <Users size={16}/>, comparisonData.batchA.openSem, comparisonData.batchB.openSem, 'blue')}
                    {renderCard('New Inquiries', <UserPlus size={16}/>, comparisonData.batchA.newInq, comparisonData.batchB.newInq, 'cyan')}
                    {renderCard('Real Enrolled Students', <Target size={16}/>, comparisonData.batchA.uniqueEnrolled, comparisonData.batchB.uniqueEnrolled, 'emerald')}
                </div>
            )}

            {/* Placeholder for deeper comparison tables if needed */}
            {!loading && comparisonData && comparisonData.batchA && comparisonData.batchB && (
                <div className="bg-[#0f172a] rounded-[2rem] border border-slate-700/50 p-8 text-center text-slate-500 mt-4">
                    <GitCompare size={32} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium tracking-wide">Select additional metrics to compare distribution & retention patterns.</p>
                </div>
            )}

        </div>
    );
}
