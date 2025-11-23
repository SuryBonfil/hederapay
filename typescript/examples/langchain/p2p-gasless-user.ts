/**
 * P2P Gasless Payment - User Example
 *
 * This example shows how to send HBAR, tokens, and NFTs WITHOUT paying gas fees.
 * A sponsor (relayer) will pay the fees on your behalf.
 *
 * Prerequisites:
 * 1. User account with assets to send (but NO HBAR for fees needed!)
 * 2. P2P_GASLESS_TOPIC_ID environment variable set
 * 3. A running sponsor/relayer (see p2p-gasless-sponsor.ts)
 */

import dotenv from 'dotenv';
dotenv.config();

import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { Client, PrivateKey } from '@hashgraph/sdk';
import { HederaLangchainToolkit, p2pPlugin } from 'hedera-agent-kit';
import { ChatOpenAI } from '@langchain/openai';
import { HederaMirrornodeServiceDefaultImpl } from 'hedera-agent-kit';

async function main() {
  console.log('🚀 P2P Gasless Payment - User Demo\n');
  console.log('=' .repeat(60));
  console.log('Send payments WITHOUT paying gas fees!');
  console.log('=' .repeat(60) + '\n');

  // Validate environment
  if (!process.env.P2P_GASLESS_TOPIC_ID) {
    console.error('❌ Error: P2P_GASLESS_TOPIC_ID not set in environment');
    console.log('\nPlease set it in your .env file:');
    console.log('P2P_GASLESS_TOPIC_ID=0.0.YOUR_TOPIC_ID\n');
    process.exit(1);
  }

  // Initialize OpenAI LLM
  const llm = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0,
  });

  // Setup Hedera client (user doesn't need HBAR for fees!)
  const client = Client.forTestnet().setOperator(
    process.env.ACCOUNT_ID!,
    PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!),
  );

  console.log(`👤 User Account: ${process.env.ACCOUNT_ID}`);
  console.log(`📋 Topic ID: ${process.env.P2P_GASLESS_TOPIC_ID}\n`);

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
      `You are a helpful assistant for gasless P2P payments on Hedera.

You help users send HBAR, tokens, and NFTs WITHOUT paying any transaction fees.
The payment flow is:
1. User creates a payment request (create_gasless_payment_tool)
2. User signs it off-chain (sign_gasless_payment_tool)
3. A sponsor relays and pays the fees

Always explain to users that:
- They pay $0 in fees
- A sponsor will execute the transaction
- The process takes a few seconds

Be encouraging and explain the gasless benefits!`,
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

  // Example 1: Send HBAR gasless
  console.log('\n' + '='.repeat(60));
  console.log('📤 Example 1: Send 10 HBAR (Gasless)');
  console.log('='.repeat(60) + '\n');

  const example1 = await agentExecutor.invoke({
    input: `Send 10 HBAR to account ${process.env.RECIPIENT_ACCOUNT_ID || '0.0.12345'} without paying any fees.
    Add a memo saying "Test gasless payment".`,
  });
  console.log('\n✅ Response:', example1.output);

  // Example 2: Query your pending payments
  console.log('\n' + '='.repeat(60));
  console.log('📊 Example 2: Check Payment Status');
  console.log('='.repeat(60) + '\n');

  const example2 = await agentExecutor.invoke({
    input: `Show me my recent gasless payment requests from the topic.
    Filter by my account as sender.`,
  });
  console.log('\n✅ Response:', example2.output);

  // Example 3: Send tokens gasless (if you have a token)
  if (process.env.TOKEN_ID) {
    console.log('\n' + '='.repeat(60));
    console.log('🪙 Example 3: Send Tokens (Gasless)');
    console.log('='.repeat(60) + '\n');

    const example3 = await agentExecutor.invoke({
      input: `Send 100 tokens of ${process.env.TOKEN_ID} to account ${process.env.RECIPIENT_ACCOUNT_ID || '0.0.12345'} without paying fees.`,
    });
    console.log('\n✅ Response:', example3.output);
  }

  // Interactive mode
  console.log('\n' + '='.repeat(60));
  console.log('💬 Interactive Mode - Try it yourself!');
  console.log('='.repeat(60));
  console.log('\nType your requests or "exit" to quit.');
  console.log('\nExamples:');
  console.log('  - "Send 5 HBAR to 0.0.12345 without paying fees"');
  console.log('  - "Show my pending gasless payments"');
  console.log('  - "Check status of my last payment"\n');

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    rl.question('You: ', async (input: string) => {
      if (input.toLowerCase() === 'exit') {
        console.log('\n👋 Goodbye! Your gasless payments are being processed by sponsors.\n');
        rl.close();
        process.exit(0);
      }

      if (!input.trim()) {
        askQuestion();
        return;
      }

      try {
        const response = await agentExecutor.invoke({ input });
        console.log(`\n🤖 Assistant: ${response.output}\n`);
      } catch (error) {
        console.error('\n❌ Error:', error instanceof Error ? error.message : error);
      }

      askQuestion();
    });
  };

  askQuestion();
}

main().catch((error) => {
  console.error('\n❌ Fatal Error:', error);
  process.exit(1);
});
