import axios from 'axios';

const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000/api';
  }
  if (hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.')) {
    return `http://${hostname}:5000/api`;
  }
  // Production VPS with domain loaded over HTTPS
  if (window.location.protocol === 'https:') {
    return `https://${hostname}/api`;
  }
  // Fallback for custom dev domains / IPs accessed over HTTP
  return `http://${hostname}:5000/api`;
};

const api = axios.create({
  baseURL: getBaseURL(), 
});

api.interceptors.request.use((config) => {
    if (typeof config.url === 'string') {
        if (config.url.startsWith('/api/')) {
            config.url = config.url.replace(/^\/api/, '');
        } else if (config.url === '/api') {
            config.url = '/';
        }
    }
    const token = localStorage.getItem('token') || localStorage.getItem('userToken') || localStorage.getItem('admin_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

api.interceptors.response.use((response) => {
    if (response.data) {
        let stringData = JSON.stringify(response.data);
        const host = window.location.hostname;
        const protocol = window.location.protocol;
        
        // Dynamically choose secure HTTPS url or local port-based URL
        const replacementBase = import.meta.env.VITE_API_URL
            ? import.meta.env.VITE_API_URL.replace('/api', '')
            : (protocol === 'https:') 
                ? `https://${host}` 
                : (host === 'localhost' || host === '127.0.0.1') 
                    ? 'http://localhost:5000' 
                    : `http://${host}:5000`;

        if (stringData.includes('http://72.62.249.211:5000')) {
            stringData = stringData.replace(/http:\/\/72\.62\.249\.211:5000/g, replacementBase);
            response.data = JSON.parse(stringData);
        }
        // Also dynamically map localhost backend URLs if loaded from LAN IP or VPS
        if (host !== 'localhost' && stringData.includes('http://localhost:5000')) {
            stringData = stringData.replace(/http:\/\/localhost:5000/g, replacementBase);
            response.data = JSON.parse(stringData);
        }
    }
    return response;
}, (error) => {
    if (error.response && error.response.status === 401) {
        const errMsg = String(error.response?.data?.error || '');
        const storedUser = localStorage.getItem('user');
        let isStudent = false;
        if (storedUser) {
            try {
                const u = JSON.parse(storedUser);
                const role = String(u.role || '').toUpperCase();
                isStudent = (role === 'STUDENT' || role === 'USER') && !u.department && !u.businessType;
            } catch (e) {}
        }
        
        const isExpiredOrInvalidToken = errMsg.includes('Invalid or Expired Token') || 
                                         errMsg.includes('Access Denied') || 
                                         errMsg.includes('Invalid token payload') || 
                                         errMsg.includes('User account no longer exists');

        const isStudentDeviceMismatch = isStudent && errMsg.includes('Logged in from another device');

        if (isExpiredOrInvalidToken || isStudentDeviceMismatch) {
            console.warn("Session Expired or Invalid Token:", errMsg);
            localStorage.removeItem('token');
            localStorage.removeItem('userToken');
            localStorage.removeItem('user');
            window.location.href = '/login'; 
        }
    }
    return Promise.reject(error);
});

export default api;