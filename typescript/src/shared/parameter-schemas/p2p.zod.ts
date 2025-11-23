import { Context } from '@/shared/configuration';
import { z } from 'zod';
import { AccountId, NftId, TokenId } from '@hashgraph/sdk';
import BigNumber from 'bignumber.js';
import Long from 'long';

// Enum for gasless payment types
export enum P2PPaymentType {
  HBAR_TRANSFER = 'hbar_transfer',
  TOKEN_TRANSFER = 'token_transfer',
  NFT_TRANSFER = 'nft_transfer',
}

// Enum for payment status
export enum P2PPaymentStatus {
  PENDING = 'pending',           // Payment request created, waiting for signature
  SIGNED = 'signed',             // User signed the transaction
  RELAYED = 'relayed',           // Sponsor is processing the transaction
  COMPLETED = 'completed',       // Transaction executed successfully
  FAILED = 'failed',             // Transaction failed
  EXPIRED = 'expired',           // Payment request expired
}

// Create P2P Gasless Payment Request Parameters
export const createP2PPaymentParameters = (_context: Context = {}) =>
  z.object({
    paymentType: z
      .nativeEnum(P2PPaymentType)
      .describe('Type of payment (hbar_transfer, token_transfer, nft_transfer)'),

    recipientAccountId: z
      .string()
      .describe('Account ID of the payment recipient'),

    // Transfer details
    tokenId: z
      .string()
      .optional()
      .describe('Token ID for token or NFT transfers'),

    nftSerialNumber: z
      .number()
      .optional()
      .describe('Serial number for NFT transfers'),

    amount: z
      .number()
      .describe('Amount of HBAR or tokens to transfer'),

    // Gasless payment specific
    sponsorAccountId: z
      .string()
      .optional()
      .describe('Account ID of the sponsor who will pay the gas fees. If not provided, uses default relayer.'),

    maxFee: z
      .number()
      .optional()
      .default(0.05)
      .describe('Maximum fee the sender is willing to have the sponsor pay (in HBAR). Default: 0.05 HBAR'),

    expirationTime: z
      .number()
      .optional()
      .describe('Unix timestamp when the payment request expires. If not set, defaults to 1 hour from now.'),

    memo: z
      .string()
      .optional()
      .describe('Optional memo for the payment'),

    nonce: z
      .number()
      .optional()
      .describe('Nonce to prevent replay attacks. Auto-generated if not provided.'),
  });

export const createP2PPaymentParametersNormalised = (_context: Context = {}) =>
  z.object({
    paymentType: z.nativeEnum(P2PPaymentType),
    recipientAccountId: z.union([z.string(), z.instanceof(AccountId)]),
    tokenId: z.union([z.string(), z.instanceof(TokenId)]).optional(),
    nftSerialNumber: z.union([z.number(), z.instanceof(Long)]).optional(),
    amount: z.union([z.number(), z.string(), z.instanceof(Long), z.instanceof(BigNumber)]),
    sponsorAccountId: z.union([z.string(), z.instanceof(AccountId)]).optional(),
    maxFee: z.number(),
    expirationTime: z.number(),
    memo: z.string().optional(),
    nonce: z.number(),
  });

// Sign P2P Payment Request Parameters (User signs off-chain)
export const signP2PPaymentParameters = (_context: Context = {}) =>
  z.object({
    paymentRequestId: z
      .string()
      .describe('ID of the payment request to sign (from HCS topic)'),

    topicId: z
      .string()
      .describe('Topic ID where the payment request was posted'),

    sequenceNumber: z
      .number()
      .describe('Sequence number of the payment request message'),
  });

// Execute/Relay P2P Payment Parameters (Sponsor executes)
export const relayP2PPaymentParameters = (_context: Context = {}) =>
  z.object({
    topicId: z
      .string()
      .describe('Topic ID where the signed payment is posted'),

    sequenceNumber: z
      .number()
      .describe('Sequence number of the signed payment message'),

    sponsorFee: z
      .number()
      .optional()
      .describe('Fee the sponsor will charge for this relay (in HBAR)'),
  });

// Query P2P Payment Requests Parameters
export const queryP2PPaymentsParameters = (_context: Context = {}) =>
  z.object({
    topicId: z
      .string()
      .describe('Topic ID to query for payment requests'),

    senderAccountId: z
      .string()
      .optional()
      .describe('Filter by sender account ID'),

    recipientAccountId: z
      .string()
      .optional()
      .describe('Filter by recipient account ID'),

    paymentType: z
      .nativeEnum(P2PPaymentType)
      .optional()
      .describe('Filter by payment type'),

    status: z
      .nativeEnum(P2PPaymentStatus)
      .optional()
      .describe('Filter by status (pending, signed, completed, etc.)'),

    limit: z
      .number()
      .optional()
      .default(10)
      .describe('Maximum number of payments to return (default: 10)'),
  });

export const queryP2PPaymentsParametersNormalised = (_context: Context = {}) =>
  z.object({
    topicId: z.string(),
    senderAccountId: z.union([z.string(), z.instanceof(AccountId)]).optional(),
    recipientAccountId: z.union([z.string(), z.instanceof(AccountId)]).optional(),
    paymentType: z.nativeEnum(P2PPaymentType).optional(),
    status: z.nativeEnum(P2PPaymentStatus).optional(),
    limit: z.number().optional(),
  });

// Cancel P2P Payment Request Parameters
export const cancelP2PPaymentParameters = (_context: Context = {}) =>
  z.object({
    topicId: z
      .string()
      .describe('Topic ID where the payment request was posted'),

    sequenceNumber: z
      .number()
      .describe('Sequence number of the payment request to cancel'),
  });

// Get Sponsor Info Parameters
export const getSponsorInfoParameters = (_context: Context = {}) =>
  z.object({
    sponsorAccountId: z
      .string()
      .optional()
      .describe('Account ID of the sponsor to query. If not provided, returns default sponsor info.'),
  });

// Register as Sponsor Parameters
export const registerSponsorParameters = (_context: Context = {}) =>
  z.object({
    minFeePercentage: z
      .number()
      .optional()
      .default(1)
      .describe('Minimum fee percentage to charge (default: 1%)'),

    maxDailyVolume: z
      .number()
      .optional()
      .describe('Maximum daily volume in HBAR to sponsor'),

    supportedTokens: z
      .array(z.string())
      .optional()
      .describe('Array of token IDs this sponsor supports'),

    memo: z
      .string()
      .optional()
      .describe('Sponsor description/memo'),
  });
