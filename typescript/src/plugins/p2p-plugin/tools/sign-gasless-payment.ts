import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import {
  Client,
  Status,
  TopicMessageSubmitTransaction,
  Transaction,
} from '@hashgraph/sdk';
import { signP2PPaymentParameters } from '@/shared/parameter-schemas/p2p.zod';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const signGaslessPaymentPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool signs a gasless payment request off-chain.
The user signs the transaction with their private key, but doesn't execute it.
The signed transaction is posted to HCS for a sponsor to relay.

How it works:
1. Retrieves the payment request from HCS topic
2. Decodes the transaction bytes
3. Signs the transaction with user's private key
4. Posts the signed transaction to HCS
5. Sponsor detects and relays the signed transaction

Parameters:
- paymentRequestId (string, required): ID of the payment request
- topicId (string, required): Topic ID where request was posted
- sequenceNumber (number, required): Sequence number of the request message

${usageInstructions}

Note: Your private key is used for signing but the transaction is NOT executed.
A sponsor will execute and pay the fees.
`;
};

const postProcess = (response: any) => {
  return `Payment request signed successfully!

Payment Request ID: ${response.paymentRequestId}
Signed Transaction Posted to Topic: ${response.topicId}
Sequence Number: ${response.sequenceNumber}

Status: Waiting for sponsor to relay transaction

Your transaction is now waiting in the queue for a sponsor to execute it.
Once relayed, you will receive the payment confirmation without paying any fees.`;
};

const signGaslessPayment = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof signP2PPaymentParameters>>,
) => {
  try {
    const { paymentRequestId, topicId, sequenceNumber } = params;

    // Retrieve the payment request from HCS
    const paymentRequest = await getPaymentRequestFromTopic(topicId, sequenceNumber, context);

    // Validate payment request
    validatePaymentRequest(paymentRequest, client, paymentRequestId);

    // Decode transaction bytes
    const transactionBytes = Buffer.from(paymentRequest.transactionBytes, 'base64');
    const transaction = Transaction.fromBytes(transactionBytes);

    // Sign the transaction with user's private key
    const signedTx = await transaction.sign(client.operatorPrivateKey!);

    // Get signed transaction bytes
    const signedBytes = Buffer.from(signedTx.toBytes()).toString('base64');

    // Create signed payment message
    const signedPaymentMessage = {
      version: '1.0',
      type: 'gasless_payment_signed',
      paymentRequestId,
      timestamp: Date.now(),
      sender: paymentRequest.sender,
      recipientAccountId: paymentRequest.recipientAccountId,
      paymentType: paymentRequest.paymentType,
      amount: paymentRequest.amount,
      tokenId: paymentRequest.tokenId,
      nftSerialNumber: paymentRequest.nftSerialNumber,
      maxFee: paymentRequest.maxFee,
      signedTransactionBytes: signedBytes,
      originalSequenceNumber: sequenceNumber,
      status: 'signed',
      memo: paymentRequest.memo,
    };

    // Post signed transaction to topic
    const topicTx = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(JSON.stringify(signedPaymentMessage));

    const response = await topicTx.execute(client);
    const receipt = await response.getReceipt(client);

    return postProcess({
      paymentRequestId,
      topicId,
      sequenceNumber: receipt.topicSequenceNumber?.toString(),
    });
  } catch (error) {
    const desc = 'Failed to sign gasless payment';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[sign_gasless_payment_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

// Retrieve payment request from topic
async function getPaymentRequestFromTopic(
  topicId: string,
  sequenceNumber: number,
  context: Context,
): Promise<any> {
  if (!context.mirrornodeService) {
    throw new Error('Mirrornode service is required to query payment requests');
  }

  try {
    const messages = await context.mirrornodeService.getTopicMessages(topicId);

    const targetMessage = messages.find(
      (msg: any) => msg.sequence_number === sequenceNumber,
    );

    if (!targetMessage) {
      throw new Error(
        `Payment request not found: No message with sequence number ${sequenceNumber}`,
      );
    }

    const messageContent = Buffer.from(targetMessage.message, 'base64').toString('utf-8');
    const paymentRequest = JSON.parse(messageContent);

    if (paymentRequest.type !== 'gasless_payment_request') {
      throw new Error(`Message is not a payment request (type: ${paymentRequest.type})`);
    }

    return paymentRequest;
  } catch (error) {
    throw new Error(
      `Failed to retrieve payment request: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

// Validate payment request
function validatePaymentRequest(paymentRequest: any, client: Client, paymentRequestId: string) {
  // Verify payment request ID matches
  if (paymentRequest.paymentRequestId !== paymentRequestId) {
    throw new Error('Payment request ID mismatch');
  }

  // Verify sender is the current user
  const operatorId = client.operatorAccountId?.toString();
  if (paymentRequest.sender !== operatorId) {
    throw new Error('You are not the sender of this payment request');
  }

  // Check if already signed
  if (paymentRequest.status !== 'pending') {
    throw new Error(`Payment request is not pending (status: ${paymentRequest.status})`);
  }

  // Check expiration
  if (paymentRequest.expirationTime && paymentRequest.expirationTime < Date.now()) {
    throw new Error('Payment request has expired');
  }

  // Verify operator has private key
  if (!client.operatorPrivateKey) {
    throw new Error('Private key is required to sign the transaction');
  }
}

export const SIGN_GASLESS_PAYMENT_TOOL = 'sign_gasless_payment_tool';

const tool = (context: Context): Tool => ({
  method: SIGN_GASLESS_PAYMENT_TOOL,
  name: 'Sign Gasless Payment',
  description: signGaslessPaymentPrompt(context),
  parameters: signP2PPaymentParameters(context),
  execute: signGaslessPayment,
});

export default tool;
