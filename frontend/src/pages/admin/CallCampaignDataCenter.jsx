import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { Database, Search, ChevronLeft, ChevronRight, RefreshCw, X, Users, Building, Activity } from 'lucide-react';
import { format } from 'date-fns';

const CallCampaignDataCenter = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Meta data for dropdowns
  const [coordinators, setCoordinators] = useState([]);
  const [batches, setBatches] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [campaignCategory, setCampaignCategory] = useState('ALL');
  const [coordinatorId, setCoordinatorId] = useState('ALL');
  const [businessType, setBusinessType] = useState('ALL');
  const [batchId, setBatchId] = useState('ALL');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 50,
        search: searchQuery,
        campaignCategory,
        coordinatorId,
        businessType,
        batchId
      };

      const { data } = await axios.get('/admin/call-campaign-audit/live', { params });
      
      if (data.success) {
        setLeads(data.records);
        setTotalPages(data.pagination.totalPages);
        setTotalRecords(data.pagination.total);
        
        setCoordinators(data.meta.coordinators);
        setBatches(data.meta.batches);
        
        // Extract unique business types
        const uniqueBusinesses = [...new Set(data.meta.batches.map(b => b.business?.name).filter(Boolean))];
        setBusinesses(uniqueBusinesses);
      }
    } catch (error) {
      console.error("Failed to fetch leads:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [page, campaignCategory, coordinatorId, businessType, batchId]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLeads();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCampaignCategory('ALL');
    setCoordinatorId('ALL');
    setBusinessType('ALL');
    setBatchId('ALL');
    setPage(1);
  };

  const getStatusColor = (status) => {
    if (!status) return 'bg-slate-700/50 text-slate-400 border-slate-600';
    const s = status.toLowerCase();
    if (s.includes('answered') || s.includes('enrolled') || s.includes('success')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (s.includes('reject') || s.includes('failed')) return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    if (s.includes('no_answer') || s.includes('busy')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    if (s.includes('pending')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
  };

  const getCampaignColor = (campaign) => {
    switch (campaign) {
      case 'OPEN_SEMINAR': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'NEW_INQ': return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
      case 'PAID': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const filteredBatches = businessType === 'ALL' 
    ? batches 
    : batches.filter(b => b.business?.name === businessType);

  return (
    <div className="p-8 max-w-[1700px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-800/50 p-8 rounded-2xl border border-slate-700/50 backdrop-blur-xl">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-emerald-500/20 rounded-2xl border border-emerald-500/30">
            <Activity size={36} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Call Campaign Data Center</h1>
            <p className="text-slate-400 text-base mt-1.5 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Lead Monitoring Dashboard
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="px-5 py-3 bg-slate-900 rounded-xl border border-slate-700 flex items-center gap-3">
            <span className="text-slate-400 text-base">Active Leads:</span>
            <span className="text-white text-lg font-semibold">{totalRecords.toLocaleString()}</span>
          </div>
          <button 
            onClick={fetchLeads}
            className="p-3.5 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors border border-slate-600"
            title="Refresh Data"
          >
            <RefreshCw size={22} className={loading ? "animate-spin text-slate-300" : "text-slate-300"} />
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-md">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-5 items-end">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-sm font-medium text-slate-400 mb-2 ml-1">Search Lead</label>
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Name or Phone number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-base text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="w-48">
            <label className="block text-sm font-medium text-slate-400 mb-2 ml-1 flex items-center gap-1.5">
              <Building size={14} /> Business
            </label>
            <select
              value={businessType}
              onChange={(e) => { setBusinessType(e.target.value); setBatchId('ALL'); setPage(1); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-base text-white focus:ring-2 focus:ring-emerald-500/50 outline-none appearance-none"
            >
              <option value="ALL">All Businesses</option>
              {businesses.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="w-56">
            <label className="block text-sm font-medium text-slate-400 mb-2 ml-1 flex items-center gap-1.5">
              <Database size={14} /> Batch
            </label>
            <select
              value={batchId}
              onChange={(e) => { setBatchId(e.target.value); setPage(1); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-base text-white focus:ring-2 focus:ring-emerald-500/50 outline-none appearance-none"
              disabled={filteredBatches.length === 0}
            >
              <option value="ALL">All Batches</option>
              {filteredBatches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="w-48">
            <label className="block text-sm font-medium text-slate-400 mb-2 ml-1">Campaign Type</label>
            <select
              value={campaignCategory}
              onChange={(e) => { setCampaignCategory(e.target.value); setPage(1); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-base text-white focus:ring-2 focus:ring-emerald-500/50 outline-none appearance-none"
            >
              <option value="ALL">All Campaigns</option>
              <option value="OPEN_SEMINAR">Open Seminar</option>
              <option value="NEW_INQ">New Inquiries</option>
              <option value="PAID">Paid / Retention</option>
            </select>
          </div>

          <div className="w-56">
            <label className="block text-sm font-medium text-slate-400 mb-2 ml-1 flex items-center gap-1.5">
              <Users size={14} /> Coordinator
            </label>
            <select
              value={coordinatorId}
              onChange={(e) => { setCoordinatorId(e.target.value); setPage(1); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-base text-white focus:ring-2 focus:ring-emerald-500/50 outline-none appearance-none"
            >
              <option value="ALL">All Coordinators</option>
              <option value="UNASSIGNED">-- Unassigned --</option>
              {coordinators.map(c => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="hidden"></button>
          
          {(searchQuery || campaignCategory !== 'ALL' || coordinatorId !== 'ALL' || businessType !== 'ALL' || batchId !== 'ALL') && (
            <button 
              type="button"
              onClick={clearFilters}
              className="px-4 py-3 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-base rounded-xl border border-slate-600 transition-colors flex items-center gap-2"
            >
              <X size={18} /> Clear
            </button>
          )}
        </form>
      </div>

      {/* Data Table */}
      <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 overflow-hidden backdrop-blur-sm flex flex-col min-h-[600px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-700 text-sm uppercase tracking-wider text-slate-400 font-semibold">
                <th className="px-8 py-5">Lead Details</th>
                <th className="px-8 py-5">Business / Batch</th>
                <th className="px-8 py-5">Campaign</th>
                <th className="px-8 py-5">Coordinator</th>
                <th className="px-8 py-5">Call Status</th>
                <th className="px-8 py-5">Remarks</th>
                <th className="px-8 py-5 text-right">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-base">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <RefreshCw size={32} className="animate-spin text-emerald-500" />
                      <p className="text-slate-400 text-lg">Loading live leads...</p>
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-60">
                      <Database size={48} className="text-slate-500" />
                      <p className="text-slate-400 text-lg">No leads found matching criteria</p>
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-700/20 transition-colors group">
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="font-bold text-white text-lg">{lead.leadName}</div>
                      <div className="text-sm text-slate-400 mt-1 font-medium">{lead.leadPhone}</div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="font-semibold text-slate-300">{lead.businessType}</div>
                      <div className="text-sm text-slate-500 mt-1">{lead.batchName}</div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${getCampaignColor(lead.campaignCategory)}`}>
                        {lead.campaignCategory.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap text-slate-300">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${lead.coordinatorName === 'Unassigned' ? 'bg-slate-800 border border-slate-600' : 'bg-indigo-600'}`}>
                          {lead.coordinatorName === 'Unassigned' ? '?' : lead.coordinatorName.charAt(0)}
                        </div>
                        <span className={`font-medium ${lead.coordinatorName === 'Unassigned' ? 'text-slate-500 italic' : ''}`}>
                          {lead.coordinatorName}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1.5 rounded-lg text-sm font-bold border uppercase tracking-wider ${getStatusColor(lead.currentStatus)}`}>
                          {lead.currentStatus}
                        </span>
                        {lead.callAttempt > 1 && (
                          <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-md font-semibold border border-slate-700">
                            Att: {lead.callAttempt}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-slate-400 text-sm leading-relaxed max-w-sm truncate group-hover:whitespace-normal group-hover:break-words">
                      {lead.remarks || <span className="italic opacity-50">No remarks</span>}
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap text-right text-slate-400">
                      <div className="font-medium text-sm">{format(new Date(lead.updatedAt), 'MMM dd, yyyy')}</div>
                      <div className="text-xs mt-1">{format(new Date(lead.updatedAt), 'hh:mm a')}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="bg-slate-900/50 border-t border-slate-700 px-8 py-5 flex items-center justify-between">
            <div className="text-base text-slate-400">
              Showing page <span className="font-semibold text-white">{page}</span> of <span className="font-semibold text-white">{totalPages}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 transition-colors"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 transition-colors"
              >
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallCampaignDataCenter;
