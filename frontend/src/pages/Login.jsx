import { useState } from 'react';
import useAuthStore from '../store/authStore';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [is2FAStep, setIs2FAStep] = useState(false);
  const [userIdFor2FA, setUserIdFor2FA] = useState(null);

  const { login, verify2FA, isLoading, error } = useAuthStore();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    // We can gather device info here
    const deviceInfo = {
      deviceIdentifier: navigator.userAgent, // Simplified for now
      browser: navigator.vendor
    };

    const res = await login({ email, password, ...deviceInfo });
    
    if (res.success && res.requires2FA) {
      setIs2FAStep(true);
      setUserIdFor2FA(res.userId);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    if (!twoFactorCode) return;

    await verify2FA({
      userId: userIdFor2FA,
      token: twoFactorCode,
      deviceIdentifier: navigator.userAgent
    });
  };

  return (
    <div className="flex-center w-full min-h-screen bg-primary">
      <div className="glass-panel w-full max-w-md p-8 animate-slide-up">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            {is2FAStep ? 'Two-Factor Authentication' : 'Welcome Back'}
          </h1>
          <p className="text-muted text-sm">
            {is2FAStep ? 'Enter the code from your Authenticator app' : 'Enterprise Secure Chat'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {!is2FAStep ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-primary" 
                placeholder="name@company.com" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-primary" 
                placeholder="••••••••" 
                required 
              />
            </div>

            <button 
              type="submit" 
              className="btn-primary mt-2 flex-center"
              disabled={isLoading}
            >
              {isLoading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify2FA} className="flex flex-col gap-4">
             <div>
              <label className="block text-sm font-medium text-secondary mb-1">Authenticator Code</label>
              <input 
                type="text" 
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                className="input-primary text-center letter-spacing-[0.5em] font-mono text-xl" 
                placeholder="000 000" 
                maxLength={6}
                required 
              />
            </div>
            
            <button 
              type="submit" 
              className="btn-primary mt-2 flex-center"
              disabled={isLoading}
            >
              {isLoading ? 'Verifying...' : 'Verify Identity'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-muted">
          Don't have an account? <span className="text-accent cursor-pointer hover:underline">Request Access</span>
        </div>

      </div>
    </div>
  );
};

// Extremely quick inline Tailwind classes equivalent injected into styling
const style = document.createElement('style');
style.textContent = `
  .w-full { width: 100%; }
  .max-w-md { max-width: 28rem; }
  .min-h-screen { min-height: 100vh; }
  .p-8 { padding: 2rem; }
  .p-3 { padding: 0.75rem; }
  .mb-8 { margin-bottom: 2rem; }
  .mb-6 { margin-bottom: 1.5rem; }
  .mb-2 { margin-bottom: 0.5rem; }
  .mb-1 { margin-bottom: 0.25rem; }
  .mt-2 { margin-top: 0.5rem; }
  .mt-6 { margin-top: 1.5rem; }
  .text-center { text-align: center; }
  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .gap-4 { gap: 1rem; }
  .text-2xl { font-size: 1.5rem; line-height: 2rem; }
  .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
  .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
  .font-bold { font-weight: 700; }
  .font-medium { font-weight: 500; }
  .font-mono { font-family: monospace; }
  .text-white { color: #fff; }
  .text-secondary { color: var(--text-secondary); }
  .text-muted { color: var(--text-muted); }
  .text-red-500 { color: var(--error); }
  .text-accent { color: var(--accent-primary); }
  .bg-primary { background-color: var(--bg-primary); }
  .bg-red-500\\/10 { background-color: rgba(239, 68, 68, 0.1); }
  .border { border-width: 1px; border-style: solid; }
  .border-red-500\\/20 { border-color: rgba(239, 68, 68, 0.2); }
  .rounded-lg { border-radius: 0.5rem; }
  .block { display: block; }
  .cursor-pointer { cursor: pointer; }
  .hover\\:underline:hover { text-decoration: underline; }
`;
document.head.appendChild(style);

export default Login;
