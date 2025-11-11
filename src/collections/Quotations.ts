import { adminOnly } from '@/access/adminOnly'
import { adminOrCustomerOwner } from '@/access/adminOrCustomerOwner'
import type { CollectionConfig } from 'payload'

export const Quotations: CollectionConfig = {
  slug: 'quotations',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['id', 'user', 'total', 'status', 'createdAt'],
    group: 'Shop',
  },
  access: {
    read: adminOrCustomerOwner,
    create: () => true,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true,
        },
        {
          name: 'variant',
          type: 'relationship',
          // --- THIS IS THE FIX ---
          relationTo: 'variants', // Changed from 'product-variants'
          // --- END FIX ---
        },
        {
          name: 'quantity',
          type: 'number',
          min: 1,
          required: true,
        },
        {
          name: 'price', 
          type: 'number',
          admin: {
            description: 'Price of a single item at the time of quotation.',
          },
        },
      ],
    },
    {
      name: 'total',
      type: 'number',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Sent', value: 'sent' },
        { label: 'Expired', value: 'expired' },
      ],
      defaultValue: 'draft',
      admin: {
        position: 'sidebar',
      },
    },
  ],
}