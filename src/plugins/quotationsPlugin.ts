// src/plugins/quotationsPlugin.ts
import type { Plugin } from 'payload'
import { Quotations } from '../collections/Quotations'; // Import your collection

// This plugin will add the Quotations collection
export const quotationsPlugin = (): Plugin => (config) => {
  return {
    ...config,
    collections: [
      ...(config.collections || []),
      Quotations, // Add the Quotations collection
    ],
  }
}