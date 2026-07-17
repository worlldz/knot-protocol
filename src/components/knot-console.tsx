"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAddress } from "viem";
import {
  ARC_TESTNET,
  formatArcBalance,
  getInjectedProvider,
  parseArcPaymentAmount,
  parseChainId,
  requestDifferentAccount,
  shortAddress,
} from "@/lib/arc-network";
import type { Execution, ExecutionEvent, ProviderAttempt, VerificationCheck } from "@/lib/knot/schemas";

type SystemStatus = {
  mode: "local" | "live";
  services: { verificationEngine: string; x402Buyer: string; x402Seller: string; settlementHook: string };
};

type View = "console" | "payment" | "explore";
type Theme = "light" | "dark";
type PaymentState = { kind: "idle" | "pending" | "success" | "error"; message: string; hash?: string };

const defaultTask = "Fetch a current, signed wallet risk assessment and return a confidence score.";
const proofLabels = ["Price ceiling", "Response latency", "Data freshness", "Required schema", "Provider signature"];

const resources = [
  { number: "01", label: "Arc network", title: "The stablecoin-native L1", copy: "Learn how Arc makes programmable money feel immediate, predictable, and EVM-native.", href: "https://www.arc.io/", tone: "lime" },
  { number: "02", label: "Developer docs", title: "Build on Arc", copy: "Network configuration, contracts, App Kit, agent patterns, and production integration guides.", href: "https://docs.arc.io/", tone: "mint" },
  { number: "03", label: "Block explorer", title: "Inspect Arc Testnet", copy: "Follow blocks, transactions, verified contracts, fees, and activity directly on Arcscan.", href: "https://testnet.arcscan.app/", tone: "blue" },
  { number: "04", label: "Agentic economy", title: "Agents as economic actors", copy: "Explore Arc's ERC-8004 identity and ERC-8183 job settlement foundations.", href: "https://docs.arc.io/build/agentic-economy", tone: "orange" },
  { number: "05", label: "Circle Gateway", title: "Understand x402", copy: "See how HTTP-native payment negotiation and batched nanopayments serve machine commerce.", href: "https://developers.circle.com/gateway/nanopayments/concepts/x402", tone: "violet" },
  { number: "06", label: "Testnet funds", title: "Open the faucet", copy: "Fund a wallet with test USDC and start sending, settling, and deploying on Arc.", href: "https://faucet.circle.com/", tone: "rose" },
] as const;

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

function ExternalIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4h9v9M16 4 8.5 11.5M14 10v5H4V5h5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ShortHash({ value }: { value: string | null }) {
  return value ? <span title={value}>{`${value.slice(0, 10)}...${value.slice(-8)}`}</span> : <span>Not issued</span>;
}

