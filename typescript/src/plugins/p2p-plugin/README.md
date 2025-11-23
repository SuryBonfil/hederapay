# P2P Gasless Payments Plugin

A plugin for **peer-to-peer gasless payments** on Hedera. Users can send HBAR, tokens, and NFTs **without paying transaction fees**.

## 🚀 Overview

The P2P Plugin enables **meta-transactions** on Hedera where:

1. 👤 **Users** sign transactions off-chain (no gas fees)
2. 🤝 **Sponsors/Relayers** execute and pay the fees
3. ⚡ **Instant** - Transactions happen in seconds
4. 🔒 **Safe** - Built on Hedera Consensus Service (HCS)

### Why Gasless Payments?

- **Onboarding**: New users can transact without holding HBAR
- **UX**: No need to estimate or pay fees
- **Business Models**: Sponsors can offer free transactions or charge service fees
- **Mass Adoption**: Remove barriers to blockchain usage

## 💡 How It Works

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   User      │         │  HCS Topic   │         │  Sponsor    │
│ (No fees)   │         │ (Marketplace)│         │(Pays fees)  │
└─────────────┘         └──────────────┘         └─────────────┘
       │                        │                        │
       │ 1. Create Payment      │                        │
       │   Request (no gas)     │                        │
       │───────────────────────>│                        │
       │                        │                        │
       │ 2. Sign Transaction    │                        │
       │   (off-chain)          │                        │
       │───────────────────────>│                        │
       │                        │                        │
       │                        │   3. Relay Payment     │
       │                        │<───────────────────────│
       │                        │                        │
       │                        │   4. Execute & Pay Fees│
       │<────────────────────────────────────────────────│
       │                        │                        │
       │ Payment Complete!      │                        │
       │ (User paid $0 in fees) │                        │
```

### Payment Flow

1. **User Creates Request**: `create_gasless_payment_tool`
   - Specifies recipient, amount, asset type
   - Request posted to HCS topic
   - Transaction bytes generated

2. **User Signs Off-Chain**: `sign_gasless_payment_tool`
   - User signs with private key (local, no gas)
   - Signed transaction posted to HCS
   - Waits for sponsor

3. **Sponsor Relays**: `relay_gasless_payment_tool`
   - Sponsor picks up signed transaction
   - Adds their signature
   - Executes and pays fees
   - Optionally charges service fee

4. **Completion**:
   - User receives confirmation
   - Total fees paid by user: **$0**
   - Sponsor paid: Network fees (+ optional service fee collected)

## 📦 Installation

```bash
npm install hedera-agent-kit
```

## 🚀 Quick Start

### For Users (Send Gasless Payments)

```typescript
import { Client, PrivateKey } from '@hashgraph/sdk';
import { HederaLangchainToolkit, p2pPlugin } from 'hedera-agent-kit';

// Setup client
const client = Client.forTestnet().setOperator(
  process.env.ACCOUNT_ID!,
  PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!)
);

// Initialize toolkit with P2P plugin
const toolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    plugins: [p2pPlugin],
    context: {
      p2pTopicId: process.env.P2P_GASLESS_TOPIC_ID, // Public gasless payment topic
    },
  },
});

// Use with your AI agent
const tools = toolkit.getTools();

// Example: Create gasless payment
await agent.invoke({
  input: "Send 10 HBAR to account 0.0.12345 without paying fees"
});
// Agent will use create_gasless_payment_tool and sign_gasless_payment_tool
```

### For Sponsors (Run a Relayer)

```typescript
import { Client, PrivateKey } from '@hashgraph/sdk';
import { HederaLangchainToolkit, p2pPlugin } from 'hedera-agent-kit';

// Setup sponsor client with funds
const client = Client.forTestnet().setOperator(
  process.env.SPONSOR_ACCOUNT_ID!,
  PrivateKey.fromStringECDSA(process.env.SPONSOR_PRIVATE_KEY!)
);

const toolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    plugins: [p2pPlugin],
    context: {
      p2pTopicId: process.env.P2P_GASLESS_TOPIC_ID,
    },
  },
});

