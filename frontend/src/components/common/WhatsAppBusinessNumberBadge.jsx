import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { FaWhatsapp, FaCopy, FaCheck, FaInfoCircle } from 'react-icons/fa';
import toast from 'react-hot-toast';

export default function WhatsAppBusinessNumberBadge({ businessId, campaignType = 'FREE_SEMINAR', className = '' }) {
  const [phoneInfo, setPhoneInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!businessId || businessId === 'ALL') {
      setPhoneInfo(null);
      return;
    }

    const fetchPhoneInfo = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/admin/whatsapp-call/business-phone-info', {
          params: { businessId, campaignType }
        });
        if (isMounted && res.data && res.data.success) {
          setPhoneInfo(res.data.phoneInfo);
        }
      } catch (err) {
        console.error('Failed to load WA phone info:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPhoneInfo();
    return () => { isMounted = false; };
  }, [businessId, campaignType]);

  if (!businessId || businessId === 'ALL') return null;

  const handleCopy = async (e) => {
    e.stopPropagation();
    const numberToCopy = phoneInfo?.displayPhoneNumber || phoneInfo?.waNumId;
    if (!numberToCopy) {
      toast.error('No WhatsApp number available to copy');
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(numberToCopy);
      } else {
        // Fallback for non-HTTPS local network IPs
        const textArea = document.createElement("textarea");
        textArea.value = numberToCopy;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
        } finally {
          textArea.remove();
        }
      }

      setCopied(true);
      toast.success(`Copied WhatsApp Number: ${numberToCopy}`, {
        icon: '📞',
        style: {
          borderRadius: '10px',
          background: '#064e3b',
          color: '#a7f3d0',
        }
      });

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  if (loading) {
    return (
      <div className={`h-9 inline-flex items-center gap-2 px-3 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-wide animate-pulse ${className}`}>
        <FaWhatsapp className="animate-spin text-emerald-400" size={13} />
        <span className="text-[11px] opacity-80">Fetching WA Number...</span>
      </div>
    );
  }

  if (!phoneInfo || (!phoneInfo.displayPhoneNumber && !phoneInfo.waNumId)) {
    return (
      <div className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl bg-slate-800/40 border border-slate-700/40 text-slate-400 text-[11px] font-bold ${className}`} title="No WhatsApp Business credentials linked to this business">
        <FaWhatsapp className="text-slate-500" size={13} />
        <span className="opacity-70">No WA Connected</span>
      </div>
    );
  }

  const displayNumber = phoneInfo.displayPhoneNumber || `ID: ${phoneInfo.waNumId}`;
  const quality = phoneInfo.qualityRating;

  return (
    <div
      onClick={handleCopy}
      title={`${phoneInfo.verifiedName ? `[${phoneInfo.verifiedName}] ` : ''}${displayNumber} (Click to copy)`}
      className={`h-9 group relative inline-flex items-center gap-2 px-3 rounded-xl bg-gradient-to-r from-emerald-950/60 to-emerald-900/40 hover:from-emerald-900/70 hover:to-emerald-800/60 border border-emerald-500/30 hover:border-emerald-400/60 text-emerald-300 text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer shadow-sm hover:shadow-emerald-900/20 select-none ${className}`}
    >
      {/* WhatsApp Icon */}
      <div className="relative flex items-center justify-center">
        <FaWhatsapp className="text-emerald-400 text-sm drop-shadow group-hover:scale-110 transition-transform" />
        {quality === 'GREEN' && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
        )}
      </div>

      {/* Phone Number text */}
      <div className="flex items-center gap-1">
        <span className="tracking-wide text-emerald-200 group-hover:text-white transition-colors">
          {displayNumber}
        </span>
      </div>

      {/* Copy / Copied Action */}
      <button
        type="button"
        className="p-1 rounded-md bg-emerald-800/40 group-hover:bg-emerald-600/40 text-emerald-300 group-hover:text-white transition-all"
        title="Copy number"
      >
        {copied ? (
          <FaCheck className="text-emerald-300 text-[10px]" />
        ) : (
          <FaCopy className="text-emerald-400/80 group-hover:text-emerald-200 text-[10px]" />
        )}
      </button>

      {/* Copied tooltip overlay */}
      {copied && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-emerald-900 text-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded shadow-lg border border-emerald-500/40 pointer-events-none whitespace-nowrap animate-fade-in-up">
          Copied!
        </span>
      )}
    </div>
  );
}