function StatusPill({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  return <span className={`status-pill ${ready ? "is-ready" : "is-pending"}`}><i />{children}</span>;
}

function TraceEvent({ item, last }: { item: ExecutionEvent; last: boolean }) {
  const label = { discovery: "DISCOVER", quote: "QUOTE", payment: "PAYMENT INTENT", verification: "VERIFY", fallback: "ROUTE", settlement: "SETTLE" }[item.kind];
  return (
    <li className="trace-event event-enter">
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
  return (
    <article className={`provider-card ${accepted ? "is-accepted" : ""}`}>
      <div className="provider-topline"><span>SIMULATED PROVIDER / 0{index + 1}</span><span className={`outcome ${accepted ? "good" : rejected ? "bad" : ""}`}>{accepted ? "SELECTED" : rejected ? "REJECTED" : "STANDBY"}</span></div>
      <h3>{attempt?.provider ?? (index === 0 ? "Signal Forge" : "Northstar Data")}</h3>
      <div className="provider-stats">
        <div><span>Quote</span><b>{attempt ? attempt.priceUsdc.toFixed(3) : index === 0 ? "0.018" : "0.024"} USDC</b></div>
        <div><span>Reputation</span><b>{attempt?.reputation ?? (index === 0 ? 71 : 94)} / 100</b></div>
        <div><span>Proof</span><b>{attempt?.proofSupport ?? true ? "Supported" : "Missing"}</b></div>
      </div>
      <p className="provider-note">{accepted ? "Evidence met the full obligation. This provider received settlement authorization." : rejected ? "The low quote was not enough. Stale, incomplete evidence triggered automatic fallback." : index === 0 ? "A local demo fixture: the cheaper response intentionally fails freshness so KNOT can demonstrate autonomous fallback." : "A local demo fixture: the higher-trust provider returns current, complete evidence inside the job ceiling."}</p>
      <p className="provider-fixture">Demo reputation scores are fixed in local mode. Live providers will supply verifiable reputation signals.</p>
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

function useArcWallet() {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState("0.00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disconnected = useRef(false);

  const refresh = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) return;
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
        <button className="brand brand-button" type="button" onClick={() => setView("console")} aria-label="KNOT clearing console"><KnotMark /><span><b>KNOT</b><small>VERIFICATION-NATIVE SETTLEMENT</small></span></button>
        <div className="view-tabs" role="tablist" aria-label="KNOT views">
          <button type="button" role="tab" aria-selected={view === "console"} className={view === "console" ? "active" : ""} onClick={() => setView("console")}>Clearing console</button>
          <button type="button" role="tab" aria-selected={view === "payment"} className={view === "payment" ? "active" : ""} onClick={() => setView("payment")}>Send payment</button>
          <button type="button" role="tab" aria-selected={view === "explore"} className={view === "explore" ? "active" : ""} onClick={() => setView("explore")}>Explore Arc</button>
        </div>
        <div className="nav-actions"><ThemeButton theme={theme} onToggle={() => setTheme(theme === "dark" ? "light" : "dark")} /><WalletDock wallet={wallet} /></div>
      </nav>
      {wallet.error && <div className="wallet-alert page-shell" role="alert">{wallet.error}</div>}
    </header>
  );
}

function NetworkRibbon({ wallet, system }: { wallet: ReturnType<typeof useArcWallet>; system: SystemStatus | null }) {
  const correctChain = wallet.chainId === ARC_TESTNET.id;
  return (
    <section className="network-ribbon page-shell" aria-label="Network and payment rail status">
      <div className="ribbon-intro"><span>Live environment</span><p>KNOT is wired for Arc. Connect a funded wallet when you are ready to move beyond the safe demo.</p></div>
      <div className="ribbon-metric"><i className="metric-glyph">A</i><span><small>Network</small><b>{correctChain ? "Arc Testnet connected" : "Arc Testnet"}</b></span></div>
      <div className="ribbon-metric"><i className="metric-glyph">$</i><span><small>Money</small><b>{wallet.account && correctChain ? `${wallet.balance} USDC` : "Native USDC"}</b></span></div>
      <div className="ribbon-metric"><i className="metric-glyph">402</i><span><small>Rail</small><b>{system?.mode === "live" ? "x402 live" : "x402 ready"}</b></span></div>
      <button type="button" className="ribbon-action" onClick={() => void wallet.addOrSwitchArc()} disabled={wallet.busy}>{correctChain ? "Arc is selected" : "Add Arc Testnet"}<ArrowIcon /></button>
    </section>
  );
}

function ConsoleView({ wallet, system }: { wallet: ReturnType<typeof useArcWallet>; system: SystemStatus | null }) {
  const [task, setTask] = useState(defaultTask);
  const [maxPrice, setMaxPrice] = useState("0.030");
  const [execution, setExecution] = useState<Execution | null>(null);
  const [visibleEvents, setVisibleEvents] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!execution || visibleEvents >= execution.events.length) return;
    const timer = window.setTimeout(() => setVisibleEvents((count) => count + 1), visibleEvents === 0 ? 120 : 430);
    return () => window.clearTimeout(timer);
  }, [execution, visibleEvents]);

  const acceptedAttempt = useMemo(() => execution?.attempts.find((attempt) => attempt.outcome === "accepted"), [execution]);
  const visibleTrace = execution?.events.slice(0, visibleEvents) ?? [];
  const completed = Boolean(execution && visibleEvents >= execution.events.length);
  const checks = acceptedAttempt?.verification.checks;
  const busy = running || Boolean(execution && !completed);

  async function runAgent() {
    setError(null); setExecution(null); setVisibleEvents(0); setRunning(true);
    try {
      const response = await fetch("/api/executions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task, maxPriceUsdc: Number(maxPrice) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Execution could not be created.");
      setExecution(data as Execution);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Execution failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <section className="hero page-shell">
        <div className="hero-kicker"><span>01</span><p>THE TRUST LAYER BETWEEN AGENT INTENT AND MACHINE PAYMENT</p></div>
        <div className="hero-grid">
          <h1>Agents can pay.<span>KNOT checks delivery.</span></h1>
          <div className="hero-aside">
            <p>Autonomous services should not get paid for stale, malformed, or missing work. KNOT turns a buyer&apos;s intent into enforceable evidence conditions before USDC settlement.</p>
            <div className="hero-proof"><span><i />Evidence-bound</span><span><i />Fallback-aware</span><span><i />Settlement-safe</span></div>
          </div>
        </div>
      </section>

      <NetworkRibbon wallet={wallet} system={system} />

      <section className="workspace page-shell" aria-label="KNOT execution workspace">
        <article className="mission-panel panel-light">
          <div className="section-heading"><div><span>Active obligation</span><h2>Define the job, not every step.</h2></div><span className="job-chip">JOB / 001</span></div>
          <label className="field-label" htmlFor="task">Service intent</label>
          <textarea id="task" value={task} onChange={(event) => setTask(event.target.value)} maxLength={280} rows={4} />
          <div className="constraint-grid">
            <label><span>Max price</span><select value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}><option value="0.025">0.025 USDC</option><option value="0.030">0.030 USDC</option><option value="0.050">0.050 USDC</option></select></label>
            <div><span>Max age</span><strong>90 sec</strong></div><div><span>Max latency</span><strong>1,400 ms</strong></div><div><span>Signature</span><strong>Required</strong></div>
          </div>
          <button className="run-button" type="button" onClick={runAgent} disabled={busy || task.trim().length < 12}><span>{busy ? "Agent is clearing the job" : "Run autonomous job"}</span><ArrowIcon /></button>
          <div className="mode-note"><span>Safe demo mode</span><p>Real decision API. Simulated value rail. No wallet or funds are used by this console run.</p></div>
          {error && <p className="error-message" role="alert">{error}</p>}
        </article>

        <article className="trace-panel">
          <div className="trace-header"><div><span>Agent execution</span><h2>Clearing trace</h2></div><div className="trace-counter"><strong>{String(visibleTrace.length).padStart(2, "0")}</strong><span>Events</span></div></div>
          {visibleTrace.length === 0 ? <div className="trace-empty"><KnotMark /><p>The clearing engine is standing by.</p><span>Run the obligation to inspect every decision</span></div> : <ol className="trace-list">{visibleTrace.map((item, index) => <TraceEvent key={item.id} item={item} last={index === visibleTrace.length - 1 && completed} />)}</ol>}
          <footer className="trace-footer"><span>Execution ID</span><code>{execution?.id ?? "NOT ISSUED"}</code><span className={completed ? "complete" : ""}>{completed ? "TRACE SEALED" : "AWAITING RUN"}</span></footer>
        </article>
      </section>

      <section className="results page-shell">
        <div className="section-index"><span>02</span><p>MARKET SELECTION</p></div>
        <div className="provider-grid"><ProviderCard attempt={execution?.attempts[0]} index={0} /><ProviderCard attempt={execution?.attempts[1]} index={1} /></div>
        <div className="evidence-grid">
          <article className="proof-panel panel-light">
            <div className="section-heading compact"><div><span>Evidence envelope</span><h2>Verification matrix</h2></div><span className={`proof-score ${completed ? "ready" : ""}`}>{completed ? `${checks?.filter((check) => check.passed).length ?? 0} / 5 PASS` : "WAITING"}</span></div>
            <div className="proof-list">{proofLabels.map((label, index) => <ProofRow key={label} label={label} check={checks?.[index]} />)}</div>
          </article>
          <article className={`settlement-panel ${completed ? "is-authorized" : ""}`}>
            <div className="settlement-orbit" aria-hidden="true"><i /><i /><i /></div>
            <div className="settlement-heading"><span>Settlement authorization</span><b>{completed ? "AUTHORIZED" : "LOCKED"}</b></div>
            <p className="settlement-amount">{completed ? execution?.settlement.amountUsdc.toFixed(3) : "0.000"}<span>USDC</span></p>
            <dl className="settlement-data"><div><dt>Rail</dt><dd>{execution?.settlement.rail.toUpperCase() ?? "SIMULATED"}</dd></div><div><dt>Evidence</dt><dd><ShortHash value={execution?.settlement.evidenceHash ?? null} /></dd></div><div><dt>Onchain tx</dt><dd>{execution?.settlement.transactionHash ? <ShortHash value={execution.settlement.transactionHash} /> : "Not broadcast"}</dd></div></dl>
            <p className="settlement-disclaimer">{completed ? "The evidence is accepted. Live mode will pass this commitment to the KNOT ERC-8183 hook before value can move." : "Settlement stays unavailable until one provider satisfies every condition."}</p>
          </article>
        </div>
      </section>

      <section className="architecture page-shell">
        <div className="section-index light"><span>03</span><p>THE PROTOCOL KNOT</p></div>
        <div className="architecture-head"><h2>Payment is easy.<br />Proof is the hard part.</h2><p>KNOT is not another agent wallet. It is the policy and evidence layer that sits between service delivery and programmable money.</p></div>
        <div className="flow-map">{[["01", "INTENT", "Buyer defines measurable constraints"], ["02", "MARKET", "Providers expose paid services over x402"], ["03", "EVIDENCE", "KNOT verifies output and binds its hash"], ["04", "SETTLE", "ERC-8183 releases USDC or keeps it blocked"]].map(([number, title, copy], index) => <div className="flow-node" key={title}><span>{number}</span><h3>{title}</h3><p>{copy}</p>{index < 3 && <ArrowIcon />}</div>)}</div>
        <div className="protocol-strip"><p><span>Circle Gateway</span>Gas-free x402 nanopayment path after deposit</p><p><span>ERC-8183</span>Job lifecycle and escrow-compatible completion hook</p><p><span>ERC-8004</span>Identity and outcome reputation surface</p></div>
      </section>

      <BuildOnArcBand />
    </>
  );
}

