import { Contract, JsonRpcProvider, Wallet } from "ethers";
import process from "node:process";
import { OrderRequest, OrderResult } from "../../types/index.js";

type TokenInfo = { address: string; decimals: number };

const swapRouterAbi = [
  "function exactInputSingle(tuple(address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)"
];

export class UniswapAdapter {
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  private tokenMap: Record<string, TokenInfo>;
  private router: Contract;
  private poolFee: number;

  constructor(rpcUrl: string, tokenMap: Record<string, TokenInfo>) {
    const pk = process.env.ARB_EVM_PRIVATE_KEY;
    if (!pk) throw new Error("ARB_EVM_PRIVATE_KEY not set");
    this.provider = new JsonRpcProvider(rpcUrl);
    this.wallet = new Wallet(pk, this.provider);
    this.tokenMap = tokenMap;
    const routerAddress =
      process.env.ARB_UNISWAP_ROUTER ??
      "0xE592427A0AEce92De3Edee1F18E0157C05861564";
    this.router = new Contract(routerAddress, swapRouterAbi, this.wallet);
    this.poolFee = Number(process.env.ARB_UNISWAP_POOL_FEE ?? "3000");
  }

  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    const tokenIn =
      order.side === "buy" ? this.tokenMap[order.quote] : this.tokenMap[order.base];
    const tokenOut =
      order.side === "buy" ? this.tokenMap[order.base] : this.tokenMap[order.quote];
    if (!tokenIn || !tokenOut) {
      return {
        orderId: `uniswap-${Date.now()}`,
        status: "failed",
        filledSize: 0,
        error: "token map missing for pair"
      };
    }
    const sizeIn = order.side === "buy"
      ? order.size * (order.limitPrice ?? 0)
      : order.size;
    const amountIn = BigInt(Math.floor(sizeIn * 10 ** tokenIn.decimals));
    const slippageBps = Number(process.env.ARB_MAX_SLIPPAGE_BPS ?? "50");
    const expectedOut = order.side === "buy"
      ? order.size
      : order.size * (order.limitPrice ?? 0);
    const minOut = BigInt(
      Math.floor(
        expectedOut * (1 - slippageBps / 10000) * 10 ** tokenOut.decimals
      )
    );
    const params = {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      fee: this.poolFee,
      recipient: this.wallet.address,
      deadline: Math.floor(Date.now() / 1000) + 60,
      amountIn,
      amountOutMinimum: minOut,
      sqrtPriceLimitX96: 0
    };
    await this.ensureAllowance(tokenIn.address, this.router.target as string, amountIn);
    const tx = await this.router.exactInputSingle(params);
    const receipt = await tx.wait();
    return {
      orderId: tx.hash,
      status: receipt?.status === 1 ? "filled" : "failed",
      filledSize: order.size,
      avgPrice: order.limitPrice,
      txHash: tx.hash,
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
