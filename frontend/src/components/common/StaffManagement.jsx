import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Users, Edit3, Trash2, Shield, UserPlus, X, Loader2, Search, Briefcase, Layers, Ghost, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import BusinessBadge from './BusinessBadge';
import { useTheme } from '../../contexts/ThemeContext';

export default function StaffManagement({ loggedInUser }) {
  const { appTheme, isDarkMode } = useTheme();
  const isModern = appTheme === 'modern';

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlDept = searchParams.get('dept');

  const [staffList, setStaffList] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState(urlDept || (loggedInUser?.department === 'Physical' ? 'Physical' : ''));
  const [roleFilter, setRoleFilter] = useState('');

  const userRole = loggedInUser?.role || '';
  const isTopRole = (r) => {
    if (!r) return false;
    const norm = String(r).toUpperCase().replace(/[\s_-]+/g, '_');
    return norm === 'SYSTEM_ADMIN' || norm === 'DIRECTOR' || norm === 'ADMIN_MANAGER';
  };
  const isAdmin = isTopRole(userRole);
  const isManager = userRole === 'Manager' || userRole === 'Ass Manager';
  const isSocialMediaDept = loggedInUser?.department === 'Social Media' || userRole === 'Social Media Manager' || userRole === 'SOCIAL_MEDIA_MANAGER';
  const isPhysicalDept = urlDept === 'Physical' || loggedInUser?.department === 'Physical';
  const canManageStaff = isAdmin || isManager;

  const allDepts = ['Administration', 'Class Coordination', 'Academic', 'Finance', 'Technical', 'Call Center', 'Delivery', 'Physical', 'Social Media'];
  const staffDepts = ['Administration', 'Academic', 'Finance', 'Technical', 'Call Center', 'Delivery', 'Physical', 'Social Media']; 
  
  const allRoles = ['System Admin', 'Director', 'Admin Manager', 'Manager', 'Ass Manager', 'Coordinator', 'Paper Marker', 'Lecture', 'Paper Guider', 'Caller', 'Call Center Agent', 'Petty Cash Officer', 'Staff', 'Social Media Manager', 'Social Media Staff'];
  
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', phone: '', nic: '', password: '', 
    role: isAdmin ? 'Manager' : (isSocialMediaDept ? 'Social Media Staff' : (isPhysicalDept ? 'Staff' : (loggedInUser?.department === 'Class Coordination' ? 'Coordinator' : 'Staff'))), 
    department: isAdmin ? 'Class Coordination' : (isSocialMediaDept ? 'Social Media' : (isPhysicalDept ? 'Physical' : loggedInUser?.department)),
    businessType: (!isAdmin && loggedInUser?.businessType) ? loggedInUser.businessType : ''
  });

  useEffect(() => {
    fetchStaff();
    fetchBusinesses();
  }, [loggedInUser, urlDept]);

  const fetchStaff = async () => {
    try {
      const targetDept = urlDept || loggedInUser?.department;
      const res = await api.get('/admin/staff', {
        params: { role: userRole, department: targetDept, businessType: loggedInUser?.businessType }
      });
      setStaffList(res.data);
    } catch {
      toast.error("Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinesses = async () => {
    try {
      const res = await api.get('/admin/staff/businesses');
      setBusinesses(res.data);
    } catch (err) {
      console.error("Error fetching businesses", err);
    }
  };

  const handleGhostLogin = async (staffId) => {
    try {
        const toastId = toast.loading("Switching to Ghost Mode...");
        const res = await api.post(`/auth/ghost-login/${staffId}`); 
        
        if (res.data.token && res.data.user) {
            localStorage.setItem('admin_token', localStorage.getItem('token'));
            localStorage.setItem('admin_user', localStorage.getItem('user'));
            
            const { password: _password, ...safeUser } = res.data.user;
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(safeUser));
            
            toast.success("Switched successfully!", { id: toastId });
            window.location.href = '/login';
        }
    } catch (error) {
        toast.error(error.response?.data?.error || "Ghost login failed.");
    }
  };

    const handleRoleChange = (newRole) => {
    let newDept = formData.department;
    if (isTopRole(newRole)) {
        newDept = 'Administration'; 
    } else if (newRole === 'Coordinator' || newRole === 'Paper Marker') {
        newDept = 'Class Coordination';
    } else if (newRole === 'Lecture' || newRole === 'Paper Guider') {
        newDept = 'Academic';
    } else if (newRole === 'Caller' || newRole === 'Call Center Agent') {
        newDept = 'Call Center';
    } else if (newRole === 'Social Media Manager' || newRole === 'Social Media Staff') {
        newDept = 'Social Media';
    } else if (newRole === 'Staff') {
        newDept = staffDepts.includes(newDept) ? newDept : staffDepts[0];
    } else if ((newRole === 'Manager' || newRole === 'Ass Manager') && !newDept) {
        newDept = allDepts[0];
    }
    setFormData({ ...formData, role: newRole, department: newDept });
  };

  const handleBusinessToggle = (bizName) => {
    const safeBiz = bizName.trim();
    let current = formData.businessType ? String(formData.businessType).split(',').map(b => b.trim()).filter(Boolean) : [];
    if (current.includes(safeBiz)) {
        current = current.filter(b => b !== safeBiz);
    } else {
        if (current.length >= 10) {
            toast.error("Maximum 10 businesses can be allocated per user.");
            return;
        }
        current.push(safeBiz);
    }
    setFormData({ ...formData, businessType: current.join(', ') });
  };

  const handleDeptChange = (newDept) => {
    let newRole = formData.role;
    if (newDept === 'Class Coordination' && (newRole === 'Staff' || newRole === 'Caller')) {
        newRole = 'Coordinator';
    } else if (newDept === 'Call Center' && (newRole === 'Staff' || newRole === 'Coordinator')) {
        newRole = 'Call Center Agent';
    } else if (newDept === 'Social Media' && (newRole !== 'Social Media Manager' && newRole !== 'Social Media Staff')) {
        newRole = 'Social Media Staff';
    } else if (newDept !== 'Class Coordination' && newRole === 'Coordinator') {
        newRole = 'Staff';
    } else if (newDept !== 'Call Center' && (newRole === 'Caller' || newRole === 'Call Center Agent')) {
        newRole = 'Staff';
    } else if (newDept !== 'Social Media' && (newRole === 'Social Media Manager' || newRole === 'Social Media Staff')) {
        newRole = 'Staff';
    }
    setFormData({ ...formData, department: newDept, role: newRole });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData };
      if (payload.department !== 'Class Coordination' && payload.role !== 'Lecture' && payload.role !== 'Paper Guider' && payload.role !== 'Paper Marker' && payload.department !== 'Academic') {
          payload.businessType = '';
      }
      
      if(editMode) {
          await api.put(`/admin/staff/${editId}`, payload);
          toast.success("Staff updated successfully!");
      } else {
          await api.post('/admin/staff', payload);
          toast.success("Staff created successfully!");
      }
      setShowModal(false);
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.error || "Action failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
      if(!window.confirm("Are you sure you want to delete this member?")) return;
      try {
          await api.delete(`/admin/staff/${id}`);
          toast.success("Staff deleted!");
          fetchStaff();
      } catch {
          toast.error("Failed to delete.");
      }
  };

  const openEditModal = (staff) => {
      setEditMode(true);
      setEditId(staff.id);
      setFormData({
          firstName: staff.firstName, lastName: staff.lastName, phone: staff.phone, 
          nic: staff.nic, password: '', role: staff.role, 
          department: staff.department || '', businessType: staff.businessType || ''
      });
      setShowModal(true);
  };

  const resetForm = () => {
      setEditMode(false);
      setEditId(null);
      setFormData({ 
        firstName: '', lastName: '', phone: '', nic: '', password: '', 
        role: isAdmin ? 'Manager' : (loggedInUser?.department === 'Class Coordination' ? 'Coordinator' : (loggedInUser?.department === 'Social Media' ? 'Social Media Staff' : 'Staff')), 
        department: isAdmin ? 'Class Coordination' : loggedInUser?.department,
        businessType: (!isAdmin && loggedInUser?.businessType) ? loggedInUser.businessType : ''
      });
  };

  const filteredStaff = staffList.filter(s => {
    const matchesSearch = (s.firstName + " " + s.lastName).toLowerCase().includes(searchQuery.toLowerCase()) || (s.phone && s.phone.includes(searchQuery));
    const isTop = isTopRole(s.role);
    const matchesDept = deptFilter ? (s.department === deptFilter || (deptFilter === 'Administration' && (isTop || s.department === 'Administration'))) : true;
    const matchesRole = roleFilter ? (s.role === roleFilter || String(s.role).toUpperCase().replace(/[\s_-]+/g, '_') === String(roleFilter).toUpperCase().replace(/[\s_-]+/g, '_')) : true;
    return matchesSearch && matchesDept && matchesRole;
  });

  const topLevelStaff = filteredStaff.filter(s => isTopRole(s.role) || s.department === 'Administration');
  
  const classCoordStaff = filteredStaff.filter(s => !isTopRole(s.role) && s.department === 'Class Coordination');
  const groupedByBusiness = classCoordStaff.reduce((acc, staff) => {
      const biz = staff.businessType || 'Unassigned';
      if(!acc[biz]) acc[biz] = [];
      acc[biz].push(staff);
      return acc;
  }, {});

  const otherDeptsStaff = filteredStaff.filter(s => !isTopRole(s.role) && s.department && s.department !== 'Class Coordination' && s.department !== 'Administration');
  const groupedByDept = otherDeptsStaff.reduce((acc, staff) => {
      const dept = staff.department;
      if(!acc[dept]) acc[dept] = [];
      acc[dept].push(staff);
      return acc;
  }, {});

  const unassignedStaff = filteredStaff.filter(s => !isTopRole(s.role) && (!s.department || s.department === ''));

  if (loading) return (
    <div className="flex h-full items-center justify-center min-h-[60vh]">
      <Loader2 size={40} className={`animate-spin ${isModern ? 'text-blue-500' : 'text-brand-accent'}`} />
    </div>
  );

  return (
    <div className="w-full animate-fade-in pb-12">
      
      {/* Back Button for Physical Department */}
      {(isPhysicalDept || urlDept === 'Physical') && (
        <button
          onClick={() => navigate('/physical/dashboard/overview')}
          className={`mb-4 flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 group cursor-pointer ${
            isModern 
              ? (isDarkMode 
                  ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700' 
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm')
              : 'bg-white/10 hover:bg-white/20 border border-white/15 text-white backdrop-blur-md shadow-lg'
          }`}
        >
          <ArrowLeft size={16} className={`group-hover:-translate-x-1 transition-transform ${isModern ? 'text-red-500' : 'text-red-400'}`} />
          <span>Back to Physical Dashboard</span>
        </button>
      )}

      {/* Header Area */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 ${
        isModern 
          ? (isDarkMode 
              ? 'bg-[#0D1424] border border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm' 
              : 'bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm')
          : 'mb-10'
      }`}>
        <div>
          <h1 className={`text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3 ${
            isModern ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-white drop-shadow-md'
          }`}>
            <Users className={isSocialMediaDept ? "text-indigo-500" : (isPhysicalDept ? "text-red-500" : (isModern ? "text-blue-500" : "text-brand-accent"))} size={32}/> 
            {isAdmin ? 'Staff Directory' : (isSocialMediaDept ? 'Social Media Team' : (isPhysicalDept ? 'Physical Campus Team' : 'My Team'))}
          </h1>
          <p className={`text-sm font-medium mt-1 ${
            isModern ? (isDarkMode ? 'text-slate-400' : 'text-slate-500') : 'text-gray-300'
          }`}>
            {isAdmin ? 'Manage system roles, departments, and user access levels.' : (isSocialMediaDept ? 'Manage editors, designers, and creators for Social Media.' : `Manage members for ${isPhysicalDept ? 'Physical Department' : loggedInUser?.department}.`)}
          </p>
        </div>
        
        <div className="flex flex-col xl:flex-row gap-3 w-full lg:w-auto items-center">
          <div className="relative w-full sm:w-64">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${isModern ? (isDarkMode ? 'text-slate-400' : 'text-slate-400') : 'text-emerald-400'}`} size={16} />
            <input 
              type="text" 
              placeholder="Search staff..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full rounded-xl py-2.5 pl-9 pr-4 text-sm font-medium outline-none transition-all ${
                isModern
                  ? (isDarkMode 
                      ? 'bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-blue-500' 
                      : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 shadow-sm')
                  : 'w-full bg-[#0F172A]/80 border border-white/10 backdrop-blur-md rounded-xl py-2.5 pl-9 pr-4 text-sm font-bold text-slate-200 outline-none focus:border-emerald-500 focus:bg-[#0F172A] shadow-inner placeholder-slate-500'
              }`}
            />
          </div>
          
          {!isSocialMediaDept && (
            <div className="relative w-full sm:w-48">
              <Layers className={`absolute left-3 top-1/2 -translate-y-1/2 ${isModern ? 'text-slate-400' : 'text-blue-400'}`} size={16} />
              <select 
                value={deptFilter} 
                onChange={(e) => setDeptFilter(e.target.value)}
                className={`w-full rounded-xl py-2.5 pl-9 pr-4 text-sm font-medium outline-none appearance-none cursor-pointer transition-all ${
                  isModern
                    ? (isDarkMode 
                        ? 'bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500' 
                        : 'bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white focus:border-blue-500 shadow-sm')
                    : 'w-full bg-[#0F172A]/80 border border-white/10 backdrop-blur-md rounded-xl py-2.5 pl-9 pr-4 text-sm font-bold text-slate-200 outline-none focus:border-blue-500 focus:bg-[#0F172A] shadow-inner'
                }`}
              >
                 <option value="" className={isModern ? (isDarkMode ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-800') : 'bg-[#0F172A] text-slate-200'}>All Departments</option>
                 {allDepts.map(d => <option key={d} value={d} className={isModern ? (isDarkMode ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-800') : 'bg-[#0F172A] text-slate-200'}>{d}</option>)}
              </select>
            </div>
          )}

          <div className="relative w-full sm:w-48">
            <Briefcase className={`absolute left-3 top-1/2 -translate-y-1/2 ${isModern ? 'text-slate-400' : 'text-purple-400'}`} size={16} />
            <select 
              value={roleFilter} 
              onChange={(e) => setRoleFilter(e.target.value)}
              className={`w-full rounded-xl py-2.5 pl-9 pr-4 text-sm font-medium outline-none appearance-none cursor-pointer transition-all ${
                isModern
                  ? (isDarkMode 
                      ? 'bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500' 
                      : 'bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white focus:border-blue-500 shadow-sm')
                  : 'w-full bg-[#0F172A]/80 border border-white/10 backdrop-blur-md rounded-xl py-2.5 pl-9 pr-4 text-sm font-bold text-slate-200 outline-none focus:border-purple-500 focus:bg-[#0F172A] shadow-inner'
              }`}
            >
               <option value="" className={isModern ? (isDarkMode ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-800') : 'bg-[#0F172A] text-slate-200'}>All Positions</option>
               {allRoles.map(r => <option key={r} value={r} className={isModern ? (isDarkMode ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-800') : 'bg-[#0F172A] text-slate-200'}>{r}</option>)}
            </select>
          </div>

          <button onClick={() => { resetForm(); setShowModal(true); }} className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all outline-none shrink-0 cursor-pointer ${
            isModern 
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-95' 
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)]'
          }`}>
            <UserPlus size={16}/> Add Staff
          </button>
        </div>
      </div>

      <div className="space-y-10">
        
        {/* Physical Department Dedicated Section */}
        {(isPhysicalDept || deptFilter === 'Physical') && filteredStaff.length > 0 && (
          <section>
            <h2 className={`text-sm font-extrabold mb-4 pb-2 flex items-center gap-2 uppercase tracking-wider ${
              isModern 
                ? (isDarkMode ? 'text-slate-200 border-b border-slate-800' : 'text-slate-800 border-b border-slate-200') 
                : 'text-white border-b border-white/10 drop-shadow-sm'
            }`}>
              <Users className="text-red-500" size={18}/> Physical Campus Staff & Members ({filteredStaff.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredStaff.map(staff => (
                <MinimalStaffCard 
                  key={staff.id} 
                  staff={staff} 
                  openEditModal={openEditModal} 
                  handleDelete={handleDelete} 
                  handleGhostLogin={handleGhostLogin} 
                  color="red" 
                  canEdit={true} 
                  isModern={isModern}
                  isDarkMode={isDarkMode}
                />
              ))}
            </div>
          </section>
        )}

        {/* Social Media Department Dedicated Section */}
        {isSocialMediaDept && !isPhysicalDept && filteredStaff.length > 0 && (
          <section>
            <h2 className={`text-sm font-extrabold mb-4 pb-2 flex items-center gap-2 uppercase tracking-wider ${
              isModern 
                ? (isDarkMode ? 'text-slate-200 border-b border-slate-800' : 'text-slate-800 border-b border-slate-200') 
                : 'text-white border-b border-white/10 drop-shadow-sm'
            }`}>
              <Users className="text-indigo-500" size={18}/> Social Media Staff & Editors ({filteredStaff.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredStaff.map(staff => (
                <MinimalStaffCard 
                  key={staff.id} 
                  staff={staff} 
                  openEditModal={openEditModal} 
                  handleDelete={handleDelete} 
                  handleGhostLogin={handleGhostLogin} 
                  color="purple" 
                  canEdit={true} 
                  isModern={isModern}
                  isDarkMode={isDarkMode}
                />
              ))}
            </div>
          </section>
        )}

        {/* System Administration */}
        {!isSocialMediaDept && topLevelStaff.length > 0 && (
          <section>
            <h2 className={`text-sm font-extrabold mb-4 pb-2 flex items-center gap-2 uppercase tracking-wider ${
              isModern 
                ? (isDarkMode ? 'text-slate-200 border-b border-slate-800' : 'text-slate-800 border-b border-slate-200') 
                : 'text-white border-b border-white/10 drop-shadow-sm'
            }`}>
              <Shield className="text-purple-500" size={18}/> Administration
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {topLevelStaff.map(staff => (
                <MinimalStaffCard 
                  key={staff.id} 
                  staff={staff} 
                  openEditModal={openEditModal} 
                  handleDelete={handleDelete} 
                  handleGhostLogin={handleGhostLogin} 
                  color="purple" 
                  canEdit={true} 
                  isModern={isModern}
                  isDarkMode={isDarkMode}
                />
              ))}
            </div>
          </section>
        )}

        {/* Class Coordination Department */}
        {!isSocialMediaDept && Object.keys(groupedByBusiness).length > 0 && (
           <section>
              <h2 className={`text-sm font-extrabold mb-4 pb-2 flex items-center gap-2 uppercase tracking-wider ${
                isModern 
                  ? (isDarkMode ? 'text-slate-200 border-b border-slate-800' : 'text-slate-800 border-b border-slate-200') 
                  : 'text-white border-b border-white/10 drop-shadow-sm'
              }`}>
                <Layers className="text-blue-500" size={18}/> Class Coordination
              </h2>
              <div className="space-y-8 mt-4">
                 {Object.keys(groupedByBusiness).map(biz => (
                    <div key={biz}>
                       <h3 className={`text-[11px] font-extrabold uppercase tracking-widest mb-3 ${
                         isModern ? (isDarkMode ? 'text-slate-400' : 'text-slate-500') : 'text-gray-400'
                       }`}>
                         Business: {biz}
                       </h3>
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                          {groupedByBusiness[biz].map(staff => (
                            <MinimalStaffCard 
                              key={staff.id} 
                              staff={staff} 
                              openEditModal={openEditModal} 
                              handleDelete={handleDelete} 
                              handleGhostLogin={handleGhostLogin} 
                              color="blue" 
                              canEdit={true} 
                              isModern={isModern}
                              isDarkMode={isDarkMode}
                            />
                          ))}
                       </div>
                    </div>
                 ))}
              </div>
           </section>
        )}

        {/* Other Departments */}
        {!isSocialMediaDept && Object.keys(groupedByDept).length > 0 && (
           <section>
              <h2 className={`text-sm font-extrabold mb-4 pb-2 flex items-center gap-2 uppercase tracking-wider ${
                isModern 
                  ? (isDarkMode ? 'text-slate-200 border-b border-slate-800' : 'text-slate-800 border-b border-slate-200') 
                  : 'text-white border-b border-white/10 drop-shadow-sm'
              }`}>
                <Briefcase className="text-emerald-500" size={18}/> Other Departments
              </h2>
              <div className="space-y-8 mt-4">
                 {Object.keys(groupedByDept).map(dept => (
                    <div key={dept}>
                       <h3 className={`text-[11px] font-extrabold uppercase tracking-widest mb-3 ${
                         isModern ? (isDarkMode ? 'text-slate-400' : 'text-slate-500') : 'text-gray-400'
                       }`}>
                         Dept: {dept}
                       </h3>
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                          {groupedByDept[dept].map(staff => (
                            <MinimalStaffCard 
                              key={staff.id} 
                              staff={staff} 
                              openEditModal={openEditModal} 
                              handleDelete={handleDelete} 
                              handleGhostLogin={handleGhostLogin} 
                              color="emerald" 
                              canEdit={true} 
                              isModern={isModern}
                              isDarkMode={isDarkMode}
                            />
                          ))}
                       </div>
                    </div>
                 ))}
              </div>
           </section>
        )}

        {/* Unassigned / General Staff */}
        {!isSocialMediaDept && unassignedStaff.length > 0 && (
           <section>
              <h2 className={`text-sm font-extrabold mb-4 pb-2 flex items-center gap-2 uppercase tracking-wider ${
                isModern 
                  ? (isDarkMode ? 'text-slate-200 border-b border-slate-800' : 'text-slate-800 border-b border-slate-200') 
                  : 'text-white border-b border-white/10 drop-shadow-sm'
              }`}>
                <Users className="text-amber-500" size={18}/> Other Staff (General / Unassigned)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-4">
                 {unassignedStaff.map(staff => (
                    <MinimalStaffCard 
                      key={staff.id} 
                      staff={staff} 
                      openEditModal={openEditModal} 
                      handleDelete={handleDelete} 
                      handleGhostLogin={handleGhostLogin} 
                      color="amber" 
                      canEdit={true} 
                      isModern={isModern}
                      isDarkMode={isDarkMode}
                    />
                 ))}
              </div>
           </section>
        )}

        {filteredStaff.length === 0 && (
          <div className={`text-center py-20 rounded-2xl border ${
            isModern 
              ? (isDarkMode ? 'bg-[#0D1424] border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500 shadow-sm')
              : 'bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 text-gray-400 shadow-[0_8px_32px_0_rgba(0,0,0,0.1)]'
          }`}>
            <Users size={40} className="mx-auto mb-4 opacity-40" />
            <p className="text-sm font-medium">No staff members found.</p>
          </div>
        )}
      </div>

      {/* Edit/Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className={`rounded-2xl p-6 w-full max-w-xl overflow-y-auto max-h-[90vh] custom-scrollbar transition-all ${
            isModern
              ? (isDarkMode 
                  ? 'bg-[#0D1424] border border-slate-800 text-slate-100 shadow-2xl' 
                  : 'bg-white border border-slate-200 text-slate-900 shadow-2xl')
              : 'bg-[#090E17]/80 backdrop-blur-3xl border border-white/20 text-white shadow-[0_8px_32px_0_rgba(0,0,0,0.6)]'
          }`}>
            
            <div className={`flex justify-between items-center mb-6 pb-4 border-b ${
              isModern ? (isDarkMode ? 'border-slate-800' : 'border-slate-200') : 'border-white/10'
            }`}>
              <h3 className={`text-lg font-extrabold ${isModern ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-white'}`}>
                 {editMode ? 'Edit Staff Profile' : 'Add New Staff'}
              </h3>
              <button onClick={() => setShowModal(false)} className={`${isModern ? (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900') : 'text-gray-400 hover:text-white'} transition-colors outline-none cursor-pointer`}><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-[11px] font-bold mb-1.5 block uppercase tracking-wider ${isModern ? (isDarkMode ? 'text-slate-400' : 'text-slate-600') : 'text-gray-400'}`}>First Name</label>
                  <input type="text" required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className={`w-full rounded-lg p-2.5 text-sm outline-none transition-all ${
                    isModern 
                      ? (isDarkMode ? 'bg-slate-900 border border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500 shadow-sm')
                      : 'bg-black/30 border border-white/10 text-white focus:border-brand-accent focus:bg-black/50 shadow-inner placeholder-gray-500'
                  }`} />
                </div>
                <div>
                  <label className={`text-[11px] font-bold mb-1.5 block uppercase tracking-wider ${isModern ? (isDarkMode ? 'text-slate-400' : 'text-slate-600') : 'text-gray-400'}`}>Last Name</label>
                  <input type="text" required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className={`w-full rounded-lg p-2.5 text-sm outline-none transition-all ${
                    isModern 
                      ? (isDarkMode ? 'bg-slate-900 border border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500 shadow-sm')
                      : 'bg-black/30 border border-white/10 text-white focus:border-brand-accent focus:bg-black/50 shadow-inner placeholder-gray-500'
                  }`} />
                </div>
                <div>
                  <label className={`text-[11px] font-bold mb-1.5 block uppercase tracking-wider ${isModern ? (isDarkMode ? 'text-slate-400' : 'text-slate-600') : 'text-gray-400'}`}>Phone</label>
                  <input type="text" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={`w-full rounded-lg p-2.5 text-sm outline-none transition-all ${
                    isModern 
                      ? (isDarkMode ? 'bg-slate-900 border border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500 shadow-sm')
                      : 'bg-black/30 border border-white/10 text-white focus:border-brand-accent focus:bg-black/50 shadow-inner placeholder-gray-500'
                  }`} />
                </div>
                <div>
                  <label className={`text-[11px] font-bold mb-1.5 block uppercase tracking-wider ${isModern ? (isDarkMode ? 'text-slate-400' : 'text-slate-600') : 'text-gray-400'}`}>NIC</label>
                  <input type="text" required value={formData.nic} onChange={e => setFormData({...formData, nic: e.target.value})} className={`w-full rounded-lg p-2.5 text-sm outline-none transition-all ${
                    isModern 
                      ? (isDarkMode ? 'bg-slate-900 border border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500 shadow-sm')
                      : 'bg-black/30 border border-white/10 text-white focus:border-brand-accent focus:bg-black/50 shadow-inner placeholder-gray-500'
                  }`} />
                </div>
              </div>

              <div className={`grid grid-cols-2 gap-4 border-t pt-5 mt-2 ${
                isModern ? (isDarkMode ? 'border-slate-800' : 'border-slate-100') : 'border-white/5'
              }`}>
                <div className={isTopRole(formData.role) ? 'col-span-2' : 'col-span-1'}>
                  <label className={`text-[11px] font-bold mb-1.5 block uppercase tracking-wider ${isModern ? (isDarkMode ? 'text-slate-400' : 'text-slate-600') : 'text-gray-400'}`}>Role</label>
                  <select disabled={!canManageStaff} value={formData.role} onChange={e => handleRoleChange(e.target.value)} className={`w-full rounded-lg p-2.5 text-sm outline-none disabled:opacity-60 cursor-pointer appearance-none ${
                    isModern 
                      ? (isDarkMode ? 'bg-slate-900 border border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500 shadow-sm')
                      : 'bg-black/30 border border-white/10 text-white focus:border-brand-accent shadow-inner'
                  }`}>
                    {canManageStaff ? allRoles.filter(r => isAdmin ? ((r !== 'Caller' && r !== 'Call Center Agent') || r === formData.role) : (['Admin Manager', 'Manager', 'Ass Manager', 'Coordinator', 'Paper Marker', 'Caller', 'Call Center Agent', 'Petty Cash Officer', 'Staff', 'Social Media Staff'].includes(r) || r === formData.role)).map(r => <option key={r} value={r} className={isModern && !isDarkMode ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>{r}</option>) : <option value={formData.role} className={isModern && !isDarkMode ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>{formData.role}</option>}
                  </select>
                </div>

                {!isTopRole(formData.role) && (
                  <div className="col-span-1">
                    <label className={`text-[11px] font-bold mb-1.5 block uppercase tracking-wider ${isModern ? (isDarkMode ? 'text-slate-400' : 'text-slate-600') : 'text-gray-400'}`}>Department</label>
                    <select disabled={!canManageStaff || formData.role === 'Coordinator' || formData.role === 'Caller' || formData.role === 'Call Center Agent' || formData.role === 'Social Media Manager' || formData.role === 'Social Media Staff'} value={formData.department} onChange={e => handleDeptChange(e.target.value)} className={`w-full rounded-lg p-2.5 text-sm outline-none disabled:opacity-60 cursor-pointer appearance-none ${
                      isModern 
                        ? (isDarkMode ? 'bg-slate-900 border border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500 shadow-sm')
                        : 'bg-black/30 border border-white/10 text-white focus:border-brand-accent shadow-inner'
                    }`}>
                      {canManageStaff 
                          ? (formData.role === 'Staff' 
                              ? staffDepts.map(d => <option key={d} value={d} className={isModern && !isDarkMode ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>{d}</option>) 
                              : allDepts.map(d => <option key={d} value={d} className={isModern && !isDarkMode ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>{d}</option>)) 
                          : <option value={formData.department} className={isModern && !isDarkMode ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>{formData.department}</option>
                      }
                    </select>
                  </div>
                )}

                {!isTopRole(formData.role) && (
                  <div className="col-span-2">
                    <label className={`text-[11px] font-bold mb-1.5 block uppercase tracking-wider ${isModern ? (isDarkMode ? 'text-slate-400' : 'text-slate-600') : 'text-gray-400'}`}>Business Assignment(s)</label>
                    <div className="flex flex-wrap gap-2">
                        {businesses.length > 0 ? businesses.map(b => {
                            const isSelected = (formData.businessType || '').split(',').map(x => x.trim()).includes(b.name.trim());
                            return (
                                <button 
                                    key={b.id} 
                                    type="button"
                                    onClick={() => handleBusinessToggle(b.name)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                                      isModern
                                        ? (isSelected 
                                            ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40' 
                                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/60 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700')
                                        : (isSelected 
                                            ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/50' 
                                            : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10')
                                    }`}
                                >
                                    {b.name}
                                </button>
                            );
                        }) : <span className="text-xs text-slate-500">No businesses available</span>}
                    </div>
                  </div>
                )}
              </div>
              
              <div className={`border-t pt-5 mt-2 ${
                isModern ? (isDarkMode ? 'border-slate-800' : 'border-slate-100') : 'border-white/5'
              }`}>
                <label className={`text-[11px] font-bold mb-1.5 flex justify-between uppercase tracking-wider ${isModern ? (isDarkMode ? 'text-slate-400' : 'text-slate-600') : 'text-gray-400'}`}>
                  <span>Password</span>
                  {editMode && <span className={`${isModern ? 'text-blue-500' : 'text-brand-accent'} lowercase font-medium tracking-normal`}>Optional: Leave blank</span>}
                </label>
                <input type="password" required={!editMode} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className={`w-full rounded-lg p-2.5 text-sm outline-none transition-all ${
                  isModern 
                    ? (isDarkMode ? 'bg-slate-900 border border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500 shadow-sm')
                    : 'bg-black/30 border border-white/10 text-white focus:border-brand-accent focus:bg-black/50 shadow-inner'
                }`} />
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all outline-none border border-transparent cursor-pointer ${
                  isModern 
                    ? (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}>Cancel</button>
                <button type="submit" disabled={saving} className={`font-bold py-2.5 px-6 rounded-xl flex items-center justify-center disabled:opacity-70 transition-all outline-none cursor-pointer ${
                  isModern
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                    : 'bg-brand-accent/90 hover:bg-brand-accent text-white shadow-[0_4px_15px_rgba(225,29,72,0.4)]'
                }`}>
                  {saving ? <Loader2 className="animate-spin" size={18}/> : (editMode ? 'Save Changes' : 'Create Staff')}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}

// Staff Card Component
function MinimalStaffCard({ staff, openEditModal, handleDelete, handleGhostLogin, color, canEdit, isModern, isDarkMode }) {
  const isPaperMarker = staff.role === 'Paper Marker';
  const resolvedColor = isPaperMarker ? 'amber' : color;

  // Modern Clean Badges
  const modernBadgeColors = {
    purple: isDarkMode ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' : 'bg-purple-50 text-purple-700 border-purple-200',
    blue: isDarkMode ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200',
    emerald: isDarkMode ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: isDarkMode ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200',
    red: isDarkMode ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' : 'bg-rose-50 text-rose-700 border-rose-200',
  };

  // Pure Glassmorphism Badges
  const classicBadgeColors = {
    purple: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    blue: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    red: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  };

  const badgeStyle = isModern ? (modernBadgeColors[resolvedColor] || modernBadgeColors.blue) : (classicBadgeColors[resolvedColor] || classicBadgeColors.blue);

  return (
    <div className={`relative rounded-2xl p-5 transition-all duration-300 flex flex-col h-full group overflow-hidden ${
      isModern
        ? (isDarkMode 
            ? 'bg-[#0D1424] hover:bg-[#111A2E] border border-slate-800 hover:border-slate-700 shadow-md hover:shadow-xl' 
            : 'bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md')
        : 'bg-[#0F172A]/40 hover:bg-[#0F172A]/80 border border-white/5 hover:border-white/20 rounded-3xl p-6 shadow-lg hover:shadow-2xl hover:-translate-y-1 backdrop-blur-sm'
    }`}>
      
      {/* Background Accent glow (Classic only) */}
      {!isModern && (
        <div className={`absolute -top-10 -right-10 w-32 h-32 blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none rounded-full ${resolvedColor === 'purple' ? 'bg-purple-500' : resolvedColor === 'blue' ? 'bg-blue-500' : resolvedColor === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
      )}

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-base shadow-sm shrink-0 ${
            resolvedColor === 'purple' ? 'bg-gradient-to-br from-purple-600 to-indigo-600' :
            resolvedColor === 'blue' ? 'bg-gradient-to-br from-blue-600 to-cyan-600' :
            resolvedColor === 'amber' ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
            resolvedColor === 'red' ? 'bg-gradient-to-br from-red-500 to-rose-600' :
            'bg-gradient-to-br from-emerald-500 to-teal-600'
          }`}>
            {staff.firstName.charAt(0)}{staff.lastName.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-bold tracking-tight truncate ${
                isModern ? (isDarkMode ? 'text-slate-100' : 'text-slate-900') : 'text-slate-100 drop-shadow-sm'
              }`} title={`${staff.firstName} ${staff.lastName}`}>
                 {staff.firstName} {staff.lastName}
              </h3>
              <BusinessBadge businessType={staff.businessType} role={staff.role} />
            </div>
            <p className={`text-[11px] font-mono mt-0.5 font-semibold ${
              isModern ? (isDarkMode ? 'text-slate-400' : 'text-slate-500') : 'text-slate-400 tracking-widest'
            }`}>{staff.phone}</p>
          </div>
        </div>
      </div>

      <div className="mb-5 relative z-10 space-y-2">
         <div className="flex items-center justify-between">
           <span className={`text-[10px] font-bold uppercase tracking-widest ${
             isModern ? (isDarkMode ? 'text-slate-500' : 'text-slate-400') : 'text-slate-500'
           }`}>Position</span>
           <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border ${badgeStyle}`}>
             {staff.role}
           </span>
         </div>
         {staff.department && (
            <div className="flex items-center justify-between">
               <span className={`text-[10px] font-bold uppercase tracking-widest ${
                 isModern ? (isDarkMode ? 'text-slate-500' : 'text-slate-400') : 'text-slate-500'
               }`}>Department</span>
               <span className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                 isModern ? (isDarkMode ? 'text-slate-300' : 'text-slate-700') : 'text-slate-300'
               }`}><Briefcase size={10} className="opacity-70"/> {staff.department}</span>
            </div>
         )}
         {staff.businessType && (
            <div className="flex items-center justify-between">
               <span className={`text-[10px] font-bold uppercase tracking-widest ${
                 isModern ? (isDarkMode ? 'text-slate-500' : 'text-slate-400') : 'text-slate-500'
               }`}>Business</span>
               <span className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                 isModern ? (isDarkMode ? 'text-slate-300' : 'text-slate-700') : 'text-slate-300'
               }`}><Layers size={10} className="opacity-70"/> {staff.businessType}</span>
            </div>
         )}
      </div>

      {canEdit && (
        <div className={`mt-auto grid grid-cols-3 gap-2 relative z-10 pt-3 border-t ${
          isModern ? (isDarkMode ? 'border-slate-800' : 'border-slate-100') : 'border-white/10'
        }`}>
            <button 
                onClick={() => handleGhostLogin(staff.id)} 
                title="Ghost Login to Account"
                className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs font-bold outline-none cursor-pointer ${
                  isModern
                    ? (isDarkMode 
                        ? 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20' 
                        : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 shadow-sm')
                    : 'bg-purple-500/15 border border-purple-500/30 hover:border-purple-400 hover:bg-purple-500/30 text-purple-300 shadow-sm'
                }`}>
                <Ghost size={14} className={isModern ? (isDarkMode ? 'text-purple-300' : 'text-purple-600') : 'text-purple-300'}/>
                <span className="text-[10px]">Ghost</span>
            </button>
            <button 
                onClick={() => openEditModal(staff)} 
                title="Edit Details"
                className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all text-xs font-medium outline-none cursor-pointer ${
                  isModern
                    ? (isDarkMode 
                        ? 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700' 
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm')
                    : 'bg-white/5 border border-white/10 hover:border-blue-500 hover:bg-blue-500/20 text-slate-300 hover:text-blue-300 shadow-sm'
                }`}>
                <Edit3 size={13}/>
                <span className="text-[10px]">Edit</span>
            </button>
            <button 
                onClick={() => handleDelete(staff.id)} 
                title="Delete User"
                className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all text-xs font-medium outline-none cursor-pointer ${
                  isModern
                    ? (isDarkMode 
                        ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20' 
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 shadow-sm')
                    : 'bg-white/5 border border-white/10 hover:border-rose-500 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 shadow-sm'
                }`}>
                <Trash2 size={13}/>
                <span className="text-[10px]">Delete</span>
            </button>
        </div>
      )}
    </div>
  );
}