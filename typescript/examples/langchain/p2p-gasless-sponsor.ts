/**
 * P2P Gasless Payment - Sponsor/Relayer Example
 *
 * This example shows how to run a sponsor bot that:
 * 1. Monitors for signed gasless payment requests
 * 2. Relays (executes) them on behalf of users
 * 3. Pays the gas fees
 * 4. Optionally charges a service fee
 *
 * Prerequisites:
 * 1. Sponsor account with sufficient HBAR balance (recommended: 100+ HBAR)
 * 2. P2P_GASLESS_TOPIC_ID environment variable set
 * 3. Configure your fee model
 */

import dotenv from 'dotenv';
dotenv.config();

import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { Client, PrivateKey, AccountBalanceQuery } from '@hashgraph/sdk';
import { HederaLangchainToolkit, p2pPlugin } from 'hedera-agent-kit';
import { ChatOpenAI } from '@langchain/openai';
import { HederaMirrornodeServiceDefaultImpl } from 'hedera-agent-kit';

// Sponsor configuration
const SPONSOR_CONFIG = {
  // Fee model (choose one)
  feeModel: process.env.SPONSOR_FEE_MODEL || 'percentage', // 'flat' or 'percentage'

  // Flat fee (in HBAR)
  flatFee: parseFloat(process.env.SPONSOR_FLAT_FEE || '0.01'), // 0.01 HBAR

  // Percentage fee (1 = 1%)
  percentageFee: parseFloat(process.env.SPONSOR_PERCENTAGE_FEE || '1'), // 1%

  // Minimum balance to keep operating
  minBalance: parseFloat(process.env.SPONSOR_MIN_BALANCE || '10'), // 10 HBAR

  // Poll interval (milliseconds)
  pollInterval: parseInt(process.env.SPONSOR_POLL_INTERVAL || '5000'), // 5 seconds

  // Max payments to relay per batch
  maxBatchSize: parseInt(process.env.SPONSOR_MAX_BATCH || '5'), // 5 payments
};

