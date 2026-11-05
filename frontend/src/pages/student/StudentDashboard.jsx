import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { toast } from 'react-hot-toast';
import { Menu, LogOut, AlertTriangle, Info, Lock, MonitorPlay } from 'lucide-react'; // 🔥 FIX: MonitorPlay added here
import Sidebar from './components/Sidebar';
import EnrollmentTab from './components/EnrollmentTab';
import PaymentHistory from './components/PaymentHistory';
import MyClassroom from './components/MyClassroom'; 
import StudentOverview from './components/StudentOverview';
import DeliveryHub from './components/DeliveryHub';
import ProfileSettings from './components/ProfileSettings';

const urlParams = new URLSearchParams(window.location.search);
const ghostToken = urlParams.get('token');
const isGhostMode = urlParams.get('embedded') === 'true';

if (isGhostMode && ghostToken) {
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
        if (key === 'token' || key === 'userToken') return ghostToken;
        return originalGetItem.apply(this, arguments);
    };
    axios.defaults.headers.common['Authorization'] = `Bearer ${ghostToken}`;
}

// 🔥 FIX: Utility function to force HTTPS for images coming from the backend API
const getSecureImageUrl = (url) => {
    if (!url) return '';
    // Replace the insecure IP address with your secure domain
    return url.replace('http://72.62.249.211:5000', 'https://imacampus.online');
};

