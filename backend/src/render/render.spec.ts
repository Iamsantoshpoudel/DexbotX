import { IMAGE_STYLE_IDS } from '../shared/message-config';
import { defaultMessageConfig } from '../shared/message-config';
import { MessageBuilder } from './message-builder.service';
import { RenderService } from './render.service';

const ctx = { userId: '123456789012345678', username: 'dex', displayName: 'Dex', serverName: 'Dex HQ', memberCount: 42 };

function pngSize(buf: Buffer): { w: number; h: number } {
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe('RenderService', () => {
  const render = new RenderService();
  const builder = new MessageBuilder(render);

  it.each(IMAGE_STYLE_IDS)('renders the %s style as a 1100x400 PNG without any assets', async (style) => {
    const png = await render.renderCard({
      style, title: 'Welcome', subtitle: 'Hello', name: 'Dex', accentColor: '#7c6cff',
      avatarShape: 'rounded', showMemberCount: true, memberCountText: '42 members', avatar: null, banner: null,
    });
    expect(pngSize(png)).toEqual({ w: 1100, h: 400 });
  });

  it('survives corrupt avatar data', async () => {
    const png = await render.renderCard({
      style: 'midnight', title: '', subtitle: '', name: 'Dex', accentColor: '#ffffff',
      avatarShape: 'circle', showMemberCount: false, memberCountText: '', avatar: Buffer.from('not an image'), banner: Buffer.from('nope'),
    });
    expect(pngSize(png).w).toBe(1100);
  });

  it('reuses decoded images for repeated renders', async () => {
    const png = await render.renderCard({
      style: 'midnight', title: '', subtitle: '', name: 'Dex', accentColor: '#ffffff',
      avatarShape: 'circle', showMemberCount: false, memberCountText: '', avatar: null, banner: null,
    });
    const first = await render['safeLoad'](png);
    const second = await render['safeLoad'](png);
    expect(second).toBe(first);
  });

  it('builds a message with mention, embed referencing the attached card, and capped lengths', async () => {
    const cfg = defaultMessageConfig('welcome');
    cfg.content = 'Hi {user} '.padEnd(3000, 'x');
    cfg.embed = { enabled: true, title: 'T {server}', description: 'D {memberCountOrdinal}', color: '#ff0000', footer: 'F' };
    const msg = await builder.build(cfg, ctx, { avatar: null, banner: null });
    expect(msg.content!.length).toBe(2000);
    expect(msg.content).toContain('<@123456789012345678>');
    expect(msg.embeds[0]).toMatchObject({ title: 'T Dex HQ', description: 'D 42nd', color: 0xff0000, footer: { text: 'F' }, image: { url: 'attachment://card.png' } });
    expect(msg.file?.name).toBe('card.png');
  });

  it('omits the file and embed image when the image is disabled', async () => {
    const cfg = defaultMessageConfig('goodbye');
    cfg.image.enabled = false;
    const msg = await builder.build(cfg, ctx, { avatar: null, banner: null });
    expect(msg.file).toBeUndefined();
    expect(msg.embeds).toHaveLength(0);
  });
});
