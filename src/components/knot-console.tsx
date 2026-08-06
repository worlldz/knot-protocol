"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAddress } from "viem";
import {
  ARC_PAYMENT_ASSETS,
  ARC_TESTNET,
  createArcTokenTransfer,
  formatArcBalance,
  getInjectedProvider,
  parseArcPaymentAmount,
  parseChainId,
  readArcTokenBalance,
  requestDifferentAccount,
  shortAddress,
  type ArcPaymentAssetId,
} from "@/lib/arc-network";
import { createAgentAuthorizationMessage, isAgentAuthorizationFresh } from "@/lib/knot/agent-auth";
import { JOB_TYPES, POLICY_PRESETS } from "@/lib/knot/catalog";
import type { ExecutionQuote } from "@/lib/knot/quote";
import type { ReceiptVerification } from "@/lib/knot/receipt-verifier";
import type {
  Execution,
  ExecutionEvent,
  JobType,
  PolicyPreset,
  ProviderAttempt,
  VerificationCheck,
} from "@/lib/knot/schemas";

type SystemStatus = {
  mode: "local" | "live";
  deployment: {
    commerce: string;
    hook: string;
    explorerUrl: string;
    verified: boolean;
  };
  latestProof: {
    status: string;
    jobId: string;
    executionId: string;
    evidenceHash: string;
    attestationExplorerUrl: string;
    completionExplorerUrl: string;
  };
  services: {
    verificationEngine: string;
    x402Buyer: string;
    x402Seller: string;
    circleAgent: string;
    settlementHook: string;
    evidenceAttester: string;
    durableReceipts: string;
    protocolApi: string;
  };
};

type View = "console" | "receipts" | "payment" | "explore";
type Theme = "light" | "dark";
type SettlementMode = "preview" | "live";
type PaymentState = { kind: "idle" | "pending" | "success" | "error"; message: string; hash?: string };
type QuoteState = {
  status: "idle" | "loading" | "ready" | "error";
  key?: string;
  quote?: ExecutionQuote;
  error?: string;
};
type PlaygroundEndpoint = "discovery" | "openapi" | "submission" | "launch" | "marketplace" | "manifest" | "status" | "quote" | "execution";
type PlaygroundResponse = {
  status: "idle" | "loading" | "success" | "error";
  httpStatus?: number;
  latencyMs?: number;
  receiptId?: string;
  body: string;
};
type AgentWallet = { id: string; address: string; owner: string; accountType: string; blockchain: "ARC-TESTNET"; balanceUsdc: string; gatewayBalanceUsdc: string };
type AgentWalletState = {
  wallet: AgentWallet | null;
  busy: boolean;
  funding: boolean;
  error: string | null;
  fundHash: string | null;
  activate: () => Promise<AgentWallet | null>;
  getAuthorization: () => { owner: string; issuedAt: string; signature: string } | null;
  fund: (target?: AgentWallet) => Promise<boolean>;
  refresh: () => Promise<AgentWallet | null>;
};

const proofLabels = ["Price ceiling", "Response latency", "Data freshness", "Required schema", "Provider signature"];
const demoSubject = "0x0000000000000000000000000000000000000001";

const resources = [
  { number: "01", icon: "SETTLE", label: "Arc network", title: "The stablecoin-native L1", copy: "Learn how Arc makes programmable money feel immediate, predictable, and EVM-native.", href: "https://www.arc.io/", tone: "lime" },
  { number: "02", icon: "INTENT", label: "Developer docs", title: "Build on Arc", copy: "Network configuration, contracts, App Kit, agent patterns, and production integration guides.", href: "https://docs.arc.io/", tone: "mint" },
  { number: "03", icon: "EVIDENCE", label: "Block explorer", title: "Inspect Arc Testnet", copy: "Follow blocks, transactions, verified contracts, fees, and activity directly on Arcscan.", href: "https://testnet.arcscan.app/", tone: "blue" },
  { number: "04", icon: "MARKET", label: "Agentic economy", title: "Agents as economic actors", copy: "Explore Arc's ERC-8004 identity and ERC-8183 job settlement foundations.", href: "https://docs.arc.io/build/agentic-economy", tone: "orange" },
  { number: "05", icon: "SETTLE", label: "Circle Gateway", title: "Understand x402", copy: "See how HTTP-native payment negotiation and batched nanopayments serve machine commerce.", href: "https://developers.circle.com/gateway/nanopayments/concepts/x402", tone: "violet" },
  { number: "06", icon: "INTENT", label: "Testnet funds", title: "Open the faucet", copy: "Fund a wallet with test USDC and start sending, settling, and deploying on Arc.", href: "https://faucet.circle.com/", tone: "rose" },
] as const;

const marketplaceProviders = [
  { id: "01", name: "Arc Baseline", tier: "Snapshot", price: "0.008", fee: "0.000096", total: "0.008096", fit: "Cheap public Arc state for low-risk preflight." },
  { id: "02", name: "Arc Sentinel", tier: "Signed", price: "0.024", fee: "0.000288", total: "0.024288", fit: "Signed risk evidence for everyday agent spend." },
  { id: "03", name: "Arc Veritas", tier: "Code-aware", price: "0.045", fee: "0.000540", total: "0.045540", fit: "Premium strict-policy proof for treasury and contracts." },
] as const;

const primaryPlaygroundEndpoints: PlaygroundEndpoint[] = ["quote", "execution", "marketplace", "status"];
const protocolReferenceEndpoints: PlaygroundEndpoint[] = ["discovery", "openapi", "submission", "launch", "marketplace", "manifest", "status"];

const playgroundEndpoints: Record<PlaygroundEndpoint, {
  label: string;
  method: "GET" | "POST";
  path: string;
  summary: string;
  body?: Record<string, unknown>;
}> = {
  discovery: {
    label: "Agent discovery",
    method: "GET",
    path: "/.well-known/knot",
    summary: "Discover KNOT capabilities, trust boundaries, endpoint URLs, and the recommended agent flow.",
  },
  openapi: {
    label: "OpenAPI",
    method: "GET",
    path: "/api/openapi",
    summary: "Read the complete OpenAPI 3.1 contract for integrating an external agent with KNOT.",
  },
  submission: {
    label: "Submission brief",
    method: "GET",
    path: "/api/submission",
    summary: "Inspect the judge-ready problem statement, product scope, demo flow, and live proof references.",
  },
  launch: {
    label: "Launch kit",
    method: "GET",
    path: "/api/launch",
    summary: "Read launch readiness, utility, revenue paths, and production guardrails.",
  },
  status: {
    label: "Rail status",
    method: "GET",
    path: "/api/system/status",
    summary: "Read the live readiness of KNOT, Circle, x402, Arc anchoring, and receipt storage.",
  },
  marketplace: {
    label: "Providers",
    method: "GET",
    path: "/api/marketplace",
    summary: "Inspect provider supply, policy products, quotes, and accepted-settlement economics.",
  },
  manifest: {
    label: "Open manifest",
    method: "GET",
    path: "/api/manifest",
    summary: "Read machine-usable jobs, policy presets, contracts, examples, and endpoint metadata.",
  },
  quote: {
    label: "Preflight quote",
    method: "POST",
    path: "/api/quote",
    summary: "Ask KNOT how it would route an obligation before any provider is paid.",
    body: {
      jobType: "treasury",
      policyPreset: "strict",
      task: "Decide whether an autonomous treasury agent can release a small USDC payment.",
      subject: demoSubject,
      maxPriceUsdc: 0.05,
      maxLatencyMs: 1400,
      maxAgeSeconds: 90,
      requiredFields: ["risk", "confidence", "observedAt", "balanceUsdc", "transactionCount"],
      requireSignature: true,
    },
  },
  execution: {
    label: "Proof run",
    method: "POST",
    path: "/api/executions",
    summary: "Run the public proof path and receive a typed receipt without spending a connected wallet.",
    body: {
      jobType: "counterparty",
      policyPreset: "balanced",
      task: "Assess an Arc wallet and return signed, current risk evidence.",
      subject: demoSubject,
      maxPriceUsdc: 0.03,
      maxLatencyMs: 1400,
      maxAgeSeconds: 90,
      requiredFields: ["risk", "confidence", "observedAt", "balanceUsdc", "transactionCount"],
      requireSignature: true,
    },
  },
};

function rememberReceiptId(id: string) {
  if (typeof window === "undefined") return;

  let receiptIds: string[] = [];
  try {
    const stored = JSON.parse(window.localStorage.getItem("knot-receipts") ?? "[]") as unknown;
    receiptIds = Array.isArray(stored)
      ? stored.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    // A malformed browser cache should never prevent a valid receipt from being retained.
  }

  window.localStorage.setItem(
    "knot-receipts",
    JSON.stringify([id, ...receiptIds.filter((receiptId) => receiptId !== id)].slice(0, 25)),
  );
}

function KnotMark() {
  return <span className="knot-mark" aria-hidden="true"><i /><i /></span>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg>;
}

function SunIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2 12h2.2M19.8 12H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

function MoonIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
}

function WalletIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h14.5A1.5 1.5 0 0 1 20 8v10H5.5A2.5 2.5 0 0 1 3 15.5V7a3 3 0 0 1 3-3h11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M15.5 11.5H20v3h-4.5a1.5 1.5 0 0 1 0-3Z" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
}

function AssetIcon({ asset }: { asset: ArcPaymentAssetId }) {
  if (asset === "cirBTC") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9 6v12M13.5 6v2M13.5 16v2M8 8h6.2a2.3 2.3 0 0 1 0 4.6H8M8 12.6h6.9a2.5 2.5 0 0 1 0 5H8" /></svg>;
  }
  const glyph = asset === "EURC" ? "EUR" : "USD";
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><text x="12" y="14.7" textAnchor="middle">{glyph}</text></svg>;
}

function ExternalIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4h9v9M16 4 8.5 11.5M14 10v5H4V5h5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ShortHash({ value }: { value: string | null }) {
  return value ? <span title={value}>{`${value.slice(0, 10)}...${value.slice(-8)}`}</span> : <span>Not issued</span>;
}

function StatusPill({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  return <span className={`status-pill ${ready ? "is-ready" : "is-pending"}`}><i />{children}</span>;
}

function SignalIcon({ kind }: { kind: "intent" | "market" | "verify" | "settle" }) {
  const paths = {
    intent: <><path d="M7 4h10v16H7z" /><path d="M10 8h4M10 12h4M10 16h2" /></>,
    market: <><path d="M4 17 9 12l3 3 8-9" /><path d="M15 6h5v5" /></>,
    verify: <><path d="M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    settle: <><circle cx="12" cy="12" r="8" /><path d="M9 9.5c0-1 1-1.8 2.5-1.8S14 8.4 14 9.4c0 2.4-5 1-5 3.5 0 1.1 1.1 1.9 2.7 1.9s2.8-.8 2.8-1.9M12 6v12" /></>,
  }[kind];
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths}</svg>;
}

