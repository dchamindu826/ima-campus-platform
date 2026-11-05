import React from 'react';
import ManagerCampaignStats from './ManagerCampaignStats';
import StaffCampaignExecution from './StaffCampaignExecution';

export default function CallCampaignModule({ loggedInUser, filters, setActiveMode, setSelectedLead, forceStatsView, redirectLead }) {
    
    // 1. Role eka ganna logic eka (poddak thawath strong kara)
    let rawRole = '';
    if (loggedInUser && loggedInUser.role) {
        rawRole = loggedInUser.role;
    } else {
        try {
            const storedUser = JSON.parse(localStorage.getItem('user')) || {};
            rawRole = storedUser?.role || '';
        } catch (e) {
            console.error("Local storage error", e);
        }
    }

    // 2. Normalize role (Space -> Underscore)
    const userRole = rawRole.toUpperCase().replace(/ /g, '_');
    
    // 3. Manager/Admin check eka
    const managerRoles = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER'];
    const isManager = managerRoles.includes(userRole);

    return (
        <div className="h-full w-full overflow-y-auto custom-scrollbar p-2 relative">
            
            {(isManager || forceStatsView) ? (
                <ManagerCampaignStats filters={filters} isManager={isManager} />
            ) : (
                <StaffCampaignExecution 
                    filters={filters} 
                    setActiveMode={setActiveMode} 
                    setSelectedLead={setSelectedLead} 
                    redirectLead={redirectLead}
                />
            )}
        </div>
    );
}