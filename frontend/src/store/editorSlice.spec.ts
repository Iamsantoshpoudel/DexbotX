import { describe, expect, it } from 'vitest';
import type { MessageConfig } from '@/lib/types';
import reducer, { applyPreset, discard, isDirty, load, markSaved, patch, patchImage } from './editorSlice';

const base: MessageConfig = {
  enabled: false,
  channelId: null,
  content: 'hi',
  embed: { enabled: false, title: '', description: '', color: '#5b4bff', footer: '' },
  image: { enabled: true, style: 'midnight', title: 'Welcome', subtitle: '', accentColor: '#7c6cff', useServerBanner: false, avatarShape: 'circle', showMemberCount: true, backgroundPath: null },
};
const init = () => reducer(undefined, load({ key: 'g:welcome', config: base }));

describe('editorSlice', () => {
  it('tracks dirty state', () => {
    let s = init();
    expect(isDirty(s)).toBe(false);
    s = reducer(s, patch({ content: 'changed' }));
    expect(isDirty(s)).toBe(true);
    s = reducer(s, discard());
    expect(isDirty(s)).toBe(false);
  });
  it('does not overwrite unsaved edits when the same message reloads', () => {
    let s = reducer(init(), patch({ content: 'mine' }));
    s = reducer(s, load({ key: 'g:welcome', config: { ...base, content: 'server' } }));
    expect(s.draft?.content).toBe('mine');
  });
  it('replaces the draft when switching to another message', () => {
    let s = reducer(init(), patch({ content: 'mine' }));
    s = reducer(s, load({ key: 'g:goodbye', config: { ...base, content: 'bye' } }));
    expect(s.draft?.content).toBe('bye');
  });
  it('applies a preset but keeps the switch and channel', () => {
    let s = reducer(init(), patch({ enabled: true, channelId: '111111111111111111' }));
    s = reducer(s, applyPreset({ content: 'preset', embed: base.embed, image: { ...base.image, style: 'neon' } }));
    expect(s.draft).toMatchObject({ enabled: true, channelId: '111111111111111111', content: 'preset' });
    expect(s.draft?.image.style).toBe('neon');
  });
  it('patches nested image fields and marks saved', () => {
    let s = reducer(init(), patchImage({ accentColor: '#ffffff' }));
    expect(s.draft?.image.accentColor).toBe('#ffffff');
    s = reducer(s, markSaved(s.draft!));
    expect(isDirty(s)).toBe(false);
  });
  const PATH = `${'1'.repeat(18)}/${'a'.repeat(64)}.jpg`;
  it('sets and clears the uploaded background and tracks it as an unsaved change', () => {
    let s = reducer(init(), patchImage({ backgroundPath: PATH }));
    expect(s.draft?.image.backgroundPath).toBe(PATH);
    expect(isDirty(s)).toBe(true);
    s = reducer(s, markSaved(s.draft!));
    expect(isDirty(s)).toBe(false);
    s = reducer(s, patchImage({ backgroundPath: null }));
    expect(s.draft?.image.backgroundPath).toBeNull();
    expect(isDirty(s)).toBe(true);
  });
  it('keeps a saved background when other image fields change', () => {
    let s = reducer(init(), markSaved({ ...base, image: { ...base.image, backgroundPath: PATH } }));
    s = reducer(s, patchImage({ accentColor: '#ffffff' }));
    expect(s.draft?.image.backgroundPath).toBe(PATH);
  });
  it('lets a preset replace the background with the preset value', () => {
    let s = reducer(init(), patchImage({ backgroundPath: PATH }));
    s = reducer(s, applyPreset({ content: 'p', embed: base.embed, image: { ...base.image, backgroundPath: null } }));
    expect(s.draft?.image.backgroundPath).toBeNull();
  });
});
