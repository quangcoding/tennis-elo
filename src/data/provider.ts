import { inject, type App } from 'vue'
import { DataStoreKey, type DataStore } from './types'

/** Register a DataStore implementation app-wide (call in main.ts). */
export const provideDataStore = (app: App, store: DataStore): void => {
  app.provide(DataStoreKey, store)
}

/** Retrieve the injected DataStore from within a component / composable. */
export const useDataStore = (): DataStore => {
  const store = inject(DataStoreKey)
  if (!store) {
    throw new Error('DataStore was not provided. Did you call provideDataStore() in main.ts?')
  }
  return store
}
