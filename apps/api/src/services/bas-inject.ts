import {
  CompileBasCampaignInputSchema,
  compileBasInjectCampaign,
  evaluateBasInjectQueue,
  type BasCampaignDag,
  type CompileBasCampaignInput,
  type CompileBasInjectCampaignInput,
  type EvaluateBasInjectQueueInput,
  type EvaluateBasInjectQueueResult
} from "@periscan/shared";

/**
 * Compile-only Inject adapter over the existing campaign DAG compiler.
 * No Fastify route, no Prisma, no liveSupported flip, never queues jobs.
 */

export type CompileBasInjectsInput = CompileBasInjectCampaignInput & {
  scopeId: string;
};

export type CompileBasInjectsResult =
  | {
      campaignInput: CompileBasCampaignInput;
      graph: BasCampaignDag;
      jobsQueued: 0;
      liveSupported: false;
      ok: true;
      queued: false;
    }
  | {
      error: string;
      jobsQueued: 0;
      liveSupported: false;
      ok: false;
      queued: false;
    };

export type EvaluateBasInjectDispatchInput = EvaluateBasInjectQueueInput & {
  scopeId: string;
};

export type EvaluateBasInjectDispatchResult = EvaluateBasInjectQueueResult & {
  liveSupported: false;
  queued: false;
  jobsQueued: 0;
};

export function compileBasInjects(
  input: CompileBasInjectsInput
): CompileBasInjectsResult {
  const compiled = compileBasInjectCampaign({ injects: input.injects });
  if (compiled.error || !compiled.graph) {
    return {
      error: compiled.error ?? "Inject compile failed closed.",
      jobsQueued: 0,
      liveSupported: false,
      ok: false,
      queued: false
    };
  }

  const campaignInput = CompileBasCampaignInputSchema.parse({
    scenarioPins: compiled.pins.map((pin) => ({
      contentSha256: pin.contentSha256,
      dependsOn: pin.dependsOn,
      provider: pin.provider,
      stepKey: pin.stepKey,
      typedInputs: pin.typedInputs,
      upstreamId: pin.upstreamId
    })),
    scopeId: input.scopeId
  });

  return {
    campaignInput,
    graph: compiled.graph,
    jobsQueued: 0,
    liveSupported: false,
    ok: true,
    queued: false
  };
}

export function evaluateBasInjectDispatch(
  input: EvaluateBasInjectDispatchInput
): EvaluateBasInjectDispatchResult {
  const { scopeId: _scopeId, ...queueInput } = input;
  const evaluated = evaluateBasInjectQueue(queueInput);
  return {
    ...evaluated,
    jobsQueued: 0,
    liveSupported: false,
    queued: false
  };
}
