import React, { useState, useEffect } from 'react';
import { 
    CalendarDays, PhoneCall, CheckSquare, Save, Clock, 
    Briefcase, ChevronLeft, ChevronRight, UserPlus, FileEdit, 
    Loader2, PhoneOff, PhoneMissed, MessageCircle, Send, Inbox, Repeat
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function MonthlyRoster({ loggedInUser }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [rosterData, setRosterData] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // 🔥 NEW: Tab Switcher State 🔥
    const [activeTab, setActiveTab] = useState('calls'); // 'calls' | 'crm'

    useEffect(() => {
        generateDummyMonthData(currentDate.getFullYear(), currentDate.getMonth());
    }, [currentDate]);

    const generateDummyMonthData = (year, month) => {
        setLoading(true);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let dummyData = [];

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = new Date(year, month, i).toISOString().split('T')[0];
            const isToday = new Date().toISOString().split('T')[0] === dateStr;

            dummyData.push({
                date: dateStr,
                dayName: new Date(year, month, i).toLocaleDateString('en-US', { weekday: 'short' }),
                status: isToday ? 'Normal' : (i % 7 === 0 ? 'Day Off' : 'Normal'),
                otherCalls: i % 4 === 0 ? 15 : 0,
                
                // Call Campaign Stats
                assigned: {
                    openSem: Math.floor(Math.random() * 10),
                    newInq: Math.floor(Math.random() * 5),
                    bridge: Math.floor(Math.random() * 3),
                    paid: Math.floor(Math.random() * 8)
                },
                systemDials: {
                    answered: Math.floor(Math.random() * 20),
                    noAnswer: Math.floor(Math.random() * 10),
                    rejected: Math.floor(Math.random() * 5)
                },
                
                // CRM & Messaging Stats
                crmStats: {
                    activeChats: Math.floor(Math.random() * 25),
                    messagesSent: Math.floor(Math.random() * 100),
                    messagesReceived: Math.floor(Math.random() * 60),
                    followUps: Math.floor(Math.random() * 15)
                },
                
                tasksCount: Math.floor(Math.random() * 4)
            });
        }
        setRosterData(dummyData);
        setTimeout(() => setLoading(false), 500);
    };

    const handleMonthChange = (direction) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(currentDate.getMonth() + direction);
        setCurrentDate(newDate);
    };

    const handleManualUpdate = (index, field, value) => {
        const updated = [...rosterData];
        updated[index][field] = value;
        setRosterData(updated);
    };

    const saveChanges = () => {
        toast.success("Roster updated successfully!", {
            style: { background: '#10b981', color: '#fff', fontWeight: 'bold' }
        });
    };

    // Calculate Totals based on Active Tab
    const totalAssigns = rosterData.reduce((acc, curr) => acc + curr.assigned.openSem + curr.assigned.newInq + curr.assigned.bridge + curr.assigned.paid, 0);
    const totalDials = rosterData.reduce((acc, curr) => acc + curr.systemDials.answered + curr.systemDials.noAnswer + curr.systemDials.rejected, 0);
    const totalOtherCalls = rosterData.reduce((acc, curr) => acc + parseInt(curr.otherCalls || 0), 0);
    
    const totalSent = rosterData.reduce((acc, curr) => acc + curr.crmStats.messagesSent, 0);
    const totalReceived = rosterData.reduce((acc, curr) => acc + curr.crmStats.messagesReceived, 0);
    const totalFollowUps = rosterData.reduce((acc, curr) => acc + curr.crmStats.followUps, 0);

    return (
        <div className="flex flex-col gap-6 font-sans text-slate-200 h-[calc(100vh-100px)] overflow-hidden animate-in fade-in duration-500 pr-2">
            
            {/* 🔥 TOP HEADER 🔥 */}
            <div className="bg-[#1e293b] p-6 rounded-[2rem] border border-slate-700/50 shadow-2xl flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
                        <Briefcase size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-wider">Performance Roster</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Daily Operations Analytics</p>
                    </div>
                </div>

                {/* 🔥 MODULE SWITCHER (CALLS vs CRM) 🔥 */}
                <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-inner w-full xl:w-auto">
                    <button 
                        onClick={() => setActiveTab('calls')}
                        className={`flex-1 xl:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'calls' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <PhoneCall size={16} /> Call Campaign
                    </button>
                    <button 
                        onClick={() => setActiveTab('crm')}
                        className={`flex-1 xl:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'crm' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <MessageCircle size={16} /> CRM / Messages
                    </button>
                </div>

                <div className="flex items-center gap-4 w-full xl:w-auto">
                    <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5 flex-1 xl:flex-none justify-between">
                        <button onClick={() => handleMonthChange(-1)} className="p-3 hover:bg-slate-800 rounded-xl transition-all"><ChevronLeft size={20} /></button>
                        <span className="text-base font-black text-white w-40 text-center uppercase tracking-widest">
                            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                        <button onClick={() => handleMonthChange(1)} className="p-3 hover:bg-slate-800 rounded-xl transition-all"><ChevronRight size={20} /></button>
                    </div>

                    <button onClick={saveChanges} className="flex items-center justify-center gap-2 px-8 py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-indigo-500/30 uppercase tracking-widest shrink-0">
                        <Save size={20} /> Sync
                    </button>
                </div>
            </div>

            {/* 🔥 BIG QUICK STATS (Dynamic based on Tab) 🔥 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500" key={activeTab}>
                {activeTab === 'calls' ? (
                    <>
                        <div className="bg-gradient-to-br from-indigo-900/40 to-blue-900/40 p-5 rounded-2xl border border-indigo-500/20 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total Assigned</p>
                                <h3 className="text-4xl font-black text-white">{totalAssigns}</h3>
                            </div>
                            <div className="text-indigo-400 opacity-50"><UserPlus size={40}/></div>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/40 p-5 rounded-2xl border border-emerald-500/20 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">System Dials</p>
                                <h3 className="text-4xl font-black text-white">{totalDials}</h3>
                            </div>
                            <div className="text-emerald-400 opacity-50"><PhoneCall size={40}/></div>
                        </div>
                        <div className="bg-gradient-to-br from-fuchsia-900/40 to-pink-900/40 p-5 rounded-2xl border border-fuchsia-500/20 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">Manual Calls</p>
                                <h3 className="text-4xl font-black text-white">{totalOtherCalls}</h3>
                            </div>
                            <div className="text-fuchsia-400 opacity-50"><FileEdit size={40}/></div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="bg-gradient-to-br from-blue-900/40 to-cyan-900/40 p-5 rounded-2xl border border-blue-500/20 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">Msgs Sent (Out)</p>
                                <h3 className="text-4xl font-black text-white">{totalSent}</h3>
                            </div>
                            <div className="text-blue-400 opacity-50"><Send size={40}/></div>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/40 p-5 rounded-2xl border border-emerald-500/20 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">Msgs Recv (In)</p>
                                <h3 className="text-4xl font-black text-white">{totalReceived}</h3>
                            </div>
                            <div className="text-emerald-400 opacity-50"><Inbox size={40}/></div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 p-5 rounded-2xl border border-purple-500/20 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">Follow-Ups</p>
                                <h3 className="text-4xl font-black text-white">{totalFollowUps}</h3>
                            </div>
                            <div className="text-purple-400 opacity-50"><Repeat size={40}/></div>
                        </div>
                    </>
                )}
                
                {/* Working Days is common */}
                <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 p-5 rounded-2xl border border-amber-500/20 flex items-center justify-between">
                    <div>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">Working Days</p>
                        <h3 className="text-4xl font-black text-white">{rosterData.filter(d => d.status === 'Normal' || d.status === 'Half Day').length}</h3>
                    </div>
                    <div className="text-amber-400 opacity-50"><CalendarDays size={40}/></div>
                </div>
            </div>

            {/* 🔥 WIDE LIST VIEW (SCROLLABLE) 🔥 */}
            <div className="flex-1 overflow-hidden bg-[#0f172a] rounded-[2rem] border border-slate-700/50 shadow-2xl flex flex-col">
                
                {/* Fixed Header Row based on Tab */}
                <div className="grid grid-cols-12 gap-4 p-5 bg-[#1e293b] border-b border-slate-700 text-xs font-black text-slate-400 uppercase tracking-widest text-center shrink-0">
                    <div className="col-span-2 text-left pl-6">Date & Status</div>
                    {activeTab === 'calls' ? (
                        <>
                            <div className="col-span-4">System Assigned (Leads)</div>
                            <div className="col-span-4">System Dials (Auto)</div>
                        </>
                    ) : (
                        <>
                            <div className="col-span-4">CRM Chat Engagement</div>
                            <div className="col-span-4">Message Volume (In/Out)</div>
                        </>
                    )}
                    <div className="col-span-2">Manual Actions</div>
                </div>

                {/* Scrollable Body */}
                <div className="overflow-y-auto flex-1 custom-scrollbar p-4 space-y-4">
                    {loading ? (
                        <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>
                    ) : (
                        rosterData.map((day, idx) => {
                            const isToday = new Date().toISOString().split('T')[0] === day.date;
                            const isOff = day.status === 'Day Off' || day.status === 'Poya Day';
                            
                            const totalAssignedForDay = day.assigned.openSem + day.assigned.newInq + day.assigned.bridge + day.assigned.paid;
                            const totalDialsForDay = day.systemDials.answered + day.systemDials.noAnswer + day.systemDials.rejected;
                            const totalMsgsForDay = day.crmStats.messagesSent + day.crmStats.messagesReceived;

                            return (
                                <div key={idx} className={`grid grid-cols-12 gap-6 p-4 rounded-2xl items-center border transition-all ${
                                    isToday ? 'bg-indigo-900/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 
                                    (isOff ? 'bg-black/40 border-slate-800 opacity-60' : 'bg-[#1e293b] border-slate-700/50 hover:bg-slate-800')
                                }`}>
                                    
                                    {/* 1. DATE & STATUS (Left - Common) */}
                                    <div className="col-span-2 flex flex-col gap-3 pl-2">
                                        <div className="flex items-end gap-3">
                                            <span className={`text-4xl font-black leading-none ${isToday ? 'text-indigo-400' : 'text-white'}`}>
                                                {day.date.split('-')[2]}
                                            </span>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{day.dayName}</span>
                                                {isToday && <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded mt-0.5 w-fit">TODAY</span>}
                                            </div>
                                        </div>
                                        <select 
                                            value={day.status}
                                            onChange={(e) => handleManualUpdate(idx, 'status', e.target.value)}
                                            className={`w-full text-sm font-bold px-3 py-2.5 rounded-xl outline-none border cursor-pointer uppercase tracking-wider ${
                                                day.status === 'Normal' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 
                                                day.status === 'Half Day' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 
                                                'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                            }`}
                                        >
                                            <option value="Normal" className="bg-slate-900 text-white">Active Day</option>
                                            <option value="Half Day" className="bg-slate-900 text-white">Half Day</option>
                                            <option value="Day Off" className="bg-slate-900 text-white">Day Off</option>
                                            <option value="Poya Day" className="bg-slate-900 text-white">Poya Holiday</option>
                                        </select>
                                    </div>

                                    {/* 2 & 3. MIDDLE SECTIONS (Depends on Tab) */}
                                    {activeTab === 'calls' ? (
                                        <>
                                            {/* CALLS: ASSIGNED LEADS */}
                                            <div className="col-span-4 bg-black/20 rounded-2xl p-4 border border-white/5 flex items-center justify-between h-full">
                                                {!isOff ? (
                                                    <>
                                                        <div className="flex gap-4">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Open</span>
                                                                <span className="text-2xl font-black text-blue-400">{day.assigned.openSem}</span>
                                                            </div>
                                                            <div className="flex flex-col items-center border-l border-white/10 pl-4">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">New</span>
                                                                <span className="text-2xl font-black text-cyan-400">{day.assigned.newInq}</span>
                                                            </div>
                                                            <div className="flex flex-col items-center border-l border-white/10 pl-4">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Bridge</span>
                                                                <span className="text-2xl font-black text-purple-400">{day.assigned.bridge}</span>
                                                            </div>
                                                            <div className="flex flex-col items-center border-l border-white/10 pl-4">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Paid</span>
                                                                <span className="text-2xl font-black text-emerald-400">{day.assigned.paid}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-center bg-white/5 px-4 py-2 rounded-xl">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
                                                            <span className="text-xl font-black text-white">{totalAssignedForDay}</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="w-full text-center text-slate-600 font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2">
                                                        <Clock size={16}/> No Assigned Leads
                                                    </div>
                                                )}
                                            </div>

                                            {/* CALLS: SYSTEM DIALS */}
                                            <div className="col-span-4 bg-black/20 rounded-2xl p-4 border border-white/5 flex items-center justify-between h-full">
                                                {!isOff ? (
                                                    <div className="flex gap-4 w-full justify-around">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 mb-1"><PhoneCall size={10} className="text-emerald-500"/> Answer</span>
                                                            <span className="text-2xl font-black text-emerald-400">{day.systemDials.answered}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center border-l border-white/10 pl-4">
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 mb-1"><PhoneOff size={10} className="text-rose-500"/> Reject</span>
                                                            <span className="text-2xl font-black text-rose-400">{day.systemDials.rejected}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center border-l border-white/10 pl-4">
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 mb-1"><PhoneMissed size={10} className="text-amber-500"/> No Ans</span>
                                                            <span className="text-2xl font-black text-amber-400">{day.systemDials.noAnswer}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-full text-center text-slate-600 font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2">
                                                        <PhoneOff size={16}/> No Call Data
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* CRM: CHAT ENGAGEMENT */}
                                            <div className="col-span-4 bg-black/20 rounded-2xl p-4 border border-white/5 flex items-center justify-between h-full">
                                                {!isOff ? (
                                                    <>
                                                        <div className="flex gap-6 w-full justify-around">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><MessageCircle size={10}/> Active Chats</span>
                                                                <span className="text-2xl font-black text-blue-400">{day.crmStats.activeChats}</span>
                                                            </div>
                                                            <div className="flex flex-col items-center border-l border-white/10 pl-6">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Repeat size={10}/> Follow-Ups</span>
                                                                <span className="text-2xl font-black text-purple-400">{day.crmStats.followUps}</span>
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="w-full text-center text-slate-600 font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2">
                                                        <Clock size={16}/> No Chats Assigned
                                                    </div>
                                                )}
                                            </div>

                                            {/* CRM: MESSAGE VOLUME */}
                                            <div className="col-span-4 bg-black/20 rounded-2xl p-4 border border-white/5 flex items-center justify-between h-full">
                                                {!isOff ? (
                                                    <div className="flex gap-4 w-full justify-around items-center">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 mb-1"><Send size={10} className="text-cyan-500"/> Sent</span>
                                                            <span className="text-2xl font-black text-cyan-400">{day.crmStats.messagesSent}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center border-l border-white/10 pl-4">
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 mb-1"><Inbox size={10} className="text-emerald-500"/> Received</span>
                                                            <span className="text-2xl font-black text-emerald-400">{day.crmStats.messagesReceived}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center bg-white/5 px-4 py-2 rounded-xl">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Msgs</span>
                                                            <span className="text-xl font-black text-white">{totalMsgsForDay}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-full text-center text-slate-600 font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2">
                                                        <MessageCircle size={16}/> No Message Data
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {/* 4. MANUAL ACTIONS (Right - Common) */}
                                    <div className="col-span-2 flex flex-col gap-3 h-full justify-center">
                                        <div className="flex flex-col items-center bg-black/40 rounded-xl p-2 border border-white/5">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Manual Calls</span>
                                            <input 
                                                type="number" min="0" value={day.otherCalls}
                                                onChange={(e) => handleManualUpdate(idx, 'otherCalls', e.target.value)}
                                                disabled={isOff}
                                                className={`w-full text-center text-xl font-black px-2 py-1.5 rounded-lg outline-none transition-all ${
                                                    isOff ? 'bg-transparent text-slate-600' : 'bg-slate-900 text-fuchsia-400 border border-fuchsia-500/30 focus:border-fuchsia-500'
                                                }`}
                                            />
                                        </div>
                                        
                                        <div className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border transition-colors ${
                                            day.tasksCount > 0 ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-white/5 border-transparent text-slate-500'
                                        }`}>
                                            <CheckSquare size={14} className={day.tasksCount > 0 ? 'text-indigo-400' : ''} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">
                                                {day.tasksCount > 0 ? `${day.tasksCount} Tasks` : 'No Tasks'}
                                            </span>
                                        </div>
                                    </div>

                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}