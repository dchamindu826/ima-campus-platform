import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../api/axios';
import { toast } from 'react-hot-toast';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import {
    Printer, Download, RefreshCw, CheckSquare, Square,
    Calendar, DollarSign, PhoneCall, Building2, Sparkles,
    FileText, CheckCircle2, ShieldCheck, CreditCard, ChevronRight,
    Edit3, Info, Copy, Plus, Trash2, X, Image as ImageIcon, Loader2
} from 'lucide-react';

export default function LumiInvoiceGenerator() {
    // Current month defaults
    const getInitialMonth = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    };

    const [selectedMonth, setSelectedMonth] = useState(getInitialMonth);
    const [invoiceNo, setInvoiceNo] = useState(`INV-SR-${getInitialMonth().replace('-', '')}-001`);
    const [invoiceDate, setInvoiceDate] = useState(() => {
        const now = new Date();
        return now.toISOString().split('T')[0];
    });

    const [loading, setLoading] = useState(true);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [downloadingImg, setDownloadingImg] = useState(false);
    const [pdfOrientation, setPdfOrientation] = useState('portrait'); // 'portrait' | 'landscape'
    const [rateConfig, setRateConfig] = useState({
        fixedRentalPerNumber: 2500,
        costPerMinute: 5.0
    });
    const [bankDetails, setBankDetails] = useState({
        accountNumber: "115452324957",
        bankName: "Sampath Bank",
        branch: "Aralaganwila Branch",
        accountName: "Chamindu Dilshan"
    });

    // Business items list
    const [businessItems, setBusinessItems] = useState([]);
    const [allAvailableBusinesses, setAllAvailableBusinesses] = useState([]);

    // Add Custom Business / Item Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newBizForm, setNewBizForm] = useState({
        selectedBizId: 'custom',
        customName: '',
        freeMins: 0,
        afterMins: 0,
        fixedFee: 2500,
        ratePerMin: 5.0
    });

    const invoiceRef = useRef(null);

    useEffect(() => {
        fetchInvoiceData();
    }, [selectedMonth]);

    const fetchInvoiceData = async () => {
        setLoading(true);
        try {
            // First fetch available businesses from CRM
            const bizListRes = await api.get('/admin/staff/businesses').catch(() => ({ data: [] }));
            const crmBusinesses = Array.isArray(bizListRes.data) ? bizListRes.data : [];
            setAllAvailableBusinesses(crmBusinesses);

            // Fetch invoice stats data
            let res;
            try {
                res = await api.get(`/admin/staff/lumi-invoice-data?month=${selectedMonth}`);
            } catch (err) {
                console.warn("Using fallback businesses list for invoice generator", err);
            }

            if (res && res.data && Array.isArray(res.data.businesses) && res.data.businesses.length > 0) {
                if (res.data.rateConfig) setRateConfig(res.data.rateConfig);
                if (res.data.bankDetails) setBankDetails(res.data.bankDetails);

                const items = res.data.businesses.map(b => ({
                    id: b.id,
                    name: b.name,
                    logo: b.logo,
                    selected: true,
                    freeSeminar: {
                        selected: true,
                        callCount: b.freeSeminar?.callCount || 0,
                        minutes: b.freeSeminar?.durationMinutes || 0,
                        fixedFee: b.freeSeminar?.fixedRental || 2500,
                        ratePerMin: b.freeSeminar?.ratePerMinute || 5.0
                    },
                    afterSeminar: {
                        selected: true,
                        callCount: b.afterSeminar?.callCount || 0,
                        minutes: b.afterSeminar?.durationMinutes || 0,
                        fixedFee: b.afterSeminar?.fixedRental || 2500,
                        ratePerMin: b.afterSeminar?.ratePerMinute || 5.0
                    }
                }));

                setBusinessItems(items);
            } else if (crmBusinesses.length > 0) {
                const items = crmBusinesses.map(b => ({
                    id: b.id,
                    name: b.name,
                    logo: b.logo,
                    selected: true,
                    freeSeminar: {
                        selected: true,
                        callCount: 0,
                        minutes: 0,
                        fixedFee: 2500,
                        ratePerMin: 5.0
                    },
                    afterSeminar: {
                        selected: true,
                        callCount: 0,
                        minutes: 0,
                        fixedFee: 2500,
                        ratePerMin: 5.0
                    }
                }));
                setBusinessItems(items);
            }

            const monthClean = selectedMonth.replace('-', '');
            setInvoiceNo(`INV-SR-${monthClean}-001`);
        } catch (error) {
            console.error("Failed to load invoice data:", error);
            toast.error("Failed to fetch monthly calling data");
        }
        setLoading(false);
    };

    // Helper for Business Logo URLs
    const getBusinessLogoUrl = (logo, name) => {
        if (!logo || logo === 'default.png' || logo === 'null' || logo === 'undefined') {
            return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Business')}&background=4F46E5&color=fff&bold=true`;
        }
        if (logo.startsWith('http://') || logo.startsWith('https://')) return logo;
        return `/storage/icons/${logo}`;
    };

    // Toggle entire business
    const toggleBusiness = (id) => {
        setBusinessItems(prev => prev.map(b => {
            if (b.id === id) {
                const nextSelected = !b.selected;
                return {
                    ...b,
                    selected: nextSelected,
                    freeSeminar: { ...b.freeSeminar, selected: nextSelected },
                    afterSeminar: { ...b.afterSeminar, selected: nextSelected }
                };
            }
            return b;
        }));
    };

    // Toggle specific campaign for a business
    const toggleCampaign = (bizId, campaignType) => {
        setBusinessItems(prev => prev.map(b => {
            if (b.id === bizId) {
                const updatedCampaign = {
                    ...b[campaignType],
                    selected: !b[campaignType].selected
                };
                const anySelected = campaignType === 'freeSeminar'
                    ? (updatedCampaign.selected || b.afterSeminar?.selected)
                    : (b.freeSeminar?.selected || updatedCampaign.selected);

                return {
                    ...b,
                    [campaignType]: updatedCampaign,
                    selected: anySelected
                };
            }
            return b;
        }));
    };

    // Update minutes override
    const handleMinutesChange = (bizId, campaignType, value) => {
        const num = Math.max(0, parseInt(value) || 0);
        setBusinessItems(prev => prev.map(b => {
            if (b.id === bizId) {
                return {
                    ...b,
                    [campaignType]: {
                        ...b[campaignType],
                        minutes: num
                    }
                };
            }
            return b;
        }));
    };

    // Remove a business from the invoice
    const handleRemoveBusiness = (bizId) => {
        setBusinessItems(prev => prev.filter(b => b.id !== bizId));
        toast.success("Business removed from invoice");
    };

    // Select / Deselect All
    const handleSelectAll = (selectStatus) => {
        setBusinessItems(prev => prev.map(b => ({
            ...b,
            selected: selectStatus,
            freeSeminar: { ...b.freeSeminar, selected: selectStatus },
            afterSeminar: { ...b.afterSeminar, selected: selectStatus }
        })));
    };

    // Add Custom Business / Item
    const handleAddCustomBusiness = () => {
        let name = newBizForm.customName.trim();
        let logo = null;
        let bizId = Date.now();

        if (newBizForm.selectedBizId !== 'custom') {
            const foundBiz = allAvailableBusinesses.find(b => String(b.id) === String(newBizForm.selectedBizId));
            if (foundBiz) {
                name = foundBiz.name;
                logo = foundBiz.logo;
                bizId = foundBiz.id;
            }
        }

        if (!name) {
            toast.error("Please enter a business name or select an existing business");
            return;
        }

        // Check if already in list
        const existing = businessItems.find(b => b.id === bizId || b.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            toast.error(`"${name}" is already added in the invoice table.`);
            return;
        }

        const newItem = {
            id: bizId,
            name: name,
            logo: logo,
            selected: true,
            freeSeminar: {
                selected: true,
                callCount: 0,
                minutes: newBizForm.freeMins || 0,
                fixedFee: newBizForm.fixedFee || 2500,
                ratePerMin: newBizForm.ratePerMin || 5.0
            },
            afterSeminar: {
                selected: true,
                callCount: 0,
                minutes: newBizForm.afterMins || 0,
                fixedFee: newBizForm.fixedFee || 2500,
                ratePerMin: newBizForm.ratePerMin || 5.0
            }
        };

        setBusinessItems(prev => [newItem, ...prev]);
        setIsAddModalOpen(false);
        setNewBizForm({
            selectedBizId: 'custom',
            customName: '',
            freeMins: 0,
            afterMins: 0,
            fixedFee: 2500,
            ratePerMin: 5.0
        });
        toast.success(`Added ${name} to invoice!`);
    };

    // Calculate invoice totals in Grouped format (1 row per business)
    const calculations = useMemo(() => {
        let totalActiveNumbers = 0;
        let totalFixedRental = 0;
        let totalMinutes = 0;
        let totalUsageAmount = 0;
        let groupedRows = [];

        businessItems.forEach((b) => {
            if (!b.selected) return;

            const isFreeActive = b.freeSeminar?.selected;
            const isAfterActive = b.afterSeminar?.selected;

            if (!isFreeActive && !isAfterActive) return;

            // Free Sem stats
            const freeFixed = isFreeActive ? (b.freeSeminar.fixedFee || rateConfig.fixedRentalPerNumber) : 0;
            const freeMins = isFreeActive ? (b.freeSeminar.minutes || 0) : 0;
            const freeRate = b.freeSeminar?.ratePerMin || rateConfig.costPerMinute;
            const freeUsage = freeMins * freeRate;

            // After Sem stats
            const afterFixed = isAfterActive ? (b.afterSeminar.fixedFee || rateConfig.fixedRentalPerNumber) : 0;
            const afterMins = isAfterActive ? (b.afterSeminar.minutes || 0) : 0;
            const afterRate = b.afterSeminar?.ratePerMin || rateConfig.costPerMinute;
            const afterUsage = afterMins * afterRate;

            // Row Totals
            const rowNumbers = (isFreeActive ? 1 : 0) + (isAfterActive ? 1 : 0);
            const rowFixed = freeFixed + afterFixed;
            const rowMins = freeMins + afterMins;
            const rowUsage = freeUsage + afterUsage;
            const rowTotal = rowFixed + rowUsage;

            totalActiveNumbers += rowNumbers;
            totalFixedRental += rowFixed;
            totalMinutes += rowMins;
            totalUsageAmount += rowUsage;

            groupedRows.push({
                bizId: b.id,
                bizName: b.name,
                bizLogo: b.logo,
                free: {
                    active: isFreeActive,
                    fixed: freeFixed,
                    mins: freeMins,
                    usage: freeUsage
                },
                after: {
                    active: isAfterActive,
                    fixed: afterFixed,
                    mins: afterMins,
                    usage: afterUsage
                },
                rowFixed,
                rowMins,
                rowUsage,
                rowTotal
            });
        });

        const grandTotal = totalFixedRental + totalUsageAmount;

        return {
            totalActiveNumbers,
            totalFixedRental,
            totalMinutes,
            totalUsageAmount,
            grandTotal,
            groupedRows
        };
    }, [businessItems, rateConfig]);

    // 📄 1-CLICK DIRECT A4 PDF DOWNLOAD (SUPPORTS PORTRAIT & LANDSCAPE FIT)
    const handleDownloadInvoicePDF = async (orientation = pdfOrientation) => {
        if (!invoiceRef.current) return;
        setDownloadingPdf(true);
        const isLandscape = orientation === 'landscape';
        const toastId = toast.loading(`Generating Official A4 PDF (${isLandscape ? 'Landscape' : 'Portrait'})...`);
        try {
            await new Promise(r => setTimeout(r, 120));

            const element = invoiceRef.current;

            const imgData = await toPng(element, {
                quality: 1,
                pixelRatio: 2.5,
                backgroundColor: '#ffffff',
                cacheBust: true,
                style: {
                    borderRadius: '0px',
                    margin: '0px'
                }
            });

            const pdf = new jsPDF({
                orientation: isLandscape ? 'landscape' : 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true
            });

            const pageWidth = isLandscape ? 297 : 210;
            const pageHeight = isLandscape ? 210 : 297;
            const margin = 6;
            const printableWidth = pageWidth - (margin * 2);
            const printableHeight = pageHeight - (margin * 2);

            const img = new Image();
            img.src = imgData;
            await new Promise((resolve) => { img.onload = resolve; });

            const imgRatio = img.height / img.width;
            let renderWidth = printableWidth;
            let renderHeight = printableWidth * imgRatio;

            if (renderHeight <= printableHeight) {
                const offsetY = margin + Math.max(0, (printableHeight - renderHeight) / 4);
                pdf.addImage(imgData, 'PNG', margin, offsetY, renderWidth, renderHeight, undefined, 'FAST');
            } else if (renderHeight <= printableHeight * 1.35) {
                const scale = printableHeight / renderHeight;
                const scaledWidth = renderWidth * scale;
                const scaledHeight = printableHeight;
                const offsetX = margin + (printableWidth - scaledWidth) / 2;
                pdf.addImage(imgData, 'PNG', offsetX, margin, scaledWidth, scaledHeight, undefined, 'FAST');
            } else {
                let heightLeft = renderHeight;
                let position = margin;

                pdf.addImage(imgData, 'PNG', margin, position, renderWidth, renderHeight, undefined, 'FAST');
                heightLeft -= printableHeight;

                while (heightLeft > 0) {
                    position = heightLeft - renderHeight + margin;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', margin, position, renderWidth, renderHeight, undefined, 'FAST');
                    heightLeft -= printableHeight;
                }
            }

            const orientSuffix = isLandscape ? 'LANDSCAPE' : 'PORTRAIT';
            pdf.save(`${invoiceNo || 'SMART_REPLY_INVOICE'}_${orientSuffix}.pdf`);
            toast.success(`Invoice PDF (${isLandscape ? 'Landscape' : 'Portrait'}) Downloaded Successfully!`, { id: toastId });
        } catch (error) {
            console.error("PDF generation failed:", error);
            toast.error("Failed to generate PDF download. Please try again.", { id: toastId });
        }
        setDownloadingPdf(false);
    };

    // 📥 1-CLICK DIRECT HIGH-RES PNG IMAGE DOWNLOAD
    const handleDownloadInvoiceImage = async () => {
        if (!invoiceRef.current) return;
        setDownloadingImg(true);
        const toastId = toast.loading("Generating high-resolution invoice image...");
        try {
            await new Promise(r => setTimeout(r, 100));

            const dataUrl = await toPng(invoiceRef.current, {
                quality: 1,
                pixelRatio: 2.5,
                backgroundColor: '#ffffff',
                cacheBust: true,
                style: {
                    borderRadius: '0px',
                    margin: '0px'
                }
            });

            const link = document.createElement('a');
            link.download = `${invoiceNo || 'SMART_REPLY_INVOICE'}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success("Invoice image downloaded successfully!", { id: toastId });
        } catch (error) {
            console.error("Invoice download failed:", error);
            toast.error("Failed to generate image download.", { id: toastId });
        }
        setDownloadingImg(false);
    };

    // 🖨️ Clean Standalone Print Window
    const handleCleanPrint = () => {
        if (!invoiceRef.current) return;

        const invoiceContent = invoiceRef.current.innerHTML;
        const printWindow = window.open('', '_blank', `width=${pdfOrientation === 'landscape' ? '1100' : '1000'},height=900`);

        if (!printWindow) {
            window.print();
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>${invoiceNo} - SMART REPLY</title>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
                        body {
                            font-family: 'Plus Jakarta Sans', sans-serif;
                            background: #ffffff;
                            margin: 0;
                            padding: 20px;
                            color: #1e293b;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        @page {
                            size: A4 ${pdfOrientation};
                            margin: 8mm;
                        }
                    </style>
                </head>
                <body>
                    <div style="max-width: ${pdfOrientation === 'landscape' ? '1100px' : '900px'}; margin: 0 auto;">
                        ${invoiceContent}
                    </div>
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.focus();
                                window.print();
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    // Copy Summary Text
    const handleCopySummary = () => {
        const monthText = new Date(selectedMonth + "-01").toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const summaryText = `*🧾 SMART REPLY WHATSAPP CALLER SERVICE INVOICE*\n` +
            `*Invoice No:* ${invoiceNo}\n` +
            `*Period:* ${monthText}\n` +
            `*Billed To:* IMA Campus (Pvt) Ltd\n` +
            `------------------------------------\n` +
            `*📞 Active Number Rentals:* ${calculations.totalActiveNumbers} Numbers @ LKR 2,500/- = LKR ${calculations.totalFixedRental.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
            `*⏱️ Total Outbound Minutes:* ${calculations.totalMinutes} Mins @ LKR 5.00/min = LKR ${calculations.totalUsageAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
            `------------------------------------\n` +
            `*💰 GRAND TOTAL AMOUNT:* LKR ${calculations.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n\n` +
            `*🏦 Bank Details for Payment:*\n` +
            `Bank: ${bankDetails.bankName}\n` +
            `Branch: ${bankDetails.branch}\n` +
            `Account No: ${bankDetails.accountNumber}\n` +
            `Account Name: ${bankDetails.accountName}\n\n` +
            `_Auto generated by SMART REPLY System_`;

        navigator.clipboard.writeText(summaryText);
        toast.success("Invoice summary copied to clipboard!");
    };

    const formatLKR = (amount) => {
        return Number(amount || 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const monthFormatted = useMemo(() => {
        try {
            return new Date(selectedMonth + "-01").toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } catch (e) {
            return selectedMonth;
        }
    }, [selectedMonth]);

    return (
        <div className="space-y-6 font-sans text-slate-200">

            {/* Embedded Isolation Print Style to 100% prevent sidebar leak */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #smart-reply-invoice-sheet, #smart-reply-invoice-sheet * {
                        visibility: visible !important;
                    }
                    #smart-reply-invoice-sheet {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 16px !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: #ffffff !important;
                    }
                    aside, nav, header, [class*="sidebar"], [class*="Sidebar"] {
                        display: none !important;
                    }
                }
            `}} />

            {/* Top Interactive Configuration Deck (Hidden during Print) */}
            <div className="print:hidden bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-md space-y-6">

                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-6 border-b border-slate-800">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
                            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                                <FileText className="text-indigo-400" size={24} />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                                Smart Reply WhatsApp Caller Invoice Generator
                                <span className="bg-gradient-to-r from-pink-500/20 to-indigo-500/20 text-pink-400 border border-pink-500/30 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full">
                                    Smart Reply AI
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400">Generate clean consolidated monthly billing statements for IMA Campus</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition-all shadow-sm"
                        >
                            <Plus size={15} />
                            Add Business
                        </button>

                        <button
                            onClick={fetchInvoiceData}
                            disabled={loading}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition-all shadow-sm"
                        >
                            <RefreshCw size={14} className={loading ? "animate-spin text-indigo-400" : "text-indigo-400"} />
                            Refresh
                        </button>

                        <button
                            onClick={handleCopySummary}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition-all shadow-sm"
                        >
                            <Copy size={14} className="text-emerald-400" />
                            Copy Text
                        </button>

                        {/* PDF Orientation Mode Selector (Portrait vs Landscape) */}
                        <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-xl p-1 shadow-sm">
                            <button
                                type="button"
                                onClick={() => setPdfOrientation('portrait')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    pdfOrientation === 'portrait'
                                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-700/40'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                                title="A4 Portrait Orientation (Standard Vertical)"
                            >
                                <FileText size={13} />
                                Portrait
                            </button>
                            <button
                                type="button"
                                onClick={() => setPdfOrientation('landscape')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    pdfOrientation === 'landscape'
                                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-700/40'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                                title="A4 Landscape Orientation (Wide Horizontal)"
                            >
                                <FileText size={13} className="rotate-90" />
                                Landscape
                            </button>
                        </div>

                        {/* 📄 1-CLICK DIRECT PDF DOWNLOAD BUTTON */}
                        <button
                            onClick={() => handleDownloadInvoicePDF(pdfOrientation)}
                            disabled={downloadingPdf}
                            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 transition-all hover:scale-105 disabled:opacity-50"
                            title={`Download A4 PDF in ${pdfOrientation.toUpperCase()} orientation`}
                        >
                            {downloadingPdf ? (
                                <>
                                    <Loader2 size={15} className="animate-spin" />
                                    Generating {pdfOrientation === 'landscape' ? 'Landscape' : 'Portrait'} PDF...
                                </>
                            ) : (
                                <>
                                    <Download size={15} />
                                    Download PDF ({pdfOrientation === 'landscape' ? 'Landscape' : 'Portrait'})
                                </>
                            )}
                        </button>

                        {/* 🖼️ 1-CLICK DIRECT IMAGE DOWNLOAD BUTTON */}
                        <button
                            onClick={handleDownloadInvoiceImage}
                            disabled={downloadingImg}
                            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 disabled:opacity-50"
                        >
                            {downloadingImg ? (
                                <>
                                    <Loader2 size={15} className="animate-spin" />
                                    Downloading Image...
                                </>
                            ) : (
                                <>
                                    <ImageIcon size={15} />
                                    Download Image
                                </>
                            )}
                        </button>

                        {/* 🖨️ CLEAN PRINT / VIEW */}
                        <button
                            onClick={handleCleanPrint}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition-all shadow-sm"
                        >
                            <Printer size={15} />
                            Print
                        </button>
                    </div>
                </div>

                {/* Configuration Controls Bar (Due Date Removed) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                    {/* Month Picker */}
                    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-3.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
                            <Calendar size={12} className="text-indigo-400" /> Billing Month
                        </label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-white outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>

                    {/* Invoice Number */}
                    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-3.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
                            <FileText size={12} className="text-purple-400" /> Invoice Number
                        </label>
                        <input
                            type="text"
                            value={invoiceNo}
                            onChange={(e) => setInvoiceNo(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-white outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>

                    {/* Invoice Date */}
                    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-3.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
                            <Calendar size={12} className="text-emerald-400" /> Invoice Date
                        </label>
                        <input
                            type="date"
                            value={invoiceDate}
                            onChange={(e) => setInvoiceDate(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-white outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Business Selection & Campaign Configuration Matrix */}
                <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                            <Building2 size={16} className="text-indigo-400" />
                            Configured CRM Businesses & Hotlines ({businessItems.length})
                        </h3>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handleSelectAll(true)}
                                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                            >
                                <CheckSquare size={13} /> Select All
                            </button>
                            <span className="text-slate-600">•</span>
                            <button
                                onClick={() => handleSelectAll(false)}
                                className="text-xs font-bold text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-1"
                            >
                                <Square size={13} /> Deselect All
                            </button>
                        </div>
                    </div>

                    {/* Business Grid with live toggles & minute editing */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {businessItems.map((biz) => {
                            const isBizActive = biz.selected;
                            const logoUrl = getBusinessLogoUrl(biz.logo, biz.name);

                            return (
                                <div
                                    key={biz.id}
                                    className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 relative ${isBizActive ? 'bg-slate-800/90 border-slate-700 shadow-md' : 'bg-slate-900/40 border-slate-800/80 opacity-60'}`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => toggleBusiness(biz.id)}
                                                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isBizActive ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
                                            >
                                                {isBizActive ? <CheckSquare size={14} /> : <Square size={14} />}
                                            </button>

                                            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                                                <img
                                                    src={logoUrl}
                                                    alt={biz.name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(biz.name)}&background=4F46E5&color=fff&bold=true`;
                                                    }}
                                                />
                                            </div>

                                            <div>
                                                <h4 className="text-xs font-bold text-slate-100 truncate max-w-[140px]">
                                                    {biz.name}
                                                </h4>
                                                <span className="text-[9px] font-semibold text-slate-400">
                                                    {isBizActive ? 'Active in Invoice' : 'Disabled'}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleRemoveBusiness(biz.id)}
                                            title="Remove from invoice"
                                            className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>

                                    {/* Campaign lines for this business */}
                                    <div className="space-y-2 pt-2 border-t border-slate-700/60 text-xs">

                                        {/* Free Seminar Line */}
                                        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={biz.freeSeminar?.selected}
                                                    onChange={() => toggleCampaign(biz.id, 'freeSeminar')}
                                                    className="rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                                                />
                                                <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                                                    🟢 Free Seminar
                                                </span>
                                            </label>

                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="number"
                                                    value={biz.freeSeminar?.minutes || 0}
                                                    onChange={(e) => handleMinutesChange(biz.id, 'freeSeminar', e.target.value)}
                                                    className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-xs font-semibold text-emerald-400 outline-none focus:border-indigo-500"
                                                    title="Billable Outbound Minutes"
                                                />
                                                <span className="text-[10px] font-semibold text-slate-400">mins</span>
                                            </div>
                                        </div>

                                        {/* After Seminar Line */}
                                        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={biz.afterSeminar?.selected}
                                                    onChange={() => toggleCampaign(biz.id, 'afterSeminar')}
                                                    className="rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                                                />
                                                <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                                                    🟣 After Seminar
                                                </span>
                                            </label>

                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="number"
                                                    value={biz.afterSeminar?.minutes || 0}
                                                    onChange={(e) => handleMinutesChange(biz.id, 'afterSeminar', e.target.value)}
                                                    className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-xs font-semibold text-purple-400 outline-none focus:border-indigo-500"
                                                    title="Billable Outbound Minutes"
                                                />
                                                <span className="text-[10px] font-semibold text-slate-400">mins</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 🧾 ACTUAL INVOICE DOCUMENT (SMART REPLY BRANDING - SINGLE-PAGE A4 FORMAT) */}
            <div
                id="smart-reply-invoice-sheet"
                ref={invoiceRef}
                className="bg-white text-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl border border-slate-200 max-w-5xl mx-auto print:max-w-none print:m-0 print:p-4 print:shadow-none print:border-none print:rounded-none font-sans"
            >
                {/* Invoice Top Header - With SMART REPLY Branding & IMA Details */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b-2 border-slate-200">

                    {/* Left: SMART REPLY Logo & Branding */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-3">
                            <img
                                src="/smart_reply_logo.png"
                                alt="Smart Reply"
                                className="h-16 sm:h-20 max-w-[280px] w-auto object-contain drop-shadow-xs"
                            />
                        </div>
                        <div className="text-[11px] text-slate-600 space-y-0.5 font-medium leading-tight pt-0.5">
                            <p className="font-bold text-slate-900 text-xs tracking-tight">SMART REPLY (PVT) LTD</p>
                            <p className="text-slate-500">Automate | Innovate | Elevate • AI WhatsApp Calling & Voice Cloud</p>
                            <p>Web: <span className="font-semibold text-indigo-700">www.smartreply.ai</span> • Email: <span className="font-semibold text-indigo-700">billing@smartreply.ai</span></p>
                        </div>
                    </div>

                    {/* Right: IMA Campus Logo & Invoice Details (Due Date Removed) */}
                    <div className="flex flex-col items-start sm:items-end gap-1.5">
                        <div className="flex items-center gap-3">
                            <img
                                src="/logo.png"
                                alt="IMA Campus"
                                className="h-14 sm:h-16 w-auto object-contain"
                            />
                            <div className="text-right">
                                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight uppercase leading-none">
                                    INVOICE
                                </h1>
                                <span className="inline-block bg-gradient-to-r from-pink-50 to-indigo-50 text-indigo-900 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border border-indigo-200 mt-0.5">
                                    SMART REPLY WHATSAPP CALLER
                                </span>
                            </div>
                        </div>

                        <div className="text-[11px] text-slate-700 sm:text-right space-y-0.5 font-medium leading-tight">
                            <p><span className="text-slate-500 font-semibold">Billed To:</span> <span className="font-bold text-slate-900">IMA CAMPUS (PVT) LTD</span></p>
                            <p><span className="text-slate-500 font-semibold">Invoice No:</span> <span className="font-bold text-indigo-950 px-1.5 py-0.5 rounded bg-slate-100">{invoiceNo}</span></p>
                            <p><span className="text-slate-500 font-semibold">Billing Period:</span> <span className="font-bold text-slate-900">{monthFormatted}</span> | <span className="text-slate-500 font-semibold">Invoice Date:</span> <span className="font-bold text-slate-800">{invoiceDate}</span></p>
                        </div>
                    </div>
                </div>

                {/* Unified Grouped Itemized Service Table */}
                <div className="py-3.5 space-y-2">
                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                        <table className="w-full text-left text-[11px] border-collapse font-sans">
                            <thead>
                                {/* Top Group Header */}
                                <tr className="bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider">
                                    <th className="py-2 px-2.5 text-center w-8" rowSpan="2">#</th>
                                    <th className="py-2 px-3" rowSpan="2">Business / Department</th>
                                    <th className="py-1.5 px-2 text-center border-l border-slate-700 bg-slate-800/90 text-emerald-300" colSpan="2">
                                        Free Seminar Dedicated Hotline
                                    </th>
                                    <th className="py-1.5 px-2 text-center border-l border-slate-700 bg-slate-800/90 text-purple-300" colSpan="2">
                                        After Seminar Dedicated Hotline
                                    </th>
                                    <th className="py-2 px-2 text-center border-l border-slate-700" rowSpan="2">Total Mins</th>
                                    <th className="py-2 px-2.5 text-right border-l border-slate-700" rowSpan="2">Fixed Rental</th>
                                    <th className="py-2 px-2.5 text-right border-l border-slate-700" rowSpan="2">Usage Cost</th>
                                    <th className="py-2 px-3 text-right border-l border-slate-700 bg-slate-900" rowSpan="2">Net Total</th>
                                </tr>
                                {/* Sub Header for Free & After */}
                                <tr className="bg-slate-100 text-slate-700 font-bold text-[9px] uppercase border-b-2 border-slate-300">
                                    <th className="py-1 px-2 text-right border-l border-slate-200">Rental</th>
                                    <th className="py-1 px-2 text-right">Mins</th>
                                    <th className="py-1 px-2 text-right border-l border-slate-200">Rental</th>
                                    <th className="py-1 px-2 text-right">Mins</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                                {calculations.groupedRows.length === 0 ? (
                                    <tr>
                                        <td colSpan="10" className="py-6 text-center text-slate-400 font-medium">
                                            No businesses or hotlines selected for this invoice.
                                        </td>
                                    </tr>
                                ) : (
                                    calculations.groupedRows.map((row, index) => {
                                        const logoUrl = getBusinessLogoUrl(row.bizLogo, row.bizName);

                                        return (
                                            <tr key={row.bizId} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-2 px-2.5 text-center font-bold text-slate-400">
                                                    {index + 1}
                                                </td>

                                                {/* Business Name & Logo */}
                                                <td className="py-2.5 px-3 font-bold text-slate-900">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 p-0.5 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                                                            <img
                                                                src={logoUrl}
                                                                alt={row.bizName}
                                                                className="w-full h-full object-contain"
                                                                onError={(e) => {
                                                                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(row.bizName)}&background=4F46E5&color=fff&bold=true`;
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-[11px] font-bold text-slate-900 tracking-tight">
                                                            {row.bizName}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Free Seminar Columns */}
                                                <td className="py-2 px-2 text-right border-l border-slate-100 font-semibold text-slate-800">
                                                    {row.free.active ? formatLKR(row.free.fixed) : <span className="text-slate-300 font-normal">-</span>}
                                                </td>
                                                <td className="py-2 px-2 text-right font-bold text-emerald-700">
                                                    {row.free.active ? `${row.free.mins}m` : <span className="text-slate-300 font-normal">-</span>}
                                                </td>

                                                {/* After Seminar Columns */}
                                                <td className="py-2 px-2 text-right border-l border-slate-100 font-semibold text-slate-800">
                                                    {row.after.active ? formatLKR(row.after.fixed) : <span className="text-slate-300 font-normal">-</span>}
                                                </td>
                                                <td className="py-2 px-2 text-right font-bold text-purple-700">
                                                    {row.after.active ? `${row.after.mins}m` : <span className="text-slate-300 font-normal">-</span>}
                                                </td>

                                                {/* Total Mins */}
                                                <td className="py-2 px-2 text-center border-l border-slate-100 font-bold text-slate-800 bg-slate-50/50">
                                                    {row.rowMins}m
                                                </td>

                                                {/* Fixed Total */}
                                                <td className="py-2 px-2.5 text-right border-l border-slate-100 font-semibold text-slate-800">
                                                    {formatLKR(row.rowFixed)}
                                                </td>

                                                {/* Usage Cost */}
                                                <td className="py-2 px-2.5 text-right border-l border-slate-100 font-semibold text-slate-800">
                                                    {formatLKR(row.rowUsage)}
                                                </td>

                                                {/* Business Net Total */}
                                                <td className="py-2 px-3 text-right border-l border-slate-200 font-extrabold text-slate-950 bg-slate-50/80">
                                                    {formatLKR(row.rowTotal)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            {calculations.groupedRows.length > 0 && (
                                <tfoot>
                                    <tr className="bg-slate-100 border-t-2 border-slate-300 text-slate-900 font-extrabold text-[11px]">
                                        <td colSpan="2" className="py-2.5 px-3 text-right uppercase tracking-wider font-bold text-slate-600">
                                            TOTALS
                                        </td>
                                        <td className="py-2.5 px-2 text-right border-l border-slate-200">
                                            {formatLKR(calculations.groupedRows.reduce((acc, r) => acc + r.free.fixed, 0))}
                                        </td>
                                        <td className="py-2.5 px-2 text-right text-emerald-700">
                                            {calculations.groupedRows.reduce((acc, r) => acc + r.free.mins, 0)}m
                                        </td>
                                        <td className="py-2.5 px-2 text-right border-l border-slate-200">
                                            {formatLKR(calculations.groupedRows.reduce((acc, r) => acc + r.after.fixed, 0))}
                                        </td>
                                        <td className="py-2.5 px-2 text-right text-purple-700">
                                            {calculations.groupedRows.reduce((acc, r) => acc + r.after.mins, 0)}m
                                        </td>
                                        <td className="py-2.5 px-2 text-center border-l border-slate-200 bg-slate-200/60">
                                            {calculations.totalMinutes}m
                                        </td>
                                        <td className="py-2.5 px-2.5 text-right border-l border-slate-200">
                                            {formatLKR(calculations.totalFixedRental)}
                                        </td>
                                        <td className="py-2.5 px-2.5 text-right border-l border-slate-200">
                                            {formatLKR(calculations.totalUsageAmount)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right border-l border-slate-300 bg-slate-200 text-slate-950 font-black">
                                            {formatLKR(calculations.grandTotal)}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* Totals & Summary Calculation Deck */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 pb-4">

                    {/* Left: Summary Formula Breakdown */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                            <Info size={13} className="text-indigo-600" />
                            Cost Breakdown Summary
                        </h4>

                        <div className="text-[11px] space-y-1.5 text-slate-600 font-medium leading-tight">
                            <div className="flex justify-between items-center py-1 border-b border-slate-200">
                                <span>1. Fixed Dedicated Number Rentals:</span>
                                <span className="font-bold text-slate-900">{calculations.totalActiveNumbers} Numbers × LKR 2,500.00</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-slate-200">
                                <span>2. Outbound WhatsApp Call Minutes:</span>
                                <span className="font-bold text-slate-900">{calculations.totalMinutes} Mins × LKR 5.00</span>
                            </div>
                            <div className="flex justify-between items-center py-1 text-slate-800">
                                <span className="font-bold">Total Active Service Hotlines:</span>
                                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{calculations.totalActiveNumbers} Channels Configured</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Grand Total Box */}
                    <div className="flex flex-col justify-between gap-2 bg-slate-900 text-white p-4 rounded-xl shadow-lg">
                        <div className="space-y-1.5 text-[11px] font-medium">
                            <div className="flex justify-between items-center text-slate-300">
                                <span>Total Fixed Number Rentals:</span>
                                <span className="font-bold text-white">LKR {formatLKR(calculations.totalFixedRental)}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-300">
                                <span>Total Outbound Call Usage:</span>
                                <span className="font-bold text-white">LKR {formatLKR(calculations.totalUsageAmount)}</span>
                            </div>
                            <div className="h-px bg-slate-800 my-1"></div>
                        </div>

                        <div className="flex justify-between items-end pt-0.5">
                            <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-pink-400">
                                    TOTAL INVOICE AMOUNT
                                </p>
                                <p className="text-[10px] text-slate-400">Inclusive of all active services</p>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-extrabold text-emerald-400 tracking-tight">
                                    LKR {formatLKR(calculations.grandTotal)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bank Account Details & Payment Section */}
                <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 p-4 rounded-xl border border-indigo-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                            <CreditCard className="text-indigo-600" size={15} />
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-900">
                                Bank Transfer & Payment Details
                            </h4>
                        </div>
                        <div className="text-[11px] text-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 pt-0.5 font-medium leading-tight">
                            <p><span className="text-slate-500 font-normal">Bank:</span> <span className="font-bold text-slate-900">{bankDetails.bankName}</span></p>
                            <p><span className="text-slate-500 font-normal">Acc No:</span> <span className="font-bold text-indigo-950 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{bankDetails.accountNumber}</span></p>
                            <p><span className="text-slate-500 font-normal">Branch:</span> <span className="font-bold text-slate-900">{bankDetails.branch}</span></p>
                            <p><span className="text-slate-500 font-normal">Account Name:</span> <span className="font-bold text-slate-900">{bankDetails.accountName}</span></p>
                        </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                        <p className="text-[10px] font-bold text-slate-500">Authorized Signature</p>
                        <p className="font-extrabold text-xs text-indigo-950 tracking-wider mt-0.5">SMART REPLY</p>
                        <span className="inline-block text-[8px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full mt-1 border border-emerald-300">
                            Verified System Invoice
                        </span>
                    </div>
                </div>

                {/* Footer Notice */}
                <div className="text-center pt-2 border-t border-slate-200 text-[10px] font-medium text-slate-500">
                    <p className="font-semibold text-slate-700">Auto generated by SMART REPLY System • Enterprise Communication & AI Infrastructure</p>
                </div>

            </div>

            {/* Add Business / Item Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-fade-in font-sans">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <Plus size={18} className="text-emerald-400" /> Add Business / Hotline to Invoice
                            </h3>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs">
                            {/* Business Selection */}
                            <div>
                                <label className="text-slate-400 font-bold block mb-1.5 uppercase">Select Business</label>
                                <select
                                    value={newBizForm.selectedBizId}
                                    onChange={(e) => setNewBizForm({ ...newBizForm, selectedBizId: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-200 font-bold outline-none focus:border-indigo-500"
                                >
                                    <option value="custom">➕ Custom Business Name</option>
                                    {allAvailableBusinesses.map(b => (
                                        <option key={b.id} value={b.id}>{b.name} (ID #{b.id})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Custom Name if selected */}
                            {newBizForm.selectedBizId === 'custom' && (
                                <div>
                                    <label className="text-slate-400 font-bold block mb-1.5 uppercase">Custom Business Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. IMA Law Academy or Custom Department"
                                        value={newBizForm.customName}
                                        onChange={(e) => setNewBizForm({ ...newBizForm, customName: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-200 outline-none focus:border-indigo-500 font-bold"
                                    />
                                </div>
                            )}

                            {/* Minutes for Free & After Sem */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-slate-400 font-bold block mb-1.5 uppercase">Free Sem Call Minutes</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 50"
                                        value={newBizForm.freeMins}
                                        onChange={(e) => setNewBizForm({ ...newBizForm, freeMins: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-200 font-semibold outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-slate-400 font-bold block mb-1.5 uppercase">After Sem Call Minutes</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 80"
                                        value={newBizForm.afterMins}
                                        onChange={(e) => setNewBizForm({ ...newBizForm, afterMins: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-200 font-semibold outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-slate-800">
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddCustomBusiness}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/30"
                            >
                                Add to Invoice
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
