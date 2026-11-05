import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Truck, Search } from 'lucide-react';

import PendingHolds from './components/PendingHolds';
import DispatchDelivered from './components/DispatchDelivered'; 
import TuteStock from './components/TuteStock';
import DeliveryHistory from './components/DeliveryHistory';
import PaymentDetails from './components/PaymentDetails';
import Overview from './components/Overview';
import StockReports from './components/StockReports';

export default function DeliveryDashboard({ loggedInUser }) {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const activeTab = queryParams.get('tab') || 'overview'; 

    const [searchQuery, setSearchQuery] = useState('');

    const userRole = loggedInUser?.role ? loggedInUser.role.toUpperCase().replace(' ', '_') : '';
    const userDept = loggedInUser?.department ? loggedInUser.department.toUpperCase() : '';

    const isDeliveryStaff = userDept === 'DELIVERY';
    const isTopLevelAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER'].includes(userRole);
    
    // Anyone in Delivery department or top level admin can manage tute stock
    const hasFullAccess = isDeliveryStaff || isTopLevelAdmin;
    const isReadOnly = !hasFullAccess;

    return (
        <div className="w-full animate-fade-in text-gray-900 dark:text-gray-100 pb-10 font-sans relative transition-colors duration-500 z-10">
            
            {/* 🔥 Glassmorphic Header Section 🔥 */}
            <div className="flex items-center gap-5 mb-8 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-gray-200 dark:border-white/10 shadow-lg transition-colors">
                <div className="p-4 bg-brand-accentLight/80 dark:bg-brand-accent/20 rounded-[1.5rem] border border-brand-accent/30 text-brand-accent shrink-0 transition-colors shadow-inner backdrop-blur-md">
                    <Truck size={32} strokeWidth={2.5}/>
                </div>
                <div className="flex-1">
                    <h2 className="text-2xl md:text-4xl font-black text-gray-900 dark:text-white tracking-wide capitalize transition-colors">
                        {activeTab === 'overview' && 'Delivery Overview'}
                        {activeTab === 'pending' && 'Pending & Holds'}
                        {activeTab === 'delivered' && 'Dispatch & Delivered'} 
                        {activeTab === 'stock' && 'Tute Stock'}
                        {activeTab === 'reports' && 'Advanced Stock Reports'}
                        {activeTab === 'history' && 'Delivery History'}
                        {activeTab === 'payment_details' && 'Payment Details'}
                    </h2>
                    <p className="text-gray-500 dark:text-slate-400 font-bold text-sm mt-1.5 transition-colors uppercase tracking-widest">Manage student deliveries, tracking, and tute inventory.</p>
                </div>
            </div>

            {/* 🔥 Glassmorphic Search Bar (Hidden in Overview & Stock) 🔥 */}
            {(activeTab === 'pending' || activeTab === 'delivered') && (
                <div className="bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl p-5 rounded-[1.5rem] border border-gray-200 dark:border-white/10 mb-6 shadow-lg transition-colors">
                    <div className="relative w-full">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-brand-accent/70" size={20}/>
                        <input 
                            type="text" 
                            placeholder="Search orders, students, batches or tracking IDs..." 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            className="w-full bg-white/80 dark:bg-black/40 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-xl pl-12 pr-5 py-4 text-gray-900 dark:text-white outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-colors text-sm font-black placeholder-gray-400 dark:placeholder-slate-500 shadow-sm" 
                        />
                    </div>
                </div>
            )}

            {/* Render the active module based on URL parameter */}
            <div className="mt-4">
                {activeTab === 'overview' && <Overview />}
                {activeTab === 'pending' && <PendingHolds searchQuery={searchQuery} isReadOnly={isReadOnly} />}
                {activeTab === 'history' && <DeliveryHistory isReadOnly={isReadOnly} />}
                {activeTab === 'delivered' && <DispatchDelivered searchQuery={searchQuery} isReadOnly={isReadOnly} />} 
                {activeTab === 'stock' && <TuteStock searchQuery={searchQuery} isReadOnly={isReadOnly} />}
                {activeTab === 'reports' && <StockReports loggedInUser={loggedInUser} />}
                {activeTab === 'payment_details' && <PaymentDetails isReadOnly={isReadOnly} />}
            </div>

        </div>
    );
}