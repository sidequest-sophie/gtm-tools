/**
 * Storage Module
 * Hybrid storage layer — uses Supabase when authenticated, localStorage as fallback.
 * All client data methods work seamlessly with both backends.
 */

const Storage = {
  _prefix: 'cl-tools-',
  _mode: 'local', // 'local' | 'supabase'
  _activeClientId: null,
  _clientsCache: null,
  _cacheTime: 0,
  _cacheTTL: 5000, // 5s cache

  /**
   * Switch to Supabase mode (called after auth)
   */
  useSupabase() {
    this._mode = 'supabase';
    this._clientsCache = null;
  },

  /**
   * Switch to localStorage mode (fallback)
   */
  useLocal() {
    this._mode = 'local';
    this._clientsCache = null;
  },

  /**
   * Check if we're using Supabase
   */
  isSupabase() {
    return this._mode === 'supabase' && typeof Auth !== 'undefined' && Auth.isAuthenticated();
  },

  /**
   * Generate a UUID v4
   */
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  // ── Low-level localStorage helpers ──────────────────────

  get(key) {
    try {
      const item = localStorage.getItem(this._prefix + key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Storage.get error:', error);
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(this._prefix + key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage.set error:', error);
    }
  },

  delete(key) {
    try {
      localStorage.removeItem(this._prefix + key);
    } catch (error) {
      console.error('Storage.delete error:', error);
    }
  },

  clear() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this._prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.error('Storage.clear error:', error);
    }
  },

  // ── Client operations (hybrid) ──────────────────────────

  /**
   * Get all clients
   */
  async getClientsAsync() {
    if (this.isSupabase()) {
      // Check cache
      if (this._clientsCache && (Date.now() - this._cacheTime) < this._cacheTTL) {
        return this._clientsCache;
      }
      try {
        const profile = Auth.getProfile();
        let clients;

        if (profile?.role === 'superadmin') {
          // Superadmin sees all clients
          clients = await Auth.getAllClients();
        } else {
          // Regular users see their clients via join table
          const memberships = await Auth.getUserClients();
          clients = memberships.map(m => ({
            ...m.client,
            _memberRole: m.role,
          }));
        }

        this._clientsCache = clients || [];
        this._cacheTime = Date.now();
        return this._clientsCache;
      } catch (err) {
        console.error('Storage.getClientsAsync Supabase error:', err);
        return [];
      }
    }
    // Fallback to localStorage
    const clients = this.get('clients');
    return Array.isArray(clients) ? clients : [];
  },

  /**
   * Sync getter (localStorage only — used by legacy code)
   */
  getClients() {
    const clients = this.get('clients');
    return Array.isArray(clients) ? clients : [];
  },

  setClients(clients) {
    this.set('clients', clients);
  },

  getActiveClientId() {
    if (this._activeClientId) return this._activeClientId;
    return this.get('active-client-id') || null;
  },

  setActiveClientId(id) {
    this._activeClientId = id;
    this.set('active-client-id', id);
  },

  /**
   * Get the active client (async — works with Supabase)
   */
  async getActiveClientAsync() {
    const activeId = this.getActiveClientId();
    if (!activeId) return null;

    if (this.isSupabase()) {
      try {
        return await Auth.getClientById(activeId);
      } catch (err) {
        console.error('Storage.getActiveClientAsync error:', err);
        return null;
      }
    }

    // Fallback to localStorage
    const clients = this.getClients();
    return clients.find((c) => c.id === activeId) || null;
  },

  /**
   * Sync getter (localStorage only — legacy code)
   */
  getActiveClient() {
    const activeId = this.getActiveClientId();
    if (!activeId) return null;
    const clients = this.getClients();
    return clients.find((c) => c.id === activeId) || null;
  },

  /**
   * Create a new client with default structure
   */
  createClient(name = 'New Client') {
    const client = {
      id: this.uuid(),
      name: name,
      categories: ['Company', 'Brands', 'Products', 'Services', 'Features', 'Content'],
      items: {},
      problems: [],
      industryJargonEnabled: false,
      maxCompanyItems: 0,
      industryFilterMode: 'user',
      industryFilterValue: '',
      pptxExportEnabled: false,
      status: 'enabled',
      toolAccess: {
        'naming-strategy': true,
        'branding-style': true,
        'messaging': true,
        'analyst-relations': true,
        'sales-enablement': true,
        'roi-calculator': true,
      },
      logo: '',
      vertical: '',
      companyDetails: {
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        contactRole: '',
      },
      brandEntities: [],
      categoryMappings: {
        company: [],
        products: {},
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    client.categories.forEach((category) => {
      client.items[category] = [];
    });

    return client;
  },

  /**
   * Add a client (async-aware)
   */
  async addClientAsync(name = 'New Client', setActive = true) {
    if (this.isSupabase()) {
      try {
        const client = await Auth.createClientWithOwner(name);
        this._clientsCache = null; // bust cache
        if (setActive) this.setActiveClientId(client.id);
        return client;
      } catch (err) {
        console.error('Storage.addClientAsync error:', err);
        return null;
      }
    }
    // Fallback
    return this.addClient(name, setActive);
  },

  /**
   * Sync add (localStorage only)
   */
  addClient(name = 'New Client', setActive = true) {
    const client = this.createClient(name);
    const clients = this.getClients();
    clients.push(client);
    this.setClients(clients);
    if (setActive) this.setActiveClientId(client.id);
    return client;
  },

  /**
   * Update client (async-aware)
   */
  async updateClientAsync(id, updates) {
    if (this.isSupabase()) {
      try {
        // Map flat fields to Supabase column naming
        const supaUpdates = {};
        const fieldMap = {
          name: 'name',
          status: 'status',
          logo: 'logo',
          vertical: 'vertical',
          companyDetails: 'company_details',
          brandEntities: 'brand_entities',
          categoryMappings: 'category_mappings',
          categories: 'categories',
          items: 'items',
          problems: 'problems',
          toolAccess: 'tool_access',
          settings: 'settings',
        };

        for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
          if (updates.hasOwnProperty(jsKey)) {
            supaUpdates[dbKey] = updates[jsKey];
          }
        }

        const result = await Auth.updateClientRecord(id, supaUpdates);
        this._clientsCache = null; // bust cache
        return result;
      } catch (err) {
        console.error('Storage.updateClientAsync error:', err);
        return null;
      }
    }
    return this.updateClient(id, updates);
  },

  /**
   * Sync update (localStorage only)
   */
  updateClient(id, updates) {
    const clients = this.getClients();
    const index = clients.findIndex((c) => c.id === id);
    if (index === -1) {
      console.warn('Client not found:', id);
      return null;
    }
    const client = clients[index];
    clients[index] = { ...client, ...updates, updatedAt: new Date().toISOString() };
    this.setClients(clients);
    return clients[index];
  },

  /**
   * Delete a client
   */
  deleteClient(id) {
    const clients = this.getClients();
    const filtered = clients.filter((c) => c.id !== id);
    this.setClients(filtered);
    if (this.getActiveClientId() === id) {
      this.setActiveClientId(null);
    }
  },

  // ── Item / Problem helpers (localStorage — migrated tools use these) ──

  getItemsForCategory(category) {
    const client = this.getActiveClient();
    if (!client) return [];
    return client.items[category] || [];
  },

  addItemToCategory(category, name, cell = '') {
    const client = this.getActiveClient();
    if (!client) return null;

    const item = { id: this.uuid(), name: name, cell: cell };
    if (!client.items[category]) client.items[category] = [];
    client.items[category].push(item);
    this.updateClient(client.id, client);
    return item;
  },

  deleteItemFromCategory(category, itemId) {
    const client = this.getActiveClient();
    if (!client) return;
    if (client.items[category]) {
      client.items[category] = client.items[category].filter((item) => item.id !== itemId);
      this.updateClient(client.id, client);
    }
  },

  addProblem(problem) {
    const client = this.getActiveClient();
    if (!client) return null;

    const item = { id: this.uuid(), text: problem, createdAt: new Date().toISOString() };
    client.problems.push(item);
    this.updateClient(client.id, client);
    return item;
  },

  deleteProblem(problemId) {
    const client = this.getActiveClient();
    if (!client) return;
    client.problems = client.problems.filter((p) => p.id !== problemId);
    this.updateClient(client.id, client);
  },
};
