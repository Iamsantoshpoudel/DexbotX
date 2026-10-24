import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api } from './api';
import { adminApi } from './adminApi';
import editor from './editorSlice';

/** A new store per request on the server, so state is never shared between visitors. */
export const makeStore = () => {
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer, [adminApi.reducerPath]: adminApi.reducer, editor },
    middleware: (getDefault) => getDefault().concat(api.middleware, adminApi.middleware),
  });
  setupListeners(store.dispatch); // enables refetchOnFocus / refetchOnReconnect
  return store;
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
