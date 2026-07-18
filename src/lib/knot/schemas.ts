import { z } from "zod";

export const obligationSchema = z.object({
  task: z.string().trim().min(12).max(280),
  subject: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  maxPriceUsdc: z.number().positive().max(1),
  maxLatencyMs: z.number().int().positive().max(30_000),
  maxAgeSeconds: z.number().int().positive().max(86_400),
  requiredFields: z.array(z.string().min(1)).min(1).max(12),
  requireSignature: z.boolean(),
});

export const deliverySchema = z.object({
  providerId: z.string(),
  provider: z.string(),
  priceUsdc: z.number().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
  ageSeconds: z.number().int().nonnegative(),
  signatureValid: z.boolean(),
  payload: z.record(z.string(), z.unknown()),
  evidenceHash: z.string(),
});

export const verificationCheckSchema = z.object({
  key: z.string(),
  label: z.string(),
  passed: z.boolean(),
  detail: z.string(),
});

export const verificationResultSchema = z.object({
  accepted: z.boolean(),
  checks: z.array(verificationCheckSchema),
});

export const executionEventSchema = z.object({
  id: z.string(),
  sequence: z.number().int().nonnegative(),
  kind: z.enum([
    "discovery",
    "quote",
    "payment",
    "verification",
    "fallback",
    "settlement",
  ]),
  status: z.enum(["neutral", "success", "failure"]),
  title: z.string(),
  detail: z.string(),
  providerId: z.string().optional(),
  amountUsdc: z.number().nonnegative().optional(),
});

export const providerAttemptSchema = z.object({
  providerId: z.string(),
  provider: z.string(),
  priceUsdc: z.number().nonnegative(),
  reputation: z.number().min(0).max(100),
  proofSupport: z.boolean(),
  outcome: z.enum(["rejected", "accepted"]),
  delivery: deliverySchema,
  verification: verificationResultSchema,
});

export const executionSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  mode: z.enum(["local", "live"]),
  status: z.enum(["verified", "failed"]),
  obligation: obligationSchema,
  events: z.array(executionEventSchema),
  attempts: z.array(providerAttemptSchema),
  settlement: z.object({
    status: z.enum(["authorized", "blocked", "received", "settled"]),
    amountUsdc: z.number().nonnegative(),
    recipient: z.string().nullable(),
    rail: z.enum(["simulated", "x402-gateway", "erc-8183"]),
    evidenceHash: z.string().nullable(),
    transactionHash: z.string().nullable(),
  }),
});

export const createExecutionSchema = z.object({
  task: z.string().trim().min(12).max(280).optional(),
  subject: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  maxPriceUsdc: z.number().positive().max(1).optional(),
  maxLatencyMs: z.number().int().positive().max(30_000).optional(),
  maxAgeSeconds: z.number().int().positive().max(86_400).optional(),
  requiredFields: z.array(z.string().min(1)).min(1).max(12).optional(),
  requireSignature: z.boolean().optional(),
  agentAuthorization: z.object({
    owner: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    issuedAt: z.string().datetime(),
    signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  }).optional(),
});

export type Obligation = z.infer<typeof obligationSchema>;
export type Delivery = z.infer<typeof deliverySchema>;
export type VerificationCheck = z.infer<typeof verificationCheckSchema>;
export type VerificationResult = z.infer<typeof verificationResultSchema>;
export type ExecutionEvent = z.infer<typeof executionEventSchema>;
export type ProviderAttempt = z.infer<typeof providerAttemptSchema>;
export type Execution = z.infer<typeof executionSchema>;
export type CreateExecutionInput = z.infer<typeof createExecutionSchema>;
