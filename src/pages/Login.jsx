import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleToast, setGoogleToast] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleClick = () => {
    setGoogleToast(true);
    setTimeout(() => setGoogleToast(false), 3000);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-[-200px] left-[-200px] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-150px] right-[-150px] w-[400px] h-[400px] rounded-full bg-tertiary/5 blur-[100px] pointer-events-none" />

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
            Your private wealth dashboard
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-container-low/80 backdrop-blur-xl border border-outline-variant/30 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-headline font-bold text-on-surface mb-1">Welcome back</h2>
          <p className="text-on-surface-variant text-sm mb-6">Sign in to continue</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="relative group">
              <input
                id="login-email"
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
                htmlFor="login-email"
                className="absolute left-4 top-2 text-[11px] font-medium text-on-surface-variant
                  peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-on-surface-variant/60
                  peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-primary-container
                  transition-all duration-200 pointer-events-none"
              >
                Email Address
              </label>
            </div>

            {/* Password */}
            <div className="relative group">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                className="peer w-full bg-surface-container/60 border border-outline-variant/40 rounded-xl px-4 pt-5 pb-2 pr-12 text-on-surface text-sm font-inter
                  focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container/50
                  transition-all duration-200 placeholder-transparent"
                autoComplete="current-password"
              />
              <label
                htmlFor="login-password"
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
              id="login-submit-btn"
              className="w-full bg-primary-container text-on-primary-container font-headline font-bold text-sm py-3.5 rounded-xl
                hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200 relative overflow-hidden group"
            >
              <span className={`transition-opacity ${loading ? 'opacity-0' : 'opacity-100'}`}>
                Sign In
              </span>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-on-primary-container border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-outline-variant/30" />
            <span className="text-on-surface-variant/50 text-xs font-inter uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-outline-variant/30" />
          </div>

          {/* Google Placeholder */}
          <button
            type="button"
            onClick={handleGoogleClick}
            id="google-signin-btn"
            className="w-full bg-surface-container/60 border border-outline-variant/30 text-on-surface-variant font-inter text-sm py-3 rounded-xl
              hover:bg-surface-container-high/60 transition-all duration-200 flex items-center justify-center gap-3 relative"
          >
            <svg className="w-5 h-5 opacity-50" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="opacity-70">Continue with Google</span>
            <span className="ml-1 text-[10px] text-on-surface-variant/40 bg-surface-container-high/60 px-2 py-0.5 rounded-full">
              Coming Soon
            </span>
          </button>

          {/* Register Link */}
          <p className="text-center text-on-surface-variant text-sm mt-6 font-inter">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-container font-semibold hover:underline transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* Google Toast */}
      {googleToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface-container-high border border-outline-variant/30 
          text-on-surface text-sm font-inter px-6 py-3 rounded-xl shadow-2xl z-50
          animate-[slideUp_0.3s_ease-out]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-container text-lg">info</span>
            Google Sign-In will be implemented soon
          </div>
        </div>
      )}

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

export default Login;
