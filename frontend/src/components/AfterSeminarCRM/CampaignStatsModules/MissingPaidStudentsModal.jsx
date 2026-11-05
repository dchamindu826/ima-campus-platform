import React, { useState, useEffect } from 'react';
import axios from '../../../api/axios';
import {
    FaTimes, FaUserCheck, FaUserPlus, FaSearch, FaUserTie, FaPhoneAlt,
    FaLink, FaEdit, FaCheckCircle, FaExclamationTriangle, FaExchangeAlt, FaShieldAlt
} from 'react-icons/fa';
import toast from 'react-hot-toast';

export default function MissingPaidStudentsModal({ isOpen, onClose, businessId, batchId, onStudentPushed }) {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [staffList, setStaffList] = useState([]);
    const [selectedCoordinatorMap, setSelectedCoordinatorMap] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [pushingMap, setPushingMap] = useState({});

    // ✏️ Edit Phone State
    const [editingStudent, setEditingStudent] = useState(null);
    const [newPhoneNumber, setNewPhoneNumber] = useState('');
    const [updatingPhone, setUpdatingPhone] = useState(false);

    // 🔗 Merge With CRM Lead State
    const [mergingStudent, setMergingStudent] = useState(null);
    const [leadSearchQuery, setLeadSearchQuery] = useState('');
    const [searchingLeads, setSearchingLeads] = useState(false);
    const [matchingLeads, setMatchingLeads] = useState([]);
    const [selectedLeadToMerge, setSelectedLeadToMerge] = useState(null);
    const [mergingActionLoading, setMergingActionLoading] = useState(false);

    useEffect(() => {
        if (isOpen && businessId) {
            fetchMissingPaidStudents();
            fetchActiveCoordinators();
        }
    }, [isOpen, businessId, batchId]);

    const fetchMissingPaidStudents = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/after-seminar-crm/missing-paid-students', {
                headers: { Authorization: `Bearer ${token}` },
                params: { businessId, batchId: batchId || 'ALL' }
            });
            setStudents(res.data.missingStudents || []);
        } catch (error) {
            toast.error("Failed to fetch missing paid web students");
        } finally {
            setLoading(false);
        }
    };

    const fetchActiveCoordinators = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/after-seminar-crm/coordinators', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStaffList(res.data || []);
        } catch (error) {
            console.error("Failed to fetch coordinators:", error);
        }
    };

    // 1. Push directly to CRM and assign coordinator
    const handlePushStudent = async (studentId) => {
        const coordinatorId = selectedCoordinatorMap[studentId];
        if (!coordinatorId) {
            toast.error("Please select a coordinator for this student");
            return;
        }

        setPushingMap(prev => ({ ...prev, [studentId]: true }));
        try {
            const token = localStorage.getItem('token');
            await axios.post('/after-seminar-crm/push-missing-student-to-crm', {
                studentId,
                businessId,
                batchId: batchId === 'ALL' ? null : batchId,
                coordinatorId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success("Paid web student pushed & assigned to coordinator!");
            setStudents(prev => prev.filter(s => s.id !== studentId));
            if (onStudentPushed) onStudentPushed();
        } catch (error) {
            toast.error("Failed to push student to CRM");
        } finally {
            setPushingMap(prev => ({ ...prev, [studentId]: false }));
        }
    };

    // 2. Edit Web Phone Number
    const handleSavePhoneNumber = async (e) => {
        e.preventDefault();
        if (!editingStudent || !newPhoneNumber.trim()) return;

        setUpdatingPhone(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/after-seminar-crm/update-missing-student-phone', {
                studentId: editingStudent.id,
                newPhone: newPhoneNumber.trim(),
                businessId,
                batchId: batchId || 'ALL'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success(res.data?.message || "Phone number updated successfully!");
            setEditingStudent(null);
            setNewPhoneNumber('');
            fetchMissingPaidStudents();
            if (onStudentPushed) onStudentPushed();
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to update phone number");
        } finally {
            setUpdatingPhone(false);
        }
    };

    // 3. Search CRM Leads for merging
    useEffect(() => {
        if (!mergingStudent || !leadSearchQuery || leadSearchQuery.trim().length < 2) {
            setMatchingLeads([]);
            return;
        }

        const timeout = setTimeout(async () => {
            setSearchingLeads(true);
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get('/after-seminar-crm/search-crm-leads-for-merge', {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        businessId,
                        batchId: batchId || 'ALL',
                        query: leadSearchQuery.trim()
                    }
                });
                setMatchingLeads(res.data.leads || []);
            } catch (err) {
                console.error("Search leads error:", err);
            } finally {
                setSearchingLeads(false);
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [leadSearchQuery, mergingStudent, businessId, batchId]);

    // 4. Confirm Merge With CRM Lead
    const handleConfirmMerge = async () => {
        if (!mergingStudent || !selectedLeadToMerge) {
            toast.error("Please select a matching CRM lead to merge");
            return;
        }

        setMergingActionLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/after-seminar-crm/merge-missing-student-with-lead', {
                studentId: mergingStudent.id,
                leadId: selectedLeadToMerge.id,
                businessId,
                batchId: batchId || 'ALL'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success(res.data?.message || "Student successfully merged with CRM lead!");
            setStudents(prev => prev.filter(s => s.id !== mergingStudent.id));
            setMergingStudent(null);
            setSelectedLeadToMerge(null);
            setLeadSearchQuery('');
            if (onStudentPushed) onStudentPushed();
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to merge student with CRM lead");
        } finally {
            setMergingActionLoading(false);
        }
    };

    if (!isOpen) return null;

    const filteredStudents = students.filter(s =>
        (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.phone || '').includes(searchQuery) ||
        (s.nic || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in font-sans">
            <div className="bg-[#0B132B] border border-white/10 rounded-3xl w-full max-w-6xl p-6 md:p-8 flex flex-col max-h-[90vh] shadow-[0_0_60px_rgba(0,0,0,0.9)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

                {/* Header */}
                <div className="flex justify-between items-center pb-5 border-b border-white/10 mb-6 relative z-10">
                    <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30 shadow-inner">
                            <FaUserCheck size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Missing Paid Web Students</h2>
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30">
                                    {students.length} Action Needed
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Verified web paid students whose phone numbers do not directly match an existing CRM lead.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer">
                        <FaTimes size={16} />
                    </button>
                </div>

                {/* Quick Info Box */}
                <div className="p-3.5 mb-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-200 flex items-center justify-between gap-3 relative z-10">
                    <div className="flex items-center gap-2">
                        <FaShieldAlt className="text-indigo-400 shrink-0" size={15} />
                        <span>
                            <strong>3 Resolution Options:</strong> (1) <strong>Edit Number</strong> if web profile had a typo, (2) <strong>Merge Lead</strong> if student uses a different WhatsApp number assigned to a coordinator, or (3) <strong>Push as New Lead</strong>.
                        </span>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="flex items-center bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 mb-5 relative z-10 w-full md:w-1/2">
                    <FaSearch className="text-slate-400 mr-2.5" size={13} />
                    <input
                        type="text"
                        placeholder="Search student name, phone number, or NIC..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-transparent text-xs text-white outline-none w-full placeholder:text-slate-500"
                    />
                </div>

                {/* Main Table */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative z-10">
                    {loading ? (
                        <div className="text-center py-16 text-slate-500 animate-pulse font-medium">Scanning verified web payments...</div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/5 p-8 space-y-2">
                            <FaCheckCircle className="text-emerald-400 mx-auto" size={32} />
                            <h4 className="text-base font-bold text-white">100% Synced!</h4>
                            <p className="text-xs text-slate-400">All paid web platform students exist and match CRM leads in this batch.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredStudents.map(s => (
                                <div
                                    key={s.id}
                                    className="p-4 rounded-2xl bg-black/30 hover:bg-black/50 border border-white/10 hover:border-white/20 transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                                >
                                    {/* Student Identity */}
                                    <div className="space-y-1 min-w-[240px]">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-black text-white">{s.name}</h4>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                                {s.batchName || 'Default Batch'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs">
                                            <span className="font-mono text-emerald-400 font-bold flex items-center gap-1">
                                                <FaPhoneAlt size={10} /> {s.phone || 'No Phone'}
                                            </span>
                                            {s.nic && (
                                                <span className="text-slate-400 text-[11px]">NIC: {s.nic}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action 1: Edit Phone */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setEditingStudent(s);
                                                setNewPhoneNumber(s.phone || '');
                                            }}
                                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-all cursor-pointer"
                                            title="Change / Correct Student Phone Number"
                                        >
                                            <FaEdit size={11} className="text-amber-400" />
                                            <span>Edit Phone</span>
                                        </button>

                                        {/* Action 2: Merge With CRM Lead */}
                                        <button
                                            onClick={() => {
                                                setMergingStudent(s);
                                                setSelectedLeadToMerge(null);
                                                setLeadSearchQuery(s.name?.split(' ')[0] || s.phone?.slice(-4) || '');
                                            }}
                                            className="px-3.5 py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-indigo-400/30 transition-all cursor-pointer shadow-sm"
                                            title="Merge this web payment with an existing CRM lead (e.g. WhatsApp number under Kavishka)"
                                        >
                                            <FaLink size={11} className="text-cyan-300" />
                                            <span>Merge with CRM Lead</span>
                                        </button>
                                    </div>

                                    {/* Action 3: Push to CRM & Assign Coordinator */}
                                    <div className="flex items-center gap-2 w-full lg:w-auto">
                                        <select
                                            value={selectedCoordinatorMap[s.id] || ''}
                                            onChange={(e) => setSelectedCoordinatorMap({ ...selectedCoordinatorMap, [s.id]: e.target.value })}
                                            className="bg-slate-900 border border-white/15 text-xs text-white rounded-xl px-3 py-2 outline-none cursor-pointer flex-1 lg:w-44 focus:border-emerald-400"
                                        >
                                            <option value="" className="bg-slate-900">Assign Coordinator...</option>
                                            {staffList.map(st => (
                                                <option key={st.id} value={st.id} className="bg-slate-900">
                                                    {st.firstName} {st.lastName}
                                                </option>
                                            ))}
                                        </select>

                                        <button
                                            onClick={() => handlePushStudent(s.id)}
                                            disabled={pushingMap[s.id]}
                                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                                        >
                                            <FaUserPlus size={11} />
                                            <span>{pushingMap[s.id] ? 'Pushing...' : 'Push New'}</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ========================================================
                SUB-MODAL 1: EDIT WEB STUDENT PHONE NUMBER
            ======================================================== */}
            {editingStudent && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-[#1E293B] border border-white/15 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl relative">
                        <div className="flex justify-between items-center pb-3 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <FaEdit className="text-amber-400" size={16} />
                                <h3 className="text-base font-black text-white">Edit Student Phone Number</h3>
                            </div>
                            <button onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-white p-1">
                                <FaTimes size={14} />
                            </button>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                            Update <strong>{editingStudent.name}</strong>'s phone number to match their WhatsApp/CRM lead number.
                        </p>

                        <form onSubmit={handleSavePhoneNumber} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">New Phone Number (WhatsApp / CRM)</label>
                                <input
                                    type="text"
                                    required
                                    value={newPhoneNumber}
                                    onChange={(e) => setNewPhoneNumber(e.target.value)}
                                    placeholder="e.g. 0777777777"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white font-mono focus:outline-none focus:border-amber-400"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingStudent(null)}
                                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-bold cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={updatingPhone}
                                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase shadow transition-all cursor-pointer"
                                >
                                    {updatingPhone ? 'Saving...' : 'Update & Match'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================
                SUB-MODAL 2: MERGE WEB STUDENT WITH EXISTING CRM LEAD
            ======================================================== */}
            {mergingStudent && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-[#0F172A] border border-indigo-500/30 rounded-3xl w-full max-w-2xl p-6 md:p-7 flex flex-col max-h-[85vh] shadow-[0_0_50px_rgba(79,70,229,0.3)] relative">
                        
                        {/* Header */}
                        <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                                    <FaLink size={16} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-white">Merge With Existing CRM Lead</h3>
                                    <p className="text-xs text-slate-400">
                                        Linking Web Student: <strong className="text-white">{mergingStudent.name}</strong> ({mergingStudent.phone})
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setMergingStudent(null)} className="text-slate-400 hover:text-white p-1">
                                <FaTimes size={16} />
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="space-y-1.5 mb-4">
                            <label className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                                Search Lead by WhatsApp Phone or Name
                            </label>
                            <div className="flex items-center bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5">
                                <FaSearch className="text-slate-400 mr-2.5" size={13} />
                                <input
                                    type="text"
                                    placeholder="Type WhatsApp number (e.g. 0777777777) or name..."
                                    value={leadSearchQuery}
                                    onChange={(e) => setLeadSearchQuery(e.target.value)}
                                    className="bg-transparent text-xs text-white outline-none w-full"
                                />
                            </div>
                        </div>

                        {/* Search Results */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar mb-4">
                            {searchingLeads ? (
                                <div className="text-center py-8 text-xs text-slate-400 animate-pulse">Searching CRM leads...</div>
                            ) : matchingLeads.length === 0 ? (
                                <div className="text-center py-8 text-xs text-slate-500">
                                    {leadSearchQuery.length < 2 ? 'Type at least 2 characters to search...' : 'No matching CRM leads found.'}
                                </div>
                            ) : (
                                matchingLeads.map(lead => {
                                    const isSelected = selectedLeadToMerge?.id === lead.id;
                                    return (
                                        <div
                                            key={lead.id}
                                            onClick={() => setSelectedLeadToMerge(lead)}
                                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                                isSelected
                                                    ? 'bg-indigo-600/30 border-indigo-400 shadow-md ring-2 ring-indigo-400/50'
                                                    : 'bg-black/30 hover:bg-black/50 border-white/10'
                                            }`}
                                        >
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-xs font-bold text-white">{lead.name}</h4>
                                                    <span className="text-[10px] font-mono text-cyan-300 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">
                                                        {lead.phone}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                                    <span>Batch: <strong className="text-slate-300">{lead.batchName}</strong></span>
                                                    <span>• Assigned to: <strong className="text-indigo-300">{lead.coordinatorName}</strong></span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                                                    lead.enrollmentStatus === 'ENROLLED'
                                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                }`}>
                                                    {lead.enrollmentStatus || 'PENDING'}
                                                </span>
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                                    isSelected ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-white/20'
                                                }`}>
                                                    {isSelected && <FaCheckCircle size={12} />}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Selected Confirmation */}
                        {selectedLeadToMerge && (
                            <div className="p-3.5 mb-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 flex items-center justify-between">
                                <div>
                                    <p className="font-bold">Merging Attribution:</p>
                                    <p className="text-[11px] text-emerald-300">
                                        This payment will be credited to coordinator <strong>{selectedLeadToMerge.coordinatorName}</strong>.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                            <button
                                type="button"
                                onClick={() => setMergingStudent(null)}
                                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-bold cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmMerge}
                                disabled={!selectedLeadToMerge || mergingActionLoading}
                                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs uppercase shadow transition-all cursor-pointer flex items-center gap-1.5"
                            >
                                <FaExchangeAlt size={11} />
                                <span>{mergingActionLoading ? 'Merging...' : 'Confirm & Merge'}</span>
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}