function PaymentView({ wallet }: { wallet: ReturnType<typeof useArcWallet> }) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState<PaymentState>({ kind: "idle", message: "" });
  const correctChain = wallet.chainId === ARC_TESTNET.id;

  async function sendPayment() {
    setPayment({ kind: "idle", message: "" });
    const provider = getInjectedProvider();
    if (!provider) return setPayment({ kind: "error", message: "No injected wallet was detected." });
    let sender = wallet.account;
    if (!sender) sender = await wallet.connect();
    if (!sender) return;
    if (!isAddress(recipient)) return setPayment({ kind: "error", message: "Enter a valid 0x wallet address." });
    try {
      const value = parseArcPaymentAmount(amount);
      if (wallet.chainId !== ARC_TESTNET.id && !(await wallet.addOrSwitchArc())) return;
      setPayment({ kind: "pending", message: "Review and sign the payment in your wallet." });
      const hash = await provider.request({ method: "eth_sendTransaction", params: [{ from: sender, to: recipient, value }] });
      if (typeof hash !== "string") throw new Error("The wallet did not return a transaction hash.");
      setPayment({ kind: "success", message: "Payment submitted to Arc Testnet.", hash });
      await wallet.refresh();
    } catch (cause) {
      setPayment({ kind: "error", message: cause instanceof Error ? cause.message : "The payment was not submitted." });
    }
  }

  return (
    <section className="view-page page-shell">
      <div className="view-hero">
        <div><span className="eyebrow">DIRECT SETTLEMENT / ARC TESTNET</span><h1>Send USDC.<br /><em>Without the extra token.</em></h1></div>
        <p>Arc uses USDC as native gas and native value. Connect a wallet, select Arc Testnet, and send a direct payment with one standard EVM signature.</p>
      </div>

      <div className="payment-layout">
        <article className="payment-form panel-light">
          <div className="section-heading"><div><span>Native transfer</span><h2>Send payment</h2></div><span className="asset-chip">USDC</span></div>
          <label className="payment-label" htmlFor="recipient">Recipient wallet</label>
          <input id="recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="0x..." autoComplete="off" />
          <label className="payment-label" htmlFor="amount">Amount</label>
          <div className="amount-field"><input id="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /><span>USDC</span></div>
          <div className="amount-presets">{["1", "5", "10", "25"].map((value) => <button type="button" key={value} onClick={() => setAmount(value)}>{value} USDC</button>)}</div>
          <button className="payment-button" type="button" onClick={() => void sendPayment()} disabled={payment.kind === "pending"}>{payment.kind === "pending" ? "Waiting for wallet" : wallet.account ? "Send on Arc" : "Connect and send"}<ArrowIcon /></button>
          {payment.message && <div className={`payment-status is-${payment.kind}`} role="status"><span>{payment.message}</span>{payment.hash && <a href={`${ARC_TESTNET.explorerUrl}/tx/${payment.hash}`} target="_blank" rel="noreferrer">View transaction <ExternalIcon /></a>}</div>}
        </article>

        <aside className="payment-context">
          <div className="wallet-overview">
            <div className="wallet-overview-top"><span>Wallet state</span><StatusPill ready={Boolean(wallet.account && correctChain)}>{wallet.account && correctChain ? "READY TO SEND" : "ACTION REQUIRED"}</StatusPill></div>
            <div className="balance-display"><small>Available on Arc</small><strong>{wallet.account && correctChain ? wallet.balance : "0.00"}<span>USDC</span></strong></div>
            <dl><div><dt>Wallet</dt><dd>{wallet.account ? shortAddress(wallet.account) : "Not connected"}</dd></div><div><dt>Network</dt><dd className={wallet.account && !correctChain ? "warning" : ""}>{correctChain ? "Arc Testnet" : wallet.account ? "Wrong network" : "Not selected"}</dd></div><div><dt>Finality</dt><dd>One confirmation</dd></div><div><dt>Gas asset</dt><dd>USDC</dd></div></dl>
            <div className="wallet-overview-actions"><button type="button" onClick={() => void wallet.connect()} disabled={wallet.busy}>{wallet.account ? "Refresh wallet" : "Connect wallet"}</button><button type="button" onClick={() => void wallet.addOrSwitchArc()} disabled={wallet.busy}>{correctChain ? "Arc selected" : "Add Arc Testnet"}</button></div>
          </div>
          <div className="payment-note"><span>Why this feels different</span><p>No separate native token is required for gas. The balance you understand is also the asset that moves value and pays network fees.</p></div>
        </aside>
      </div>

      <div className="payment-principles">
        <article><span>01</span><h3>Stable by default</h3><p>Amounts, balances, and fees stay denominated in USDC.</p></article>
        <article><span>02</span><h3>Deterministic finality</h3><p>One committed Arc block is final, with no reorg waiting window.</p></article>
        <article><span>03</span><h3>Standard wallet flow</h3><p>Arc remains EVM-compatible, so familiar wallet signing still applies.</p></article>
      </div>
    </section>
  );
}

