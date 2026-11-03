import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeStore } from '@/store';
import { connect } from './realtime';

describe('realtime connection lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reuses the guild connection after navigating away and closes it after the grace period', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const fetchTicket = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'wss://example.test/ws' }),
    });
    vi.stubGlobal('fetch', fetchTicket);
    vi.stubGlobal('WebSocket', class {
      addEventListener() {}
      close() {}
      send() {}
    });

    const dispatch = makeStore().dispatch;
    const releaseFirst = connect('12345678901234567', dispatch);
    await Promise.resolve();
    await Promise.resolve();
    releaseFirst();

    const releaseSecond = connect('12345678901234567', dispatch);
    expect(fetchTicket).toHaveBeenCalledTimes(1);
    releaseSecond();

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    const releaseThird = connect('12345678901234567', dispatch);
    expect(fetchTicket).toHaveBeenCalledTimes(2);
    releaseThird();
    await vi.advanceTimersByTimeAsync(5 * 60_000);
  });
});
