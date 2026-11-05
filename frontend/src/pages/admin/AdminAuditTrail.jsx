import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { toast } from 'react-hot-toast';

const AdminAuditTrail = () => {
    const [password, setPassword] = useState('');
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedPayload, setSelectedPayload] = useState(null);

    const fetchLogs = async (pageNum = 1) => {
        setLoading(true);
        try {
            const response = await api.post(`/admin/audit-logs`, 
                { password, page: pageNum, limit: 50 }
            );
            setLogs(response.data.logs);
            setTotalPages(response.data.totalPages);
            setPage(response.data.currentPage);
            setIsUnlocked(true);
        } catch (error) {
            console.error("Failed to fetch logs:", error);
            if (error.response?.status === 401) {
                toast.error("Incorrect Password!");
                setIsUnlocked(false);
            } else if (error.response?.status === 403) {
                toast.error("Access Denied. System Admin role required.");
            } else {
                toast.error("Failed to fetch audit logs.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleUnlock = (e) => {
        e.preventDefault();
        fetchLogs(1);
    };

    if (!isUnlocked) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] bg-[#0d0f1a] text-white rounded-xl p-8 border border-[#1a1f33] shadow-2xl">
                <div className="bg-[#141829] p-8 rounded-2xl border border-[#2a304a] shadow-lg max-w-md w-full text-center">
                    <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Restricted Access</h2>
                    <p className="text-gray-400 mb-6 text-sm">Please enter the master security password to view the System Audit Trail.</p>
                    
                    <form onSubmit={handleUnlock}>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter Security Password"
                            className="w-full bg-[#0d0f1a] border border-[#2a304a] rounded-lg px-4 py-3 mb-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            autoFocus
                        />
                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex justify-center items-center"
                        >
                            {loading ? (
                                <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : "Unlock Audit Trail"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#0d0f1a] text-white p-6 rounded-xl border border-[#1a1f33]">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-blue-400 flex items-center">
                        <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                        System Audit Trail
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">Real-time log of all system mutations and modifications.</p>
                </div>
                <button onClick={() => fetchLogs(1)} className="bg-[#141829] hover:bg-[#1a1f33] border border-[#2a304a] text-white px-4 py-2 rounded-lg flex items-center transition-colors">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    Refresh
                </button>
            </div>

            <div className="flex-1 overflow-auto rounded-lg border border-[#1a1f33] bg-[#0a0c14]">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-[#141829] sticky top-0 z-10 text-xs uppercase text-gray-400 font-semibold border-b border-[#2a304a]">
                        <tr>
                            <th className="px-6 py-4">Timestamp</th>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Action</th>
                            <th className="px-6 py-4">Endpoint</th>
                            <th className="px-6 py-4">IP Address</th>
                            <th className="px-6 py-4 text-center">Payload</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-[#1a1f33]">
                        {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-[#121626] transition-colors">
                                <td className="px-6 py-3 whitespace-nowrap text-gray-300">
                                    {new Date(log.createdAt).toLocaleString()}
                                </td>
                                <td className="px-6 py-3">
                                    <div className="font-medium text-white">{log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Unknown System User'}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{log.role || 'N/A'} (ID: {log.userId || 'System'})</div>
                                </td>
                                <td className="px-6 py-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        log.method === 'POST' ? 'bg-green-500/20 text-green-400' :
                                        log.method === 'PUT' ? 'bg-blue-500/20 text-blue-400' :
                                        log.method === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                                        'bg-gray-500/20 text-gray-400'
                                    }`}>
                                        {log.method}
                                    </span>
                                </td>
                                <td className="px-6 py-3 font-mono text-xs text-gray-400 max-w-xs truncate" title={log.endpoint}>
                                    {log.endpoint}
                                </td>
                                <td className="px-6 py-3 text-gray-500">
                                    {log.ipAddress || 'Unknown'}
                                </td>
                                <td className="px-6 py-3 text-center">
                                    <button 
                                        onClick={() => setSelectedPayload(log.payload)}
                                        className="text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 px-3 py-1.5 rounded-full transition-colors font-medium border border-blue-500/30"
                                    >
                                        View Data
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                    No audit logs found. The system is monitoring.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                    <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
                    <div className="flex space-x-2">
                        <button 
                            disabled={page === 1}
                            onClick={() => fetchLogs(page - 1)}
                            className="bg-[#141829] disabled:opacity-50 border border-[#2a304a] text-white px-3 py-1 rounded transition-colors"
                        >
                            Previous
                        </button>
                        <button 
                            disabled={page === totalPages}
                            onClick={() => fetchLogs(page + 1)}
                            className="bg-[#141829] disabled:opacity-50 border border-[#2a304a] text-white px-3 py-1 rounded transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Payload Modal */}
            {selectedPayload && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0d0f1a] border border-[#2a304a] rounded-xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center p-4 border-b border-[#1a1f33]">
                            <h3 className="text-lg font-bold text-white">Action Payload Data</h3>
                            <button onClick={() => setSelectedPayload(null)} className="text-gray-400 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="p-4 overflow-auto bg-[#0a0c14] flex-1">
                            <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                                {JSON.stringify(selectedPayload, null, 2)}
                            </pre>
                        </div>
                        <div className="p-4 border-t border-[#1a1f33] bg-[#141829] rounded-b-xl flex justify-end">
                            <button onClick={() => setSelectedPayload(null)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminAuditTrail;