// Monitor for signed payments and relay them
await agent.invoke({
  input: "Check for pending gasless payments and relay them with a 1% fee"
});
// Agent will use query_gasless_payments_tool and relay_gasless_payment_tool
```

## 🔧 Available Tools

### 1. Create Gasless Payment

Create a gasless payment request.

**Tool Name**: `create_gasless_payment_tool`

**Parameters**:
- `paymentType` - Type of payment (hbar_transfer, token_transfer, nft_transfer)
- `recipientAccountId` - Recipient's account ID
- `amount` - Amount to transfer
- `tokenId` (optional) - Token ID for token/NFT transfers
- `nftSerialNumber` (optional) - Serial number for NFT transfers
- `sponsorAccountId` (optional) - Specific sponsor to use
- `maxFee` (optional) - Max fee willing to pay sponsor (default: 0.05 HBAR)
- `expirationTime` (optional) - Unix timestamp for expiration
- `memo` (optional) - Payment memo
- `nonce` (optional) - Replay protection nonce

**Example**:
```typescript
{
  paymentType: "hbar_transfer",
  recipientAccountId: "0.0.12345",
  amount: 10,
  memo: "Payment for services"
}
```

### 2. Sign Gasless Payment

Sign a payment request off-chain (user doesn't pay gas).

**Tool Name**: `sign_gasless_payment_tool`

**Parameters**:
- `paymentRequestId` - ID of the payment request
- `topicId` - Topic ID where request was posted
- `sequenceNumber` - Sequence number of the request

**Example**:
```typescript
{
  paymentRequestId: "abc123...",
  topicId: "0.0.67890",
  sequenceNumber: 42
}
```

### 3. Relay Gasless Payment (Sponsor Only)

Execute a signed payment and pay the fees.

**Tool Name**: `relay_gasless_payment_tool`

**Parameters**:
- `topicId` - Topic ID where signed payment is posted
- `sequenceNumber` - Sequence number of signed payment
- `sponsorFee` (optional) - Fee to charge for relaying (in HBAR)

**Example**:
```typescript
{
  topicId: "0.0.67890",
  sequenceNumber: 43,
  sponsorFee: 0.01  // 0.01 HBAR service fee
}
```

### 4. Query Gasless Payments

Search for gasless payment requests.

**Tool Name**: `query_gasless_payments_tool`

**Parameters**:
- `topicId` - Topic ID to query
- `senderAccountId` (optional) - Filter by sender
- `recipientAccountId` (optional) - Filter by recipient
- `paymentType` (optional) - Filter by type
- `status` (optional) - Filter by status
- `limit` (optional) - Max results (default: 10)

**Example**:
```typescript
{
  topicId: "0.0.67890",
  status: "signed",  // Find payments ready to relay
  limit: 5
}
```

## 📊 Payment States

| State | Description | Who Can Transition |
|-------|-------------|-------------------|
| `pending` | Request created, needs signature | User → signs |
| `signed` | User signed, waiting for sponsor | Sponsor → relays |
| `relayed` | Sponsor is processing | Sponsor → completes |
| `completed` | Transaction executed successfully | N/A |
| `failed` | Transaction failed | N/A |
| `expired` | Request expired | N/A |

## 💰 Sponsor Economics

### Revenue Models for Sponsors

1. **Flat Fee**: Charge fixed amount per transaction
   ```typescript
   sponsorFee: 0.01  // 0.01 HBAR per payment
   ```

2. **Percentage Fee**: Charge percentage of transfer
   ```typescript
   // For 100 HBAR transfer with 1% fee
   sponsorFee: 1.0  // 1 HBAR (1% of 100)
   ```

3. **Subscription Model**: Users pay monthly, unlimited gasless txs

4. **Freemium**: Free for small amounts, fee for large

### Cost Analysis

**Typical Costs per Transaction**:
- Network Fee: ~$0.0001 (0.00001 HBAR)
- HCS Message: ~$0.0001 (0.00001 HBAR)
- Total Cost: ~$0.0002 per payment

**Break-Even Examples**:
- Charge 0.01 HBAR ($0.003): 15x profit margin
- Charge 1% on $1: 50x profit margin
- Charge 0.5% on $10: 250x profit margin

## 🎯 Use Cases

### 1. Onboarding New Users
```typescript
// New user receives payment without holding HBAR
await createGaslessPayment({
  paymentType: "hbar_transfer",
  recipientAccountId: newUser.accountId,
  amount: 10,
  memo: "Welcome bonus"
});
```

### 2. Micropayments
```typescript
// User tips content creator without fees
await createGaslessPayment({
  paymentType: "hbar_transfer",
  recipientAccountId: creator.accountId,
  amount: 0.1,  // 0.1 HBAR tip
  memo: "Great content!"
});
```

### 3. Token Airdrops
```typescript
// Airdrop tokens to users gasless
await createGaslessPayment({
  paymentType: "token_transfer",
  recipientAccountId: user.accountId,
  tokenId: "0.0.12345",
  amount: 100,
  memo: "Airdrop reward"
});
```

### 4. NFT Transfers
```typescript
// Send NFT without user paying gas
await createGaslessPayment({
  paymentType: "nft_transfer",
  recipientAccountId: buyer.accountId,
  tokenId: "0.0.12345",
  nftSerialNumber: 42,
  memo: "NFT purchase"
});
```

## 🔒 Security

### User Security

1. **Private Keys**: Only sign, never expose private keys
2. **Replay Protection**: Nonces prevent transaction replay
3. **Expiration**: Requests auto-expire to prevent stale txs
4. **Max Fee**: Users set maximum fee they're willing to sponsor

### Sponsor Security

1. **Validation**: Verify signatures before relaying
2. **Rate Limiting**: Limit payments per user/period
3. **Balance Checks**: Ensure sufficient sponsor balance
4. **Fraud Detection**: Monitor for suspicious patterns

## 📚 Advanced Configuration

### Custom Topic Setup

```typescript
// Use your own HCS topic
const toolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    plugins: [p2pPlugin],
    context: {
      p2pTopicId: "0.0.YOUR_TOPIC",
    },
  },
});
```

### Sponsor Selection

```typescript
// Request specific sponsor
await createGaslessPayment({
  paymentType: "hbar_transfer",
  recipientAccountId: "0.0.12345",
  amount: 10,
  sponsorAccountId: "0.0.TRUSTED_SPONSOR",  // Only this sponsor can relay
  maxFee: 0.05  // Max 0.05 HBAR sponsor fee
});
```

### Auto-Relay Bot

```typescript
// Automated sponsor bot
setInterval(async () => {
  // Query pending signed payments
  const payments = await queryGaslessPayments({
    topicId: process.env.P2P_GASLESS_TOPIC_ID,
    status: "signed",
    limit: 10
  });

  // Relay each payment
  for (const payment of payments) {
    await relayGaslessPayment({
      topicId: payment.topicId,
      sequenceNumber: payment.signedSequenceNumber,
      sponsorFee: calculateFee(payment.amount)  // Your fee logic
    });
  }
}, 5000);  // Check every 5 seconds
```

## 🌐 Production Deployment

### Requirements

1. **HCS Topic**: Create public topic for payment requests
   ```bash
   hedera topic create --memo "Gasless Payments"
   ```

2. **Sponsor Account**: Fund with HBAR for gas fees
   ```bash
   # Sponsor needs sufficient balance
   # Recommended: 1000+ HBAR for production
   ```

3. **Mirrornode**: Configure mirrornode service
   ```typescript
   import { HederaMirrornodeServiceDefaultImpl } from 'hedera-agent-kit';

   context: {
     mirrornodeService: new HederaMirrornodeServiceDefaultImpl(),
   }
   ```

4. **Environment Variables**:
   ```env
   P2P_GASLESS_TOPIC_ID=0.0.YOUR_TOPIC
   SPONSOR_ACCOUNT_ID=0.0.SPONSOR
   SPONSOR_PRIVATE_KEY=0x...
   ```

### Monitoring

Track sponsor performance:
- Gas fees paid
- Service fees collected
- Payment volume
- Success rate
- Average relay time

## 🐛 Troubleshooting

### "No P2P topic configured"

Set the topic ID in environment or context:
```bash
export P2P_GASLESS_TOPIC_ID=0.0.12345
```

### "Mirrornode service is required"

Add mirrornode to context:
```typescript
import { HederaMirrornodeServiceDefaultImpl } from 'hedera-agent-kit';

context: {
  mirrornodeService: new HederaMirrornodeServiceDefaultImpl(),
}
```

### "Payment has expired"

Increase expiration time:
```typescript
expirationTime: Date.now() + (24 * 60 * 60 * 1000)  // 24 hours
```

### "Insufficient sponsor balance"

Sponsor needs more HBAR:
```bash
# Transfer HBAR to sponsor account
hedera transfer --to 0.0.SPONSOR --amount 100
```

## 📖 Examples

See full examples in:
- [typescript/examples/langchain/p2p-gasless-agent.ts](../../examples/langchain/p2p-gasless-agent.ts)
- [typescript/examples/langchain/p2p-sponsor-bot.ts](../../examples/langchain/p2p-sponsor-bot.ts)

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](../../../../CONTRIBUTING.md)

## 📄 License

Apache 2.0

## 🔗 Resources

- [Hedera Consensus Service](https://docs.hedera.com/guides/docs/sdks/consensus)
- [Meta-Transactions on Hedera](https://hedera.com/blog/meta-transactions)
- [Plugin Development Guide](../../../docs/HEDERAPLUGINS.md)