function HourglassIcon() {
  return <svg className="hourglass-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M8 4h16M8 28h16M10 5c0 6 6 7 6 11s-6 5-6 11M22 5c0 6-6 7-6 11s6 5 6 11" /><path className="hourglass-sand" d="m12 9 4 5 4-5M12 24l4-5 4 5Z" /></svg>;
}

function ProtocolIcon({ kind }: { kind: string }) {
  if (kind === "INTENT") return <SignalIcon kind="intent" />;
  if (kind === "MARKET") return <SignalIcon kind="market" />;
  if (kind === "EVIDENCE") return <SignalIcon kind="verify" />;
  return <SignalIcon kind="settle" />;
}

function TraceMotionLayer({
  visibleEvents,
  totalEvents,
  completed,
  status,
}: {
  visibleEvents: number;
  totalEvents: number;
  completed: boolean;
  status?: Execution["status"];
}) {
  const progress = Math.min(100, Math.round((visibleEvents / Math.max(totalEvents, 1)) * 100));
  const phase = completed ? (status === "verified" ? "cleared" : "blocked") : visibleEvents > 0 ? "running" : "idle";
  return (
    <div className={`trace-motion is-${phase}`} style={{ "--trace-progress": `${progress}%` } as React.CSSProperties} aria-hidden="true">
      <span className="trace-motion-grid" />
      <span className="trace-beam trace-beam-a" />
      <span className="trace-beam trace-beam-b" />
      <span className="trace-packet trace-packet-a" />
      <span className="trace-packet trace-packet-b" />
      <span className="trace-packet trace-packet-c" />
      <div className="trace-orbital">
        <i />
        <i />
        <i />
        <b>{progress}%</b>
      </div>
      <div className="trace-phase-strip">
        <span>Intent</span>
        <span>Market</span>
        <span>Proof</span>
        <span>Settle</span>
        <i />
      </div>
    </div>
  );
}

function TraceEvent({ item, last }: { item: ExecutionEvent; last: boolean }) {
  const label = { discovery: "DISCOVER", quote: "QUOTE", payment: "PAYMENT INTENT", verification: "VERIFY", fallback: "ROUTE", settlement: "SETTLE" }[item.kind];
  return (
    <li className={`trace-event event-enter is-${item.status} ${last ? "is-current" : ""}`}>
      <div className="trace-rail" aria-hidden="true"><span className={`trace-node is-${item.status}`} />{!last && <i />}</div>
      <div className="trace-copy">
        <div className="trace-meta"><span>{String(item.sequence + 1).padStart(2, "0")}</span><span>{label}</span>{item.amountUsdc !== undefined && <strong>{item.amountUsdc.toFixed(3)} USDC</strong>}</div>
        <h3>{item.title}</h3><p>{item.detail}</p>
      </div>
    </li>
  );
}

function ProviderCard({ attempt, index }: { attempt?: ProviderAttempt; index: number }) {
  const accepted = attempt?.outcome === "accepted";
  const rejected = attempt?.outcome === "rejected";
  const signedProvider = attempt?.providerId !== "arc-baseline";
  const failedChecks = attempt?.verification.checks.filter((check) => !check.passed).map((check) => check.label.toLowerCase()).join(", ");
  return (
    <article className={`provider-card ${accepted ? "is-accepted" : rejected ? "is-rejected" : "is-standby"}`}>
      <div className="provider-topline"><span>LIVE ARC PROVIDER / 0{index + 1}</span><span className={`outcome ${accepted ? "good" : rejected ? "bad" : ""}`}>{accepted ? "VERIFIED & SELECTED" : rejected ? "EVIDENCE FAILED" : "STANDBY"}</span></div>
      <h3>{attempt?.provider ?? (index === 0 ? "Arc Baseline" : "Arc Sentinel")}</h3>
      <div className="provider-verdict-rail" aria-hidden="true"><i /><i /><i /></div>
      <div className="provider-stats">
        <div><span>Quote</span><b>{attempt ? attempt.priceUsdc.toFixed(3) : index === 0 ? "0.018" : "0.024"} USDC</b></div>
        <div><span>Reputation</span><b>{attempt?.reputation ?? (index === 0 ? 78 : 96)} / 100</b></div>
        <div><span>Proof</span><b>{attempt?.proofSupport ? "Supported" : "Unsigned"}</b></div>
      </div>
      <p className="provider-note">{accepted ? "Live Arc evidence met every obligation. Settlement authorization was bound to this report hash." : rejected ? `Evidence rejected on ${failedChecks || "policy validation"}. No payment was released.` : index === 0 ? "A lower-cost Arc RPC snapshot competes first; KNOT routes onward when its proof envelope is incomplete." : "Queries Arc RPC at execution time, scores the requested address, and signs the resulting evidence envelope."}</p>
      <p className="provider-fixture">Source: Arc Testnet RPC · {signedProvider ? "cryptographically signed report" : "unsigned public snapshot"}</p>
    </article>
  );
}

function ProofRow({ check, label }: { check?: VerificationCheck; label: string }) {
  return (
    <div className="proof-row">
      <span className={`proof-icon ${check?.passed ? "pass" : ""}`}>{check ? (check.passed ? "OK" : "NO") : "--"}</span>
      <strong>{check?.label ?? label}</strong><span>{check?.detail ?? "Waiting for an evidence envelope"}</span>
    </div>
  );
}

function RiskReport({ attempt }: { attempt?: ProviderAttempt }) {
  if (!attempt || !["arc-sentinel", "arc-veritas"].includes(attempt.providerId)) return null;
  const payload = attempt.delivery.payload;
  const subject = typeof payload.subject === "string" ? payload.subject : "";
  const risk = typeof payload.risk === "string" ? payload.risk : "unknown";
  const score = typeof payload.riskScore === "number" ? payload.riskScore : 0;
  const balance = typeof payload.balanceUsdc === "number" ? payload.balanceUsdc : 0;
  const transactions = typeof payload.transactionCount === "number" ? payload.transactionCount : 0;
  const accountType = typeof payload.accountType === "string" ? payload.accountType : "unknown";
  const latestBlock = typeof payload.latestBlock === "number" ? payload.latestBlock : 0;
  const signals = Array.isArray(payload.signals) ? payload.signals.filter((item): item is string => typeof item === "string") : [];

  return <section className="risk-report page-shell" aria-label="Live Arc wallet risk report">
    <div className="risk-score"><span>LIVE RISK SCORE</span><strong>{score}</strong><small>/ 100 · {risk.toUpperCase()}</small><i style={{ "--score": `${score}%` } as React.CSSProperties} /></div>
    <div className="risk-report-main"><div className="risk-report-heading"><div><span>{attempt.provider.toUpperCase()} REPORT</span><h2>Onchain evidence, not a generated answer.</h2></div><a href={`${ARC_TESTNET.explorerUrl}/address/${subject}`} target="_blank" rel="noreferrer">Inspect wallet <ExternalIcon /></a></div><code>{subject}</code><div className="risk-metrics"><div><span>Balance</span><strong>{balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC</strong></div><div><span>Transactions</span><strong>{transactions}</strong></div><div><span>Account</span><strong>{accountType}</strong></div><div><span>Latest block</span><strong>{latestBlock.toLocaleString()}</strong></div></div></div>
    <div className="risk-signals"><span>DECISION SIGNALS</span>{signals.map((signal) => <p key={signal}><i />{signal}</p>)}<small>Heuristic evidence for agent policy decisions, not financial advice.</small></div>
  </section>;
}

function useArcWallet() {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState("0.00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disconnected = useRef(false);
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider || refreshing.current) return;
    refreshing.current = true;
    try {
      const [accountsValue, chainValue] = await Promise.all([
        provider.request({ method: "eth_accounts" }),
        provider.request({ method: "eth_chainId" }),
      ]);
      const accounts = Array.isArray(accountsValue) ? accountsValue.filter((item): item is string => typeof item === "string") : [];
      const nextAccount = disconnected.current ? null : accounts[0] ?? null;
      const nextChain = parseChainId(chainValue);
      setAccount(nextAccount);
      setChainId(nextChain);
      if (nextAccount && nextChain === ARC_TESTNET.id) {
        const rawBalance = await provider.request({ method: "eth_getBalance", params: [nextAccount, "latest"] });
        setBalance(formatArcBalance(rawBalance));
      } else {
        setBalance("0.00");
      }
    } catch {
      // Keep the last known wallet state when the public Arc RPC briefly rate-limits reads.
    } finally {
      refreshing.current = false;
    }
  }, []);

  useEffect(() => {
    const provider = getInjectedProvider();
    if (!provider) return;
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const onAccountsChanged = () => void refresh();
    const onChainChanged = () => void refresh();
    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("chainChanged", onChainChanged);
    const interval = window.setInterval(() => void refresh(), 15_000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) {
      setError("No injected wallet detected. Install MetaMask, Rabby, or Coinbase Wallet.");
      return null;
    }
    setBusy(true); setError(null);
    try {
      disconnected.current = false;
      const accountsValue = await provider.request({ method: "eth_requestAccounts" });
      const accounts = Array.isArray(accountsValue) ? accountsValue.filter((item): item is string => typeof item === "string") : [];
      await refresh();
      return accounts[0] ?? null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet connection was declined.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const disconnect = useCallback(async () => {
    const provider = getInjectedProvider();
    disconnected.current = true;
    setAccount(null); setBalance("0.00"); setError(null);
    if (!provider) return;
    try {
      await provider.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
    } catch {
      // Some injected wallets do not expose permission revocation; local session disconnect still applies.
    }
  }, []);

  const changeAccount = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) {
      setError("No injected wallet detected. Install MetaMask, Rabby, or Coinbase Wallet.");
      return;
    }
    setBusy(true); setError(null); disconnected.current = false;
    try {
      setAccount(await requestDifferentAccount(provider));
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The wallet account selector could not be opened.");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const addOrSwitchArc = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) {
      setError("No injected wallet detected. Install MetaMask, Rabby, or Coinbase Wallet.");
      return false;
    }
    setBusy(true); setError(null);
    try {
      try {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_TESTNET.idHex }] });
      } catch (cause) {
        const code = typeof cause === "object" && cause !== null && "code" in cause ? Number((cause as { code: unknown }).code) : null;
        if (code !== 4902) throw cause;
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: ARC_TESTNET.idHex,
            chainName: ARC_TESTNET.name,
            nativeCurrency: ARC_TESTNET.nativeCurrency,
            rpcUrls: [ARC_TESTNET.rpcUrl],
            blockExplorerUrls: [ARC_TESTNET.explorerUrl],
          }],
        });
      }
      await refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Arc Testnet could not be added to the wallet.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return { account, chainId, balance, busy, error, connect, disconnect, changeAccount, addOrSwitchArc, refresh };
}