async function main() {
  console.log('🤖 P2P Gasless Payment - Sponsor/Relayer Bot\n');
  console.log('=' .repeat(60));
  console.log('Earn fees by relaying gasless payments!');
  console.log('=' .repeat(60) + '\n');

  // Validate environment
  if (!process.env.P2P_GASLESS_TOPIC_ID) {
    console.error('❌ Error: P2P_GASLESS_TOPIC_ID not set');
    process.exit(1);
  }

  if (!process.env.SPONSOR_ACCOUNT_ID || !process.env.SPONSOR_PRIVATE_KEY) {
    console.error('❌ Error: SPONSOR_ACCOUNT_ID and SPONSOR_PRIVATE_KEY required');
    console.log('\nSet these in your .env file:');
    console.log('SPONSOR_ACCOUNT_ID=0.0.YOUR_SPONSOR_ACCOUNT');
    console.log('SPONSOR_PRIVATE_KEY=0x...\n');
    process.exit(1);
  }

  // Initialize OpenAI LLM
  const llm = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0,
  });

  // Setup Hedera client (sponsor pays fees)
  const client = Client.forTestnet().setOperator(
    process.env.SPONSOR_ACCOUNT_ID!,
    PrivateKey.fromStringECDSA(process.env.SPONSOR_PRIVATE_KEY!),
  );

  // Check sponsor balance
  const balance = await new AccountBalanceQuery()
    .setAccountId(process.env.SPONSOR_ACCOUNT_ID!)
    .execute(client);

  console.log('💰 Sponsor Configuration');
  console.log(`   Account: ${process.env.SPONSOR_ACCOUNT_ID}`);
  console.log(`   Balance: ${balance.hbars.toString()}`);
  console.log(`   Min Balance: ${SPONSOR_CONFIG.minBalance} HBAR`);
  console.log(`   Fee Model: ${SPONSOR_CONFIG.feeModel}`);

  if (SPONSOR_CONFIG.feeModel === 'flat') {
    console.log(`   Flat Fee: ${SPONSOR_CONFIG.flatFee} HBAR per payment`);
  } else {
    console.log(`   Percentage Fee: ${SPONSOR_CONFIG.percentageFee}%`);
  }

  console.log(`   Poll Interval: ${SPONSOR_CONFIG.pollInterval}ms`);
  console.log(`   Topic ID: ${process.env.P2P_GASLESS_TOPIC_ID}\n`);

  if (balance.hbars.toTinybars().toNumber() < SPONSOR_CONFIG.minBalance * 100_000_000) {
    console.error(`❌ Error: Insufficient balance. Need at least ${SPONSOR_CONFIG.minBalance} HBAR`);
    process.exit(1);
  }

  // Initialize the Hedera Agent Toolkit with P2P plugin
  const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      plugins: [p2pPlugin],
      context: {
        p2pTopicId: process.env.P2P_GASLESS_TOPIC_ID,
        mirrornodeService: new HederaMirrornodeServiceDefaultImpl(),
      },
    },
  });

  // Create chat prompt
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `You are an automated sponsor bot for gasless P2P payments.

Your job is to:
1. Monitor for signed payment requests (status: "signed")
2. Relay them (execute and pay fees)
3. Charge service fees based on configuration

Fee Model: ${SPONSOR_CONFIG.feeModel}
${SPONSOR_CONFIG.feeModel === 'flat'
  ? `Flat Fee: ${SPONSOR_CONFIG.flatFee} HBAR per payment`
  : `Percentage Fee: ${SPONSOR_CONFIG.percentageFee}% of transfer amount`
}

Always:
- Check you have sufficient balance before relaying
- Calculate and charge appropriate fees
- Report relay results clearly`,
    ],
    ['placeholder', '{chat_history}'],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);

  // Get tools from toolkit
  const tools = hederaAgentToolkit.getTools();

  // Create the agent
  const agent = createToolCallingAgent({
    llm,
    tools,
    prompt,
  });

  // Create agent executor
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });

  // Statistics tracking
  const stats = {
    totalRelayed: 0,
    totalFeesPaid: 0,
    totalFeesEarned: 0,
    totalVolume: 0,
    errors: 0,
  };

  // Calculate fee based on model
  function calculateFee(amount: number): number {
    if (SPONSOR_CONFIG.feeModel === 'flat') {
      return SPONSOR_CONFIG.flatFee;
    } else {
      return (amount * SPONSOR_CONFIG.percentageFee) / 100;
    }
  }

  // Main relay loop
  async function relayLoop() {
    console.log('\n🔄 Checking for signed payments to relay...\n');

    try {
      // Query for signed payments
      const response = await agentExecutor.invoke({
        input: `Query gasless payments from topic ${process.env.P2P_GASLESS_TOPIC_ID}
        with status "signed" and limit ${SPONSOR_CONFIG.maxBatchSize}.
        Show me the details.`,
      });

      console.log(response.output);

      // Check if there are payments to relay
      if (response.output.includes('No gasless payments found')) {
        console.log('⏳ No pending payments. Waiting...\n');
        return;
      }

      // In a real implementation, parse the response and relay each payment
      // For this demo, we'll relay using a direct command
      console.log('\n💸 Attempting to relay payments...');

      const relayResponse = await agentExecutor.invoke({
        input: `Find the first signed payment and relay it with a sponsor fee of ${calculateFee(10)} HBAR.
        If successful, update statistics.`,
      });

      console.log('\n✅ Relay Result:', relayResponse.output);

      // Update stats (in production, parse actual values)
      stats.totalRelayed++;
      stats.totalFeesPaid += 0.0002; // Approximate network fee
      stats.totalFeesEarned += calculateFee(10);
      stats.totalVolume += 10;

      // Show statistics
      console.log('\n📊 Session Statistics:');
      console.log(`   Payments Relayed: ${stats.totalRelayed}`);
      console.log(`   Network Fees Paid: ${stats.totalFeesPaid.toFixed(4)} HBAR`);
      console.log(`   Service Fees Earned: ${stats.totalFeesEarned.toFixed(4)} HBAR`);
      console.log(`   Total Volume: ${stats.totalVolume} HBAR`);
      console.log(`   Net Profit: ${(stats.totalFeesEarned - stats.totalFeesPaid).toFixed(4)} HBAR`);
      console.log(`   Errors: ${stats.errors}\n`);

    } catch (error) {
      console.error('\n❌ Relay Error:', error instanceof Error ? error.message : error);
      stats.errors++;
    }
  }

  // Show initial status
  console.log('✅ Sponsor bot initialized and running!\n');
  console.log('📡 Monitoring for gasless payment requests...');
  console.log('💡 Press Ctrl+C to stop\n');

  // Manual mode - relay specific payment
  if (process.env.MANUAL_MODE === 'true') {
    console.log('🔧 Running in MANUAL mode');
    console.log('Use the interactive prompt to relay payments manually\n');

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const askQuestion = () => {
      rl.question('Sponsor> ', async (input: string) => {
        if (input.toLowerCase() === 'exit') {
          console.log('\n👋 Stopping sponsor bot...\n');
          console.log('Final Statistics:');
          console.log(`   Total Relayed: ${stats.totalRelayed}`);
          console.log(`   Net Profit: ${(stats.totalFeesEarned - stats.totalFeesPaid).toFixed(4)} HBAR\n`);
          rl.close();
          process.exit(0);
        }

        if (input.toLowerCase() === 'stats') {
          console.log('\n📊 Current Statistics:');
          console.log(`   Payments Relayed: ${stats.totalRelayed}`);
          console.log(`   Network Fees Paid: ${stats.totalFeesPaid.toFixed(4)} HBAR`);
          console.log(`   Service Fees Earned: ${stats.totalFeesEarned.toFixed(4)} HBAR`);
          console.log(`   Net Profit: ${(stats.totalFeesEarned - stats.totalFeesPaid).toFixed(4)} HBAR\n`);
          askQuestion();
          return;
        }

        if (!input.trim()) {
          askQuestion();
          return;
        }

        try {
          const response = await agentExecutor.invoke({ input });
          console.log(`\n🤖 Bot: ${response.output}\n`);
        } catch (error) {
          console.error('\n❌ Error:', error instanceof Error ? error.message : error);
          stats.errors++;
        }

        askQuestion();
      });
    };

    console.log('Commands:');
    console.log('  - "stats" - Show statistics');
    console.log('  - "exit" - Stop bot');
    console.log('  - Or ask the bot to relay payments\n');

    askQuestion();
  } else {
    // Auto mode - relay automatically
    console.log('🤖 Running in AUTO mode (relaying automatically)\n');

    // Initial relay check
    await relayLoop();

    // Set up polling interval
    const intervalId = setInterval(async () => {
      // Check balance
      const currentBalance = await new AccountBalanceQuery()
        .setAccountId(process.env.SPONSOR_ACCOUNT_ID!)
        .execute(client);

      const balanceHbar = currentBalance.hbars.toTinybars().toNumber() / 100_000_000;

      if (balanceHbar < SPONSOR_CONFIG.minBalance) {
        console.error(`\n❌ Low balance warning: ${balanceHbar} HBAR`);
        console.log(`   Minimum required: ${SPONSOR_CONFIG.minBalance} HBAR`);
        console.log('   Please fund sponsor account!\n');
        clearInterval(intervalId);
        process.exit(1);
      }

      await relayLoop();
    }, SPONSOR_CONFIG.pollInterval);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Shutting down sponsor bot...\n');
      clearInterval(intervalId);

      console.log('📊 Final Statistics:');
      console.log(`   Total Relayed: ${stats.totalRelayed}`);
      console.log(`   Network Fees Paid: ${stats.totalFeesPaid.toFixed(4)} HBAR`);
      console.log(`   Service Fees Earned: ${stats.totalFeesEarned.toFixed(4)} HBAR`);
      console.log(`   Net Profit: ${(stats.totalFeesEarned - stats.totalFeesPaid).toFixed(4)} HBAR`);
      console.log(`   Errors: ${stats.errors}\n`);

      process.exit(0);
    });
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal Error:', error);
  process.exit(1);
});
