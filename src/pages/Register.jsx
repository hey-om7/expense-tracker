import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const googleBtnRef = useRef(null);

  // Password strength
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-error' };
    if (score <= 2) return { score: 2, label: 'Fair', color: 'bg-[#f59e0b]' };
    if (score <= 3) return { score: 3, label: 'Good', color: 'bg-primary-container' };
    return { score: 4, label: 'Strong', color: 'bg-tertiary' };
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (name.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      await register(name, email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCallback = async (response) => {
    try {
      setLoading(true);
      setError('');
      await googleLogin(response.credential);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Google sign-up failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
        });
        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            width: googleBtnRef.current.offsetWidth,
            text: 'continue_with',
            shape: 'pill',
          });
        }
      }
    };
    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGoogle();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-[-200px] right-[-200px] w-[500px] h-[500px] rounded-full bg-tertiary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-150px] left-[-150px] w-[400px] h-[400px] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-container/20 border border-primary-container/30 mb-4">
            <span className="material-symbols-outlined text-primary-container text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              account_balance_wallet
            </span>
          </div>
          <h1 className="text-3xl font-headline font-bold text-on-surface tracking-tight">
            Wallo
          </h1>
          <p className="text-on-surface-variant text-sm mt-1 font-inter">
            Start tracking your wealth
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-container-low/80 backdrop-blur-xl border border-outline-variant/30 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-headline font-bold text-on-surface mb-1">Create account</h2>
          <p className="text-on-surface-variant text-sm mb-6">Set up your personal finance hub</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div className="relative group">
              <input
                id="register-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder=" "
                className="peer w-full bg-surface-container/60 border border-outline-variant/40 rounded-xl px-4 pt-5 pb-2 text-on-surface text-sm font-inter
                  focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container/50
                  transition-all duration-200 placeholder-transparent"
                autoComplete="name"
              />
              <label
                htmlFor="register-name"
                className="absolute left-4 top-2 text-[11px] font-medium text-on-surface-variant
                  peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-on-surface-variant/60
                  peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-primary-container
                  transition-all duration-200 pointer-events-none"
              >
                Full Name
              </label>
            </div>

            {/* Email */}
            <div className="relative group">
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                className="peer w-full bg-surface-container/60 border border-outline-variant/40 rounded-xl px-4 pt-5 pb-2 text-on-surface text-sm font-inter
                  focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container/50
                  transition-all duration-200 placeholder-transparent"
                autoComplete="email"
              />
              <label
                htmlFor="register-email"
                className="absolute left-4 top-2 text-[11px] font-medium text-on-surface-variant
                  peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-on-surface-variant/60
                  peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-primary-container
                  transition-all duration-200 pointer-events-none"
              >
                Email Address
              </label>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="relative group">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=" "
                  className="peer w-full bg-surface-container/60 border border-outline-variant/40 rounded-xl px-4 pt-5 pb-2 pr-12 text-on-surface text-sm font-inter
                    focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container/50
                    transition-all duration-200 placeholder-transparent"
                  autoComplete="new-password"
                />
                <label
                  htmlFor="register-password"
                  className="absolute left-4 top-2 text-[11px] font-medium text-on-surface-variant
                    peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-on-surface-variant/60
                    peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-primary-container
                    transition-all duration-200 pointer-events-none"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-on-surface transition-colors"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              {/* Password strength bar */}
              {password && (
                <div className="flex items-center gap-2 px-1">
                  <div className="flex-1 flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          i <= passwordStrength.score ? passwordStrength.color : 'bg-outline-variant/20'
                        }`}
                      />
                    ))}
                  </div>
                  <span className={`text-[10px] font-inter font-medium ${
                    passwordStrength.score <= 1 ? 'text-error' :
                    passwordStrength.score <= 2 ? 'text-[#f59e0b]' :
                    passwordStrength.score <= 3 ? 'text-primary-container' : 'text-tertiary'
                  }`}>
                    {passwordStrength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="relative group">
              <input
                id="register-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder=" "
                className={`peer w-full bg-surface-container/60 border rounded-xl px-4 pt-5 pb-2 pr-12 text-on-surface text-sm font-inter
                  focus:outline-none focus:ring-1 transition-all duration-200 placeholder-transparent
                  ${confirmPassword && confirmPassword !== password
                    ? 'border-error/60 focus:border-error focus:ring-error/50'
                    : confirmPassword && confirmPassword === password
                    ? 'border-tertiary/60 focus:border-tertiary focus:ring-tertiary/50'
                    : 'border-outline-variant/40 focus:border-primary-container focus:ring-primary-container/50'
                  }`}
                autoComplete="new-password"
              />
              <label
                htmlFor="register-confirm-password"
                className="absolute left-4 top-2 text-[11px] font-medium text-on-surface-variant
                  peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-on-surface-variant/60
                  peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-primary-container
                  transition-all duration-200 pointer-events-none"
              >
                Confirm Password
              </label>
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-on-surface transition-colors"
                tabIndex={-1}
              >
                <span className="material-symbols-outlined text-xl">
                  {showConfirmPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
              {/* Match indicator */}
              {confirmPassword && (
                <div className="absolute right-12 top-1/2 -translate-y-1/2">
                  <span className={`material-symbols-outlined text-lg ${
                    confirmPassword === password ? 'text-tertiary' : 'text-error'
                  }`} style={{ fontVariationSettings: "'FILL' 1" }}>
                    {confirmPassword === password ? 'check_circle' : 'cancel'}
                  </span>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-error-container/20 border border-error/20 rounded-xl px-4 py-3 animate-[fadeIn_0.2s_ease-out]">
                <span className="material-symbols-outlined text-error text-lg">error</span>
                <p className="text-error text-sm font-inter">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              id="register-submit-btn"
              className="w-full bg-primary-container text-on-primary-container font-headline font-bold text-sm py-3.5 rounded-xl
                hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200 relative overflow-hidden group"
            >
              <span className={`transition-opacity ${loading ? 'opacity-0' : 'opacity-100'}`}>
                Create Account
              </span>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-on-primary-container border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-outline-variant/30" />
            <span className="text-on-surface-variant/50 text-xs font-inter uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-outline-variant/30" />
          </div>

          {/* Google Sign-Up */}
          <div ref={googleBtnRef} className="w-full flex justify-center" id="google-signup-btn" />

          {/* Login Link */}
          <p className="text-center text-on-surface-variant text-sm mt-6 font-inter">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-container font-semibold hover:underline transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
};

export default Register;
