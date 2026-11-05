import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { Loader2, Eye, EyeOff, UserPlus, CheckCircle2, Circle } from 'lucide-react';

const GlassInput = ({ label, name, required, type = "text", placeholder, options, value, onChange, prefix }) => (
  <div>
    <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-2 block">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {options ? (
      <div className="relative">
        <select name={name} required={required} value={value} onChange={onChange} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white focus:border-red-500 focus:bg-black/60 outline-none transition-all text-sm shadow-inner appearance-none cursor-pointer">
          {/* 🔥 FIX: Dropdown Placeholder eka dynamic kara 🔥 */}
          <option value="" disabled className="bg-slate-900">{placeholder || "Select an option"}</option>
          {options.map(opt => <option key={opt} value={opt} className="bg-slate-900">{opt}</option>)}
        </select>
      </div>
    ) : (
      <div className="relative flex items-center">
        {prefix && <span className={`absolute left-4 text-sm ${value ? 'text-white' : 'text-white/50'}`}>{prefix}</span>}
        <input type={type} name={name} required={required} value={value} onChange={onChange} placeholder={placeholder} className={`w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white placeholder-white/30 focus:border-red-500 focus:bg-black/60 outline-none transition-all text-sm shadow-inner ${prefix ? 'pl-[1.7rem]' : ''}`} />
      </div>
    )}
  </div>
);

