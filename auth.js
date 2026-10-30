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
  let deferredInstallPrompt = null;
  const status = message => { $('status').textContent = message || ''; };
  const setMode = next => {
    mode = next;
    const signup = mode === 'signup';
    $('signInTab').classList.toggle('active', !signup);
    $('signUpTab').classList.toggle('active', signup);
    $('signInTab').setAttribute('aria-selected', String(!signup));
    $('signUpTab').setAttribute('aria-selected', String(signup));
    $('nicknameWrap').classList.toggle('hidden', !signup);
    $('consentWrap').classList.toggle('hidden', !signup);
    $('nickname').required = signup;
    $('consent').required = signup;
    $('password').autocomplete = signup ? 'new-password' : 'current-password';
    $('submit').textContent = signup ? 'Create account' : 'Sign in';
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
    if (!login || !password) { status('Enter your login and password.'); return; }
    if (mode === 'signup') {
      if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(nickname)) { status('Choose a nickname of 3–24 characters using letters, numbers, dots, dashes or underscores.'); return; }
      if (password.length < 8) { status('Use a password with at least 8 characters.'); return; }
      if (!$('consent').checked) { status('Please agree to the Terms of Service and Privacy Policy.'); return; }
    }
    $('submit').disabled = true;
    try {
      if (mode === 'signup') {
        status('Creating your account…');
        const email = toEmail(nickname);
        const { data, error } = await client.auth.signUp({
          email, password,
          options: { data: { nickname, username: nickname } }
        });
        if (error) throw error;
        if (data.session) {
          status('Account created. Opening Mjadala…');
          window.location.replace('/');
        } else {
          status('Account request received. If email confirmation is enabled, confirm your email, then sign in with your nickname and password.');
          setMode('signin');
          $('login').value = nickname;
        }
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
