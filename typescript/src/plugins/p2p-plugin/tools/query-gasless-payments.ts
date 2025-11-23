import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { queryP2PPaymentsParameters, P2PPaymentStatus } from '@/shared/parameter-schemas/p2p.zod';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const queryGaslessPaymentsPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool queries gasless payment requests and their status from an HCS topic.
You can filter by sender, recipient, type, and status.

Parameters:
- topicId (string, required): Topic ID to query
- senderAccountId (string, optional): Filter by sender
- recipientAccountId (string, optional): Filter by recipient
- paymentType (string, optional): Filter by type (hbar_transfer, token_transfer, nft_transfer)
- status (string, optional): Filter by status (pending, signed, relayed, completed, failed, expired)
- limit (number, optional): Max results (default: 10)

${usageInstructions}

Returns a list of payment requests with their current status.
`;
};

const queryGaslessPayments = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof queryP2PPaymentsParameters>>,
) => {
  try {
    const { topicId, senderAccountId, recipientAccountId, paymentType, status, limit } = params;

    // Query payments from the topic
    const payments = await queryPaymentsFromTopic(topicId, context, {
      senderAccountId,
      recipientAccountId,
      paymentType,
      status,
      limit,
    });

    if (payments.length === 0) {
      return `No gasless payments found in topic ${topicId} matching the specified criteria.`;
    }

    // Format payments for display
    const formattedPayments = payments.map(formatPaymentForDisplay).join('\n\n---\n\n');

    return `Found ${payments.length} gasless payment(s) in topic ${topicId}:

${formattedPayments}

Status Legend:
- pending: Request created, needs signature
- signed: User signed, waiting for sponsor
- relayed: Sponsor is processing
- completed: Transaction executed successfully
- failed: Transaction failed
- expired: Request expired`;
  } catch (error) {
    const desc = 'Failed to query gasless payments';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[query_gasless_payments_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

// Query payments from topic with filters
async function queryPaymentsFromTopic(
  topicId: string,
  context: Context,
  filters?: {
    senderAccountId?: string;
    recipientAccountId?: string;
    paymentType?: string;
    status?: P2PPaymentStatus;
    limit?: number;
  },
): Promise<any[]> {
  if (!context.mirrornodeService) {
    throw new Error('Mirrornode service is required');
  }

  try {
    const messages = await context.mirrornodeService.getTopicMessages(topicId);

    const payments: any[] = [];
    const statusUpdates = new Map<string, any>(); // paymentRequestId -> latest status

    // First pass: collect all messages
    for (const msg of messages) {
      try {
        const messageContent = Buffer.from(msg.message, 'base64').toString('utf-8');
        const data = JSON.parse(messageContent);

        // Collect status updates
        if (data.type === 'gasless_payment_completed' || data.type === 'gasless_payment_failed') {
          statusUpdates.set(data.paymentRequestId, {
            status: data.type === 'gasless_payment_completed' ? 'completed' : 'failed',
            transactionId: data.transactionId,
            sponsor: data.sponsor,
            gasPaid: data.gasPaid,
            sponsorFee: data.sponsorFee,
            timestamp: data.timestamp,
          });
          continue;
        }

        // Collect signed payments
        if (data.type === 'gasless_payment_signed') {
          const existing = payments.find(p => p.paymentRequestId === data.paymentRequestId);
          if (existing) {
            existing.status = 'signed';
            existing.signedAt = data.timestamp;
            existing.signedSequenceNumber = msg.sequence_number;
          }
          continue;
        }

        // Collect payment requests
        if (data.type === 'gasless_payment_request') {
          const payment = {
            ...data,
            sequenceNumber: msg.sequence_number,
            consensusTimestamp: msg.consensus_timestamp,
          };

          // Apply status updates
          const statusUpdate = statusUpdates.get(data.paymentRequestId);
          if (statusUpdate) {
            Object.assign(payment, statusUpdate);
          }

          // Check expiration
          if (payment.expirationTime && payment.expirationTime < Date.now() && payment.status === 'pending') {
            payment.status = P2PPaymentStatus.EXPIRED;
          }

          // Apply filters
          if (filters?.senderAccountId && payment.sender !== filters.senderAccountId) {
            continue;
          }

          if (filters?.recipientAccountId && payment.recipientAccountId !== filters.recipientAccountId) {
            continue;
          }

          if (filters?.paymentType && payment.paymentType !== filters.paymentType) {
            continue;
          }

          if (filters?.status && payment.status !== filters.status) {
            continue;
          }

          payments.push(payment);
        }
      } catch (parseError) {
        // Skip messages that can't be parsed
        console.warn('Failed to parse topic message:', parseError);
        continue;
      }
    }

    // Sort by timestamp (newest first)
    payments.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    if (filters?.limit) {
      return payments.slice(0, filters.limit);
    }

    return payments;
  } catch (error) {
    throw new Error(
      `Failed to query payments: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

// Format payment for display
function formatPaymentForDisplay(payment: any): string {
  const formatAmount = () => {
    if (payment.nftSerialNumber !== undefined) {
      return `NFT ${payment.tokenId}/${payment.nftSerialNumber}`;
    } else if (payment.tokenId) {
      return `${payment.amount} tokens (${payment.tokenId})`;
    } else {
      return `${payment.amount} HBAR`;
    }
  };

  const expirationInfo = payment.expirationTime
    ? `\nExpires: ${new Date(payment.expirationTime).toLocaleString()}`
    : '';

  const sponsorInfo = payment.sponsorAccountId
    ? `\nRequested Sponsor: ${payment.sponsorAccountId}`
    : '\nSponsor: Any available';

  const completionInfo = payment.status === 'completed'
    ? `\nTransaction ID: ${payment.transactionId}
Actual Sponsor: ${payment.sponsor}
Gas Paid: ${payment.gasPaid} HBAR
Sponsor Fee: ${payment.sponsorFee} HBAR`
    : '';

  return `
Payment Request #${payment.sequenceNumber}
ID: ${payment.paymentRequestId}
Status: ${payment.status}
Type: ${payment.paymentType}
From: ${payment.sender}
To: ${payment.recipientAccountId}
Amount: ${formatAmount()}
Max Fee: ${payment.maxFee} HBAR${sponsorInfo}${expirationInfo}
Created: ${new Date(payment.timestamp).toLocaleString()}
${payment.memo ? `Memo: ${payment.memo}` : ''}${completionInfo}
`.trim();
}

export const QUERY_GASLESS_PAYMENTS_TOOL = 'query_gasless_payments_tool';

const tool = (context: Context): Tool => ({
  method: QUERY_GASLESS_PAYMENTS_TOOL,
  name: 'Query Gasless Payments',
  description: queryGaslessPaymentsPrompt(context),
  parameters: queryP2PPaymentsParameters(context),
  execute: queryGaslessPayments,
});

export default tool;
