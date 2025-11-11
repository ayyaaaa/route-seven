// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'

import {
  BoldFeature,
  EXPERIMENTAL_TableFeature,
  IndentFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  UnderlineFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Categories } from '@/collections/Categories'
import { Media } from '@/collections/Media'
import { Pages } from '@/collections/Pages'
import { Users } from '@/collections/Users'
import { Footer } from '@/globals/Footer'
import { Header } from '@/globals/Header'
import { plugins } from './plugins'

// --- We added these in previous steps ---
import { quotationsPlugin } from '@/plugins/quotationsPlugin'
import { createQuotation } from './endpoints/createQuotation'
// ---

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    components: {
      beforeLogin: ['@/components/BeforeLogin#BeforeLogin'],
      beforeDashboard: ['@/components/BeforeDashboard#BeforeDashboard'],
    },
    user: Users.slug,
  },
  // --- This is from our previous step ---
  // 'Quotations' is removed from here because it's in a plugin
  collections: [Users, Pages, Categories, Media],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    push: true,
  }),
  editor: lexicalEditor({
    features: () => {
      return [
        UnderlineFeature(),
        BoldFeature(),
        ItalicFeature(),
        OrderedListFeature(),
        UnorderedListFeature(),
        LinkFeature({
          enabledCollections: ['pages'],
          fields: ({ defaultFields }) => {
            const defaultFieldsWithoutUrl = defaultFields.filter((field) => {
              if ('name' in field && field.name === 'url') return false
              return true
            })

            return [
              ...defaultFieldsWithoutUrl,
              {
                name: 'url',
                type: 'text',
                admin: {
                  // --- SYNTAX ERROR FIX HERE ---
                  condition: ({ linkType }) => linkType !== 'internal',
                  // --- END FIX ---
                },
                label: ({ t }) => t('fields:enterURL'),
                required: true,
              },
            ]
          },
        }),
        IndentFeature(),
        EXPERIMENTAL_TableFeature(),
      ]
    },
  }),
  //email: nodemailerAdapter(),

  // --- This is from our previous step ---
  endpoints: [createQuotation],

  globals: [Header, Footer],

  // --- This is the CSRF fix ---
  csrf: [
    process.env.PAYLOAD_PUBLIC_SERVER_URL || '',
    process.env.NEXT_PUBLIC_SERVER_URL || '',
  ].filter(Boolean),
  // --- END CSRF FIX ---

  plugins: [
    ...plugins, // Contains ecommercePlugin
    quotationsPlugin(), // From our previous step
    // storage-adapter-placeholder
  ],
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // sharp,
})