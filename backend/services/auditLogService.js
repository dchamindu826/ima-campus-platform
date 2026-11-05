const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

/**
 * Service to handle appending immutable records to the Call Campaign Data Center Event Vault.
 */
class AuditLogService {
  /**
   * Logs a campaign event for a lead.
   *
   * @param {Object} params
   * @param {number} params.leadId - The ID of the lead
   * @param {string} params.campaignCategory - 'OPEN_SEMINAR', 'NEW_INQ', 'PAID_CAMPAIGN', etc.
   * @param {string} params.actionType - 'ASSIGNED', 'STATUS_UPDATED', 'CALL_ATTEMPTED', 'RESET', etc.
   * @param {string} [params.oldStatus] - Previous status (optional)
   * @param {string} [params.newStatus] - New status (optional)
   * @param {number} [params.callAttempt] - Attempt number (optional)
   * @param {string} [params.remarks] - Any text remarks provided by the coordinator (optional)
   * @param {number} [params.actionedById] - ID of the User who performed the action (optional, could be System)
   * @returns {Promise<Object>} The created audit log record
   */
  async logCampaignEvent({
    leadId,
    campaignCategory,
    actionType,
    oldStatus = null,
    newStatus = null,
    callAttempt = null,
    remarks = null,
    actionedById = null
  }) {
    try {
      if (!leadId || !campaignCategory || !actionType) {
        throw new Error("leadId, campaignCategory, and actionType are required for audit logging.");
      }

      const log = await prisma.callCampaignAuditLog.create({
        data: {
          leadId: parseInt(leadId),
          campaignCategory,
          actionType,
          oldStatus,
          newStatus,
          callAttempt: callAttempt ? parseInt(callAttempt) : null,
          remarks,
          actionedById: actionedById ? parseInt(actionedById) : null
        }
      });

      console.log(`[AuditLog] Logged event ${actionType} for lead ${leadId} in ${campaignCategory}`);
      return log;
    } catch (error) {
      console.error("[AuditLogService Error]: Failed to log campaign event", error);
      // We don't necessarily want to break the main flow if logging fails, 
      // but in this architectural pattern, logging is critical. 
      // For now, we will just log the error and not throw to avoid breaking the UI.
    }
  }
}

module.exports = new AuditLogService();
