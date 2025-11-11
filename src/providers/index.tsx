import { AuthProvider } from '@/providers/Auth'
import { EcommerceProvider } from '@payloadcms/plugin-ecommerce/client/react'
import React from 'react'

import { SonnerProvider } from '@/providers/Sonner'
import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'

// --- Currency configuration ---
const mvrCurrency = {
  code: 'MVR',
  label: 'Maldivian Rufiyaa',
  decimals: 2,
  symbol: 'MVR',
}

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HeaderThemeProvider>
          <SonnerProvider />
          <EcommerceProvider
            currenciesConfig={{
              defaultCurrency: 'MVR',
              supportedCurrencies: [mvrCurrency],
            }}
            enableVariants
            api={{
              cartsFetchQuery: {
                depth: 2,
                populate: {
                  products: {
                    slug: true,
                    title: true,
                    gallery: true,
                    inventory: true,
                  },
                  variants: {
                    title: true,
                    inventory: true,
                  },
                },
              },
            }}
            paymentMethods={[]}
          >
            {children}
          </EcommerceProvider>
        </HeaderThemeProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
