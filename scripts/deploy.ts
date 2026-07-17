import { network } from "hardhat";
import { isAddress } from "viem";

const acpAddress = process.env.KNOT_ACP_ADDRESS;
const verifierAddress = process.env.KNOT_VERIFIER_ADDRESS;

if (!acpAddress || !isAddress(acpAddress)) {
  throw new Error("KNOT_ACP_ADDRESS must be a valid ERC-8183 contract address.");
}

const { viem, networkName } = await network.connect();
const [deployer] = await viem.getWalletClients();
const verifier = verifierAddress && isAddress(verifierAddress)
  ? verifierAddress
  : deployer.account.address;

const hook = await viem.deployContract(
  "KnotVerificationHook",
  [acpAddress, deployer.account.address, verifier],
);

console.log(JSON.stringify({
  network: networkName,
  contract: "KnotVerificationHook",
  address: hook.address,
  commerceProtocol: acpAddress,
  admin: deployer.account.address,
  verifier,
}, null, 2));
