import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import { Database, Filter, AlertTriangle, LayoutDashboard, GitCompare, Lock } from 'lucide-react';
import ModuleOneRetention from './ModuleOneRetention';
import ModuleTwoComparison from './ModuleTwoComparison';
import ModuleCoordinatorKPI from './ModuleCoordinatorKPI';
import ModuleRevenueBreakdown from './ModuleRevenueBreakdown';
import { ArrowLeft } from 'lucide-react';

export default function DataExportDashboard() {
    const navigate = useNavigate();
    const [businesses, setBusinesses] = useState([]);
    const [batches, setBatches] = useState([]);
    const [selectedBusiness, setSelectedBusiness] = useState(() => {
        return localStorage.getItem('callCamp_selectedBusiness') || localStorage.getItem('afterSem_selectedBusiness') || '';
    });
    const [selectedBatch, setSelectedBatch] = useState(() => {
        return localStorage.getItem('callCamp_selectedBatch') || localStorage.getItem('afterSem_selectedBatch') || '';
    });
    const [hasError, setHasError] = useState(false);
    
    // 🔥 State for Tab Switching 🔥
    const [activeModule, setActiveModule] = useState('');

    useEffect(() => {
        const fetchBusinesses = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get('/admin/businesses', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const fetchedBiz = Array.isArray(res.data) ? res.data : (res.data.businesses || []);
                setBusinesses(fetchedBiz);
                if (fetchedBiz.length === 1) {
                    setSelectedBusiness(fetchedBiz[0].id.toString());
                } else if (!selectedBusiness && fetchedBiz.length > 0) {
                    const savedBiz = localStorage.getItem('callCamp_selectedBusiness') || localStorage.getItem('afterSem_selectedBusiness');
                    if (savedBiz && fetchedBiz.some(b => b.id.toString() === savedBiz.toString())) {
                        setSelectedBusiness(savedBiz.toString());
                    } else {
                        setSelectedBusiness(fetchedBiz[0].id.toString());
                    }
                }
            } catch (error) {
                console.error("Failed to fetch businesses", error);
                setHasError(true);
            }
        };
        fetchBusinesses();
    }, []);

    useEffect(() => {
        const fetchBatches = async () => {
            if (!selectedBusiness) {
                setBatches([]);
                return;
            }
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`/admin/batches/${selectedBusiness}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const fetchedBatches = res.data.batches || res.data || [];
                setBatches(fetchedBatches);
                
                // If current selectedBatch is invalid or empty, pick saved or active batch with data
                const savedBatch = localStorage.getItem('callCamp_selectedBatch') || localStorage.getItem('afterSem_selectedBatch');
                const validCurrent = selectedBatch && fetchedBatches.some(b => b.id.toString() === selectedBatch.toString());
                if (validCurrent) {
                    // Keep current valid selection
                } else if (savedBatch && fetchedBatches.some(b => b.id.toString() === savedBatch.toString())) {
                    setSelectedBatch(savedBatch.toString());
                } else if (fetchedBatches.length > 0) {
                    const activeBatchWithData = [...fetchedBatches].reverse().find(b => b.groups && b.groups.length > 0) || fetchedBatches[0];
                    setSelectedBatch(activeBatchWithData.id.toString());
                } else {
                    setSelectedBatch('');
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchBatches();
    }, [selectedBusiness]);

    if (hasError) {
        return (
            <div className="flex flex-col justify-center items-center h-full text-rose-400 bg-white/5 rounded-2xl border border-white/10 m-2">
                <AlertTriangle size={48} className="mb-4 opacity-50" />
                <h2 className="text-xl font-bold uppercase tracking-widest">Failed to Load Data</h2>
                <p className="text-xs text-slate-400 mt-2">Please check your internet connection or backend server.</p>
            </div>
        );
    }

    const selectedBizObj = businesses.find(b => String(b.id) === String(selectedBusiness));

    const renderTabButton = (id, label, Icon, activeColor, comingSoon) => (
        <button 
            key={id}
            onClick={() => !comingSoon && setActiveModule(id)}
            disabled={comingSoon}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                comingSoon 
                ? 'opacity-40 cursor-not-allowed text-slate-500 bg-transparent' 
                : activeModule === id 
                    ? `${activeColor} text-white shadow-md` 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
        >
            <Icon size={14} /> 
            <span className="hidden xl:inline">{label}</span>
            <span className="xl:hidden">{label.split(':')[0]}</span>
        </button>
    );

    return (
        <div className="flex flex-col gap-6 font-sans text-slate-200 p-2 animate-fade-in h-full">
            
            {/* Top Filter Section */}
            <div className="bg-[#1e293b] p-5 rounded-[2rem] border border-slate-700/50 shadow-xl flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    {activeModule ? (
                        <button 
                            onClick={() => setActiveModule('')}
                            className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 transition-all"
                            title="Back to Dashboard"
                        >
                            <ArrowLeft size={24} />
                        </button>
                    ) : (
                        <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
                            <Database size={24} />
                        </div>
                    )}
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-wider">
                            {activeModule === 'module1' ? 'Drop & Growth Analytics' : 
                             activeModule === 'module2' ? 'Coordinator KPI Matrix' : 
                             activeModule === 'module3' ? 'Batch Comparison' : 
                             activeModule === 'module4' ? 'Revenue Breakdown & Simulator' :
                             'Campaign Master Analytics'}
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Select filters to generate reports</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full xl:w-auto">
                    <div className="flex flex-col sm:flex-row items-center gap-2 bg-black/40 border border-slate-700/50 p-2 rounded-2xl w-full xl:w-auto shadow-inner">
                        <Filter size={16} className="text-slate-500 ml-2 hidden sm:block" />
                        
                        {businesses.length > 1 && (
                            <select 
                                value={selectedBusiness} 
                                onChange={(e) => { 
                                    setSelectedBusiness(e.target.value); 
                                    setSelectedBatch(''); 
                                    if (e.target.value) localStorage.setItem('callCamp_selectedBusiness', e.target.value);
                                }}
                                className="bg-transparent text-xs font-bold text-white outline-none py-2 sm:py-1.5 px-2 cursor-pointer w-full sm:w-48 border-b sm:border-b-0 sm:border-r border-slate-700"
                            >
                                <option value="" className="bg-slate-900">Select Campaign</option>
                                {businesses.map(b => (
                                    <option key={b.id} value={b.id} className="bg-slate-900">{b.name}</option>
                                ))}
                            </select>
                        )}
                        
                        <select 
                            value={selectedBatch} 
                            onChange={(e) => {
                                setSelectedBatch(e.target.value);
                                if (e.target.value) localStorage.setItem('callCamp_selectedBatch', e.target.value);
                            }}
                            disabled={!selectedBusiness || activeModule === 'module3'}
                            className="bg-transparent text-xs font-bold text-white outline-none py-2 sm:py-1.5 px-2 cursor-pointer w-full sm:w-48 disabled:opacity-50"
                        >
                            <option value="" className="bg-slate-900">
                                {activeModule === 'module3' ? 'Use Module Controls' : 'Select Batch (All)'}
                            </option>
                            {batches.map(b => (
                                <option key={b.id} value={b.id} className="bg-slate-900">{b.name}</option>
                            ))}
                        </select>

                        <button 
                            onClick={() => navigate('/admin/test-injector')}
                            className="bg-indigo-600/50 hover:bg-indigo-500 text-indigo-100 font-bold p-2 sm:px-4 sm:py-1.5 rounded-xl ml-2 text-xs transition-all shadow-md border border-indigo-500/30 whitespace-nowrap flex items-center gap-2"
                            title="Open Test Data Injector"
                        >
                            <Database size={14} />
                            <span className="hidden sm:inline">Mock Data</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Dynamic Rendering based on Tab */}
            <div className="flex-1 min-h-0">
                {!activeModule ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-6 p-4">
                        <div 
                            onClick={() => setActiveModule('module1')}
                            className="relative group cursor-pointer rounded-[2rem] overflow-hidden border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-500 hover:scale-[1.02] hover:border-indigo-500/50 hover:shadow-indigo-500/20 aspect-[4/3] bg-black/40"
                        >
                            <img src="/img/analytics/drop_growth.png" alt="Drop and Growth" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-700 mix-blend-screen" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/80 to-transparent pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 right-0 p-6">
                                <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-2 uppercase tracking-widest drop-shadow-md">Drop & Growth</h3>
                                <p className="text-slate-400 text-xs font-semibold">Analyze student retention, drop rates, and monthly growth across your campaigns.</p>
                            </div>
                        </div>

                        <div 
                            onClick={() => setActiveModule('module2')}
                            className="relative group cursor-pointer rounded-[2rem] overflow-hidden border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-500 hover:scale-[1.02] hover:border-emerald-500/50 hover:shadow-emerald-500/20 aspect-[4/3] bg-black/40"
                        >
                            <img src="/img/analytics/coordinator_kpi.png" alt="Coordinator KPI" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-700 mix-blend-screen" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/80 to-transparent pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 right-0 p-6">
                                <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-2 uppercase tracking-widest drop-shadow-md">Coordinator KPI</h3>
                                <p className="text-slate-400 text-xs font-semibold">Track coordinator performance, conversion rates, and individual lead breakdowns.</p>
                            </div>
                        </div>

                        <div 
                            onClick={() => setActiveModule('module3')}
                            className="relative group cursor-pointer rounded-[2rem] overflow-hidden border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-500 hover:scale-[1.02] hover:border-amber-500/50 hover:shadow-amber-500/20 aspect-[4/3] bg-black/40"
                        >
                            <img src="/img/analytics/batch_compare.png" alt="Batch Compare" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-700 mix-blend-screen" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/80 to-transparent pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 right-0 p-6">
                                <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-400 mb-2 uppercase tracking-widest drop-shadow-md">Batch Compare</h3>
                                <p className="text-slate-400 text-xs font-semibold">Compare multiple datasets side-by-side to identify trends and performance disparities.</p>
                            </div>
                        </div>

                        <div 
                            onClick={() => setActiveModule('module4')}
                            className="relative group cursor-pointer rounded-[2rem] overflow-hidden border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-500 hover:scale-[1.02] hover:border-teal-500/50 hover:shadow-teal-500/20 aspect-[4/3] bg-black/40"
                        >
                            <img src="/img/analytics/revenue_breakdown.png" alt="Revenue Breakdown" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-700 mix-blend-screen" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/80 to-transparent pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 right-0 p-6">
                                <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 mb-2 uppercase tracking-widest drop-shadow-md">Revenue Breakdown</h3>
                                <p className="text-slate-400 text-xs font-semibold">Staff allocation, lead sources, revenue breakdown, and what-if conversion simulator.</p>
                            </div>
                        </div>
                    </div>
                ) : activeModule === 'module1' ? (
                    <ModuleOneRetention filters={{ selectedBusiness, selectedBatch }} />
                ) : activeModule === 'module2' ? (
                    <ModuleCoordinatorKPI filters={{ selectedBusiness, selectedBatch }} />
                ) : activeModule === 'module3' ? (
                    <ModuleTwoComparison businesses={businesses} selectedBusiness={selectedBusiness} />
                ) : activeModule === 'module4' ? (
                    <ModuleRevenueBreakdown filters={{ selectedBusiness, selectedBatch }} businesses={businesses} />
                ) : null}
            </div>

        </div>
    );
}