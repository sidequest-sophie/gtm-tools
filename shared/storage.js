/**
 * Storage Module
 * Wrapper for localStorage with namespace, JSON serialization, and domain-specific helpers
 */

const Storage = {
  _prefix: 'cl-tools-',

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

  /**
   * Get a value from localStorage
   */
  get(key) {
    try {
      const item = localStorage.getItem(this._prefix + key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Storage.get error:', error);
      return null;
    }
  },

  /**
   * Set a value in localStorage
   */
  set(key, value) {
    try {
      localStorage.setItem(this._prefix + key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage.set error:', error);
    }
  },

  /**
   * Delete a value from localStorage
   */
  delete(key) {
    try {
      localStorage.removeItem(this._prefix + key);
    } catch (error) {
      console.error('Storage.delete error:', error);
    }
  },

  /**
   * Clear all namespaced items from localStorage
   */
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

  /**
   * Get all clients from storage
   */
  getClients() {
    const clients = this.get('clients');
    return Array.isArray(clients) ? clients : [];
  },

  /**
   * Set clients in storage
   */
  setClients(clients) {
    this.set('clients', clients);
  },

  /**
   * Get the ID of the currently active client
   */
  getActiveClientId() {
    return this.get('active-client-id') || null;
  },

  /**
   * Set the ID of the currently active client
   */
  setActiveClientId(id) {
    this.set('active-client-id', id);
  },

  /**
   * Get the active client object (convenience helper)
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
      industryFilterMode: 'user',   // 'user' | 'random' | 'fixed'
      industryFilterValue: '',       // used when mode is 'fixed'
      pptxExportEnabled: false,      // Some Day Maybe: enable PPTX export for this client
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Initialize items object with empty arrays for each category
    client.categories.forEach((category) => {
      client.items[category] = [];
    });

    return client;
  },

  /**
   * Add a client and optionally set it as active
   */
  addClient(name = 'New Client', setActive = true) {
    const client = this.createClient(name);
    const clients = this.getClients();
    clients.push(client);
    this.setClients(clients);

    if (setActive) {
      this.setActiveClientId(client.id);
    }

    return client;
  },

  /**
   * Update an existing client
   */
  updateClient(id, updates) {
    const clients = this.getClients();
    const index = clients.findIndex((c) => c.id === id);

    if (index === -1) {
      console.warn('Client not found:', id);
      return null;
    }

    const client = clients[index];
    clients[index] = {
      ...client,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

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

    // If the deleted client was active, clear the active selection
    if (this.getActiveClientId() === id) {
      this.setActiveClientId(null);
    }
  },

  /**
   * Get items for a specific category in the active client
   */
  getItemsForCategory(category) {
    const client = this.getActiveClient();
    if (!client) return [];

    return client.items[category] || [];
  },

  /**
   * Add an item to a category in the active client
   */
  addItemToCategory(category, name, cell = '') {
    const client = this.getActiveClient();
    if (!client) return null;

    const item = {
      id: this.uuid(),
      name: name,
      cell: cell,
    };

    if (!client.items[category]) {
      client.items[category] = [];
    }

    client.items[category].push(item);
    this.updateClient(client.id, client);

    return item;
  },

  /**
   * Delete an item from a category in the active client
   */
  deleteItemFromCategory(category, itemId) {
    const client = this.getActiveClient();
    if (!client) return;

    if (client.items[category]) {
      client.items[category] = client.items[category].filter((item) => item.id !== itemId);
      this.updateClient(client.id, client);
    }
  },

  /**
   * Add a problem to the active client
   */
  addProblem(problem) {
    const client = this.getActiveClient();
    if (!client) return null;

    const item = {
      id: this.uuid(),
      text: problem,
      createdAt: new Date().toISOString(),
    };

    client.problems.push(item);
    this.updateClient(client.id, client);

    return item;
  },

  /**
   * Delete a problem from the active client
   */
  deleteProblem(problemId) {
    const client = this.getActiveClient();
    if (!client) return;

    client.problems = client.problems.filter((p) => p.id !== problemId);
    this.updateClient(client.id, client);
  },
};
