import { createHash, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';
import { APP_CONFIG, AppConfig } from '../core/config';
import { MemberEventsQueue } from '../queue/member-events.queue';

/** Prometheus registry shared by the API and the worker (each process exposes its own). */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpDuration = new Histogram({
    name: 'dexbotx_http_request_duration_seconds',
    help: 'HTTP request latency by route template',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  readonly memberEvents = new Counter({
    name: 'dexbotx_member_events_total',
    help: 'Welcome/goodbye jobs by final result',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    queue: MemberEventsQueue,
  ) {
    collectDefaultMetrics({ register: this.registry });
    new Gauge({
      name: 'dexbotx_queue_jobs',
      help: 'Jobs in the member-events queue by state',
      labelNames: ['state'] as const,
      registers: [this.registry],
      async collect() {
        const counts = await queue.queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
        for (const [state, value] of Object.entries(counts)) this.set({ state }, value);
      },
    });
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  render(): Promise<string> {
    return this.registry.metrics();
  }

  /** Metrics are disabled unless METRICS_TOKEN is set. */
  get enabled(): boolean {
    return Boolean(this.config.metricsToken);
  }

  isAuthorized(authorization: string | undefined): boolean {
    if (!this.config.metricsToken || !authorization?.startsWith('Bearer ')) return false;
    const a = createHash('sha256').update(authorization.slice(7)).digest();
    const b = createHash('sha256').update(this.config.metricsToken).digest();
    return timingSafeEqual(a, b);
  }
}
