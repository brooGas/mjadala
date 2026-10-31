(() => {
  'use strict';
  const SUPABASE_URL = 'https://olqwfscmhtdseljvfqvm.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_Ay8LXBjvNhXQJDKQMF_Etw_SMb6_z4M';
  const $ = id => document.getElementById(id);
  const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  if (!client) { $('status').textContent = 'Could not load account services. Check your connection and reload.'; return; }

  let mode = 'signin';
  let signupStep = 'details';
  let pendingEmail = '';
  let pendingNickname = '';
  let deferredInstallPrompt = null;
  const status = message => { $('status').textContent = message || ''; };
  const setMode = next => {
    mode = next;
    signupStep = 'details';
    const signup = mode === 'signup';
    $('signInTab').classList.toggle('active', !signup);
    $('signUpTab').classList.toggle('active', signup);
    $('signInTab').setAttribute('aria-selected', String(!signup));
    $('signUpTab').setAttribute('aria-selected', String(signup));
    $('nicknameWrap').classList.toggle('hidden', !signup);
    $('consentWrap').classList.toggle('hidden', !signup);
    $('loginWrap').classList.toggle('hidden', signupStep === 'code');
    $('passwordWrap').classList.toggle('hidden', signupStep === 'code');
    $('codeWrap').classList.toggle('hidden', signupStep !== 'code');
    $('resendCode').classList.toggle('hidden', signupStep !== 'code');
    $('nickname').required = signup && signupStep === 'details';
    $('consent').required = signup && signupStep === 'details';
    $('login').required = signupStep !== 'code';
    $('password').required = signupStep !== 'code';
    $('code').required = signupStep === 'code';
    $('password').autocomplete = signup ? 'new-password' : 'current-password';
    $('submit').textContent = signup ? (signupStep === 'code' ? 'Verify code' : 'Send verification code') : 'Sign in';
    $('authHint').textContent = signupStep === 'code'
      ? `Enter the 6-digit code sent to ${pendingEmail}.`
      : signup ? 'Create your account. We will email you a 6-digit verification code.' : 'Sign in with your email or Mjadala nickname.';
    status('');
  };
  const toEmail = raw => {
    const value = raw.trim();
    if (value.includes('@')) return value;
    const nickname = value.replace(/^@/, '').toLowerCase();
    return nickname + '@mjadala.app';
  };
  $('signInTab').addEventListener('click', () => setMode('signin'));
  $('signUpTab').addEventListener('click', () => setMode('signup'));
  $('authForm').addEventListener('submit', async event => {
    event.preventDefault();
    const login = $('login').value.trim();
    const password = $('password').value;
    const nickname = $('nickname').value.trim().replace(/^@/, '');
    $('submit').disabled = true;
    try {
      if (mode === 'signup' && signupStep === 'code') {
        const code = $('code').value.trim();
        if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit code from your email.');
        status('Verifying your email…');
        const { data, error } = await client.auth.verifyOtp({ email: pendingEmail, token: code, type: 'signup' });
        if (error) throw error;
        if (!data.session) throw new Error('Email verified, but no session was created. Please sign in.');
        status('Email verified. Opening Mjadala…');
        window.location.replace('/');
        return;
      }
      if (!login || (mode === 'signin' && !password)) throw new Error('Enter your login and password.');
      if (mode === 'signup') {
        if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(nickname)) throw new Error('Choose a nickname of 3–24 characters using letters, numbers, dots, dashes or underscores.');
        if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login)) throw new Error('Enter a valid email address so we can send your verification code.');
        if (!$('consent').checked) throw new Error('Please agree to the Terms of Service and Privacy Policy.');
        status('Sending verification code…');
        const { data, error } = await client.auth.signUp({
          email: login, password,
          options: { data: { nickname, username: nickname, terms_accepted: true, privacy_policy_accepted: true } }
        });
        if (error) throw error;
        if (data.session) {
          status('Account created. Opening Mjadala…');
          window.location.replace('/');
          return;
        }
        pendingEmail = login;
        pendingNickname = nickname;
        $('code').value = '';
        signupStep = 'code';
        $('loginWrap').classList.add('hidden');
        $('passwordWrap').classList.add('hidden');
        $('nicknameWrap').classList.add('hidden');
        $('consentWrap').classList.add('hidden');
        $('codeWrap').classList.remove('hidden');
        $('resendCode').classList.remove('hidden');
        $('login').required = false;
        $('password').required = false;
        $('nickname').required = false;
        $('consent').required = false;
        $('code').required = true;
        $('authHint').textContent = `Enter the 6-digit code sent to ${pendingEmail}.`;
        $('submit').textContent = 'Verify code';
        status('Verification code sent. Check your email.');
        $('code').focus();
      } else {
        status('Signing in…');
        const { error } = await client.auth.signInWithPassword({ email: toEmail(login), password });
        if (error) throw error;
        status('Signed in. Opening Mjadala…');
        window.location.replace('/');
      }
    } catch (error) {
      status(error?.message || 'Something went wrong. Please try again.');
    } finally { $('submit').disabled = false; }
  });
  $('resendCode').addEventListener('click', async () => {
    $('resendCode').disabled = true;
    try {
      status('Sending another code…');
      const { error } = await client.auth.resend({ type: 'signup', email: pendingEmail });
      if (error) throw error;
      status('A new verification code has been sent.');
    } catch (error) { status(error?.message || 'Could not resend the code.'); }
    finally { $('resendCode').disabled = false; }
  });

  client.auth.getSession().then(({ data, error }) => {
    if (!error && data?.session) window.location.replace('/');
  }).catch(() => {});

  const installButton = $('installButton');
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone()) installButton.classList.add('hidden');
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); deferredInstallPrompt = event;
  });
  installButton.addEventListener('click', async () => {
    if (standalone()) { installButton.classList.add('hidden'); return; }
    if (!deferredInstallPrompt) {
      const android = /android/i.test(navigator.userAgent);
      alert(android
        ? 'To install Mjadala, open your browser menu (⋮) and choose “Install app” or “Add to Home screen”.'
        : 'To install Mjadala, use your browser menu and choose “Install” or “Add to Home Screen”.');
      return;
    }
    const prompt = deferredInstallPrompt; deferredInstallPrompt = null;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice?.outcome === 'accepted') installButton.classList.add('hidden');
  });
  window.addEventListener('appinstalled', () => installButton.classList.add('hidden'));
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
})();
