import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import { Terminal, Database, ArrowRight, UserPlus, Calendar, BookOpen, Search, Wallet, CreditCard, ChevronRight, CheckCircle, Tag, Trash2, List, Target } from 'lucide-react';

export default function TestInjector() {
    const [loading, setLoading] = useState(false);
    const [businesses, setBusinesses] = useState([]);
    const [batches, setBatches] = useState([]);
    
    const [logs, setLogs] = useState([]);
    const [mockList, setMockList] = useState([]);
    const [mockLeads, setMockLeads] = useState([]);
    const [coordinators, setCoordinators] = useState([]);
    const [selectedCoordinator, setSelectedCoordinator] = useState('');


    // Data Selection State
    const [selectedBusiness, setSelectedBusiness] = useState(null);
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [paymentPlan, setPaymentPlan] = useState(null); // 'full' or 'monthly'
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [selectedSubjects, setSelectedSubjects] = useState([]);
    const [selectedMethod, setSelectedMethod] = useState('MockCash'); // Payment Method
    const [isUpgrade, setIsUpgrade] = useState(false); // Upgrade flag
    const [createLead, setCreateLead] = useState(true); // Create lead flag
    const [assignToMe, setAssignToMe] = useState(true); // Assign to me flag

    
    // Student State
    const [searchPhone, setSearchPhone] = useState('0710000001');
    const [studentData, setStudentData] = useState(null);
    const [enrolledSubjects, setEnrolledSubjects] = useState([]);
    const [walletBalance, setWalletBalance] = useState(0);
    const [upcomingInstallments, setUpcomingInstallments] = useState([]);

    const [finalPaymentType, setFinalPaymentType] = useState(null); 
    const [availableInstallmentPlan, setAvailableInstallmentPlan] = useState(null);

    const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchContext = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/admin/test-injector/context', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setBusinesses(res.data.businesses);
                setBatches(res.data.batches);
                setCoordinators(res.data.coordinators || []);
            }
        } catch (error) {
            toast.error("Failed to fetch context data");
        }
    };

    const fetchMockList = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/admin/test-injector/mock-payments', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setMockList(res.data.mockPayments);
            }
        } catch(e) {}
    };

    const fetchMockLeads = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/admin/test-injector/mock-leads', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setMockLeads(res.data.leads);
            }
        } catch(e) {}
    };

    useEffect(() => {
        fetchContext();
        fetchMockList();
        fetchMockLeads();
    }, []);


    const addLog = (msg, type = 'info') => {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, type }]);
    };

    const handleAssignMockLead = async (leadId, coordinatorId, inquiryType) => {
        if (!coordinatorId) return toast.error("Select a coordinator to assign");
        if (!inquiryType) return toast.error("Select lead status (NEW_INQ or OPEN)");
        setLoading(true);
        addLog(`Assigning mock lead ${leadId}...`, 'info');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/admin/test-injector/assign-mock-lead', {
                leadId, coordinatorId, inquiryType
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            if (res.data.success) {
                toast.success("Lead Assigned!");
                addLog(`Success! Mock Lead assigned to coordinator ${coordinatorId}`, 'success');
                fetchMockLeads();
            } else {
                addLog(`Failed: ${res.data.message}`, 'error');
            }
        } catch (error) {
            addLog(`Error: ${error.response?.data?.message || error.message}`, 'error');
        }
        setLoading(false);
    };

    const handleSearchStudent = async () => {
        if (!searchPhone) return toast.error("Please enter a phone number");
        setLoading(true);
        addLog(`Searching for mock student: ${searchPhone}`, 'info');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`/admin/test-injector/student/${searchPhone}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success && res.data.exists) {
                setStudentData(res.data.student);
                setEnrolledSubjects(res.data.enrolledSubjects);
                setWalletBalance(res.data.walletBalance);
                
                const upcoming = (res.data.student.payments || []).filter(p => p.status === 0 && p.method === 'Upcoming');
                setUpcomingInstallments(upcoming);

                addLog(`Found student! ID: ${res.data.student.id}`, 'success');
                toast.success("Student loaded!");
            } else {
                setStudentData({ isNew: true, phone: searchPhone });
                setEnrolledSubjects([]);
                setWalletBalance(0);
                setUpcomingInstallments([]);
                addLog(`Student not found. Will be created upon injection.`, 'info');
                toast.info("Student not found, will create new.");
            }
        } catch(e) {
            toast.error("Search failed");
            addLog("Search failed", "error");
        }
        setLoading(false);
    };

    const handleDeleteMockData = async () => {
        if (!searchPhone) return;
        if (!window.confirm("Are you sure you want to completely DELETE this mock student and all their payments/lead records?")) return;
        
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.delete(`/admin/test-injector/student/${searchPhone}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                toast.success("Mock Data Cleared!");
                addLog(`Mock data cleared for ${searchPhone}`, 'success');
                setStudentData(null);
                setEnrolledSubjects([]);
                setWalletBalance(0);
                setUpcomingInstallments([]);
                fetchMockList();
                fetchMockLeads();
            }

        } catch(e) {
            toast.error("Delete failed");
        }
        setLoading(false);
    };

    const handleDeleteSingleMock = async (id) => {
        if (!window.confirm("Delete this injected payment?")) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/admin/test-injector/mock-payments/${id}`, { headers: { Authorization: `Bearer ${token}` }});
            toast.success("Deleted!");
            fetchMockList();
            fetchMockLeads();
            if (studentData && studentData.phone === searchPhone) handleSearchStudent(); // Refresh active student

        } catch(e) {
            toast.error("Delete failed");
        }
    };

    const handleCreateLifecycleMockLead = async (leadType) => {
        if (!searchPhone || searchPhone.length !== 9) return toast.error("Enter valid 9-digit phone (without 94) in the search box first.");
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/admin/test-injector/create-open-sem-lead', {
                phone: `94${searchPhone}`,
                businessId: selectedBusiness?.id,
                batchId: selectedBatch?.id,
                name: `Mock ${leadType} Lead`,
                leadType,
                assignToMe
            }, { headers: { Authorization: `Bearer ${token}` }});
            if (res.data.success) {
                toast.success(`${leadType} Lead Created!`);
                addLog(`Created mock ${leadType} lead for 94${searchPhone}`, 'success');
                fetchMockLeads();
            }
        } catch (e) {
            toast.error(e.response?.data?.message || "Failed to create mock lead");
        }
        setLoading(false);
    };

    const handleShiftLead = async () => {
        const leadId = prompt("Enter Lead ID to shift (you can find it in the leads list):");
        if (!leadId) return;
        const days = prompt("Enter days to shift backward (e.g., 7 or 14):");
        if (!days) return;

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/admin/test-injector/shift-lead', {
                leadId, daysToShift: days
            }, { headers: { Authorization: `Bearer ${token}` }});
            if (res.data.success) {
                toast.success(`Lead shifted by ${days} days!`);
                addLog(`Shifted lead ${leadId} by ${days} days`, 'success');
                fetchMockLeads();
            }
        } catch (e) {
            toast.error(e.response?.data?.message || "Failed to shift lead");
        }
        setLoading(false);
    };

    const handleDeleteSingleMockLead = async (id) => {
        if (!window.confirm("Delete this mock lead and its history?")) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.delete(`/admin/test-injector/mock-leads/${id}`, { headers: { Authorization: `Bearer ${token}` }});
            if (res.data.success) {
                toast.success("Lead Deleted!");
                fetchMockLeads();
            }
        } catch (e) {
            toast.error("Delete failed");
        }
        setLoading(false);
    };

    const getFilteredBatches = () => selectedBusiness ? batches.filter(b => b.businessId === selectedBusiness.id) : [];
    
    const getFilteredGroups = () => {
        if (!selectedBatch) return [];
        if (paymentPlan === 'monthly') return selectedBatch.groups.filter(g => g.type === 1).sort((a, b) => a.itemOrder - b.itemOrder);
        if (paymentPlan === 'full') return selectedBatch.groups.filter(g => g.type !== 1).sort((a, b) => a.itemOrder - b.itemOrder);
        return [];
    };

    const getFilteredCourses = () => {
        if (!selectedGroup || !selectedGroup.courses) return [];
        return selectedGroup.courses;
    };

    const getActiveDiscount = () => {
        if (!selectedGroup || !selectedGroup.discount_rules) return null;
        try {
            const rules = JSON.parse(selectedGroup.discount_rules);
            rules.sort((a, b) => b.courseCount - a.courseCount);
            const eligibleSubjectsCount = getFilteredCourses().filter(c => selectedSubjects.includes(c.id) && !c.isDiscountExcluded).length;

            for (let rule of rules) {
                if (eligibleSubjectsCount >= rule.courseCount) {
                    return { 
                        triggerCount: rule.courseCount, 
                        packagePrice: (rule.packagePrice !== undefined && rule.packagePrice !== null && rule.packagePrice !== '') ? Number(rule.packagePrice) : null,
                        newPricePerCourse: (rule.pricePerCourse !== undefined && rule.pricePerCourse !== null && rule.pricePerCourse !== '') ? Number(rule.pricePerCourse) : null,
                        fixedDiscount: rule.fixedDiscount ? Number(rule.fixedDiscount) : 0
                    };
                }
            }
        } catch (e) {}
        return null;
    };

    const calculateTotal = () => {
        const courses = getFilteredCourses();
        if (!selectedGroup || !courses || selectedSubjects.length === 0) return 0;
        
        if (isUpgrade && selectedBatch?.upgrade_pricing) {
            const numSubs = selectedSubjects.length;
            if (numSubs > 1) {
                const bundleMatch = selectedBatch.upgrade_pricing.find(u => u.planType === 'BUNDLE_DISCOUNT' && u.subjectCount === numSubs);
                if (bundleMatch) return Number(bundleMatch.amount);
            }
            // Fallback to sum of FULL individual upgrade prices
            let total = 0;
            selectedSubjects.forEach(id => {
                const fullMatch = selectedBatch.upgrade_pricing.find(u => u.planType === 'FULL' && u.courseId === id);
                if (fullMatch) total += Number(fullMatch.amount);
                else {
                    // Fallback to normal course price if upgrade price not set
                    const c = courses.find(c => c.id === id);
                    if (c) total += Number(c.price || 0);
                }
            });
            return total;
        }

        const activeDiscount = getActiveDiscount();
        let total = 0;

        if (activeDiscount && activeDiscount.packagePrice !== null) {
            total = activeDiscount.packagePrice;
            courses.filter(c => selectedSubjects.includes(c.id) && c.isDiscountExcluded).forEach(course => {
                total += Number(course.price || 0);
            });
        } else {
            courses.filter(c => selectedSubjects.includes(c.id)).forEach(course => {
                if (activeDiscount && activeDiscount.newPricePerCourse !== null && !course.isDiscountExcluded) {
                    total += activeDiscount.newPricePerCourse;
                } else {
                    total += Number(course.price || 0);
                }
            });
            if (activeDiscount && activeDiscount.fixedDiscount && activeDiscount.fixedDiscount > 0) {
                total = Math.max(0, total - activeDiscount.fixedDiscount);
            }
        }
        return total;
    };

    const checkInstallmentEligibility = () => {
        if (paymentPlan !== 'full' || !selectedBatch.installment_plans_parsed) return null;
        const plans = selectedBatch.installment_plans_parsed;
        if(!plans || plans.length === 0) return null;
        let sortedPlans = [...plans].sort((a, b) => b.subjectCount - a.subjectCount);
        for (let plan of sortedPlans) {
            if (selectedSubjects.length >= plan.subjectCount) return plan;
        }
        return null;
    };

    const handleSubjectToggle = (courseId) => {
        setSelectedSubjects(prev => {
            if (prev.includes(courseId)) {
                return prev.filter(id => id !== courseId);
            } else {
                return [...prev, courseId];
            }
        });
    };

    // Calculate Installments effect
    useEffect(() => {
        if (paymentPlan === 'full' && selectedSubjects.length > 0) {
            const eligiblePlan = checkInstallmentEligibility();
            if (eligiblePlan) {
                setAvailableInstallmentPlan(eligiblePlan);
                if (finalPaymentType !== 'pay_full' && finalPaymentType !== 'installment') {
                    setFinalPaymentType('installment');
                }
            } else {
                setAvailableInstallmentPlan(null);
                setFinalPaymentType('pay_full');
            }
        } else {
            setAvailableInstallmentPlan(null);
            setFinalPaymentType('pay_full');
        }
    }, [selectedSubjects, paymentPlan, selectedGroup]);

    const getFinalPayable = () => {
        if (selectedSubjects.length === 0) return 0; 
        
        let base = 0;
        if (finalPaymentType === 'installment') {
            if (isUpgrade && selectedBatch?.upgrade_pricing) {
                const instMatch = selectedBatch.upgrade_pricing.find(u => u.planType === 'INSTALLMENT' && u.subjectCount === selectedSubjects.length && u.installmentNum === 1);
                if (instMatch) {
                    base = Number(instMatch.amount);
                } else if (availableInstallmentPlan) {
                    base = Number(JSON.parse(availableInstallmentPlan.details)[0]?.amount || 0);
                }
            } else if (availableInstallmentPlan) {
                base = Number(JSON.parse(availableInstallmentPlan.details)[0]?.amount || 0);
            }
        } else {
            base = calculateTotal();
        }

        const total = base - walletBalance; 
        return total > 0 ? total : 0;
    };

    const handleInject = async () => {
        if (selectedSubjects.length === 0) return toast.error("Select subjects first");
        if (!selectedBusiness || !selectedBatch || !selectedGroup) return toast.error("Complete selection");
        if (!searchPhone) return toast.error("Phone number is required");

        setLoading(true);
        addLog(`Initiating injection for phone ${searchPhone}...`, 'info');
        
        try {
            const token = localStorage.getItem('token');
            const subjectsPayload = JSON.stringify(selectedSubjects);
            
            // payment_type: 1 = Monthly, 2 = Installment, 3 = Full
            let payment_type = 1;
            if (paymentPlan === 'full') {
                payment_type = finalPaymentType === 'installment' ? 2 : 3;
            }

            const payload = {
                phone: searchPhone,
                businessId: selectedBusiness.id,
                batchId: selectedBatch.id,
                groupId: selectedGroup.id,
                amount: getFinalPayable().toString(),
                payment_type,
                subjects: subjectsPayload,
                customDate,
                method: selectedMethod,
                isUpgrade,
                createLead
            };


            const res = await axios.post('/admin/test-injector/inject-payment', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.data.success) {
                toast.success("Injected!");
                addLog(`Success! Payment injected for student ${res.data.student?.id}`, 'success');
                await handleSearchStudent();
                fetchMockList();
                fetchMockLeads();
                setSelectedSubjects([]);
            } else {

                addLog(`Failed: ${res.data.message}`, 'error');
            }
        } catch (error) {
            addLog(`Error: ${error.response?.data?.message || error.message}`, 'error');
        }
        setLoading(false);
    };

    const handleInjectUpcoming = async (payment) => {
        if (!window.confirm(`Inject LKR ${payment.amount} for Phase ${payment.installment_no}?`)) return;
        setLoading(true);
        addLog(`Injecting upcoming phase ${payment.installment_no}...`, 'info');
        try {
            const token = localStorage.getItem('token');
            const payload = {
                paymentId: payment.id,
                phone: searchPhone,
                businessId: payment.businessId,
                batchId: payment.batchId,
                groupId: payment.groupId,
                amount: payment.amount.toString(),
                payment_type: 2,
                subjects: payment.subjects,
                customDate,
                method: selectedMethod
            };

            const res = await axios.post('/admin/test-injector/inject-payment', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.data.success) {
                toast.success("Phase Injected!");
                addLog(`Success! Phase injected for student.`, 'success');
                await handleSearchStudent();
                fetchMockList();
            }
        } catch (error) {
            addLog(`Error: ${error.message}`, 'error');
        }
        setLoading(false);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen pb-32">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black text-white flex items-center gap-3">
                        <Database className="text-indigo-500" size={32}/> Mock Dashboard Injector
                    </h2>
                    <p className="text-slate-400 mt-2 font-medium">Replicates the exact CRM Enrollment Logic for comprehensive testing.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                
                {/* Left Col: Setup & Operations */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Student Identity */}
                    <div className="bg-[#1e293b] rounded-2xl p-6 shadow-xl border border-slate-700/50">
                        <h4 className="text-emerald-400 font-bold mb-4 flex items-center gap-2 border-b border-slate-800 pb-3"><UserPlus size={18}/> 1. Student Identity</h4>
                        
                        <div className="flex gap-2 mb-2">
                            <input 
                                type="text" 
                                placeholder="Phone (e.g. 0710000001)"
                                className="w-full bg-[#0f172a] text-white p-3 rounded-xl border border-slate-700 focus:border-indigo-500 outline-none"
                                value={searchPhone}
                                onChange={(e) => setSearchPhone(e.target.value)}
                            />
                            <button onClick={handleSearchStudent} className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl transition-colors shrink-0">
                                <Search size={20}/>
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium mb-4">Click search to load existing payments and upgrade. Or just enter a number and proceed below.</p>

                        {studentData && (
                            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                                {studentData.isNew ? (
                                    <span className="text-slate-400 text-sm font-bold">New Student Will Be Created</span>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Name:</span>
                                            <span className="text-white font-bold">{studentData.firstName} {studentData.lastName}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Status:</span>
                                            <span className="text-emerald-400 font-bold">Existing Data Found</span>
                                        </div>
                                        <div className="flex justify-between text-sm pt-2 border-t border-slate-700">
                                            <span className="text-slate-400">Wallet:</span>
                                            <span className={`font-bold ${walletBalance > 0 ? 'text-emerald-400' : walletBalance < 0 ? 'text-red-400' : 'text-slate-300'}`}>LKR {walletBalance.toFixed(2)}</span>
                                        </div>
                                        
                                        <button onClick={handleDeleteMockData} className="w-full mt-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/30 p-2 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-2 transition-colors">
                                            <Trash2 size={14}/> Delete Student & Data
                                        </button>

                                        {upcomingInstallments.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-slate-700">
                                                <span className="block text-[10px] text-yellow-400 font-bold uppercase tracking-wider mb-2">Upcoming Installments</span>
                                                <div className="space-y-2">
                                                    {upcomingInstallments.map(up => (
                                                        <div key={up.id} className="bg-slate-900 border border-slate-700 p-3 rounded-lg flex justify-between items-center gap-2">
                                                            <div>
                                                                <span className="block text-white font-bold text-xs">Phase {up.installment_no}</span>
                                                                <span className="text-slate-400 text-[10px]">LKR {up.amount}</span>
                                                            </div>
                                                            <button onClick={() => handleInjectUpcoming(up)} className="bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white px-3 py-1.5 rounded transition-all">
                                                                Inject Phase {up.installment_no}
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Date Setup */}
                    <div className="bg-[#1e293b] rounded-2xl p-6 shadow-xl border border-slate-700/50">
                        <h4 className="text-indigo-400 font-bold mb-4 flex items-center gap-2 border-b border-slate-800 pb-3"><Calendar size={18}/> 2. Operation Settings</h4>
                        
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Created At Date</label>
                        <input 
                            type="date" 
                            className="w-full bg-indigo-500/10 text-indigo-300 p-3 rounded-xl border border-indigo-500/30 focus:border-indigo-400 outline-none font-bold mb-4"
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                        />

                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Payment Method</label>
                        <select 
                            className="w-full bg-[#0f172a] text-white p-3 rounded-xl border border-slate-700 focus:border-indigo-500 outline-none mb-4"
                            value={selectedMethod}
                            onChange={(e) => setSelectedMethod(e.target.value)}
                        >
                            <option value="MockCash">Mock Cash (Auto-Approve)</option>
                            <option value="MockSlip">Mock Slip (Auto-Approve)</option>
                            <option value="MockPayHere">Mock PayHere (Auto-Approve)</option>
                        </select>

                        <div className="p-4 border border-pink-500/30 bg-pink-500/10 rounded-xl flex items-center gap-3">
                            <input 
                                type="checkbox" 
                                id="createLead" 
                                checked={createLead} 
                                onChange={(e) => setCreateLead(e.target.checked)}
                                className="w-5 h-5 rounded border-slate-600 text-pink-600 focus:ring-pink-500 bg-slate-900"
                            />
                            <label htmlFor="createLead" className="text-sm font-bold text-pink-300 cursor-pointer select-none">
                                Generate CRM Lead for this Phone Number
                            </label>
                        </div>
                    </div>
                    {/* NEW: Lifecycle Tester */}
                    <div className="bg-[#1e293b] rounded-2xl p-6 shadow-xl border border-teal-500/30">
                        <h4 className="text-teal-400 font-bold mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
                            <Target size={16}/> Lead Lifecycle Tester
                        </h4>

                        <div className="p-3 border border-indigo-500/30 bg-indigo-500/10 rounded-xl flex items-center gap-3 mb-4">
                            <input 
                                type="checkbox" 
                                id="assignToMe" 
                                checked={assignToMe} 
                                onChange={(e) => setAssignToMe(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                            />
                            <label htmlFor="assignToMe" className="text-xs font-bold text-indigo-300 cursor-pointer select-none">
                                Auto-Assign to Me (Show in my CRM)
                            </label>
                        </div>
                        
                        <div className="flex flex-col gap-2 mb-4">
                            <button 
                                onClick={() => handleCreateLifecycleMockLead('NEW_INQ')}
                                className="w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 font-bold p-2 text-sm rounded-xl transition-all shadow-md border border-blue-500/30"
                            >
                                1. Create Mock New Inquiry Lead
                            </button>
                            
                            <button 
                                onClick={() => handleCreateLifecycleMockLead('OPEN_SEMINAR')}
                                className="w-full bg-teal-600/20 hover:bg-teal-600/40 text-teal-300 font-bold p-2 text-sm rounded-xl transition-all shadow-md border border-teal-500/30"
                            >
                                2. Create Mock Open Sem Lead
                            </button>

                            <button 
                                onClick={() => handleCreateLifecycleMockLead('PAID_CAMP')}
                                className="w-full bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 font-bold p-2 text-sm rounded-xl transition-all shadow-md border border-purple-500/30"
                            >
                                3. Create Mock Paid Campaign Lead
                            </button>
                        </div>
                        
                        <button 
                            onClick={handleShiftLead}
                            className="w-full bg-orange-600/20 hover:bg-orange-600/40 text-orange-300 font-bold p-3 rounded-xl transition-all shadow-md border border-orange-500/30"
                        >
                            4. Shift Lead Dates (Time Travel)
                        </button>
                        <p className="text-[10px] text-slate-400 mt-2 text-center">
                            Use this to shift lead dates back by 7 or 14 days to test cron logic.
                        </p>
                    </div>

                    {/* Logs Section */}
                    <div className="bg-black/40 rounded-2xl p-6 border border-slate-800 flex flex-col font-mono text-xs shadow-inner h-64">
                        <h4 className="text-slate-400 font-bold mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
                            <Terminal size={14}/> Console Logs
                        </h4>
                        <div className="flex-1 overflow-y-auto flex flex-col gap-2 custom-scrollbar pr-2">
                            {logs.map((log, idx) => (
                                <div key={idx} className={`flex gap-2 ${log.type === 'error' ? 'text-rose-400' : log.type === 'success' ? 'text-emerald-400' : 'text-indigo-300'}`}>
                                    <span className="text-slate-600 shrink-0">[{log.time}]</span>
                                    <span>{log.msg}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Removed Old Mock Leads Generate Section */}

                </div>

                {/* Right Col: Course Enrollment Mimic */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Step 3: Flow */}
                    <div className="bg-[#1e293b] rounded-2xl p-6 shadow-xl border border-slate-700/50 min-h-[600px] flex flex-col">
                        <h4 className="text-blue-400 font-bold mb-6 flex items-center gap-2 border-b border-slate-800 pb-3"><BookOpen size={18}/> 3. Course Enrollment Workflow</h4>
                        
                        <div className="flex-1">
                            {/* Business & Batch Selection */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <select 
                                    className="bg-[#0f172a] text-white p-3 rounded-xl border border-slate-700 focus:border-indigo-500 outline-none w-full text-sm"
                                    value={selectedBusiness?.id || ''}
                                    onChange={(e) => {
                                        const b = businesses.find(b => b.id.toString() === e.target.value);
                                        setSelectedBusiness(b); setSelectedBatch(null); setPaymentPlan(null); setSelectedGroup(null); setSelectedSubjects([]);
                                    }}
                                >
                                    <option value="">-- Select Business --</option>
                                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                                <select 
                                    className="bg-[#0f172a] text-white p-3 rounded-xl border border-slate-700 focus:border-indigo-500 outline-none w-full text-sm disabled:opacity-50"
                                    value={selectedBatch?.id || ''}
                                    onChange={(e) => {
                                        const b = batches.find(b => b.id.toString() === e.target.value);
                                        setSelectedBatch(b); setPaymentPlan(null); setSelectedGroup(null); setSelectedSubjects([]);
                                    }}
                                    disabled={!selectedBusiness}
                                >
                                    <option value="">-- Select Batch --</option>
                                    {getFilteredBatches().map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>

                            {selectedBatch && (
                                <div className="mb-6 bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Payment Plan</span>
                                    <div className="flex gap-4">
                                        <button onClick={() => { setPaymentPlan('full'); setSelectedGroup(null); setSelectedSubjects([]); }} 
                                            className={`flex-1 p-4 rounded-xl border transition-all flex flex-col items-center justify-center gap-2 ${paymentPlan === 'full' ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                            <Wallet size={24}/> <span className="font-bold">One-Time / Full</span>
                                        </button>
                                        <button onClick={() => { setPaymentPlan('monthly'); setSelectedGroup(null); setSelectedSubjects([]); }} 
                                            className={`flex-1 p-4 rounded-xl border transition-all flex flex-col items-center justify-center gap-2 ${paymentPlan === 'monthly' ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                            <CreditCard size={24}/> <span className="font-bold">Monthly</span>
                                        </button>
                                    </div>
                                    
                                    {/* UPGRADE CHECKBOX FOR EXISTING STUDENTS */}
                                    {studentData && !studentData.isNew && paymentPlan && (
                                        <div className="mt-4 p-4 border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center gap-3">
                                            <input 
                                                type="checkbox" 
                                                id="isUpgrade" 
                                                checked={isUpgrade} 
                                                onChange={(e) => setIsUpgrade(e.target.checked)}
                                                className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <label htmlFor="isUpgrade" className="text-sm font-bold text-indigo-900 dark:text-indigo-300 cursor-pointer select-none">
                                                Mark as Upgrade (Adds [UPGRADE] tag to simulate monthly to full/installment upgrades)
                                            </label>
                                        </div>
                                    )}
                                </div>
                            )}

                            {paymentPlan && (
                                <div className="mb-6">
                                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Group / Month Selection</span>
                                    <div className="flex flex-wrap gap-2">
                                        {getFilteredGroups().map(group => (
                                            <button key={group.id} onClick={() => { setSelectedGroup(group); setSelectedSubjects([]); }}
                                                className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${selectedGroup?.id === group.id ? 'bg-indigo-500 text-white border border-indigo-400 shadow-lg' : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                                                {group.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedGroup && (
                                <div className="space-y-3">
                                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex justify-between items-center">
                                        <span>Subjects</span>
                                        {getActiveDiscount() && <span className="text-yellow-400 text-[10px] flex items-center gap-1 font-bold"><Tag size={12}/> Discount Applied!</span>}
                                    </span>
                                    {getFilteredCourses().length === 0 ? (
                                        <div className="text-center p-6 bg-slate-800/30 rounded-xl border border-slate-700">
                                            <span className="text-slate-500 text-sm font-medium">No courses found in this group.</span>
                                        </div>
                                    ) : (
                                        getFilteredCourses().map(course => {
                                            const isAlreadyPaid = enrolledSubjects.includes(course.id);
                                            const isSelected = selectedSubjects.includes(course.id);
                                            
                                            return (
                                                <label key={course.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all gap-4 w-full ${
                                                    isAlreadyPaid ? 'opacity-60 bg-slate-900/50 border-slate-800 cursor-not-allowed' :
                                                    isSelected ? 'bg-indigo-900/30 border-indigo-500 cursor-pointer shadow-md' : 'bg-slate-900 border-slate-700 cursor-pointer hover:border-slate-500'
                                                }`}>
                                                    <div className="flex items-center gap-4">
                                                        <input 
                                                            type="checkbox" 
                                                            disabled={isAlreadyPaid}
                                                            className="w-5 h-5 rounded border-slate-600 text-indigo-600 focus:ring-indigo-600 bg-slate-950"
                                                            checked={isSelected} 
                                                            onChange={() => handleSubjectToggle(course.id)} 
                                                        />
                                                        <div>
                                                            <span className="block font-bold text-white">{course.name || `Course #${course.id}`}</span>
                                                            {isAlreadyPaid && <span className="text-[10px] text-emerald-400 font-bold uppercase mt-1 flex items-center gap-1"><CheckCircle size={10}/> Already Paid</span>}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        {getActiveDiscount() && isSelected && !course.isDiscountExcluded && !isAlreadyPaid && !isUpgrade ? (
                                                            <>
                                                                <span className="text-slate-500 line-through text-[10px] block font-bold">LKR {Number(course.price).toFixed(2)}</span>
                                                                <span className="text-yellow-400 font-black text-lg">LKR {Number(getActiveDiscount().newPricePerCourse).toFixed(2)}</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-indigo-300 font-black text-lg">
                                                                LKR {isUpgrade && selectedBatch?.upgrade_pricing ? (
                                                                    selectedBatch.upgrade_pricing.find(u => u.planType === 'FULL' && u.courseId === course.id)?.amount || course.price || 0
                                                                ) : (course.price || 0)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </label>
                                            )
                                        })
                                    )}

                                    {paymentPlan === 'full' && availableInstallmentPlan && selectedSubjects.length > 0 && (
                                        <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                                            <span className="block text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">Installment Plan Available</span>
                                            <div className="flex gap-4">
                                                <label className={`flex-1 p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-center gap-2 ${finalPaymentType === 'pay_full' ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                                    <input type="radio" name="payType" checked={finalPaymentType === 'pay_full'} onChange={() => setFinalPaymentType('pay_full')} className="hidden"/>
                                                    <span className="font-bold">Pay Full Amount</span>
                                                </label>
                                                <label className={`flex-1 p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-center gap-2 ${finalPaymentType === 'installment' ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                                    <input type="radio" name="payType" checked={finalPaymentType === 'installment'} onChange={() => setFinalPaymentType('installment')} className="hidden"/>
                                                    <span className="font-bold">Pay Installment 1</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            )}

                        </div>

                        {/* Order Summary Strip */}
                        <div className={`mt-8 bg-[#0f172a] rounded-xl border border-slate-700 p-4 transition-all duration-300 ${selectedSubjects.length > 0 ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-2 pointer-events-none'}`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">
                                        Total Payable {finalPaymentType === 'installment' ? '(First Installment)' : ''}
                                    </span>
                                    <span className="text-3xl text-emerald-400 font-black">LKR {getFinalPayable().toFixed(2)}</span>
                                    {finalPaymentType === 'installment' && <span className="ml-2 text-yellow-400 text-xs font-bold bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">Installment Plan Active</span>}
                                </div>
                                <button onClick={handleInject} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-8 rounded-xl flex items-center gap-2 transition-all shadow-lg disabled:opacity-50">
                                    {loading ? 'Processing...' : <>Approve Injection <ChevronRight size={20}/></>}
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            {/* Injected Mocks List */}
            <div className="bg-[#1e293b] rounded-2xl p-6 shadow-xl border border-slate-700/50 mt-8">
                <h4 className="text-white font-bold mb-6 flex items-center gap-2 text-xl"><List className="text-indigo-500"/> Injected Mock Data Ledger</h4>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-400">
                                <th className="p-3 font-bold">Created At</th>
                                <th className="p-3 font-bold">Student Phone</th>
                                <th className="p-3 font-bold">Batch</th>
                                <th className="p-3 font-bold">Method</th>
                                <th className="p-3 font-bold">Amount</th>
                                <th className="p-3 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {mockList.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-6 text-center text-slate-500 font-medium">No mock injections found.</td>
                                </tr>
                            ) : (
                                mockList.map(mock => (
                                    <tr key={mock.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                        <td className="p-3 text-slate-300">{new Date(mock.created_at).toLocaleDateString()} {new Date(mock.created_at).toLocaleTimeString()}</td>
                                        <td className="p-3 font-bold text-indigo-400">{mock.student?.phone}</td>
                                        <td className="p-3 text-slate-300">{mock.batch?.name}</td>
                                        <td className="p-3">
                                            <span className="bg-slate-800 text-xs px-2 py-1 rounded border border-slate-700 font-bold text-indigo-300">
                                                {mock.payment_type === 1 ? 'M' : mock.payment_type === 2 ? `I-${mock.installment_no||1}` : 'F'}
                                            </span>
                                            <span className="bg-slate-800 text-xs px-2 py-1 rounded border border-slate-700 ml-1">{mock.method}</span>
                                        </td>
                                        <td className="p-3 text-emerald-400 font-bold">LKR {mock.amount.toFixed(2)}</td>
                                        <td className="p-3 text-right">
                                            <button onClick={() => handleDeleteSingleMock(mock.id)} className="text-rose-400 hover:text-white hover:bg-rose-500 p-2 rounded-lg transition-all" title="Delete Mock">
                                                <Trash2 size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Injected Mock CRM Leads */}
            <div className="bg-[#1e293b] rounded-2xl p-6 shadow-xl border border-slate-700/50 mt-8">
                <h4 className="text-white font-bold mb-6 flex items-center gap-2 text-xl"><UserPlus className="text-pink-500"/> Injected Mock CRM Leads</h4>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-400">
                                <th className="p-3 font-bold">Created At</th>
                                <th className="p-3 font-bold">Student Name & Phone</th>
                                <th className="p-3 font-bold">Batch</th>
                                <th className="p-3 font-bold">Assigned To</th>
                                <th className="p-3 font-bold">Current Status</th>
                                <th className="p-3 font-bold text-right">Assign Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {mockLeads.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-6 text-center text-slate-500 font-medium">No mock leads generated. Tick 'Generate CRM Lead' when injecting.</td>
                                </tr>
                            ) : (
                                mockLeads.map(lead => {
                                    const isAssigned = !!lead.assignedTo;
                                    return (
                                        <tr key={lead.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                            <td className="p-3 text-slate-300">{new Date(lead.createdAt).toLocaleDateString()} {new Date(lead.createdAt).toLocaleTimeString()}</td>
                                            <td className="p-3">
                                                <span className="font-bold text-pink-400 block">{lead.name}</span>
                                                <span className="text-xs text-slate-400">{lead.phone}</span>
                                            </td>
                                            <td className="p-3 text-slate-300">{lead.batch?.name || '-'}</td>
                                            <td className="p-3 text-emerald-400 font-bold">
                                                {isAssigned ? `${lead.assignedUser?.firstName} ${lead.assignedUser?.lastName}` : <span className="text-slate-500 font-normal">Unassigned</span>}
                                            </td>
                                            <td className="p-3 font-bold text-indigo-300">{lead.status} {lead.inquiryType ? `(${lead.inquiryType})` : ''}</td>
                                            <td className="p-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <form 
                                                        onSubmit={(e) => {
                                                            e.preventDefault();
                                                            handleAssignMockLead(lead.id, e.target.coord.value, e.target.inqType.value);
                                                        }}
                                                        className="flex items-center justify-end gap-2"
                                                    >
                                                        <select name="coord" className="bg-[#0f172a] text-xs text-white p-2 rounded border border-slate-700 outline-none w-32" defaultValue={lead.assignedTo || ""}>
                                                            <option value="">Select Coord</option>
                                                            {coordinators.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                                                        </select>

                                                        <select name="inqType" className="bg-[#0f172a] text-xs text-white p-2 rounded border border-slate-700 outline-none w-28" defaultValue={lead.inquiryType || "NEW_INQ"}>
                                                            <option value="NEW_INQ">NEW_INQ</option>
                                                            <option value="OPEN_SEMINAR">OPEN_SEMINAR</option>
                                                            <option value="PAID_CAMP">PAID_CAMP</option>
                                                        </select>
                                                        <button type="submit" disabled={loading} className="bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold py-2 px-3 rounded shadow transition-all disabled:opacity-50">
                                                            {isAssigned ? 'Reassign' : 'Assign'}
                                                        </button>
                                                    </form>
                                                    <button onClick={() => handleDeleteSingleMockLead(lead.id)} disabled={loading} className="bg-rose-600/20 hover:bg-rose-500 text-rose-400 hover:text-white p-2 flex-shrink-0 rounded-lg transition-all" title="Delete Mock Lead">
                                                        <Trash2 size={16}/>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
