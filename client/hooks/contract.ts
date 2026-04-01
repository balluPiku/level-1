"use client";

import {
  Contract,
  Networks,
  TransactionBuilder,
  Keypair,
  xdr,
  Address,
  nativeToScVal,
  scValToNative,
  rpc,
} from "@stellar/stellar-sdk";
import {
  isConnected,
  getAddress,
  signTransaction,
  setAllowed,
  isAllowed,
  requestAccess,
} from "@stellar/freighter-api";

// ============================================================
// CONSTANTS — Update these for your contract
// ============================================================

/** Your deployed Soroban contract ID */
export const CONTRACT_ADDRESS =
  "CA4X4H5SVVETYWEDTDEN6BDXDT352BDF5FXN2PQ5NU6NVIGXSFWPK7FG";

/** Network passphrase (testnet by default) */
export const NETWORK_PASSPHRASE = Networks.TESTNET;

/** Soroban RPC URL */
export const RPC_URL = "https://soroban-testnet.stellar.org";

/** Horizon URL */
export const HORIZON_URL = "https://horizon-testnet.stellar.org";

/** Network name for Freighter */
export const NETWORK = "TESTNET";

// ============================================================
// RPC Server Instance
// ============================================================

const server = new rpc.Server(RPC_URL);

// ============================================================
// Wallet Helpers
// ============================================================

export async function checkConnection(): Promise<boolean> {
  const result = await isConnected();
  return result.isConnected;
}

export async function connectWallet(): Promise<string> {
  const connResult = await isConnected();
  if (!connResult.isConnected) {
    throw new Error("Freighter extension is not installed or not available.");
  }

  const allowedResult = await isAllowed();
  if (!allowedResult.isAllowed) {
    await setAllowed();
    await requestAccess();
  }

  const { address } = await getAddress();
  if (!address) {
    throw new Error("Could not retrieve wallet address from Freighter.");
  }
  return address;
}

export async function getWalletAddress(): Promise<string | null> {
  try {
    const connResult = await isConnected();
    if (!connResult.isConnected) return null;

    const allowedResult = await isAllowed();
    if (!allowedResult.isAllowed) return null;

    const { address } = await getAddress();
    return address || null;
  } catch {
    return null;
  }
}

// ============================================================
// Contract Interaction Helpers
// ============================================================

/**
 * Build, simulate, and optionally sign + submit a Soroban contract call.
 *
 * @param method   - The contract method name to invoke
 * @param params   - Array of xdr.ScVal parameters for the method
 * @param caller   - The public key (G...) of the calling account
 * @param sign     - If true, signs via Freighter and submits. If false, only simulates.
 * @returns        The result of the simulation or submission
 */
export async function callContract(
  method: string,
  params: xdr.ScVal[] = [],
  caller: string,
  sign: boolean = true
) {
  const contract = new Contract(CONTRACT_ADDRESS);
  const account = await server.getAccount(caller);

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...params))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(
      `Simulation failed: ${(simulated as rpc.Api.SimulateTransactionErrorResponse).error}`
    );
  }

  if (!sign) {
    // Read-only call — just return the simulation result
    return simulated;
  }

  // Prepare the transaction with the simulation result
  const prepared = rpc.assembleTransaction(tx, simulated).build();

  // Sign with Freighter
  const { signedTxXdr } = await signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const txToSubmit = TransactionBuilder.fromXDR(
    signedTxXdr,
    NETWORK_PASSPHRASE
  );

  const result = await server.sendTransaction(txToSubmit);

  if (result.status === "ERROR") {
    throw new Error(`Transaction submission failed: ${result.status}`);
  }

  // Poll for confirmation
  let getResult = await server.getTransaction(result.hash);
  while (getResult.status === "NOT_FOUND") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    getResult = await server.getTransaction(result.hash);
  }

  if (getResult.status === "FAILED") {
    throw new Error("Transaction failed on chain.");
  }

  return getResult;
}

/**
 * Read-only contract call (does not require signing).
 */