function useAgentWallet(wallet: ReturnType<typeof useArcWallet>): AgentWalletState {
  const [agentWallet, setAgentWallet] = useState<AgentWallet | null>(null);
  const [busy, setBusy] = useState(false);
  const [funding, setFunding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fundHash, setFundHash] = useState<string | null>(null);
  const authorization = useRef<{ owner: string; issuedAt: string; signature: string } | null>(null);

  const requestAgentWallet = useCallback(async (auth: { owner: string; issuedAt: string; signature: string }) => {
    const response = await fetch("/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(auth),
    });
    const data = await response.json().catch(() => ({})) as {
      error?: string;
      code?: string;
      retryable?: boolean;
      wallet?: AgentWallet;
    };
    if (!response.ok) {
      const retry = data.retryable ? " Retry in a moment; proof preview remains available." : "";
      throw new Error(`${data.error ?? "Agent wallet could not be prepared."}${retry}`);
    }
    if (!data.wallet) throw new Error("Agent wallet response was incomplete. Retry in a moment.");
    const prepared = data.wallet;
    setAgentWallet(prepared);
    return prepared;
  }, []);

  const activate = useCallback(async () => {
    setError(null);
    let owner = wallet.account;
    if (!owner) owner = await wallet.connect();
    if (!owner) return null;

    const provider = getInjectedProvider();
    if (!provider) {
      setError("No injected wallet was detected.");
      return null;
    }
    setBusy(true);
    try {
      const issuedAt = new Date().toISOString();
      const message = createAgentAuthorizationMessage(owner, issuedAt);
      const signature = await provider.request({ method: "personal_sign", params: [message, owner] });
      if (typeof signature !== "string") throw new Error("The wallet did not return a signature.");

      const auth = { owner, issuedAt, signature };
      authorization.current = auth;
      return await requestAgentWallet(auth);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Agent wallet activation failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [requestAgentWallet, wallet]);

  const fund = useCallback(async (target?: AgentWallet) => {
    const provider = getInjectedProvider();
    const walletToFund = target ?? agentWallet;
    if (!provider || !wallet.account || !walletToFund) {
      setError("Activate your personal agent wallet first.");
      return false;
    }
    setError(null); setFundHash(null); setFunding(true);
    try {
      if (wallet.chainId !== ARC_TESTNET.id && !(await wallet.addOrSwitchArc())) return false;
      const balanceBefore = BigInt(await provider.request({ method: "eth_getBalance", params: [walletToFund.address, "latest"] }) as string);
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: wallet.account, to: walletToFund.address, value: parseArcPaymentAmount("0.60") }],
      });
      if (typeof hash !== "string") throw new Error("The wallet did not return a funding transaction hash.");
      setFundHash(hash);
      const expectedBalance = balanceBefore + BigInt(parseArcPaymentAmount("0.60"));
      let confirmed = false;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const current = await provider.request({ method: "eth_getBalance", params: [walletToFund.address, "latest"] });
        if (typeof current === "string" && BigInt(current) >= expectedBalance) { confirmed = true; break; }
        await new Promise((resolve) => window.setTimeout(resolve, 600));
      }
      if (!confirmed) throw new Error("Agent funding is still confirming. Retry in a few seconds.");
      if (authorization.current) await requestAgentWallet(authorization.current);
      await wallet.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Agent funding failed.");
      return false;
    } finally {
      setFunding(false);
    }
  }, [agentWallet, requestAgentWallet, wallet]);

  const activeWallet = agentWallet?.owner === wallet.account?.toLowerCase() ? agentWallet : null;
  const getAuthorization = useCallback(() => authorization.current, []);
  const refresh = useCallback(async () => {
    if (!authorization.current) return null;
    try {
      return await requestAgentWallet(authorization.current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Agent balance refresh failed.");
      return null;
    }
  }, [requestAgentWallet]);
  return { wallet: activeWallet, busy, funding, error, fundHash, activate, getAuthorization, fund, refresh };
}

