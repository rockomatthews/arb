import { AppConfig } from "../config/index.js";
import { ZeroXAdapter } from "./adapters/zeroXAdapter.js";
import { UniswapAdapter } from "./adapters/uniswapAdapter.js";
import { JupiterAdapter } from "./adapters/jupiterAdapter.js";
import { HyperliquidAdapter } from "./adapters/hyperliquidAdapter.js";

export type AdapterMap = Record<string, unknown>;

type TokenMap = Record<string, Record<string, { address: string; decimals: number }>>;
type SolanaTokenMap = Record<string, { mint: string; decimals: number }>;

export function buildAdapterMap(config: AppConfig): AdapterMap {
  const map: AdapterMap = {};
  if (config.evm.enabled) {
    const tokenMap = loadEvmTokenMap();
    const chainId = Number(process.env.ARB_EVM_CHAIN_ID ?? "42161");
    const rpcUrl =
      config.evm.rpcUrls[String(chainId)] ??
      process.env.ARB_EVM_RPC_URL ??
      "";
    if (rpcUrl) {
      map["0x"] = new ZeroXAdapter(chainId, rpcUrl, tokenMap[String(chainId)] ?? {});
      map["uniswap"] = new UniswapAdapter(rpcUrl, tokenMap[String(chainId)] ?? {});
    }
  }
  if (config.solana.enabled && config.solana.rpcUrl) {
    const tokenMap = loadSolanaTokenMap();
    map["jupiter"] = new JupiterAdapter(config.solana.rpcUrl, tokenMap);
  }
  if (config.hyperliquid.enabled) {
    map["hyperliquid"] = new HyperliquidAdapter({
      apiUrl: config.hyperliquid.apiUrl,
      coins: config.hyperliquid.coins
    });
  }
  return map;
}

function loadEvmTokenMap(): TokenMap {
  const raw = process.env.ARB_EVM_TOKEN_MAP;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as TokenMap;
  } catch {
    return {};
  }
}

function loadSolanaTokenMap(): SolanaTokenMap {
  const raw = process.env.ARB_SOLANA_TOKEN_MAP;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as SolanaTokenMap;
  } catch {
    return {};
  }
}
