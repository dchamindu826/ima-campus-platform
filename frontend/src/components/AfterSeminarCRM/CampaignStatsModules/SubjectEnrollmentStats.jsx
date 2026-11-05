import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FaBookOpen, FaUserGraduate, FaFilter } from 'react-icons/fa';

export default function SubjectEnrollmentStats({ rawSubjects = [], mixerData = [] }) {
    
    const aggregatedSubjects = useMemo(() => {
        if (!rawSubjects) return [];
        const map = {};
        
        rawSubjects.forEach(sub => {
            let cleanName = (sub.subject || sub.name || '').trim().toUpperCase();
            if (!map[cleanName]) {
                map[cleanName] = { name: cleanName, full: 0, monthly: 0, installment: 0, total: 0 };
            }
            map[cleanName].full += (sub.full || 0);
            map[cleanName].monthly += (sub.monthly || 0);
            map[cleanName].installment += (sub.installment || 0);
            map[cleanName].total += (sub.total || 0);
        });

        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [rawSubjects]);

    const [selectedSubjects, setSelectedSubjects] = useState([]);

    useEffect(() => {
        setSelectedSubjects([]); 
    }, [aggregatedSubjects]);

    const totals = useMemo(() => {
        let full = 0, monthly = 0, installment = 0;

        if (mixerData && mixerData.length > 0 && selectedSubjects.length > 0) {
            mixerData.forEach(student => {
                const studentSubNames = student.subjects.map(s => s.toUpperCase());
                const hasAllSelected = selectedSubjects.every(selectedSub => 
                    studentSubNames.includes(selectedSub.toUpperCase())
                );

                if (hasAllSelected) {
                    if (student.paymentIntention === 'FULL') full++;
                    else if (student.paymentIntention === 'MONTHLY') monthly++;
                    else if (student.paymentIntention === 'INSTALLMENT') installment++;
                }
            });
        }
        
        return { full, monthly, installment, grandTotal: full + monthly + installment };
    }, [selectedSubjects, mixerData]);

    const toggleSubject = (name) => {
        if (selectedSubjects.includes(name)) {
            setSelectedSubjects(selectedSubjects.filter(s => s !== name));
        } else {
            setSelectedSubjects([...selectedSubjects, name]);
        }
    };

    const selectAll = () => setSelectedSubjects(aggregatedSubjects.map(s => s.name));
    const clearAll = () => setSelectedSubjects([]);

    const pieData = [
        { name: 'Full Payment', value: totals.full, color: '#8b5cf6' }, 
        { name: 'Monthly', value: totals.monthly, color: '#3b82f6' }, 
        { name: 'Installment', value: totals.installment, color: '#f59e0b' } 
    ].filter(d => d.value > 0); 

    if (aggregatedSubjects.length === 0) {
        return (
            <div className="bg-[#1e293b] p-6 rounded-3xl border border-slate-700/50 shadow-xl flex items-center justify-center h-[300px]">
                <p className="text-slate-500 text-sm font-bold tracking-wide">No subject enrollment data found.</p>
            </div>
        );
    }

    return (
        <div className="bg-[#1e293b] p-6 md:p-8 rounded-3xl border border-slate-700/50 shadow-2xl flex flex-col relative overflow-hidden mt-6">
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 border-b border-slate-700 pb-5 gap-4">
                <h2 className="text-base font-black text-white uppercase tracking-widest flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shadow-inner">
                        <FaBookOpen className="text-emerald-400" size={20}/>
                    </div>
                    Subject Mixer Analytics
                </h2>
                <span className="text-[10px] text-emerald-400 font-bold px-4 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20 uppercase tracking-widest shadow-sm">
                    AND Logic (Intersection)
                </span>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                
                {/* LEFT COLUMN: FILTER CONTROLS */}
                <div className="xl:col-span-5 flex flex-col bg-[#0f172a] rounded-3xl p-6 border border-slate-700 shadow-inner">
                    <div className="flex justify-between items-center mb-5">
                        <span className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                            <FaFilter className="text-indigo-400"/> Select Subjects
                        </span>
                        <div className="flex gap-2">
                            <button onClick={selectAll} className="text-[10px] font-black text-indigo-400 hover:text-white bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/30 px-3 py-1.5 rounded-lg transition-all shadow-sm">ALL</button>
                            <button onClick={clearAll} className="text-[10px] font-black text-rose-400 hover:text-white bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/30 px-3 py-1.5 rounded-lg transition-all shadow-sm">CLEAR</button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2.5 max-h-[350px] overflow-y-auto custom-scrollbar pr-2 pb-2">
                        {aggregatedSubjects.map(sub => {
                            const isSelected = selectedSubjects.includes(sub.name);
                            return (
                                <button
                                    key={sub.name}
                                    onClick={() => toggleSubject(sub.name)}
                                    className={`px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 flex-1 min-w-[120px] text-left border shadow-sm ${
                                        isSelected 
                                        ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] scale-[1.02]' 
                                        : 'bg-[#1e293b] border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                    }`}
                                >
                                    <div className="flex justify-between items-center w-full gap-2">
                                        <span className="truncate">{sub.name}</span>
                                        {isSelected && <div className="w-2 h-2 rounded-full bg-white animate-pulse shadow-[0_0_8px_white]"></div>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT COLUMN: RESULTS & CHARTS */}
                <div className="xl:col-span-7 flex flex-col gap-6">
                    
                    {/* STAT CARDS */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 border border-emerald-400 rounded-3xl p-5 flex flex-col justify-center relative overflow-hidden shadow-lg shadow-emerald-500/20">
                            <div className="absolute -right-4 -top-4 text-white/10"><FaUserGraduate size={70}/></div>
                            <span className="text-[10px] text-emerald-100 uppercase tracking-widest font-black mb-1.5 relative z-10">Total Matches</span>
                            <span className="text-4xl font-black text-white relative z-10">{totals.grandTotal}</span>
                        </div>

                        <div className="bg-[#0f172a] border border-slate-700 rounded-3xl p-5 flex flex-col justify-center shadow-md">
                            <span className="text-[10px] text-purple-400 uppercase tracking-widest font-black mb-1.5">Full Pay</span>
                            <span className="text-3xl font-black text-white">{totals.full}</span>
                        </div>
                        
                        <div className="bg-[#0f172a] border border-slate-700 rounded-3xl p-5 flex flex-col justify-center shadow-md">
                            <span className="text-[10px] text-blue-400 uppercase tracking-widest font-black mb-1.5">Monthly</span>
                            <span className="text-3xl font-black text-white">{totals.monthly}</span>
                        </div>

                        <div className="bg-[#0f172a] border border-slate-700 rounded-3xl p-5 flex flex-col justify-center shadow-md">
                            <span className="text-[10px] text-amber-400 uppercase tracking-widest font-black mb-1.5">Installment</span>
                            <span className="text-3xl font-black text-white">{totals.installment}</span>
                        </div>
                    </div>

                    {/* CHART AREA */}
                    <div className="flex-1 bg-[#0f172a] rounded-3xl border border-slate-700 p-6 min-h-[260px] flex items-center justify-center shadow-inner">
                        {totals.grandTotal === 0 ? (
                            <div className="flex flex-col items-center justify-center text-slate-500">
                                <FaBookOpen size={48} className="mb-4 opacity-20 text-slate-400" />
                                <p className="text-xs uppercase tracking-widest font-bold">No students match this exact combination</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={95}
                                        paddingAngle={6}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px', color: '#fff'}}
                                        itemStyle={{fontWeight: 'bold'}}
                                    />
                                    <Legend 
                                        verticalAlign="middle" 
                                        align="right"
                                        layout="vertical"
                                        wrapperStyle={{fontSize: '12px', color: '#cbd5e1', fontWeight: 'bold'}} 
                                        iconType="circle"
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}