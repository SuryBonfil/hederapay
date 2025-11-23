import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import {
  Client,
  Status,
  TopicMessageSubmitTransaction,
  PrivateKey,
  Transaction,
  TransferTransaction,
  Hbar,
  AccountId,
  TokenId,
  NftId,
} from '@hashgraph/sdk';
import { createP2PPaymentParameters, P2PPaymentType } from '@/shared/parameter-schemas/p2p.zod';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const createGaslessPaymentPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool creates a gasless P2P payment request on Hedera.
The user signs the transaction off-chain, and a sponsor (relayer) pays the gas fees.

How it works:
1. User creates a payment request (this tool)
2. User signs the transaction bytes off-chain (sign_gasless_payment tool)
3. Sponsor/relayer executes and pays gas (relay_gasless_payment tool)
4. Transaction completes without user paying fees

Supported payment types:
- hbar_transfer: Transfer HBAR to another account
- token_transfer: Transfer fungible tokens
- nft_transfer: Transfer an NFT

Parameters:
- paymentType (string, required): Type of payment
- recipientAccountId (string, required): Recipient's account ID
- amount (number, required): Amount to transfer
- tokenId (string, optional): Token ID for token/NFT transfers
- nftSerialNumber (number, optional): Serial number for NFT transfers
- sponsorAccountId (string, optional): Specific sponsor to use
- maxFee (number, optional): Max fee willing to pay sponsor (default: 0.05 HBAR)
- expirationTime (number, optional): Unix timestamp for expiration
- memo (string, optional): Payment memo
- nonce (number, optional): Replay protection nonce

${usageInstructions}

Example - Send 10 HBAR gasless:
{
  "paymentType": "hbar_transfer",
  "recipientAccountId": "0.0.12345",
  "amount": 10,
  "memo": "Payment for services"
}

Example - Send tokens gasless:
{
  "paymentType": "token_transfer",
  "recipientAccountId": "0.0.12345",
  "tokenId": "0.0.67890",
  "amount": 100
}
`;
};

const postProcess = (response: any) => {
  return `Gasless payment request created successfully!

Topic ID: ${response.topicId}
Sequence Number: ${response.sequenceNumber}
Payment Request ID: ${response.paymentRequestId}
Transaction Bytes: ${response.transactionBytes}

Next steps:
1. Sign the transaction using the 'sign_gasless_payment' tool
2. A sponsor will relay your transaction and pay the gas fees

