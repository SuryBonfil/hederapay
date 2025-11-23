# P2P Gasless Payments - Complete Setup Guide

This guide will help you set up and run the P2P gasless payment system in **under 5 minutes**.

## 🎯 What You'll Build

- **User Side**: Send HBAR/tokens **without paying fees**
- **Sponsor Side**: Run a bot that relays payments and **earns fees**

## 📋 Prerequisites

- Node.js 18+
- Two Hedera testnet accounts:
  - **User account** (can have $0 HBAR!)
  - **Sponsor account** (needs ~10 HBAR)

## 🚀 Quick Start (5 minutes)

### Step 1: Clone & Install (1 min)

```bash
# Navigate to examples directory
cd typescript/examples/langchain

# Install dependencies (if not already done)
npm install
```

### Step 2: Create Topic (1 min)

Create a public HCS topic for gasless payments:

```bash
# Using Hedera CLI (if installed)
hedera topic create --memo "P2P Gasless Payments"

# Or use the Hedera Portal
# https://portal.hedera.com
```

**Save the Topic ID** - you'll need it! (e.g., `0.0.12345`)

### Step 3: Configure Environment (2 min)

Copy the example environment file:

```bash
cp .env.p2p.example .env
```

Edit `.env` and fill in:

```env
# Required for both
OPENAI_API_KEY=sk-proj-YOUR_KEY
P2P_GASLESS_TOPIC_ID=0.0.YOUR_TOPIC

# For user (sender)
ACCOUNT_ID=0.0.YOUR_ACCOUNT
PRIVATE_KEY=0x...
RECIPIENT_ACCOUNT_ID=0.0.RECIPIENT  # Who to send to

# For sponsor (relayer)
SPONSOR_ACCOUNT_ID=0.0.SPONSOR
SPONSOR_PRIVATE_KEY=0x...
```

### Step 4: Run Examples (1 min)

#### Option A: User (Send Gasless Payments)

```bash
npx ts-node p2p-gasless-user.ts
```

**What it does:**
- Creates gasless payment request
- Signs it off-chain (no fees!)
- Waits for sponsor to relay

**Try it:**
- "Send 10 HBAR to 0.0.12345 without paying fees"
- "Show my pending gasless payments"

#### Option B: Sponsor (Relay & Earn)

```bash
npx ts-node p2p-gasless-sponsor.ts
```

**What it does:**
- Monitors for signed payments
- Relays them automatically
- Pays network fees (~$0.0002)
- Charges service fee (default: 1%)

**Earnings Example:**
- Cost: $0.0002 per payment
- Charge: 0.01 HBAR ($0.003)
- Profit: $0.0028 per payment (14x ROI)

## 📚 Detailed Setup

### Creating Test Accounts

#### User Account (No HBAR Needed!)

