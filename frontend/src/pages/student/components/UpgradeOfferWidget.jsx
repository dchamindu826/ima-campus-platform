import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom'; // 🔥 FIX: To render modal outside sidebar
import axios from '../../../api/axios';
import { UploadCloud, X, Camera, Sparkles, CheckCircle, Wallet, Gift, ChevronRight, Paperclip, Info, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

const UpgradeOfferWidget = ({ triggerShow, onClose, hideFloatingWidget, compactMode }) => {
    const [eligible, setEligible] = useState(false);
    const [pendingUpgrade, setPendingUpgrade] = useState(false);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    // Wizard Flow state
    const [showModal, setShowModal] = useState(false);
    const [showBanner, setShowBanner] = useState(false);
    const [showInstallmentPrompt, setShowInstallmentPrompt] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // Slip & Payment state
    const [paymentMethod, setPaymentMethod] = useState('slip'); // 'slip' or 'payhere'
    const [slipFiles, setSlipFiles] = useState([]);
    const [remark, setRemark] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [selectedUpgradeMethod, setSelectedUpgradeMethod] = useState('full'); // 'full' or 'installment'
    const [selectedSubjects, setSelectedSubjects] = useState([]);
    const [paycorpIframeUrl, setPaycorpIframeUrl] = useState(null);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const submitLock = useRef(false);

    const backendBaseUrl = axios.defaults.baseURL.replace('/api', '');

    const getImageUrl = (imageName) => (!imageName || imageName === 'default.png' || imageName === 'null')
        ? null
        : `${backendBaseUrl}/storage/icons/${imageName}`;

    const formatPrice = (num) => {
        if (num === undefined || num === null) return 'LKR 0.00';
        return `LKR ${Number(num).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
    };

    const getPricing = () => {
        if (!data || !data.batches || selectedSubjects.length === 0) {
            return { subtotal: 0, bundleDiscount: 0, monthlyPaid: 0, balanceToPay: 0, installments: [] };
        }

        let totalSubtotal = 0;
        let totalBundleDiscount = 0;
        let totalMonthlyPaid = 0;
        let totalBalanceToPay = 0;
        const combinedInstallmentsMap = {};

        data.batches.forEach(batch => {
            const batchSelectedSubjects = (batch.subjects || []).filter(id => selectedSubjects.includes(id));
            if (batchSelectedSubjects.length === 0) return;

            const selectedDetails = (batch.subjectDetails || []).filter(sub => selectedSubjects.includes(sub.id));
            const subtotal = selectedDetails.reduce((sum, sub) => sum + sub.upgradeFullTarget, 0);
            totalSubtotal += subtotal;

            let bundleDiscount = 0;
            const batchSelectedCount = batchSelectedSubjects.length;
            const rich = batch.richConfig;
            if (rich && rich.enableBundle) {
                const bundleSubIds = (rich.bundleSubjects || []).map(x => parseInt(x));
                const allSelectedAreEligible = batchSelectedSubjects.every(id => bundleSubIds.includes(id));
                if (allSelectedAreEligible) {
                    if (batchSelectedCount === 2 && rich.bundle2Price > 0) {
                        bundleDiscount = Math.max(0, subtotal - rich.bundle2Price);
                    } else if (batchSelectedCount === 3 && rich.bundle3Price > 0) {
                        bundleDiscount = Math.max(0, subtotal - rich.bundle3Price);
                    }
                }
            }
            if (bundleDiscount === 0 && batch.bundleDiscountsMap && batch.bundleDiscountsMap[batchSelectedCount] !== undefined) {
                bundleDiscount = batch.bundleDiscountsMap[batchSelectedCount];
            }
            const activeBundleDiscount = selectedUpgradeMethod === 'installment' ? 0 : bundleDiscount;
            totalBundleDiscount += activeBundleDiscount;

            let monthlyPaid = 0;
            if (batch.paidMonthlyPerSubject) {
                batchSelectedSubjects.forEach(id => {
                    monthlyPaid += batch.paidMonthlyPerSubject[id] || 0;
                });
            } else {
                monthlyPaid = (batch.totalPaidMonthly / (batch.subjectDetails?.length || 1)) * batchSelectedSubjects.length;
            }
            totalMonthlyPaid += monthlyPaid;

            const balanceToPay = Math.max(0, subtotal - activeBundleDiscount - monthlyPaid);
            totalBalanceToPay += balanceToPay;

            if (batch.richConfig?.enableInstallments) {
                const allSelectedAreEligible = batchSelectedSubjects.every(id => (batch.richConfig.installmentSubjects || []).includes(id));
                if (allSelectedAreEligible) {
                    let templateSteps = [];
                    if (batchSelectedCount === 1) {
                        templateSteps = batch.richConfig.installments1 || [];
                    } else if (batchSelectedCount === 2) {
                        templateSteps = batch.richConfig.installments2 || [];
                    } else if (batchSelectedCount === 3) {
                        templateSteps = batch.richConfig.installments3 || [];
                    }

                    if (templateSteps.length > 0) {
                        templateSteps.forEach((step, i) => {
                            const stepNum = i + 1;
                            if (!combinedInstallmentsMap[stepNum]) {
                                combinedInstallmentsMap[stepNum] = 0;
                            }
                            combinedInstallmentsMap[stepNum] += step.amount;
                        });
                    }
                }
            } else {
                selectedDetails.forEach(sub => {
                    if (sub.installmentSteps) {
                        sub.installmentSteps.forEach(step => {
                            const stepNum = step.installmentNum;
                            if (!combinedInstallmentsMap[stepNum]) {
                                combinedInstallmentsMap[stepNum] = 0;
                            }
                            combinedInstallmentsMap[stepNum] += step.amount;
                        });
                    }
                });
            }
        });

        const installments = Object.keys(combinedInstallmentsMap)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map(num => ({
                installmentNum: parseInt(num),
                amount: combinedInstallmentsMap[num]
            }));

        return { subtotal: totalSubtotal, bundleDiscount: totalBundleDiscount, monthlyPaid: totalMonthlyPaid, balanceToPay: totalBalanceToPay, installments };
    };

    const fetchUpgradeDetails = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/upgrade-pricing/calculate');
            if (res.data && (res.data.eligible || res.data.pendingUpgrade)) {
                setEligible(!!res.data.eligible);
                setPendingUpgrade(!!res.data.pendingUpgrade);
                setData(res.data);
            } else {
                setEligible(false);
                setPendingUpgrade(false);
                setData(null);
            }
        } catch (err) {
            console.error("Error checking upgrade eligibility:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUpgradeDetails();
    }, []);

    useEffect(() => {
        if (data && !hideFloatingWidget && !loading) {
            if (eligible) {
                const dismissed = sessionStorage.getItem('upgrade_dismissed');
                if (!dismissed) {
                    setTimeout(() => setShowModal(true), 1500);
                } else {
                    setShowBanner(true);
                }
            } else if (pendingUpgrade) {
                setShowBanner(true);
            }
        }
    }, [eligible, pendingUpgrade, hideFloatingWidget, loading]);

    useEffect(() => {
        if (triggerShow && eligible) setShowModal(true);
    }, [triggerShow, eligible]);

    const dismissModal = () => {
        setShowModal(false);
        if (onClose) onClose();
        if (!hideFloatingWidget) {
            setShowBanner(true);
            sessionStorage.setItem('upgrade_dismissed', 'true');
        }
    };

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

    const removeFile = (index) => {
        setSlipFiles(slipFiles.filter((_, i) => i !== index));
    };

    const pricingResult = getPricing();
    const showInstallmentToggle = data?.batches?.some(b => {
        const batchSelectedSubjects = (b.subjects || []).filter(id => selectedSubjects.includes(id));
        return b.richConfig?.enableInstallments && batchSelectedSubjects.length > 0;
    }) && pricingResult.installments.length > 0;

    const handleProceed = () => {
        if (selectedSubjects.length === 0) {
            return toast.error("Please select at least one subject to upgrade.");
        }
        if (showInstallmentToggle) {
            setShowInstallmentPrompt(true);
        } else {
            setSelectedUpgradeMethod('full');
            setShowPaymentModal(true);
        }
    };

    const handleFinalSubmit = async () => {
        if (submitLock.current) return;
        try {
            submitLock.current = true;
            setSubmitting(true);

            const isInstallment = selectedUpgradeMethod === 'installment';
            let activeBalance = isInstallment && pricingResult.installments.length > 0
                ? pricingResult.installments[0].amount
                : pricingResult.balanceToPay;
            let pMethodChosen = isInstallment ? 'installment' : 'full';

            const orderId = `UPG-${Date.now()}`;

            // 🔥 PAYCORP / SAMPATH IPG PAYMENT
            if (paymentMethod === 'paycorp') {
                if (!agreedToTerms) {
                    toast.error("Please agree to the Terms & Conditions before proceeding.");
                    setSubmitting(false);
                    submitLock.current = false;
                    return;
                }

                const targetBusinessId = data?.batches?.[0]?.businessId || localStorage.getItem('businessId');
                const initRes = await axios.post('/student/paycorp-init', {
                    amount: activeBalance,
                    orderId: orderId,
                    businessId: targetBusinessId
                });

                if (initRes.data && initRes.data.success && initRes.data.paymentUrl) {
                    setShowPaymentModal(false);
                    setPaycorpIframeUrl(initRes.data.paymentUrl);
                } else {
                    toast.error(initRes.data?.message || "Failed to initialize Sampath IPG.");
                    setSubmitting(false);
                    submitLock.current = false;
                }
            }
            // 🔥 MANUAL SLIP PAYMENT
            else {
                await submitUpgradeToBackend('slip', null, activeBalance, pMethodChosen);
            }
        } catch (error) {
            console.error("Error submitting upgrade:", error);
            toast.error(error.message || "Failed to process request.");
            setSubmitting(false);
            submitLock.current = false;
        }
    };

    const submitUpgradeToBackend = async (method, paycorpReqId, activeBalance, pMethodChosen) => {
        try {
            const upgradesPayload = [];
            data.batches.forEach(batch => {
                const batchSelectedSubjects = (batch.subjects || []).filter(id => selectedSubjects.includes(id));
                if (batchSelectedSubjects.length === 0) return;

                const selectedDetails = (batch.subjectDetails || []).filter(sub => selectedSubjects.includes(sub.id));
                const subtotal = selectedDetails.reduce((sum, sub) => sum + sub.upgradeFullTarget, 0);

                let bundleDiscount = 0;
                const batchSelectedCount = batchSelectedSubjects.length;
                const rich = batch.richConfig;
                if (rich && rich.enableBundle) {
                    const bundleSubIds = (rich.bundleSubjects || []).map(x => parseInt(x));
                    const allSelectedAreEligible = batchSelectedSubjects.every(id => bundleSubIds.includes(id));
                    if (allSelectedAreEligible) {
                        if (batchSelectedCount === 2 && rich.bundle2Price > 0) {
                            bundleDiscount = Math.max(0, subtotal - rich.bundle2Price);
                        } else if (batchSelectedCount === 3 && rich.bundle3Price > 0) {
                            bundleDiscount = Math.max(0, subtotal - rich.bundle3Price);
                        }
                    }
                }
                if (bundleDiscount === 0 && batch.bundleDiscountsMap && batch.bundleDiscountsMap[batchSelectedCount] !== undefined) {
                    bundleDiscount = batch.bundleDiscountsMap[batchSelectedCount];
                }
                const activeBundleDiscount = pMethodChosen === 'installment' ? 0 : bundleDiscount;

                let monthlyPaid = 0;
                if (batch.paidMonthlyPerSubject) {
                    batchSelectedSubjects.forEach(id => {
                        monthlyPaid += batch.paidMonthlyPerSubject[id] || 0;
                    });
                } else {
                    monthlyPaid = (batch.totalPaidMonthly / (batch.subjectDetails?.length || 1)) * batchSelectedSubjects.length;
                }

                let batchAmount = 0;
                if (pMethodChosen === 'installment') {
                    let firstInstallmentAmount = 0;
                    if (batch.richConfig?.enableInstallments) {
                        const allSelectedAreEligible = batchSelectedSubjects.every(id => (batch.richConfig.installmentSubjects || []).includes(id));
                        if (allSelectedAreEligible) {
                            let templateSteps = [];
                            if (batchSelectedCount === 1) {
                                templateSteps = batch.richConfig.installments1 || [];
                            } else if (batchSelectedCount === 2) {
                                templateSteps = batch.richConfig.installments2 || [];
                            } else if (batchSelectedCount === 3) {
                                templateSteps = batch.richConfig.installments3 || [];
                            }
                            if (templateSteps.length > 0) {
                                firstInstallmentAmount = templateSteps[0].amount;
                            }
                        }
                    } else {
                        selectedDetails.forEach(sub => {
                            if (sub.installmentSteps && sub.installmentSteps.length > 0) {
                                firstInstallmentAmount += sub.installmentSteps[0].amount;
                            }
                        });
                    }
                    batchAmount = firstInstallmentAmount;
                } else {
                    batchAmount = Math.max(0, subtotal - activeBundleDiscount - monthlyPaid);
                }

                const batchRemarkDetails = pMethodChosen === 'installment'
                    ? `[UPGRADE]: Transitioned to Installment Card (Installment #1 paid upfront). Amount: ${formatPrice(batchAmount)}`
                    : `[UPGRADE]: Transitioned from Monthly to FULL Card. Upgrade Balance: ${formatPrice(batchAmount)}`;

                upgradesPayload.push({
                    businessId: batch.businessId,
                    batchId: batch.batchId,
                    groupId: batch.groupId,
                    subjects: batchSelectedSubjects,
                    paymentMethodChosen: pMethodChosen,
                    amount: batchAmount,
                    remark: `${batchRemarkDetails}. Prev Paid: ${formatPrice(monthlyPaid)}`
                });
            });

            const formData = new FormData();
            formData.append('upgrades', JSON.stringify(upgradesPayload));
            formData.append('method', method);
            formData.append('amount', activeBalance.toFixed(2));
            if (paycorpReqId) formData.append('orderId', paycorpReqId);

            if (upgradesPayload.length > 0) {
                formData.append('businessId', upgradesPayload[0].businessId);
                formData.append('batchId', upgradesPayload[0].batchId);
                formData.append('groupId', upgradesPayload[0].groupId);
                formData.append('subjects', JSON.stringify(selectedSubjects));
                formData.append('paymentMethodChosen', pMethodChosen);
            }

            if (remark) formData.append('remark', remark);

            if (method === 'slip') {
                slipFiles.forEach(file => formData.append('slipImages', file));
            }

            const response = await axios.post('/student/enroll-with-slip', formData);
            if (response.status === 200) {
                toast.success(method === 'slip' ? "Upgrade slip submitted successfully!" : "Upgrade Verified!");
                setShowPaymentModal(false);
                setShowModal(false);
                setPendingUpgrade(true);
                setSlipFiles([]);
                setRemark('');

                await fetchUpgradeDetails();
                window.dispatchEvent(new Event('refreshPayments'));
                if (onClose) onClose();
            }
        } catch (error) {
            throw error;
        }
    };

    if (loading) return null;
    if (!eligible && !pendingUpgrade) return null;

    const activeRich = data?.batches?.find(b => b.richConfig)?.richConfig || data?.batches?.[0]?.richConfig;

    return (
        <>
            {/* COMPACT FLOATING WIDGETS */}
            {compactMode ? (
                <div className="bg-gradient-to-br from-[#0c0a1f] via-[#14122d] to-[#05040a] border-2 border-amber-500/20 p-5 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-left space-y-5 text-white relative overflow-hidden group transition-all duration-500 hover:border-amber-400/40 hover:shadow-[0_20px_50px_rgba(245,158,11,0.15)]">
                    {/* Glowing cosmic gradients in the background */}
                    <div className="absolute -top-12 -right-12 w-28 h-28 bg-amber-500/10 blur-[40px] rounded-full pointer-events-none group-hover:bg-amber-500/20 group-hover:scale-110 transition-all duration-700"></div>
                    <div className="absolute -bottom-16 -left-16 w-28 h-28 bg-[#7b2cbf]/10 blur-[40px] rounded-full pointer-events-none group-hover:bg-[#7b2cbf]/20 transition-all duration-700"></div>

                    {/* Premium Header Banner */}
                    <div className="relative h-32 rounded-2xl bg-gradient-to-tr from-amber-400 via-rose-600 to-[#7b2cbf] overflow-hidden flex items-center p-5 shadow-lg border border-white/10 group-hover:shadow-rose-500/10 transition-all">
                        <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
                        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-black/20 rounded-full blur-md"></div>
                        
                        <div className="relative z-10 space-y-1.5">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[9px] font-black uppercase tracking-widest text-yellow-200 border border-white/20 animate-pulse">
                                <Sparkles size={8} className="fill-yellow-200" /> Special Offer
                            </span>
                            <h4 className="text-base font-black text-white uppercase tracking-wider drop-shadow-md">Monthly to FULL Card</h4>
                            <p className="text-[10px] text-white/90 font-bold max-w-[200px] leading-relaxed">Upgrade and unlock all course contents instantly!</p>
                        </div>
                    </div>

                    {/* Premium Configured Banner Image */}
                    <div className="relative h-44 rounded-2xl overflow-hidden border border-white/10 group shadow-md">
                        <img 
                            src={activeRich?.bannerImage 
                                ? `${backendBaseUrl}/storage/posts/${activeRich.bannerImage}` 
                                : `/upgrade_banner.png`} 
                            alt="Special Offer" 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                            <div className="flex items-center justify-between w-full">
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 rounded-md shadow-sm animate-pulse">Special Offer</span>
                                <span className="text-[9px] font-extrabold text-white/70 tracking-wide">Instant Upgrades Active</span>
                            </div>
                        </div>
                    </div>

                    {/* Interactive Button / Pending Status */}
                    {pendingUpgrade ? (
                        <div className="relative overflow-hidden bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-3 shrink-0">
                            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent animate-pulse"></div>
                            <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin flex items-center justify-center text-amber-500 font-extrabold shrink-0">
                                ⏳
                            </div>
                            <div>
                                <span className="block text-xs font-black text-amber-400 uppercase tracking-widest">Upgrade Verification Pending</span>
                                <span className="block text-[10px] text-white/80 font-semibold mt-1">Our coordinators are validating your payment slip.</span>
                            </div>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setShowModal(true)} 
                            className="w-full py-4.5 bg-gradient-to-r from-amber-500 via-rose-600 to-rose-700 hover:from-amber-400 hover:to-rose-600 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_8px_25px_rgba(225,29,72,0.3)] hover:shadow-[0_8px_30px_rgba(225,29,72,0.5)] active:scale-[0.98] border border-red-500/20 hover:border-red-400 flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                        >
                            <Sparkles size={12} className="text-yellow-200 fill-yellow-200 shrink-0" />
                            <span>Upgrade to Full Card</span>
                            <ChevronRight size={12} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    )}
                </div>
            ) : (
                showBanner && !hideFloatingWidget && (
                    <div className="fixed bottom-24 right-6 z-40 animate-bounce">
                        {pendingUpgrade ? (
                            <div className="flex items-center gap-3 bg-gradient-to-r from-amber-600/90 to-orange-700/90 border border-amber-500/30 text-white px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md max-w-sm">
                                <span className="text-xl animate-pulse">⌛</span>
                                <div className="flex flex-col">
                                    <span className="text-xs font-black uppercase tracking-wider">Upgrade Pending</span>
                                    <span className="text-[10px] text-white/70 leading-normal">Your upgrade slip is awaiting verification.</span>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setShowModal(true)} className="flex items-center gap-3 bg-gradient-to-r from-[#9d4edd] to-[#7b2cbf] hover:from-[#7b2cbf] hover:to-[#5a189a] border border-[#d8f3dc]/10 text-white px-5 py-3.5 rounded-2xl shadow-[0_10px_25px_rgba(157,78,221,0.4)] backdrop-blur-md transition-all active:scale-95">
                                <Sparkles className="text-yellow-300 animate-spin shrink-0" size={16} />
                                <div className="flex flex-col items-start text-left">
                                    <span className="text-xs font-black uppercase tracking-widest text-yellow-200">Upgrade & Save!</span>
                                </div>
                                <ChevronRight size={14} className="opacity-60" />
                            </button>
                        )}
                    </div>
                )
            )}

            {/* MAIN ENROLLMENT STYLE MODAL - 🔥 Z-INDEX FIXED TO 999999 🔥 */}
            {showModal && data && createPortal(
                <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/90 backdrop-blur-lg p-2 md:p-6 overflow-hidden animate-in fade-in duration-300">
                    <div className="bg-[#0f0e1a] border border-white/10 rounded-[2rem] w-full max-w-6xl relative h-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden text-white transition-all duration-300">

                        <button onClick={dismissModal} className="absolute top-4 right-4 md:top-6 md:right-6 text-white/80 hover:text-white bg-black/20 hover:bg-white/10 p-2 rounded-xl transition-all z-20 active:scale-95 border border-white/5">
                            <X size={20} />
                        </button>

                        {data.batches && data.batches.length > 0 ? (
                            <div className="p-4 md:p-8 flex-1 overflow-y-auto custom-scrollbar flex flex-col lg:flex-row gap-6 lg:gap-10 animate-in fade-in duration-200">

                                <div className="flex-1 min-w-0 space-y-6">
                                    <div className="flex items-center gap-4 mb-6 pl-1">
                                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-rose-500/20 to-red-600/20 border border-rose-500/30 text-rose-500 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(225,29,72,0.15)]">
                                            <Sparkles size={24} className="animate-pulse" />
                                        </div>
                                        <div className="flex flex-col">
                                            <h2 className="text-lg md:text-2xl font-black text-white uppercase tracking-wider">Upgrade Special Offer</h2>
                                            <p className="text-rose-400 mt-0.5 md:mt-1 text-[10px] md:text-xs font-bold uppercase tracking-widest">Transition to Full Card Plan</p>
                                        </div>
                                    </div>

                                    {activeRich && activeRich.enableBundle && (
                                        <div className="bg-gradient-to-r from-rose-600/20 via-amber-500/10 to-purple-600/20 border border-rose-500/30 rounded-2xl p-4.5 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                                                    <Gift size={20} className="animate-bounce" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs md:text-sm font-black text-white uppercase tracking-wider">Cosmic Bundle Offers Available!</h4>
                                                    <p className="text-[10px] md:text-xs text-slate-300 font-medium mt-0.5">Select multiple subjects to automatically unlock package discounts.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 flex-wrap">
                                                {activeRich.bundle2Price > 0 && (
                                                    <span className="px-3.5 py-1.5 rounded-xl bg-black/40 border border-rose-500/30 text-rose-300 font-extrabold text-[10px] md:text-xs uppercase tracking-wider shadow-sm">
                                                        2 Subjects: <span className="text-white font-black">{formatPrice(activeRich.bundle2Price)}</span>
                                                    </span>
                                                )}
                                                {activeRich.bundle3Price > 0 && (
                                                    <span className="px-3.5 py-1.5 rounded-xl bg-black/40 border border-amber-500/30 text-amber-300 font-extrabold text-[10px] md:text-xs uppercase tracking-wider shadow-sm animate-pulse">
                                                        3 Subjects: <span className="text-white font-black">{formatPrice(activeRich.bundle3Price)}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-3 pl-1">
                                            <h4 className="text-xs md:text-sm font-bold text-white/80 uppercase tracking-wider">Select Subjects to Upgrade</h4>
                                            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-widest bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                                                {selectedSubjects.length} of {data.batches.reduce((sum, b) => sum + (b.subjectDetails?.length || 0), 0)} Selected
                                            </span>
                                        </div>

                                        <div className="space-y-8">
                                            {data.batches.map((batch) => {
                                                if (!batch.subjectDetails || batch.subjectDetails.length === 0) return null;
                                                return (
                                                    <div key={batch.batchId} className="space-y-3.5">
                                                        <div className="flex items-center justify-between flex-wrap gap-2 pl-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1.5 h-4 bg-gradient-to-b from-rose-500 to-amber-500 rounded-full"></div>
                                                                <h3 className="text-xs md:text-sm font-black text-slate-300 uppercase tracking-wider">
                                                                    {batch.businessName} - {batch.batchName}
                                                                </h3>
                                                            </div>
                                                            {batch.upgradeOption && (
                                                                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                                                                    batch.upgradeOption === 1 
                                                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                                                                        : batch.upgradeOption === 2 
                                                                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' 
                                                                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                                }`}>
                                                                    {batch.upgradeOption === 1 
                                                                        ? 'Option 01 • Month 2 Upgrade' 
                                                                        : batch.upgradeOption === 2 
                                                                            ? 'Option 02 • Month 3 Upgrade' 
                                                                            : 'Option 03 • Month 4 Upgrade (Final Chance)'}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-col gap-3">
                                                            {batch.subjectDetails.map((sub) => {
                                                                const isSelected = selectedSubjects.includes(sub.id);
                                                                const isAlreadyPaid = data.alreadyPaidSubjects && data.alreadyPaidSubjects.includes(sub.id);
                                                                const lecturerImg = getImageUrl(sub.lecturerImage);

                                                                return (
                                                                    <label key={sub.id} className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 md:p-5 rounded-2xl border transition-all gap-4 w-full ${isAlreadyPaid ? 'opacity-60 cursor-not-allowed bg-black/50 border-white/5' :
                                                                            isSelected ? 'bg-rose-600/10 border-rose-500 shadow-lg shadow-rose-500/5 cursor-pointer' : 'bg-black/40 border-white/10 hover:border-white/30 cursor-pointer'
                                                                        }`}>

                                                                        <div className="flex items-center gap-4 flex-1 min-w-0 w-full md:w-auto">
                                                                            <div className="relative flex items-center justify-center shrink-0">
                                                                                <input type="checkbox" disabled={isAlreadyPaid} className="shrink-0 w-5 h-5 rounded border-2 border-white/30 bg-black/50 text-rose-600 focus:ring-rose-600 cursor-pointer appearance-none checked:bg-rose-600 checked:border-transparent disabled:opacity-50"
                                                                                    checked={isSelected}
                                                                                    onChange={() => {
                                                                                        if (isAlreadyPaid) return;
                                                                                        setSelectedSubjects(prev => prev.includes(sub.id) ? prev.filter(id => id !== sub.id) : [...prev, sub.id])
                                                                                    }}
                                                                                />
                                                                                {isSelected && <CheckCircle size={14} className="absolute text-white pointer-events-none" strokeWidth={3} />}
                                                                            </div>
                                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                                    <span className="block font-bold text-white text-base md:text-lg truncate w-full md:w-auto md:max-w-[280px] lg:max-w-[360px] xl:max-w-none">{sub.name}</span>
                                                                                    {sub.code && <span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-bold uppercase tracking-widest shrink-0">{sub.code}</span>}
                                                                                </div>
                                                                                {isAlreadyPaid ? (
                                                                                    <span className="text-[10px] text-green-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-1">
                                                                                        <CheckCircle size={10} /> Already Upgraded
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-1">
                                                                                        Active Monthly Student
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center gap-3 flex-1 min-w-0 w-full md:w-auto md:border-l md:border-white/10 md:pl-4 pl-8 md:pl-0">
                                                                            {lecturerImg ? (
                                                                                <img src={lecturerImg} alt="Lecturer" className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-white/10 shrink-0" />
                                                                            ) : (
                                                                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/20 flex items-center justify-center border border-white/10 shrink-0 text-white/80 text-xs">TBA</div>
                                                                            )}
                                                                            <div className="flex flex-col min-w-0">
                                                                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Lecturer</span>
                                                                                <span className="text-sm md:text-base text-slate-200 font-semibold truncate">{sub.lecturerName || 'TBA'}</span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex flex-col items-start md:items-end flex-none shrink-0 w-full md:w-auto md:min-w-[120px] border-t md:border-none border-white/10 pt-3 md:pt-0">
                                                                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Upgrade Full Price</span>
                                                                            <span className="text-rose-400 font-black text-lg">{formatPrice(sub.upgradeFullTarget)}</span>
                                                                        </div>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full lg:w-[320px] shrink-0">
                                    <div className={`bg-slate-900 border border-white/10 rounded-[2rem] p-5 md:p-6 lg:sticky lg:top-0 transition-opacity duration-200 ${selectedSubjects.length > 0 ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                        <h4 className="text-sm font-extrabold text-white mb-4 uppercase tracking-widest border-b border-white/10 pb-3 flex items-center gap-2"><Wallet size={16} className="text-rose-500" /> Order Summary</h4>

                                        <div className="space-y-2 text-xs text-white/70 mb-5 font-medium">
                                            <div className="flex justify-between items-center bg-black/20 p-2.5 rounded-xl border border-white/5">
                                                <span>Plan:</span>
                                                <span className="font-bold text-white bg-rose-600 px-2 py-1 rounded">Upgrade to Full</span>
                                            </div>
                                            <div className="flex justify-between items-center bg-black/20 p-2.5 rounded-xl border border-white/5">
                                                <span>Subjects Selected:</span>
                                                <span className="font-bold text-white bg-white/10 px-2 py-1 rounded">{selectedSubjects.length}</span>
                                            </div>

                                            <div className="flex justify-between items-center bg-black/20 p-2.5 rounded-xl border border-white/5 mt-2">
                                                <span>Upgrade Subtotal:</span>
                                                <span className="font-bold text-white">{formatPrice(pricingResult.subtotal)}</span>
                                            </div>

                                            {pricingResult.monthlyPaid > 0 && (
                                                <div className="flex justify-between items-center bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                                                    <span className="text-emerald-400">Already Paid Deductions:</span>
                                                    <span className="font-bold text-emerald-400">-{formatPrice(pricingResult.monthlyPaid)}</span>
                                                </div>
                                            )}

                                            {pricingResult.bundleDiscount > 0 && (
                                                <div className="flex justify-between items-center bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                                                    <span className="flex items-center gap-1 text-rose-400"><Gift size={12} /> Bundle Discount:</span>
                                                    <span className="font-bold text-rose-400">-{formatPrice(pricingResult.bundleDiscount)}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-4">
                                            <div>
                                                <span className="block text-[9px] text-white/80 uppercase font-bold tracking-widest mb-0.5 text-center">Net Upgrade Balance</span>
                                                <span className="block text-2xl text-white font-black text-center mb-1">{formatPrice(pricingResult.balanceToPay)}</span>
                                            </div>
                                            <button onClick={handleProceed} className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-black py-3.5 rounded-xl flex justify-center items-center transition-colors text-xs uppercase tracking-widest border border-red-500/50 shadow-lg shadow-red-500/20">
                                                Proceed to Pay <ChevronRight className="ml-1" size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>,
                document.body
            )}

            {/* INSTALLMENT PROMPT MODAL - 🔥 Z-INDEX FIXED TO 999999 🔥 */}
            {showInstallmentPrompt && createPortal(
                <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-hidden">
                    <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-6 max-w-sm w-full relative shadow-2xl animate-in zoom-in-95 duration-200">
                        <button onClick={() => setShowInstallmentPrompt(false)} className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 p-2 rounded-xl"><X size={18} /></button>
                        <h2 className="text-xl font-extrabold text-white mb-2">Payment Options</h2>
                        <p className="text-white/90 text-xs mb-6 font-medium">Pay the full upgrade balance now or choose installments.</p>

                        <div className="flex flex-col gap-3">
                            <button onClick={() => { setSelectedUpgradeMethod('full'); setShowInstallmentPrompt(false); setShowPaymentModal(true); }}
                                className="w-full bg-black/20 hover:bg-rose-600/20 border border-white/10 hover:border-rose-500/50 text-left p-4 rounded-2xl transition-colors group">
                                <span className="block text-[10px] text-white/80 mb-1 uppercase tracking-widest font-bold group-hover:text-rose-400">Option 1</span>
                                <span className="block text-sm text-white font-extrabold mb-1">Pay Full Amount</span>
                                <span className="block text-xl text-rose-500 font-black">{formatPrice(pricingResult.balanceToPay)}</span>
                            </button>

                            <button onClick={() => { setSelectedUpgradeMethod('installment'); setShowInstallmentPrompt(false); setShowPaymentModal(true); }}
                                className="w-full bg-black/20 hover:bg-white/10 border border-white/10 text-left p-4 rounded-2xl transition-colors group">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="block text-[10px] text-white/80 uppercase tracking-widest font-bold">Option 2</span>
                                    <span className="bg-yellow-500/20 text-yellow-400 text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-widest border border-yellow-500/30">Available</span>
                                </div>
                                <span className="block text-sm text-white font-extrabold mb-3">Pay via Installments</span>

                                <div className="bg-black/40 rounded-xl p-3 mb-3 space-y-2 border border-white/5">
                                    {pricingResult.installments.map((step, idx) => (
                                        <div key={idx} className="flex justify-between text-xs font-medium text-white/70">
                                            <span>Part {step.installmentNum}:</span>
                                            <span className="text-white font-bold bg-black/20 px-2 rounded border border-white/10">{formatPrice(step.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-rose-600 text-white font-extrabold py-3 rounded-xl text-xs text-center shadow-lg">
                                    Select & Pay {formatPrice(pricingResult.installments[0]?.amount)} Today
                                </div>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* SLIP UPLOAD / SUBMIT PAYMENT MODAL - 🔥 Z-INDEX FIXED TO 999999 🔥 */}
            {showPaymentModal && createPortal(
                <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-hidden">
                    <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 w-full max-w-md relative overflow-y-auto max-h-[90vh] shadow-2xl flex flex-col custom-scrollbar">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-extrabold text-white mb-1">Submit Payment</h2>
                                <p className="text-white/90 font-medium text-xs">Choose how you want to pay the upgrade amount.</p>
                            </div>
                            <button onClick={() => setShowPaymentModal(false)} className="text-white/80 hover:text-white bg-white/10 p-2 rounded-xl shrink-0"><X size={18} /></button>
                        </div>

                        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-center mb-6 shadow-inner shrink-0">
                            <span className="block text-[10px] text-white/80 uppercase font-bold tracking-widest mb-1">Amount to Pay Now</span>
                            <span className="block text-3xl text-rose-500 font-black">
                                {selectedUpgradeMethod === 'installment' ? formatPrice(pricingResult.installments[0]?.amount) : formatPrice(pricingResult.balanceToPay)}
                            </span>
                        </div>

                        {/* 🔥 Payment Method Tabs 🔥 */}
                        <div className="flex gap-2 bg-black/40 p-1 rounded-2xl border border-white/10 mb-6 shrink-0">
                            <button onClick={() => setPaymentMethod('slip')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${paymentMethod === 'slip' ? 'bg-white/10 text-white border border-white/10 shadow' : 'text-white/80 hover:text-white/80'}`}>Bank Slip</button>
                            <button onClick={() => setPaymentMethod('paycorp')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${paymentMethod === 'paycorp' ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/50 shadow' : 'text-emerald-500/70 hover:text-emerald-400'}`}>Sampath IPG</button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 mb-4 custom-scrollbar">
                            {paymentMethod === 'slip' ? (
                                <>
                                    <div className="border-2 border-dashed border-white/20 bg-black/20 rounded-[1.5rem] p-6 text-center hover:border-rose-500/50 hover:bg-rose-500/5 transition-colors cursor-pointer mb-4 group relative" onClick={() => document.getElementById('upgrade-slip-upload')?.click()}>
                                        <div className="absolute top-3 right-3 bg-blue-500 text-white p-1 rounded-full"><Info size={14} /></div>
                                        {/* Primary File Input: Opens Gallery / Files (NO capture="environment") */}
                                        <input type="file" id="upgrade-slip-upload" className="hidden" multiple accept="image/*,application/pdf" onChange={handleFileChange} />
                                        {/* Dedicated Direct Camera Input */}
                                        <input type="file" id="upgrade-slip-upload-camera" className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
                                        <div className="flex flex-col items-center w-full">
                                            <div className="flex gap-3 mb-2 text-white/70 group-hover:text-rose-500 transition-colors">
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
                                                    onClick={() => document.getElementById('upgrade-slip-upload')?.click()}
                                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 border border-white/20 shadow-sm transition-all active:scale-95"
                                                >
                                                    <UploadCloud size={14} className="text-rose-400" />
                                                    <span>Gallery / Files</span>
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => document.getElementById('upgrade-slip-upload-camera')?.click()}
                                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 border border-white/20 shadow-sm transition-all active:scale-95"
                                                >
                                                    <Camera size={14} className="text-emerald-400" />
                                                    <span>Camera</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {slipFiles.length > 0 && (
                                        <div className="mb-4 bg-black/40 p-3 rounded-xl border border-white/5 space-y-1.5">
                                            {slipFiles.map((file, i) => (
                                                <div key={i} className="flex justify-between items-center text-xs">
                                                    <div className="flex items-center gap-2 truncate pr-3">
                                                        <Paperclip size={12} className="text-white/80 shrink-0" />
                                                        <span className="text-white truncate">{file.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className="text-white/80">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                                                        <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="text-rose-400 hover:text-rose-300"><X size={14} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-1 block">Remark (Optional)</label>
                                        <textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Type any message..." rows="2" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-rose-500 transition-colors resize-none"></textarea>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4">
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
                                            I have read and agree to the <a href="/terms" target="_blank" onClick={(e) => e.stopPropagation()} className="text-blue-400 font-bold hover:underline">Terms & Conditions</a>. I understand that all online payments are strictly non-refundable.
                                        </span>
                                    </label>
                                </div>
                            )}
                        </div>

                        <button onClick={handleFinalSubmit} disabled={submitting || (paymentMethod === 'slip' && slipFiles.length === 0) || (paymentMethod === 'paycorp' && !agreedToTerms)}
                            className="w-full shrink-0 bg-gradient-to-r from-red-600 to-red-800 text-white font-black py-3.5 rounded-xl transition-colors hover:from-red-500 hover:to-red-700 disabled:opacity-50 text-xs uppercase tracking-widest border border-red-500/50 shadow-lg mt-2">
                            {submitting ? 'Processing...' : (paymentMethod === 'paycorp' ? 'Pay via Sampath IPG' : 'Confirm Upgrade Payment')}
                        </button>
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
                                    setSubmitting(false);
                                    submitLock.current = false;
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
        </>
    );
};

export default UpgradeOfferWidget;