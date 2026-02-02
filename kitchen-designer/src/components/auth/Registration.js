import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, AlertCircle, Shield, User, Lock, Eye, EyeOff } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';

const Registration = () => {
  const { token } = useParams();
  const navigate = useNavigate();

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
  
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [invitationData, setInvitationData] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  // Validate invitation token on component mount
  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    setValidating(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/users/validate-invite/${token}`);
      const data = await response.json();

      if (!response.ok || !data.valid) {
        setError(data.error || 'Invalid or expired invitation link');
        setInvitationData(null);
      } else {
        setInvitationData(data.invitation);
      }
    } catch (error) {
      console.error('Error validating token:', error);
      setError('Failed to validate invitation. Please try again.');
    } finally {
      setValidating(false);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    // Validation
    if (!formData.username.trim()) {
      setError('Username is required');
      setSubmitting(false);
      return;
    }

    if (!formData.password) {
      setError('Password is required');
      setSubmitting(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setSubmitting(false);
      return;
    }

    // Validate password complexity (matches backend requirements)
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setSubmitting(false);
      return;
    }

    if (!/[A-Z]/.test(formData.password)) {
      setError('Password must contain at least one uppercase letter');
      setSubmitting(false);
      return;
    }

    if (!/[a-z]/.test(formData.password)) {
      setError('Password must contain at least one lowercase letter');
      setSubmitting(false);
      return;
    }

    if (!/\d/.test(formData.password)) {
      setError('Password must contain at least one number');
      setSubmitting(false);
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
      setError('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/users/complete-registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          username: formData.username.trim(),
          password: formData.password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete registration');
      }

      setSuccess(true);
      
      // Redirect to admin login after 3 seconds
      setTimeout(() => {
        navigate('/admin');
      }, 3000);
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message);
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error on input change
  };

  // Loading state
  if (loading || validating) {
    return (
      <>
        <style>{shimmerStyles}</style>
        <div className="min-h-screen flex items-center justify-center p-4" style={{background:"rgb(110,110,110)"}}>
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
        }}>
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            <p className="mt-4 text-gray-200">Validating invitation...</p>
          </div>
        </div>
      </div>
      </>
    );
  }

  // Success state
  if (success) {
    return (
      <>
        <style>{shimmerStyles}</style>
        <div className="min-h-screen flex items-center justify-center p-4" style={{background:"rgb(110,110,110)"}}>
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
        }}>
          <div className="flex flex-col items-center text-center">
            <div style={{
              background: "rgba(34, 197, 94, 0.2)",
              border: "1px solid rgba(34, 197, 94, 0.3)"
            }} className="rounded-full p-4 mb-4">
              <Check size={48} className="text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Registration Complete!
            </h2>
            <p className="text-gray-300 mb-4">
              Your account has been successfully created.
            </p>
            <p className="text-sm text-gray-400">
              Redirecting to login page...
            </p>
          </div>
        </div>
      </div>
      </>
    );
  }

  // Error state (invalid/expired token)
  if (error && !invitationData) {
    return (
      <>
        <style>{shimmerStyles}</style>
        <div className="min-h-screen flex items-center justify-center p-4" style={{background:"rgb(110,110,110)"}}>
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
        }}>
          <div className="flex flex-col items-center text-center">
            <div style={{
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.3)"
            }} className="rounded-full p-4 mb-4">
              <AlertCircle size={48} className="text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Invalid Invitation
            </h2>
            <p className="text-gray-300 mb-6">
              {error}
            </p>
            <button
              onClick={() => navigate('/admin')}
              style={{
                background: "rgba(255, 255, 255, 0.18)",
                backdropFilter: "blur(5px)",
                WebkitBackdropFilter: "blur(5px)",
                border: "1px solid rgba(255, 255, 255, 0.35)"
              }}
              className="text-white px-6 py-3 rounded-lg hover:bg-white/25 transition-all"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
      </>
    );
  }

  // Registration form
  return (
    <>
      <style>{shimmerStyles}</style>
      <div className="min-h-screen flex items-center justify-center p-4" style={{background: "rgb(110,110,110)"}}>
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
            <Shield size={36} className="text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Complete Registration
          </h1>
          <p className="text-gray-300">
            Welcome to Gudino Custom Cabinets
          </p>
        </div>

        {/* Invitation Info */}
        {invitationData && (
          <div style={{
            background: "rgba(59, 130, 246, 0.15)",
            border: "1px solid rgba(59, 130, 246, 0.3)"
          }} className="rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-300 mb-2">Invitation Details</h3>
            <div className="space-y-1 text-sm text-gray-200">
              <p><strong>Name:</strong> {invitationData.fullName}</p>
              {invitationData.email && (
                <p><strong>Email:</strong> {invitationData.email}</p>
              )}
              <p>
                <strong>Role:</strong>{' '}
                <span style={{
                  background: "rgba(59, 130, 246, 0.3)",
                  border: "1px solid rgba(59, 130, 246, 0.4)"
                }} className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium text-blue-200">
                  {invitationData.role === 'super_admin' ? 'Super Admin' :
                   invitationData.role === 'employee' ? 'Employee' : 'Admin'}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)"
          }} className="mb-6 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              <div className="flex items-center gap-2">
                <User size={16} />
                Username *
              </div>
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "white"
              }}
              className="w-full p-3 rounded-lg focus:ring-2 focus:ring-white/40 focus:border-transparent transition-all placeholder-gray-400"
              placeholder="Choose a username"
              required
              autoFocus
              disabled={submitting}
            />
            <p className="mt-1 text-xs text-gray-400">
              This will be used to log in to your account
            </p>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              <div className="flex items-center gap-2">
                <Lock size={16} />
                Password *
              </div>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "white"
                }}
                className="w-full p-3 pr-12 rounded-lg focus:ring-2 focus:ring-white/40 focus:border-transparent transition-all placeholder-gray-400"
                placeholder="Create a password"
                required
                minLength={8}
                disabled={submitting}
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
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "white"
                }}
                className="w-full p-3 pr-12 rounded-lg focus:ring-2 focus:ring-white/40 focus:border-transparent transition-all placeholder-gray-400"
                placeholder="Confirm your password"
                required
                disabled={submitting}
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
            disabled={submitting}
            style={{
              background: submitting ? "rgba(156, 163, 175, 0.3)" : "rgba(255, 255, 255, 0.18)",
              backdropFilter: "blur(5px)",
              WebkitBackdropFilter: "blur(5px)",
              border: submitting ? "1px solid rgba(156, 163, 175, 0.4)" : "1px solid rgba(255, 255, 255, 0.35)"
            }}
            className="submit-button-shimmer w-full text-white py-3 px-6 rounded-lg hover:bg-white/25 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2"
          >
            <span className="submit-button-content flex items-center justify-center gap-2">
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Creating Account...
                </>
              ) : (
                <>
                  <Check size={20} />
                  Complete Registration
                </>
              )}
            </span>
          </button>
        </form>

        {/* Footer */}
        <div style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.15)"
        }} className="mt-8 pt-6 text-center">
          <p className="text-sm text-gray-300">
            Need help?{' '}
            <a href="/contact" className="text-blue-400 hover:text-blue-300 font-medium">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
    </>
  );
};

export default Registration;
