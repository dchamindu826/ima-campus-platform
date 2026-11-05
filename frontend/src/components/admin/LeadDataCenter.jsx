import React, { useState, useEffect, useCallback } from 'react';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import { 
  Database, Search, Filter, RefreshCw, User, Calendar, Phone, 
  Clock, ShieldAlert, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight,
  Layers, ArrowUpRight, Award, UserCheck, UserX, Info, X
} from 'lucide-react';

export default function LeadDataCenter({ loggedInUser }) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    assigned: 0,
    unassigned: 0,
    round1: 0,
    round2: 0,
    paid: 0,
    nonPaid: 0,
    delayed: 0
  });

  const [businesses, setBusinesses] = useState([]);
  const [batches, setBatches] = useState([]);

  // Filter States
  const [selectedBusiness, setSelectedBusiness] = useState('ALL');
  const [selectedBatch, setSelectedBatch] = useState('ALL');
  const [campaignType, setCampaignType] = useState('ALL');
  const [assignmentFilter, setAssignmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(50);

  // Selected Lead Modal State
  const [selectedLeadModal, setSelectedLeadModal] = useState(null);

  const fetchLeadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('/admin/lead-data-center', {
        params: {
          businessId: selectedBusiness,
          batchId: selectedBatch,
          campaignType,
          assignmentFilter,
          statusFilter,
          search: searchQuery,
          page,
          limit
        }
      });

      if (response.data.success) {
        setRecords(response.data.records || []);
        setStats(response.data.stats || {});
        setTotalPages(response.data.pagination.totalPages || 1);
        if (response.data.meta) {
          setBusinesses(response.data.meta.businesses || []);
          setBatches(response.data.meta.batches || []);
        }
      }
    } catch (error) {
      console.error("Failed to load Lead Data Center records:", error);
      toast.error("Failed to fetch lead records");
    } finally {
      setLoading(false);
    }
  }, [selectedBusiness, selectedBatch, campaignType, assignmentFilter, statusFilter, searchQuery, page, limit]);

  useEffect(() => {
    fetchLeadData();
  }, [fetchLeadData]);

  // Handle Business Selection change -> Reset batch filter
  const handleBusinessChange = (bizId) => {
    setSelectedBusiness(bizId);
    setSelectedBatch('ALL');
    setPage(1);
  };

  return (
    <div className="space-y-6 pb-10">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] p-6 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-wide">Lead Data Center</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                SYSTEM ADMIN
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Centralized real-time lead monitoring across Batches, Coordinators, Round 1 & 2 delays, and Payments.
            </p>
          </div>
        </div>

        <button
          onClick={fetchLeadData}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-xs border border-white/10 transition-all shadow-md active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-teal-400 ${loading ? 'animate-spin' : ''}`} />
          Refresh Sync
        </button>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-[#0F172A]/80 border border-white/10 rounded-xl p-3 backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Leads</span>
          <p className="text-xl font-black text-white mt-1">{stats.total || 0}</p>
        </div>
        <div className="bg-[#0F172A]/80 border border-blue-500/30 rounded-xl p-3 backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Assigned</span>
          <p className="text-xl font-black text-blue-300 mt-1">{stats.assigned || 0}</p>
        </div>
        <div className="bg-[#0F172A]/80 border border-amber-500/30 rounded-xl p-3 backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Unassigned</span>
          <p className="text-xl font-black text-amber-300 mt-1">{stats.unassigned || 0}</p>
        </div>
        <div className="bg-[#0F172A]/80 border border-purple-500/30 rounded-xl p-3 backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">Round 1</span>
          <p className="text-xl font-black text-purple-300 mt-1">{stats.round1 || 0}</p>
        </div>
        <div className="bg-[#0F172A]/80 border border-indigo-500/30 rounded-xl p-3 backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Round 2</span>
          <p className="text-xl font-black text-indigo-300 mt-1">{stats.round2 || 0}</p>
        </div>
        <div className="bg-[#0F172A]/80 border border-emerald-500/30 rounded-xl p-3 backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Paid</span>
          <p className="text-xl font-black text-emerald-300 mt-1">{stats.paid || 0}</p>
        </div>
        <div className="bg-[#0F172A]/80 border border-rose-500/30 rounded-xl p-3 backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Non-Enrolled</span>
          <p className="text-xl font-black text-rose-300 mt-1">{stats.nonPaid || 0}</p>
        </div>
        <div className="bg-[#0F172A]/80 border border-red-500/40 rounded-xl p-3 backdrop-blur-md bg-red-950/20">
          <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            Delayed
          </span>
          <p className="text-xl font-black text-red-400 mt-1">{stats.delayed || 0}</p>
        </div>
      </div>

      {/* FILTERS & CONTROLS BAR */}
      <div className="bg-[#0F172A]/90 border border-white/10 rounded-2xl p-4 backdrop-blur-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Business Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Business</label>
            <select
              value={selectedBusiness}
              onChange={(e) => handleBusinessChange(e.target.value)}
              className="w-full bg-[#1E293B] border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">All Businesses</option>
              {businesses.map((biz) => (
                <option key={biz.id} value={biz.id}>{biz.name}</option>
              ))}
            </select>
          </div>

          {/* Batch Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Batch</label>
            <select
              value={selectedBatch}
              onChange={(e) => { setSelectedBatch(e.target.value); setPage(1); }}
              className="w-full bg-[#1E293B] border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">All Batches</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>{batch.name}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Search Lead</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Name or Phone..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full bg-[#1E293B] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Campaign Source Filter */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Campaign Type</label>
            <select
              value={campaignType}
              onChange={(e) => { setCampaignType(e.target.value); setPage(1); }}
              className="w-full bg-[#1E293B] border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">All Campaigns</option>
              <option value="NEW_INQ">New Inquiries (NEW_INQ)</option>
              <option value="OPEN_SEMINAR">Open Seminar (OPEN_SEM)</option>
            </select>
          </div>
        </div>

        {/* Secondary Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[11px] font-bold text-slate-400 mr-1">Status Filter:</span>
            {[
              { id: 'ALL', label: 'All Statuses' },
              { id: 'ROUND1', label: 'Round 1' },
              { id: 'ROUND2', label: 'Round 2' },
              { id: 'PAID', label: 'Paid (Enrolled)' },
              { id: 'NON_PAID', label: 'Non-Enrolled' },
              { id: 'DELAYED', label: 'Delayed Leads' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => { setStatusFilter(f.id); setPage(1); }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === f.id
                    ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400">Assignment:</span>
            <select
              value={assignmentFilter}
              onChange={(e) => { setAssignmentFilter(e.target.value); setPage(1); }}
              className="bg-[#1E293B] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white font-semibold focus:outline-none"
            >
              <option value="ALL">All</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="UNASSIGNED">Unassigned</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLE DATA SECTION */}
      <div className="bg-[#0F172A]/90 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-[#1E293B]/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                <th className="py-3.5 px-4 font-bold">Student / Phone</th>
                <th className="py-3.5 px-4 font-bold">Batch</th>
                <th className="py-3.5 px-4 font-bold">Campaign Type</th>
                <th className="py-3.5 px-4 font-bold">Assigned Coordinator</th>
                <th className="py-3.5 px-4 font-bold">Round & Progress</th>
                <th className="py-3.5 px-4 font-bold">Delays</th>
                <th className="py-3.5 px-4 font-bold">Outcome</th>
                <th className="py-3.5 px-4 font-bold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-400 mb-2" />
                    Loading lead data center records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No lead records found matching the active criteria.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                    
                    {/* Student Name & Phone */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-sm">{r.name}</div>
                      <div className="text-slate-400 text-[11px] flex items-center gap-1 font-mono mt-0.5">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {r.phone}
                      </div>
                    </td>

                    {/* Batch */}
                    <td className="py-3.5 px-4 font-semibold text-slate-300">
                      <span className="truncate max-w-[180px] block" title={r.batchName}>
                        {r.batchName}
                      </span>
                    </td>

                    {/* Campaign Type */}
                    <td className="py-3.5 px-4">
                      {r.inquiryType === 'NEW_INQ' ? (
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          New Inquiry
                        </span>
                      ) : r.inquiryType === 'OPEN_SEMINAR' ? (
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Open Seminar
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {r.campaignType}
                        </span>
                      )}
                    </td>

                    {/* Coordinator Assignment */}
                    <td className="py-3.5 px-4">
                      {r.isAssigned ? (
                        <div>
                          <div className="font-bold text-emerald-400 flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                            {r.coordinatorName}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {r.assignedAt ? new Date(r.assignedAt).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* Round & Progress */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                        r.isPaid 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                          : r.coordinationRound === 2 
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : r.coordinationRound === 3
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}>
                        {r.currentRoundLabel}
                      </span>
                    </td>

                    {/* Delays */}
                    <td className="py-3.5 px-4">
                      {r.r1DelayedDays > 0 || r.r2DelayedDays > 0 ? (
                        <div className="text-red-400 font-bold text-[11px] flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                          R1: {r.r1DelayedDays}d | R2: {r.r2DelayedDays}d
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px]">No Delays</span>
                      )}
                    </td>

                    {/* Outcome */}
                    <td className="py-3.5 px-4">
                      {r.isPaid ? (
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          PAID
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30">
                          Non-Enrolled
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedLeadModal(r)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-teal-300 border border-white/10 transition-colors"
                      >
                        Inspect
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION BAR */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-white/10 bg-[#1E293B]/40 gap-3">
          <div className="text-xs text-slate-400">
            Showing Page <span className="font-bold text-white">{page}</span> of <span className="font-bold text-white">{totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 border border-white/10"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 border border-white/10"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* LEAD DETAILS INSPECT MODAL */}
      {selectedLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0F172A] border border-white/20 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative space-y-4">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedLeadModal.name}</h3>
                <p className="text-xs text-slate-400">{selectedLeadModal.phone}</p>
              </div>
              <button
                onClick={() => setSelectedLeadModal(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-500">Batch:</span>
                <span className="font-semibold text-white">{selectedLeadModal.batchName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-500">Campaign Type:</span>
                <span className="font-semibold text-teal-300">{selectedLeadModal.campaignType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-500">Assigned Coordinator:</span>
                <span className="font-semibold text-emerald-400">{selectedLeadModal.coordinatorName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-500">Current Round:</span>
                <span className="font-semibold text-purple-300">{selectedLeadModal.currentRoundLabel}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-500">Round 1 Delays:</span>
                <span className="font-semibold text-red-400">{selectedLeadModal.r1DelayedDays} Days</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-500">Round 2 Delays:</span>
                <span className="font-semibold text-red-400">{selectedLeadModal.r2DelayedDays} Days</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-500">Enrollment Status:</span>
                <span className="font-semibold text-white">{selectedLeadModal.enrollmentStatus}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Created At:</span>
                <span className="font-semibold text-slate-300">
                  {new Date(selectedLeadModal.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedLeadModal(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
