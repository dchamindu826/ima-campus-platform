import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiEdit2, FiVideo, FiX, FiKey, FiHash } from 'react-icons/fi';
import api from '../../api/axios';
import { toast } from 'react-hot-toast';

const ZoomAccountManager = () => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    
    const [formData, setFormData] = useState({
        id: null,
        name: '',
        accountId: '',
        clientId: '',
        clientSecret: '',
        isActive: true
    });

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const response = await api.get('/zoom-accounts');
            setAccounts(response.data);
        } catch (error) {
            toast.error("Failed to load Zoom accounts");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const handleClose = () => {
        setShowModal(false);
        setFormData({ id: null, name: '', accountId: '', clientId: '', clientSecret: '', isActive: true });
        setIsEditing(false);
    };

    const handleShow = (account = null) => {
        if (account) {
            setFormData({
                id: account.id,
                name: account.name,
                accountId: account.accountId,
                clientId: account.clientId,
                clientSecret: account.clientSecret,
                isActive: account.isActive
            });
            setIsEditing(true);
        } else {
            setFormData({ id: null, name: '', accountId: '', clientId: '', clientSecret: '', isActive: true });
            setIsEditing(false);
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await api.put(`/zoom-accounts/${formData.id}`, formData);
                toast.success("Account updated successfully");
            } else {
                await api.post('/zoom-accounts', formData);
                toast.success("Account added successfully");
            }
            handleClose();
            fetchAccounts();
        } catch (error) {
            toast.error(error.response?.data?.error || "An error occurred");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this Zoom account?")) {
            try {
                await api.delete(`/zoom-accounts/${id}`);
                toast.success("Account deleted successfully");
                fetchAccounts();
            } catch (error) {
                toast.error("Failed to delete account");
            }
        }
    };

    return (
        <div className="p-6 animate-fade-in pb-10">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center text-white">
                        <FiVideo className="mr-3 text-blue-400" /> Zoom Accounts
                    </h2>
                    <p className="text-sm font-medium text-gray-300 mt-2">Manage Zoom API credentials for recording downloads</p>
                </div>
                <button 
                    onClick={() => handleShow()} 
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border border-blue-500 px-4 py-2 rounded-lg text-sm font-bold shadow-lg hover:shadow-blue-500/30 transition-all"
                >
                    <FiPlus size={16} /> Add New Account
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 bg-black/20 border border-white/10 backdrop-blur-xl rounded-2xl shadow-sm">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-gray-300 mt-4 text-sm font-medium">Loading accounts...</p>
                </div>
            ) : accounts.length === 0 ? (
                <div className="text-center py-16 bg-black/20 border border-white/10 backdrop-blur-xl rounded-2xl shadow-sm transition-colors hover:bg-black/30">
                    <div className="bg-white/5 rounded-full inline-flex p-6 mb-5 border border-white/10">
                        <FiVideo size={40} className="text-gray-400" />
                    </div>
                    <h5 className="text-xl font-bold text-white">No Zoom Accounts Found</h5>
                    <p className="text-gray-400 mb-8 mt-2 max-w-md mx-auto text-sm">The system will fallback to the default .env configuration for Zoom API lookups.</p>
                    <button 
                        onClick={() => handleShow()}
                        className="bg-white/10 border border-white/20 text-white hover:bg-white/20 px-5 py-2.5 rounded-lg transition-all text-sm font-semibold shadow-sm backdrop-blur-md"
                    >
                        Add Your First Account
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {accounts.map((account) => (
                        <div key={account.id} className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-lg hover:shadow-blue-500/10 transition-all relative overflow-hidden group">
                            
                            {/* Decorative background glow */}
                            <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none transition-all ${account.isActive ? 'bg-emerald-500' : 'bg-gray-500'}`}></div>

                            <div className="flex justify-between items-start mb-5 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className={`p-3 rounded-xl border ${account.isActive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-gray-500/10 border-gray-500/20 text-gray-400'}`}>
                                        <FiVideo size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{account.name}</h3>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${account.isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                                            {account.isActive ? 'Active' : 'Disabled'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 mb-6 relative z-10">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><FiHash /> Account ID</p>
                                    <code className="bg-black/50 border border-white/5 text-blue-300 px-3 py-1.5 rounded-lg text-xs font-mono block w-full truncate">
                                        {account.accountId}
                                    </code>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><FiKey /> Client ID</p>
                                    <code className="bg-black/50 border border-white/5 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-mono block w-full truncate">
                                        {account.clientId}
                                    </code>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-white/5 relative z-10">
                                <button 
                                    onClick={() => handleShow(account)}
                                    className="flex items-center gap-2 bg-white/5 hover:bg-blue-500/20 text-blue-400 border border-transparent hover:border-blue-500/30 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                                >
                                    <FiEdit2 size={16} /> Edit
                                </button>
                                <button 
                                    onClick={() => handleDelete(account.id)}
                                    className="flex items-center gap-2 bg-white/5 hover:bg-rose-500/20 text-rose-400 border border-transparent hover:border-rose-500/30 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                                >
                                    <FiTrash2 size={16} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
                    <div className="bg-gray-900/90 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="flex justify-between items-center p-5 border-b border-white/10 bg-black/20">
                            <h3 className="text-lg font-bold text-white flex items-center">
                                {isEditing ? <><FiEdit2 className="mr-2 text-blue-400"/> Edit Zoom Account</> : <><FiPlus className="mr-2 text-emerald-400"/> Add Zoom Account</>}
                            </h3>
                            <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors bg-white/5 p-1.5 rounded-lg hover:bg-white/10">
                                <FiX size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit}>
                            <div className="p-6 space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wide">Account Name (Identifier)</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Science Batch 2026"
                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all shadow-inner"
                                        value={formData.name} 
                                        onChange={(e) => setFormData({...formData, name: e.target.value})} 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wide">Zoom Account ID</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter Account ID"
                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all shadow-inner"
                                        value={formData.accountId} 
                                        onChange={(e) => setFormData({...formData, accountId: e.target.value})} 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wide">Client ID</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter Client ID"
                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all shadow-inner"
                                        value={formData.clientId} 
                                        onChange={(e) => setFormData({...formData, clientId: e.target.value})} 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wide">Client Secret</label>
                                    <input 
                                        type="password" 
                                        placeholder="Enter Client Secret"
                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all shadow-inner"
                                        value={formData.clientSecret} 
                                        onChange={(e) => setFormData({...formData, clientSecret: e.target.value})} 
                                        required 
                                    />
                                </div>
                                <div className="flex items-center pt-2">
                                    <div className="relative flex items-start">
                                        <div className="flex items-center h-5">
                                            <input 
                                                type="checkbox"
                                                id="isActive"
                                                className="w-5 h-5 text-blue-500 bg-black/30 border-white/20 rounded focus:ring-blue-500 focus:ring-offset-gray-900"
                                                checked={formData.isActive}
                                                onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                                            />
                                        </div>
                                        <div className="ml-3 text-sm">
                                            <label htmlFor="isActive" className="font-bold text-gray-200">
                                                Account is Active
                                            </label>
                                            <p className="text-gray-400 text-xs mt-0.5">Allow system to use this account for recording downloads</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-end gap-3 p-5 border-t border-white/10 bg-black/20">
                                <button 
                                    type="button" 
                                    onClick={handleClose}
                                    className="px-5 py-2.5 text-gray-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all font-semibold text-sm"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-5 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 border border-blue-500 shadow-lg shadow-blue-500/20 transition-all font-bold text-sm"
                                >
                                    {isEditing ? 'Save Changes' : 'Add Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ZoomAccountManager;
