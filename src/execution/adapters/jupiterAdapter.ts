import axios from "axios";
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import process from "node:process";
import { OrderRequest, OrderResult } from "../../types/index.js";

type TokenInfo = { mint: string; decimals: number };

export class JupiterAdapter {
  private connection: Connection;
  private keypair: Keypair;
  private tokenMap: Record<string, TokenInfo>;

  constructor(rpcUrl: string, tokenMap: Record<string, TokenInfo>) {
    this.connection = new Connection(rpcUrl, "confirmed");
    const raw = process.env.ARB_SOLANA_PRIVATE_KEY;
    if (!raw) throw new Error("ARB_SOLANA_PRIVATE_KEY not set");
    const secret = Uint8Array.from(JSON.parse(raw) as number[]);
    this.keypair = Keypair.fromSecretKey(secret);
    this.tokenMap = tokenMap;
  }

  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    const input =
      order.side === "buy" ? this.tokenMap[order.quote] : this.tokenMap[order.base];
    const output =
      order.side === "buy" ? this.tokenMap[order.base] : this.tokenMap[order.quote];
    if (!input || !output) {
      return {
        orderId: `jupiter-${Date.now()}`,
        status: "failed",
        filledSize: 0,
        error: "token map missing for pair"
      };
    }
    const sizeIn = order.side === "buy"
      ? order.size * (order.limitPrice ?? 0)
      : order.size;
    const amount = Math.floor(sizeIn * 10 ** input.decimals);
    const quoteRes = await axios.get("https://quote-api.jup.ag/v6/quote", {
      params: {
        inputMint: input.mint,
        outputMint: output.mint,
        amount,
        slippageBps: Number(process.env.ARB_MAX_SLIPPAGE_BPS ?? "50")
      },
      timeout: 8000
    });
    const swapRes = await axios.post(
      "https://quote-api.jup.ag/v6/swap",
      {
        quoteResponse: quoteRes.data,
        userPublicKey: this.keypair.publicKey.toBase58()
      },
      { timeout: 8000 }
    );
    const swapTx = swapRes.data.swapTransaction as string;
    const tx = VersionedTransaction.deserialize(
      Buffer.from(swapTx, "base64")
    );
    tx.sign([this.keypair]);
    const sig = await this.connection.sendTransaction(tx);
    const confirmation = await this.connection.confirmTransaction(sig, "confirmed");
    return {
      orderId: sig,
      status: confirmation.value.err ? "failed" : "filled",
      filledSize: order.size,
      avgPrice: order.limitPrice,
      txHash: sig,
      error: confirmation.value.err ? "tx failed" : undefined
    };
  }
}
