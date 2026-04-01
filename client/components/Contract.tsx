"use client";

import { useState, useCallback } from "react";
import {
  createBounty,
  submitBounty,
  voteSubmission,
  acceptBounty,
  getBounty,
  getBountyCount,
  getSubmissions,
  hasVoted,
  CONTRACT_ADDRESS,
} from "@/hooks/contract";
import { AnimatedCard } from "@/components/ui/animated-card";
import { Spotlight } from "@/components/ui/spotlight";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Icons ────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function BountyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function VoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function AwardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ── Styled Input ─────────────────────────────────────────────

function Input({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-medium uppercase tracking-wider text-white/30">
        {label}
      </label>
      <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-px transition-all focus-within:border-[#7c6cf0]/30 focus-within:shadow-[0_0_20px_rgba(124,108,240,0.08)]">
        <input
          {...props}
          className="w-full rounded-[11px] bg-transparent px-4 py-3 font-mono text-sm text-white/90 placeholder:text-white/15 outline-none"
        />
      </div>
    </div>
  );
}

// ── Textarea ────────────────────────────────────────────────

function Textarea({
  label,
  ...props
}: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-medium uppercase tracking-wider text-white/30">
        {label}
      </label>
      <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-px transition-all focus-within:border-[#7c6cf0]/30 focus-within:shadow-[0_0_20px_rgba(124,108,240,0.08)]">
        <textarea
          {...props}
          rows={3}
          className="w-full rounded-[11px] bg-transparent px-4 py-3 font-mono text-sm text-white/90 placeholder:text-white/15 outline-none resize-none"
        />
      </div>
    </div>
  );
}

// ── Status Config ────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; dot: string; variant: "success" | "warning" | "info" }> = {
  Open: { color: "text-[#34d399]", bg: "bg-[#34d399]/10", border: "border-[#34d399]/20", dot: "bg-[#34d399]", variant: "success" },
  Paid: { color: "text-[#fbbf24]", bg: "bg-[#fbbf24]/10", border: "border-[#fbbf24]/20", dot: "bg-[#fbbf24]", variant: "warning" },
  Closed: { color: "text-[#f87171]", bg: "bg-[#f87171]/10", border: "border-[#f87171]/20", dot: "bg-[#f87171]", variant: "warning" },
};

// ── Types ─────────────────────────────────────────────────────

interface BountyData {
  title: string;
  description: string;
  token: string;
  reward: string;
  deadline: string;
  creator: string;
  submission_count: number;
  vote_count: number;
  paid: boolean;
}

interface SubmissionData {
  url: string;
  submitter: string;
  votes: number;
  accepted: boolean;
}

// ── Main Component ───────────────────────────────────────────

type Tab = "browse" | "create" | "submit" | "vote" | "accept";

interface ContractUIProps {
  walletAddress: string | null;
  onConnect: () => void;
  isConnecting: boolean;
}