function BuildOnArcBand() {
  return (
    <section className="build-band page-shell">
      <div className="build-band-glow" aria-hidden="true" />
      <div className="build-band-copy"><span>BUILT FOR PROGRAMMABLE MONEY</span><h2>Build on Arc</h2><p>Stablecoin-native settlement, sub-second finality, and an emerging machine economy give KNOT the right place to make verified work payable.</p><a href="https://docs.arc.io/build" target="_blank" rel="noreferrer">Start building <ArrowIcon /></a></div>
      <div className="arc-brand-lockup"><small>POWERED BY</small><Image src="/arc-logo-official.webp" alt="Arc" width={260} height={71} priority /></div>
      <div className="x402-signal" aria-hidden="true"><span>HTTP</span><strong>402</strong><span>PAYMENT REQUIRED</span></div>
    </section>
  );
}

function ExploreView() {
  return (
    <section className="view-page explore-page page-shell">
      <div className="view-hero explore-hero">
        <div><span className="eyebrow">ECOSYSTEM FIELD GUIDE</span><h1><span>Understand the rail.</span><em>Then build beyond it.</em></h1></div>
        <div className="explore-aside"><p>A focused map of the Arc and Circle resources behind KNOT: the network, stablecoin settlement, agent standards, and x402 machine payments.</p><dl><div><dt>Native value</dt><dd>USDC</dd></div><div><dt>Finality</dt><dd>Sub-second</dd></div><div><dt>Machine rail</dt><dd>x402</dd></div></dl></div>
      </div>

      <BuildOnArcBand />

      <div className="resource-heading"><div><span>Curated resources</span><h2>Explore the stack</h2></div><p>Official references only. Every link opens the source used to shape KNOT&apos;s architecture.</p></div>
      <div className="resource-grid">
        {resources.map((resource) => <a className={`resource-card tone-${resource.tone}`} href={resource.href} target="_blank" rel="noreferrer" key={resource.number}><div><span>{resource.number}</span><small>{resource.label}</small><ExternalIcon /></div><h3>{resource.title}</h3><p>{resource.copy}</p><b>Open resource <ArrowIcon /></b></a>)}
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

  useEffect(() => {
    const syncViewFromHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash === "payment" || hash === "explore" || hash === "console") setView(hash);
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
      {view === "console" && <ConsoleView wallet={wallet} system={system} />}
      {view === "payment" && <PaymentView wallet={wallet} />}
      {view === "explore" && <ExploreView />}
      <footer className="site-footer page-shell"><div className="brand"><KnotMark /><span><b>KNOT</b><small>PAY FOR VERIFIED OUTCOMES</small></span></div><p>Built for autonomous commerce on Arc.</p><div><span>ARC TESTNET</span><span>USDC</span><span>x402</span><span>ERC-8183</span></div></footer>
    </main>
  );
}
