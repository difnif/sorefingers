// ==========================================================================
// AuthGate — 로그인 / 회원가입 화면
// ==========================================================================
import { useState } from 'react';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  authErrorMessage
} from '../lib/auth.js';

export default function AuthGate() {
  const [mode, setMode] = useState('signin');   // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleGoogle() {
    setError('');
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleEmail(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <h1 className="auth-title">sorefingers</h1>
      <p className="auth-tagline">
        사유의 신경망을 짓는 도구.
      </p>

      <form className="auth-form" onSubmit={handleEmail}>
        <button type="button" onClick={handleGoogle} disabled={busy}>
          Google로 계속하기
        </button>

        <div className="auth-divider">OR</div>

        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          required
          minLength={6}
        />

        <button type="submit" disabled={busy}>
          {mode === 'signin' ? '로그인' : '가입하기'}
        </button>

        <div className="auth-error">{error}</div>
      </form>

      <div className="auth-toggle">
        {mode === 'signin' ? (
          <>처음이세요? <button onClick={() => setMode('signup')}>가입하기</button></>
        ) : (
          <>이미 계정이 있으세요? <button onClick={() => setMode('signin')}>로그인</button></>
        )}
      </div>
    </div>
  );
}
