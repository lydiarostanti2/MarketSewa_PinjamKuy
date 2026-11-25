import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  MailCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { validateEmail, validateStrongPassword } from '../utils/format';
import { Logo } from './Logo';

export const AuthPage: React.FC = () => {
  const {
    loginWithEmail,
    loginWithGoogle,
    registerAccount,
  } = useApp();

  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<'renter' | 'owner'>('renter');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  // Google OAuth Loading State
  const [googleLoading, setGoogleLoading] = useState(false);

  const pwCheck = validateStrongPassword(regPassword);
  const passwordsMatch =
    regConfirmPassword.length > 0 && regPassword === regConfirmPassword;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const emailCheck = validateEmail(loginEmail);
    if (!emailCheck.valid) {
      setLoginError(emailCheck.error || 'Alamat email tidak valid.');
      return;
    }
    if (!loginPassword.trim()) {
      setLoginError('Kata sandi wajib diisi.');
      return;
    }
    if (loginPassword.length < 6) {
      setLoginError('Kata sandi minimal 6 karakter.');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await loginWithEmail(loginEmail, loginPassword);
      if (!res.ok && res.error) {
        setLoginError(res.error);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoginError('');
    setGoogleLoading(true);
    try {
      const res = await loginWithGoogle();
      if (!res.ok && res.error) {
        setLoginError(res.error);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!regName.trim()) {
      setRegError('Nama lengkap wajib diisi.');
      return;
    }
    const emailCheck = validateEmail(regEmail);
    if (!emailCheck.valid) {
      setRegError(emailCheck.error || 'Alamat email wajib diisi dengan format yang benar.');
      return;
    }
    if (!pwCheck.isValid) {
      setRegError(
        'Kata sandi harus memenuhi minimal 8 karakter, huruf kapital, huruf kecil, angka, dan simbol.'
      );
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('Konfirmasi kata sandi tidak cocok dengan kata sandi utama.');
      return;
    }

    setRegLoading(true);
    try {
      const res = await registerAccount({
        name: regName,
        email: regEmail,
        password: regPassword,
        role: regRole,
      });
      if (!res.ok && res.error) {
        setRegError(res.error);
        return;
      }
      if (res.needsEmailConfirmation) {
        setConfirmationSent(true);
      }
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Logo size="md" />
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setConfirmationSent(false);
              }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setConfirmationSent(false);
              }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar Baru
            </button>
          </div>
        </div>

        {mode === 'login' ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">
                Masuk ke Akun PinjamKuy
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Masuk dengan akun email Anda atau lanjutkan langsung dengan Google.
              </p>
            </div>

            {loginError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Alamat Email <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kata Sandi <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showLoginPass ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Masukkan kata sandi Anda"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPass((p) => !p)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
                    aria-label="Tampilkan kata sandi"
                  >
                    {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl transition-colors"
              >
                {loginLoading ? 'Memproses...' : 'Masuk Sekarang'}
              </button>
            </form>

            {/* Google Sign-In */}
            <div className="space-y-3 pt-2">
              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-xs text-slate-400 whitespace-nowrap">
                  Atau masuk lebih cepat dengan
                </span>
                <div className="border-t border-slate-200 w-full" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 bg-white hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>{googleLoading ? 'Menghubungkan ke Google...' : 'Lanjutkan dengan Google'}</span>
              </button>
            </div>
          </div>
        ) : !confirmationSent ? (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">
                Daftar Akun PinjamKuy
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Gunakan email aktif dan buat kata sandi yang kuat untuk akun Anda.
              </p>
            </div>

            {regError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{regError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nama Lengkap <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Contoh: Siti Rahmawati"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Daftar Sebagai <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as 'renter' | 'owner')}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="renter">Penyewa Barang</option>
                    <option value="owner">Pemilik Barang (Pemberi Sewa)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Alamat Email Aktif <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="namaanda@email.com"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Kata Sandi <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPass ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min. 8 karakter + simbol"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPass((p) => !p)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
                    >
                      {showRegPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Konfirmasi Kata Sandi <span className="text-red-600">*</span>
                  </label>
                  <input
                    type={showRegPass ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Ulangi kata sandi"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                <p className="text-xs font-semibold text-slate-700 mb-1">
                  Syarat Keamanan Kata Sandi:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                  {[
                    { ok: pwCheck.minLength, text: 'Minimal 8 karakter' },
                    { ok: pwCheck.hasUpper, text: 'Huruf Kapital (A-Z)' },
                    { ok: pwCheck.hasLower, text: 'Huruf Kecil (a-z)' },
                    { ok: pwCheck.hasNumber, text: 'Angka (0-9)' },
                    { ok: pwCheck.hasSymbol, text: 'Simbol (!@#$%)' },
                    { ok: passwordsMatch, text: 'Konfirmasi Cocok' },
                  ].map((rule, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 ${
                        rule.ok ? 'text-blue-700 font-semibold' : 'text-slate-500'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          rule.ok ? 'text-blue-600' : 'text-slate-300'
                        }`}
                      />
                      <span>{rule.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl transition-colors"
              >
                {regLoading ? 'Mendaftarkan Akun...' : 'Daftar Sekarang'}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-5 text-center py-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <MailCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-extrabold text-slate-900">
                Periksa Email Anda
              </h2>
              <p className="text-sm text-slate-600">
                Tautan konfirmasi pendaftaran telah dikirim ke{' '}
                <span className="font-semibold text-slate-900">{regEmail}</span>.
                Silakan klik tautan tersebut lalu masuk ke akun Anda.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setConfirmationSent(false);
                setMode('login');
                setLoginEmail(regEmail);
              }}
              className="w-full py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
            >
              Kembali ke Halaman Masuk
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
