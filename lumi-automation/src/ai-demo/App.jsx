import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Lock, FileSpreadsheet, Upload, CheckCircle, Clock, Search, ShieldCheck, UserPlus, FileUp, ScanLine, ImageIcon, Edit2, Trash2 } from 'lucide-react';
import StudentModal from './components/StudentModal';
import ScanningOverlay from './components/ScanningOverlay';
import VerificationHUD from './components/VerificationHUD';

const API_BASE = '/api';

function App() {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(localStorage.getItem('b2b_token'));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [students, setStudents] = useState([]);
  const [statements, setStatements] = useState([]);

  const [uploadingStatement, setUploadingStatement] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState(null);

  // Custom Student Modal state
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);

  // Bulk Verification State
  const [isBulkScanning, setIsBulkScanning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkResults, setBulkResults] = useState(null);

  // New State for Edit/Delete and Bulk Pending Verification
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [editPaymentData, setEditPaymentData] = useState({ extractedRefNo: '', extractedAmount: '', status: '' });
  const [isVerifyingPending, setIsVerifyingPending] = useState(false);

  // Advanced Verification HUD State
  const [pendingSlips, setPendingSlips] = useState([]);
  const [activeHUDSlipUrl, setActiveHUDSlipUrl] = useState(null);
  const [activeHUDResult, setActiveHUDResult] = useState(null);

  // Table State
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [tableCurrentPage, setTableCurrentPage] = useState(1);
  const [activeSheetTab, setActiveSheetTab] = useState('All');

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    try {
      const config = { headers: { 'x-api-password': token } };
      const [stuRes, stmtRes] = await Promise.all([
        axios.get(`${API_BASE}/students`, config),
        axios.get(`${API_BASE}/statements`, config)
      ]);
      setStudents(stuRes.data);
      setStatements(stmtRes.data);
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_BASE}/auth`, { password });
      if (res.data.success) {
        setToken(res.data.token);
        localStorage.setItem('b2b_token', res.data.token);
      }
    } catch (err) {
      setError('Invalid access key or backend offline');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('b2b_token');
  };

  const handleStatementUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingStatement(true);

    const formData = new FormData();
    formData.append('statement', file);

    try {
      await axios.post(`${API_BASE}/upload-statement`, formData, {
        headers: { 'x-api-password': token, 'Content-Type': 'multipart/form-data' }
      });
      fetchData();
    } catch (err) {
      alert('Error uploading statement');
    }
    setUploadingStatement(false);
  };

  const handleClearStatements = async () => {
    if (!window.confirm("Are you sure you want to clear all imported statements? This cannot be undone.")) return;
    try {
      await axios.delete(`${API_BASE}/statements`, {
        headers: { 'x-api-password': token }
      });
      fetchData();
      setActiveSheetTab('All');
    } catch (err) {
      alert('Error clearing statements');
    }
  };

  const handleSingleVerification = async (slipObj) => {
    const formData = new FormData();
    formData.append('slip', slipObj.file);
    formData.append('studentId', slipObj.studentId);

    try {
      setActiveHUDSlipUrl(slipObj.url);
      setActiveHUDResult(null);

      const res = await axios.post(`${API_BASE}/verify-slip`, formData, {
        headers: { 'x-api-password': token, 'Content-Type': 'multipart/form-data' }
      });
      setActiveHUDResult(res.data.payment || { status: 'REJECTED' });
      fetchData();
      return true;
    } catch (err) {
      setActiveHUDResult({ status: 'ERROR', extractedRefNo: 'N/A', extractedAmount: 0 });
      return false;
    }
  };

  const handleStudentSlipUpload = async (e, studentId) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('slip', file);
    formData.append('studentId', studentId);

    try {
      await axios.post(`${API_BASE}/upload-slip`, formData, {
        headers: { 'x-api-password': token, 'Content-Type': 'multipart/form-data' }
      });
      fetchData();
    } catch (err) {
      alert('Error uploading slip');
    }
    e.target.value = '';
  };

  const handleVerifyPayment = async (payment) => {
    try {
      setActiveHUDSlipUrl(payment.slipUrl);
      setActiveHUDResult(null);

      const res = await axios.post(`${API_BASE}/verify-payment/${payment.id}`, {}, {
        headers: { 'x-api-password': token }
      });
      setActiveHUDResult(res.data.payment || { status: 'REJECTED' });
      fetchData();
    } catch (err) {
      setActiveHUDResult({ status: 'ERROR', extractedRefNo: 'N/A', extractedAmount: 0 });
    }
  };

  const totalPendingPayments = students.reduce((acc, student) => acc + (student.payments?.filter(p => p.status === 'PENDING').length || 0), 0);

  const handleBulkProcess = async () => {
    // Left for legacy or replace with handleVerifyAllPending
    handleVerifyAllPending();
  };

  const handleEditPaymentStart = (p) => {
    setEditingPaymentId(p.id);
    setEditPaymentData({
      extractedRefNo: p.extractedRefNo || '',
      extractedAmount: p.extractedAmount || '',
      status: p.status
    });
  };

  const handleEditPaymentCancel = () => {
    setEditingPaymentId(null);
  };

  const handleEditPaymentSave = async (id) => {
    try {
      await axios.put(`${API_BASE}/payments/${id}`, editPaymentData, {
        headers: { 'x-api-password': token }
      });
      setEditingPaymentId(null);
      fetchData();
    } catch (err) {
      alert('Failed to update payment');
    }
  };

  const handleDeletePayment = async (id) => {
    if (!confirm('Are you sure you want to delete this slip?')) return;
    try {
      await axios.delete(`${API_BASE}/payments/${id}`, {
        headers: { 'x-api-password': token }
      });
      fetchData();
    } catch (err) {
      alert('Failed to delete payment');
    }
  };

  const handleVerifyAllPending = async () => {
    if (!confirm('Run AI verification on all pending slips? This may take some time.')) return;
    setIsBulkScanning(true);
    setBulkProgress(0);
    setBulkResults(null);
    try {
      let pendingPayments = [];
      students.forEach(student => {
        if (student.payments) {
          student.payments.forEach(p => {
            if (p.status === 'PENDING') pendingPayments.push(p.id);
          });
        }
      });

      let processed = 0;
      let verifiedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < pendingPayments.length; i++) {
        const id = pendingPayments[i];
        try {
          const res = await axios.post(`${API_BASE}/verify-payment/${id}`, {}, {
            headers: { 'x-api-password': token }
          });
          processed++;
          setBulkProgress(Math.round((processed / pendingPayments.length) * 100));

          if (res.data.payment && res.data.payment.status === 'VERIFIED') {
            verifiedCount++;
          } else {
            skippedCount++;
          }
        } catch (e) {
          console.error('Failed to verify payment id:', id, e);
          processed++;
          skippedCount++;
          setBulkProgress(Math.round((processed / pendingPayments.length) * 100));
        }
      }

      setBulkResults({ processed, verified: verifiedCount, skipped: skippedCount });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Error during bulk pending verification.');
      setIsBulkScanning(false);
    }
  };

  const handleManualVerify = async (paymentId, currentStatus) => {
    const remark = prompt("Enter remark for manual verification:");
    if (remark === null) return;

    try {
      await axios.post(`${API_BASE}/manual-verify`, {
        paymentId,
        status: currentStatus === 'VERIFIED' ? 'REJECTED' : 'VERIFIED',
        remark
      }, {
        headers: { 'x-api-password': token }
      });
      fetchData();
    } catch (err) {
      alert('Failed to update status manually.');
    }
  };

  const handleEditStudent = async (student, fieldToEdit = 'all') => {
    let newName = student.name;
    let newSubject = student.subject;
    let newFee = student.feeAmount;

    if (fieldToEdit === 'all' || fieldToEdit === 'name') {
      const pName = prompt("Edit Student Name:", student.name);
      if (pName !== null) newName = pName;
    }
    if (fieldToEdit === 'all' || fieldToEdit === 'subject') {
      const pSubj = prompt("Edit Subject:", student.subject);
      if (pSubj !== null) newSubject = pSubj;
    }
    if (fieldToEdit === 'all' || fieldToEdit === 'fee') {
      const pFee = prompt("Edit Fee Amount (Rs):", student.feeAmount);
      if (pFee !== null) newFee = pFee;
    }

    try {
      await axios.put(`${API_BASE}/students/${student.id}`, {
        name: newName,
        subject: newSubject,
        feeAmount: newFee
      }, {
        headers: { 'x-api-password': token }
      });
      fetchData();
    } catch (err) {
      alert('Failed to update student.');
    }
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const headers = ['Date', 'Ref No', 'Description', 'Amount', 'Student Name', 'Student ID', 'Phone Number', 'Subject', 'Status', 'Remarks'];

    // Group statements by sheetName
    const sheetsMap = {};
    enrichedStatements.forEach(s => {
      const sName = s.sheetName || 'Main';
      if (!sheetsMap[sName]) sheetsMap[sName] = [];
      sheetsMap[sName].push([
        s.date,
        s.referenceNo,
        s.description || '---',
        s.amount,
        s.studentName,
        s.studentId,
        s.studentPhone,
        s.subject,
        s.status,
        s.remark
      ]);
    });

    if (Object.keys(sheetsMap).length === 0) {
      // Add empty sheet if no data
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      XLSX.utils.book_append_sheet(wb, ws, "Main");
    } else {
      Object.keys(sheetsMap).forEach(sName => {
        const wsData = [headers, ...sheetsMap[sName]];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, sName.substring(0, 31)); // Excel limits sheet names to 31 chars
      });
    }

    XLSX.writeFile(wb, "lumi_statement_export.xlsx");
  };

  const enrichedStatements = statements.map(stmt => {
    let matchedStudent = null;
    let paymentStatus = 'PENDING';
    let paymentRemark = '';

    for (let student of students) {
      const payment = student.payments?.find(p => p.matchedRowId === stmt.id);
      if (payment) {
        matchedStudent = student;
        paymentStatus = payment.status;
        paymentRemark = payment.remark || '';
        break;
      }
    }
    return {
      ...stmt,
      studentName: matchedStudent ? matchedStudent.name : '---',
      studentId: matchedStudent ? matchedStudent.studentId : '---',
      studentPhone: matchedStudent ? (matchedStudent.phone || '---') : '---',
      subject: matchedStudent ? matchedStudent.subject : '---',
      status: matchedStudent ? paymentStatus : (stmt.isMatched ? 'VERIFIED' : 'PENDING'),
      remark: paymentRemark
    };
  });

  const sheetCategories = ['All', ...new Set(statements.map(s => s.sheetName).filter(Boolean))];

  const filteredStatements = enrichedStatements.filter(s => {
    // 1. Filter by sheet category
    if (activeSheetTab !== 'All' && s.sheetName !== activeSheetTab) {
      return false;
    }

    // 2. Filter by search query
    if (!tableSearchQuery) return true;
    const q = tableSearchQuery.toLowerCase();
    return (
      (s.referenceNo && s.referenceNo.toLowerCase().includes(q)) ||
      (s.studentName && s.studentName.toLowerCase().includes(q)) ||
      (s.studentId && s.studentId.toLowerCase().includes(q)) ||
      (s.status && s.status.toLowerCase().includes(q)) ||
      (s.remark && s.remark.toLowerCase().includes(q)) ||
      (s.date && String(s.date).toLowerCase().includes(q)) ||
      (s.amount && String(s.amount).toLowerCase().includes(q))
    );
  });

  const ITEMS_PER_PAGE = 30;
  const totalPages = Math.ceil(filteredStatements.length / ITEMS_PER_PAGE);
  const paginatedStatements = filteredStatements.slice(
    (tableCurrentPage - 1) * ITEMS_PER_PAGE,
    tableCurrentPage * ITEMS_PER_PAGE
  );

  // Reset page when search changes
  useEffect(() => {
    setTableCurrentPage(1);
  }, [tableSearchQuery]);

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black font-sans relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px]"></div>

        <div className="bg-slate-950/60 backdrop-blur-xl p-8 rounded-2xl border border-white/10 w-full max-w-md relative z-10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-br from-cyan-500 to-purple-600 p-[1px] rounded-full">
              <div className="bg-slate-950 p-4 rounded-full">
                <ShieldCheck className="w-8 h-8 text-cyan-400" />
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-2 tracking-tight">
            LUMI AUTOMATION
          </h1>
          <p className="text-slate-400 text-center mb-8 text-sm">Enterprise Demo Sandbox Access</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Access Key"
                className="w-full bg-black/50 border border-slate-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-600"
                required
              />
            </div>
            {error && <p className="text-pink-500 text-sm font-medium">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold py-3 px-4 rounded-lg transition-all disabled:opacity-50 shadow-[0_0_20px_-5px_rgba(6,182,212,0.5)]"
            >
              {loading ? 'Authenticating...' : 'Enter Sandbox'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-white p-4 md:p-8 font-sans relative overflow-x-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[300px] bg-cyan-900/20 rounded-full blur-[120px] pointer-events-none"></div>

      <StudentModal
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        onSuccess={fetchData}
        token={token}
      />

      {(isBulkScanning || bulkResults) && (
        <ScanningOverlay
          isScanning={isBulkScanning && !bulkResults}
          progress={bulkProgress}
          results={bulkResults}
          onClose={() => { setIsBulkScanning(false); setBulkResults(null); }}
        />
      )}

      {activeHUDSlipUrl && (
        <VerificationHUD
          slipUrl={activeHUDSlipUrl}
          result={activeHUDResult}
          onClose={() => {
            setActiveHUDSlipUrl(null);
            setActiveHUDResult(null);
          }}
        />
      )}

      <div className="max-w-7xl mx-auto relative z-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-8 h-8 text-cyan-400" />
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
                AI Verification Sandbox
              </h1>
            </div>
            <p className="text-slate-400 text-sm font-medium">Lumi Automation Enterprise Environment • Stateless Mode</p>
          </div>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <button
              onClick={() => setIsStudentModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-700 hover:border-cyan-500/50 rounded-lg text-sm font-semibold transition-colors"
            >
              <UserPlus className="w-4 h-4 text-cyan-400" />
              Create Custom Student
            </button>
            <button onClick={handleLogout} className="text-slate-500 hover:text-white text-sm font-semibold transition-colors">
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">

          {/* Top Section: Split in two columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Left Top: Upload & Staging */}
            <div className="space-y-6">
              {/* Source of Truth Upload */}
              <div className="bg-slate-950/50 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                    <FileSpreadsheet className="w-5 h-5 text-purple-400" />
                    1. Source of Truth (Excel)
                  </h2>
                </div>
                <label className="group relative block border border-slate-800 hover:border-purple-500/50 bg-gradient-to-b from-slate-900/80 to-black rounded-2xl p-10 text-center cursor-pointer transition-all duration-500 overflow-hidden shadow-2xl hover:shadow-[0_0_40px_-10px_rgba(168,85,247,0.3)]">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-50"></div>
                  <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="p-3 bg-slate-950 rounded-full border border-slate-800 group-hover:border-purple-500/50 transition-colors mb-4 shadow-xl">
                      <Upload className="w-8 h-8 text-slate-400 group-hover:text-purple-400 transition-colors group-hover:scale-110 duration-500" />
                    </div>
                    <p className="font-heading font-bold text-lg text-slate-300 group-hover:text-white transition-colors tracking-wide">
                      {uploadingStatement ? 'Parsing Document...' : 'Upload Bank Statement'}
                    </p>
                    <p className="text-xs text-slate-500 font-mono mt-1 tracking-widest uppercase">.xlsx or .csv up to 10MB</p>
                  </div>
                  <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleStatementUpload} disabled={uploadingStatement} />
                </label>
              </div>

              {/* Verification Staging Area */}
              {/* Bulk Operations Panel */}
              <div className="bg-slate-950/50 backdrop-blur-md border border-cyan-500/20 p-6 rounded-2xl shadow-xl shadow-cyan-900/10 relative flex flex-col">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[50px] rounded-full"></div>

                <h2 className="text-lg font-bold flex items-center gap-2 mb-2 text-white">
                  <ScanLine className="w-5 h-5 text-cyan-400" />
                  Bulk Operations Panel
                </h2>
                <p className="text-sm text-slate-400 mb-6">Attach slips to students, then run the bulk verification process.</p>
                <div className="flex-1 flex flex-col justify-center items-center text-center p-6 border-2 border-dashed border-cyan-500/20 rounded-xl bg-cyan-950/10">
                  <div className="text-4xl font-bold text-cyan-400 mb-2">{totalPendingPayments}</div>
                  <div className="text-slate-300 font-medium mb-1">Slips Queued</div>
                  <div className="text-xs text-slate-500 max-w-xs mb-4">Pending slips attached to student accounts waiting for verification</div>

                  <button
                    onClick={handleVerifyAllPending}
                    disabled={totalPendingPayments === 0 || isVerifyingPending}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-lg shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                  >
                    {isVerifyingPending ? 'Processing...' : 'Verify All Pending Slips'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Top: Student Database */}
            <div className="space-y-6">
              <div className="bg-slate-950/50 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                    <Search className="w-5 h-5 text-cyan-400" />
                    2. Student Database (Target Tallying)
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-6 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                  {students.map(student => (
                    <div key={student.id} className="relative group rounded-3xl p-[1px] bg-gradient-to-b from-white/10 to-transparent hover:from-cyan-500/50 hover:to-purple-500/50 transition-all duration-500 shadow-lg hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.4)]">
                      <div className="bg-slate-950/90 backdrop-blur-xl h-full rounded-3xl p-6 relative overflow-hidden flex flex-col">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                        <div className="relative z-10 flex-1 flex flex-col">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="font-heading font-bold text-lg text-white group-hover:text-cyan-400 transition-colors drop-shadow-md flex items-center gap-2">
                                {student.name}
                                <button onClick={() => handleEditStudent(student, 'name')} className="text-slate-500 hover:text-cyan-400 transition-colors">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              </h3>
                              <p className="text-xs text-cyan-500/80 font-mono mt-1 tracking-wider uppercase">
                                {student.studentId} <span className="text-slate-500">|</span> {student.phone || 'NO PHONE'}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-slate-400">{student.subject}</p>
                                <button onClick={() => handleEditStudent(student, 'subject')} className="text-slate-600 hover:text-cyan-400 transition-colors">
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="text-right shrink-0 bg-black/40 px-2 py-1 rounded border border-white/5 group-hover:border-purple-500/30 transition-colors">
                              <p className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-1">Fee Due</p>
                              <div className="flex items-center gap-1 justify-end">
                                <p className="font-mono font-bold text-sm text-purple-400">Rs. {student.feeAmount}</p>
                                <button onClick={() => handleEditStudent(student, 'fee')} className="text-slate-600 hover:text-cyan-400 transition-colors">
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>

                          <label className="flex items-center justify-center gap-2 w-full py-2 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-cyan-950 hover:to-purple-950 border border-slate-700 hover:border-cyan-500/50 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer group/btn mt-auto">
                            <FileUp className="w-3 h-3 text-cyan-400 group-hover/btn:animate-bounce" />
                            Attach Slip
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleStudentSlipUpload(e, student.id)} />
                          </label>

                          {student.payments?.length > 0 && (
                            <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
                              {student.payments.map(p => (
                                <div key={p.id} className="flex flex-col gap-2 bg-black/60 p-3 rounded-xl border border-white/5 relative">
                                  {editingPaymentId === p.id ? (
                                    <div className="flex flex-col gap-2">
                                      <input
                                        type="text"
                                        value={editPaymentData.extractedRefNo}
                                        onChange={e => setEditPaymentData({ ...editPaymentData, extractedRefNo: e.target.value })}
                                        className="bg-slate-900 border border-slate-700 text-xs text-white p-1 rounded"
                                        placeholder="Ref No"
                                      />
                                      <input
                                        type="number"
                                        value={editPaymentData.extractedAmount}
                                        onChange={e => setEditPaymentData({ ...editPaymentData, extractedAmount: e.target.value })}
                                        className="bg-slate-900 border border-slate-700 text-xs text-white p-1 rounded"
                                        placeholder="Amount"
                                      />
                                      <select
                                        value={editPaymentData.status}
                                        onChange={e => setEditPaymentData({ ...editPaymentData, status: e.target.value })}
                                        className="bg-slate-900 border border-slate-700 text-xs text-white p-1 rounded"
                                      >
                                        <option value="PENDING">PENDING</option>
                                        <option value="VERIFIED">VERIFIED</option>
                                        <option value="REJECTED">REJECTED</option>
                                      </select>
                                      <div className="flex gap-2 mt-1">
                                        <button onClick={() => handleEditPaymentSave(p.id)} className="flex-1 bg-green-900/50 text-green-400 border border-green-500/30 text-[10px] uppercase font-bold py-1 rounded hover:bg-green-800/50">Save</button>
                                        <button onClick={handleEditPaymentCancel} className="flex-1 bg-slate-800 text-slate-400 border border-slate-700 text-[10px] uppercase font-bold py-1 rounded hover:bg-slate-700">Cancel</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-start gap-3">
                                        {p.slipUrl && (
                                          <div className="relative group/slip">
                                            <img src={p.slipUrl} alt="Slip Thumbnail" className="w-10 h-10 object-cover rounded border border-white/10 cursor-zoom-in" />
                                            <div className="hidden group-hover/slip:block absolute z-[1000] -top-32 left-12 p-3 bg-slate-950/95 border border-cyan-500/50 rounded-2xl shadow-[0_0_80px_rgba(6,182,212,0.6)] backdrop-blur-3xl min-w-[300px]">
                                              <div className="text-cyan-400 text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center justify-between border-b border-white/10 pb-2">
                                                <span>Slip Preview</span>
                                                <span>High-Res</span>
                                              </div>
                                              <img src={p.slipUrl} alt="Slip High-Res" className="w-[500px] h-auto object-contain rounded-xl max-h-[70vh]" />
                                            </div>
                                          </div>
                                        )}
                                        <div className="flex-1">
                                          <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400 font-mono">Ref: {p.extractedRefNo || '---'}</span>
                                            <span className={`font-bold tracking-wider text-[9px] uppercase px-2 py-1 rounded border ${p.status === 'VERIFIED' ? 'text-green-400 border-green-500/30 bg-green-950/30' : p.status === 'REJECTED' ? 'text-red-400 border-red-500/30 bg-red-950/30' : 'text-yellow-400 border-yellow-500/30 bg-yellow-950/30'}`}>
                                              {p.status}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      {p.remark && (
                                        <div className={`mt-3 p-3 rounded-xl border whitespace-pre-wrap text-[11px] font-mono leading-relaxed shadow-inner ${p.status === 'VERIFIED' ? 'bg-green-950/20 border-green-500/30 text-green-200 shadow-green-900/20' :
                                            p.status === 'REJECTED' ? 'bg-red-950/20 border-red-500/30 text-red-200 shadow-red-900/20' :
                                              'bg-yellow-950/20 border-yellow-500/30 text-yellow-200 shadow-yellow-900/20'
                                          }`}>
                                          <div className="flex items-center gap-2 mb-2 font-bold uppercase tracking-wider text-[10px]">
                                            {p.status === 'VERIFIED' ? (
                                              <><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> AI Verification Log</>
                                            ) : p.status === 'REJECTED' ? (
                                              <><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> AI Rejection Log</>
                                            ) : (
                                              <><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span> AI Processing Log</>
                                            )}
                                          </div>
                                          <div className="opacity-90">{p.remark}</div>
                                        </div>
                                      )}
                                      <div className="flex gap-1 mt-2 border-t border-white/5 pt-2">
                                        {p.status === 'PENDING' && (
                                          <button onClick={() => handleVerifyPayment(p)} className="flex-2 text-center text-[9px] text-black hover:text-black transition-colors uppercase font-bold tracking-widest bg-cyan-500 hover:bg-cyan-400 px-2 py-1 rounded">
                                            Verify with AI
                                          </button>
                                        )}
                                        <button onClick={() => handleManualVerify(p.id, p.status)} className="flex-1 text-center text-[9px] text-slate-500 hover:text-cyan-400 transition-colors uppercase font-bold tracking-widest bg-slate-900/50 py-1 rounded">
                                          Toggle
                                        </button>
                                        <button onClick={() => handleEditPaymentStart(p)} className="flex-1 text-center text-[9px] text-blue-400 hover:text-blue-300 transition-colors uppercase font-bold tracking-widest bg-blue-900/20 py-1 rounded border border-blue-500/20">
                                          Edit
                                        </button>
                                        <button onClick={() => handleDeletePayment(p.id)} className="flex-1 text-center text-[9px] text-red-400 hover:text-red-300 transition-colors uppercase font-bold tracking-widest bg-red-900/20 py-1 rounded border border-red-500/20">
                                          Delete
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Full Width Statement Table */}
          <div className="w-full mt-4">
            <div className="bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6">
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-xl font-heading font-bold text-white flex items-center gap-3">
                    <FileSpreadsheet className="text-cyan-400" />
                    AI Verified Master Statement
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">This table merges the uploaded Excel data with AI mapping and manual verifications.</p>
                </div>
                <div className="mt-4 md:mt-0 flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search records..."
                      value={tableSearchQuery}
                      onChange={(e) => setTableSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-black/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors w-full sm:w-64"
                    />
                  </div>
                  <button onClick={exportToExcel} className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-emerald-900/50 w-full sm:w-auto justify-center">
                    <FileSpreadsheet className="w-5 h-5" /> Export Excel
                  </button>
                  <button onClick={handleClearStatements} className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-red-900/50 w-full sm:w-auto justify-center">
                    <Trash2 className="w-4 h-4" /> Erase Data
                  </button>
                </div>
              </div>

              {/* Sheet Category Tabs */}
              {sheetCategories.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {sheetCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setActiveSheetTab(cat); setTableCurrentPage(1); }}
                      className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${activeSheetTab === cat
                          ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {filteredStatements.length > 0 ? (
                <>
                  <div className="overflow-x-auto custom-scrollbar border border-white/5 rounded-xl bg-black/40">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="bg-slate-900/90 text-xs uppercase font-bold text-cyan-500/80 tracking-wider">
                        <tr>
                          <th className="px-4 py-4 font-mono">Date</th>
                          <th className="px-4 py-4 font-mono">Ref No</th>
                          <th className="px-4 py-4 text-right">Amount (Rs)</th>
                          <th className="px-4 py-4">Matched Student</th>
                          <th className="px-4 py-4">Student ID</th>
                          <th className="px-4 py-4">Status</th>
                          <th className="px-4 py-4">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {paginatedStatements.map(s => (
                          <tr key={s.id} className="hover:bg-slate-800/80 transition-colors group">
                            <td className="px-4 py-4 font-mono text-xs text-slate-500">{s.date}</td>
                            <td className="px-4 py-4 font-mono text-xs text-white group-hover:text-cyan-400 transition-colors">{s.referenceNo}</td>
                            <td className="px-4 py-4 text-right font-mono font-bold text-purple-400">{s.amount}</td>
                            <td className="px-4 py-4 font-bold text-white">{s.studentName}</td>
                            <td className="px-4 py-4 font-mono text-xs text-slate-400">{s.studentId}</td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded-full border ${s.status === 'VERIFIED' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                                  s.status === 'REJECTED' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                                    'text-slate-400 bg-slate-800 border-slate-700'
                                }`}>
                                {s.status === 'VERIFIED' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                {s.status}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-xs italic text-slate-400 whitespace-pre-wrap min-w-[300px]">
                              {s.remark || '---'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-slate-500">
                        Showing {(tableCurrentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(tableCurrentPage * ITEMS_PER_PAGE, filteredStatements.length)} of {filteredStatements.length} records
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setTableCurrentPage(p => Math.max(1, p - 1))}
                          disabled={tableCurrentPage === 1}
                          className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setTableCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={tableCurrentPage === totalPages}
                          className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-slate-600 border border-dashed border-slate-800 rounded-xl bg-black/20">
                  <FileSpreadsheet className="w-12 h-12 mb-4 opacity-50" />
                  <p>No statement records available. Please upload a bank statement above.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CSS for custom scrollbar embedded for simplicity */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5); 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(51, 65, 85, 0.8); 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(71, 85, 105, 1); 
        }
      `}} />
    </div>
  );
}

export default App;