// 🔥 FIX: Password Requirement UI Component eka 🔥
const PasswordRequirement = ({ met, text }) => (
  <div className={`flex items-center gap-2 text-[11px] font-bold tracking-wide transition-colors duration-300 ${met ? 'text-green-400' : 'text-white/40'}`}>
    {met ? <CheckCircle2 size={14} className="shrink-0" /> : <Circle size={14} className="shrink-0" />}
    {text}
  </div>
);

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    fName: '', lName: '', phone: '', directPhone: '', nic: '',
    houseNoVal: '', streetNameVal: '', villageVal: '', townVal: '', districtVal: '',
    password: '', confirmPassword: ''
  });

  const [isInternational, setIsInternational] = useState(false);

  // 🔥 FIX: Password checking state 🔥
  const [passwordChecks, setPasswordChecks] = useState({
    length: false
  });

  const [countryCode, setCountryCode] = useState('+');
  const [secondaryCountryCode, setSecondaryCountryCode] = useState('+');

  const districts = ["Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle", "Gampaha", "Hambantota", "Jaffna", "Kalutara", "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar", "Matale", "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya", "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya"];

  const validatePassword = (password) => {
    const length = password.length >= 8;

    setPasswordChecks({ length });
    return length;
  };

  const handleCountryCodeChange = (e, setter) => {
    let val = e.target.value;
    if (!val.startsWith('+')) val = '+' + val.replace(/\+/g, '');
    val = '+' + val.replace(/[^0-9]/g, ''); // keep + at start, then only numbers
    setter(val);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'phone' || name === 'directPhone') {
      let numericOnly = value.replace(/[^0-9]/g, '');

      if (!isInternational) {
        if (numericOnly.startsWith('0')) {
          numericOnly = numericOnly.slice(1);
        }
        if (numericOnly.length > 9) {
          numericOnly = numericOnly.slice(0, 9);
        }
      }

      setFormData({ ...formData, [name]: numericOnly });
      return;
    }

    setFormData({ ...formData, [name]: value });

    // Check password logic as user types
    if (name === 'password') {
      validatePassword(value);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    // 🔥 Check Strict Password Requirements before submit 🔥
    if (!validatePassword(formData.password)) {
      return toast.error("Please ensure your password meets all security requirements!");
    }

    if (!isInternational) {
      if (formData.phone && formData.phone.length !== 9) {
        return toast.error("Phone number must be exactly 10 digits.");
      }
      if (formData.directPhone && formData.directPhone.length !== 9) {
        return toast.error("Secondary number must be exactly 10 digits.");
      }
    }

    if (formData.password !== formData.confirmPassword) {
      return toast.error("Passwords do not match!");
    }

    setLoading(true);
    try {
      let finalPhone = formData.phone;
      let finalDirectPhone = formData.directPhone;

      if (!isInternational) {
        if (finalPhone.length === 9 && !finalPhone.startsWith('0')) finalPhone = '0' + finalPhone;
        if (finalDirectPhone && finalDirectPhone.length === 9 && !finalDirectPhone.startsWith('0')) finalDirectPhone = '0' + finalDirectPhone;
      } else {
        finalPhone = countryCode + finalPhone;
        if (finalDirectPhone) finalDirectPhone = secondaryCountryCode + finalDirectPhone;
      }

      const payload = {
        firstName: formData.fName,
        lastName: formData.lName,
        phone: finalPhone,
        optionalPhone: finalDirectPhone,
        nic: formData.nic,
        addressHouseNo: formData.houseNoVal,
        addressStreet: formData.streetNameVal,
        city: formData.townVal,
        district: formData.districtVal,
        password: formData.password,
        confirmPassword: formData.confirmPassword
      };

      await api.post('/auth/register', payload);

      toast.success("Account created successfully! Please login.");
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.error || "Registration failed. Please check details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 py-12 font-sans overflow-hidden">

      <div className="absolute inset-0 z-0 fixed">
        <img src="/mainglass.jpg" alt="Background" className="w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-4xl bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_25px_50px_rgba(0,0,0,0.5)] p-8 md:p-12 animate-fade-in">

        <div className="text-center mb-10">
          <div className="bg-white/5 p-4 rounded-[2rem] inline-block mb-4 border border-white/10 shadow-inner">
            <UserPlus size={40} className="text-red-500 drop-shadow-lg" />
          </div>
          <h2 className="text-3xl font-black text-white tracking-wide">Create an account</h2>
          <p className="text-white/60 text-sm mt-2 font-medium">Join the IMA Campus student portal today</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <GlassInput label="First Name" name="fName" required placeholder="ඔබගේ මුල් නම - Janith" value={formData.fName} onChange={handleChange} />
            <GlassInput label="Last Name" name="lName" required placeholder="ඔබගේ දෙවන නම - Karunarathne" value={formData.lName} onChange={handleChange} />

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-[11px] font-bold text-white/80 uppercase tracking-widest cursor-pointer mb-2 w-max">
                <input type="checkbox" checked={isInternational} onChange={(e) => setIsInternational(e.target.checked)} className="accent-red-500 w-4 h-4" />
                විදේශීය දුරකථන අංකයක් භාවිතා කරන්නේ නම් මෙහි Tick එකක් දාන්න
              </label>
            </div>

            {isInternational ? (
              <>
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-1">
                    <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-2 block">Code <span className="text-red-500">*</span></label>
                    <input type="text" value={countryCode} onChange={(e) => handleCountryCodeChange(e, setCountryCode)} required className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white focus:border-red-500 focus:bg-black/60 outline-none transition-all text-sm shadow-inner" />
                  </div>
                  <div className="md:col-span-3">
                    <GlassInput label="Phone Number" name="phone" type="tel" required placeholder="දුරකථන අංකය" value={formData.phone} onChange={handleChange} />
                  </div>
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-1">
                    <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-2 block">Code</label>
                    <input type="text" value={secondaryCountryCode} onChange={(e) => handleCountryCodeChange(e, setSecondaryCountryCode)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white focus:border-red-500 focus:bg-black/60 outline-none transition-all text-sm shadow-inner" />
                  </div>
                  <div className="md:col-span-3">
                    <GlassInput label="Secondary Number" name="directPhone" type="tel" placeholder="සෘජු දුරකථන අංකය" value={formData.directPhone} onChange={handleChange} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <GlassInput label="Phone Number" name="phone" type="tel" required placeholder="777909030" value={formData.phone} onChange={handleChange} prefix="0" />
                <GlassInput label="Secondary Number" name="directPhone" type="tel" placeholder="711809030" value={formData.directPhone} onChange={handleChange} prefix="0" />
              </>
            )}

            <div className="md:col-span-2">
              <GlassInput label="National Identity Card (NIC)" name="nic" required placeholder="ජාතික හැදුනුම්පත් අංකය නිවැරදිව ඇතුලත් කරන්න " value={formData.nic} onChange={handleChange} />
            </div>

            <GlassInput label="House Number" name="houseNoVal" placeholder="නිවසේ අංකය හෝ නම" value={formData.houseNoVal} onChange={handleChange} />
            <GlassInput label="Street Name" name="streetNameVal" required placeholder="ලිපිනයේ පළමු කොටස" value={formData.streetNameVal} onChange={handleChange} />

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 🔥 FIX: Lane is now optional (Removed required) 🔥 */}
              <GlassInput label="Lane (Optional)" name="villageVal" placeholder="ලිපිනයේ දෙවන කොටස" value={formData.villageVal} onChange={handleChange} />
              <GlassInput label="Town" name="townVal" required placeholder="ආසන්නතම නගරය" value={formData.townVal} onChange={handleChange} />

              {/* 🔥 FIX: Placeholder modified to දිස්ත්‍රික්කය 🔥 */}
              <GlassInput label="District" name="districtVal" required placeholder="දිස්ත්‍රික්කය" options={districts} value={formData.districtVal} onChange={handleChange} />
            </div>

            <div className="mt-4 pt-6 border-t border-white/10 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div>
                <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-2 block">Secure Password <span className="text-red-500">*</span></label>
                <div className="relative group">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password" required value={formData.password} onChange={handleChange}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 pr-14 text-white placeholder-white/30 focus:border-red-500 focus:bg-black/60 outline-none transition-all text-sm shadow-inner"
                    placeholder="Create a strong password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-4 flex items-center text-white/40 hover:text-white transition-colors">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {/* 🔥 FIX: Real-time Password Checking UI 🔥 */}
                <div className="mt-4 bg-black/20 border border-white/5 p-4 rounded-xl space-y-2">
                  <PasswordRequirement met={passwordChecks.length} text="අවම වශයෙන් අකුරු හෝ ඉලක්කම් 8ක් අඩංගු විය යුතුය" />
                  
                  <div className="pt-2 border-t border-white/10 mt-2">
                    <p className="text-[12px] font-bold text-emerald-400 tracking-wide text-center">
                      ඔබ ලියාපදිංචි වීමේදී ලබා දෙන මුරපදය (Password) මතක ඇති ස්ථානයක සුරක්ෂිතව තබාගන්න.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-2 block">Confirm Password <span className="text-red-500">*</span></label>
                <div className="relative group">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword" required value={formData.confirmPassword} onChange={handleChange}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 pr-14 text-white placeholder-white/30 focus:border-red-500 focus:bg-black/60 outline-none transition-all text-sm shadow-inner"
                    placeholder="Re-enter your password"
                  />
                </div>
              </div>
            </div>

          </div>

          <div className="pt-10 flex flex-col items-center">
            <button type="submit" disabled={loading} className="w-full md:w-auto md:min-w-[300px] px-12 py-4 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-black rounded-2xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center gap-2 text-sm uppercase tracking-widest hover:scale-105 disabled:opacity-70">
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Create Account'}
            </button>
            <p className="mt-8 text-sm text-white/60 font-medium">
              Already have an account? <Link to="/login" className="text-red-400 font-bold hover:text-red-300 hover:underline transition-colors ml-1">Log in here</Link>
            </p>
          </div>
        </form>

      </div>
    </div>
  );
}