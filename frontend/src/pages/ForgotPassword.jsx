import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    try {
      setLoading(true);
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-headline font-bold text-on-surface tracking-tight">Vestor</h1>
          <p className="text-on-surface-variant text-sm mt-1 font-inter">Reset your password</p>
        </div>

        <div className="bg-surface-container-low/80 backdrop-blur-xl border border-outline-variant/30 rounded-2xl p-8 shadow-2xl">
          {sent ? (
            <div className="text-center">
              <span className="material-symbols-outlined text-tertiary text-4xl mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>mark_email_read</span>
              <h2 className="text-xl font-headline font-bold text-on-surface mb-2">Check your inbox</h2>
              <p className="text-on-surface-variant text-sm mb-6">If an account exists for that email, we've sent a link to reset your password. The link expires in 1 hour.</p>
              <Link to="/login" className="text-primary-container font-semibold hover:underline">Back to sign in</Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-headline font-bold text-on-surface mb-1">Forgot password</h2>
              <p className="text-on-surface-variant text-sm mb-6">Enter your email and we'll send you a reset link.</p>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="relative group">
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder=" "
                    className="peer w-full bg-surface-container/60 border border-outline-variant/40 rounded-xl px-4 pt-5 pb-2 text-on-surface text-sm font-inter focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container/50 transition-all duration-200 placeholder-transparent"
                    autoComplete="email"
                  />
                  <label htmlFor="forgot-email" className="absolute left-4 top-2 text-[11px] font-medium text-on-surface-variant peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-on-surface-variant/60 peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-primary-container transition-all duration-200 pointer-events-none">Email Address</label>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-error-container/20 border border-error/20 rounded-xl px-4 py-3">
                    <span className="material-symbols-outlined text-error text-lg">error</span>
                    <p className="text-error text-sm font-inter">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary-container text-on-primary-container font-headline font-bold text-sm py-3.5 rounded-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <p className="text-center text-on-surface-variant text-sm mt-6 font-inter">
                Remembered it?{' '}
                <Link to="/login" className="text-primary-container font-semibold hover:underline">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
