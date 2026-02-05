import axios from "axios";
import { Contract, JsonRpcProvider, Wallet } from "ethers";
import process from "node:process";
import { OrderRequest, OrderResult } from "../../types/index.js";

type TokenInfo = { address: string; decimals: number };

export class ZeroXAdapter {
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  private chainId: number;
  private tokenMap: Record<string, TokenInfo>;

  constructor(chainId: number, rpcUrl: string, tokenMap: Record<string, TokenInfo>) {
    const pk = process.env.ARB_EVM_PRIVATE_KEY;
    if (!pk) throw new Error("ARB_EVM_PRIVATE_KEY not set");
    this.provider = new JsonRpcProvider(rpcUrl, chainId);
    this.wallet = new Wallet(pk, this.provider);
    this.chainId = chainId;
    this.tokenMap = tokenMap;
  }

  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    const sellToken = this.tokenMap[order.side === "buy" ? order.quote : order.base];
    const buyToken = this.tokenMap[order.side === "buy" ? order.base : order.quote];
    if (!sellToken || !buyToken) {
      return {
        orderId: `0x-${Date.now()}`,
        status: "failed",
        filledSize: 0,
        error: "token map missing for pair"
      };
    }
    const sizeIn = order.side === "buy"
      ? order.size * (order.limitPrice ?? 0)
      : order.size;
    const sellAmount = Math.floor(sizeIn * 10 ** sellToken.decimals).toString();
    const apiBase = process.env.ARB_0X_BASE_URL ?? "https://api.0x.org";
    const res = await axios.get(`${apiBase}/swap/v1/quote`, {
      params: {
        chainId: this.chainId,
        sellToken: sellToken.address,
        buyToken: buyToken.address,
        sellAmount,
        takerAddress: this.wallet.address,
        slippagePercentage: (Number(process.env.ARB_MAX_SLIPPAGE_PCT ?? "0.005")).toString()
      },
      timeout: 8000
    });
    if (res.data.allowanceTarget) {
      await this.ensureAllowance(
        sellToken.address,
        res.data.allowanceTarget as string,
        BigInt(sellAmount)
      );
    }
    const tx = {
      to: res.data.to as string,
      data: res.data.data as string,
      value: BigInt(res.data.value ?? "0"),
      gas: BigInt(res.data.gas ?? "0"),
      gasPrice: BigInt(res.data.gasPrice ?? "0")
    };
    const sent = await this.wallet.sendTransaction(tx);
    const receipt = await sent.wait();
    return {
      orderId: sent.hash,
      status: receipt?.status === 1 ? "filled" : "failed",
      filledSize: order.size,
      avgPrice: order.limitPrice,
      txHash: sent.hash,
      error: receipt?.status === 1 ? undefined : "tx failed"
    };
  }

  private async ensureAllowance(
    tokenAddress: string,
    spender: string,
    amount: bigint
  ): Promise<void> {
    if (isNativeToken(tokenAddress)) return;
    const erc20 = new Contract(
      tokenAddress,
      ["function allowance(address owner,address spender) view returns (uint256)", "function approve(address spender,uint256 amount) returns (bool)"],
      this.wallet
    );
    const current = (await erc20.allowance(
      this.wallet.address,
      spender
    )) as bigint;
    if (current >= amount) return;
    const tx = await erc20.approve(spender, amount);
    await tx.wait();
  }
}

function isNativeToken(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
    normalized === "0x0000000000000000000000000000000000000000"
  );
}
