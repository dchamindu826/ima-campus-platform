import React from 'react';
import ManagerTaskCenter from './TaskCenter/ManagerTaskCenter';
import StaffTaskCenter from './TaskCenter/StaffTaskCenter';

export default function TaskCenter({ loggedInUser }) {
    const userRole = loggedInUser?.role?.toUpperCase().replace(/ /g, '_') || 'STAFF';
    const isManager = userRole === 'MANAGER' || userRole === 'ASS_MANAGER' || userRole === 'SYSTEM_ADMIN';

    if (isManager) {
        return <ManagerTaskCenter loggedInUser={loggedInUser} />;
    }

    return <StaffTaskCenter loggedInUser={loggedInUser} />;
}