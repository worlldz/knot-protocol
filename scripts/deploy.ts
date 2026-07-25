import { network } from "hardhat";
import { isAddress } from "viem";

const ARC_USDC = "0x3600000000000000000000000000000000000000";
const verifierAddress = process.env.KNOT_VERIFIER_ADDRESS;
const paymentToken = process.env.ARC_USDC_ADDRESS ?? ARC_USDC;

if (!isAddress(paymentToken)) {
  throw new Error("ARC_USDC_ADDRESS must be a valid token address.");
}

const { viem, networkName } = await network.connect();
const [deployer] = await viem.getWalletClients();
const verifier = verifierAddress && isAddress(verifierAddress)
  ? verifierAddress
  : deployer.account.address;

const commerce = await viem.deployContract(
  "KnotCommerce",
  [paymentToken, deployer.account.address],
);
const hook = await viem.deployContract(
  "KnotVerificationHook",
  [commerce.address, deployer.account.address, verifier],
);
await commerce.write.setHookAllowed([hook.address, true]);

console.log(JSON.stringify({
  network: networkName,
  chainId: 5_042_002,
  commerce: {
    contract: "KnotCommerce",
    address: commerce.address,
    paymentToken,
  },
  hook: {
    contract: "KnotVerificationHook",
    address: hook.address,
    commerceProtocol: commerce.address,
    verifier,
  },
  admin: deployer.account.address,
}, null, 2));
