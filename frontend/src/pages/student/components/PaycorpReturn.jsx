import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import axios from '../../../api/axios';
import { toast } from 'react-hot-toast';

const PaycorpReturn = () => {
    const [searchParams] = useSearchParams();
    const { businessId } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('Processing Payment...');
    const hasProcessed = useRef(false);

    useEffect(() => {
        if (hasProcessed.current) return;
        
        const reqid = searchParams.get('reqid');
        
        if (reqid && businessId) {
            hasProcessed.current = true;
            processPayment(reqid, businessId);
        } else {
            setStatus('Invalid return parameters');
        }
    }, [searchParams]);

    const processPayment = async (reqid, businessId) => {
        // If we are in an iframe, send message to parent and don't verify here
        // The parent (EnrollmentTab) will handle the verification and enrollment
        if (window !== window.parent) {
            window.parent.postMessage({ type: 'PAYCORP_COMPLETE', reqid, businessId }, '*');
            setStatus('Redirecting...');
            return;
        }

        // Fallback for direct navigation
        try {
            const res = await axios.post('/student/paycorp-complete', { reqid, businessId });
            if (res.data && res.data.success) {
                toast.success('Payment successful!');
                navigate('/student/dashboard', { replace: true });
            } else {
                setStatus('Payment failed or cancelled.');
                setTimeout(() => navigate('/student/dashboard', { replace: true }), 3000);
            }
        } catch (error) {
            console.error('Error completing payment:', error);
            setStatus('Error verifying payment.');
            setTimeout(() => navigate('/student/dashboard', { replace: true }), 3000);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#111827' }}>
            <h2 style={{ color: 'white', fontFamily: 'sans-serif' }}>{status}</h2>
        </div>
    );
};

export default PaycorpReturn;