1. Go to [Hedera Portal](https://portal.hedera.com)
2. Create new testnet account
3. Copy Account ID and Private Key
4. **Don't fund it** - gasless means no fees!

#### Sponsor Account (Needs HBAR)

1. Create another testnet account
2. Fund with testnet HBAR (faucet: https://portal.hedera.com/faucet)
3. Recommended: 10 HBAR minimum, 100+ for production

### Environment Variables Explained

#### User Configuration

```env
# Your account (sender)
ACCOUNT_ID=0.0.1234
PRIVATE_KEY=0x...

# Who receives the payment
RECIPIENT_ACCOUNT_ID=0.0.5678

# Optional: Token to test token transfers
TOKEN_ID=0.0.9999
```

#### Sponsor Configuration

```env
# Sponsor account (pays fees, earns fees)
SPONSOR_ACCOUNT_ID=0.0.4321
SPONSOR_PRIVATE_KEY=0x...

# Fee Model
SPONSOR_FEE_MODEL=percentage  # or 'flat'
SPONSOR_PERCENTAGE_FEE=1      # 1% fee
# OR
SPONSOR_FLAT_FEE=0.01         # 0.01 HBAR per payment

# Operating parameters
SPONSOR_MIN_BALANCE=10        # Stop if balance < 10 HBAR
SPONSOR_POLL_INTERVAL=5000    # Check every 5 seconds
SPONSOR_MAX_BATCH=5           # Relay max 5 at a time

# Mode
MANUAL_MODE=false             # true = manual, false = auto
```

## 🎮 Usage Examples

### User Examples

#### Send HBAR Gasless

```bash
# Interactive mode
npx ts-node p2p-gasless-user.ts

> You: Send 10 HBAR to 0.0.12345 without paying fees

🤖 Assistant: I'll create a gasless payment request for you...
✅ Payment request created!
   You pay: $0 in fees
   Sponsor will pay: ~$0.0002
   Status: Waiting for sponsor...
```

#### Send Tokens Gasless

```
> You: Send 100 tokens of 0.0.67890 to 0.0.12345 without fees

🤖 Assistant: Creating token transfer request...
✅ Token payment request signed!
   A sponsor will relay this transaction shortly.
```

#### Check Status

```
> You: Show my pending payments

🤖 Assistant: Your gasless payments:
   1. 10 HBAR to 0.0.12345 - Status: signed, waiting for relay
   2. 100 tokens to 0.0.12345 - Status: completed ✅
```

### Sponsor Examples

#### Auto Mode (Recommended)

```bash
# Set MANUAL_MODE=false in .env
npx ts-node p2p-gasless-sponsor.ts

🤖 Sponsor bot initialized!
💰 Balance: 50 HBAR
📋 Fee Model: percentage (1%)
🔄 Checking for payments...

✅ Relayed payment #1
   Volume: 10 HBAR
   Fee paid: 0.0002 HBAR
   Fee earned: 0.1 HBAR
   Profit: 0.0998 HBAR

📊 Session Statistics:
   Payments: 1
   Net Profit: 0.0998 HBAR
```

#### Manual Mode

```bash
# Set MANUAL_MODE=true in .env
npx ts-node p2p-gasless-sponsor.ts

Sponsor> relay next signed payment with 0.01 HBAR fee

🤖 Bot: Relaying payment...
✅ Transaction ID: 0.0.4321@1234567890.123
   Fee earned: 0.01 HBAR
```

## 💰 Economics & ROI

### Cost Analysis

**Per Payment:**
- Network fee: ~$0.0002 (0.00002 HBAR)
- HCS message: ~$0.0001
- **Total cost: ~$0.0003**

### Revenue Models

#### 1. Flat Fee

```env
SPONSOR_FEE_MODEL=flat
SPONSOR_FLAT_FEE=0.01  # $0.003
```

**ROI:** 10x per payment

#### 2. Percentage Fee

```env
SPONSOR_FEE_MODEL=percentage
SPONSOR_PERCENTAGE_FEE=1  # 1%
```

**Example:**
- 100 HBAR transfer = 1 HBAR fee ($0.30)
- Cost: $0.0003
- **ROI: 1000x**

#### 3. Hybrid (Coming Soon)

- Free for < 10 HBAR
- 0.5% for 10-100 HBAR
- 0.25% for 100+ HBAR

### Profitability Calculator

**Daily Volume:** 100 payments of 10 HBAR each

**Costs:**
- Network fees: 100 × $0.0003 = $0.03

**Revenue (1% fee):**
- Service fees: 100 × 0.1 HBAR = 10 HBAR ($3)

**Daily Profit:** $2.97

**Monthly Profit:** ~$89

## 🔒 Security Best Practices

### For Users

1. **Never share private keys** - Only sign locally
2. **Set max fees** - Protect against high fees
3. **Check expiration** - Don't leave requests open forever
4. **Verify recipients** - Double-check account IDs

### For Sponsors

1. **Monitor balance** - Set `SPONSOR_MIN_BALANCE`
2. **Rate limiting** - Use `SPONSOR_MAX_BATCH`
3. **Fee validation** - Verify signed transactions
4. **Error handling** - Log failed relays

## 🐛 Troubleshooting

### "P2P_GASLESS_TOPIC_ID not set"

**Fix:** Create topic and set in `.env`:
```bash
P2P_GASLESS_TOPIC_ID=0.0.12345
```

### "Insufficient sponsor balance"

**Fix:** Fund sponsor account:
```bash
# Go to https://portal.hedera.com/faucet
# Request testnet HBAR
```

### "No gasless payments found"

**Reasons:**
1. No users have created requests yet
2. Wrong topic ID
3. Mirrornode delay (wait 5-10 seconds)

**Fix:** Run user example first to create requests

### "Private key is required"

**Fix:** Ensure private key is set:
```env
PRIVATE_KEY=0x302e020100300506032b657004220420...
```

## 📊 Monitoring & Analytics

### Sponsor Dashboard (Coming Soon)

Track:
- Total volume relayed
- Fees earned vs paid
- Success rate
- Average relay time
- Top users

### User Dashboard (Coming Soon)

Track:
- Payments sent
- Fees saved
- Average confirmation time
- Favorite sponsors

## 🚀 Production Deployment

### Requirements

1. **Mainnet accounts** with real HBAR
2. **Reliable infrastructure** (AWS, GCP, etc.)
3. **Monitoring** (DataDog, CloudWatch)
4. **Backup sponsors** for redundancy

### Deployment Checklist

- [ ] Create production HCS topic
- [ ] Fund sponsor account (1000+ HBAR recommended)
- [ ] Set up monitoring/alerts
- [ ] Configure rate limiting
- [ ] Test failure scenarios
- [ ] Set up automatic restarts
- [ ] Configure fee model
- [ ] Enable logging

## 🤝 Support

**Issues?** Open an issue:
https://github.com/hedera-dev/hedera-agent-kit/issues

**Questions?** Join Discord:
https://discord.gg/hedera

## 📖 Learn More

- [Plugin README](../../src/plugins/p2p-plugin/README.md)
- [Hedera Documentation](https://docs.hedera.com)
- [Meta-Transactions Guide](https://hedera.com/blog/meta-transactions)

---

**Happy Gasless Trading! 🎉**

Start earning by being a sponsor, or save fees by sending gasless payments!
