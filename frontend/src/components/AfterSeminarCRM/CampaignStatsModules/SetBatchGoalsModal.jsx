import React, { useState, useEffect } from 'react';
import { FaBullseye, FaFlagCheckered, FaTimes, FaCheck, FaChartLine, FaUsers } from 'react-icons/fa';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';

export default function SetBatchGoalsModal({ isOpen, onClose, filters, batchGoals, onGoalsUpdated }) {
    const [targetIndividualGoal, setTargetIndividualGoal] = useState(40);
    const [targetGroupGoal, setTargetGroupGoal] = useState(50);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (batchGoals) {
            setTargetIndividualGoal(batchGoals.targetIndividualGoal ?? 40);
            setTargetGroupGoal(batchGoals.targetGroupGoal ?? 50);
        }
    }, [batchGoals, isOpen]);

    if (!isOpen) return null;

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/after-seminar-crm/batch-goals', {
                batchId: filters?.selectedBatch,
                businessId: filters?.selectedBusiness,
                targetIndividualGoal: parseFloat(targetIndividualGoal) || 40,
                targetGroupGoal: parseFloat(targetGroupGoal) || 50
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data && res.data.success) {
                toast.success("Batch conversion goals updated successfully!");
                if (onGoalsUpdated) {
                    onGoalsUpdated({
                        targetIndividualGoal: parseFloat(targetIndividualGoal) || 40,
                        targetGroupGoal: parseFloat(targetGroupGoal) || 50
                    });
                }
                onClose();
            }
        } catch (error) {
            console.error("Failed to update goals", error);
            toast.error("Failed to save conversion goals.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xl animate-fade-in p-4">
            <div className="bg-[#0F172A] border border-indigo-500/30 rounded-[2.5rem] p-6 md:p-8 w-full max-w-lg shadow-[0_0_50px_rgba(99,102,241,0.25)] relative overflow-hidden text-slate-100">
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

                {/* Header */}
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/30 text-white">
                            <FaBullseye size={22} className="animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-indigo-300">
                                Set Conversion Goals
                            </h3>
                            <p className="text-xs text-slate-400 font-medium">
                                Configure Single & Group conversion targets for this batch
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                    >
                        <FaTimes size={16} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-6 relative z-10">
                    {/* Goal 1: Single Coordinator Goal */}
                    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                                <FaChartLine className="text-indigo-400" /> Goal 1: Single Conversion Target (%)
                            </label>
                            <span className="text-sm font-black text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-lg border border-indigo-500/20">
                                {targetIndividualGoal}%
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-3">
                            Target conversion percentage for each individual coordinator from their assigned leads.
                        </p>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="5"
                                max="90"
                                step="1"
                                value={targetIndividualGoal}
                                onChange={(e) => setTargetIndividualGoal(e.target.value)}
                                className="w-full accent-indigo-500 bg-slate-800 rounded-lg cursor-pointer h-2"
                            />
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={targetIndividualGoal}
                                onChange={(e) => setTargetIndividualGoal(e.target.value)}
                                className="w-20 bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-center text-sm font-black text-white outline-none focus:border-indigo-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* Goal 2: Group / Total Intake Goal */}
                    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl relative overflow-hidden group hover:border-purple-500/30 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
                                <FaUsers className="text-purple-400" /> Goal 2: Group / Total Intake Target (%)
                            </label>
                            <span className="text-sm font-black text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-lg border border-purple-500/20">
                                {targetGroupGoal}%
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-3">
                            Target total conversion percentage for the entire batch intake across all assigned leads.
                        </p>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="5"
                                max="90"
                                step="1"
                                value={targetGroupGoal}
                                onChange={(e) => setTargetGroupGoal(e.target.value)}
                                className="w-full accent-purple-500 bg-slate-800 rounded-lg cursor-pointer h-2"
                            />
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={targetGroupGoal}
                                onChange={(e) => setTargetGroupGoal(e.target.value)}
                                className="w-20 bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-center text-sm font-black text-white outline-none focus:border-purple-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* Preview Box */}
                    <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl text-xs text-slate-300 flex items-center gap-3">
                        <FaFlagCheckered size={24} className="text-indigo-400 flex-shrink-0" />
                        <div>
                            <span className="font-bold text-white block">Goal Summary Preview</span>
                            Coordinators will be tracked against <strong className="text-indigo-300">{targetIndividualGoal}% Single Goal</strong> and a batch total of <strong className="text-purple-300">{targetGroupGoal}% Group Intake Goal</strong>.
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {saving ? "Saving..." : <><FaCheck size={12} /> Save Conversion Goals</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