function ThemeButton({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return <button className="icon-button" type="button" onClick={onToggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>{theme === "dark" ? <SunIcon /> : <MoonIcon />}</button>;
}

function WalletDock({ wallet }: { wallet: ReturnType<typeof useArcWallet> }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrongChain = Boolean(wallet.account && wallet.chainId !== ARC_TESTNET.id);
  return (
    <div className="wallet-dock">
      <button className={`network-button ${wrongChain ? "is-wrong" : wallet.chainId === ARC_TESTNET.id ? "is-correct" : ""}`} type="button" onClick={() => void wallet.addOrSwitchArc()} disabled={wallet.busy}>
        <span className="network-dot" />
        <span><small>{wrongChain ? "Wrong network" : wallet.chainId === ARC_TESTNET.id ? "Arc Testnet" : "Network"}</small><b>{wrongChain ? "Switch to Arc" : wallet.chainId === ARC_TESTNET.id ? `${wallet.balance} USDC` : "Add Arc Testnet"}</b></span>
      </button>
      <div className="wallet-menu-shell">
        <button className="wallet-button" type="button" onClick={() => wallet.account ? setMenuOpen((open) => !open) : void wallet.connect()} disabled={wallet.busy} aria-expanded={wallet.account ? menuOpen : undefined}>
          <WalletIcon /><span><small>{wallet.account ? "Connected wallet" : "Wallet"}</small><b>{wallet.account ? shortAddress(wallet.account) : wallet.busy ? "Connecting..." : "Connect wallet"}</b></span>
        </button>
        {wallet.account && menuOpen && <div className="wallet-popover" role="dialog" aria-label="Connected wallet options">
          <div className="wallet-popover-head"><span>Connected account</span><strong>{shortAddress(wallet.account)}</strong><small>{wallet.chainId === ARC_TESTNET.id ? `${wallet.balance} USDC on Arc` : "Switch to Arc to read balance"}</small></div>
          <button type="button" onClick={() => { setMenuOpen(false); void wallet.changeAccount(); }}>Change account <ArrowIcon /></button>
          <button className="disconnect-action" type="button" onClick={() => { setMenuOpen(false); void wallet.disconnect(); }}>Disconnect</button>
        </div>}
      </div>
    </div>
  );
}

function SiteHeader({ view, setView, theme, setTheme, wallet }: { view: View; setView: (view: View) => void; theme: Theme; setTheme: (theme: Theme) => void; wallet: ReturnType<typeof useArcWallet> }) {
  return (
    <header className="app-header">
      <nav className="site-nav page-shell">
        <Link className="brand brand-button" href="/" aria-label="KNOT home"><KnotMark /><span><b>KNOT</b><small>VERIFICATION-NATIVE SETTLEMENT</small></span></Link>
        <div className="view-tabs" role="tablist" aria-label="KNOT views">
          <button type="button" role="tab" aria-selected={view === "console"} className={view === "console" ? "active" : ""} onClick={() => setView("console")}>Verify</button>
          <button type="button" role="tab" aria-selected={view === "receipts"} className={view === "receipts" ? "active" : ""} onClick={() => setView("receipts")}>Receipts</button>
          <button type="button" role="tab" aria-selected={view === "payment"} className={view === "payment" ? "active" : ""} onClick={() => setView("payment")}>Treasury</button>
          <button type="button" role="tab" aria-selected={view === "explore"} className={view === "explore" ? "active" : ""} onClick={() => setView("explore")}>Protocol</button>
        </div>
        <div className="nav-actions"><ThemeButton theme={theme} onToggle={() => setTheme(theme === "dark" ? "light" : "dark")} /><WalletDock wallet={wallet} /></div>
      </nav>
      {wallet.error && <div className="wallet-alert page-shell" role="alert">{wallet.error}</div>}
    </header>
  );
}

function NetworkRibbon({ wallet, agent }: { wallet: ReturnType<typeof useArcWallet>; agent: AgentWalletState }) {
  const correctChain = wallet.chainId === ARC_TESTNET.id;
  const action = !wallet.account ? () => wallet.connect() : !correctChain ? () => wallet.addOrSwitchArc() : agent.wallet ? () => agent.fund() : () => agent.activate();
  const actionLabel = !wallet.account ? "Connect wallet" : !correctChain ? "Switch to Arc" : agent.wallet ? agent.funding ? "Adding funds" : "Top up agent" : agent.busy ? "Preparing agent" : "Activate agent";
  return (
    <section className="network-ribbon page-shell" aria-label="Network and payment rail status">
      <div className="ribbon-intro"><span>{agent.wallet ? "Personal agent online" : "Live environment"}</span><p>{agent.wallet ? `Circle MPC wallet ${shortAddress(agent.wallet.address)} is bound to this connected account.` : "Connect once, authorize your agent, and keep its signing key isolated from the browser."}</p></div>
      <div className="ribbon-metric"><i className="metric-glyph">A</i><span><small>Network</small><b>{correctChain ? "Arc Testnet connected" : "Arc Testnet"}</b></span></div>
      <div className="ribbon-metric"><i className="metric-glyph">$</i><span><small>Connected wallet</small><b>{wallet.account && correctChain ? `${wallet.balance} USDC` : "Native USDC"}</b></span></div>
      <div className="ribbon-metric"><i className="metric-glyph">M</i><span><small>Agent wallet</small><b>{agent.wallet ? `${Number(agent.wallet.balanceUsdc).toFixed(3)} USDC` : "Not activated"}</b></span></div>
      <div className="ribbon-metric"><i className="metric-glyph">402</i><span><small>Gateway balance</small><b>{agent.wallet ? `${Number(agent.wallet.gatewayBalanceUsdc).toFixed(3)} USDC` : "x402 live"}</b></span></div>
      <button type="button" className={`ribbon-action ${agent.wallet ? "is-agent-ready" : ""}`} onClick={() => void action()} disabled={wallet.busy || agent.busy || agent.funding}>{actionLabel}<ArrowIcon /></button>
      {agent.error && <div className="ribbon-error" role="alert"><span>{agent.error}</span><button type="button" onClick={() => void action()} disabled={agent.busy || agent.funding}>Retry <ArrowIcon /></button></div>}
    </section>
  );
}

function TraceStandby({
  maxPrice,
  maxAge,
  requireSignature,
  quote,
}: {
  maxPrice: string;
  maxAge: number;
  requireSignature: boolean;
  quote?: ExecutionQuote;
}) {
  const route = quote?.route.filter((provider) => provider.canSatisfy) ?? [];
  return (
    <div className="trace-standby">
      <div className="standby-radar" aria-hidden="true">
        <i className="standby-orbit orbit-a" />
        <i className="standby-orbit orbit-b" />
        <i className="standby-sweep" />
        <span className="standby-core"><KnotMark /><b>{quote ? "ROUTE READY" : "PAYMENT LOCKED"}</b></span>
        <span className="standby-node node-price">PRICE</span>
        <span className="standby-node node-proof">PROOF</span>
        <span className="standby-node node-route">ROUTE</span>
      </div>
      <div className="standby-copy">
        <span>PRE-SETTLEMENT GUARD</span>
        <h3>{quote ? `${route.length || quote.route.length} provider route prepared.` : "Nothing moves before evidence clears."}</h3>
        <p>{quote ? "The market route fits this obligation. Run the proof to test the delivery and unlock settlement." : "Quote the market or run the obligation. KNOT will preserve every rejected offer, fallback decision, and accepted proof."}</p>
      </div>
      <dl className="standby-policy">
        <div><dt>Maximum spend</dt><dd>{Number(maxPrice || 0).toFixed(3)} USDC</dd></div>
        <div><dt>Freshness</dt><dd>{maxAge}s or newer</dd></div>
        <div><dt>Provider proof</dt><dd>{requireSignature ? "Signature required" : "Optional"}</dd></div>
        <div><dt>Settlement</dt><dd>Locked until pass</dd></div>
      </dl>
    </div>
  );
}

function SettlementField({
  execution,
  visibleEvents,
  running,
  completed,
}: {
  execution: Execution | null;
  visibleEvents: number;
  running: boolean;
  completed: boolean;
}) {
  const phase = completed
    ? execution?.status === "verified" ? "cleared" : "blocked"
    : running || visibleEvents > 0 ? "processing" : "locked";
  const acceptedProvider = execution?.attempts.find((attempt) => attempt.outcome === "accepted")?.provider;
  const stateCopy = {
    locked: {
      eyebrow: "POLICY FIELD / STANDBY",
      title: "Value waits at the proof boundary.",
      copy: "Price, freshness, schema, and signature become one release condition before a provider can be paid.",
      core: "LOCKED",
    },
    processing: {
      eyebrow: "POLICY FIELD / CLEARING",
      title: "Evidence is crossing the decision surface.",
      copy: "KNOT is preserving rejected work, fallback routing, and the proof that can unlock settlement.",
      core: "VERIFY",
    },
    cleared: {
      eyebrow: "POLICY FIELD / RELEASED",
      title: "Verified work crossed the release boundary.",
      copy: `${acceptedProvider ?? "The accepted provider"} satisfied the obligation. The evidence and payment verdict now share one receipt.`,
      core: "CLEARED",
    },
    blocked: {
      eyebrow: "POLICY FIELD / HELD",
      title: "The policy kept settlement locked.",
      copy: "No delivery satisfied every condition, so value stayed with the agent and the failed route remained auditable.",
      core: "HELD",
    },
  }[phase];

  return (
    <aside className={`settlement-field is-${phase}`} aria-label="Live settlement policy field">
      <header>
        <span><i /> {stateCopy.eyebrow}</span>
        <b>{String(Math.min(visibleEvents, execution?.events.length ?? 0)).padStart(2, "0")} / {String(execution?.events.length ?? 9).padStart(2, "0")}</b>
      </header>
      <div className="settlement-field-body">
        <div className="settlement-field-scene" aria-hidden="true">
          <div className="field-plane field-plane-back" />
          <div className="field-plane field-plane-mid" />
          <div className="field-ring field-ring-a"><i /></div>
          <div className="field-ring field-ring-b"><i /></div>
          <div className="field-ring field-ring-c"><i /></div>
          <div className="field-core">
            <KnotMark />
            <strong>{stateCopy.core}</strong>
          </div>
          <span className="field-chip field-chip-intent">INTENT</span>
          <span className="field-chip field-chip-proof">PROOF</span>
          <span className="field-chip field-chip-usdc">USDC</span>
        </div>
        <div className="settlement-field-copy">
          <span>PROGRAMMABLE RELEASE</span>
          <h3>{stateCopy.title}</h3>
          <p>{stateCopy.copy}</p>
        </div>
      </div>
      <dl>
        <div><dt>Policy</dt><dd>{execution ? `${execution.obligation.maxPriceUsdc.toFixed(3)} USDC max` : "Defined by buyer"}</dd></div>
        <div><dt>Evidence</dt><dd>{completed ? execution?.settlement.evidenceHash ? "Bound to receipt" : "Not accepted" : "Required"}</dd></div>
        <div><dt>Settlement</dt><dd>{completed ? `${execution?.settlement.amountUsdc.toFixed(3) ?? "0.000"} USDC` : "Conditional"}</dd></div>
      </dl>
    </aside>
  );
}

function ConsoleView({ wallet, agent, system }: { wallet: ReturnType<typeof useArcWallet>; agent: AgentWalletState; system: SystemStatus | null }) {
  const [subject, setSubject] = useState("");
  const [jobType, setJobType] = useState<JobType>("counterparty");
  const [instruction, setInstruction] = useState(JOB_TYPES.counterparty.task);
  const [maxPrice, setMaxPrice] = useState("0.030");
  const [maxAge, setMaxAge] = useState(POLICY_PRESETS.balanced.maxAgeSeconds);
  const [maxLatency, setMaxLatency] = useState(POLICY_PRESETS.balanced.maxLatencyMs);
  const [requireSignature, setRequireSignature] = useState(true);
  const [policyPreset, setPolicyPreset] = useState<PolicyPreset>("balanced");
  const [settlementMode, setSettlementMode] = useState<SettlementMode>("preview");
  const [execution, setExecution] = useState<Execution | null>(null);
  const [quoteState, setQuoteState] = useState<QuoteState>({ status: "idle" });
  const [visibleEvents, setVisibleEvents] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const traceListRef = useRef<HTMLOListElement>(null);
  const tracePanelRef = useRef<HTMLElement>(null);
  const subjectAddress = (subject || wallet.account || "").trim();

  useEffect(() => {
    if (!execution || visibleEvents >= execution.events.length) return;
    const timer = window.setTimeout(() => setVisibleEvents((count) => count + 1), visibleEvents === 0 ? 160 : 760);
    return () => window.clearTimeout(timer);
  }, [execution, visibleEvents]);

  useEffect(() => {
    if (visibleEvents < 1) return;
    const frame = window.requestAnimationFrame(() => {
      if (visibleEvents >= 5) {
        traceListRef.current?.scrollTo({ top: traceListRef.current.scrollHeight, behavior: "smooth" });
      }
      if (visibleEvents === 1 || visibleEvents >= 5) {
        const panelTop = tracePanelRef.current?.getBoundingClientRect().top;
        if (panelTop !== undefined) window.scrollTo({ top: window.scrollY + panelTop - 94, behavior: "smooth" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [visibleEvents]);

  const acceptedAttempt = useMemo(() => execution?.attempts.find((attempt) => attempt.outcome === "accepted"), [execution]);
  const visibleTrace = execution?.events.slice(0, visibleEvents) ?? [];
  const completed = Boolean(execution && visibleEvents >= execution.events.length);
  const checks = acceptedAttempt?.verification.checks;
  const settlementEvent = execution?.events.findLast((item) => item.kind === "settlement");
  const settlementBlocked = execution?.settlement.status === "blocked";
  const busy = running || agent.busy || agent.funding || Boolean(execution && !completed);
  const quoteKey = [
    subjectAddress.toLowerCase(),
    jobType,
    instruction.trim(),
    maxPrice,
    maxAge,
    maxLatency,
    requireSignature ? "signed" : "unsigned",
    policyPreset,
  ].join("|");
  const currentQuoteState: QuoteState = quoteState.key === quoteKey ? quoteState : { status: "idle" };

  function applyPolicy(preset: Exclude<PolicyPreset, "custom">) {
    const policy = POLICY_PRESETS[preset];
    setPolicyPreset(preset);
    setMaxPrice(policy.maxPriceUsdc.toFixed(3));
    setMaxAge(policy.maxAgeSeconds);
    setMaxLatency(policy.maxLatencyMs);
    setRequireSignature(policy.requireSignature);
  }

  function applyJobType(nextType: JobType) {
    setJobType(nextType);
    setInstruction(JOB_TYPES[nextType].task);
    if (nextType === "treasury" || nextType === "contract-review") {
      applyPolicy("strict");
    }
  }

  async function requestExecution(input: {
    jobType: JobType;
    policyPreset: PolicyPreset;
    task: string;
    subject: string;
    maxPriceUsdc: number;
    maxAgeSeconds: number;
    maxLatencyMs: number;
    requiredFields: string[];
    requireSignature: boolean;
    agentAuthorization?: ReturnType<AgentWalletState["getAuthorization"]>;
  }) {
    const response = await fetch("/api/executions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Execution could not be created.");
    const nextExecution = data as Execution;
    rememberReceiptId(nextExecution.id);
    return nextExecution;
  }

  function currentRequiredFields() {
    return policyPreset === "custom"
      ? POLICY_PRESETS.balanced.requiredFields
      : POLICY_PRESETS[policyPreset].requiredFields;
  }

  async function quoteCurrentObligation() {
    setError(null);
    if (!isAddress(subjectAddress)) {
      setQuoteState({ status: "error", key: quoteKey, error: "Enter a valid Arc wallet address before quoting." });
      return;
    }
    if (instruction.trim().length < 12) {
      setQuoteState({ status: "error", key: quoteKey, error: "Describe the decision before asking the market for a quote." });
      return;
    }

    setQuoteState({ status: "loading", key: quoteKey });
    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobType,
          policyPreset,
          task: instruction.trim(),
          subject: subjectAddress,
          maxPriceUsdc: Number(maxPrice),
          maxAgeSeconds: maxAge,
          maxLatencyMs: maxLatency,
          requiredFields: currentRequiredFields(),
          requireSignature,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Quote could not be calculated.");
      setQuoteState({ status: "ready", key: quoteKey, quote: data as ExecutionQuote });
    } catch (cause) {
      setQuoteState({ status: "error", key: quoteKey, error: cause instanceof Error ? cause.message : "Quote could not be calculated." });
    }
  }

  async function runAgent() {
    setError(null);
    if (!isAddress(subjectAddress)) return setError("Enter a valid Arc wallet address to assess.");
    if (instruction.trim().length < 12) return setError("Tell the agent what decision this assessment should support.");
    let agentAuthorization: ReturnType<AgentWalletState["getAuthorization"]> = null;
    if (settlementMode === "live") {
      let activatedAgent = agent.wallet;
      agentAuthorization = agent.getAuthorization();
      if (!activatedAgent || !agentAuthorization || !isAgentAuthorizationFresh(agentAuthorization.issuedAt)) {
        activatedAgent = await agent.activate();
        agentAuthorization = agent.getAuthorization();
      }
      if (!activatedAgent) return;
      if (!agentAuthorization) return setError("Agent authorization is missing. Sign the request again.");
      const selectedCost = Number(maxPrice);
      if (
        Number(activatedAgent.gatewayBalanceUsdc) < selectedCost
        && Number(activatedAgent.balanceUsdc) < 0.5
      ) {
        const funded = await agent.fund(activatedAgent);
        if (!funded) return;
      }
    }
    const target = subjectAddress;
    const requiredFields = currentRequiredFields();
    setExecution(null); setVisibleEvents(0); setRunning(true);
    try {
      const nextExecution = await requestExecution({
          jobType,
          policyPreset,
          task: instruction.trim(),
          subject: target,
          maxPriceUsdc: Number(maxPrice),
          maxAgeSeconds: maxAge,
          maxLatencyMs: maxLatency,
          requiredFields,
          requireSignature,
          ...(agentAuthorization ? { agentAuthorization } : {}),
        });
      setExecution(nextExecution);
      if (nextExecution.settlement.status === "received") {
        const previousBalance = agent.wallet?.gatewayBalanceUsdc;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const refreshed = await agent.refresh();
          if (!refreshed || refreshed.gatewayBalanceUsdc !== previousBalance) break;
          await new Promise((resolve) => window.setTimeout(resolve, 700));
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Execution failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <section className="console-intro page-shell">
        <div><span><i /> LIVE CLEARING WORKSPACE</span><h1>Define the decision. KNOT handles the proof.</h1></div>
        <p>Choose the work, set the protection level, and watch KNOT route providers before any USDC can settle.</p>
      </section>
      <NetworkRibbon wallet={wallet} agent={agent} />
      <section className="workspace page-shell" aria-label="KNOT execution workspace">
        <article className="mission-panel panel-light">
          <div className="section-heading"><div><span>Obligation builder</span><h2>Define the decision.</h2></div></div>
          <div className="job-product"><div className="job-product-icon"><SignalIcon kind="verify" /></div><div><strong>{JOB_TYPES[jobType].label}</strong><p>{JOB_TYPES[jobType].description}</p></div><StatusPill ready={system?.mode === "live"}>ARC DATA LIVE</StatusPill></div>
          <div className="intent-presets job-type-grid" aria-label="Decision type">
            {(Object.keys(JOB_TYPES) as JobType[]).map((type) => (
              <button type="button" key={type} className={jobType === type ? "active" : ""} onClick={() => applyJobType(type)} aria-label={`${JOB_TYPES[type].label}: ${JOB_TYPES[type].description}`}>
                <span>{JOB_TYPES[type].shortLabel}</span>
                <small>{JOB_TYPES[type].description}</small>
              </button>
            ))}
          </div>
          <label className="agent-instruction" htmlFor="agent-instruction"><span>Decision request</span><small>Tell the agent what this signed assessment will help you decide.</small></label>
          <textarea id="agent-instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} maxLength={280} />
          <div className="subject-heading"><span>Wallet to assess</span>{wallet.account && <button type="button" onClick={() => setSubject(wallet.account ?? "")}>Use connected wallet</button>}</div>
          <div className={`subject-input ${subjectAddress && !isAddress(subjectAddress) ? "is-invalid" : ""}`}><i><WalletIcon /></i><input aria-label="Arc wallet address" value={subject || wallet.account || ""} onChange={(event) => setSubject(event.target.value)} placeholder="0x..." spellCheck={false} /></div>
          <div className="policy-heading"><span>Protection level</span></div>
          <div className="policy-presets" role="group" aria-label="Execution policy preset">
            {(["economy", "balanced", "strict"] as const).map((preset) => <button key={preset} type="button" className={policyPreset === preset ? "active" : ""} onClick={() => applyPolicy(preset)} aria-label={`${POLICY_PRESETS[preset].label}: ${POLICY_PRESETS[preset].expectedProvider}, up to ${POLICY_PRESETS[preset].maxPriceUsdc.toFixed(3)} USDC`}><span>{POLICY_PRESETS[preset].label}</span><small>{POLICY_PRESETS[preset].expectedProvider} · up to {POLICY_PRESETS[preset].maxPriceUsdc.toFixed(3)} USDC</small></button>)}
          </div>
          <details className="console-advanced">
            <summary>
              <span><strong>Advanced policy</strong><small>{Number(maxPrice || 0).toFixed(3)} USDC · {maxAge}s freshness · {requireSignature ? "signed" : "signature optional"}</small></span>
              <b>EDIT</b>
            </summary>
            <div className="console-advanced-body">
              <div className="policy-controls">
                <label><span>Max price</span><div><input value={maxPrice} inputMode="decimal" onChange={(event) => { setMaxPrice(event.target.value); setPolicyPreset("custom"); }} /><b>USDC</b></div></label>
                <label><span>Max age</span><div><input type="number" min={1} max={86400} value={maxAge} onChange={(event) => { setMaxAge(Number(event.target.value)); setPolicyPreset("custom"); }} /><b>SEC</b></div></label>
                <label><span>Max latency</span><div><input type="number" min={1} max={30000} value={maxLatency} onChange={(event) => { setMaxLatency(Number(event.target.value)); setPolicyPreset("custom"); }} /><b>MS</b></div></label>
                <button type="button" className={requireSignature ? "is-required" : ""} onClick={() => { setRequireSignature((value) => !value); setPolicyPreset("custom"); }}><span>Signed proof</span><b>{requireSignature ? "REQUIRED" : "OPTIONAL"}</b></button>
              </div>
              <div className={`preflight-card is-${currentQuoteState.status}`}>
                <div className="preflight-topline">
                  <div><span>Preflight market quote</span><strong>{currentQuoteState.quote?.recommendedProvider?.name ?? (currentQuoteState.status === "error" ? "Needs attention" : "No execution yet")}</strong></div>
                  <button type="button" onClick={() => void quoteCurrentObligation()} disabled={currentQuoteState.status === "loading" || running}>
                    {currentQuoteState.status === "loading" ? "Quoting" : "Quote route"}
                  </button>
                </div>
                {currentQuoteState.status === "ready" && currentQuoteState.quote ? (
                  <>
                    <dl className="preflight-metrics">
                      <div><dt>Decision</dt><dd>{currentQuoteState.quote.decision.toUpperCase()}</dd></div>
                      <div><dt>Max spend</dt><dd>{currentQuoteState.quote.maxSpendUsdc.toFixed(3)} USDC</dd></div>
                      <div><dt>Route</dt><dd>{currentQuoteState.quote.route.length} provider{currentQuoteState.quote.route.length === 1 ? "" : "s"}</dd></div>
                    </dl>
                    <div className="preflight-route">
                      {currentQuoteState.quote.route.map((provider) => (
                        <article className={`preflight-provider is-${provider.expectedOutcome}`} key={provider.id}>
                          <span>{provider.name}</span>
                          <strong>{provider.priceUsdc.toFixed(3)} USDC</strong>
                          <small>{provider.canSatisfy ? "Can satisfy obligation" : provider.reasons[0]}</small>
                        </article>
                      ))}
                    </div>
                    {currentQuoteState.quote.blockers.length > 0 && <p className="preflight-error">{currentQuoteState.quote.blockers.join(" ")}</p>}
                  </>
                ) : (
                  <p className={currentQuoteState.status === "error" ? "preflight-error" : ""}>{currentQuoteState.error ?? "Quote the provider route before a live settlement if you want to inspect price and fallback order."}</p>
                )}
              </div>
            </div>
          </details>
          <div className="settlement-choice" role="group" aria-label="Settlement mode">
            <button type="button" className={settlementMode === "preview" ? "active" : ""} onClick={() => setSettlementMode("preview")}><span>Proof preview</span><small>Live Arc data, no USDC charged</small></button>
            <button type="button" className={settlementMode === "live" ? "active" : ""} onClick={() => setSettlementMode("live")}><span>Live clearing</span><small>Agent pays only the accepted provider</small></button>
          </div>
          <button className="run-button" type="button" onClick={runAgent} disabled={busy}><span>{agent.busy ? "Authorize agent in your wallet" : running || Boolean(execution && !completed) ? "Agent is verifying live evidence" : settlementMode === "live" ? "Run and settle verified work" : "Run proof preview"}</span><ArrowIcon /></button>
          {(error || agent.error) && <p className="error-message" role="alert">{error ?? agent.error}</p>}
        </article>

        <div className="execution-column">
          <article className="trace-panel" ref={tracePanelRef}>
            <TraceMotionLayer
              visibleEvents={visibleEvents}
              totalEvents={execution?.events.length ?? 9}
              completed={completed}
              status={execution?.status}
            />
            <div className="trace-header"><div><span>Agent execution</span><h2>Clearing trace</h2></div><div className="trace-head-actions">{busy && <div className="trace-hourglass"><HourglassIcon /><span>VERIFYING</span></div>}<div className="trace-counter"><strong>{String(visibleTrace.length).padStart(2, "0")}</strong><span>Events</span></div></div></div>
            {visibleTrace.length === 0 ? <TraceStandby maxPrice={maxPrice} maxAge={maxAge} requireSignature={requireSignature} quote={currentQuoteState.quote} /> : <ol className="trace-list" ref={traceListRef}>{visibleTrace.map((item, index) => <TraceEvent key={item.id} item={item} last={index === visibleTrace.length - 1 && completed} />)}</ol>}
            <footer className="trace-footer"><span>Execution ID</span><code>{execution?.id ?? "NOT ISSUED"}</code><span className={completed ? "complete" : ""}>{completed ? "TRACE SEALED" : "AWAITING RUN"}</span></footer>
          </article>
          <SettlementField
            execution={execution}
            visibleEvents={visibleEvents}
            running={busy}
            completed={completed}
          />
        </div>
      </section>

      {completed && <RiskReport attempt={acceptedAttempt} />}

      {completed && execution && <section className={`execution-receipt page-shell ${execution.status === "verified" ? "is-verified" : "is-blocked"}`} aria-label="Execution receipt">
        <div className="receipt-mark"><SignalIcon kind={execution.status === "verified" ? "verify" : "intent"} /></div>
        <div className="receipt-title"><span>SEALED EXECUTION RECEIPT</span><h2>{execution.status === "verified" ? "Delivery verified. Payment unlocked." : "Policy held. Payment remained blocked."}</h2><p className="receipt-request">&ldquo;{execution.obligation.task}&rdquo;</p><small>{execution.id} · {new Date(execution.createdAt).toLocaleString()}</small></div>
        <dl>
          <div><dt>Provider</dt><dd>{acceptedAttempt?.provider ?? "None accepted"}</dd></div>
          <div><dt>Policy</dt><dd>{execution.obligation.maxPriceUsdc.toFixed(3)} USDC · {execution.obligation.maxAgeSeconds}s</dd></div>
          <div><dt>Rail</dt><dd>{execution.settlement.rail.replaceAll("-", " ")}</dd></div>
          <div><dt>Evidence</dt><dd><ShortHash value={execution.settlement.evidenceHash} /></dd></div>
          <div><dt>Arc anchor</dt><dd>{execution.settlement.attestation.status === "confirmed" ? "Confirmed" : execution.settlement.attestation.status === "failed" ? "Failed" : "Preview only"}</dd></div>
        </dl>
        <a href={`/receipt/${execution.id}`} target="_blank" rel="noreferrer">Open verified receipt <ExternalIcon /></a>
      </section>}

      {completed && execution && <section className="results page-shell">
        <div className="section-index"><span>02</span><p>MARKET SELECTION</p></div>
        <div className="provider-grid">{execution.attempts.map((attempt, index) => <ProviderCard attempt={attempt} index={index} key={attempt.providerId} />)}</div>
        <div className="evidence-grid">
          <article className="proof-panel panel-light">
            <div className="section-heading compact"><div><span>Evidence envelope</span><h2>Verification matrix</h2></div><span className={`proof-score ${completed ? "ready" : ""}`}>{completed ? `${checks?.filter((check) => check.passed).length ?? 0} / 5 PASS` : "WAITING"}</span></div>
            <div className="proof-list">{proofLabels.map((label, index) => <ProofRow key={label} label={label} check={checks?.[index]} />)}</div>
          </article>
          <article className={`settlement-panel ${completed && !settlementBlocked ? "is-authorized" : "is-blocked"}`}>
            <div className="settlement-orbit" aria-hidden="true"><i /><i /><i /></div>
            <div className="settlement-heading"><span>Settlement result</span><b>{settlementBlocked ? "BLOCKED" : completed ? execution?.settlement.status === "received" ? "X402 RECEIVED" : "AUTHORIZED" : "LOCKED"}</b></div>
            <p className={`settlement-amount ${settlementBlocked ? "is-blocked" : ""}`}>{settlementBlocked ? "BLOCKED" : completed ? execution?.settlement.amountUsdc.toFixed(3) : "0.000"}{!settlementBlocked && <span>USDC</span>}</p>
            <dl className="settlement-data"><div><dt>Rail</dt><dd>{execution?.settlement.rail.toUpperCase() ?? "SIMULATED"}</dd></div><div><dt>Evidence</dt><dd><ShortHash value={execution?.settlement.evidenceHash ?? null} /></dd></div><div><dt>{execution?.settlement.rail === "x402-gateway" ? "Gateway transfer" : "Onchain tx"}</dt><dd>{execution?.settlement.transactionHash ? <ShortHash value={execution.settlement.transactionHash} /> : "Not broadcast"}</dd></div><div><dt>Hook attestation</dt><dd>{execution.settlement.attestation.status.toUpperCase()}</dd></div></dl>
            <p className="settlement-disclaimer">{settlementBlocked ? settlementEvent?.detail ?? "Circle Gateway did not accept the payment authorization." : completed ? execution?.settlement.status === "received" ? "Circle Gateway accepted the x402 transfer. Provider credit finalizes through batched settlement." : "The evidence is accepted. The commitment is ready for the KNOT ERC-8183 completion hook." : "Settlement stays unavailable until one provider satisfies every condition."}</p>
          </article>
        </div>
      </section>}

    </>
  );
}

function ReceiptsView({ system }: { system: SystemStatus | null }) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyId, setVerifyId] = useState("");
  const [verifyHash, setVerifyHash] = useState("");
  const [verification, setVerification] = useState<ReceiptVerification | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const launchProof = system?.latestProof;
  const deployment = system?.deployment;

  useEffect(() => {
    const loadReceipts = async () => {
      const stored = JSON.parse(window.localStorage.getItem("knot-receipts") ?? "[]") as unknown;
      const ids = Array.isArray(stored)
        ? stored.filter((item): item is string => typeof item === "string").slice(0, 25)
        : [];
      if (ids.length === 0) {
        return [];
      }

      const response = await fetch(`/api/executions?ids=${encodeURIComponent(ids.join(","))}`);
      const data = (await response.json()) as { executions?: Execution[] };
      return data.executions ?? [];
    };

    loadReceipts()
      .then(setExecutions)
      .catch(() => setExecutions([]))
      .finally(() => setLoading(false));
  }, []);

  async function submitReceiptVerification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifyError(null);
    setVerification(null);
    const id = verifyId.trim();
    const evidenceHash = verifyHash.trim();
    if (!/^run_[a-f0-9]{12}$/.test(id)) {
      setVerifyError("Enter a KNOT receipt ID like run_123456789abc.");
      return;
    }
    if (evidenceHash && !/^0x[0-9a-fA-F]{64}$/.test(evidenceHash)) {
      setVerifyError("Evidence hash must be a 32-byte 0x value.");
      return;
    }

    setVerifying(true);
    try {
      const query = new URLSearchParams({ id });
      if (evidenceHash) query.set("evidenceHash", evidenceHash);
      const response = await fetch(`/api/receipts/verify?${query.toString()}`);
      const data = await response.json();
      if (!("valid" in data)) throw new Error(data.error ?? "Receipt verification failed.");
      setVerification(data as ReceiptVerification);
    } catch (cause) {
      setVerifyError(cause instanceof Error ? cause.message : "Receipt verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <section className="view-page receipts-page page-shell">
      <div className="view-hero receipts-hero">
        <div><span className="eyebrow">DECISION LEDGER</span><h1>Every outcome.<br /><em>Every reason.</em></h1></div>
        <p>KNOT receipts preserve the obligation, rejected offers, accepted evidence, payment rail, and Arc attestation. A machine can read the same record shown here.</p>
      </div>

      <div className="receipt-ledger-head">
        <div><span>Local receipt index</span><h2>{loading ? "Loading decisions" : `${executions.length} retained execution${executions.length === 1 ? "" : "s"}`}</h2></div>
        <p>Receipts are private by default through unguessable IDs. Share a receipt URL when another party needs to audit the decision.</p>
      </div>

      {launchProof && deployment && (
        <article className="launch-proof-card">
          <div className="launch-proof-copy">
            <span><i />ARC TESTNET LAUNCH PROOF</span>
            <h2>Job #{launchProof.jobId} cleared through the KNOT hook.</h2>
            <p>The completed testnet job proves the same evidence hash can move from a KNOT receipt into the onchain commerce lifecycle.</p>
          </div>
          <dl>
            <div><dt>Execution</dt><dd>{launchProof.executionId}</dd></div>
            <div><dt>Evidence</dt><dd><ShortHash value={launchProof.evidenceHash} /></dd></div>
            <div><dt>Commerce</dt><dd>{shortAddress(deployment.commerce)}</dd></div>
            <div><dt>Hook</dt><dd>{shortAddress(deployment.hook)}</dd></div>
          </dl>
          <div className="launch-proof-actions">
            <a href={launchProof.attestationExplorerUrl} target="_blank" rel="noreferrer">View attestation <ExternalIcon /></a>
            <a href={launchProof.completionExplorerUrl} target="_blank" rel="noreferrer">View completion <ExternalIcon /></a>
          </div>
        </article>
      )}

      <form className="receipt-verifier-card" onSubmit={(event) => void submitReceiptVerification(event)}>
        <div className="receipt-verifier-copy">
          <span>VERIFY A RECEIPT</span>
          <h2>Check the evidence binding.</h2>
          <p>Paste a receipt ID and, optionally, an evidence hash. KNOT will verify that the stored accepted delivery still satisfies the obligation and matches settlement.</p>
        </div>
        <label>
          <span>Receipt ID</span>
          <input value={verifyId} onChange={(event) => setVerifyId(event.target.value)} placeholder="run_123456789abc" spellCheck={false} />
        </label>
        <label>
          <span>Evidence hash</span>
          <input value={verifyHash} onChange={(event) => setVerifyHash(event.target.value)} placeholder="0x..." spellCheck={false} />
        </label>
        <button type="submit" disabled={verifying}>{verifying ? "Verifying" : "Verify receipt"}<ArrowIcon /></button>
        {(verifyError || verification) && (
          <div className={`receipt-verifier-result ${verification?.valid ? "is-valid" : "is-invalid"}`} role="status">
            <strong>{verifyError ?? (verification?.valid ? "Receipt verified" : verification?.status === "missing" ? "Receipt not found" : "Receipt did not verify")}</strong>
            {verification && <p>{verification.reasons.join(" ")}</p>}
            {verification?.receipt && <small>{verification.receipt.provider ?? "No provider"} / {verification.receipt.amountUsdc.toFixed(3)} USDC / {verification.receipt.attempts} attempt{verification.receipt.attempts === 1 ? "" : "s"}</small>}
          </div>
        )}
      </form>

      {loading ? <div className="receipt-empty"><HourglassIcon /><p>Reading the execution ledger</p></div> : executions.length === 0 ? (
        <div className="receipt-empty"><KnotMark /><h2>No receipts yet.</h2><p>Run a proof preview or live clearing execution to create the first auditable record.</p><a href="#console">Open verifier <ArrowIcon /></a></div>
      ) : (
        <div className="receipt-ledger">
          {executions.map((execution) => {
            const accepted = execution.attempts.find((attempt) => attempt.outcome === "accepted");
            return <article className={`receipt-card ${execution.status === "verified" ? "is-verified" : "is-blocked"}`} key={execution.id}>
              <div className="receipt-card-status"><span><i />{execution.status === "verified" ? "VERIFIED" : "BLOCKED"}</span><small>{new Date(execution.createdAt).toLocaleString()}</small></div>
              <div className="receipt-card-main"><span>{JOB_TYPES[execution.obligation.jobType].label}</span><h2>{execution.obligation.task}</h2><code>{execution.obligation.subject}</code></div>
              <dl>
                <div><dt>Provider</dt><dd>{accepted?.provider ?? "None"}</dd></div>
                <div><dt>Amount</dt><dd>{execution.settlement.amountUsdc.toFixed(3)} USDC</dd></div>
                <div><dt>Route</dt><dd>{execution.attempts.length} attempt{execution.attempts.length === 1 ? "" : "s"}</dd></div>
                <div><dt>Arc proof</dt><dd>{execution.settlement.attestation.status}</dd></div>
              </dl>
              <a href={`/receipt/${execution.id}`}>Inspect receipt <ArrowIcon /></a>
            </article>;
          })}
        </div>
      )}
    </section>
  );
}

function PaymentView({ wallet }: { wallet: ReturnType<typeof useArcWallet> }) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [assetId, setAssetId] = useState<ArcPaymentAssetId>("USDC");
  const [assetBalance, setAssetBalance] = useState("0.00");
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [payment, setPayment] = useState<PaymentState>({ kind: "idle", message: "" });
  const correctChain = wallet.chainId === ARC_TESTNET.id;
  const selectedAsset = ARC_PAYMENT_ASSETS[assetId];

  const refreshAssetBalance = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider || !wallet.account || !correctChain) {
      setAssetBalance("0.00");
      return;
    }
    setBalanceLoading(true);
    try {
      const balance = await readArcTokenBalance(provider, wallet.account, selectedAsset);
      setAssetBalance(balance.formatted);
    } catch {
      setAssetBalance("Unavailable");
    } finally {
      setBalanceLoading(false);
    }
  }, [correctChain, selectedAsset, wallet.account]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => void refreshAssetBalance(), 0);
    return () => window.clearTimeout(refreshTimer);
  }, [refreshAssetBalance]);

  async function sendPayment() {
    setPayment({ kind: "idle", message: "" });
    const provider = getInjectedProvider();
    if (!provider) return setPayment({ kind: "error", message: "No injected wallet was detected." });
    let sender = wallet.account;
    if (!sender) sender = await wallet.connect();
    if (!sender) return;
    if (!isAddress(recipient)) return setPayment({ kind: "error", message: "Enter a valid 0x wallet address." });
    try {
      const transfer = createArcTokenTransfer(selectedAsset, recipient, amount);
      if (wallet.chainId !== ARC_TESTNET.id && !(await wallet.addOrSwitchArc())) return;
      setPayment({ kind: "pending", message: `Review the ${selectedAsset.symbol} transfer in your wallet.` });
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: sender, to: transfer.to, data: transfer.data }],
      });
      if (typeof hash !== "string") throw new Error("The wallet did not return a transaction hash.");
      setPayment({ kind: "success", message: `${selectedAsset.symbol} transfer submitted to Arc Testnet.`, hash });
      await wallet.refresh();
      await refreshAssetBalance();
    } catch (cause) {
      setPayment({ kind: "error", message: cause instanceof Error ? cause.message : "The payment was not submitted." });
    }
  }

  return (
    <section className="view-page page-shell">
      <div className="view-hero">
        <div><span className="eyebrow">MULTI-ASSET TREASURY / ARC TESTNET</span><h1>Move value.<br /><em>Keep gas simple.</em></h1></div>
        <p>Send USDC, EURC, or cirBTC through one focused treasury surface. Arc keeps network fees in USDC while each transfer remains denominated in the asset you selected.</p>
      </div>

      <div className="payment-layout">
        <article className="payment-form panel-light">
          <div className="section-heading"><div><span>Arc asset transfer</span><h2>Send payment</h2></div><span className="asset-chip">{selectedAsset.symbol}</span></div>
          <div className="asset-selector" role="group" aria-label="Payment asset">
            {(Object.keys(ARC_PAYMENT_ASSETS) as ArcPaymentAssetId[]).map((candidate) => {
              const asset = ARC_PAYMENT_ASSETS[candidate];
              return (
                <button
                  type="button"
                  className={assetId === candidate ? "active" : ""}
                  key={candidate}
                  onClick={() => {
                    setAssetId(candidate);
                    setAmount("");
                    setPayment({ kind: "idle", message: "" });
                  }}
                >
                  <i><AssetIcon asset={candidate} /></i>
                  <span><strong>{asset.symbol}</strong><small>{asset.name}</small></span>
                </button>
              );
            })}
          </div>
          <label className="payment-label" htmlFor="recipient">Recipient wallet</label>
          <input id="recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="0x..." autoComplete="off" />
          <label className="payment-label" htmlFor="amount">Amount</label>
          <div className="amount-field"><input id="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /><span>{selectedAsset.symbol}</span></div>
          <div className="amount-presets">{(assetId === "cirBTC" ? ["0.001", "0.005", "0.01", "0.05"] : ["1", "5", "10", "25"]).map((value) => <button type="button" key={value} onClick={() => setAmount(value)}>{value} {selectedAsset.symbol}</button>)}</div>
          <div className="asset-context-line"><span>{selectedAsset.role}</span><small>Gas remains USDC</small></div>
          <button className="payment-button" type="button" onClick={() => void sendPayment()} disabled={payment.kind === "pending"}>{payment.kind === "pending" ? "Waiting for wallet" : wallet.account ? `Send ${selectedAsset.symbol} on Arc` : "Connect and send"}<ArrowIcon /></button>
          {payment.message && <div className={`payment-status is-${payment.kind}`} role="status"><span>{payment.message}</span>{payment.hash && <a href={`${ARC_TESTNET.explorerUrl}/tx/${payment.hash}`} target="_blank" rel="noreferrer">View transaction <ExternalIcon /></a>}</div>}
        </article>

        <aside className="payment-context">
          <div className="wallet-overview">
            <div className="wallet-overview-top"><span>Wallet state</span><StatusPill ready={Boolean(wallet.account && correctChain)}>{wallet.account && correctChain ? "READY TO SEND" : "ACTION REQUIRED"}</StatusPill></div>
            <div className="balance-display"><small>{selectedAsset.name} available</small><strong>{balanceLoading ? "..." : wallet.account && correctChain ? assetBalance : "0.00"}<span>{selectedAsset.symbol}</span></strong></div>
            <dl><div><dt>Wallet</dt><dd>{wallet.account ? shortAddress(wallet.account) : "Not connected"}</dd></div><div><dt>Network</dt><dd className={wallet.account && !correctChain ? "warning" : ""}>{correctChain ? "Arc Testnet" : wallet.account ? "Wrong network" : "Not selected"}</dd></div><div><dt>Finality</dt><dd>One confirmation</dd></div><div><dt>Gas asset</dt><dd>USDC</dd></div></dl>
            <div className="wallet-overview-actions"><button type="button" onClick={() => wallet.account ? void Promise.all([wallet.refresh(), refreshAssetBalance()]) : void wallet.connect()} disabled={wallet.busy || balanceLoading}>{wallet.account ? "Refresh balances" : "Connect wallet"}</button><button type="button" onClick={() => void wallet.addOrSwitchArc()} disabled={wallet.busy}>{correctChain ? "Arc selected" : "Add Arc Testnet"}</button></div>
          </div>
          <div className="payment-note"><span>One network, three settlement assets</span><p>USDC handles Arc gas. USDC and EURC cover dollar and euro payments, while cirBTC adds a Bitcoin-denominated test asset without changing the wallet flow.</p></div>
        </aside>
      </div>

      <div className="payment-principles">
        <article><i><SignalIcon kind="settle" /></i><span>01</span><h3>Asset-aware</h3><p>Choose the settlement unit that matches the payment instead of forcing every transfer into one token.</p></article>
        <article><i><SignalIcon kind="verify" /></i><span>02</span><h3>Deterministic finality</h3><p>One committed Arc block is final, with no reorg waiting window.</p></article>
        <article><i><SignalIcon kind="intent" /></i><span>03</span><h3>USDC gas throughout</h3><p>EURC and cirBTC transfers still use USDC for network fees, so no extra volatile gas asset is required.</p></article>
      </div>
    </section>
  );
}

