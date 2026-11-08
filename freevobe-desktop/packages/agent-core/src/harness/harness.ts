import type {
  AgentEvent,
  HarnessEvent,
  HarnessPhase,
  PreviewStatus,
  RouterDecision,
  VerificationReport,
} from '@freevobe/protocol';

/**
 * Harness-motorn: den kedja som gör en körning till en leverans i stället för ett textsvar.
 *
 *   gather  – kontexten byggs (agent-loopen gör jobbet och rapporterar `context`)
 *   act     – modellen anropar verktyg och skriver filer
 *   verify  – projektets egna kontroller körs, men bara om filer faktiskt ändrades
 *   deliver – preview startas så att resultatet syns, och körningen avslutas
 *
 * Motorn äger ordningen och Fas 3/4-reglerna. Den äger inte verktygen, verifieringen eller
 * dev-servern: de injiceras, så att samma motor körs i appen och i testerna.
 */

export type HarnessStreamEvent = AgentEvent | HarnessEvent;

export interface HarnessInput {
  runId: string;
  /** Agent-loopen. Alla dess händelser skickas vidare oförändrade. */
  loop: () => AsyncGenerator<AgentEvent>;
  /** Kör verifieringen. Anropas bara när filer ändrats och körningen är slut. */
  verify?: (context: { changedFiles: string[] }) => Promise<VerificationReport | null>;
  /** Startar dev-server och preview. Anropas bara när verifieringen inte är röd. */
  preview?: () => Promise<PreviewStatus | null>;
  /**
   * Filer som ändrats utanför loopens ström. Verktygen rapporterar `file_changed` direkt till
   * prenumeranterna, så servern måste kunna lämna in dem här.
   */
  changedFiles?: () => string[];
  /** Routerns beslut, så att gränssnittet kan visa vilken modell som valdes och varför. */
  route?: RouterDecision | null;
  now?: () => number;
}

/** Händelser som betyder att modellen börjat agera. Före dem är körningen i gather. */
const ACT_EVENTS = new Set<AgentEvent['type']>([
  'tool_call',
  'assistant_delta',
  'plan_proposed',
  'error',
]);

export async function* runHarness(input: HarnessInput): AsyncGenerator<HarnessStreamEvent> {
  const now = input.now ?? (() => Date.now());
  const phase = (value: HarnessPhase): HarnessEvent => ({
    type: 'harness_phase',
    runId: input.runId,
    phase: value,
    at: now(),
  });

  const changedFiles = new Set<string>();
  let finished: Extract<AgentEvent, { type: 'run_finished' }> | null = null;
  let acting = false;
  let started = false;

  // `run_started` måste vara den första händelsen klienten ser – annars ser en lyssnare som
  // filtrerar på runId ingenting förrän efter kontextbygget. Fasmarkören kommer direkt efter.
  const emitOpening = function* (): Generator<HarnessEvent> {
    yield phase('gather');
    if (input.route) {
      yield {
        type: 'harness_route',
        runId: input.runId,
        route: input.route.route,
        recommendation: input.route.recommendation,
      };
    }
  };

  for await (const event of input.loop()) {
    if (!started && event.type === 'run_started') {
      started = true;
      yield event;
      yield* emitOpening();
      continue;
    }

    if (!started) {
      started = true;
      yield* emitOpening();
    }

    if (event.type === 'run_finished') {
      // Skickas sist, efter verify och deliver, så att UI:t aldrig stänger körningen i förtid.
      finished = event;
      continue;
    }

    if (!acting && ACT_EVENTS.has(event.type)) {
      acting = true;
      yield phase('act');
    }

    if (event.type === 'file_changed') changedFiles.add(event.path);
    yield event;
  }

  if (!started) {
    started = true;
    yield* emitOpening();
  }
  if (!acting) yield phase('act');

  for (const file of input.changedFiles?.() ?? []) changedFiles.add(file);

  const reason = finished?.reason ?? 'final';
  const runEndedNormally = reason === 'final' || reason === 'loop_limit';
  let report: VerificationReport | null = null;

  if (changedFiles.size > 0 && input.verify && runEndedNormally) {
    yield phase('verify');
    report = await input.verify({ changedFiles: [...changedFiles] });
    if (report) yield { type: 'verification', runId: input.runId, report };
  }

  yield phase('deliver');
  if (input.preview && report?.status !== 'failed') {
    const preview = await input.preview().catch((): PreviewStatus | null => null);
    if (preview) yield { type: 'harness_preview', runId: input.runId, preview };
  }

  if (finished) yield finished;
}
