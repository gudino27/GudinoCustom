import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, CheckCircle, XCircle, Eye, EyeOff, AlertCircle } from 'lucide-react';
import Navigation from '../ui/Navigation';

const PasswordReset = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState(null);
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const API_BASE = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';

  // Add shimmer effect styles
  const shimmerStyles = `
    @keyframes shimmer {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }

    .submit-button-shimmer {
      position: relative;
      overflow: hidden;
    }

    .submit-button-shimmer::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transform: translateX(-100%);
      pointer-events: none;
      z-index: 1;
    }

    .submit-button-shimmer:hover::before {
      animation: shimmer 0.6s ease;
    }

    .submit-button-content {
      position: relative;
      z-index: 2;
    }
  `;

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link');
      return;
    }

    // Validate token
    const validateToken = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/validate-reset-token/${token}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setTokenValid(true);
          setUsername(data.username);
        } else {
          const data = await response.json();
          setError(data.error || 'Invalid or expired reset link');
          setTokenValid(false);
        }
      } catch (error) {
        console.error('Token validation error:', error);
        setError('Failed to validate reset link');
        setTokenValid(false);
      }
    };

    validateToken();
  }, [token, API_BASE]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password complexity (matches backend requirements)
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter');
      setLoading(false);
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter');
      setLoading(false);
      return;
    }

    if (!/\d/.test(password)) {
      setError('Password must contain at least one number');
      setLoading(false);
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      setError('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/admin');
        }, 3000);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setError('Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <>
        <style>{shimmerStyles}</style>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center" style={{background: "rgb(110,110,110)"}}>
          <div style={{
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(15px)",
            WebkitBackdropFilter: "blur(15px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "448px",
            width: "100%",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)"
          }} className="text-center">
            <div style={{
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.3)"
            }} className="rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <XCircle size={48} className="text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Invalid Reset Link</h2>
            <p className="text-gray-300 mb-6">This password reset link is invalid or missing.</p>
            <button
              onClick={() => navigate('/admin')}
              style={{
                background: "rgba(255, 255, 255, 0.18)",
                backdropFilter: "blur(5px)",
                WebkitBackdropFilter: "blur(5px)",
                border: "1px solid rgba(255, 255, 255, 0.35)"
              }}
              className="submit-button-shimmer text-white px-6 py-3 rounded-lg hover:bg-white/25 transition-all"
            >
              <span className="submit-button-content">Go to Login</span>
            </button>
          </div>
        </div>
      </>
    );
  }

  if (tokenValid === false) {
    return (
      <>
        <style>{shimmerStyles}</style>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center" style={{background: "rgb(110,110,110)"}}>
          <div style={{
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(15px)",
            WebkitBackdropFilter: "blur(15px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "448px",
            width: "100%",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)"
          }} className="text-center">
            <div style={{
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.3)"
            }} className="rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <XCircle size={48} className="text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Expired Reset Link</h2>
            <p className="text-gray-300 mb-6">{error}</p>
            <button
              onClick={() => navigate('/admin')}
              style={{
                background: "rgba(255, 255, 255, 0.18)",
                backdropFilter: "blur(5px)",
                WebkitBackdropFilter: "blur(5px)",
                border: "1px solid rgba(255, 255, 255, 0.35)"
              }}
              className="submit-button-shimmer text-white px-6 py-3 rounded-lg hover:bg-white/25 transition-all"
            >
              <span className="submit-button-content">Request New Reset Link</span>
            </button>
          </div>
        </div>
      </>
    );
  }

  if (success) {
    return (
      <>
        <style>{shimmerStyles}</style>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center" style={{background: "rgb(110,110,110)"}}>
          <div style={{
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(15px)",
            WebkitBackdropFilter: "blur(15px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "448px",
            width: "100%",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)"
          }} className="text-center">
            <div style={{
              background: "rgba(34, 197, 94, 0.2)",
              border: "1px solid rgba(34, 197, 94, 0.3)"
            }} className="rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <CheckCircle size={48} className="text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Password Reset Successful</h2>
            <p className="text-gray-300 mb-4">
              Your password has been reset successfully. You will be redirected to the login page in a few seconds.
            </p>
            <button
              onClick={() => navigate('/admin')}
              style={{
                background: "rgba(255, 255, 255, 0.18)",
                backdropFilter: "blur(5px)",
                WebkitBackdropFilter: "blur(5px)",
                border: "1px solid rgba(255, 255, 255, 0.35)"
              }}
              className="submit-button-shimmer text-white px-6 py-3 rounded-lg hover:bg-white/25 transition-all"
            >
              <span className="submit-button-content">Go to Login Now</span>
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{shimmerStyles}</style>
      <Navigation />
      <div className="min-h-screen flex items-center justify-center" style={{background: "rgb(110,110,110)"}}>
        <div style={{
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(15px)",
          WebkitBackdropFilter: "blur(15px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: "16px",
          padding: "32px",
          maxWidth: "28rem",
          width: "100%",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)"
        }}>
          {/* Header */}
          <div className="text-center mb-8">
            <div style={{
              background: "rgba(59, 130, 246, 0.2)",
              border: "1px solid rgba(59, 130, 246, 0.3)"
            }} className="rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Lock size={36} className="text-blue-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Reset Password</h2>
            {username && (
              <p className="text-gray-300 text-sm">
                Resetting password for: <strong className="text-white">{username}</strong>
              </p>
            )}
          </div>

          {/* Loading State */}
          {tokenValid === null ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
              <p className="mt-4 text-gray-200">Validating reset link...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Message */}
              {error && (
                <div style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)"
                }} className="p-4 rounded-lg flex items-start gap-3">
                  <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  <div className="flex items-center gap-2">
                    <Lock size={16} />
                    New Password *
                  </div>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "white"
                    }}
                    className="w-full p-3 pr-12 rounded-lg focus:ring-2 focus:ring-white/40 focus:border-transparent transition-all placeholder-gray-400"
                    placeholder="Enter new password"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Must be at least 8 characters and include: uppercase, lowercase, number, and special character (!@#$%^&*...)
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  <div className="flex items-center gap-2">
                    <Lock size={16} />
                    Confirm Password *
                  </div>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "white"
                    }}
                    className="w-full p-3 pr-12 rounded-lg focus:ring-2 focus:ring-white/40 focus:border-transparent transition-all placeholder-gray-400"
                    placeholder="Confirm new password"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: loading ? "rgba(156, 163, 175, 0.3)" : "rgba(255, 255, 255, 0.18)",
                  backdropFilter: "blur(5px)",
                  WebkitBackdropFilter: "blur(5px)",
                  border: loading ? "1px solid rgba(156, 163, 175, 0.4)" : "1px solid rgba(255, 255, 255, 0.35)"
                }}
                className="submit-button-shimmer w-full text-white py-3 px-6 rounded-lg hover:bg-white/25 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2"
              >
                <span className="submit-button-content flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Resetting Password...
                    </>
                  ) : (
                    <>
                      <Lock size={20} />
                      Reset Password
                    </>
                  )}
                </span>
              </button>
            </form>
          )}

          {/* Footer */}
          <div style={{
            borderTop: "1px solid rgba(255, 255, 255, 0.15)"
          }} className="mt-8 pt-6 text-center">
            <button
              onClick={() => navigate('/admin')}
              className="text-sm text-blue-400 hover:text-blue-300 font-medium"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default PasswordReset;