function BuildOnArcBand() {
  return (
    <section className="build-band page-shell">
      <div className="build-band-glow" aria-hidden="true" />
      <div className="build-band-copy"><span>BUILT FOR PROGRAMMABLE MONEY</span><h2>Build on Arc</h2><p>Stablecoin-native settlement, sub-second finality, and an emerging machine economy give KNOT the right place to make verified work payable.</p><a href="https://docs.arc.io/build" target="_blank" rel="noreferrer">Start building <ArrowIcon /></a></div>
      <div className="arc-brand-lockup"><small>POWERED BY</small><span className="arc-brand-logo"><Image src="/arc-logo-official.webp" alt="Arc" fill sizes="(max-width: 640px) 70vw, 260px" priority /></span></div>
      <div className="x402-signal" aria-hidden="true"><span>HTTP</span><strong>402</strong><span>PAYMENT REQUIRED</span></div>
    </section>
  );
}

function DeveloperPlayground() {
  const [endpoint, setEndpoint] = useState<PlaygroundEndpoint>("quote");
  const [response, setResponse] = useState<PlaygroundResponse>({
    status: "idle",
    body: "Select an operation and run it against this live KNOT deployment.",
  });
  const [copied, setCopied] = useState(false);
  const selected = playgroundEndpoints[endpoint];

  const requestBody = selected.body ? JSON.stringify(selected.body, null, 2) : null;
  const requestSnippet = selected.method === "GET"
    ? `fetch("${selected.path}")`
    : `fetch("${selected.path}", {\n  method: "POST",\n  headers: { "content-type": "application/json" },\n  body: JSON.stringify(${requestBody})\n})`;

  const runEndpoint = useCallback(async (key: PlaygroundEndpoint) => {
    const request = playgroundEndpoints[key];
    setEndpoint(key);
    setResponse({ status: "loading", body: "KNOT is processing the request..." });
    const startedAt = performance.now();
    try {
      const apiResponse = await fetch(request.path, {
        method: request.method,
        headers: request.body ? { "content-type": "application/json" } : undefined,
        body: request.body ? JSON.stringify(request.body) : undefined,
      });
      const raw = await apiResponse.text();
      let body = raw;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
        body = JSON.stringify(parsed, null, 2);
      } catch {
        // Preserve non-JSON responses for debugging.
      }
      const receiptId = apiResponse.ok
        && request.path === "/api/executions"
        && parsed
        && typeof parsed === "object"
        && "id" in parsed
        && typeof parsed.id === "string"
        ? parsed.id
        : undefined;
      if (receiptId) rememberReceiptId(receiptId);
      setResponse({
        status: apiResponse.ok ? "success" : "error",
        httpStatus: apiResponse.status,
        latencyMs: Math.round(performance.now() - startedAt),
        receiptId,
        body: body.slice(0, 24_000),
      });
    } catch (cause) {
      setResponse({
        status: "error",
        latencyMs: Math.round(performance.now() - startedAt),
        body: cause instanceof Error ? cause.message : "The request could not be completed.",
      });
    }
  }, []);

  const run = useCallback(() => runEndpoint(endpoint), [endpoint, runEndpoint]);

  const copyCurl = useCallback(async () => {
    const origin = window.location.origin;
    const command = selected.method === "GET"
      ? `curl "${origin}${selected.path}"`
      : `curl -X POST "${origin}${selected.path}" -H "content-type: application/json" --data '${JSON.stringify(selected.body)}'`;
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [selected]);

  return (
    <div className="api-workbench">
      <header>
        <div><span>LIVE API WORKBENCH</span><h3>Call the protocol, not a mock.</h3></div>
        <span className={`api-workbench-status is-${response.status}`}><i />{response.status === "loading" ? "RUNNING" : response.httpStatus ? `HTTP ${response.httpStatus}` : "READY"}</span>
      </header>
      <div className="api-reference-actions" aria-label="Machine-readable protocol documents">
        {protocolReferenceEndpoints.map((key) => (
          <button key={key} type="button" className={endpoint === key ? "active" : ""} onClick={() => void runEndpoint(key)} disabled={response.status === "loading"}>
            <small>GET</small><span>{playgroundEndpoints[key].label}</span><ArrowIcon />
          </button>
        ))}
      </div>
      <div className="api-endpoint-tabs" role="tablist" aria-label="KNOT API examples">
        {primaryPlaygroundEndpoints.map((key) => (
          <button key={key} type="button" role="tab" aria-selected={endpoint === key} className={endpoint === key ? "active" : ""} onClick={() => { setEndpoint(key); setResponse({ status: "idle", body: "Ready to call the selected endpoint." }); }}>
            <small>{playgroundEndpoints[key].method}</small>
            <span>{playgroundEndpoints[key].label}</span>
          </button>
        ))}
      </div>
      <div className="api-workbench-grid">
        <section className="api-request-pane">
          <div className="api-pane-heading"><span>REQUEST</span><code>{selected.method} {selected.path}</code></div>
          <p>{selected.summary}</p>
          <pre>{requestSnippet}</pre>
          <div className="api-request-actions">
            <button type="button" onClick={() => void run()} disabled={response.status === "loading"}>{response.status === "loading" ? "Running KNOT" : "Run request"} <ArrowIcon /></button>
            <button type="button" onClick={() => void copyCurl()}>{copied ? "Copied" : "Copy cURL"}</button>
          </div>
        </section>
        <section className="api-response-pane" aria-live="polite">
          <div className="api-pane-heading">
            <span>RESPONSE</span>
            {response.receiptId
              ? <a href={`/receipt/${response.receiptId}`}>Open receipt <ArrowIcon /></a>
              : <small>{response.latencyMs ? `${response.latencyMs} ms` : "Awaiting request"}</small>}
          </div>
          <pre>{response.body}</pre>
        </section>
      </div>
      <footer><span><i />Public proof calls never spend the connected browser wallet.</span><p>Server agents can add authorization and a personal Circle wallet for live x402 settlement.</p></footer>
    </div>
  );
}

