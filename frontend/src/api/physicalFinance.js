import api from './axios';

export const physicalFinanceService = {
  // Transactions
  getTransactions: async (date) => {
    try {
      const response = await api.get('/physical-finance/transactions', { params: { date } });
      return response.data;
    } catch (error) {
      console.error("Error fetching transactions:", error);
      throw error;
    }
  },
  addTransaction: async (data) => {
    try {
      const response = await api.post('/physical-finance/transactions', data);
      return response.data;
    } catch (error) {
      console.error("Error adding transaction:", error);
      throw error;
    }
  },
  deleteTransaction: async (id, reason, deletedBy) => {
    try {
      const response = await api.delete(`/physical-finance/transactions/${id}`, {
        data: { reason, deletedBy }
      });
      return response.data;
    } catch (error) {
      console.error("Error deleting transaction:", error);
      throw error;
    }
  },
  verifyTransaction: async (id, verified = true) => {
    try {
      const response = await api.put(`/physical-finance/transactions/${id}/verify`, { verified });
      return response.data;
    } catch (error) {
      console.error("Error verifying transaction:", error);
      throw error;
    }
  },
  toggleCashImpact: async (id) => {
    try {
      const response = await api.put(`/physical-finance/transactions/${id}/toggle-cash-impact`);
      return response.data;
    } catch (error) {
      console.error("Error toggling cash impact:", error);
      throw error;
    }
  },
  getInstallmentReminders: async () => {
    try {
      const response = await api.get('/physical-finance/installments/reminders');
      return response.data;
    } catch (error) {
      console.error("Error fetching installment reminders:", error);
      return [];
    }
  },

  // Opening Balance
  getOpeningBalance: async (date) => {
    try {
      const response = await api.get('/physical-finance/opening-balance', { params: { date } });
      return response.data;
    } catch (error) {
      console.error("Error fetching opening balance:", error);
      throw error;
    }
  },
  setOpeningBalance: async (data) => {
    try {
      const response = await api.post('/physical-finance/opening-balance', data);
      return response.data;
    } catch (error) {
      console.error("Error setting opening balance:", error);
      throw error;
    }
  },
  deleteOpeningBalance: async (date) => {
    try {
      const response = await api.delete(`/physical-finance/opening-balance/${date}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting opening balance:", error);
      throw error;
    }
  },

  // Trash & Deleted Audit
  getTrash: async () => {
    try {
      const response = await api.get('/physical-finance/trash');
      return response.data;
    } catch (error) {
      console.error("Error fetching trash transactions:", error);
      throw error;
    }
  },
  restoreTransaction: async (id) => {
    try {
      const response = await api.post(`/physical-finance/trash/${id}/restore`);
      return response.data;
    } catch (error) {
      console.error("Error restoring transaction:", error);
      throw error;
    }
  },

  // Categories Management
  getCategories: async (type) => {
    try {
      const response = await api.get('/physical-finance/categories', { params: { type } });
      return response.data;
    } catch (error) {
      console.error("Error fetching categories:", error);
      return [];
    }
  },
  addCategory: async (data) => {
    try {
      const response = await api.post('/physical-finance/categories', data);
      return response.data;
    } catch (error) {
      console.error("Error adding category:", error);
      throw error;
    }
  },
  updateCategory: async (id, data) => {
    try {
      const response = await api.put(`/physical-finance/categories/${id}`, data);
      return response.data;
    } catch (error) {
      console.error("Error updating category:", error);
      throw error;
    }
  },
  deleteCategory: async (id) => {
    try {
      const response = await api.delete(`/physical-finance/categories/${id}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting category:", error);
      throw error;
    }
  },

  // Financial Reports & Analytics
  getReports: async (params) => {
    try {
      const response = await api.get('/physical-finance/reports', { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching financial reports:", error);
      throw error;
    }
  },

  // Settings
  getDefaultRegFee: async () => {
    try {
      const response = await api.get('/physical-finance/settings/default-reg-fee');
      return response.data;
    } catch (error) {
      console.error("Error fetching default reg fee:", error);
      throw error;
    }
  },
  setDefaultRegFee: async (amount) => {
    try {
      const response = await api.post('/physical-finance/settings/default-reg-fee', { amount });
      return response.data;
    } catch (error) {
      console.error("Error setting default reg fee:", error);
      throw error;
    }
  }
};

export default physicalFinanceService;
