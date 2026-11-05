import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../../api/axios';
import { Loader2, CheckCircle, Clock, Wallet, CalendarDays, AlertTriangle, UploadCloud, X, Camera, MonitorPlay, Paperclip, Info } from 'lucide-react';
import toast from 'react-hot-toast';

import correctCdmImg from '../../../assets/correct-cdm.jpg';
import wrongCdmImg from '../../../assets/wrong-cdm.jpg';
import correctReceiptImg from '../../../assets/correct-receipt.jpg';
import wrongReceiptImg from '../../../assets/wrong-receipt.jpg';

export default function PaymentHistory({ isActive = true }) {
    const [payments, setPayments] = useState({ upcoming: [], completed: [] });
    const [loading, setLoading] = useState(true);

    const [payModal, setPayModal] = useState(null);
    const [slipFiles, setSlipFiles] = useState([]);
    const [remark, setRemark] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSlipInstructions, setShowSlipInstructions] = useState(false);
    
    const [paymentMethod, setPaymentMethod] = useState('slip'); // 'slip' or 'paycorp'
    const [paycorpIframeUrl, setPaycorpIframeUrl] = useState(null);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const activePayingModalRef = React.useRef(null);

    const backendBaseUrl = axios.defaults.baseURL.replace('/api', '');

    const fetchPayments = async () => {
        setLoading(true);
        try {
            let res;
            try { res = await axios.get(`/student/my-payments?t=${new Date().getTime()}`); } 
            catch (err) { res = await axios.get(`/payments/my-payments?t=${new Date().getTime()}`); }

            const all = res?.data?.oldPayments || res?.data || [];
            const upcomingList = [];
            const historyList = [];

            all.forEach(p => {
                const isRejectedOrTrashedDue = (p.status === 2 || p.status === 5) && (p.dueDate || p.method === 'Upcoming');

                if (isRejectedOrTrashedDue) {
                    upcomingList.push(p);
                } else if (p.status === 5) {
                    return; // Ignore general trashed payments
                } else {
                    const isVerifying = p.status === -1 || (p.status === 0 && p.method === 'Slip');
                    
                    if (p.status === 1 || p.status === 2 || p.status === 3 || p.status === 4 || isVerifying) {
                        p.displayStatus = (p.status === 1 || p.status === 4) ? 'Approved' 
                                         : p.status === 3 ? 'Expired'
                                         : p.status === 2 ? 'Rejected' 
                                         : 'Verifying';
                        historyList.push(p);
                    } else {
                        upcomingList.push(p);
                    }
                }
            });

            setPayments({ upcoming: upcomingList, completed: historyList });
        } catch (error) { 
            console.error(error); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => {
        if (isActive) {
            fetchPayments();
        }
        const handleRefresh = () => fetchPayments();
        window.addEventListener('refreshPayments', handleRefresh);
        return () => window.removeEventListener('refreshPayments', handleRefresh);
    }, [isActive]);

    // 🔥 Listen to Sampath IPG (Paycorp) complete event
    useEffect(() => {
        const handleMessage = async (event) => {
            if (event.data?.type === 'PAYCORP_COMPLETE') {
                setPaycorpIframeUrl(null);
                const { reqid, businessId } = event.data;
                const currentPay = activePayingModalRef.current;
                if (!currentPay) return;

                const toastId = toast.loading("Verifying payment with Sampath Bank...");
                try {
                    setIsSubmitting(true);
                    const res = await axios.post('/student/paycorp-complete', { reqid, businessId });
                    if (res.data?.success && res.data?.status === 'success') {
                        toast.success("Payment verified! Updating records...", { id: toastId });
                        await axios.post('/student/pay-due-online', {
                            paymentId: currentPay.id,
                            orderId: reqid,
                            method: 'Paycorp',
                            isVirtual: currentPay.id?.toString().startsWith('virtual_') ? 'true' : 'false',
                            businessId: currentPay.businessId,
                            batchId: currentPay.batchId,
                            groupId: currentPay.groupId,
                            amount: currentPay.amount,
                            subjects: typeof currentPay.subjects === 'string' ? currentPay.subjects : JSON.stringify(currentPay.subjects)
                        });
                        toast.success("Due payment completed successfully!");
                        setPayModal(null);
                        setSlipFiles([]);
                        setRemark('');
                        setPaymentMethod('slip');
                        setAgreedToTerms(false);
                        await fetchPayments();
                    } else {
                        toast.error("Payment failed or cancelled.", { id: toastId });
                    }
                } catch (e) {
                    console.error("Paycorp Due Verification Error:", e);
                    toast.error("Error verifying payment with server.", { id: toastId });
                } finally {
                    setIsSubmitting(false);
                    activePayingModalRef.current = null;
                }
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const formatDate = (ds) => ds ? new Date(ds).toISOString().split('T')[0] : 'N/A';

    const handleFileChange = (e) => {
        const newFiles = Array.from(e.target.files || []);
        if (newFiles.length === 0) return;
        const totalFiles = [...slipFiles, ...newFiles];
        
        if (totalFiles.length > 4) {
            toast.error("You can only upload up to 4 slips.");
            setSlipFiles(totalFiles.slice(0, 4));
        } else {
            setSlipFiles(totalFiles);
        }
        e.target.value = '';
    };

    const removeFile = (indexToRemove) => {
        setSlipFiles(slipFiles.filter((_, index) => index !== indexToRemove));
    };

    const openSlipInstructions = () => setShowSlipInstructions(true);

    const confirmSlipInstructions = () => {
        const fileInput = document.getElementById('slip-upload-due');
        if (fileInput) fileInput.click();
        setShowSlipInstructions(false); 
    };

    const openSlipsInNewTab = (slips) => {
        if (!slips || slips.length === 0) return toast.error("No slips to view.");

        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const baseUrl = isLocalhost ? 'http://localhost:5000' : 'https://imacampus.online';

        const slipsHtml = slips.map((imgStr, index) => {
            const fileUrl = `${baseUrl}/api/storage/documents/${imgStr}`;
            const isPdf = imgStr.toLowerCase().endsWith('.pdf');
            if (isPdf) {
                return `
                <div class="slip-card">
                    <div class="title">Document ${index + 1} (PDF)</div>
                    <embed src="${fileUrl}" type="application/pdf" width="100%" height="600px" />
                    <a href="${fileUrl}" target="_blank" class="download-btn">Open PDF in New Tab</a>
                </div>`;
            } else {
                return `
                <div class="slip-card">
                    <div class="title">Image ${index + 1}</div>
                    <img src="${fileUrl}" alt="Slip ${index + 1}"/>
                    <a href="${fileUrl}" target="_blank" class="download-btn">View Full Image</a>
                </div>`;
            }
        }).join('');

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>My Uploaded Slips</title>
            <style>
                body { background-color: #0f172a; color: white; font-family: system-ui, -apple-system, sans-serif; padding: 2rem; display: flex; flex-direction: column; align-items: center; gap: 2rem; margin: 0; }
                .header { text-align: center; margin-bottom: 1rem; }
                .header h2 { color: #10b981; margin: 0; font-size: 2rem; }
                .slip-card { background: #1e293b; border: 1px solid #334155; border-radius: 1rem; padding: 1.5rem; width: 100%; max-width: 800px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5); }
                img { max-width: 100%; height: auto; border-radius: 0.5rem; border: 1px solid #334155; }
                embed { border-radius: 0.5rem; border: 1px solid #334155; background-color: white; }
                .title { width: 100%; text-align: left; margin-bottom: 1rem; font-size: 1rem; font-weight: bold; color: #cbd5e1; border-bottom: 1px solid #334155; padding-bottom: 0.5rem; }
                .download-btn { margin-top: 1rem; padding: 0.5rem 1rem; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 0.5rem; font-size: 0.875rem; font-weight: bold; }
                .download-btn:hover { background-color: #2563eb; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>My Uploaded Slips</h2>
            </div>
            ${slipsHtml}
        </body>
        </html>
        `;

        const newWindow = window.open('', '_blank');
        if (newWindow) {
            newWindow.document.write(htmlContent);
            newWindow.document.close();
        } else {
            toast.error("Popup blocked! Please allow popups for this site.");
        }
    };

    const handlePayDue = async (e) => {
        e.preventDefault();

        if (paymentMethod === 'paycorp') {
            if (!agreedToTerms) {
                return toast.error("Please agree to the Terms & Conditions before proceeding.");
            }

            const amountToPay = parseFloat(payModal.amount);
            if (!amountToPay || isNaN(amountToPay) || amountToPay <= 0) {
                return toast.error("Invalid payment amount.");
            }

            setIsSubmitting(true);
            try {
                const targetBusinessId = payModal.businessId || localStorage.getItem('businessId');
                if (!targetBusinessId) {
                    toast.error("Business ID not found for payment.");
                    setIsSubmitting(false);
                    return;
                }

                const orderId = `DUE-${payModal.id}-${Date.now()}`;
                activePayingModalRef.current = payModal;

                const initRes = await axios.post('/student/paycorp-init', {
                    amount: amountToPay,
                    orderId: orderId,
                    businessId: targetBusinessId
                });

                if (initRes.data && initRes.data.success && initRes.data.paymentUrl) {
                    setPaycorpIframeUrl(initRes.data.paymentUrl);
                } else {
                    toast.error(initRes.data?.message || "Failed to initialize Sampath IPG.");
                    setIsSubmitting(false);
                    activePayingModalRef.current = null;
                }
            } catch (error) {
                console.error("Paycorp Dues Error:", error);
                toast.error(error.response?.data?.message || "Failed to initiate online payment.");
                setIsSubmitting(false);
                activePayingModalRef.current = null;
            }

        } else {
            // 🔥 SLIP PAYMENT
            if (slipFiles.length === 0) return toast.error("Please upload your bank slip(s).");
            
            setIsSubmitting(true);
            const formData = new FormData();
            formData.append('paymentId', payModal.id); 
            if (remark) formData.append('remark', remark);

            if (payModal.id && payModal.id.toString().startsWith('virtual_')) {
                formData.append('isVirtual', 'true');
                if (payModal.businessId) formData.append('businessId', payModal.businessId);
                if (payModal.batchId) formData.append('batchId', payModal.batchId);
                if (payModal.groupId) formData.append('groupId', payModal.groupId);
                if (payModal.amount) formData.append('amount', payModal.amount);
                if (payModal.subjects) formData.append('subjects', typeof payModal.subjects === 'string' ? payModal.subjects : JSON.stringify(payModal.subjects));
            }

            slipFiles.forEach(file => {
                formData.append('slipImages', file);
            });

            try {
                await axios.post('/student/upload-due-slip', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
                toast.success("Slip uploaded successfully! Awaiting verification.");
                setPayModal(null);
                setSlipFiles([]);
                setRemark('');
                setAgreedToTerms(false);
                await fetchPayments();
            } catch (error) {
                toast.error("Failed to upload slip. Try again.");
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-500" size={40}/></div>;

    return (
        <div className="w-full max-w-6xl mx-auto animate-fade-in pb-20">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/20">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-black/20 backdrop-blur-xl flex items-center justify-center shrink-0 border border-white/20">
                    <Wallet size={30} className="text-red-500"/>
                </div>
                <div>
                    <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-wider uppercase">My Payments</h2>
                    <p className="text-white/90 font-bold mt-1 text-xs md:text-sm font-medium">Track your upcoming dues and payment history.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* UPCOMING / PENDING SECTION */}
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-[3rem] p-6 md:p-8 border border-white/20 shadow-2xl h-max">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3"><Clock className="text-orange-400"/> Upcoming / Pending</h3>
                    <div className="space-y-4">
                        {payments.upcoming.length === 0 ? (
                            <div className="text-center py-10 bg-black/20 backdrop-blur-xl rounded-2xl border border-white/20">
                                <CheckCircle size={40} className="mx-auto text-emerald-500/50 mb-3"/>
                                <p className="text-white/80 font-medium font-bold">No pending payments.</p>
                            </div>
                        ) : payments.upcoming.map((p, idx) => {
                            let isLate = p.dueDate ? new Date(p.dueDate) < new Date() : false;
                            if (p.status === 3) isLate = true;

                            return (
                                <div key={idx} className={`bg-black/20 backdrop-blur-xl border p-5 md:p-6 rounded-2xl flex flex-col relative overflow-hidden transition-all ${isLate ? 'border-red-500/50' : 'border-white/20'}`}>
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
                                    <div className="pl-3">
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    {p.classType === 2 ? (
                                                        <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                                            📝 Paper Class
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                                            📘 Theory Class
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className="text-base md:text-lg font-bold text-white">{p.courseName}</h4>
                                            </div>
                                            <div className="flex gap-2 flex-wrap shrink-0">
                                                {p.isInstallment && p.installmentNo && (
                                                    <span className="text-[10px] uppercase font-bold bg-orange-500/20 text-orange-400 px-2.5 py-1 rounded-lg border border-orange-500/30 w-max">
                                                        Phase {p.installmentNo}
                                                    </span>
                                                )}
                                                {(p.status === 2 || p.status === 5) && (
                                                    <span className="text-[10px] uppercase font-bold bg-red-500/20 text-red-400 px-2.5 py-1 rounded-lg border border-red-500/30 w-max animate-pulse">
                                                        Payment Rejected
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <p className={`text-xs mt-2 flex items-center gap-1.5 font-bold ${isLate ? 'text-red-400' : 'text-white/80 font-medium'}`}>
                                            <CalendarDays size={14}/> 
                                            {p.dueDate ? `Due: ${formatDate(p.dueDate)}` : `Generated: ${formatDate(p.createdDate)}`}
                                            {isLate && <AlertTriangle size={14} className="ml-1"/>}
                                        </p>
                                        
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mt-4 pt-4 border-t border-white/20 gap-4">
                                            <div>
                                                <span className="text-xs font-bold text-white/70 font-medium block mb-1 uppercase tracking-widest">Amount Payable</span>
                                                <span className="text-xl md:text-3xl font-black text-white">LKR {parseFloat(p.amount).toFixed(2)}</span>
                                            </div>
                                            <div className="w-full sm:w-auto">
                                                <button onClick={() => setPayModal(p)} className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-red-500/20 transition-transform hover:scale-105 uppercase tracking-widest">
                                                    Pay Now
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* PAYMENT HISTORY SECTION */}
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-[3rem] p-6 md:p-8 border border-white/20 shadow-2xl h-max">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3"><CheckCircle className="text-emerald-400"/> Payment History</h3>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                        {payments.completed.length === 0 ? (
                            <div className="text-center py-10 bg-black/20 backdrop-blur-xl rounded-2xl border border-white/20">
                                <p className="text-white/80 font-medium font-bold">No history found.</p>
                            </div>
                        ) : payments.completed.map((p, idx) => (
                            <div key={idx} className="bg-black/20 backdrop-blur-xl hover:bg-black/20 backdrop-blur-xl transition-colors border border-white/20 p-5 rounded-2xl group flex flex-col justify-between">
                                <div className="flex justify-between items-start gap-4 mb-2">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            {p.classType === 2 ? (
                                                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                                    📝 Paper Class
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                                    📘 Theory Class
                                                </span>
                                            )}
                                            {p.isInstallment && p.installmentNo && (
                                                <span className="text-[9px] uppercase font-bold text-white/80 font-medium bg-black/20 backdrop-blur-xl px-2 py-0.5 rounded border border-white/20">
                                                    Phase {p.installmentNo}
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="text-sm font-bold text-white mb-1 group-hover:text-red-400 transition-colors">{p.courseName}</h4>
                                        <p className="text-[10px] text-white/70 font-medium font-medium flex items-center gap-1 mt-1"><CalendarDays size={10}/> {formatDate(p.createdDate)}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-lg font-black text-white/90 font-bold block mb-1">LKR {parseFloat(p.amount).toFixed(2)}</span>
                                        <div className="flex flex-col items-end gap-2 mt-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider inline-block border ${
                                                p.displayStatus === 'Approved' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-500/10' :
                                                p.displayStatus === 'Expired' ? 'text-orange-400 border-orange-400/30 bg-orange-500/10' :
                                                p.displayStatus === 'Rejected' ? 'text-red-400 border-red-400/30 bg-red-500/10' :
                                                'text-yellow-400 border-yellow-400/30 bg-yellow-500/10'
                                            }`}>
                                                {p.displayStatus}
                                            </span>
                                            {p.slips && p.slips.length > 0 && (
                                                <button onClick={() => openSlipsInNewTab(p.slips)} className="text-[10px] font-extrabold text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600 border border-blue-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                                                    View Slip
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 🔥 NEW: Wallet adjustments indicator 🔥 */}
                                {(p.excessAmount > 0 || p.arrearsAmount > 0) && (
                                    <div className="mt-2 pt-2 border-t border-white/20 text-right flex flex-col gap-1">
                                        {p.excessAmount > 0 && (
                                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded w-max ml-auto border border-emerald-500/20">
                                                Overpaid: +LKR {p.excessAmount} to Wallet
                                            </span>
                                        )}
                                        {p.arrearsAmount > 0 && (
                                            <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded w-max ml-auto border border-red-500/20">
                                                Short Amount: -LKR {p.arrearsAmount} in Wallet
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 🔥 PAY DUE MODAL WITH ADVANCED UPLOAD 🔥 */}
            {payModal && createPortal(
                <div className="fixed inset-0 z-[9999] bg-black/20 backdrop-blur-xl/95 backdrop-blur-md overflow-y-auto custom-scrollbar">
                    <div className="flex min-h-full items-start justify-center p-4 py-12">
                        <div className="bg-[#15192b] border border-white/20 rounded-[2.5rem] w-full max-w-md p-6 md:p-8 relative shadow-2xl animate-in zoom-in-95 duration-200 my-auto">
                            <button onClick={() => {setPayModal(null); setSlipFiles([]); setRemark(''); setPaymentMethod('slip'); setAgreedToTerms(false);}} className="absolute top-5 right-5 text-white/80 font-medium hover:text-white bg-black/20 backdrop-blur-xl hover:bg-black/20 backdrop-blur-xl p-2.5 rounded-xl transition-all border border-transparent hover:border-red-500/30">
                                <X size={20} strokeWidth={3} />
                            </button>
                            
                            <div className="mb-6 border-b border-white/20 pb-6">
                                <h3 className="text-xl md:text-2xl font-black text-white">Submit Payment</h3>
                                <p className="text-xs text-white/80 font-medium mt-2 font-medium">Select a payment option and complete your transaction.</p>
                            </div>
                            
                            <div className="bg-black/20 backdrop-blur-xl border border-white/20 rounded-2xl p-5 text-center mb-6 shadow-inner">
                                <p className="text-[10px] font-bold text-white/80 font-medium uppercase tracking-widest mb-1">Amount Due</p>
                                <p className="text-3xl font-black text-red-500">LKR {parseFloat(payModal.amount).toLocaleString()}</p>
                                <p className="text-xs font-bold text-white mt-2">{payModal.courseName}</p>
                            </div>

                            {/* Payment Method Selector Tabs */}
                            <div className="flex gap-2 bg-black/20 backdrop-blur-xl p-1 rounded-2xl border border-white/20 mb-6 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('slip')}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${paymentMethod === 'slip' ? 'bg-black/20 backdrop-blur-xl text-white border border-white/20 shadow' : 'text-white/70 font-medium hover:text-white/80 font-medium'}`}
                                >
                                    Bank Slip
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('paycorp')}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${paymentMethod === 'paycorp' ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/50 shadow' : 'text-emerald-500/70 hover:text-emerald-400 font-medium'}`}
                                >
                                    Sampath IPG
                                </button>
                            </div>

                            <form onSubmit={handlePayDue}>
                                {paymentMethod === 'paycorp' ? (
                                    <div className="mb-4 space-y-4">
                                        <div className="bg-emerald-900/20 backdrop-blur-xl rounded-[1.5rem] p-6 flex flex-col justify-center items-center h-full min-h-[120px] border border-emerald-500/30 shadow-lg shadow-emerald-950/20">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-white p-1.5 rounded-full shadow-lg">
                                                    <img src="/sampath-logo.png" alt="Sampath" className="w-7 h-7 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                                                </div>
                                                <span className="text-white font-black text-2xl tracking-wider uppercase">Sampath Bank</span>
                                            </div>
                                            <span className="text-[9px] text-emerald-400 uppercase mt-3 font-bold tracking-widest">Paycorp IPG • Visa / Master / Amex</span>
                                        </div>

                                        <label className="flex items-start gap-3 p-3 bg-black/20 rounded-xl border border-white/10 cursor-pointer hover:bg-black/40 transition">
                                            <input 
                                                type="checkbox" 
                                                className="mt-0.5 w-4 h-4 rounded border-gray-600 text-emerald-500 focus:ring-emerald-500 bg-gray-900 cursor-pointer" 
                                                checked={agreedToTerms}
                                                onChange={(e) => setAgreedToTerms(e.target.checked)}
                                            />
                                            <span className="text-xs text-white/80 leading-snug">
                                                I have read and agree to the <a href="/terms" target="_blank" onClick={(e) => e.stopPropagation()} className="text-blue-400 font-bold hover:underline">Terms and Conditions</a>. I understand that all online payments are non-refundable.
                                            </span>
                                        </label>
                                    </div>
                                ) : (
                                    <>
                                        <div className="border-2 border-dashed border-white/20 bg-black/20 backdrop-blur-xl rounded-[1.5rem] p-6 text-center hover:border-red-500/50 hover:bg-red-500/5 transition-colors cursor-pointer mb-4 group relative" onClick={openSlipInstructions}>
                                            <div className="absolute top-3 right-3 bg-blue-500 text-white p-1.5 rounded-full"><Info size={14}/></div>
                                            {/* Primary File Input: Opens Gallery / Files (NO capture="environment") */}
                                            <input type="file" id="slip-upload-due" className="hidden" multiple accept="image/*,application/pdf" onChange={handleFileChange} />
                                            {/* Dedicated Direct Camera Input */}
                                            <input type="file" id="slip-upload-due-camera" className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
                                            <div className="flex flex-col items-center w-full">
                                                <div className="flex gap-3 mb-2 text-white/80 group-hover:text-red-500 transition-colors">
                                                    <UploadCloud size={30} />
                                                    <Camera size={30} />
                                                </div>
                                                <span className="text-white font-bold text-sm mb-1">
                                                    {slipFiles.length > 0 ? `${slipFiles.length} File(s) Selected` : 'Click to Upload Slip'}
                                                </span>
                                                <span className="text-[10px] text-white/70 font-medium mb-3">
                                                    Select from Gallery, Files, or snap a live photo (Max 4 slips. PNG, JPG, PDF)
                                                </span>

                                                {/* Direct Action Buttons */}
                                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => document.getElementById('slip-upload-due')?.click()}
                                                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 border border-white/20 shadow-sm transition-all active:scale-95"
                                                    >
                                                        <UploadCloud size={14} className="text-blue-400" />
                                                        <span>Gallery / Files</span>
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => document.getElementById('slip-upload-due-camera')?.click()}
                                                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 border border-white/20 shadow-sm transition-all active:scale-95"
                                                    >
                                                        <Camera size={14} className="text-emerald-400" />
                                                        <span>Camera</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {slipFiles.length > 0 && (
                                            <div className="mb-4 bg-black/20 backdrop-blur-xl p-3 rounded-xl border border-white/20 space-y-1.5">
                                                {slipFiles.map((file, i) => (
                                                    <div key={i} className="flex justify-between items-center text-xs">
                                                        <div className="flex items-center gap-2 truncate pr-3">
                                                            <Paperclip size={12} className="text-white/70 font-medium shrink-0"/>
                                                            <span className="text-white truncate">{file.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 shrink-0">
                                                            <span className="text-white/70 font-medium">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                                                            <button type="button" onClick={() => removeFile(i)} className="text-red-400 hover:text-red-300"><X size={14}/></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="mb-6">
                                    <label className="text-[10px] font-bold text-white/80 font-medium uppercase tracking-widest mb-1 block">Remark (Optional)</label>
                                    <textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Type any message..." rows="2" className="w-full bg-black/20 backdrop-blur-xl border border-white/20 rounded-xl p-3 text-xs text-white outline-none focus:border-red-500 transition-colors resize-none"></textarea>
                                </div>
                                
                                <button type="submit" disabled={isSubmitting || (paymentMethod === 'slip' && slipFiles.length === 0) || (paymentMethod === 'paycorp' && !agreedToTerms)} className={`w-full bg-gradient-to-r ${paymentMethod === 'paycorp' ? 'from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 border-emerald-500/50 shadow-emerald-500/20' : 'from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 border-red-500/50 shadow-red-500/20'} disabled:opacity-50 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest border shadow-lg`}>
                                    {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <CheckCircle size={18}/>} 
                                    {paymentMethod === 'paycorp' ? 'Pay via Sampath IPG' : 'Submit Payment'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* 🔥 PAYCORP IFRAME POPUP 🔥 */}
            {paycorpIframeUrl && createPortal(
                <div className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 p-2 md:p-8">
                    <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] md:h-full relative overflow-hidden flex flex-col shadow-2xl">
                        <div className="bg-[#1a1f2e] text-white p-3 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2">
                                <Wallet size={18} className="text-emerald-400" />
                                <h3 className="font-bold text-sm md:text-base">Sampath Bank Secure Payment</h3>
                            </div>
                            <button 
                                onClick={() => {
                                    setPaycorpIframeUrl(null);
                                    setIsSubmitting(false);
                                    activePayingModalRef.current = null;
                                }} 
                                className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg transition-colors"
                                title="Cancel Payment"
                            >
                                <X size={18}/>
                            </button>
                        </div>
                        <iframe 
                            src={paycorpIframeUrl} 
                            className="w-full flex-1 border-none bg-white" 
                            title="Sampath Payment Gateway"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
                        />
                    </div>
                </div>,
                document.body
            )}

            {/* 🔥 SLIP INSTRUCTIONS POPUP 🔥 */}
            {showSlipInstructions && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/95 p-4 animate-in fade-in duration-200">
                    <div className="bg-[#1a1f2e]/95 backdrop-blur-3xl border border-white/10 p-5 md:p-8 rounded-[2rem] max-w-2xl w-full shadow-2xl relative overflow-y-auto max-h-[90vh] custom-scrollbar">
                        <h3 className="text-lg md:text-2xl font-extrabold text-white mb-4 md:mb-6 border-b border-white/20 pb-3 md:pb-4">Slip Upload Guidelines</h3>
                        
                        <div className="space-y-4 md:space-y-6">
                            <div className="bg-black/20 backdrop-blur-xl p-4 md:p-5 rounded-2xl border border-white/20">
                                <h4 className="text-red-400 font-bold mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base"><Camera size={16}/> Bank Deposit / CDM Slips</h4>
                                <ul className="text-xs md:text-sm text-white/70 list-disc pl-4 md:pl-5 space-y-1 md:space-y-2 leading-relaxed mb-4">
                                    <li>Capture the image clearly showing <strong className="text-white">all 4 corners</strong> of the slip.</li>
                                    <li>The photo must be <strong className="text-white">clear and not blurry</strong>.</li>
                                    <li><strong className="text-white">Reference number, date, and time</strong> must be clearly visible and legible.</li>
                                </ul>
                                <div className="flex gap-2 md:gap-4">
                                    <div className="flex-1 bg-black/20 backdrop-blur-xl border border-green-500/50 rounded-xl p-2 md:p-3 text-center flex flex-col justify-between">
                                        <img src={correctCdmImg} className="w-full h-20 md:h-28 object-contain rounded-lg mb-2" alt="Correct"/>
                                        <span className="text-green-400 text-[9px] md:text-xs font-bold uppercase flex justify-center items-center gap-1"><CheckCircle size={10}/> Correct</span>
                                    </div>
                                    <div className="flex-1 bg-black/20 backdrop-blur-xl border border-red-500/50 rounded-xl p-2 md:p-3 text-center flex flex-col justify-between">
                                        <img src={wrongCdmImg} className="w-full h-20 md:h-28 object-contain rounded-lg mb-2 opacity-50" alt="Wrong"/>
                                        <span className="text-red-400 text-[9px] md:text-xs font-bold uppercase flex justify-center items-center gap-1"><X size={10}/> Incorrect</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-black/20 backdrop-blur-xl p-4 md:p-5 rounded-2xl border border-white/20">
                                <h4 className="text-blue-400 font-bold mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base"><MonitorPlay size={16}/> Online Transfers & E-Receipts</h4>
                                <ul className="text-xs md:text-sm text-white/70 list-disc pl-4 md:pl-5 space-y-1 md:space-y-2 leading-relaxed mb-4">
                                    <li><strong className="text-white">Reference number, date, and time</strong> must be fully visible.</li>
                                    <li>Upload the full screenshot or receipt without cropping essential details.</li>
                                </ul>
                                 <div className="flex gap-2 md:gap-4">
                                    <div className="flex-1 bg-black/20 backdrop-blur-xl border border-green-500/50 rounded-xl p-2 md:p-3 text-center flex flex-col justify-between">
                                        <img src={correctReceiptImg} className="w-full h-20 md:h-28 object-contain rounded-lg mb-2 border border-white/20" alt="Correct"/>
                                        <span className="text-green-400 text-[9px] md:text-xs font-bold uppercase flex justify-center items-center gap-1"><CheckCircle size={10}/> Correct</span>
                                    </div>
                                    <div className="flex-1 bg-black/20 backdrop-blur-xl border border-red-500/50 rounded-xl p-2 md:p-3 text-center flex flex-col justify-between">
                                        <img src={wrongReceiptImg} className="w-full h-20 md:h-28 object-contain rounded-lg mb-2 opacity-50 border border-white/20" alt="Wrong"/>
                                        <span className="text-red-400 text-[9px] md:text-xs font-bold uppercase flex justify-center items-center gap-1"><X size={10}/> Incorrect</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 md:mt-8 flex flex-wrap justify-end gap-3 md:gap-4">
                            <button onClick={() => setShowSlipInstructions(false)} className="px-4 md:px-6 py-2.5 md:py-3 rounded-xl bg-black/20 backdrop-blur-xl text-white/70 font-medium text-xs md:text-sm font-bold hover:bg-black/20 backdrop-blur-xl hover:text-white transition-colors">Cancel</button>
                            <button onClick={() => { document.getElementById('slip-upload-due')?.click(); setShowSlipInstructions(false); }} className="px-4 md:px-5 py-2.5 md:py-3 rounded-xl bg-blue-600 text-white text-xs md:text-sm font-bold hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-colors flex items-center gap-2">
                                <UploadCloud size={16} /> Choose from Gallery / Files
                            </button>
                            <button onClick={() => { document.getElementById('slip-upload-due-camera')?.click(); setShowSlipInstructions(false); }} className="px-4 md:px-5 py-2.5 md:py-3 rounded-xl bg-emerald-600 text-white text-xs md:text-sm font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 transition-colors flex items-center gap-2">
                                <Camera size={16} /> Take Photo (Camera)
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}