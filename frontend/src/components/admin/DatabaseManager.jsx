import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { FaDatabase, FaTrash, FaEdit, FaLock, FaUnlock, FaTimes, FaSave, FaSearch, FaFilter, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import toast from 'react-hot-toast';

export default function DatabaseManager() {
    const SECRET_PASSWORD = 'ima@123'; // Change this securely in production

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');

    const [selectedTable, setSelectedTable] = useState('User');
    const [tableData, setTableData] = useState([]);
    const [loading, setLoading] = useState(false);

    // Server-Side Search, Filter & Pagination States
    const [globalSearch, setGlobalSearch] = useState('');
    const [filterColumn, setFilterColumn] = useState('');
    const [filterValue, setFilterValue] = useState('');
    
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const limit = 50; // Rows per page

    // Edit State
    const [editingRow, setEditingRow] = useState(null);
    const [editFormData, setEditFormData] = useState({});

    // Available Prisma Models
    const tables = ['User', 'Business', 'Batch', 'Group', 'Course', 'Lead', 'ChatMessage', 'Payment', 'Post', 'Content', 'CrmSettings', 'AutoReply'];

    // Available columns for the dropdown (Derived from current data)
    const [availableColumns, setAvailableColumns] = useState([]);

    useEffect(() => {
        if (isAuthenticated) {
            // Use a slight delay (debounce) for search typing
            const delayDebounceFn = setTimeout(() => {
                fetchData();
            }, 500);
            return () => clearTimeout(delayDebounceFn);
        }
    }, [selectedTable, isAuthenticated, globalSearch, filterColumn, filterValue, currentPage]);

    // Reset page and filters when table changes
    useEffect(() => {
        setGlobalSearch('');
        setFilterColumn('');
        setFilterValue('');
        setCurrentPage(1);
    }, [selectedTable]);

    const handleLogin = (e) => {
        e.preventDefault();
        if (passwordInput === SECRET_PASSWORD) {
            setIsAuthenticated(true);
            toast.success("Access Granted to Database!");
        } else {
            toast.error("Incorrect Password!");
            setPasswordInput('');
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`/admin/database/${selectedTable}`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    page: currentPage,
                    limit: limit,
                    search: globalSearch,
                    filterColumn: filterColumn,
                    filterValue: filterValue
                }
            });
            
            const data = res.data.data || [];
            setTableData(data);
            setTotalPages(res.data.meta?.totalPages || 1);
            setTotalRecords(res.data.meta?.totalRecords || 0);

            // Set available columns dynamically based on fetched data keys
            if (data.length > 0) {
                setAvailableColumns(Object.keys(data[0]));
            } else if (availableColumns.length === 0) {
                // Fallback if no data is found but we need column names (ideally requires a schema endpoint, but we keep it simple here)
                setAvailableColumns(['id', 'createdAt', 'updatedAt']); 
            }

        } catch (error) {
            toast.error(`Failed to load ${selectedTable} data`);
            setTableData([]);
        }
        setLoading(false);
    };

    // ... (Keep handleDelete, handleEditClick, handleSaveEdit, handleFieldChange exactly as they were before) ...
    const handleDelete = async (id) => {
        const confirmText = window.prompt(`Type 'DELETE' to remove record ID ${id} from ${selectedTable}`);
        if (confirmText !== 'DELETE') return toast.error("Deletion cancelled");
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/admin/database/${selectedTable}/${id}`, { headers: { Authorization: `Bearer ${token}` }});
            toast.success("Record deleted successfully");
            fetchData();
        } catch (error) { toast.error("Delete failed. Check foreign key constraints."); }
    };

    const handleEditClick = (row) => {
        setEditingRow(row.id);
        setEditFormData(row);
    };

    const handleSaveEdit = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`/admin/database/${selectedTable}/${editingRow}`, editFormData, { headers: { Authorization: `Bearer ${token}` }});
            toast.success("Record updated!");
            setEditingRow(null);
            fetchData();
        } catch (error) { toast.error("Update failed."); }
    };

    const handleFieldChange = (key, value) => {
        setEditFormData(prev => ({ ...prev, [key]: value }));
    };


    if (!isAuthenticated) {
        return (
            <div className="flex items-center justify-center h-full w-full animate-fade-in">
                {/* Login UI remains same as before */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center">
                    <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30 shadow-lg">
                        <FaLock size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Restricted Area</h2>
                    <p className="text-slate-400 text-xs mb-6">Enter root password to access the raw database.</p>
                    <form onSubmit={handleLogin}>
                        <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Root Password"  className="w-full bg-[#0f172a] border border-slate-600 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-red-500 text-center tracking-widest mb-4 shadow-inner" autoFocus />
                        <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-500/20 transition-colors flex items-center justify-center gap-2">
                            <FaUnlock /> Unlock Database
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-fade-in font-sans space-y-4">
            {/* Header */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700 p-5 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-3">
                        <FaDatabase className="text-blue-500"/> System Database Manager
                    </h2>
                    <p className="text-xs text-red-400 font-bold uppercase tracking-widest mt-1 animate-pulse">Warning: Direct Database Manipulation Active</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Table:</span>
                    <select 
                        value={selectedTable} 
                        onChange={(e) => setSelectedTable(e.target.value)}
                        className="bg-[#0f172a] border border-slate-600 text-slate-200 text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 w-full md:w-48 cursor-pointer shadow-inner"
                    >
                        {tables.map(t => <option key={t} value={t}>{t} Table</option>)}
                    </select>
                </div>
            </div>

            {/* 🔥 Server-Side Search and Filter Bar 🔥 */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700 p-3 rounded-xl shadow-sm flex flex-col md:flex-row gap-4 shrink-0">
                <div className="relative flex-1">
                    <FaSearch className="absolute left-3 top-3 text-slate-500 text-sm" />
                    <input 
                        type="text" 
                        placeholder={`Search globally in ${selectedTable}...`}
                        value={globalSearch}
                        onChange={(e) => { setGlobalSearch(e.target.value); setCurrentPage(1); }}
                        className="w-full bg-[#0f172a] border border-slate-600 text-white text-xs rounded-lg py-2.5 pl-9 pr-3 outline-none focus:border-blue-500 shadow-inner"
                    />
                </div>
                
                <div className="flex flex-1 gap-2 items-center">
                    <div className="relative w-1/3">
                        <FaFilter className="absolute left-3 top-3 text-slate-500 text-xs" />
                        <select 
                            value={filterColumn}
                            onChange={(e) => { setFilterColumn(e.target.value); setCurrentPage(1); }}
                            className="w-full bg-[#0f172a] border border-slate-600 text-slate-300 text-xs font-bold rounded-lg py-2.5 pl-8 pr-2 outline-none focus:border-blue-500 cursor-pointer shadow-inner"
                        >
                            <option value="">Filter By...</option>
                            {availableColumns.map(col => <option key={col} value={col}>{col.toUpperCase()}</option>)}
                        </select>
                    </div>
                    <input 
                        type="text" 
                        placeholder="Exact match or contains..."
                        value={filterValue}
                        onChange={(e) => { setFilterValue(e.target.value); setCurrentPage(1); }}
                        disabled={!filterColumn}
                        className="w-2/3 bg-[#0f172a] border border-slate-600 text-white text-xs rounded-lg py-2.5 px-3 outline-none focus:border-blue-500 disabled:opacity-50 shadow-inner"
                    />
                </div>
            </div>

            {/* Data Grid */}
            <div className="flex-1 bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700 shadow-xl overflow-hidden flex flex-col relative">
                
                <div className="overflow-auto custom-scrollbar flex-1 p-2">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-slate-500 font-bold animate-pulse">Fetching Database Records...</div>
                    ) : tableData.length === 0 ? (
                        <div className="flex justify-center items-center h-full text-slate-500 font-bold">No matching records found in DB.</div>
                    ) : (
                        <table className="w-full text-left text-xs text-slate-300 border-collapse">
                            <thead className="bg-[#0f172a] text-slate-400 uppercase tracking-wider sticky top-0 z-10 shadow-md">
                                <tr>
                                    {availableColumns.slice(0, 10).map(key => (
                                        <th key={key} className="p-3 border-b border-slate-700 whitespace-nowrap">{key}</th>
                                    ))}
                                    <th className="p-3 border-b border-slate-700 text-center sticky right-0 bg-[#0f172a]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {tableData.map((row, idx) => (
                                    <tr key={row.id || idx} className="hover:bg-slate-800/50 transition-colors">
                                        {availableColumns.slice(0, 10).map(key => (
                                            <td key={key} className="p-3 border-b border-slate-800/50 max-w-[200px] truncate">
                                                {editingRow === row.id && key !== 'id' ? (
                                                    <input 
                                                        type="text" 
                                                        value={editFormData[key] || ''} 
                                                        onChange={(e) => handleFieldChange(key, e.target.value)}
                                                        className="w-full bg-[#0f172a] border border-slate-500 text-white rounded p-1.5 text-xs outline-none focus:border-blue-500"
                                                    />
                                                ) : (
                                                    typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key] ?? '')
                                                )}
                                            </td>
                                        ))}
                                        <td className="p-3 border-b border-slate-800/50 flex justify-center gap-2 sticky right-0 bg-slate-900/80 backdrop-blur-md">
                                            {editingRow === row.id ? (
                                                <>
                                                    <button onClick={handleSaveEdit} className="p-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded transition-colors"><FaSave size={14}/></button>
                                                    <button onClick={() => setEditingRow(null)} className="p-1.5 bg-slate-600/20 text-slate-400 hover:bg-slate-600 hover:text-white rounded transition-colors"><FaTimes size={14}/></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleEditClick(row)} className="p-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded transition-colors"><FaEdit size={14}/></button>
                                                    <button onClick={() => handleDelete(row.id)} className="p-1.5 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded transition-colors"><FaTrash size={14}/></button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* 🔥 Server-Side Pagination Footer 🔥 */}
                <div className="bg-[#0f172a] p-3 border-t border-slate-700 flex justify-between items-center shrink-0">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        Total Records: <span className="text-white">{totalRecords}</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                            disabled={currentPage === 1 || loading}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded disabled:opacity-50 transition-colors"
                        >
                            <FaChevronLeft size={12} />
                        </button>
                        
                        <span className="text-xs text-slate-300 font-bold">
                            Page {currentPage} of {totalPages}
                        </span>
                        
                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                            disabled={currentPage === totalPages || loading}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded disabled:opacity-50 transition-colors"
                        >
                            <FaChevronRight size={12} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}