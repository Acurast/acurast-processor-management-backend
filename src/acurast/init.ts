import 'dotenv/config';
import { ApiPromise, WsProvider } from '@polkadot/api';

if (!process.env.RPC_URL) {
  throw new Error('RPC_URL is not set');
}

const WS_PROVIDERS: string[] = [process.env.RPC_URL];

console.log(`[API] 🔄 Initializing API`, WS_PROVIDERS);
// Initialise the provider to connect to the local node
const provider = new WsProvider(WS_PROVIDERS);

// Add connection status logging
provider.on('connected', () => {
  console.log(`[API] ✅ Connected to WebSocket endpoints:`, provider.endpoint);
});

provider.on('disconnected', () => {
  console.log(
    `[API] ❌ Disconnected from WebSocket endpoints:`,
    provider.endpoint,
  );
});

provider.on('error', (error) => {
  console.error(
    `[API] ⚠️ WebSocket connection error ${provider.endpoint}:`,
    error,
  );
});

// Create the API and wait until ready
const api = ApiPromise.create({ provider, noInitWarn: true });

export const getApi = (): Promise<ApiPromise> => {
  return api;
};

export const getProvider = (): WsProvider => {
  return provider;
};

export const apiWithBlockHash = async (
  blockHash?: string,
): Promise<ApiPromise> => {
  if (!blockHash) {
    return api;
  }

  return (await api).at(blockHash) as any;
};

const logEndpoint = async () => {
  await provider.isReady;
  console.log('[API] 🌐 Connected to endpoint', provider.endpoint);
};

void logEndpoint();
