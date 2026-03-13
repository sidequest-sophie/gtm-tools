/**
 * Auth Module
 * Supabase authentication wrapper for Category Leaders GTM Tools
 * Handles Google OAuth, Magic Link, Email/Password, and session management.
 */

const SUPABASE_URL = 'https://api.categoryleaders.co.uk';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtdnhod3pkYXBsdXB6d2Jrc2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMzk0OTQsImV4cCI6MjA4ODkxNTQ5NH0.cc5aPNG3EyxiIMXgQ0rVGGSj7J7VAMU6pzSuI8U96Ng';

const Auth = {
  _client: null,
  _user: null,
  _profile: null,
  _session: null,
  _listeners: [],
  _ready: false,
  _readyPromise: null,

  /**
   * Initialise the Supabase client and set up auth state listener
   */
  async init() {
    if (this._client) return this._client;

    // Dynamic import of Supabase JS client from CDN
    if (!window.supabase) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    this._client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        flowType: 'implicit',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    });

    // Set up auth state change listener
    this._readyPromise = new Promise((resolve) => {
      this._client.auth.onAuthStateChange((event, session) => {
        console.log('[Auth] State change:', event);
        this._session = session;
        this._user = session?.user || null;

        // Resolve ready immediately — don't block on profile load
        if (!this._ready) {
          this._ready = true;
          resolve();
        }

        // Load profile in background then notify listeners
        const finish = (profile) => {
          this._listeners.forEach(fn => fn(event, session, profile));
        };

        if (this._user) {
          this._loadProfile().then(() => finish(this._profile)).catch(() => finish(null));
        } else {
          this._profile = null;
          finish(null);
        }
      });
    });

    return this._client;
  },

  /**
   * Wait for auth to be fully initialised (resolves after first state check)
   */
  async waitForReady() {
    if (this._ready) return;
    if (!this._readyPromise) await this.init();
    return this._readyPromise;
  },

  /**
   * Load user profile from profiles table
   */
  async _loadProfile() {
    if (!this._user) return null;
    try {
      // Race the query against a 5-second timeout to prevent hanging
      const query = this._client
        .from('profiles')
        .select('*')
        .eq('id', this._user.id)
        .single();

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile load timeout')), 5000)
      );

      const { data, error } = await Promise.race([query, timeout]);

      if (error) {
        console.warn('[Auth] Profile load error:', error.message);
        this._profile = null;
      } else {
        this._profile = data;
      }
    } catch (err) {
      console.warn('[Auth] Profile load failed:', err.message);
      this._profile = null;
    }
    return this._profile;
  },

  /**
   * Register an auth state change listener
   * @param {Function} fn - (event, session, profile) => void
   * @returns {Function} unsubscribe function
   */
  onAuthChange(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter(l => l !== fn);
    };
  },

  // ── Getters ──────────────────────────────────────────────

  getUser()    { return this._user; },
  getProfile() { return this._profile; },
  getSession() { return this._session; },
  getClient()  { return this._client; },

  isAuthenticated() { return !!this._session; },

  isSuperAdmin() {
    return this._profile?.role === 'superadmin';
  },

  // ── Sign In Methods ──────────────────────────────────────

  /**
   * Sign in with Google OAuth
   */
  async signInWithGoogle() {
    await this.init();
    const { data, error } = await this._client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    return data;
  },

  /**
   * Sign in with Magic Link (email OTP)
   */
  async signInWithMagicLink(email) {
    await this.init();
    const { data, error } = await this._client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    return data;
  },

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email, password) {
    await this.init();
    const { data, error } = await this._client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Sign up with email and password
   */
  async signUp(email, password, displayName) {
    await this.init();
    const { data, error } = await this._client.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    return data;
  },

  /**
   * Request password reset email
   */
  async resetPassword(email) {
    await this.init();
    const { data, error } = await this._client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '?reset=true',
    });
    if (error) throw error;
    return data;
  },

  /**
   * Update password (after reset link click)
   */
  async updatePassword(newPassword) {
    await this.init();
    const { data, error } = await this._client.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
    return data;
  },

  // ── Sign Out ──────────────────────────────────────────────

  async signOut() {
    await this.init();
    const { error } = await this._client.auth.signOut();
    if (error) throw error;
    this._user = null;
    this._profile = null;
    this._session = null;
  },

  // ── Client (tenant) helpers ───────────────────────────────

  /**
   * Get all clients the current user belongs to
   */
  async getUserClients() {
    if (!this._user) return [];
    const { data, error } = await this._client
      .from('client_users')
      .select(`
        role,
        client:clients (*)
      `)
      .eq('user_id', this._user.id);

    if (error) {
      console.error('[Auth] getUserClients error:', error);
      return [];
    }
    return data || [];
  },

  /**
   * Get all users for a client (admin only)
   */
  async getClientUsers(clientId) {
    const { data, error } = await this._client
      .from('client_users')
      .select(`
        id,
        role,
        invited_at,
        accepted_at,
        profile:profiles (id, display_name, email, avatar_url, role)
      `)
      .eq('client_id', clientId);

    if (error) {
      console.error('[Auth] getClientUsers error:', error);
      return [];
    }
    return data || [];
  },

  /**
   * Invite a user to a client by email
   */
  async inviteUser(clientId, email, role = 'member') {
    // Check if user already exists in profiles
    const { data: existingProfile } = await this._client
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingProfile) {
      // User exists — create the membership
      const { data, error } = await this._client
        .from('client_users')
        .insert({
          client_id: clientId,
          user_id: existingProfile.id,
          role: role,
          accepted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return { type: 'linked', data };
    }

    // User doesn't exist yet — store as pending invitation
    // They'll be linked when they sign up with this email
    const { data, error } = await this._client
      .from('client_users')
      .insert({
        client_id: clientId,
        user_id: this._user.id, // placeholder — will be updated on signup
        role: role,
      })
      .select()
      .single();

    if (error) throw error;
    return { type: 'pending', data, email };
  },

  /**
   * Create a new client and set the current user as owner
   */
  async createClientWithOwner(name) {
    // Insert client
    const { data: client, error: clientError } = await this._client
      .from('clients')
      .insert({ name })
      .select()
      .single();

    if (clientError) throw clientError;

    // Create owner membership
    const { error: memberError } = await this._client
      .from('client_users')
      .insert({
        client_id: client.id,
        user_id: this._user.id,
        role: 'owner',
        accepted_at: new Date().toISOString(),
      });

    if (memberError) throw memberError;

    return client;
  },

  /**
   * Update a client record
   */
  async updateClientRecord(clientId, updates) {
    const { data, error } = await this._client
      .from('clients')
      .update(updates)
      .eq('id', clientId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get a single client by ID
   */
  async getClientById(clientId) {
    const { data, error } = await this._client
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get all clients (superadmin only)
   */
  async getAllClients() {
    const { data, error } = await this._client
      .from('clients')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  },
};
