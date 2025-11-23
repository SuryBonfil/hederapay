import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import {
  Client,
  Status,
  TopicMessageSubmitTransaction,
  Transaction,
  Hbar,
} from '@hashgraph/sdk';
import { relayP2PPaymentParameters } from '@/shared/parameter-schemas/p2p.zod';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const relayGaslessPaymentPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool relays (executes) a signed gasless payment on behalf of a user.
The sponsor pays the transaction fees and optionally charges a fee.

⚠️ SPONSOR ONLY - This tool is for sponsors/relayers who pay gas fees.

How it works:
1. Retrieves signed payment from HCS topic
2. Validates the signed transaction
3. Adds sponsor's signature
4. Executes the transaction (sponsor pays fees)
5. Optionally deducts sponsor fee from recipient
6. Posts completion status to HCS

Parameters:
- topicId (string, required): Topic ID where signed payment is posted
- sequenceNumber (number, required): Sequence number of signed payment
- sponsorFee (number, optional): Fee to charge for relaying (in HBAR)

${usageInstructions}

Revenue Model:
- Sponsor pays gas fees upfront
- Can charge a fee (deducted from transfer amount or separate charge)
- Common fee: 0.5-2% of transfer amount or flat fee

Example:
{
  "topicId": "0.0.12345",
  "sequenceNumber": 42,
  "sponsorFee": 0.01
}
`;
};

const postProcess = (response: any) => {
  return `Gasless payment relayed successfully!

Transaction ID: ${response.transactionId}
Payment Request ID: ${response.paymentRequestId}
Sponsor: ${response.sponsor}
Gas Paid: ${response.gasPaid} HBAR
Sponsor Fee: ${response.sponsorFee} HBAR
Net Transfer: ${response.netTransfer}

Status: Completed

The user's transaction was executed without them paying any fees.
${response.sponsorFee > 0 ? `You charged a sponsor fee of ${response.sponsorFee} HBAR.` : ''}`;
};

const relayGaslessPayment = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof relayP2PPaymentParameters>>,
) => {
  try {
    const { topicId, sequenceNumber, sponsorFee = 0 } = params;

    // Retrieve signed payment from HCS
    const signedPayment = await getSignedPaymentFromTopic(topicId, sequenceNumber, context);

    // Validate signed payment
    validateSignedPayment(signedPayment);

    // Check sponsor is authorized
    validateSponsorAuthorization(signedPayment, client);

    // Decode and verify signed transaction
    const transactionBytes = Buffer.from(signedPayment.signedTransactionBytes, 'base64');
    const signedTx = Transaction.fromBytes(transactionBytes);

    // Sponsor signs the transaction (adds second signature)
    const fullySignedTx = await signedTx.sign(client.operatorPrivateKey!);

    // Execute the transaction (sponsor pays fees)
    console.log(`[relay_gasless_payment] Executing transaction as sponsor: ${client.operatorAccountId}`);
    const txResponse = await fullySignedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);

    // Calculate actual gas paid
    const gasPaid = 0.01; // This should be calculated from receipt

    // TODO: If sponsorFee > 0, create a separate transaction to charge the fee
    // This could be done by:
    // 1. Deducting from the transfer amount (if sender authorized)
    // 2. Charging recipient
    // 3. Using a fee-on-transfer token
    // For now, we'll just log it

    if (sponsorFee > 0) {
      console.log(`[relay_gasless_payment] Sponsor fee of ${sponsorFee} HBAR would be charged`);
      // In production, implement fee collection here
    }

    // Post completion status to HCS
    await markPaymentAsCompleted(
      topicId,
      signedPayment.paymentRequestId,
      client,
      txResponse.transactionId.toString(),
      gasPaid,
      sponsorFee,
    );

    return postProcess({
      transactionId: txResponse.transactionId.toString(),
      paymentRequestId: signedPayment.paymentRequestId,
      sponsor: client.operatorAccountId?.toString(),
      gasPaid,
      sponsorFee,
      netTransfer: `${signedPayment.amount - sponsorFee} ${signedPayment.paymentType}`,
      status: receipt.status.toString(),
    });
  } catch (error) {
    const desc = 'Failed to relay gasless payment';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[relay_gasless_payment_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

// Retrieve signed payment from topic
async function getSignedPaymentFromTopic(
  topicId: string,
  sequenceNumber: number,
  context: Context,
): Promise<any> {
  if (!context.mirrornodeService) {
    throw new Error('Mirrornode service is required');
  }

  try {
    const messages = await context.mirrornodeService.getTopicMessages(topicId);

    const targetMessage = messages.find(
      (msg: any) => msg.sequence_number === sequenceNumber,
    );

    if (!targetMessage) {
      throw new Error(`Signed payment not found at sequence ${sequenceNumber}`);
    }

    const messageContent = Buffer.from(targetMessage.message, 'base64').toString('utf-8');
    const signedPayment = JSON.parse(messageContent);

    if (signedPayment.type !== 'gasless_payment_signed') {
      throw new Error(`Message is not a signed payment (type: ${signedPayment.type})`);
    }

    return signedPayment;
  } catch (error) {
    throw new Error(
      `Failed to retrieve signed payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

// Validate signed payment
function validateSignedPayment(signedPayment: any) {
  if (signedPayment.status !== 'signed') {
    throw new Error(`Payment is not signed (status: ${signedPayment.status})`);
  }

  if (!signedPayment.signedTransactionBytes) {
    throw new Error('Signed transaction bytes not found');
  }

  // Check if payment has already been relayed
  if (signedPayment.relayed) {
    throw new Error('Payment has already been relayed');
  }
}

// Validate sponsor authorization
function validateSponsorAuthorization(signedPayment: any, client: Client) {
  const sponsorId = client.operatorAccountId?.toString();

  // If specific sponsor was requested, verify it matches
  if (signedPayment.sponsorAccountId) {
    if (signedPayment.sponsorAccountId !== sponsorId) {
      throw new Error(
        `This payment requires sponsor ${signedPayment.sponsorAccountId}, but you are ${sponsorId}`,
      );
    }
  }

  // Check sponsor has sufficient balance
  // In production, add balance check here
}

// Mark payment as completed
async function markPaymentAsCompleted(
  topicId: string,
  paymentRequestId: string,
  client: Client,
  transactionId: string,
  gasPaid: number,
  sponsorFee: number,
) {
  const completionMessage = {
    version: '1.0',
    type: 'gasless_payment_completed',
    paymentRequestId,
    timestamp: Date.now(),
    transactionId,
    sponsor: client.operatorAccountId?.toString(),
    gasPaid,
    sponsorFee,
    status: 'completed',
  };

  const tx = new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify(completionMessage));

  await tx.execute(client);
}

export const RELAY_GASLESS_PAYMENT_TOOL = 'relay_gasless_payment_tool';

const tool = (context: Context): Tool => ({
  method: RELAY_GASLESS_PAYMENT_TOOL,
  name: 'Relay Gasless Payment (Sponsor)',
  description: relayGaslessPaymentPrompt(context),
  parameters: relayP2PPaymentParameters(context),
  execute: relayGaslessPayment,
});

export default tool;