export default function ContractUI({ walletAddress, onConnect, isConnecting }: ContractUIProps) {
  const [activeTab, setActiveTab] = useState<Tab>("browse");
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  // Browse
  const [bountyCount, setBountyCount] = useState<number>(0);
  const [selectedBountyId, setSelectedBountyId] = useState("");
  const [bountyData, setBountyData] = useState<BountyData | null>(null);
  const [submissions, setSubmissions] = useState<Array<{ id: number; data: SubmissionData }>>([]);
  const [isBrowsing, setIsBrowsing] = useState(false);

  // Create
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createToken, setCreateToken] = useState("");
  const [createReward, setCreateReward] = useState("");
  const [createDeadline, setCreateDeadline] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Submit
  const [submitBountyId, setSubmitBountyId] = useState("");
  const [submitUrl, setSubmitUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Vote
  const [voteBountyId, setVoteBountyId] = useState("");
  const [voteSubmissionId, setVoteSubmissionId] = useState("");
  const [isVoting, setIsVoting] = useState(false);
  const [voteBountyData, setVoteBountyData] = useState<BountyData | null>(null);
  const [voteSubmissions, setVoteSubmissions] = useState<Array<{ id: number; data: SubmissionData }>>([]);
  const [isLoadingVoteData, setIsLoadingVoteData] = useState(false);

  // Accept
  const [acceptBountyId, setAcceptBountyId] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const handleBrowse = useCallback(async () => {
    if (!selectedBountyId.trim()) return setError("Enter a bounty ID");
    setError(null);
    setIsBrowsing(true);
    setBountyData(null);
    setSubmissions([]);
    try {
      const id = parseInt(selectedBountyId.trim());
      const [bounty, subs] = await Promise.all([
        getBounty(id, walletAddress || undefined),
        getSubmissions(id, walletAddress || undefined),
      ]);
      if (bounty) {
        const b = bounty as Record<string, unknown>;
        setBountyData({
          title: String(b.title ?? ""),
          description: String(b.description ?? ""),
          token: String(b.token ?? ""),
          reward: String(b.reward ?? "0"),
          deadline: String(b.deadline ?? "0"),
          creator: String(b.creator ?? ""),
          submission_count: Number(b.submission_count ?? 0),
          vote_count: Number(b.vote_count ?? 0),
          paid: Boolean(b.paid ?? false),
        });
        if (subs && Array.isArray(subs)) {
          setSubmissions(
            subs.map((s: unknown) => {
              const [id, data] = s as [number, Record<string, unknown>];
              return {
                id,
                data: {
                  url: String(data.url ?? ""),
                  submitter: String(data.submitter ?? ""),
                  votes: Number(data.votes ?? 0),
                  accepted: Boolean(data.accepted ?? false),
                },
              };
            })
          );
        }
      } else {
        setError("Bounty not found");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setIsBrowsing(false);
    }
  }, [selectedBountyId, walletAddress]);

  const handleLoadCount = useCallback(async () => {
    try {
      const count = await getBountyCount(walletAddress || undefined);
      setBountyCount(count !== null ? Number(count) : 0);
    } catch {
      // ignore
    }
  }, [walletAddress]);

  const handleCreate = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    if (!createTitle.trim() || !createDesc.trim() || !createToken.trim() || !createReward.trim() || !createDeadline.trim())
      return setError("Fill in all fields");
    setError(null);
    setIsCreating(true);
    setTxStatus("Awaiting signature...");
    try {
      const deadlineSec = Math.floor(Date.now() / 1000) + parseInt(createDeadline.trim()) * 86400;
      await createBounty(
        walletAddress,
        createTitle.trim(),
        createDesc.trim(),
        createToken.trim(),
        BigInt(createReward.trim()),
        deadlineSec
      );
      setTxStatus("Bounty created on-chain!");
      setCreateTitle("");
      setCreateDesc("");
      setCreateToken("");
      setCreateReward("");
      setCreateDeadline("");
      setTimeout(() => setTxStatus(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsCreating(false);
    }
  }, [walletAddress, createTitle, createDesc, createToken, createReward, createDeadline]);

  const handleSubmit = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    if (!submitBountyId.trim() || !submitUrl.trim()) return setError("Fill in all fields");
    setError(null);
    setIsSubmitting(true);
    setTxStatus("Awaiting signature...");
    try {
      await submitBounty(walletAddress, parseInt(submitBountyId.trim()), submitUrl.trim());
      setTxStatus("Submission sent on-chain!");
      setSubmitBountyId("");
      setSubmitUrl("");
      setTimeout(() => setTxStatus(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [walletAddress, submitBountyId, submitUrl]);

  const handleLoadVoteData = useCallback(async () => {
    if (!voteBountyId.trim()) return setError("Enter a bounty ID");
    setError(null);
    setIsLoadingVoteData(true);
    setVoteBountyData(null);
    setVoteSubmissions([]);
    try {
      const id = parseInt(voteBountyId.trim());
      const [bounty, subs] = await Promise.all([
        getBounty(id, walletAddress || undefined),
        getSubmissions(id, walletAddress || undefined),
      ]);
      if (bounty) {
        const b = bounty as Record<string, unknown>;
        setVoteBountyData({
          title: String(b.title ?? ""),
          description: String(b.description ?? ""),
          token: String(b.token ?? ""),
          reward: String(b.reward ?? "0"),
          deadline: String(b.deadline ?? "0"),
          creator: String(b.creator ?? ""),
          submission_count: Number(b.submission_count ?? 0),
          vote_count: Number(b.vote_count ?? 0),
          paid: Boolean(b.paid ?? false),
        });
        if (subs && Array.isArray(subs)) {
          setVoteSubmissions(
            subs.map((s: unknown) => {
              const [sid, data] = s as [number, Record<string, unknown>];
              return {
                id: sid,
                data: {
                  url: String(data.url ?? ""),
                  submitter: String(data.submitter ?? ""),
                  votes: Number(data.votes ?? 0),
                  accepted: Boolean(data.accepted ?? false),
                },
              };
            })
          );
        }
      } else {
        setError("Bounty not found");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setIsLoadingVoteData(false);
    }
  }, [voteBountyId, walletAddress]);

  const handleVote = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    if (!voteBountyId.trim() || !voteSubmissionId.trim()) return setError("Enter bounty and submission IDs");
    setError(null);
    setIsVoting(true);
    setTxStatus("Awaiting signature...");
    try {
      await voteSubmission(
        walletAddress,
        parseInt(voteBountyId.trim()),
        parseInt(voteSubmissionId.trim())
      );
      setTxStatus("Vote recorded on-chain!");
      setVoteSubmissionId("");
      setTimeout(() => setTxStatus(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsVoting(false);
    }
  }, [walletAddress, voteBountyId, voteSubmissionId]);

  const handleAccept = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    if (!acceptBountyId.trim()) return setError("Enter a bounty ID");
    setError(null);
    setIsAccepting(true);
    setTxStatus("Awaiting signature...");
    try {
      await acceptBounty(walletAddress, parseInt(acceptBountyId.trim()));
      setTxStatus("Reward paid on-chain!");
      setTimeout(() => setTxStatus(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsAccepting(false);
    }
  }, [walletAddress, acceptBountyId]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "browse", label: "Browse", icon: <AwardIcon />, color: "#4fc3f7" },
    { key: "create", label: "Create", icon: <PlusIcon />, color: "#7c6cf0" },
    { key: "submit", label: "Submit", icon: <SendIcon />, color: "#34d399" },
    { key: "vote", label: "Vote", icon: <VoteIcon />, color: "#fbbf24" },
    { key: "accept", label: "Accept", icon: <AwardIcon />, color: "#f87171" },
  ];

  return (
    <div className="w-full max-w-2xl animate-fade-in-up-delayed">
      {/* Toasts */}
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#f87171]/15 bg-[#f87171]/[0.05] px-4 py-3 backdrop-blur-sm animate-slide-down">
          <span className="mt-0.5 text-[#f87171]"><AlertIcon /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#f87171]/90">Error</p>
            <p className="text-xs text-[#f87171]/50 mt-0.5 break-all">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="shrink-0 text-[#f87171]/30 hover:text-[#f87171]/70 text-lg leading-none">&times;</button>
        </div>
      )}

      {txStatus && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#34d399]/15 bg-[#34d399]/[0.05] px-4 py-3 backdrop-blur-sm shadow-[0_0_30px_rgba(52,211,153,0.05)] animate-slide-down">
          <span className="text-[#34d399]">
            {txStatus.includes("on-chain") ? <CheckIcon /> : <SpinnerIcon />}
          </span>
          <span className="text-sm text-[#34d399]/90">{txStatus}</span>
        </div>
      )}

      {/* Main Card */}
      <Spotlight className="rounded-2xl">
        <AnimatedCard className="p-0" containerClassName="rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c6cf0]/20 to-[#fbbf24]/20 border border-white/[0.06]">
                <BountyIcon />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#fbbf24]">
                  <circle cx="12" cy="8" r="6" />
                  <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white/90">Bounty Platform</h3>
                <p className="text-[10px] text-white/25 font-mono mt-0.5">{truncate(CONTRACT_ADDRESS)}</p>
              </div>
            </div>
            <button
              onClick={handleLoadCount}
              className="text-[10px] text-white/25 hover:text-white/50 font-mono transition-colors"
            >
              Total: {bountyCount}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06] px-2 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setError(null); setTxStatus(null); }}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium transition-all whitespace-nowrap",
                  activeTab === t.key ? "text-white/90" : "text-white/35 hover:text-white/55"
                )}
              >
                <span style={activeTab === t.key ? { color: t.color } : undefined}>{t.icon}</span>
                {t.label}
                {activeTab === t.key && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full transition-all"
                    style={{ background: `linear-gradient(to right, ${t.color}, ${t.color}66)` }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6 space-y-5">

            {/* Browse */}
            {activeTab === "browse" && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 font-mono text-sm">
                  <span style={{ color: "#4fc3f7" }} className="font-semibold">fn</span>
                  <span className="text-white/70">get_bounty</span>
                  <span className="text-white/20 text-xs">(bounty_id: u64) -&gt; Option&lt;Bounty&gt;</span>
                </div>
                <Input label="Bounty ID" value={selectedBountyId} onChange={(e) => setSelectedBountyId(e.target.value)} placeholder="e.g. 0" type="number" />
                <ShimmerButton onClick={handleBrowse} disabled={isBrowsing} shimmerColor="#4fc3f7" className="w-full">
                  {isBrowsing ? <><SpinnerIcon /> Loading...</> : <><AwardIcon /> Browse Bounty</>}
                </ShimmerButton>

                {bountyData && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden animate-fade-in-up">
                    <div className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-white/25">Bounty Details</span>
                      <Badge variant={bountyData.paid ? "warning" : "success"}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", bountyData.paid ? "bg-[#fbbf24]" : "bg-[#34d399]")} />
                        {bountyData.paid ? "Paid" : "Open"}
                      </Badge>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/35">Title</span>
                        <span className="font-mono text-sm text-white/80">{bountyData.title}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/35">Creator</span>
                        <span className="font-mono text-xs text-white/80">{truncate(bountyData.creator)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/35">Reward</span>
                        <span className="font-mono text-sm text-[#fbbf24]">{bountyData.reward}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/35">Submissions</span>
                        <span className="font-mono text-sm text-white/80">{bountyData.submission_count}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/35">Votes</span>
                        <span className="font-mono text-sm text-white/80">{bountyData.vote_count}</span>
                      </div>
                    </div>
                  </div>
                )}

                {submissions.length > 0 && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden animate-fade-in-up">
                    <div className="border-b border-white/[0.06] px-4 py-3">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-white/25">Submissions ({submissions.length})</span>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                      {submissions.map(({ id, data }) => (
                        <div key={id} className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-white/50">#{id}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-white/35">{data.votes} votes</span>
                              {data.accepted && <Badge variant="warning">Accepted</Badge>}
                            </div>
                          </div>
                          <a href={data.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4fc3f7] hover:text-[#4fc3f7]/70 font-mono truncate">
                            {data.url}
                          </a>
                          <span className="text-[10px] text-white/20 font-mono">by {truncate(data.submitter)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Create */}
            {activeTab === "create" && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 font-mono text-sm">
                  <span style={{ color: "#7c6cf0" }} className="font-semibold">fn</span>
                  <span className="text-white/70">create_bounty</span>
                  <span className="text-white/20 text-xs">(creator, title, desc, token, reward, deadline)</span>
                </div>
                <Input label="Title" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="e.g. Fix critical bug" />
                <Textarea label="Description" value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} placeholder="Describe the bounty task..." />
                <Input label="Token Address (e.g. XLM)" value={createToken} onChange={(e) => setCreateToken(e.target.value)} placeholder="e.g. G... or native" />
                <Input label="Reward (i128)" value={createReward} onChange={(e) => setCreateReward(e.target.value)} placeholder="e.g. 1000000000" type="text" />
                <Input label="Deadline (days from now)" value={createDeadline} onChange={(e) => setCreateDeadline(e.target.value)} placeholder="e.g. 7" type="number" />
                {walletAddress ? (
                  <ShimmerButton onClick={handleCreate} disabled={isCreating} shimmerColor="#7c6cf0" className="w-full">
                    {isCreating ? <><SpinnerIcon /> Creating...</> : <><PlusIcon /> Create Bounty</>}
                  </ShimmerButton>
                ) : (
                  <button onClick={onConnect} disabled={isConnecting} className="w-full rounded-xl border border-dashed border-[#7c6cf0]/20 bg-[#7c6cf0]/[0.03] py-4 text-sm text-[#7c6cf0]/60 hover:border-[#7c6cf0]/30 hover:text-[#7c6cf0]/80 active:scale-[0.99] transition-all disabled:opacity-50">
                    Connect wallet to create bounties
                  </button>
                )}
              </div>
            )}

            {/* Submit */}
            {activeTab === "submit" && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 font-mono text-sm">
                  <span style={{ color: "#34d399" }} className="font-semibold">fn</span>
                  <span className="text-white/70">submit</span>
                  <span className="text-white/20 text-xs">(submitter, bounty_id, url)</span>
                </div>
                <Input label="Bounty ID" value={submitBountyId} onChange={(e) => setSubmitBountyId(e.target.value)} placeholder="e.g. 0" type="number" />
                <Input label="Submission URL" value={submitUrl} onChange={(e) => setSubmitUrl(e.target.value)} placeholder="e.g. https://github.com/..." />
                {walletAddress ? (
                  <ShimmerButton onClick={handleSubmit} disabled={isSubmitting} shimmerColor="#34d399" className="w-full">
                    {isSubmitting ? <><SpinnerIcon /> Submitting...</> : <><SendIcon /> Submit Work</>}
                  </ShimmerButton>
                ) : (
                  <button onClick={onConnect} disabled={isConnecting} className="w-full rounded-xl border border-dashed border-[#34d399]/20 bg-[#34d399]/[0.03] py-4 text-sm text-[#34d399]/60 hover:border-[#34d399]/30 hover:text-[#34d399]/80 active:scale-[0.99] transition-all disabled:opacity-50">
                    Connect wallet to submit work
                  </button>
                )}
              </div>
            )}

            {/* Vote */}
            {activeTab === "vote" && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 font-mono text-sm">
                  <span style={{ color: "#fbbf24" }} className="font-semibold">fn</span>
                  <span className="text-white/70">vote</span>
                  <span className="text-white/20 text-xs">(voter, bounty_id, submission_id)</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input label="Bounty ID" value={voteBountyId} onChange={(e) => setVoteBountyId(e.target.value)} placeholder="e.g. 0" type="number" />
                  </div>
                  <ShimmerButton onClick={handleLoadVoteData} disabled={isLoadingVoteData} shimmerColor="#fbbf24" className="mt-7 h-[46px] px-4">
                    {isLoadingVoteData ? <SpinnerIcon /> : "Load"}
                  </ShimmerButton>
                </div>
                {voteBountyData && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <p className="text-xs text-white/60 font-mono">{voteBountyData.title}</p>
                  </div>
                )}
                {voteSubmissions.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-white/30">Select Submission</label>
                    {voteSubmissions.map(({ id, data }) => (
                      <button
                        key={id}
                        onClick={() => setVoteSubmissionId(String(id))}
                        className={cn(
                          "w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-mono transition-all",
                          voteSubmissionId === String(id)
                            ? "border-[#fbbf24]/30 bg-[#fbbf24]/[0.05] text-[#fbbf24]"
                            : "border-white/[0.06] bg-white/[0.02] text-white/60 hover:border-white/[0.1]"
                        )}
                      >
                        <span>#{id} — {data.url.substring(0, 30)}...</span>
                        <span className="text-xs ml-2">{data.votes} votes</span>
                      </button>
                    ))}
                  </div>
                )}
                <ShimmerButton onClick={handleVote} disabled={isVoting || !voteSubmissionId} shimmerColor="#fbbf24" className="w-full">
                  {isVoting ? <><SpinnerIcon /> Voting...</> : <><VoteIcon /> Cast Vote</>}
                </ShimmerButton>
              </div>
            )}

            {/* Accept */}
            {activeTab === "accept" && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 font-mono text-sm">
                  <span style={{ color: "#f87171" }} className="font-semibold">fn</span>
                  <span className="text-white/70">accept</span>
                  <span className="text-white/20 text-xs">(bounty_id)</span>
                </div>
                <Input label="Bounty ID" value={acceptBountyId} onChange={(e) => setAcceptBountyId(e.target.value)} placeholder="e.g. 0" type="number" />
                <p className="text-[11px] text-white/20">Accepts the winning submission and pays the reward. Deadline must have passed.</p>
                {walletAddress ? (
                  <ShimmerButton onClick={handleAccept} disabled={isAccepting} shimmerColor="#f87171" className="w-full">
                    {isAccepting ? <><SpinnerIcon /> Processing...</> : <><AwardIcon /> Accept &amp; Pay</>}
                  </ShimmerButton>
                ) : (
                  <button onClick={onConnect} disabled={isConnecting} className="w-full rounded-xl border border-dashed border-[#f87171]/20 bg-[#f87171]/[0.03] py-4 text-sm text-[#f87171]/60 hover:border-[#f87171]/30 hover:text-[#f87171]/80 active:scale-[0.99] transition-all disabled:opacity-50">
                    Connect wallet to accept
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.04] px-6 py-3 flex items-center justify-between">
            <p className="text-[10px] text-white/15">Bounty Platform &middot; Soroban</p>
            <div className="flex items-center gap-2">
              {["Open", "Paid"].map((s, i) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={cn("h-1 w-1 rounded-full", STATUS_CONFIG[s]?.dot ?? "bg-white/20")} />
                  <span className="font-mono text-[9px] text-white/15">{s}</span>
                  {i < 1 && <span className="text-white/10 text-[8px]">&rarr;</span>}
                </span>
              ))}
            </div>
          </div>
        </AnimatedCard>
      </Spotlight>
    </div>
  );
}
