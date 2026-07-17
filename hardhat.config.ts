import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: { version: "0.8.28" },
      production: {
        version: "0.8.28",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    },
  },
  networks: {
    hardhatMainnet: { type: "edr-simulated", chainType: "l1" },
    arcTestnet: {
      type: "http",
      chainType: "l1",
      chainId: 5_042_002,
      url: process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network",
      accounts: process.env.ARC_DEPLOYER_PRIVATE_KEY
        ? [process.env.ARC_DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
});