function ExploreView() {
  return (
    <section className="view-page explore-page page-shell">
      <div className="view-hero explore-hero">
        <div><span className="eyebrow">ECOSYSTEM FIELD GUIDE</span><h1><span>Understand the rail.</span><em>Then build beyond it.</em></h1></div>
        <div className="explore-aside"><div className="explore-live-rail" aria-hidden="true"><span><SignalIcon kind="intent" /></span><i /><span><SignalIcon kind="market" /></span><i /><span><SignalIcon kind="verify" /></span><i /><span><SignalIcon kind="settle" /></span><b /></div><p>A focused map of the Arc and Circle resources behind KNOT: the network, stablecoin settlement, agent standards, and x402 machine payments.</p><dl><div><dt>Native value</dt><dd>USDC</dd></div><div><dt>Finality</dt><dd>Sub-second</dd></div><div><dt>Machine rail</dt><dd>x402</dd></div></dl></div>
      </div>

      <BuildOnArcBand />

      <section className="marketplace-surface">
        <div className="marketplace-copy">
          <span>PROVIDER MARKETPLACE</span>
          <h2>KNOT earns only when evidence clears.</h2>
          <p>Rejected work does not release provider payment or protocol fees. Accepted evidence creates the settlement event, the receipt, and the marketplace revenue moment.</p>
          <dl>
            <div><dt>Protocol fee</dt><dd>120 bps</dd></div>
            <div><dt>Settlement asset</dt><dd>USDC</dd></div>
            <div><dt>Supply model</dt><dd>Paid evidence providers</dd></div>
          </dl>
        </div>
        <div className="marketplace-providers">
          {marketplaceProviders.map((provider) => (
            <article key={provider.name}>
              <span>{provider.id} / {provider.tier}</span>
              <h3>{provider.name}</h3>
              <p>{provider.fit}</p>
              <dl>
                <div><dt>Provider</dt><dd>{provider.price} USDC</dd></div>
                <div><dt>KNOT fee</dt><dd>{provider.fee}</dd></div>
                <div><dt>Buyer total</dt><dd>{provider.total}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="developer-surface">
        <div className="developer-copy">
          <span>DEVELOPER SURFACE</span>
          <h2>Wire KNOT into an agent in minutes.</h2>
          <p>The app exposes discovery, OpenAPI, marketplace economics, a launch kit, preflight quotes, typed receipt reads, and a protected execution path for server-side agents.</p>
        </div>
        <div className="developer-card">
          <div><span>GET</span><code>/.well-known/knot</code><small>Agent discovery with capabilities, auth boundaries, and recommended flow.</small></div>
          <div><span>GET</span><code>/api/openapi</code><small>OpenAPI 3.1 contract for quote, execute, receipt, and status calls.</small></div>
          <div><span>GET</span><code>/api/submission</code><small>Judge-ready project brief with problem, demo flow, users, and live proof.</small></div>
          <div><span>GET</span><code>/api/launch</code><small>Domain readiness, utility, revenue paths, and TGE-safe guardrails.</small></div>
          <div><span>GET</span><code>/api/marketplace</code><small>Provider supply, policy products, and accepted-settlement economics.</small></div>
          <div><span>POST</span><code>/api/quote</code><small>Preflight route, max spend, and provider fallback reasons before execution.</small></div>
          <div><span>POST</span><code>/api/executions</code><small>Run an obligation and receive a signed settlement receipt.</small></div>
          <div><span>GET</span><code>/api/manifest</code><small>Read jobs, policies, contracts, examples, and endpoint metadata.</small></div>
          <div><span>GET</span><code>/api/system/status</code><small>Check live rails without exposing configured secrets.</small></div>
        </div>
        <DeveloperPlayground />
      </section>

      <div className="resource-heading"><div><span>Curated resources</span><h2>Explore the stack</h2></div><p>Official references only. Every link opens the source used to shape KNOT&apos;s architecture.</p></div>
      <div className="resource-grid">
        {resources.map((resource) => <a className={`resource-card tone-${resource.tone}`} href={resource.href} target="_blank" rel="noreferrer" key={resource.number}><div><span>{resource.number}</span><small>{resource.label}</small><ExternalIcon /></div><i className="resource-symbol"><ProtocolIcon kind={resource.icon} /></i><h3>{resource.title}</h3><p>{resource.copy}</p><b>Open resource <ArrowIcon /></b></a>)}
      </div>

      <section className="stack-story">
        <div className="stack-story-title"><span>Why these pieces matter</span><h2>One market.<br />Four trust boundaries.</h2></div>
        <div className="stack-layers">
          <article><span>ARC</span><strong>Settlement</strong><p>USDC-native value movement with deterministic, sub-second finality.</p></article>
          <article><span>x402</span><strong>Negotiation</strong><p>Services price access directly inside the request-response cycle.</p></article>
          <article><span>KNOT</span><strong>Verification</strong><p>Evidence conditions decide whether delivered work deserves payment.</p></article>
          <article><span>8183</span><strong>Enforcement</strong><p>The completion hook binds accepted evidence to the onchain job lifecycle.</p></article>
        </div>
      </section>
    </section>
  );
}

export function KnotConsole() {
  const [view, setView] = useState<View>("console");
  const [theme, setTheme] = useState<Theme>("dark");
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const wallet = useArcWallet();
  const agent = useAgentWallet(wallet);

  useEffect(() => {
    const syncViewFromHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash === "payment" || hash === "explore" || hash === "receipts" || hash === "console") setView(hash);
    };
    const initialSync = window.setTimeout(syncViewFromHash, 0);
    window.addEventListener("hashchange", syncViewFromHash);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener("hashchange", syncViewFromHash);
    };
  }, []);

  useEffect(() => {
    const syncTheme = window.setTimeout(() => {
      const requested = new URLSearchParams(window.location.search).get("theme");
      const stored = window.localStorage.getItem("knot-theme");
      const initial = requested === "light" || requested === "dark" ? requested : stored === "light" || stored === "dark" ? stored : "dark";
      setTheme(initial);
      document.documentElement.dataset.theme = initial;
    }, 0);
    return () => window.clearTimeout(syncTheme);
  }, []);

  useEffect(() => {
    fetch("/api/system/status").then((response) => response.json()).then((data: SystemStatus) => setSystem(data)).catch(() => setSystem(null));
  }, []);

  function navigateTo(nextView: View) {
    setView(nextView);
    window.history.replaceState(null, "", `#${nextView}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("knot-theme", nextTheme);
  }

  return (
    <main className="app-root">
      <div className="ambient-grid" />
      <SiteHeader view={view} setView={navigateTo} theme={theme} setTheme={updateTheme} wallet={wallet} />
      {view === "console" && <ConsoleView wallet={wallet} agent={agent} system={system} />}
      {view === "receipts" && <ReceiptsView system={system} />}
      {view === "payment" && <PaymentView wallet={wallet} />}
      {view === "explore" && <ExploreView />}
      <footer className="site-footer page-shell"><div className="brand"><KnotMark /><span><b>KNOT</b><small>PAY FOR VERIFIED OUTCOMES</small></span></div><p>Built for autonomous commerce on Arc.</p><div><span>ARC TESTNET</span><span>USDC</span><span>x402</span><span>ERC-8183</span></div></footer>
    </main>
  );
}