export async function readContract(
  method: string,
  params: xdr.ScVal[] = [],
  caller?: string
) {
  const account =
    caller || Keypair.random().publicKey(); // Use a random keypair for read-only
  const sim = await callContract(method, params, account, false);
  if (
    rpc.Api.isSimulationSuccess(sim as rpc.Api.SimulateTransactionResponse) &&
    (sim as rpc.Api.SimulateTransactionSuccessResponse).result
  ) {
    return scValToNative(
      (sim as rpc.Api.SimulateTransactionSuccessResponse).result!.retval
    );
  }
  return null;
}

// ============================================================
// ScVal Conversion Helpers
// ============================================================

export function toScValString(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: "string" });
}

export function toScValU32(value: number): xdr.ScVal {
  return nativeToScVal(value, { type: "u32" });
}

export function toScValI128(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: "i128" });
}

export function toScValAddress(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

export function toScValBool(value: boolean): xdr.ScVal {
  return nativeToScVal(value, { type: "bool" });
}

export function toScValU64(value: number): xdr.ScVal {
  return nativeToScVal(value, { type: "u64" });
}

// ============================================================
// Bounty Platform — Contract Methods
// ============================================================

/**
 * Create a new bounty.
 * Calls: create_bounty(creator: Address, title: String, description: String, token: Address, reward: i128, deadline: u64)
 */
export async function createBounty(
  caller: string,
  title: string,
  description: string,
  token: string,
  reward: bigint,
  deadline: number
) {
  return callContract(
    "create_bounty",
    [
      toScValAddress(caller),
      toScValString(title),
      toScValString(description),
      toScValAddress(token),
      toScValI128(reward),
      toScValU64(deadline),
    ],
    caller,
    true
  );
}

/**
 * Submit work to a bounty.
 * Calls: submit(submitter: Address, bounty_id: u64, url: String)
 */
export async function submitBounty(
  caller: string,
  bountyId: number,
  url: string
) {
  return callContract(
    "submit",
    [toScValAddress(caller), toScValU64(bountyId), toScValString(url)],
    caller,
    true
  );
}

/**
 * Vote for a submission.
 * Calls: vote(voter: Address, bounty_id: u64, submission_id: u64)
 */
export async function voteSubmission(
  caller: string,
  bountyId: number,
  submissionId: number
) {
  return callContract(
    "vote",
    [toScValAddress(caller), toScValU64(bountyId), toScValU64(submissionId)],
    caller,
    true
  );
}

/**
 * Accept the winning submission and pay the reward.
 * Calls: accept(bounty_id: u64) — no auth required
 */
export async function acceptBounty(caller: string, bountyId: number) {
  return callContract("accept", [toScValU64(bountyId)], caller, true);
}

/**
 * Get bounty details (read-only).
 * Calls: get_bounty(bounty_id: u64) -> Option<Bounty>
 */
export async function getBounty(bountyId: number, caller?: string) {
  return readContract("get_bounty", [toScValU64(bountyId)], caller);
}

/**
 * Get total bounty count (read-only).
 * Calls: get_bounty_count() -> u64
 */
export async function getBountyCount(caller?: string) {
  return readContract("get_bounty_count", [], caller);
}

/**
 * Get all submissions for a bounty (read-only).
 * Calls: get_submissions(bounty_id: u64) -> Vec<(u64, Submission)>
 */
export async function getSubmissions(bountyId: number, caller?: string) {
  return readContract("get_submissions", [toScValU64(bountyId)], caller);
}

/**
 * Check if a voter has already voted (read-only).
 * Calls: has_voted(voter: Address, bounty_id: u64, submission_id: u64) -> bool
 */
export async function hasVoted(
  voter: string,
  bountyId: number,
  submissionId: number,
  caller?: string
) {
  return readContract(
    "has_voted",
    [toScValAddress(voter), toScValU64(bountyId), toScValU64(submissionId)],
    caller
  );
}

export { nativeToScVal, scValToNative, Address, xdr };
