import { EventEmitter } from 'node:events';
import { ForbiddenException } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import type { RawData, WebSocket } from 'ws';
import { RealtimeController } from './realtime.controller';
import { RealtimeGateway } from './realtime.gateway';

const USER_1 = '111111111111111111';
const USER_2 = '222222222222222222';
const GUILD_1 = '333333333333333333';
const GUILD_2 = '444444444444444444';
const ORIGIN = 'https://dashboard.example';

class MockSocket extends EventEmitter {
  readonly OPEN = 1;
  readyState = 1;
  close = jest.fn();
  send = jest.fn();
  ping = jest.fn();
  terminate = jest.fn();
}

function makeGateway() {
  const tickets = new Map<string, string>();
  const subscriber = new EventEmitter() as EventEmitter & {
    psubscribe: jest.Mock;
    punsubscribe: jest.Mock;
  };
  subscriber.psubscribe = jest.fn(async () => 1);
  subscriber.punsubscribe = jest.fn(async () => 1);
  const redis = {
    client: {
      get: jest.fn(async () => null as string | null),
      getdel: jest.fn(async (key: string) => {
        const ticket = key.slice('wsticket:'.length);
        const userId = tickets.get(ticket) ?? null;
        tickets.delete(ticket);
        return userId;
      }),
    },
    createSubscriber: jest.fn(() => subscriber),
  };
  const sessions = {
    findActiveForUser: jest.fn(async (userId: string) => ({ userId } as never)),
  };
  const guilds = {
    authorizeInstalledGuild: jest.fn(async (_session: unknown, guildId: string) => {
      if (guildId !== GUILD_1) throw new ForbiddenException();
      return {} as never;
    }),
  };
  const gateway = new RealtimeGateway(
    redis as never,
    sessions as never,
    guilds as never,
    { webOrigin: ORIGIN } as never,
  );
  const controller = new RealtimeController(
    { client: { set: jest.fn(async (key: string, userId: string) => tickets.set(key.slice('wsticket:'.length), userId)) } } as never,
    { wsPublicUrl: 'wss://api.example/ws' } as never,
  );
  return { gateway, controller, tickets, subscriber, redis, sessions, guilds };
}

function socketRequest(ticket: string, origin = ORIGIN): IncomingMessage {
  return {
    url: `/ws?ticket=${ticket}`,
    headers: { origin },
  } as IncomingMessage;
}

async function connect(gateway: RealtimeGateway, ticket: string, origin = ORIGIN): Promise<MockSocket> {
  const socket = new MockSocket();
  await gateway.handleConnection(socket as unknown as WebSocket, socketRequest(ticket, origin));
  return socket;
}

async function sendMessage(socket: MockSocket, message: unknown): Promise<void> {
  socket.emit('message', JSON.stringify(message) as unknown as RawData);
  await new Promise((resolve) => setImmediate(resolve));
}

describe('RealtimeController', () => {
  it('issues a one-use ticket URL and stores the user id for 30 seconds', async () => {
    const { controller } = makeGateway();
    const set = jest.spyOn(
      (controller as unknown as { redis: { client: { set: jest.Mock } } }).redis.client,
      'set',
    );

    const result = await controller.createTicket({ session: { userId: USER_1 } } as never);

    expect(result.ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new URL(result.url).searchParams.get('ticket')).toBe(result.ticket);
    expect(set).toHaveBeenCalledWith(`wsticket:${result.ticket}`, USER_1, 'EX', 30);
  });
});

describe('RealtimeGateway', () => {
  it('rejects expired or already-consumed tickets', async () => {
    const { gateway } = makeGateway();

    const socket = await connect(gateway, 'a'.repeat(43));

    expect(socket.close).toHaveBeenCalledWith(4401, 'Unauthorized');
  });

  it('rejects an incorrect origin and consumes valid tickets only once', async () => {
    const { gateway, controller, sessions } = makeGateway();
    const { ticket } = await controller.createTicket({ session: { userId: USER_1 } } as never);

    const wrongOrigin = await connect(gateway, ticket, 'https://attacker.example');
    expect(wrongOrigin.close).toHaveBeenCalledWith(4401, 'Unauthorized');
    expect(sessions.findActiveForUser).not.toHaveBeenCalled();

    const first = await connect(gateway, ticket);
    expect(first.close).not.toHaveBeenCalled();
    const replay = await connect(gateway, ticket);
    expect(replay.close).toHaveBeenCalledWith(4401, 'Unauthorized');
  });

  it('does not join a room when the user lacks guild access', async () => {
    const { gateway, controller, guilds } = makeGateway();
    const { ticket } = await controller.createTicket({ session: { userId: USER_2 } } as never);
    const socket = await connect(gateway, ticket);

    await sendMessage(socket, { type: 'join', guildId: GUILD_2 });

    expect(guilds.authorizeInstalledGuild).toHaveBeenCalledWith({ userId: USER_2 }, GUILD_2);
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'error', code: 'forbidden', guildId: GUILD_2 }));
  });

  it('returns the current channel revision when joining a guild room', async () => {
    const { gateway, controller, redis } = makeGateway();
    const { ticket } = await controller.createTicket({ session: { userId: USER_1 } } as never);
    redis.client.get.mockResolvedValueOnce('12');
    const socket = await connect(gateway, ticket);

    await sendMessage(socket, { type: 'join', guildId: GUILD_1 });

    expect(redis.client.get).toHaveBeenCalledWith(`guild:${GUILD_1}:rev`);
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'joined', guildId: GUILD_1, rev: 12 }));
  });

  it('forwards published guild events only to clients in the matching room', async () => {
    const { gateway, controller } = makeGateway();
    const ticket1 = await controller.createTicket({ session: { userId: USER_1 } } as never);
    const ticket2 = await controller.createTicket({ session: { userId: USER_2 } } as never);
    const inRoom = await connect(gateway, ticket1.ticket);
    const elsewhere = await connect(gateway, ticket2.ticket);

    await sendMessage(inRoom, { type: 'join', guildId: GUILD_1 });
    await sendMessage(elsewhere, { type: 'join', guildId: GUILD_2 });
    expect(inRoom.send).toHaveBeenCalledWith(JSON.stringify({ type: 'joined', guildId: GUILD_1, rev: 0 }));
    inRoom.send.mockClear();
    elsewhere.send.mockClear();

    const event = JSON.stringify({
      type: 'updated',
      guildId: GUILD_1,
      kind: 'channels',
      rev: 4,
      data: { channelId: '555555555555555555', private: 'not-forwarded' },
    });
    (gateway as unknown as { forwardEvent: (channel: string, message: string) => void })
      .forwardEvent(`guild:${GUILD_1}:events`, event);

    expect(inRoom.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'updated',
      guildId: GUILD_1,
      kind: 'channels',
      data: { channelId: '555555555555555555' },
      rev: 4,
    }));
    expect(elsewhere.send).not.toHaveBeenCalled();
  });
});
