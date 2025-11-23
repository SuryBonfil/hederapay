import { Context } from '@/shared';
import { Plugin } from '@/shared/plugin';

// Gasless payment tools
import createGaslessPaymentTool, {
  CREATE_GASLESS_PAYMENT_TOOL,
} from './tools/create-gasless-payment';
import signGaslessPaymentTool, {
  SIGN_GASLESS_PAYMENT_TOOL,
} from './tools/sign-gasless-payment';
import relayGaslessPaymentTool, {
  RELAY_GASLESS_PAYMENT_TOOL,
} from './tools/relay-gasless-payment';
import queryGaslessPaymentsTool, {
  QUERY_GASLESS_PAYMENTS_TOOL,
} from './tools/query-gasless-payments';

export const p2pPlugin: Plugin = {
  name: 'p2p-plugin',
  version: '2.0.0',
  description:
    'A plugin for peer-to-peer (P2P) gasless payments on Hedera. ' +
    'Enables users to send HBAR, tokens, and NFTs without paying transaction fees. ' +
    'Uses meta-transactions and relayer/sponsor model where sponsors pay gas fees on behalf of users. ' +
    'Built on Hedera Consensus Service (HCS) for coordination.',
  tools: (context: Context) => {
    return [
      createGaslessPaymentTool(context),
      signGaslessPaymentTool(context),
      relayGaslessPaymentTool(context),
      queryGaslessPaymentsTool(context),
    ];
  },
};

export const p2pPluginToolNames = {
  CREATE_GASLESS_PAYMENT_TOOL,
  SIGN_GASLESS_PAYMENT_TOOL,
  RELAY_GASLESS_PAYMENT_TOOL,
  QUERY_GASLESS_PAYMENTS_TOOL,
} as const;

export default { p2pPlugin, p2pPluginToolNames };