Your payment will be executed without you paying any fees!`;
};

const createGaslessPayment = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof createP2PPaymentParameters>>,
) => {
  try {
    // Set defaults
    const nonce = params.nonce || Date.now();
    const expirationTime = params.expirationTime || Date.now() + (60 * 60 * 1000); // 1 hour
    const maxFee = params.maxFee || 0.05;

    // Validate payment type and params
    validatePaymentParams(params);

    // Create the unsigned transaction
    const unsignedTx = await createUnsignedTransaction(params, client);

    // Freeze transaction and get bytes
    const frozenTx = unsignedTx
      .setMaxTransactionFee(new Hbar(maxFee))
      .freeze();

    const transactionBytes = Buffer.from(frozenTx.toBytes()).toString('base64');

    // Create payment request message
    const paymentRequestId = generatePaymentRequestId(
      client.operatorAccountId!.toString(),
      params.recipientAccountId,
      nonce,
    );

    const paymentRequest = {
      version: '1.0',
      type: 'gasless_payment_request',
      paymentRequestId,
      timestamp: Date.now(),
      sender: client.operatorAccountId?.toString(),
      paymentType: params.paymentType,
      recipientAccountId: params.recipientAccountId,
      tokenId: params.tokenId,
      nftSerialNumber: params.nftSerialNumber,
      amount: params.amount,
      sponsorAccountId: params.sponsorAccountId,
      maxFee,
      expirationTime,
      memo: params.memo,
      nonce,
      transactionBytes,
      status: 'pending',
    };

    // Get or create P2P topic
    const topicId = await getOrCreateP2PTopic(client, context);

    // Submit payment request to topic
    const topicTx = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(JSON.stringify(paymentRequest));

    const response = await topicTx.execute(client);
    const receipt = await response.getReceipt(client);

    return postProcess({
      topicId: topicId.toString(),
      sequenceNumber: receipt.topicSequenceNumber?.toString(),
      paymentRequestId,
      transactionBytes,
    });
  } catch (error) {
    const desc = 'Failed to create gasless payment request';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[create_gasless_payment_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

// Validation helper
function validatePaymentParams(params: z.infer<ReturnType<typeof createP2PPaymentParameters>>) {
  const { paymentType, tokenId, nftSerialNumber, amount } = params;

  switch (paymentType) {
    case P2PPaymentType.HBAR_TRANSFER:
      if (!amount || amount <= 0) {
        throw new Error('Amount must be greater than 0 for HBAR transfers');
      }
      break;

    case P2PPaymentType.TOKEN_TRANSFER:
      if (!tokenId) {
        throw new Error('tokenId is required for token transfers');
      }
      if (!amount || amount <= 0) {
        throw new Error('Amount must be greater than 0 for token transfers');
      }
      break;

    case P2PPaymentType.NFT_TRANSFER:
      if (!tokenId) {
        throw new Error('tokenId is required for NFT transfers');
      }
      if (nftSerialNumber === undefined) {
        throw new Error('nftSerialNumber is required for NFT transfers');
      }
      break;

    default:
      throw new Error(`Invalid payment type: ${paymentType}`);
  }
}

// Create unsigned transaction based on payment type
async function createUnsignedTransaction(
  params: z.infer<ReturnType<typeof createP2PPaymentParameters>>,
  client: Client,
): Promise<Transaction> {
  const tx = new TransferTransaction();
  const sender = client.operatorAccountId!;
  const recipient = AccountId.fromString(params.recipientAccountId);

  switch (params.paymentType) {
    case P2PPaymentType.HBAR_TRANSFER:
      tx.addHbarTransfer(sender, new Hbar(-params.amount));
      tx.addHbarTransfer(recipient, new Hbar(params.amount));
      break;

    case P2PPaymentType.TOKEN_TRANSFER:
      const tokenId = TokenId.fromString(params.tokenId!);
      tx.addTokenTransfer(tokenId, sender, -params.amount);
      tx.addTokenTransfer(tokenId, recipient, params.amount);
      break;

    case P2PPaymentType.NFT_TRANSFER:
      const nftTokenId = TokenId.fromString(params.tokenId!);
      const nftId = new NftId(nftTokenId, params.nftSerialNumber!);
      tx.addNftTransfer(nftId, sender, recipient);
      break;

    default:
      throw new Error(`Unsupported payment type: ${params.paymentType}`);
  }

  if (params.memo) {
    tx.setTransactionMemo(params.memo);
  }

  return tx;
}

// Generate unique payment request ID
function generatePaymentRequestId(sender: string, recipient: string, nonce: number): string {
  const hash = `${sender}-${recipient}-${nonce}`;
  return Buffer.from(hash).toString('base64').substring(0, 32);
}

// Helper to get or create P2P topic
async function getOrCreateP2PTopic(client: Client, context: Context) {
  const contextTopicId = (context as any).p2pTopicId;

  if (contextTopicId) {
    return typeof contextTopicId === 'string'
      ? contextTopicId
      : contextTopicId.toString();
  }

  // For gasless payments, we could use a well-known public topic
  // or create a new one. For now, assume there's a default topic.
  // In production, this should be configured.
  const defaultTopicId = process.env.P2P_GASLESS_TOPIC_ID;

  if (defaultTopicId) {
    return defaultTopicId;
  }

  throw new Error(
    'No P2P topic configured. Set P2P_GASLESS_TOPIC_ID environment variable or provide p2pTopicId in context.',
  );
}

export const CREATE_GASLESS_PAYMENT_TOOL = 'create_gasless_payment_tool';

const tool = (context: Context): Tool => ({
  method: CREATE_GASLESS_PAYMENT_TOOL,
  name: 'Create Gasless Payment',
  description: createGaslessPaymentPrompt(context),
  parameters: createP2PPaymentParameters(context),
  execute: createGaslessPayment,
});

export default tool;