const StudentDashboard = () => {

  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate(); 

  const urlBusinessId = searchParams.get('businessId');

  useEffect(() => {
    if (!isGhostMode && ghostToken) {
        localStorage.setItem('token', ghostToken);
        localStorage.setItem('userToken', ghostToken); 
    }

    if (urlBusinessId && !isGhostMode) {
        localStorage.setItem('selectedBusiness', urlBusinessId); 
        localStorage.setItem('businessId', urlBusinessId); 
    }

    if (ghostToken || urlBusinessId) {
        const cleanUrl = isGhostMode ? `${location.pathname}?embedded=true` : location.pathname;
        navigate(cleanUrl, { replace: true });
    }
  }, [ghostToken, urlBusinessId, location.pathname, navigate]);
  
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'home'); 
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [businesses, setBusinesses] = useState([]);
  const [alerts, setAlerts] = useState([]); 

  useEffect(() => {
    const checkPaycorpReturn = async () => {
        if (searchParams.get('paycorp') === 'return') {
            const reqid = searchParams.get('reqid');
            const clientRef = searchParams.get('clientRef');
            if (reqid && clientRef) {
                const toastId = toast.loading('Verifying Paycorp Payment...');
                try {
                    const res = await axios.post('/student/paycorp-complete', { reqid, clientRef });
                    if (res.data.success && res.data.status === 'success') {
                        toast.success('Payment Verification Successful! Test complete.', { id: toastId });
                    } else {
                        toast.error('Payment Verification Failed.', { id: toastId });
                    }
                } catch (err) {
                    toast.error('Payment Verification Error.', { id: toastId });
                }
                // Clean url parameters to prevent re-triggering
                navigate(location.pathname, { replace: true });
            }
        }
    };
    checkPaycorpReturn();
  }, [searchParams, location.pathname, navigate]);

  const [bgImage, setBgImage] = useState('/student-bg.jpg'); 

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const enrollRes = await axios.get('/student/available-enrollments');
        setBusinesses(enrollRes.data.businesses || []);
        const dashRes = await axios.get('/student/dashboard');
        setAlerts(dashRes.data?.alerts || []);
      } catch (error) {
        console.error('API Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLogout = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-red-500 font-bold text-xl tracking-wide animate-pulse">Loading Workspace...</div>;

  return (
    <div 
        className="min-h-screen w-full flex items-center justify-center p-2 sm:p-4 md:p-8 relative overflow-hidden bg-cover bg-center transition-all duration-500"
        style={{ backgroundImage: `url(${getSecureImageUrl(bgImage)})` }} // 🔥 FIX: Applying secure image URL
    >
      {/* Dark overlay for the background wallpaper */}
      <div className="absolute inset-0 bg-black/60 z-0"></div>

      <div className="glass-container w-full max-w-[1600px] h-[98vh] md:h-[92vh] rounded-3xl md:rounded-[2.5rem] flex overflow-hidden relative z-10 transition-all duration-500 bg-black/35 backdrop-blur-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            sidebarOpen={sidebarOpen} 
            setSidebarOpen={setSidebarOpen} 
            handleLogout={handleLogout} 
            bgImage={getSecureImageUrl(bgImage)} // 🔥 FIX: Passed secure image URL to Sidebar
            setBgImage={setBgImage} 
          />

          <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10 w-full">
            
            <header className="lg:hidden bg-black/40 backdrop-blur-md border-b border-white/10 p-4 flex items-center justify-between sticky top-0 z-30">
              <img src="/logo.png" alt="IMA Campus" className="h-8 w-auto" />
              <div className="flex items-center gap-3">
                  <button onClick={handleLogout} className="text-white/70 hover:text-red-500 p-2 bg-white/5 rounded-xl transition-colors"><LogOut size={20}/></button>
                  <button onClick={() => setSidebarOpen(true)} className="text-white p-2 bg-red-600/20 rounded-xl transition-colors"><Menu size={24} /></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 scroll-smooth w-full custom-scrollbar">
              <div className="w-full h-full max-w-7xl mx-auto">
                
                {activeTab !== 'home' && alerts.length > 0 && (
                    <div className="mb-8 space-y-4">
                        {alerts.map((alert, idx) => (
                            <div key={idx} className={`p-5 rounded-2xl flex items-start gap-4 glass-card border-l-4
                                ${alert.type === 'danger' ? 'border-l-red-500' : alert.type === 'locked' ? 'border-l-red-600' : 'border-l-yellow-400'}`}>
                                <div className={`p-2.5 rounded-xl shrink-0 bg-white/10 ${alert.type === 'danger' ? 'text-red-400' : alert.type === 'locked' ? 'text-red-500' : 'text-yellow-400'}`}>
                                  {alert.type === 'danger' && <AlertTriangle size={20} />}
                                  {alert.type === 'locked' && <Lock size={20} />}
                                  {alert.type === 'warning' && <Info size={20} />}
                                </div>
                                <div>
                                    <h4 className={`font-bold uppercase tracking-widest text-xs mb-1 ${alert.type === 'locked' ? 'text-red-500' : alert.type === 'danger' ? 'text-red-400' : 'text-yellow-400'}`}>
                                        {alert.type === 'locked' ? 'Action Required' : 'Notice'}
                                    </h4>
                                    <p className="text-sm font-medium text-white/80 leading-relaxed">{alert.msg}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="w-full h-full animate-fade-in relative">
    
    <div className={`h-full ${activeTab === 'home' ? 'block' : 'hidden'}`}>
        <StudentOverview setActiveTab={setActiveTab} />
    </div>

    <div className={`h-full ${activeTab === 'courses' ? 'block' : 'hidden'}`}>
        <EnrollmentTab businesses={businesses} setActiveTab={setActiveTab} />
    </div>

    <div className={`h-full ${activeTab === 'history' ? 'block' : 'hidden'}`}>
        <PaymentHistory isActive={activeTab === 'history'} />
    </div>

    <div className={`h-full ${activeTab === 'mycourses' ? 'block' : 'hidden'}`}>
        <MyClassroom setActiveTab={setActiveTab} />
    </div>

    <div className={`h-full ${activeTab === 'delivery' ? 'block' : 'hidden'}`}>
        <DeliveryHub />
    </div>

    <div className={`h-full ${activeTab === 'profile' ? 'block' : 'hidden'}`}>
        <ProfileSettings />
    </div>
</div>
                
              </div>
            </div>
          </main>
      </div>
    </div>
  );
};

export default StudentDashboard;