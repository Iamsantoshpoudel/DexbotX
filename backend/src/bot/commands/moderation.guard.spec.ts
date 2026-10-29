import { PermissionFlagsBits, type Guild, type GuildMember, type Role } from 'discord.js';
import { moderationGuard, type ModerationCheck } from './moderation.guard';

const BOT_ID = '999999999999999999';
const OWNER_ID = '111111111111111111';
const MODERATOR_ID = '222222222222222222';
const TARGET_ID = '333333333333333333';

function role(position: number): Role {
  return {
    comparePositionTo: (other: Role) => position - other.position,
    position,
  } as Role;
}

function member(id: string, position: number): GuildMember {
  return {
    id,
    permissions: { has: () => true },
    roles: { highest: role(position) },
    kickable: true,
    bannable: true,
    moderatable: true,
  } as unknown as GuildMember;
}

function check(overrides: Partial<ModerationCheck> = {}): ModerationCheck {
  const bot = member(BOT_ID, 5);
  const guild = {
    ownerId: OWNER_ID,
    client: { user: { id: BOT_ID } },
    members: { me: bot },
  } as unknown as Guild;
  return {
    action: 'kick',
    guild,
    moderator: member(MODERATOR_ID, 4),
    targetUserId: TARGET_ID,
    targetIsBot: false,
    targetMember: member(TARGET_ID, 2),
    permission: PermissionFlagsBits.KickMembers,
    ...overrides,
  };
}

describe('moderationGuard', () => {
  it('rejects targets at or above the moderator role', () => {
    expect(moderationGuard(check({ targetMember: member(TARGET_ID, 4) })))
      .toContain('equal to or above yours');
  });

  it('explains that the bot role must be moved above the target even with Administrator', () => {
    const message = moderationGuard(check({
      action: 'timeout',
      moderator: member(OWNER_ID, 1),
      targetMember: member(TARGET_ID, 5),
    }));
    expect(message).toContain('Move DexBotX’s role above theirs in Server Settings > Roles');
    expect(message).toContain('Administrator does not bypass role hierarchy');
  });

  it('does not allow moderating the server owner', () => {
    expect(moderationGuard(check({ targetUserId: OWNER_ID }))).toContain('server owner');
  });

  it('does not allow moderating yourself', () => {
    expect(moderationGuard(check({ targetUserId: MODERATOR_ID }))).toContain('yourself');
  });

  it('does not allow moderating the bot itself', () => {
    expect(moderationGuard(check({ targetUserId: BOT_ID }))).toContain('moderate me');
  });

  it('rejects another bot whose role is above the bot role', () => {
    expect(moderationGuard(check({
      targetIsBot: true,
      targetMember: member(TARGET_ID, 6),
    }))).toContain('that bot');
  });

  it('allows the server owner to moderate members regardless of their role position', () => {
    expect(moderationGuard(check({
      moderator: member(OWNER_ID, 1),
      targetMember: member(TARGET_ID, 2),
    }))).toBeNull();
  });
});
