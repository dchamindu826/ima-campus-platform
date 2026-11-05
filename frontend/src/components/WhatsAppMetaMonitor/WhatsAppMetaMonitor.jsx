import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, CreditCard, DollarSign, Gauge, ShieldCheck, 
  ShieldAlert, RefreshCw, Layers, AlertCircle, AlertTriangle, CheckCircle2, Loader2 
} from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useTheme } from '../../contexts/ThemeContext';

export default function WhatsAppMetaMonitor({ businessId, businessIds, businessName }) {
  const { isDarkMode, appTheme } = useTheme();
  const isModern = appTheme === 'modern';

  const [waAlerts, setWaAlerts] = useState([]);
  const [waStatus, setWaStatus] = useState(null);
  const [waBilling, setWaBilling] = useState(null);
  const [waActiveTab, setWaActiveTab] = useState('numbers'); // 'numbers' | 'billing' | 'alerts'
  const [waRefreshing, setWaRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  const fetchWaAlerts = async () => {
    try {
      const response = await api.get('/admin/whatsapp-call/alerts');
      if (response.data && response.data.success) {
        setWaAlerts(response.data.alerts || []);
      }
    } catch (err) {
      console.warn('WA Alerts Fetch Error', err);
    }
  };

  const fetchWaStatus = async () => {
    try {
      const params = {};
      if (businessId && businessId !== 'ALL') {
        params.businessId = businessId;
      } else if (businessIds) {
        params.businessIds = businessIds;
      }

      const res = await api.get('/admin/whatsapp-call/status', { params });
      if (res.data && res.data.success) {
        setWaStatus(res.data.data || []);
        if (res.data.billing) {
          setWaBilling(res.data.billing);
        }
      }
    } catch (err) {
      console.warn('WA Status Fetch Error', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshWa = async () => {
    setWaRefreshing(true);
    try {
      await Promise.all([fetchWaStatus(), fetchWaAlerts()]);
      toast.success('WhatsApp status & Meta billing refreshed!');
    } catch (err) {
      toast.error('Failed to refresh WhatsApp data');
    } finally {
      setWaRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchWaStatus();
    fetchWaAlerts();
  }, [businessId, businessIds]);

  // Socket listener for live webhook alerts
  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('userToken');
    const socketUrl = api.defaults.baseURL ? api.defaults.baseURL.replace('/api', '') : 'http://localhost:5000';
    socketRef.current = io(socketUrl, { auth: { token }, transports: ['websocket', 'polling'] });

    socketRef.current.on('whatsapp_alert', (newAlert) => {
      setWaAlerts(prev => [newAlert, ...prev].slice(0, 50));
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-slate-900 border border-emerald-500 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <MessageCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-xs font-bold text-white uppercase tracking-wider">
                  WhatsApp Alert: {newAlert?.alertType?.replace(/_/g, ' ') || 'Notice'}
                </p>
                <p className="mt-1 text-xs text-gray-300">
                  {newAlert?.message || 'New notification received.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ));
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  return (
    <div className={`rounded-3xl flex flex-col overflow-hidden relative z-10 transition-all border ${
      isModern 
        ? (isDarkMode ? 'bg-[#111827] border-slate-800 shadow-sm' : 'bg-white border-slate-200 shadow-sm')
        : 'bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl border-gray-200 dark:border-white/10 shadow-xl'
    }`}>
      {/* Header */}
      <div className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${
        isModern 
          ? (isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200')
          : 'bg-gray-50/70 dark:bg-white/[0.02] border-gray-200 dark:border-white/10'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
            <MessageCircle size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-black tracking-wide ${
                isModern ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-gray-900 dark:text-white'
              }`}>
                WhatsApp & Meta Monitor
              </h3>
              {businessName && (
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20">
                  {businessName}
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-500 dark:text-slate-400 font-medium mt-0.5">
              Live Messaging Limit Tiers, Outstanding Balance Due & Account Status
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button 
            onClick={handleRefreshWa}
            disabled={waRefreshing}
            title="Refresh WhatsApp Status & Meta Billing"
            className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-bold ${
              isModern 
                ? (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm') 
                : 'bg-white/80 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/10 shadow-sm'
            }`}
          >
            <RefreshCw size={13} className={waRefreshing ? 'animate-spin' : ''} />
            <span className="text-[11px] hidden sm:inline">Refresh</span>
          </button>
          
          <div className="text-[10px] text-emerald-500 font-mono flex items-center gap-1.5 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></span>
            <span>LIVE</span>
            {waStatus && waStatus.length > 0 && (
              <span className="text-emerald-500 dark:text-emerald-400 font-bold ml-0.5">
                ({waStatus.length} {waStatus.length === 1 ? 'Number' : 'Numbers'})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Top Meta Payments Due & Balance Overview Banner */}
      <div className={`p-4 sm:p-5 border-b ${
        isModern 
          ? (isDarkMode ? 'bg-gradient-to-r from-emerald-950/20 via-slate-900 to-slate-900 border-slate-800' : 'bg-gradient-to-r from-emerald-50/50 via-white to-slate-50 border-slate-200')
          : 'bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent border-gray-200 dark:border-white/10'
      }`}>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-3">
          <div>
            <p className="text-[10px] font-extrabold text-gray-500 dark:text-gray-400 tracking-wider uppercase flex items-center gap-1.5">
              <CreditCard size={13} className="text-emerald-500" />
              Meta Outstanding Due & Month Spend (Meta එකට ගෙවිය යුතු මුදල)
            </p>
            <div className="flex flex-wrap items-baseline gap-2.5 mt-1.5">
              <span className={`text-2xl font-black font-mono tracking-tight ${
                isModern ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-gray-900 dark:text-white'
              }`}>
                ${waBilling?.totalMonthCostUsd !== undefined ? waBilling.totalMonthCostUsd.toFixed(2) : '0.00'}{' '}
                <span className="text-xs font-bold text-emerald-500">USD</span>
              </span>
              <span className="text-sm font-mono font-bold text-gray-500 dark:text-gray-400">
                ≈ Rs. {(waBilling?.totalMonthCostLkr || 0).toLocaleString()} LKR
              </span>
            </div>
            <p className="text-[10.5px] text-gray-400 mt-1">
              මෙම මාසයේ සංවාද (Conversations) {waBilling?.totalMessagesThisMonth ? `${waBilling.totalMessagesThisMonth.toLocaleString()}` : '0'} ක් සඳහා වන වියදම.
            </p>
          </div>

          {/* Payment Method Status Pill */}
          <div className="md:text-right">
            {waBilling?.paymentMethodStatus === 'FAILED' ? (
              <div className="inline-flex px-3 py-1.5 rounded-xl text-[11px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/30 items-center gap-1.5 shadow-sm">
                <AlertCircle size={14} className="text-rose-500 animate-pulse" />
                <span>Card Declined / Fail</span>
              </div>
            ) : (
              <div className="inline-flex px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 items-center gap-1.5 shadow-sm">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span>Card Active & Linked</span>
              </div>
            )}
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-sans mt-1">
              {waBilling?.paymentMethodStatus === 'FAILED' 
                ? 'Card verification needed in Meta' 
                : 'Auto-debit active on Meta Account'}
            </p>
          </div>
        </div>

        {/* Category Spend Pills & Restriction Alerts */}
        <div className="flex items-center gap-2 flex-wrap pt-2.5 border-t border-gray-200 dark:border-white/10">
          {waBilling?.categories?.map((cat, i) => (
            <div key={i} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1.5 ${
              cat.category === 'MARKETING'
                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20'
                : cat.category === 'SERVICE'
                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                : 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20'
            }`}>
              <span className="capitalize font-semibold">{cat.category ? String(cat.category).toLowerCase().replace(/_/g, ' ') : 'Other'}:</span>
              <span className="font-mono font-bold">${cat.costUsd ?? '0.00'}</span>
              <span className="text-[9px] opacity-75">({(cat.count || 0).toLocaleString()})</span>
            </div>
          ))}

          {waBilling?.restrictedAccounts?.length > 0 && (
            <div className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/30 flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-rose-500" />
              <span>{waBilling.restrictedAccounts.length} Meta Account Restricted</span>
            </div>
          )}
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className={`px-4 py-2 flex items-center gap-1.5 border-b ${
        isModern 
          ? (isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200') 
          : 'bg-gray-50/50 dark:bg-white/[0.01] border-gray-200 dark:border-white/10'
      }`}>
        <button 
          onClick={() => setWaActiveTab('numbers')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            waActiveTab === 'numbers'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <MessageCircle size={14} />
          <span>Numbers & Daily Limits</span>
          {waStatus && <span className="text-[10px] opacity-80">({waStatus.length})</span>}
        </button>

        <button 
          onClick={() => setWaActiveTab('billing')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            waActiveTab === 'billing'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <CreditCard size={14} />
          <span>Meta Balance & Spend</span>
        </button>

        <button 
          onClick={() => setWaActiveTab('alerts')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            waActiveTab === 'alerts'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <AlertTriangle size={14} />
          <span>Live Alerts</span>
          {waAlerts.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center font-bold">
              {waAlerts.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: Numbers & Daily Messaging Limit Tiers */}
      {waActiveTab === 'numbers' && (
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[480px] custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500 gap-2">
              <Loader2 size={24} className="animate-spin text-emerald-500" />
              <p className="text-xs">Loading WhatsApp numbers & limits from Meta...</p>
            </div>
          ) : waStatus && waStatus.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {waStatus.map((status, index) => {
                const isNameDeclined = status.name_status === 'DECLINED';
                const isRestricted = status.status === 'RESTRICTED' || status.status === 'FLAGGED';
                return (
                  <div key={status.id || index} className={`p-4 rounded-2xl flex flex-col justify-between border transition-all ${
                    isRestricted
                      ? 'bg-rose-500/10 border-rose-500/30 shadow-md'
                      : isModern 
                        ? (isDarkMode ? 'bg-[#0f172a] border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 shadow-sm hover:border-slate-300')
                        : 'bg-white/80 dark:bg-[#0f172a]/90 border-gray-200 dark:border-slate-700/60 shadow-md hover:border-emerald-500/30'
                  }`}>
                    {/* Verified Name & Verification Badge */}
                    <div className="mb-2.5">
                      <div className="flex items-start justify-between gap-1.5">
                        <p className={`text-[13px] font-bold truncate tracking-wide ${
                          isModern ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-gray-900 dark:text-white'
                        }`} title={status.verified_name || 'Business Account'}>
                          {status.verified_name || 'Business Account'}
                        </p>
                        {isNameDeclined ? (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-500 border border-rose-500/30 shrink-0">
                            DECLINED
                          </span>
                        ) : status.name_status === 'APPROVED' ? (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                            APPROVED
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono mt-1 font-semibold truncate">
                        {status.display_phone_number || status.id}
                      </p>
                    </div>

                    {/* Messaging Limit Tier & Monthly Spend */}
                    <div className="space-y-2 my-2 pt-2.5 border-t border-gray-200 dark:border-slate-800/60">
                      {/* Limit Tier */}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1.5">
                          <Gauge size={12} className="text-sky-500" />
                          දෛනික සීමාව:
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                          {status.tier_limit || '1,000 / Day'}
                        </span>
                      </div>

                      {/* Spend this month */}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1.5">
                          <DollarSign size={12} className="text-emerald-500" />
                          මාසයේ වියදම:
                        </span>
                        <span className="font-mono font-bold text-gray-800 dark:text-slate-200">
                          ${status.month_spend_usd !== undefined && status.month_spend_usd !== null ? Number(status.month_spend_usd).toFixed(2) : '0.00'} 
                          <span className="text-[9px] text-gray-400 font-normal ml-1">
                            ({(status.month_messages || 0).toLocaleString()} msgs)
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Footer: Quality & Connection Status */}
                    <div className="flex items-center justify-between mt-auto pt-2.5 border-t border-gray-200 dark:border-slate-800/60">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-gray-400 font-bold tracking-widest uppercase">QLTY</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          status.quality_rating === 'GREEN' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm' :
                          status.quality_rating === 'YELLOW' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm' :
                          'bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-sm'
                        }`}>
                          {status.quality_rating || 'UNKNOWN'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-gray-400 font-bold tracking-widest uppercase">STS</span>
                        <span className={`text-[11px] font-bold font-sans ${
                          status.status === 'CONNECTED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                        }`}>
                          {status.status || 'OFFLINE'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-44 text-gray-400 gap-2">
              <MessageCircle size={32} className="opacity-30" />
              <p className="text-xs font-medium">මෙම Business එක සඳහා සක්‍රීය WhatsApp අංක හමු නොවීය.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Meta Spend, Due & Account Restrictions */}
      {waActiveTab === 'billing' && (
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[480px] custom-scrollbar space-y-4">
          {/* Outstanding Due Card */}
          <div className={`p-5 rounded-2xl border ${
            isModern 
              ? (isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')
              : 'bg-emerald-500/5 border-emerald-500/20'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-emerald-500" />
                <p className={`text-xs font-bold uppercase tracking-wider ${
                  isModern ? (isDarkMode ? 'text-white' : 'text-slate-800') : 'text-gray-900 dark:text-white'
                }`}>
                  Current Outstanding Meta Balance (ගෙවීමට ඇති මුදල)
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Accrued Spend
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className={`p-4 rounded-xl border ${
                isModern ? (isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200') : 'bg-white/60 dark:bg-black/40 border-gray-200 dark:border-gray-800'
              }`}>
                <p className="text-[10px] text-gray-400 font-medium uppercase">Outstanding (USD)</p>
                <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  ${waBilling?.outstandingDueUsd !== undefined ? waBilling.outstandingDueUsd.toFixed(2) : '0.00'}
                </p>
              </div>
              <div className={`p-4 rounded-xl border ${
                isModern ? (isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200') : 'bg-white/60 dark:bg-black/40 border-gray-200 dark:border-gray-800'
              }`}>
                <p className="text-[10px] text-gray-400 font-medium uppercase">Estimated LKR</p>
                <p className="text-xl font-black font-mono text-gray-800 dark:text-slate-200 mt-1">
                  Rs. {(waBilling?.outstandingDueLkr || 0).toLocaleString()}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              මෙම මුදල මෙම Business එකෙහි WhatsApp සංවාද (Conversations) සඳහා Meta සමාගමට auto-debit වීමට ඇති මුදලයි. Link කර ඇති Card එකෙන් billing cycle එක අවසානයේදී හෝ payment threshold එකේදී auto-charge වේ.
            </p>
          </div>

          {/* Payment Method Status & Card Health */}
          <div className={`p-5 rounded-2xl border ${
            waBilling?.paymentMethodStatus === 'FAILED'
              ? 'bg-rose-500/10 border-rose-500/30'
              : isModern 
                ? (isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')
                : 'bg-emerald-500/5 border-emerald-500/20'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold flex items-center gap-2">
                <ShieldCheck size={18} className={waBilling?.paymentMethodStatus === 'FAILED' ? 'text-rose-500' : 'text-emerald-500'} />
                <span>Payment Method / Card Status</span>
              </p>
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                waBilling?.paymentMethodStatus === 'FAILED' 
                  ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' 
                  : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              }`}>
                {waBilling?.paymentMethodStatus === 'FAILED' ? 'FAILED / ACTION REQUIRED' : 'ACTIVE & HEALTHY'}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {waBilling?.paymentMethodStatus === 'FAILED' 
                ? 'Card එකෙන් මුදල් අයවීම fail වී ඇත හෝ limit එක ඉක්මවා ඇත. වහාම Meta Business Manager හි Billing Settings පරීක්ෂා කරන්න.' 
                : 'Meta Ad Account / WhatsApp Business Account එකට link කර ඇති Card එක Active තත්ත්වයේ පවතී. ගෙවීම් ගැටලු වාර්තා වී නොමැත.'}
            </p>
          </div>

          {/* Connected WABA Accounts & Account Restrictions */}
          <div className={`p-5 rounded-2xl border ${
            isModern ? (isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200') : 'bg-white/50 dark:bg-black/30 border-gray-200 dark:border-gray-800'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Layers size={16} className="text-blue-500" />
                Meta Business Accounts ({waBilling?.wabaAccounts?.length || 0})
              </p>
              {waBilling?.restrictedAccounts?.length > 0 && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-500 border border-rose-500/30">
                  {waBilling.restrictedAccounts.length} Restricted
                </span>
              )}
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar">
              {waBilling?.wabaAccounts?.map((waba, idx) => {
                const isRejected = waba.account_review_status && waba.account_review_status !== 'APPROVED';
                return (
                  <div key={waba.id || idx} className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    isRejected 
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300' 
                      : isModern ? (isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-white border-slate-200') : 'bg-white/80 dark:bg-black/40 border-gray-200 dark:border-gray-800'
                  }`}>
                    <div className="truncate mr-2">
                      <p className="font-bold truncate text-xs">{waba.name || 'WABA Account'}</p>
                      <p className="text-[10px] text-gray-500 font-mono">ID: {waba.id}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${
                      isRejected 
                        ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' 
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {waba.account_review_status || 'APPROVED'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Live Alerts & Security */}
      {waActiveTab === 'alerts' && (
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[480px] custom-scrollbar">
          {waAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 py-12">
              <CheckCircle2 size={40} className="text-emerald-500/40" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">All systems normal. No alerts yet.</p>
              <p className="text-xs text-gray-500">Meta webhooks, payment alerts & quality updates will appear here in real-time.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {waAlerts.map((alert, idx) => {
                const lowerMsg = (alert?.message || '').toLowerCase();
                const alertTypeStr = String(alert?.alertType || '');
                const isPaymentAlert = lowerMsg.includes('payment') || lowerMsg.includes('card') || lowerMsg.includes('limit');
                const isCritical = isPaymentAlert || alertTypeStr.includes('block') || lowerMsg.includes('reject');
                return (
                  <div key={alert?.id || idx} className={`p-4 rounded-2xl border transition-all ${
                    isPaymentAlert
                      ? 'bg-rose-500/15 border-rose-500/40 shadow-sm'
                      : isModern 
                        ? (isCritical 
                            ? 'bg-rose-500/10 border-rose-500/30' 
                            : (isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'))
                        : (isCritical 
                            ? 'bg-rose-500/10 border-rose-500/30' 
                            : 'bg-emerald-500/5 border-emerald-500/20')
                  }`}>
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="flex items-center gap-1.5">
                        {isPaymentAlert && <CreditCard size={13} className="text-rose-500" />}
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          isCritical ? 'bg-rose-500/20 text-rose-500' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {isPaymentAlert ? 'PAYMENT ALERT' : alertTypeStr.replace(/_/g, ' ') || 'SYSTEM ALERT'}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {alert?.createdAt ? new Date(alert.createdAt).toLocaleTimeString() : ''}
                      </span>
                    </div>
                    <p className={`text-xs font-medium leading-relaxed ${
                      isModern ? (isDarkMode ? 'text-slate-200' : 'text-slate-800') : 'text-gray-800 dark:text-gray-200'
                    }`}>
                      {alert?.message || 'System notification received'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
