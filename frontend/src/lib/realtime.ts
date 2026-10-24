import { api } from '@/store/api';
import type { AppDispatch } from '@/store';

export type RealtimeStatus = 'live' | 'reconnecting';

interface Connection {
  guildId: string;
  dispatch: AppDispatch;
  references: number;
  stopped: boolean;
  paused: boolean;
  socket: WebSocket | null;
  ticketRequest: AbortController | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  onVisibilityChange: () => void;
}

interface GuildEvent {
  type: string;
  guildId: string;
  kind?: 'channels' | 'roles' | 'installed';
  rev?: number;
}

const channelRevisions = new Map<string, number>();
const pendingChannelRevisions = new Map<string, number>();
const RECONNECT_DELAY_MS = 3000;
const HIDDEN_CLOSE_DELAY_MS = 5 * 60_000;
const statusListeners = new Set<() => void>();
let status: RealtimeStatus = 'reconnecting';
let activeConnection: Connection | null = null;

export function getRealtimeStatus(): RealtimeStatus {
  return status;
}

export function subscribeRealtimeStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

function setStatus(next: RealtimeStatus): void {
  if (status === next) return;
  status = next;
  for (const listener of statusListeners) listener();
}

export function connect(guildId: string, dispatch: AppDispatch): () => void {
  if (activeConnection?.guildId === guildId && !activeConnection.stopped) {
    const connection = activeConnection;
    connection.references += 1;
    return () => release(connection);
  }
  if (activeConnection) stop(activeConnection);

  const connection: Connection = {
    guildId,
    dispatch,
    references: 1,
    stopped: false,
    paused: false,
    socket: null,
    ticketRequest: null,
    reconnectTimer: null,
    hiddenTimer: null,
    onVisibilityChange: () => {},
  };
  activeConnection = connection;
  connection.onVisibilityChange = () => handleVisibilityChange(connection);
  document.addEventListener('visibilitychange', connection.onVisibilityChange);
  openConnection(connection);

  return () => release(connection);
}

function release(connection: Connection): void {
  if (connection.stopped) return;
  connection.references -= 1;
  if (connection.references === 0) stop(connection);
}

function stop(connection: Connection): void {
  if (connection.stopped) return;
  connection.stopped = true;
  document.removeEventListener('visibilitychange', connection.onVisibilityChange);
  if (connection.reconnectTimer) clearTimeout(connection.reconnectTimer);
  if (connection.hiddenTimer) clearTimeout(connection.hiddenTimer);
  connection.ticketRequest?.abort();
  connection.socket?.close(1000, 'Page closed');
  if (activeConnection === connection) activeConnection = null;
}

async function openConnection(connection: Connection): Promise<void> {
  if (connection.stopped || connection.paused || connection.socket || connection.ticketRequest) return;
  setStatus('reconnecting');
  const controller = new AbortController();
  connection.ticketRequest = controller;
  try {
    const response = await fetch('/api/ws/ticket', {
      method: 'POST',
      credentials: 'same-origin',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`WebSocket ticket request failed (${response.status})`);
    const body: unknown = await response.json();
    if (!isTicketResponse(body)) throw new Error('Invalid WebSocket ticket response');
    if (connection.stopped || connection.paused) return;

    const socket = new WebSocket(body.url);
    connection.socket = socket;
    socket.addEventListener('open', () => {
      if (connection.stopped || connection.socket !== socket) return;
      socket.send(JSON.stringify({ type: 'join', guildId: connection.guildId }));
      setStatus('live');
    });
    socket.addEventListener('message', (event) => handleSocketMessage(connection, event.data));
    socket.addEventListener('close', () => {
      if (connection.socket !== socket) return;
      connection.socket = null;
      setStatus('reconnecting');
      scheduleReconnect(connection);
    });
    socket.addEventListener('error', () => socket.close());
  } catch {
    if (!controller.signal.aborted && !connection.stopped) scheduleReconnect(connection);
  } finally {
    if (connection.ticketRequest === controller) connection.ticketRequest = null;
  }
}

function scheduleReconnect(connection: Connection): void {
  if (connection.stopped || connection.paused || connection.reconnectTimer || document.visibilityState === 'hidden') return;
  setStatus('reconnecting');
  connection.reconnectTimer = setTimeout(() => {
    connection.reconnectTimer = null;
    void openConnection(connection);
  }, RECONNECT_DELAY_MS);
}

function handleVisibilityChange(connection: Connection): void {
  if (document.visibilityState === 'hidden') {
    if (connection.hiddenTimer) clearTimeout(connection.hiddenTimer);
    connection.hiddenTimer = setTimeout(() => {
      connection.hiddenTimer = null;
      connection.paused = true;
      if (connection.reconnectTimer) clearTimeout(connection.reconnectTimer);
      connection.reconnectTimer = null;
      connection.ticketRequest?.abort();
      connection.socket?.close(1000, 'Tab hidden');
    }, HIDDEN_CLOSE_DELAY_MS);
    return;
  }

  if (connection.hiddenTimer) clearTimeout(connection.hiddenTimer);
  connection.hiddenTimer = null;
  if (connection.paused) {
    connection.paused = false;
    scheduleReconnect(connection);
  } else if (!connection.socket && !connection.ticketRequest && !connection.reconnectTimer) {
    scheduleReconnect(connection);
  }
}

function handleSocketMessage(connection: Connection, raw: unknown): void {
  if (typeof raw !== 'string') return;
  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isGuildEvent(event) || event.guildId !== connection.guildId) return;

  if (event.type === 'joined' && typeof event.rev === 'number') {
    acceptChannelRevision(connection, event.rev);
  } else if (event.kind === 'channels' && typeof event.rev === 'number') {
    acceptChannelRevision(connection, event.rev);
  }
}

function acceptChannelRevision(connection: Connection, revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 0) return;
  if (channelRevisions.get(connection.guildId) === revision
    || pendingChannelRevisions.get(connection.guildId) === revision) return;

  pendingChannelRevisions.set(connection.guildId, revision);
  void connection.dispatch(
    api.endpoints.getChannels.initiate(connection.guildId, { forceRefetch: true, subscribe: false }),
  ).unwrap().then(() => {
    const currentRevision = channelRevisions.get(connection.guildId);
    if (currentRevision === undefined || revision > currentRevision) channelRevisions.set(connection.guildId, revision);
  }).catch(() => {
    // Keep the current cached list visible; a later revision or reconnect can retry.
  }).finally(() => {
    if (pendingChannelRevisions.get(connection.guildId) === revision) pendingChannelRevisions.delete(connection.guildId);
  });
}

function isTicketResponse(value: unknown): value is { url: string } {
  if (!value || typeof value !== 'object') return false;
  const url = (value as Record<string, unknown>).url;
  if (typeof url !== 'string') return false;
  try {
    return ['ws:', 'wss:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function isGuildEvent(value: unknown): value is GuildEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  return typeof event.type === 'string'
    && typeof event.guildId === 'string'
    && /^\d{17,20}$/.test(event.guildId)
    && (event.rev === undefined || (typeof event.rev === 'number' && Number.isSafeInteger(event.rev)))
    && (
      (event.type === 'joined' && typeof event.rev === 'number')
      || event.kind === 'channels'
      || event.kind === 'roles'
      || event.kind === 'installed'
    );
}
