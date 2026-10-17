import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { EmbedConfig, ImageConfig, MessageConfig, MessageContent } from '@/lib/types';

/**
 * The message being edited. `saved` mirrors the server; `draft` is what the form shows.
 * Keeping both in Redux lets the form, the live preview and the save bar share one source of truth.
 */
export interface EditorState {
  key: string | null; // `${guildId}:${kind}`
  saved: MessageConfig | null;
  draft: MessageConfig | null;
}

const initialState: EditorState = { key: null, saved: null, draft: null };

export const isDirty = (s: EditorState): boolean =>
  !!s.draft && !!s.saved && JSON.stringify(s.draft) !== JSON.stringify(s.saved);

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    /** Load server data. Never overwrites unsaved edits for the same message. */
    load(state, { payload }: PayloadAction<{ key: string; config: MessageConfig }>) {
      if (state.key === payload.key && isDirty(state)) return;
      state.key = payload.key;
      state.saved = payload.config;
      state.draft = payload.config;
    },
    patch(state, { payload }: PayloadAction<Partial<Pick<MessageConfig, 'enabled' | 'channelId' | 'content'>>>) {
      if (state.draft) Object.assign(state.draft, payload);
    },
    patchEmbed(state, { payload }: PayloadAction<Partial<EmbedConfig>>) {
      if (state.draft) Object.assign(state.draft.embed, payload);
    },
    patchImage(state, { payload }: PayloadAction<Partial<ImageConfig>>) {
      if (state.draft) Object.assign(state.draft.image, payload);
    },
    /** Replace text/embed/image with a preset but keep the on/off switch and channel. */
    applyPreset(state, { payload }: PayloadAction<MessageContent>) {
      if (!state.draft) return;
      state.draft = { ...payload, enabled: state.draft.enabled, channelId: state.draft.channelId };
    },
    markSaved(state, { payload }: PayloadAction<MessageConfig>) {
      state.saved = payload;
      state.draft = payload;
    },
    discard(state) {
      state.draft = state.saved;
    },
  },
});

export const { load, patch, patchEmbed, patchImage, applyPreset, markSaved, discard } = editorSlice.actions;
export default editorSlice.reducer;
