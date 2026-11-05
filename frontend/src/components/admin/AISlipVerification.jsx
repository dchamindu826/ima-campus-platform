import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/axios';
import { FolderOpen, Folder, Trash2, XCircle, X,  
  Upload, CheckCircle, FileText, Activity, Loader, 
  ShieldCheck, Database, Search, Key, Lock, Plus, Calendar, 
  AlertCircle, Settings, KeyRound, Image, CheckSquare, Edit3, Terminal, Send, Bot, User,
  Zap, Play, StopCircle, History, Clock, Filter, RefreshCw, Eye, ExternalLink, Server, ChevronRight
 } from 'lucide-react';
import toast from 'react-hot-toast';
import AIHistoryTab from './AIHistoryTab';



const ScanningAnimation = ({ targetSlipConfig, banksConfig }) => {
    const selectedBankConfig = banksConfig.find(b => b.slips?.some(s => s.name === targetSlipConfig));
    const selectedSlipDef = selectedBankConfig?.slips.find(s => s.name === targetSlipConfig);
    const refImage = selectedSlipDef?.mediaUrl;

    const [extractionSteps, setExtractionSteps] = React.useState([]);

    React.useEffect(() => {
        const steps = [
            "Initializing Neural Network...",
            "Loading Template: " + (targetSlipConfig || 'Auto-Detect'),
            "Aligning corners & correcting perspective...",
            "Applying OCR to image sectors...",
            "Extracting Date [sector 1]...",
            "Found Date: [**/**/****]",
            "Extracting Amount [sector 2]...",
            "Found Amount: LKR [**,***.**]",
            "Extracting Transaction Reference...",
            "Found Ref: [*********]",
            "Cross-referencing with Bank Vault...",
            "Comparing against recent transactions...",
            "Match probability: 98.5%",
            "Verification successful."
        ];
        
        let i = 0;
        const interval = setInterval(() => {
            if(i < steps.length) {
                setExtractionSteps(prev => [...prev, steps[i]]);
                i++;
            } else {
                setExtractionSteps([]);
                i = 0;
            }
        }, 600);
        return () => clearInterval(interval);
    }, [targetSlipConfig]);

    return (
        <div className="absolute inset-0 z-50 bg-gray-950/95 backdrop-blur-xl flex flex-col rounded-2xl overflow-hidden border border-blue-500/40 shadow-[0_0_50px_rgba(59,130,246,0.2)]">
            {/* Header */}
            <div className="h-10 border-b border-blue-500/30 bg-gradient-to-r from-blue-900/40 to-indigo-900/40 flex items-center px-4 shrink-0 shadow-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(59,130,246,0.2),transparent)] animate-[scan_2s_linear_infinite]"></div>
                <Activity className="text-emerald-400 animate-pulse mr-2" size={16} />
                <span className="text-emerald-300 font-mono text-[10px] uppercase tracking-[0.2em] font-bold">Quantum Vision Engine</span>
                <div className="ml-auto flex gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                    <span className="w-2 h-2 rounded-full bg-yellow-500 animate-ping" style={{animationDelay: '200ms'}}></span>
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" style={{animationDelay: '400ms'}}></span>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row w-full flex-1 p-4 gap-4 relative">
                
                {/* Left: Image Scanner */}
                <div className="w-full sm:w-1/2 flex flex-col items-center justify-center relative bg-black/50 rounded-xl border border-blue-900/50 p-2 shrink-0 shadow-inner overflow-hidden group">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.05)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
                    
                    <div className="text-emerald-400 font-mono text-[10px] mb-4 uppercase tracking-widest border border-emerald-500/30 px-3 py-1 rounded bg-cyan-950/30 flex items-center gap-2 relative z-10 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                        <Search size={12} className="animate-[spin_3s_linear_infinite]" /> 
                        TARGET: {targetSlipConfig || 'AUTO'}
                    </div>
                    
                    <div className="relative w-[80%] max-w-[200px] aspect-[4/3] border border-emerald-500/40 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.15)] bg-gray-900 flex items-center justify-center group-hover:border-emerald-400/80 transition-colors duration-500">
                        {refImage ? (
                            <img 
                                src={
                                    refImage.startsWith('http') 
                                    ? refImage 
                                    : (import.meta.env.VITE_API_URL
                                        ? import.meta.env.VITE_API_URL.replace('/api', '') + '/api' + refImage
                                        : (window.location.protocol === 'https:' ? `https://${window.location.hostname}` : `http://${window.location.hostname}:5000`) + '/api' + refImage)
                                } 
                                alt="Reference" className="w-full h-full object-cover opacity-70 mix-blend-screen filter contrast-125" 
                            />
                        ) : (
                            <div className="text-emerald-900 flex flex-col items-center gap-2">
                                <Image size={32} className="opacity-50" />
                                <span className="text-[10px] font-mono tracking-widest">AWAITING IMAGE</span>
                            </div>
                        )}
                        
                        {/* Advanced Scanner Lines */}
                        <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-400 shadow-[0_0_20px_4px_rgba(16,185,129,1)] animate-[scan_2s_ease-in-out_infinite_alternate] z-20"></div>
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent animate-[scan_2s_ease-in-out_infinite_alternate] z-10"></div>
                        
                        {/* Crosshairs */}
                        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-400 opacity-70"></div>
                        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-emerald-400 opacity-70"></div>
                        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-emerald-400 opacity-70"></div>
                        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-emerald-400 opacity-70"></div>
                    </div>
                </div>

                {/* Right: Data Extraction Terminal */}
                <div className="w-full sm:w-1/2 flex flex-col bg-black/80 border border-gray-800 rounded-xl overflow-hidden relative shadow-inner">
                    <div className="h-6 bg-gray-900 border-b border-gray-800 flex items-center px-3 shrink-0">
                        <Terminal size={10} className="text-gray-500 mr-2" />
                        <span className="text-gray-500 font-mono text-[9px] uppercase tracking-widest">Extraction Log</span>
                    </div>
                    <div className="flex-1 p-3 font-mono text-[10px] overflow-y-auto flex flex-col justify-end relative">
                        {/* Terminal Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-transparent pointer-events-none z-10"></div>
                        <div className="space-y-1.5 relative z-20 w-full">
                            {extractionSteps.map((step, i) => (
                                <div key={i} className={`animate-[fadeIn_0.2s_ease-out] ${step.includes('Found') || step.includes('successful') ? 'text-emerald-400 font-bold drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' : step.includes('Match') ? 'text-amber-400' : 'text-emerald-500'}`}>
                                    <span className="text-gray-600 mr-2">{'>'}</span> 
                                    {step}
                                </div>
                            ))}
                            <div className="animate-pulse text-emerald-500">
                                <span className="text-gray-600 mr-2">{'>'}</span> _
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes scan {
                    0% { top: -10%; }
                    100% { top: 110%; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}} />
        </div>
    );
};

export default function AISlipVerification({ loggedInUser }) {
  // General State
  const [businesses, setBusinesses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isAutoVerifyEnabled, setIsAutoVerifyEnabled] = useState(false);
  
  // Pending Slips State
  const [pendingSlips, setPendingSlips] = useState([]);
  const [verificationCount, setVerificationCount] = useState(10);
  
  // Bank Statements State
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [newMonthName, setNewMonthName] = useState('');
  const [showNewMonthModal, setShowNewMonthModal] = useState(false);
  const [statementFile, setStatementFile] = useState(null);
  const [statementBank, setStatementBank] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [statementTransactions, setStatementTransactions] = useState([]);
  const [statementHeaders, setStatementHeaders] = useState([]);
  
  // Settings / Config Panel States
  const [showSettingsAuth, setShowSettingsAuth] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPassword, setSettingsPassword] = useState('');
  const [isAuthenticatedSettings, setIsAuthenticatedSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  
  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Configuration State
  const [banksConfig, setBanksConfig] = useState([]);
  const [activeBank, setActiveBank] = useState('');
  const [activeSlips, setActiveSlips] = useState([]);
  const [selectedConfigBankIndex, setSelectedConfigBankIndex] = useState(0);
  const [newBankName, setNewBankName] = useState('');
  
  // Manual Transaction States
  const [showManualTxnModal, setShowManualTxnModal] = useState(false);
  const [manualTxnDate, setManualTxnDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualTxnDesc, setManualTxnDesc] = useState('');
  const [manualTxnAmount, setManualTxnAmount] = useState('');
  const [isAddingManualTxn, setIsAddingManualTxn] = useState(false);

  // Verification Animation State
  const [isVerifying, setIsVerifying] = useState(false);
  const [currentVerifyingIndex, setCurrentVerifyingIndex] = useState(-1);
  const [currentVerifyingSlip, setCurrentVerifyingSlip] = useState(null);
  const [animStep, setAnimStep] = useState(0); // 1: Extract, 2: Query, 3: Match, 4: Done
  
  // Results State
  const [verifiedResults, setVerifiedResults] = useState([]);
  const [needsReviewResults, setNeedsReviewResults] = useState([]);

  // AI Command Console State
  const [commandText, setCommandText] = useState('');
  const [targetSlipConfig, setTargetSlipConfig] = useState('');
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [commandLogs, setCommandLogs] = useState([]);

  // Settings Tabs
  const [activeSettingsTab, setActiveSettingsTab] = useState('banks');
  const [mainTab, setMainTab] = useState('slips');
  const getImageUrl = (imageName) => (!imageName || imageName === 'default.png' || imageName === 'null') ? '/logo.png' : (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : (window.location.protocol === 'https:' ? `https://${window.location.hostname}` : `http://${window.location.hostname}:5000`)) + '/storage/icons/' + imageName;
  const [activeSlipTab, setActiveSlipTab] = useState('Unprocessed Slips');
  const [schedules, setSchedules] = useState({ mainQueue: { active: false, times: ['02:00', '', '', '', ''] }, noMatch: { active: false, times: ['12:00', '', '', '', ''] } });
  const [showScheduleSettings, setShowScheduleSettings] = useState(false);
  const [manualReviewSubTab, setManualReviewSubTab] = useState('Data Match Not Found');
  
  const toggleSchedule = async (type) => {
    const state = !schedules[type].active;
    const times = schedules[type].times;
    setSchedules(prev => ({...prev, [type]: { ...prev[type], active: state }}));
    toast.success(`${type === 'mainQueue' ? 'Main Queue' : 'No Match'} schedule turned ${state ? 'ON' : 'OFF'}`);
    api.post('/ai-verification/schedule', { type, active: state, times }).catch(e => console.error(e));
  };
  
  const updateScheduleTime = (type, index, time) => {
    setSchedules(prev => {
      const newTimes = [...prev[type].times];
      newTimes[index] = time;
      const newState = {...prev, [type]: { ...prev[type], times: newTimes }};
      
      // Save to backend immediately
      api.post('/ai-verification/schedule', { type, active: newState[type].active, times: newTimes }).catch(e => console.error(e));
      
      return newState;
    });
  };
  const [bulkStatus, setBulkStatus] = useState({ isRunning: false, processed: 0, total: 0 });

  const [gsheetTree, setGsheetTree] = useState({});
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedSheetTab, setSelectedSheetTab] = useState('');

  useEffect(() => {
    fetchBusinesses();
    fetchMonths();
    fetchFullConfig();
    fetchScheduleConfig();
  }, []);

  useEffect(() => {
    if (selectedBusiness) {
      fetchBatches(selectedBusiness);
    } else {
      setBatches([]);
      setSelectedBatch('');
    }
  }, [selectedBusiness]);

  useEffect(() => {
    fetchPendingSlips();
  }, [selectedBusiness, selectedBatch, selectedStatus]);

  useEffect(() => {
    let interval;
    if (isAutoVerifyEnabled && !isVerifying) {
      interval = setInterval(() => {
        if (pendingSlips.length > 0 && targetSlipConfig && selectedMonth) {
          startBatchVerification();
        } else {
          fetchPendingSlips();
        }
      }, 15000); // Poll every 15 seconds
    }
    return () => clearInterval(interval);
  }, [isAutoVerifyEnabled, isVerifying, pendingSlips.length, targetSlipConfig, selectedMonth]);

  useEffect(() => {
      let interval;
      const pollBulkStatus = async () => {
          try {
              const { data } = await api.get('/ai-verification/bulk-status');
              setBulkStatus(data);
              if (data.isRunning) {
                  fetchPendingSlips();
              }
          } catch (error) {
              console.error("Error polling bulk status", error);
          }
      };

      if (mainTab === 'slips') {
          pollBulkStatus();
          interval = setInterval(pollBulkStatus, 2000);
      }
      return () => clearInterval(interval);
  }, [mainTab, selectedBusiness, selectedBatch, selectedStatus]);

  useEffect(() => {
    if (selectedBatch) fetchMonthTransactions(selectedBatch);
  }, [selectedBatch]);

  const fetchBusinesses = async () => {
    try {
      const res = await api.get('/admin/businesses');
      setBusinesses(Array.isArray(res.data) ? res.data : []);
    } catch (err) { toast.error("Failed to fetch businesses"); }
  };

  const fetchBatches = async (bizId) => {
    try {
      const res = await api.get(`/admin/batches/${bizId}`);
      setBatches(Array.isArray(res.data.batches) ? res.data.batches : []);
    } catch (err) { toast.error("Failed to fetch batches"); }
  };

  const fetchMonths = async () => {
    try {
      const res = await api.get('/ai-verification/months');
      setMonths(Array.isArray(res.data) ? res.data : []);
      if (res.data.length > 0 && !selectedMonth) {
        setSelectedMonth(res.data[0]);
      }
    } catch (err) { toast.error("Failed to fetch months"); }
  };

  const fetchPendingSlips = async () => {
    try {
      let url = '/ai-verification/pending-slips?includeApproved=true&';
      if (selectedBusiness) url += `businessId=${selectedBusiness}&`;
      if (selectedBatch) url += `batchId=${selectedBatch}&`;
      // Note: We deliberately do not pass selectedStatus here so that 
      // the tabs (AI Verified, Manual Review) can show the real-time progress of slips
      // even after their status changes (e.g. from 0 to 1).
      const res = await api.get(url);
      setPendingSlips(Array.isArray(res.data) ? res.data : []);
    } catch (err) { toast.error("Failed to fetch pending slips"); }
  };

  const startBulkVerification = async () => {
    if (bulkStatus?.isRunning) {
      try {
        await api.post('/ai-verification/bulk-stop');
        toast.success("Bulk Run Stopped");
      } catch (e) {
        toast.error("Failed to stop bulk verification");
      }
      return;
    }

    try {
      const res = await api.post('/ai-verification/bulk-start', {
        businessId: selectedBusiness,
        batchId: selectedBatch,
        status: selectedStatus
      });
      toast.success(res.data?.message || "Bulk AI Verification Started");
    } catch (e) {
      const errMsg = e.response?.data?.error || "Failed to start bulk verification";
      toast.error(errMsg);
    }
  };

  const fetchMonthTransactions = async (bId) => {
    try {
      const res = await api.get(`/ai-verification/transactions?batchId=${bId}`);
      if (res.data && res.data.rows) {
        setStatementTransactions(res.data.rows);
        setStatementHeaders(res.data.headers || []);
      } else {
        setStatementTransactions(Array.isArray(res.data) ? res.data : []);
        setStatementHeaders([]);
      }
    } catch (err) { toast.error("Failed to fetch transactions"); }
  };

  // --- Settings & Config Panel Actions ---
  const handleAuthSettings = async () => {
    try {
      const res = await api.post('/ai-verification/verify-password', { password: settingsPassword });
      if (res.data.success) {
        setIsAuthenticatedSettings(true);
        setShowSettingsAuth(false);
        setShowSettings(true);
        setSettingsPassword('');
        fetchFullConfig();
      } else {
        toast.error("Invalid Security PIN");
      }
    } catch (err) {
      toast.error("Password authentication failed");
    }
  };

  const fetchFullConfig = async () => {
    try {
      const res = await api.get(`/ai-verification/config?t=${Date.now()}`);
      setApiKey(res.data.apiKey || '');
      setBanksConfig(Array.isArray(res.data.banks) ? res.data.banks : []);
      const settingsRes = await api.get(`/ai-verification/settings?t=${Date.now()}`);
      if (settingsRes.data.settings) {
        setActiveBank(settingsRes.data.settings.activeBank || '');
        setActiveSlips(Array.isArray(settingsRes.data.settings.activeSlips) ? settingsRes.data.settings.activeSlips : []);
      }
      try { const treeRes = await api.get('/ai-verification/gsheet-config/tree'); setGsheetTree(treeRes.data || {}); } catch(e){}
    } catch (err) {
      toast.error("Failed to load full configuration");
    }
  };

  const fetchScheduleConfig = async () => {
    try {
      const res = await api.get('/ai-verification/schedule-config');
      if (res.data && Object.keys(res.data).length > 0) {
        setSchedules(prev => ({
          ...prev,
          ...res.data
        }));
      }
    } catch (err) {
      console.error("Failed to load schedule config", err);
    }
  };

  const saveGsheetTree = async (tree) => {
    try {
      await api.post('/ai-verification/gsheet-config/tree', { tree });
      toast.success("G-Sheets Directory saved");
    } catch(e) {
      toast.error("Failed to save G-Sheets Directory");
    }
  };

  const handleSaveConfig = async () => {
    setIsSavingKey(true);
    try {
      await api.post('/ai-verification/config', { 
        apiKey, 
        banks: banksConfig 
      });
      
      // Save active settings too
      await api.post('/ai-verification/settings-active', {
        activeBank,
        activeSlips
      });

      toast.success("AI Core Settings and Bank Configurations saved!");
      setShowSettings(false);
      setIsAuthenticatedSettings(false);
    } catch (err) {
      toast.error("Failed to save core configurations");
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleChangePIN = async () => {
    if (newPassword !== confirmPassword) {
      return toast.error("New PINs do not match");
    }
    try {
      await api.post('/ai-verification/change-password', {
        currentPassword,
        newPassword
      });
      toast.success("Security PIN changed successfully!");
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update security PIN");
    }
  };

  // --- Config Editor Helpers ---
  const handleAddBank = () => {
    if (!newBankName.trim()) return toast.error("Please enter a bank name");
    if (banksConfig.some(b => b.bankName.toLowerCase() === newBankName.trim().toLowerCase())) {
      return toast.error("Bank already exists");
    }
    const updated = [...banksConfig, { bankName: newBankName.trim(), slips: [] }];
    setBanksConfig(updated);
    setSelectedConfigBankIndex(updated.length - 1);
    setNewBankName('');
  };

  const handleDeleteBank = (index) => {
    const updated = banksConfig.filter((_, i) => i !== index);
    setBanksConfig(updated);
    setSelectedConfigBankIndex(Math.max(0, index - 1));
  };

  const handleAddSlipType = (bankIndex) => {
    const targetBank = banksConfig[bankIndex];
    const newSlipName = prompt("Enter Slip Type Name (e.g. CDM, Online Transfer):");
    if (newSlipName) {
      const updated = [...banksConfig];
      updated[bankIndex] = {
        ...targetBank,
        slips: [...(targetBank.slips || []), { name: newSlipName, slip_image: '', rules: '' }]
      };
      setBanksConfig(updated);
    }
  };

  const handleAddCustomColumn = (bankIndex) => {
    const updated = [...banksConfig];
    if (!updated[bankIndex].customColumns) updated[bankIndex].customColumns = [];
    updated[bankIndex].customColumns.push({ name: '', isCurrency: false });
    setBanksConfig(updated);
  };

  const handleUpdateCustomColumn = (bankIndex, colIndex, field, value) => {
    const updated = [...banksConfig];
    updated[bankIndex].customColumns[colIndex][field] = value;
    setBanksConfig(updated);
  };

  const handleRemoveCustomColumn = (bankIndex, colIndex) => {
    const updated = [...banksConfig];
    updated[bankIndex].customColumns.splice(colIndex, 1);
    setBanksConfig(updated);
  };

  const handleDeleteSlipType = (bankIndex, slipIndex) => {
    const updated = [...banksConfig];
    updated[bankIndex].slips = updated[bankIndex].slips.filter((_, i) => i !== slipIndex);
    setBanksConfig(updated);
  };

  const handleUpdateSlipType = (bankIndex, slipIndex, key, value) => {
    const updated = [...banksConfig];
    updated[bankIndex].slips[slipIndex][key] = value;
    setBanksConfig(updated);
  };

  const handleUploadRefSlipImage = async (bankIndex, slipIndex, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('refSlipFile', file);
    
    const toastId = toast.loading("Uploading reference slip...");
    try {
      const res = await api.post('/ai-verification/upload-ref-slip', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      handleUpdateSlipType(bankIndex, slipIndex, 'mediaUrl', res.data.fileUrl);
      toast.success("Reference slip uploaded!", { id: toastId });
    } catch (err) {
      toast.error("Reference slip upload failed", { id: toastId });
    }
  };

  // --- Bank Statement Upload & Manual Entries ---
  const handleCreateMonth = () => {
    if (!newMonthName) return toast.error("Month name required (e.g. June 2026)");
    setMonths([newMonthName, ...months]);
    setSelectedMonth(newMonthName);
    setNewMonthName('');
    setShowNewMonthModal(false);
  };

  const handleClearTable = async () => {
      if (!window.confirm(`Are you sure you want to clear the data? If you are using a Google Sheet, this will unlink the sheet for the selected batch.`)) return;

      if (selectedFolder && selectedBatch) {
          const t = {...gsheetTree};
          if (t[selectedFolder]) {
              t[selectedFolder] = {...t[selectedFolder]};
              t[selectedFolder][selectedBatch] = [];
              setGsheetTree(t);
              await saveGsheetTree(t);
          }
          setStatementTransactions([]);
      }

      if (selectedMonth) {
          try {
              await api.delete(`/ai-verification/bank-statements/${selectedMonth}`);
          } catch (err) {
              console.error(err);
          }
      }
      
      toast.success("Successfully cleared data.");
  };

  const handleUploadStatement = async () => {
    if (!statementFile) return toast.error("Please select an Excel/CSV file");
    if (!selectedFolder) return toast.error("Please select a Bank Template");

    const formData = new FormData();
    formData.append('statementFile', statementFile);
    formData.append('month', selectedMonth);
    formData.append('bankName', selectedFolder);
    
    setIsUploading(true);
    try {
      const res = await api.post('/ai-verification/upload-bank-statement', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(res.data.message);
      setStatementFile(null);
      document.getElementById('bank-upload').value = '';
      fetchMonthTransactions(selectedBatch);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddManualTransaction = async () => {
    if (!manualTxnDate || !manualTxnDesc.trim() || !manualTxnAmount || !selectedMonth) {
      return toast.error("All manual transaction fields are required");
    }
    setIsAddingManualTxn(true);
    try {
      await api.post('/ai-verification/add-manual-transaction', {
        txnDate: manualTxnDate,
        description: manualTxnDesc.trim(),
        amount: parseFloat(manualTxnAmount),
        statementMonth: selectedMonth
      });
      toast.success("Transaction recorded successfully!");
      setShowManualTxnModal(false);
      setManualTxnDesc('');
      setManualTxnAmount('');
      fetchMonthTransactions(selectedBatch);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add transaction record");
    } finally {
      setIsAddingManualTxn(false);
    }
  };

  // --- AI Verification Logic ---
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Verify single slip by payment ID
  const verifySingleSlip = async (slip) => {
    setIsVerifying(true);
    setCurrentVerifyingIndex(0);
    setCurrentVerifyingSlip(slip);
    setAnimStep(1); // Scan image

    await sleep(1000);
    setAnimStep(2); // Query DB
    await sleep(800);
    setAnimStep(3); // Match transactions
    
    try {
      const res = await api.post('/ai-verification/verify-single', {
        paymentId: slip.id,
        autoDetect: true
      }, { timeout: 35000 });
      
      setAnimStep(4); // Match results ready
      
      const result = res.data;
      if (result.success || result.status === 'VERIFIED') {
        toast.success(`Slip #${slip.id} matched and verified!`);
        setVerifiedResults(prev => [{ slip, ...result }, ...prev]);
      } else if (result.status === 'DUPLICATE_SLIP') {
        toast.warning(result.error || `Duplicate slip detected for #${slip.id}`);
        setNeedsReviewResults(prev => [{ slip, ...result }, ...prev]);
      } else if (result.status === 'BUSINESS_MISMATCH') {
        toast.warning(result.error || `Business mismatch for slip #${slip.id}`);
        setNeedsReviewResults(prev => [{ slip, ...result }, ...prev]);
      } else {
        toast.info(result.error || `Auto match pending/review for slip #${slip.id}`);
        setNeedsReviewResults(prev => [{ slip, ...result }, ...prev]);
      }
      await sleep(1500);
    } catch (err) {
      toast.error(err.response?.data?.error || `AI processing failed for slip #${slip.id}`);
      setNeedsReviewResults(prev => [{ slip, status: 'ERROR', confidence: 0, matchMethod: 'Error executing AI process' }, ...prev]);
      await sleep(1000);
    } finally {
      setIsVerifying(false);
      setCurrentVerifyingIndex(-1);
      setCurrentVerifyingSlip(null);
      setAnimStep(0);
      fetchPendingSlips();
      fetchMonthTransactions(selectedBatch);
    }
  };
  const handleExecuteCommand = async () => {
    if (!commandText.trim()) return;
    if (!targetSlipConfig) return toast.error("Please select a Target Slip Template first.");

    const cmd = commandText.trim();
    setCommandText('');
    setCommandLogs(prev => [...prev, { role: 'user', text: cmd }]);
    setIsExecutingCommand(true);

    try {
      const res = await api.post('/ai-verification/execute-command', {
        command: cmd,
        exampleSlipConfigName: targetSlipConfig,
        pendingPaymentIds: pendingSlips.map(s => s.id),
        statementMonth: selectedMonth
      });

      setCommandLogs(prev => [...prev, { role: 'ai', text: res.data.message }]);

      if (res.data.action === 'FILTERED') {
        const filtered = pendingSlips.filter(s => res.data.matchedPaymentIds.includes(s.id));
        setPendingSlips(filtered);
        toast.success(`Filtered ${filtered.length} slips matching the template.`);
      } else if (res.data.action === 'VERIFY') {
        setVerificationCount(res.data.count);
        setTimeout(() => startBatchVerification(), 500);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Error executing command. Please try again.';
      setCommandLogs(prev => [...prev, { role: 'error', text: `❌ ${errorMsg}` }]);
    } finally {
      setIsExecutingCommand(false);
    }
  };

  // Verify batch of slips sequentially
  const startBatchVerification = async () => {
    if (!selectedMonth) return toast.error("Please select a target Month for bank statements");
    if (pendingSlips.length === 0) return toast.error("No pending slips to verify");
    if (verificationCount < 1) return toast.error("Count must be at least 1");
    if (!targetSlipConfig) return toast.error("Please select a Target Slip Template first.");

    setIsVerifying(true);

    const selectedBankConfig = banksConfig.find(b => b.slips?.some(s => s.name === targetSlipConfig));
    if (selectedBankConfig) {
      try {
        await api.post('/ai-verification/settings-active', {
          activeBank: selectedBankConfig.bankName,
          activeSlips: [targetSlipConfig]
        });
      } catch(e) {
          console.error("Failed to update active settings", e);
          setIsVerifying(false);
          return toast.error("Failed to set active bank template. Check network.");
      }
    }

    const slipsToVerify = pendingSlips.slice(0, verificationCount);
    
    for (let i = 0; i < slipsToVerify.length; i++) {
        const slip = slipsToVerify[i];
        setCurrentVerifyingIndex(i);
        setCurrentVerifyingSlip(slip);
        
        setAnimStep(1); 
        await sleep(1000);
        setAnimStep(2); 
        await sleep(800);
        setAnimStep(3); 
        
        try {
            const res = await api.post('/ai-verification/process-verification', {
                paymentIds: [slip.id],
                statementMonth: selectedMonth
            });
            
            setAnimStep(4);
            await sleep(800);
            
            const result = res.data.results[0] || res.data;
            result.slip = slip;
            
            if (result.status === 'VERIFIED') {
                setVerifiedResults(prev => [result, ...prev]);
            } else {
                setNeedsReviewResults(prev => [result, ...prev]);
            }
        } catch (err) {
            toast.error(`Verification failed for slip #${slip.id}`);
            setNeedsReviewResults(prev => [{ slip, status: 'ERROR', confidence: 0 }, ...prev]);
        }
    }
    
    setIsVerifying(false);
    setCurrentVerifyingIndex(-1);
    setCurrentVerifyingSlip(null);
    setAnimStep(0);
    toast.success("Batch verification completed!");
    fetchPendingSlips();
    fetchMonthTransactions(selectedBatch);
  };

  return (
    <div className="p-6 h-[calc(100vh-4rem)] overflow-y-auto font-sans bg-black/30 text-gray-200">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-gray-900/40 p-3 rounded-xl border border-gray-800">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="text-emerald-500" size={20} /> AI Slip Verification Center
          </h1>
          <p className="text-gray-400 text-xs">Targeted verification sequence for pending deposits</p>
        </div>
        
        <div className="flex items-center gap-3">
            <select 
              value={selectedBusiness} 
              onChange={(e) => setSelectedBusiness(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-md px-3 py-1.5 focus:border-emerald-500 outline-none"
            >
              <option value="">All Businesses</option>
              {businesses.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            
            <select 
              value={selectedBatch} 
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-md px-3 py-1.5 focus:border-emerald-500 outline-none"
            >
              <option value="">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <select 
              value={selectedStatus} 
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-md px-3 py-1.5 focus:border-emerald-500 outline-none"
            >
              <option value="">All Statuses</option>
              <option value="0">Pending</option>
              <option value="1">Approved</option>
              <option value="2">Rejected</option>
              <option value="4">Post Pay</option>
              <option value="3">Non Paid</option>
              <option value="5">Trash</option>
            </select>

            <div className="flex gap-2">
                <button 
                    onClick={() => setShowScheduleSettings(true)}
                    className="p-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-blue-400 hover:text-blue-300 rounded-md transition"
                    title="AI Schedule Settings"
                >
                    <Calendar size={18} />
                </button>
                <button 
                    onClick={() => setShowSettingsAuth(true)}
                    className="p-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-emerald-400 hover:text-emerald-300 rounded-md transition"
                    title="AI Core Settings & Bank Configuration"
                >
                    <Settings size={18} />
                </button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-12">
            <div className="flex gap-6 mb-4 border-b border-gray-800 pb-2">
                <button onClick={() => setMainTab('slips')} className={`pb-2 font-bold text-sm transition-colors ${mainTab==='slips' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
                    <Activity className="inline mr-2 mb-0.5" size={16}/>Collected Slips
                </button>
                <button onClick={() => setMainTab('vault')} className={`pb-2 font-bold text-sm transition-colors ${mainTab==='vault' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
                    <Database className="inline mr-2 mb-0.5" size={16}/>Google Sheet Vault
                </button>
                <button onClick={() => setMainTab('history')} className={`pb-2 font-bold text-sm transition-colors ${mainTab==='history' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
                    <History className="inline mr-2 mb-0.5" size={16}/>Schedule History
                </button>
            </div>
        </div>

        {mainTab === 'history' && (
            <div className="lg:col-span-12">
                <AIHistoryTab api={api} />
            </div>
        )}

        {mainTab === 'slips' && (
        <>
        <div className="lg:col-span-12 flex flex-col gap-6">
            {/* BULK VERIFICATION DASHBOARD */}
            {/* AUTO VERIFICATION DASHBOARD (COMPACT) */}
            <div className="bg-[#111318] border border-gray-800/60 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-800 rounded-lg">
                        <Bot className="text-gray-300" size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white mb-0.5">
                            Auto-Verification Engine
                        </h3>
                        <p className="text-xs text-gray-500">
                            Automatically scans all pending slips, detects the bank template, and verifies against the Google Sheet.
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {bulkStatus?.isRunning && (
                        <div className="flex flex-col items-end mr-4">
                            <div className="text-[11px] font-mono mb-1 text-gray-300 flex items-center gap-3 bg-gray-900/80 px-3 py-1 rounded-md border border-gray-700">
                                <span className="text-blue-400">Total: {bulkStatus.total}</span>
                                <span className="text-purple-400">Processed: {bulkStatus.processed}</span>
                                <span className="text-emerald-400 font-bold">Verified: {bulkStatus.success}</span>
                                <span className="text-amber-400 font-bold">Manual: {bulkStatus.failed}</span>
                            </div>
                            <div className="w-full flex items-center gap-2 justify-end">
                                <div className="text-[10px] text-emerald-400 font-bold">RUNNING {bulkStatus.total > 0 ? Math.round((bulkStatus.processed/bulkStatus.total)*100) : 0}%</div>
                                <div className="w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 transition-all duration-300" style={{width: `${bulkStatus.total > 0 ? (bulkStatus.processed / bulkStatus.total) * 100 : 0}%`}}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    {!bulkStatus?.isRunning ? (
                        <button 
                            onClick={async () => {
                                try {
                                    const visibleSlipIds = pendingSlips.filter(slip => {
                                        if (activeSlipTab === 'All Slips') return true;
                                        if (activeSlipTab === 'Post Pay') return slip.status === 4 && (!slip.remark || (!slip.remark.includes('AI') && !slip.remark.includes('[Duplicate') && !slip.remark.includes('[Business') && !slip.remark.includes('[Batch') && !slip.remark.includes('Skipped')));
                                        if (activeSlipTab === 'AI Verified') return slip.aiVerified === true;
                                        if (activeSlipTab === 'Unprocessed') return slip.status === 0 && !slip.aiVerified && (!slip.remark || (!slip.remark.includes('AI') && !slip.remark.includes('[Duplicate') && !slip.remark.includes('[Business') && !slip.remark.includes('[Batch')));
                                        if (activeSlipTab === 'Manual Review') {
                                            const r = (slip.remark || '').toLowerCase();
                                            if (slip.status !== 0 && slip.status !== 4) return false;
                                            if (manualReviewSubTab === 'Data Match Not Found') return r.includes('no match') || r.includes('not found') || r.includes('no google sheet') || r.includes('unprocessed') || r.includes('failed');
                                            if (manualReviewSubTab === 'Payment Mismatch') return r.includes('payment') || r.includes('amount') || r.includes('duplicate') || r.includes('ref id');
                                            if (manualReviewSubTab === 'Batch Mismatch') return r.includes('batch') || r.includes('business') || r.includes('mismatch') || r.includes('stream');
                                            return r.includes('ai') || r.includes('duplicate') || r.includes('mismatch') || r.includes('skipped');
                                        }
                                        return false;
                                    }).map(s => s.id);

                                    const res = await api.post('/ai-verification/bulk-start', {
                                        businessId: selectedBusiness,
                                        batchId: selectedBatch,
                                        status: selectedStatus,
                                        paymentIds: visibleSlipIds
                                    });
                                    toast.success(res.data?.message || "Bulk AI Verification Started");
                                    const { data: statusData } = await api.get('/ai-verification/bulk-status');
                                    setBulkStatus(statusData);
                                } catch(e) {
                                    const errMsg = e.response?.data?.error || "Failed to start bulk run";
                                    toast.error(errMsg);
                                }
                            }}
                            disabled={pendingSlips.length === 0}
                            className={`px-4 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 transition ${pendingSlips.length === 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-[#00B48A] hover:bg-[#009b76]'}`}
                        >
                            <Search size={16} /> Start Bulk Auto-Verify
                        </button>
                    ) : (
                        <button 
                            onClick={async () => {
                                try {
                                    await api.post('/ai-verification/bulk-stop');
                                    toast.success("Bulk AI Verification Stopped");
                                    const { data: statusData } = await api.get('/ai-verification/bulk-status');
                                    setBulkStatus(statusData);
                                } catch(e) {
                                    toast.error("Failed to stop bulk run");
                                }
                            }}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 flex items-center gap-2 transition"
                        >
                            <XCircle size={16} /> Stop Bulk Run
                        </button>
                    )}
                </div>
            </div>


            
            {/* SCHEDULE SETTINGS MODAL */}
            {showScheduleSettings && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-2xl shadow-2xl relative">
                        <button onClick={() => setShowScheduleSettings(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><XCircle size={24}/></button>
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Clock className="text-purple-400" size={24} /> AI Verification Schedules
                        </h2>
                        
                        <div className="flex flex-col gap-4">
                            {/* Main Queue */}
                            <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-base font-bold text-gray-200">Main Verification Queue</h4>
                                        <p className="text-xs text-gray-400">Auto-verify Post Pay and New Slips combined</p>
                                    </div>
                                    <div onClick={() => toggleSchedule('mainQueue')} className={`w-12 h-6 ${schedules.mainQueue.active ? 'bg-emerald-500' : 'bg-gray-600'} rounded-full relative cursor-pointer transition-colors`}>
                                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${schedules.mainQueue.active ? 'right-0.5' : 'left-0.5'}`}></div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-5 gap-2 mt-2">
                                    {schedules.mainQueue.times.map((t, i) => (
                                        <input key={i} type="time" value={t} onChange={(e) => updateScheduleTime('mainQueue', i, e.target.value)} className="bg-gray-900 border border-gray-700 text-white rounded px-2 py-1.5 text-sm outline-none focus:border-emerald-500" />
                                    ))}
                                </div>
                            </div>

                            {/* No Match Found */}
                            <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-base font-bold text-red-400 flex items-center gap-1"><AlertCircle size={16}/> Match Not Found Retry</h4>
                                        <p className="text-xs text-gray-400">Re-attempt verification for failed slips</p>
                                    </div>
                                    <div onClick={() => toggleSchedule('noMatch')} className={`w-12 h-6 ${schedules.noMatch.active ? 'bg-emerald-500' : 'bg-gray-600'} rounded-full relative cursor-pointer transition-colors`}>
                                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${schedules.noMatch.active ? 'right-0.5' : 'left-0.5'}`}></div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-5 gap-2 mt-2">
                                    {schedules.noMatch.times.map((t, i) => (
                                        <input key={i} type="time" value={t} onChange={(e) => updateScheduleTime('noMatch', i, e.target.value)} className="bg-gray-900 border border-gray-700 text-white rounded px-2 py-1.5 text-sm outline-none focus:border-emerald-500" />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Activity className="text-blue-500" size={20} /> Collected Slips 
                        <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded-full">{pendingSlips.length}</span>
                    </h2>
                </div>

                <div className="flex gap-6 border-b border-gray-800 mb-4 pb-2 overflow-x-auto">
                    {['All Slips', 'Unprocessed', 'Manual Review', 'AI Verified', 'Post Pay'].map(tab => {
                        let count = 0;
                        if (tab === 'All Slips') count = pendingSlips.length;
                        else if (tab === 'Unprocessed') count = pendingSlips.filter(s => s.status === 0 && !s.aiVerified && (!s.remark || (!s.remark.includes('AI') && !s.remark.includes('[Duplicate') && !s.remark.includes('[Business') && !s.remark.includes('[Batch')))).length;
                        else if (tab === 'Manual Review') count = pendingSlips.filter(s => (s.status === 0 || s.status === 4) && s.remark && (s.remark.includes('AI') || s.remark.includes('[Duplicate') || s.remark.includes('[Business') || s.remark.includes('[Batch') || s.remark.includes('Skipped'))).length;
                        else if (tab === 'AI Verified') count = pendingSlips.filter(s => s.aiVerified === true).length;
                        else if (tab === 'Post Pay') count = pendingSlips.filter(s => s.status === 4 && (!s.remark || (!s.remark.includes('AI') && !s.remark.includes('[Duplicate') && !s.remark.includes('[Business') && !s.remark.includes('[Batch') && !s.remark.includes('Skipped')))).length;

                        return (
                        <button 
                            key={tab}
                            onClick={() => { setActiveSlipTab(tab); if(tab !== 'Manual Review') setManualReviewSubTab(''); }}
                            className={`pb-2 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${activeSlipTab === tab ? 'text-blue-400 border-blue-400' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                        >
                            {tab} {count > 0 && <span className="ml-1">({count})</span>}
                        </button>
                    )})}
                </div>

                {/* SUB-TABS FOR MANUAL REVIEW */}
                {activeSlipTab === 'Manual Review' && (
                    <div className="flex gap-2 mb-4 overflow-x-auto">
                        {['Data Match Not Found', 'Payment Mismatch', 'Batch Mismatch'].map(subTab => {
                            let count = 0;
                            if (subTab === 'Data Match Not Found') count = pendingSlips.filter(s => (s.status === 0 || s.status === 4) && s.remark && (s.remark.toLowerCase().includes('no match') || s.remark.toLowerCase().includes('not found') || s.remark.toLowerCase().includes('no google sheet') || s.remark.toLowerCase().includes('unprocessed') || s.remark.toLowerCase().includes('failed'))).length;
                            else if (subTab === 'Payment Mismatch') count = pendingSlips.filter(s => (s.status === 0 || s.status === 4) && s.remark && (s.remark.toLowerCase().includes('payment') || s.remark.toLowerCase().includes('amount') || s.remark.toLowerCase().includes('duplicate') || s.remark.toLowerCase().includes('ref id'))).length;
                            else if (subTab === 'Batch Mismatch') count = pendingSlips.filter(s => (s.status === 0 || s.status === 4) && s.remark && (s.remark.toLowerCase().includes('batch') || s.remark.toLowerCase().includes('business') || s.remark.toLowerCase().includes('mismatch') || s.remark.toLowerCase().includes('stream'))).length;
                            
                            return (
                            <button 
                                key={subTab}
                                onClick={() => setManualReviewSubTab(subTab)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors border whitespace-nowrap ${manualReviewSubTab === subTab ? 'bg-red-900/40 text-red-400 border-red-500/50' : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:text-gray-300 hover:bg-gray-800'}`}
                            >
                                {subTab} {count > 0 && <span className="ml-1">({count})</span>}
                            </button>
                        )})}
                    </div>
                )}

                <div className="max-h-[750px] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {pendingSlips.filter(slip => {
                            if (activeSlipTab === 'All Slips') return true;
                            if (activeSlipTab === 'Post Pay') return slip.status === 4 && (!slip.remark || (!slip.remark.includes('AI') && !slip.remark.includes('[Duplicate') && !slip.remark.includes('[Business') && !slip.remark.includes('[Batch') && !slip.remark.includes('Skipped')));
                            if (activeSlipTab === 'AI Verified') return slip.aiVerified === true;
                            if (activeSlipTab === 'Unprocessed') return slip.status === 0 && !slip.aiVerified && (!slip.remark || (!slip.remark.includes('AI') && !slip.remark.includes('[Duplicate') && !slip.remark.includes('[Business') && !slip.remark.includes('[Batch')));
                            if (activeSlipTab === 'Manual Review') {
                                const r = (slip.remark || '').toLowerCase();
                                if (slip.status !== 0 && slip.status !== 4) return false;
                                if (manualReviewSubTab === 'Data Match Not Found') return r.includes('no match') || r.includes('not found') || r.includes('no google sheet') || r.includes('unprocessed') || r.includes('failed');
                                if (manualReviewSubTab === 'Payment Mismatch') return r.includes('payment') || r.includes('amount') || r.includes('duplicate') || r.includes('ref id');
                                if (manualReviewSubTab === 'Batch Mismatch') return r.includes('batch') || r.includes('business') || r.includes('mismatch') || r.includes('stream');
                                return r.includes('ai') || r.includes('duplicate') || r.includes('mismatch') || r.includes('skipped');
                            }
                        }).map((slip, idx) => {
                            const isCurrent = isVerifying && currentVerifyingSlip?.id === slip.id;
                            const isProcessed = isVerifying && idx < currentVerifyingIndex;
                            
                            return (
                                <div key={slip.id} className={`bg-[#111318] border ${isCurrent ? 'border-emerald-500' : 'border-gray-800'} rounded-lg overflow-hidden flex flex-col transition-all duration-200 ${isProcessed ? 'opacity-50' : ''}`}>
                                    <div className="relative h-64 bg-gray-200 flex items-center justify-center overflow-hidden">
                                        {slip.slip_image ? (
                                            <img
                                                src={
                                                    import.meta.env.VITE_API_URL
                                                        ? import.meta.env.VITE_API_URL.replace('/api', '') + `/api/storage/documents/${slip.slip_image.split(',')[0]}`
                                                        : (window.location.protocol === 'https:' ? `https://${window.location.hostname}` : `http://${window.location.hostname}:5000`) + `/api/storage/documents/${slip.slip_image.split(',')[0]}`
                                                }
                                                alt="slip"
                                                className="w-full h-full object-contain"
                                                onError={(e) => { e.target.src = '/logo.png'; }}
                                            />
                                        ) : <FileText size={32} className="text-gray-400"/>}
                                        
                                        <div className="absolute top-2 right-2 bg-black text-white px-2 py-0.5 rounded text-[10px] font-mono">
                                            #{slip.id}
                                        </div>

                                        {isCurrent && (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm z-10">
                                                <Loader className="animate-spin text-emerald-400" size={24} />
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="p-4 flex-1 flex flex-col bg-[#111318]">
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="text-sm font-bold text-gray-200 truncate pr-2">{slip.student?.firstName} {slip.student?.lastName}</div>
                                            <div className="text-sm font-bold text-emerald-400 whitespace-nowrap">LKR {slip.amount.toLocaleString()}</div>
                                        </div>
                                        <div className="text-[10px] text-gray-500 mb-3">{new Date(slip.created_at).toLocaleString()}</div>
                                        
                                        {slip.remark && (
                                            <div className="text-[10px] text-amber-400 bg-amber-900/20 p-2 rounded mb-3 border border-amber-900/30">
                                                {slip.remark}
                                            </div>
                                        )}

                                        <div className="mt-auto">
                                            <button
                                                onClick={() => verifySingleSlip(slip)}
                                                disabled={isVerifying}
                                                className="w-full text-xs bg-transparent hover:bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 font-medium py-2 rounded flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Search size={14} /> AI Analyze
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {pendingSlips.length === 0 && (
                        <div className="text-center p-8 text-gray-500 flex flex-col items-center justify-center bg-gray-900/50 rounded-xl border border-gray-800">
                            <Activity size={32} className="mb-2 opacity-20" />
                            <span>No slips found in this category.</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
        </>
        )}

        {mainTab === 'vault' && (
        /* BOTTOM PANEL: BANK STATEMENT VAULT */
        <div className="lg:col-span-12 flex flex-col gap-6 mt-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg flex flex-col min-h-[300px]">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Database className="text-emerald-500 animate-pulse" size={20} /> Bank Statement Vault
                    </h2>
                    
                    <div className="flex items-center gap-2">
                      <button 
                          onClick={() => setShowManualTxnModal(true)}
                          className="flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 text-emerald-400 px-3 py-1.5 rounded-lg border border-gray-700 transition"
                      >
                          <Plus size={14} /> Manual Deposit
                      </button>
                      <button 
                          onClick={() => setShowNewMonthModal(true)}
                          className="flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg border border-gray-700 transition"
                      >
                          <Plus size={14} /> New Month
                      </button>
                    </div>
                </div>

                {/* Vault Folders */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
                    {businesses.map(biz => (
                        <div 
                            key={biz.id}
                            onClick={() => {
                                setSelectedFolder(biz.id);
                                fetchBatches(biz.id);
                                setSelectedBatch('');
                                setSelectedMonth('');
                            }}
                            className={`cursor-pointer rounded-xl border p-4 flex flex-col items-center justify-center gap-3 transition-all ${selectedFolder === biz.id ? 'bg-emerald-900/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800 hover:border-gray-600'}`}
                        >
                            {biz.logo ? (
                                <img 
                                    src={getImageUrl(biz.logo)} 
                                    alt={biz.name}
                                    className="w-16 h-16 object-contain rounded-lg bg-white p-1"
                                    onError={(e) => { e.target.src = '/logo.png'; }}
                                />
                            ) : (
                                <div className="w-16 h-16 rounded-lg bg-gray-700 flex items-center justify-center text-gray-400">
                                    <Database size={24} />
                                </div>
                            )}
                            <span className="text-sm font-bold text-center text-gray-200">{biz.name}</span>
                        </div>
                    ))}
                    {businesses.length === 0 && (
                        <div className="col-span-full text-center py-8 text-gray-500">No businesses configured in Content Hub.</div>
                    )}
                </div>

                {/* Batches (If Business Selected) */}
                {selectedFolder && (
                    <div className="flex flex-col gap-4 mb-6 p-4 bg-gray-800/30 rounded-xl border border-gray-800">
                        <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2 mb-2">
                            <FolderOpen size={16} className="text-emerald-400" /> Select Batch for Google Sheet Sync
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {batches.map(batch => (
                                <button 
                                    key={batch.id}
                                    onClick={() => {
                                        setSelectedBatch(batch.id);
                                    }}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${selectedBatch === batch.id ? 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}
                                >
                                    {batch.name}
                                </button>
                            ))}
                            {batches.length === 0 && (
                                <div className="col-span-full text-xs text-gray-500 py-2">No batches found for this business.</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Google Sheet Link Input */}
                {selectedFolder && selectedBatch && (
                    <div className="bg-gray-900/80 p-5 rounded-xl border border-emerald-900/50 shadow-inner flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-900/40 flex items-center justify-center border border-emerald-500/30 shrink-0">
                                <Database size={18} className="text-emerald-400" />
                            </div>
                            <div>
                                <h4 className="text-emerald-400 font-bold text-sm">Google Sheet Vault Link</h4>
                                <p className="text-[10px] text-gray-400">Link a Google Sheet (with 10 categories/tabs) for auto data sync and remarks filling.</p>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Paste Google Sheet URL here..." 
                                value={(gsheetTree[selectedFolder] && Array.isArray(gsheetTree[selectedFolder][selectedBatch]) ? gsheetTree[selectedFolder][selectedBatch][0] : gsheetTree[selectedFolder][selectedBatch]) || ''}
                                onChange={(e) => {
                                    const t = {...gsheetTree};
                                    if(!t[selectedFolder]) {
                                        t[selectedFolder] = {};
                                    } else {
                                        t[selectedFolder] = {...t[selectedFolder]};
                                    }
                                    
                                    // Extract sheet ID from url if full URL is pasted
                                    let sheetId = e.target.value.trim().replace(/\n/g, '');
                                    const match = sheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                                    if(match) sheetId = match[1];

                                    t[selectedFolder][selectedBatch] = [sheetId]; // Store as array for backend
                                    setGsheetTree(t);
                                }}
                                className="flex-1 bg-gray-950 border border-gray-700 focus:border-emerald-500 text-white text-sm rounded-lg px-4 py-2 outline-none transition"
                            />
                            <button 
                                onClick={async () => {
                                    await saveGsheetTree(gsheetTree);
                                    if(selectedBatch) fetchMonthTransactions(selectedBatch);
                                }} 
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2 rounded-lg transition shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                            >
                                Save Link
                            </button>
                        </div>
                        

                        
                        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center mb-4 w-full mt-4">
                            {/* Sheet Tabs */}
                            <div className="flex gap-2 overflow-x-auto custom-scrollbar flex-1">
                                {(() => {
                                    const sheets = [...new Set(statementTransactions.map(t => t._sheetName || 'Sheet1'))];
                                    if (sheets.length > 0 && !selectedSheetTab && statementTransactions.length > 0) {
                                        setTimeout(() => setSelectedSheetTab(sheets[0]), 0);
                                    }
                                    return sheets.map(sheet => (
                                        <button 
                                            key={sheet}
                                            onClick={() => setSelectedSheetTab(sheet)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-colors border ${selectedSheetTab === sheet ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white hover:bg-gray-700'}`}
                                        >
                                            <Database size={12} className="inline mr-1 mb-0.5" />{sheet}
                                        </button>
                                    ));
                                })()}
                            </div>

                            {/* Old Excel Import Fallback */}
                            <div className="flex items-center gap-2 shrink-0 bg-gray-900/50 p-1.5 rounded-lg border border-gray-800">
                                <span className="text-[10px] text-gray-500 uppercase tracking-widest px-2 font-bold">Fallback CSV</span>
                                <input type="file" id="bank-upload" accept=".csv, .xlsx, .xls" className="hidden" onChange={(e) => setStatementFile(e.target.files[0])} />
                                <label htmlFor="bank-upload" className="cursor-pointer text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-700 flex items-center gap-1 transition">
                                    <Upload size={12} /> {statementFile ? "Selected" : "Select"}
                                </label>
                                <button onClick={handleUploadStatement} disabled={!statementFile || isUploading} className={`text-[10px] px-2 py-1 rounded font-medium flex items-center gap-1 transition ${!statementFile ? 'bg-gray-800 text-gray-600' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
                                    {isUploading ? <Loader size={12} className="animate-spin" /> : "Import"}
                                </button>
                                <button onClick={handleClearTable} className="text-[10px] px-2 py-1 rounded font-medium bg-red-900/30 text-red-400 hover:bg-red-800/50 border border-red-900/50 transition">Clear Table</button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-gray-950/60 border border-gray-800 rounded-lg shadow-inner mt-4 min-h-[300px]">
                            <table className="w-full text-sm text-left text-gray-300">
                                <thead className="text-[10px] text-gray-400 bg-gray-900/90 uppercase tracking-widest sticky top-0 shadow-sm z-10 border-b border-gray-800">
                                    <tr>
                                        {statementHeaders.map((header, idx) => (
                                            <th key={idx} className="px-4 py-3">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {statementTransactions.filter(t => (t._sheetName || 'Sheet1') === selectedSheetTab).map((txn) => {
                                        const activeConf = banksConfig.find(b => b.bankName === selectedFolder) || {};
                                        const cCols = activeConf.customColumns || [];
                                        
                                        let parsedDesc = null;
                                        try { parsedDesc = JSON.parse(txn.description); } catch(e) {}

                                        return (
                                        <tr key={txn.id || Math.random()} className={`border-b border-gray-800/30 hover:bg-gray-800/50 transition-colors ${txn.isMatched ? 'opacity-50 bg-gray-900/40' : ''}`}>
                                            {statementHeaders.map((header, idx) => {
                                                const hLower = header.toLowerCase();
                                                const isStatus = hLower === 'status';
                                                
                                                if (isStatus) {
                                                    return (
                                                        <td key={idx} className="px-4 py-3">
                                                            {txn[header] === 'Verified' ? (
                                                                <span className="text-[10px] bg-emerald-900/30 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.1)]">Verified</span>
                                                            ) : (
                                                                <span className="text-[10px] bg-gray-800 text-gray-500 px-2 py-0.5 rounded border border-gray-700 tracking-wider">OPEN</span>
                                                            )}
                                                        </td>
                                                    );
                                                }

                                                return (
                                                    <td key={idx} className="px-4 py-3 max-w-[200px] truncate" title={txn[header] || '-'}>
                                                        {txn[header] || '-'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                        );
                                    })}
                                    {statementTransactions.filter(t => (t._sheetName || 'Sheet1') === selectedSheetTab).length === 0 && (
                                        <tr>
                                            <td colSpan="10" className="text-center py-12 text-gray-500 flex flex-col items-center justify-center">
                                                <Database size={24} className="mb-2 opacity-50" />
                                                <span className="text-sm">No records found in {selectedSheetTab || 'this sheet'}. Please ensure the correct sheet URL is saved above.</span>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
        )}

      {/* RESULTS SECTION */}{/* RESULTS SECTION */}


      {/* VERIFICATION ANIMATION OVERLAY - DIGITAL ARMY PLANNING BOARD */}
      {/* VERIFICATION ANIMATION OVERLAY - PREMIUM MILITARY HUD */}
      {isVerifying && currentVerifyingSlip && createPortal(
        <div className="fixed inset-0 z-[9999] bg-[#010603] text-emerald-500 font-mono overflow-hidden flex flex-col select-none">
          {/* Global Background Effects */}
          <div className="absolute inset-0 pointer-events-none opacity-20" style={{ 
            backgroundImage: 'linear-gradient(rgba(16, 185, 129, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.4) 1px, transparent 1px)', 
            backgroundSize: '30px 30px'
          }}></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.05)_0%,transparent_100%)] pointer-events-none"></div>

          {/* TOP HUD HEADER */}
          <div className="h-12 border-b border-emerald-900/60 flex justify-between items-center px-6 text-[10px] tracking-[0.2em] relative z-10 bg-[#020a05]/80 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-4">
              <span className="w-2 h-2 bg-red-500 animate-pulse rounded-full shadow-[0_0_8px_#ef4444]"></span>
              <span>SYS.DEF.NODE // 0x4A9</span>
              <span className="px-2 py-0.5 border border-emerald-800 bg-emerald-950/50 text-emerald-400">ACTIVE</span>
            </div>
            <div className="text-emerald-300 font-bold tracking-[0.4em] text-xs overflow-hidden px-2 py-1">
              <span className="animate-glitch" data-text="TACTICAL VERIFICATION PROTOCOL">TACTICAL VERIFICATION PROTOCOL</span>
            </div>
            <div className="flex items-center gap-4 text-emerald-600">
              <span>SAT-LINK: SECURE</span>
              <span>ENC: AES-256-GCM</span>
              <button 
                onClick={() => {
                  setIsVerifying(false);
                  setCurrentVerifyingSlip(null);
                  setAnimStep(0);
                }}
                className="ml-2 px-3 py-1 bg-red-950/80 hover:bg-red-900 text-red-400 border border-red-800/80 rounded text-xs font-bold transition-all cursor-pointer z-50 flex items-center gap-1"
              >
                <X size={14} /> ABORT / CLOSE
              </button>
            </div>
          </div>

          {/* MAIN GRID */}
          <div className="flex-1 grid grid-cols-12 gap-6 p-6 relative z-10">
            
            {/* LEFT COL: TARGET INTEL */}
            <div className="col-span-3 flex flex-col gap-6">
              {/* TARGET ID PANEL */}
              <div className="h-24 border border-emerald-900/50 bg-[#030d07]/60 p-4 relative">
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-emerald-400"></div>
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-emerald-400"></div>
                <div className="text-[9px] text-emerald-600 mb-2">TARGET CLASSIFICATION</div>
                <div className="text-xl font-bold text-emerald-300 tracking-widest mb-1">SLIP_{currentVerifyingSlip.id.toString().padStart(6, '0')}</div>
                <div className="text-[10px] text-emerald-500/70">{currentVerifyingSlip.student?.firstName} {currentVerifyingSlip.student?.lastName} // AUTH_PENDING</div>
              </div>

              {/* IMAGE SCANNER PANEL */}
              <div className="flex-1 border border-emerald-800/40 bg-[#010804] relative p-1">
                {/* HUD Corner brackets */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-emerald-400 z-10"></div>
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-emerald-400 z-10"></div>
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-emerald-400 z-10"></div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-emerald-400 z-10"></div>

                <div className="absolute top-2 left-2 text-[8px] bg-black/60 px-1 border border-emerald-900 z-10">OPTICAL_SENSOR_01</div>
                <div className="absolute bottom-2 right-2 flex gap-1 z-10">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                  <span className="text-[8px]">REC</span>
                </div>

                <div className="w-full h-full relative overflow-hidden bg-black/80 flex items-center justify-center">
                  {currentVerifyingSlip.slip_image ? (
                      <img 
                        src={
                          import.meta.env.VITE_API_URL
                            ? import.meta.env.VITE_API_URL.replace('/api', '') + `/api/storage/documents/${currentVerifyingSlip.slip_image.split(',')[0]}`
                            : (window.location.protocol === 'https:' ? `https://${window.location.hostname}` : `http://${window.location.hostname}:5000`) + `/api/storage/documents/${currentVerifyingSlip.slip_image.split(',')[0]}`
                        } 
                        alt="slip" 
                        className={`w-[75%] h-[75%] object-contain filter ${animStep === 1 ? 'contrast-150 brightness-110 sepia-[0.3] hue-rotate-15' : 'grayscale brightness-50'}`} 
                      />
                  ) : (
                      <FileText size={40} className="text-gray-800" />
                  )}
                  
                  {/* Scanline */}
                  {animStep >= 1 && animStep < 4 && (
                      <div className="absolute left-0 w-full h-[20px] bg-gradient-to-b from-transparent via-emerald-400/80 to-transparent animate-[cyberScan_2s_linear_infinite] mix-blend-screen shadow-[0_0_20px_rgba(16,185,129,0.8)]"></div>
                  )}
                  
                  {/* Crosshairs */}
                  {animStep === 1 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-[80%] h-[80%] border border-emerald-500/20 rounded-full relative animate-[spin_10s_linear_infinite]">
                              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full bg-emerald-500/20"></div>
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[1px] bg-emerald-500/20"></div>
                          </div>
                          <div className="absolute w-24 h-24 border-2 border-emerald-400/60 rounded-full"></div>
                          <div className="absolute w-1 h-1 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_red]"></div>
                      </div>
                  )}

                  {/* Processing Grid Matrix */}
                  {animStep >= 1 && animStep < 4 && (
                      <div className="absolute inset-0 pointer-events-none p-4 grid grid-cols-6 grid-rows-6 gap-2 opacity-30 mix-blend-screen">
                          {[...Array(36)].map((_, i) => (
                              <div key={i} className={`border border-emerald-500/20 ${Math.random() > 0.7 ? 'bg-emerald-500/10 animate-pulse' : ''}`} style={{animationDelay: `${Math.random() * 2}s`, animationDuration: `${Math.random() * 0.5 + 0.5}s`}}></div>
                          ))}
                      </div>
                  )}
                </div>
              </div>

              {/* OCR DECODE PANEL */}
              <div className="h-40 border border-emerald-900/50 bg-[#030d07]/60 p-3 overflow-hidden relative">
                <div className="text-[8px] text-emerald-700 border-b border-emerald-900/50 mb-2 pb-1">DECRYPTED_PAYLOAD</div>
                <div className="font-mono text-[9px] text-emerald-500/80 leading-relaxed">
                  {animStep >= 1 ? (
                    <>
                      <div className="animate-[typeWriter_0.5s_steps(40,end)_forwards] overflow-hidden whitespace-nowrap">0x00A1: INIT NEURAL_NET_V9</div>
                      <div className="animate-[typeWriter_0.5s_steps(40,end)_0.2s_forwards] overflow-hidden whitespace-nowrap opacity-0">0x00A2: EXTRACTING VALUES...</div>
                      {animStep >= 2 && (
                        <>
                          <div className="animate-[typeWriter_0.5s_steps(40,end)_forwards] overflow-hidden whitespace-nowrap text-emerald-300">0x00A3: FOUND [LKR {currentVerifyingSlip.amount}]</div>
                          <div className="animate-[typeWriter_0.5s_steps(40,end)_0.2s_forwards] overflow-hidden whitespace-nowrap">0x00A4: UPLINKING TO MAINFRAME...</div>
                        </>
                      )}
                      {animStep >= 3 && (
                        <div className="animate-[typeWriter_0.5s_steps(40,end)_forwards] overflow-hidden whitespace-nowrap text-emerald-300">0x00A5: RUNNING MATCH ALGORITHM</div>
                      )}
                      {animStep >= 4 && (
                        <div className="animate-[typeWriter_0.5s_steps(40,end)_forwards] overflow-hidden whitespace-nowrap text-white font-bold bg-emerald-600/30">0x00A6: MATCH SECURED.</div>
                      )}
                      
                      {/* Random Matrix Code falling */}
                      <div className="absolute bottom-2 right-2 text-[8px] opacity-40 text-right animate-[matrixFade_1s_infinite_alternate]">
                        E8 2F A1 44<br/>1B 9C 00 F2
                      </div>
                    </>
                  ) : (
                    <div className="animate-pulse">AWAITING INTEL...</div>
                  )}
                </div>
              </div>
            </div>

            {/* CENTER COL: RADAR & MAIN STATS */}
            <div className="col-span-6 flex flex-col items-center justify-center relative border border-emerald-900/30 bg-[#020603]/80 p-6 overflow-hidden">
              {/* Decorative Center HUD markings */}
              <div className="absolute top-4 left-4 text-[8px] text-emerald-700">AZIMUTH: 144.2<br/>ELEV: -12.4</div>
              <div className="absolute bottom-4 right-4 text-[8px] text-emerald-700 text-right">FREQ: 840.2 MHz<br/>BAND: X-RAY</div>

              {/* HACKING TERMINAL ENGINE */}
              <div className="relative w-full h-[600px] flex bg-black/80 border border-emerald-900/50 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)]">
                  {/* Left: Terminal Output */}
                  <div className="flex-1 flex flex-col p-4 border-r border-emerald-900/50 relative">
                      <div className="flex justify-between items-center border-b border-emerald-900/50 pb-2 mb-2">
                         <span className="text-emerald-400 font-bold text-xs">root@ima-core:~# verify_protocol.sh</span>
                         <span className="text-emerald-700 text-[10px] animate-pulse">PID: 4992</span>
                      </div>
                      
                      <div className="flex-1 overflow-hidden relative font-mono text-[10px] text-emerald-500/80 leading-relaxed">
                         <div className={`absolute bottom-0 w-full flex flex-col justify-end ${animStep >= 2 ? 'animate-[slideUpLogs_20s_linear_infinite]' : ''}`}>
                            <div className="opacity-80 space-y-0.5">
                                {[...Array(animStep >= 2 ? 60 : 10)].map((_, i) => {
                                  const cmds = [
                                    'INIT NEURAL_NET_V9', 'BYPASSING SECURITY PROTOCOLS... [OK]', 'EXTRACTING IMAGE BLOCKS...', 
                                    'OPTICAL RECOGNITION ACTIVE', 'PARSING PIXEL DATA...', 'RUNNING AI MODELS...', 
                                    'DECRYPTING PAYLOAD...', 'UPLINKING TO CLUSTER NODE 4...', 'INJECTING FRAGMENTS...', 'DB SYNC IN PROGRESS...',
                                    'BUFFER OVERFLOW...', 'RE-ROUTING IP CHANNELS...', 'CRACKING HASH KEYS...', 'ACCESSING MAINFRAME DB...',
                                    'SCANNING SECTOR 7G...', 'ALLOCATING MEMORY POOL...', 'DUMPING CORE LOGS...', 'OVERRIDING FIREWALL...',
                                    'ESTABLISHING SECURE SSH...', 'VALIDATING CHECK_SUM...'
                                  ];
                                  const txt = cmds[i % cmds.length];
                                  const hex = (Math.random() * 0xFFFFFF << 0).toString(16).padStart(6, '0').toUpperCase();
                                  return (
                                   <div key={i} className={`whitespace-nowrap overflow-hidden ${animStep > 1 && i % 4 === 0 ? 'animate-pulse text-emerald-300' : ''} ${i > 5 && animStep === 1 ? 'hidden' : ''}`}>
                                      {`[${hex}] 0x${(i * 16).toString(16).padStart(4,'0').toUpperCase()}: ${txt} `}
                                      {animStep >= 2 && <span className="opacity-50 ml-2">{Math.random().toString(36).substring(2, 10).toUpperCase()}</span>}
                                   </div>
                                )})}
                                {animStep >= 2 && (
                                   <div className="text-emerald-400 mt-1">&gt; INITIATING ALGORITHM MATCHING...</div>
                                )}
                                {animStep >= 3 && (
                                   <div className="text-red-400 mt-1">&gt; SEARCHING DATABASE...</div>
                                )}
                                {animStep === 4 && (
                                   <div className="text-emerald-300 mt-1 font-bold">&gt; VERIFICATION COMPLETE.</div>
                                )}
                            </div>
                         </div>
                      </div>

                      {/* Progress bar at bottom of terminal */}
                      <div className="mt-3 pt-2 border-t border-emerald-900/50">
                         <div className="flex justify-between text-[8px] mb-1 text-emerald-500 font-bold">
                            <span>SYS_LOAD</span>
                            <span>{animStep === 1 ? '34%' : animStep === 2 ? '67%' : animStep === 3 ? '89%' : '100%'}</span>
                         </div>
                         <div className="w-full h-1.5 bg-emerald-950 rounded-full overflow-hidden shadow-[inset_0_0_5px_rgba(0,0,0,1)]">
                            <div className={`h-full bg-emerald-500 transition-all duration-700 ease-in-out ${animStep === 1 ? 'w-1/3 shadow-[0_0_10px_#10b981]' : animStep === 2 ? 'w-2/3 shadow-[0_0_10px_#10b981]' : animStep === 3 ? 'w-[90%] shadow-[0_0_10px_#10b981]' : 'w-full shadow-[0_0_15px_#10b981]'}`}></div>
                         </div>
                      </div>
                  </div>

                  {/* Right: Engine Gears */}
                  <div className="w-32 flex flex-col items-center justify-center relative bg-emerald-950/20 p-2">
                     <div className="absolute top-2 text-[8px] text-emerald-700 tracking-widest font-bold">ENGINE_CORE</div>
                     
                     <div className="relative mt-4">
                        <Settings size={56} className="text-emerald-500 animate-[spin_4s_linear_infinite] drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <Settings size={40} className="text-emerald-400 animate-[spin_3s_linear_infinite_reverse] absolute -top-4 -right-4 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                     </div>
                     
                     {/* Status text */}
                     <div className="mt-6 flex flex-col items-center justify-center bg-[#020603]/90 w-full py-3 rounded border border-emerald-900/60 shadow-[0_0_15px_rgba(0,0,0,0.8)] relative overflow-hidden">
                       <div className="absolute top-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>
                       {animStep === 1 && <><Activity className="text-emerald-500 animate-pulse mb-1" size={20}/><span className="text-[9px] tracking-widest text-emerald-400 font-bold">EXTRACTING</span></>}
                       {animStep === 2 && <><Database className="text-emerald-400 animate-pulse mb-1" size={20}/><span className="text-[9px] tracking-widest text-emerald-300 font-bold">UPLINKING</span></>}
                       {animStep === 3 && <><Search className="text-red-400 animate-[spin_2s_linear_infinite] mb-1" size={20}/><span className="text-[9px] tracking-widest text-red-400 font-bold">TARGETING</span></>}
                       {animStep === 4 && <><CheckCircle className="text-emerald-400 mb-1 drop-shadow-[0_0_8px_#34d399]" size={20}/><span className="text-[9px] tracking-widest text-emerald-950 font-bold bg-emerald-400 px-2 py-0.5 rounded shadow-[0_0_10px_#34d399]">VERIFIED</span></>}
                     </div>
                  </div>
              </div>

              {/* BOTTOM CHARTS (Fake Telemetry) */}
              <div className="absolute bottom-6 left-6 right-6 h-20 border-t border-emerald-900/60 pt-3 flex gap-6">
                  <div className="flex-1 flex flex-col justify-end gap-0.5 opacity-60">
                      <div className="text-[8px] text-emerald-600 mb-1">CONFIDENCE MATRIX</div>
                      <div className="flex items-end h-full gap-[2px]">
                          {[...Array(30)].map((_, i) => (
                              <div key={i} className="flex-1 bg-emerald-500/40 transition-all duration-300" style={{ height: `${animStep >= 3 ? (Math.sin(i) * 30 + 60) : (Math.random() * 40 + 10)}%` }}></div>
                          ))}
                      </div>
                  </div>
                  <div className="w-40 flex flex-col justify-end opacity-60">
                      <div className="text-[8px] text-emerald-600 mb-1">NETWORK STABILITY</div>
                      <svg className="w-full h-10" viewBox="0 0 100 40" preserveAspectRatio="none">
                          <polyline points={animStep >= 2 ? "0,20 10,10 20,30 30,15 40,25 50,5 60,35 70,20 80,10 90,25 100,15" : "0,35 10,35 20,35 30,35 40,35 50,35"} fill="none" stroke="#10b981" strokeWidth="1" className="animate-pulse" />
                      </svg>
                  </div>
              </div>
            </div>

            {/* RIGHT COL: DATABASE & LOGS */}
            <div className="col-span-3 flex flex-col gap-6">
              
              {/* SECTOR GRID DB TABLE */}
              <div className="flex-1 border border-emerald-900/50 bg-[#030d07]/60 flex flex-col overflow-hidden relative">
                  <div className="h-8 border-b border-emerald-900/50 bg-emerald-950/30 flex items-center justify-between px-3 text-[9px] text-emerald-500 tracking-widest">
                      <span>MAINFRAME DB SCAN</span>
                      <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div> LIVE</span>
                  </div>
                  
                  <div className="flex-1 p-3 flex flex-col gap-2 justify-center relative z-10">
                      {[1,2,3,4,5,6].map(i => {
                          const isMatchRow = animStep >= 3 && i === 3;
                          const isScanningRow = animStep === 2 && i === Math.floor(Date.now() / 100) % 6 + 1;
                          return (
                          <div key={i} className={`h-10 rounded-sm px-3 flex items-center justify-between font-mono text-[9px] transition-all duration-200 border-l-2 ${
                              isMatchRow ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-[inset_0_0_20px_rgba(16,185,129,0.3)] z-20 scale-105' : 
                              isScanningRow ? 'bg-emerald-900/40 text-emerald-300 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 
                              'bg-black/40 text-emerald-700 border-emerald-900 hover:bg-emerald-950/20'
                          }`}>
                              <div className="flex flex-col">
                                  <span className={`${isMatchRow ? 'font-bold text-emerald-300 tracking-wider' : ''}`}>
                                      {isMatchRow ? '>> TARGET_LOCKED <<' : `REF_${10000 + i * 821}`}
                                  </span>
                                  <span className="text-[7px] text-emerald-600">{selectedMonth.toUpperCase()} SCTOR_{i}</span>
                              </div>
                              <div className="flex flex-col items-end">
                                  <span className={`${isMatchRow ? 'text-white text-xs font-bold' : ''}`}>
                                      {isMatchRow ? 'LKR ' + currentVerifyingSlip.amount.toLocaleString() : 'LKR ' + (Math.random() * 10000).toFixed(0)}
                                  </span>
                                  <span className={`text-[7px] tracking-widest ${
                                      isMatchRow ? 'text-emerald-400 animate-pulse' : 
                                      isScanningRow ? 'text-yellow-400' : 'text-emerald-800'
                                  }`}>
                                      {isMatchRow ? '[ SECURED ]' : isScanningRow ? 'SCANNING' : 'WAITING'}
                                  </span>
                              </div>
                          </div>
                      )})}
                  </div>
              </div>

              {/* SYSTEM LOGS TERMINAL */}
              <div className="h-48 border border-emerald-900/50 bg-[#010804] p-3 relative font-mono text-[8px] leading-relaxed overflow-hidden">
                  <div className="absolute top-0 right-0 px-2 py-0.5 bg-emerald-950 border-b border-l border-emerald-900/50 text-emerald-600">SYS_LOGS</div>
                  <div className="text-emerald-600 mb-1 border-b border-emerald-900/30 pb-1">KERNEL STDOUT &gt;</div>
                  <div className="text-emerald-400/70 space-y-1">
                      {animStep >= 1 && <div className="animate-[slideIn_0.3s_ease-out]">&gt; Booting tactical interface... OK</div>}
                      {animStep >= 1 && <div className="animate-[slideIn_0.3s_ease-out_0.2s_both]">&gt; Loading Neural Core v9.4... OK</div>}
                      {animStep >= 2 && <div className="animate-[slideIn_0.3s_ease-out]">&gt; Initiating encrypted handshake...</div>}
                      {animStep >= 2 && <div className="animate-[slideIn_0.3s_ease-out_0.2s_both] text-yellow-400">&gt; WARNING: High traffic detected on node.</div>}
                      {animStep >= 2 && <div className="animate-[slideIn_0.3s_ease-out_0.4s_both]">&gt; Bypassing firewall proxy... SUCCESS</div>}
                      {animStep >= 3 && <div className="animate-[slideIn_0.3s_ease-out]">&gt; Executing DeepMatch algo... RUNNING</div>}
                      {animStep >= 3 && <div className="animate-[slideIn_0.3s_ease-out_0.3s_both] text-emerald-300">&gt; Pattern identified in sector 3.</div>}
                      {animStep >= 4 && <div className="animate-[slideIn_0.3s_ease-out] font-bold text-white bg-emerald-600/30">&gt; MISSION ACCOMPLISHED. SYSTEM OVERRIDE.</div>}
                  </div>
                  {animStep < 4 && <div className="w-2 h-3 bg-emerald-500 mt-1 animate-pulse"></div>}
              </div>
            </div>
          </div>
          
          <style>{`
            @keyframes cyberScan { 0% { top: -20px; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
            @keyframes gridMove { 0% { background-position: 0 0; } 100% { background-position: 0 30px; } }
            @keyframes typeWriter { from { width: 0; opacity: 1; } to { width: 100%; opacity: 1; } }
            @keyframes slideIn { from { transform: translateX(-10px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes slideUpLogs { 0% { transform: translateY(100%); } 100% { transform: translateY(-50%); } }
            @keyframes matrixFade { 0% { opacity: 0.1; } 100% { opacity: 0.5; } }
            .animate-glitch { position: relative; }
            .animate-glitch::before, .animate-glitch::after { content: attr(data-text); position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
            .animate-glitch::before { left: 2px; text-shadow: -1px 0 red; clip: rect(24px, 550px, 90px, 0); animation: glitch-anim-2 3s infinite linear alternate-reverse; }
            .animate-glitch::after { left: -2px; text-shadow: -1px 0 blue; clip: rect(85px, 550px, 140px, 0); animation: glitch-anim 2.5s infinite linear alternate-reverse; }
            @keyframes glitch-anim { 0% { clip: rect(66px, 9999px, 83px, 0); } 5% { clip: rect(100px, 9999px, 4px, 0); } 10% { clip: rect(85px, 9999px, 84px, 0); } 15% { clip: rect(27px, 9999px, 2px, 0); } 20% { clip: rect(31px, 9999px, 86px, 0); } 25% { clip: rect(100px, 9999px, 42px, 0); } 30% { clip: rect(34px, 9999px, 84px, 0); } 35% { clip: rect(14px, 9999px, 14px, 0); } 40% { clip: rect(23px, 9999px, 77px, 0); } 45% { clip: rect(81px, 9999px, 64px, 0); } 50% { clip: rect(8px, 9999px, 60px, 0); } 55% { clip: rect(93px, 9999px, 58px, 0); } 60% { clip: rect(6px, 9999px, 98px, 0); } 65% { clip: rect(3px, 9999px, 7px, 0); } 70% { clip: rect(41px, 9999px, 66px, 0); } 75% { clip: rect(16px, 9999px, 74px, 0); } 80% { clip: rect(15px, 9999px, 41px, 0); } 85% { clip: rect(15px, 9999px, 85px, 0); } 90% { clip: rect(63px, 9999px, 55px, 0); } 95% { clip: rect(4px, 9999px, 12px, 0); } 100% { clip: rect(11px, 9999px, 32px, 0); } }
            @keyframes glitch-anim-2 { 0% { clip: rect(47px, 9999px, 76px, 0); } 5% { clip: rect(60px, 9999px, 12px, 0); } 10% { clip: rect(11px, 9999px, 50px, 0); } 15% { clip: rect(69px, 9999px, 77px, 0); } 20% { clip: rect(22px, 9999px, 30px, 0); } 25% { clip: rect(39px, 9999px, 40px, 0); } 30% { clip: rect(67px, 9999px, 40px, 0); } 35% { clip: rect(83px, 9999px, 45px, 0); } 40% { clip: rect(87px, 9999px, 81px, 0); } 45% { clip: rect(42px, 9999px, 86px, 0); } 50% { clip: rect(39px, 9999px, 9px, 0); } 55% { clip: rect(34px, 9999px, 39px, 0); } 60% { clip: rect(25px, 9999px, 5px, 0); } 65% { clip: rect(74px, 9999px, 20px, 0); } 70% { clip: rect(76px, 9999px, 74px, 0); } 75% { clip: rect(84px, 9999px, 48px, 0); } 80% { clip: rect(60px, 9999px, 80px, 0); } 85% { clip: rect(17px, 9999px, 93px, 0); } 90% { clip: rect(49px, 9999px, 39px, 0); } 95% { clip: rect(76px, 9999px, 23px, 0); } 100% { clip: rect(11px, 9999px, 12px, 0); } }
          `}</style>
        </div>, document.body
      )}


      {/* NEW MONTH MODAL */}
      {showNewMonthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 p-6 rounded-2xl w-full max-w-md shadow-2xl">
                <h3 className="text-lg font-bold text-white mb-4">Create New Statement Month</h3>
                <input 
                    type="text" 
                    placeholder="e.g. June 2026"
                    value={newMonthName}
                    onChange={(e) => setNewMonthName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 mb-4 focus:border-emerald-500 outline-none"
                />
                <div className="flex gap-3 justify-end">
                    <button onClick={() => setShowNewMonthModal(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:text-white">Cancel</button>
                    <button onClick={handleCreateMonth} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium">Create</button>
                </div>
            </div>
        </div>
      )}

      {/* MANUAL TRANSACTION MODAL */}
      {showManualTxnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 p-6 rounded-2xl w-full max-w-md shadow-2xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Database className="text-emerald-500" size={20} /> Add Manual Transaction
                </h3>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-gray-400 text-xs font-medium mb-1">Transaction Date</label>
                    <input 
                      type="date"
                      value={manualTxnDate}
                      onChange={(e) => setManualTxnDate(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs font-medium mb-1">Description (e.g. Txn Reference ID / Name)</label>
                    <input 
                      type="text"
                      placeholder="e.g. FT123456789 - Dilshan"
                      value={manualTxnDesc}
                      onChange={(e) => setManualTxnDesc(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs font-medium mb-1">Amount (LKR)</label>
                    <input 
                      type="number"
                      placeholder="e.g. 5000"
                      value={manualTxnAmount}
                      onChange={(e) => setManualTxnAmount(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                    <button onClick={() => setShowManualTxnModal(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:text-white">Cancel</button>
                    <button onClick={handleAddManualTransaction} disabled={isAddingManualTxn} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-2">
                        {isAddingManualTxn && <Loader className="animate-spin" size={14} />} Add Record
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* SETTINGS AUTH MODAL */}
      {showSettingsAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-gray-900 border border-emerald-950 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                <div className="flex items-center gap-3 text-emerald-400 mb-4">
                    <Lock size={24} />
                    <h3 className="text-lg font-bold">Security Override</h3>
                </div>
                <p className="text-gray-400 text-xs mb-4">Please enter the security PIN to configure AI core settings.</p>
                <input 
                    type="password" 
                    placeholder="Enter Security PIN"
                    value={settingsPassword}
                    onChange={(e) => setSettingsPassword(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 mb-4 focus:border-emerald-500 outline-none text-center tracking-widest font-mono"
                    onKeyDown={(e) => e.key === 'Enter' && handleAuthSettings()}
                />
                <div className="flex gap-3 justify-end">
                    <button onClick={() => setShowSettingsAuth(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:text-white">Cancel</button>
                    <button onClick={handleAuthSettings} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium">Authenticate</button>
                </div>
            </div>
        </div>
      )}

      {/* PREMIUM CONTROL PANEL MODAL */}
      {showSettings && isAuthenticatedSettings && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md">
            <div className="bg-[#09090b] border border-blue-900/50 shadow-[0_0_50px_rgba(59,130,246,0.15)] rounded-3xl w-[98vw] max-w-[1600px] h-[95vh] flex flex-col md:flex-row overflow-hidden relative">
                
                {/* Background ambient glow */}
                <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none"></div>

                {/* Sidebar */}
                <div className="w-full md:w-64 bg-black/50 border-r border-gray-800/80 p-6 flex flex-col z-10 shrink-0">
                    <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 flex items-center gap-2 mb-8">
                      <Settings className="text-blue-500"/> AI Engine
                    </h3>
                    
                    <div className="flex-1 space-y-2">
                        <button 
                            onClick={() => setActiveSettingsTab('banks')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium ${activeSettingsTab === 'banks' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
                        >
                            <Database size={18} /> Bank Profiles
                        </button>
                        <button 
                            onClick={() => setActiveSettingsTab('core')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium ${activeSettingsTab === 'core' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
                        >
                            <KeyRound size={18} /> Core Settings
                        </button>
                    </div>

                    <button onClick={() => { setShowSettings(false); setIsAuthenticatedSettings(false); }} className="mt-auto flex items-center justify-center gap-2 w-full py-3 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/50 transition">
                        <XCircle size={18}/> Close Panel
                    </button>
                </div>
                
                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar z-10 flex flex-col">
                    
                    {/* --- TAB: BANK PROFILES --- */}
                    {activeSettingsTab === 'banks' && (
                        <div className="animation-fade-in space-y-6 flex-1">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-white">Bank & Slip Profiles</h2>
                                <p className="text-gray-400 text-sm">Configure extraction rules and reference images for different banking institutions.</p>
                            </div>
                            
                            <div className="bg-black/30 border border-emerald-900/30 rounded-2xl p-6 shadow-lg">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                                  
                                  {/* Sidebar Banks list */}
                                  <div className="md:col-span-1 border-r border-gray-800 pr-4 flex flex-col gap-2">
                                    <div className="text-xs font-semibold text-gray-500 mb-1">Banks List</div>
                                    {banksConfig.map((bank, idx) => (
                                      <div 
                                        key={idx} 
                                        onClick={() => setSelectedConfigBankIndex(idx)}
                                        className={`p-3 rounded-lg flex justify-between items-center cursor-pointer transition-colors ${selectedConfigBankIndex === idx ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40' : 'bg-gray-800/40 hover:bg-gray-800 text-gray-400'}`}
                                      >
                                        <span className="font-medium truncate">{bank.bankName}</span>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleDeleteBank(idx); }}
                                          className="text-gray-500 hover:text-red-400 p-1"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    ))}
                                    
                                    <div className="mt-4 flex gap-2">
                                      <input 
                                        type="text"
                                        placeholder="Bank Name"
                                        value={newBankName}
                                        onChange={(e) => setNewBankName(e.target.value)}
                                        className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1.5 outline-none focus:border-emerald-500 flex-1 min-w-0"
                                      />
                                      <button 
                                        onClick={handleAddBank}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded transition"
                                      >
                                        <Plus size={14} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Selected Bank Details */}
                                  <div className="md:col-span-3 space-y-4">
                                    {banksConfig[selectedConfigBankIndex] ? (
                                      <div>
                                        <div className="flex justify-between items-center border-b border-gray-800 pb-2 mb-4">
                                          <span className="text-white font-semibold text-base">{banksConfig[selectedConfigBankIndex].bankName} Configurations</span>
                                          <button
                                            onClick={() => handleAddSlipType(selectedConfigBankIndex)}
                                            className="text-xs bg-gray-800 hover:bg-gray-700 text-emerald-400 border border-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                                          >
                                            <Plus size={14} /> Add Slip Type
                                          </button>
                                        </div>

                                        {/* Excel Template Settings */}
                                        <div className="bg-blue-900/10 border border-blue-900/30 rounded-xl p-4 mb-6">
                                            <h3 className="text-blue-400 text-sm font-bold mb-3 flex items-center gap-2"><Database size={16}/> Excel Import Template Mapping</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                                <div>
                                                    <label className="text-xs text-gray-400 font-semibold mb-1.5 block">Date Column <span className="text-red-500">*</span></label>
                                                    <input 
                                                        type="text" 
                                                        value={banksConfig[selectedConfigBankIndex].excelDateCol || ''}
                                                        onChange={(e) => {
                                                            const newConfig = [...banksConfig];
                                                            newConfig[selectedConfigBankIndex] = { ...newConfig[selectedConfigBankIndex], excelDateCol: e.target.value };
                                                            setBanksConfig(newConfig);
                                                        }}
                                                        placeholder="e.g. Txn Date"
                                                        className="w-full bg-gray-900/80 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:border-blue-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-emerald-400 font-semibold mb-1.5 block">Amount Column <span className="text-red-500">*</span></label>
                                                    <input 
                                                        type="text" 
                                                        value={banksConfig[selectedConfigBankIndex].excelAmountCol || ''}
                                                        onChange={(e) => {
                                                            const newConfig = [...banksConfig];
                                                            newConfig[selectedConfigBankIndex] = { ...newConfig[selectedConfigBankIndex], excelAmountCol: e.target.value };
                                                            setBanksConfig(newConfig);
                                                        }}
                                                        placeholder="e.g. Credit"
                                                        className="w-full bg-gray-900/80 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:border-emerald-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 font-semibold mb-1.5 block">DR/CR Column (Optional)</label>
                                                    <input 
                                                        type="text" 
                                                        value={banksConfig[selectedConfigBankIndex].excelDrCrCol || ''}
                                                        onChange={(e) => {
                                                            const newConfig = [...banksConfig];
                                                            newConfig[selectedConfigBankIndex] = { ...newConfig[selectedConfigBankIndex], excelDrCrCol: e.target.value };
                                                            setBanksConfig(newConfig);
                                                        }}
                                                        placeholder="e.g. CR/DR"
                                                        className="w-full bg-gray-900/80 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:border-blue-500 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            {/* Dynamic Custom Columns */}
                                            <div className="border-t border-blue-900/30 pt-4 mt-4">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h4 className="text-gray-300 text-xs font-semibold">Custom Middle Columns</h4>
                                                    <button 
                                                        onClick={() => handleAddCustomColumn(selectedConfigBankIndex)}
                                                        className="text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 px-2 py-1 rounded transition"
                                                    >+ Add Column</button>
                                                </div>
                                                <div className="space-y-2">
                                                    {banksConfig[selectedConfigBankIndex].customColumns?.map((col, cIdx) => (
                                                        <div key={cIdx} className="flex items-center gap-3 bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                                                            <input 
                                                                type="text" 
                                                                value={col.name}
                                                                onChange={(e) => handleUpdateCustomColumn(selectedConfigBankIndex, cIdx, 'name', e.target.value)}
                                                                placeholder="Column Name in Excel (e.g. Reference)"
                                                                className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-1.5 focus:border-blue-500 outline-none"
                                                            />
                                                            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={col.isCurrency}
                                                                    onChange={(e) => handleUpdateCustomColumn(selectedConfigBankIndex, cIdx, 'isCurrency', e.target.checked)}
                                                                    className="rounded bg-gray-800 border-gray-700 text-blue-500 focus:ring-blue-500"
                                                                />
                                                                Is Price (Add Rs.)
                                                            </label>
                                                            <button 
                                                                onClick={() => handleRemoveCustomColumn(selectedConfigBankIndex, cIdx)}
                                                                className="text-red-400 hover:text-red-300 p-1"
                                                            ><XCircle size={14}/></button>
                                                        </div>
                                                    ))}
                                                    {(!banksConfig[selectedConfigBankIndex].customColumns || banksConfig[selectedConfigBankIndex].customColumns.length === 0) && (
                                                        <p className="text-[10px] text-gray-500 italic">No custom columns added. The table will only show Date, Amount, and Status.</p>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-gray-500 mt-2">Enter the exact column names as they appear in this bank's Excel statements. Leave empty to use auto-detection.</p>
                                        </div>

                                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                          {banksConfig[selectedConfigBankIndex].slips?.map((slip, sIdx) => (
                                            <div key={sIdx} className="bg-gray-800/30 border border-gray-800 rounded-xl p-4 flex flex-col gap-4">
                                              <div className="flex justify-between items-center">
                                                <input 
                                                  type="text"
                                                  value={slip.name}
                                                  onChange={(e) => handleUpdateSlipType(selectedConfigBankIndex, sIdx, 'name', e.target.value)}
                                                  className="bg-transparent border-b border-gray-700 text-white font-medium text-sm focus:border-emerald-500 outline-none pb-1"
                                                />
                                                <button 
                                                  onClick={() => handleDeleteSlipType(selectedConfigBankIndex, sIdx)}
                                                  className="text-gray-500 hover:text-red-400 text-xs flex items-center gap-1 border border-gray-800 hover:border-red-950 px-2 py-1 rounded"
                                                >
                                                  <Trash2 size={12} /> Remove
                                                </button>
                                              </div>

                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                
                                                {/* Slip Reference File */}
                                                <div className="space-y-2">
                                                  <div className="text-xs text-gray-500 font-semibold flex items-center gap-1"><Image size={12}/> Reference Image/PDF</div>
                                                  <div className="flex items-center gap-3">
                                                    {slip.mediaUrl ? (
                                                      <div className="w-16 h-20 rounded bg-black border border-gray-700 overflow-hidden relative group">
                                                        {slip.mediaUrl.toLowerCase().endsWith('.pdf') ? (
                                                          <div className="w-full h-full flex items-center justify-center text-[10px] text-red-500">PDF</div>
                                                        ) : (
                                                          <img 
                                                            src={
                                                              import.meta.env.VITE_API_URL
                                                                ? import.meta.env.VITE_API_URL.replace('/api', '') + `/api${slip.mediaUrl}`
                                                                : (window.location.protocol === 'https:' ? `https://${window.location.hostname}` : `http://${window.location.hostname}:5000`) + `/api${slip.mediaUrl}`
                                                            }
                                                            alt="Ref" 
                                                            className="w-full h-full object-cover" 
                                                          />
                                                        )}
                                                        <button 
                                                          onClick={() => handleUpdateSlipType(selectedConfigBankIndex, sIdx, 'mediaUrl', '')}
                                                          className="absolute inset-0 bg-red-900/80 text-white text-[10px] items-center justify-center hidden group-hover:flex"
                                                        >
                                                          Remove
                                                        </button>
                                                      </div>
                                                    ) : (
                                                      <div className="w-16 h-20 rounded bg-gray-900 border border-dashed border-gray-800 flex items-center justify-center text-gray-600"><FileText size={20}/></div>
                                                    )}
                                                    
                                                    <input 
                                                      type="file"
                                                      id={`ref-slip-upload-${sIdx}`}
                                                      className="hidden"
                                                      onChange={(e) => handleUploadRefSlipImage(selectedConfigBankIndex, sIdx, e.target.files[0])}
                                                    />
                                                    <label htmlFor={`ref-slip-upload-${sIdx}`} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded border border-gray-700 cursor-pointer flex items-center gap-1 transition">
                                                      <Upload size={12} /> Upload File
                                                    </label>
                                                  </div>
                                                </div>

                                                {/* Slip Extraction prompt */}
                                                <div className="space-y-2">
                                                  <div className="text-xs text-gray-500 font-semibold flex items-center gap-1"><Edit3 size={12}/> Extraction Fields / Prompts</div>
                                                  <textarea 
                                                    value={slip.rules}
                                                    onChange={(e) => handleUpdateSlipType(selectedConfigBankIndex, sIdx, 'rules', e.target.value)}
                                                    rows="6"
                                                    className="w-full bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-xl p-3 focus:border-emerald-500 outline-none font-mono"
                                                    placeholder="Write fields to extract (e.g. Sender Name, Branch)"
                                                  />
                                                </div>

                                              </div>
                                            </div>
                                          ))}
                                          {(!banksConfig[selectedConfigBankIndex].slips || banksConfig[selectedConfigBankIndex].slips.length === 0) && (
                                            <div className="text-center p-8 text-gray-500">No slip types configured for this bank yet. Click "Add Slip Type".</div>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-center p-8 text-gray-500">Add or select a bank from the list.</div>
                                    )}
                                  </div>

                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- TAB: CORE SETTINGS --- */}
                    {activeSettingsTab === 'core' && (
                        <div className="animation-fade-in space-y-8 flex-1">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-white">Core Engine Settings</h2>
                                <p className="text-gray-400 text-sm">Manage API keys and security pins.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Gemini Key Config */}
                                <div className="bg-black/30 border border-purple-900/30 rounded-2xl p-6 shadow-lg">
                                    <h4 className="text-base font-bold text-purple-400 flex items-center gap-2 mb-2"><Key className="text-purple-500" size={18} /> Gemini AI API Keys</h4>
                                    <p className="text-gray-500 text-xs mb-4">Enter multiple API keys separated by commas. The system will automatically fallback if one is busy.</p>
                                    <textarea 
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        className="w-full bg-gray-900/80 border border-gray-800 text-white rounded-xl px-4 py-3 focus:border-purple-500 outline-none font-mono text-xs shadow-inner transition custom-scrollbar"
                                        placeholder="AIzaSy..., AIzaSy..."
                                        rows="3"
                                    />
                                </div>
                                
                                {/* Change Security PIN */}
                                <div className="bg-black/30 border border-purple-900/30 rounded-2xl p-6 shadow-lg">
                                    <h4 className="text-base font-bold text-purple-400 flex items-center gap-2 mb-4"><KeyRound className="text-purple-500" size={18} /> Security PIN</h4>
                                    <div className="space-y-4">
                                      <input 
                                        type="password" 
                                        placeholder="Current PIN"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="w-full bg-gray-900/80 border border-gray-800 text-white rounded-xl px-4 py-2 focus:border-purple-500 outline-none text-sm font-mono text-center tracking-widest"
                                      />
                                      <div className="flex gap-2">
                                        <input 
                                          type="password" 
                                          placeholder="New PIN"
                                          value={newPassword}
                                          onChange={(e) => setNewPassword(e.target.value)}
                                          className="w-full bg-gray-900/80 border border-gray-800 text-white rounded-xl px-4 py-2 focus:border-purple-500 outline-none text-sm font-mono text-center tracking-widest"
                                        />
                                        <input 
                                          type="password" 
                                          placeholder="Confirm PIN"
                                          value={confirmPassword}
                                          onChange={(e) => setConfirmPassword(e.target.value)}
                                          className="w-full bg-gray-900/80 border border-gray-800 text-white rounded-xl px-4 py-2 focus:border-purple-500 outline-none text-sm font-mono text-center tracking-widest"
                                        />
                                        <button 
                                          onClick={handleChangePIN}
                                          className="bg-purple-600/80 hover:bg-purple-500 text-white px-4 py-2 rounded-xl transition text-sm font-medium"
                                        >
                                          Update
                                        </button>
                                      </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    

                    {activeSettingsTab !== 'chat' && (
                        <div className="mt-auto pt-6 border-t border-gray-800 flex justify-end gap-4">
                            <button onClick={handleSaveConfig} disabled={isSavingKey} className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-medium flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all">
                                {isSavingKey ? <Loader size={18} className="animate-spin"/> : <CheckCircle size={18}/>} Save Core Configuration
                            </button>
                        </div>
                    )}

                </div>
            </div>
            <style>{`
                .animation-fade-in {
                    animation: fadeIn 0.4s ease-out forwards;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>, document.body)}
    </div>
    </div>
  );
}
