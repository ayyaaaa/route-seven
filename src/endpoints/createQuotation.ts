import type { Endpoint, PayloadRequest } from 'payload'
import type { Cart, Product, User } from '../payload-types'

export const createQuotation: Endpoint = {
  path: '/create-quotation',
  method: 'post',

  handler: async (req: PayloadRequest) => {
    if (!req.user) {
      return Response.json(
        { error: 'Unauthorized. Please log in to request a quotation.' },
        { status: 401 },
      )
    }

    const user = req.user as User

    try {
      // 1. Get user's cart
      const cartResult = (await req.payload.find({
        collection: 'carts',
        where: { customer: { equals: user.id } },
        depth: 2,
      })) as { docs: Cart[] }

      if (!cartResult.docs[0]) {
        return Response.json({ error: 'Cart not found.' }, { status: 400 })
      }

      const cartData = cartResult.docs[0]

      // 2. Validate items
      if (!cartData.items || cartData.items.length === 0) {
        return Response.json({ error: 'Your cart is empty.' }, { status: 400 })
      }

      const quotationItems: {
        product: number
        variant?: number | null
        quantity: number
        price: number
      }[] = []

      for (const item of cartData.items) {
        if (item.product && typeof item.product === 'object') {
          const product = item.product as Product
          
          // --- THIS IS THE FIX ---
          // Divide by 100 to convert from cents to dollars
          let price = (product.priceInMVR || 0) / 100
          // --- END FIX ---
          
          let variantId: number | null = null

          if (item.variant && typeof item.variant === 'object') {
            // --- THIS IS THE FIX ---
            // Also divide variant price by 100
            price = (item.variant.priceInMVR || 0) / 100
            // --- END FIX ---
            variantId = item.variant.id
          } else if (typeof item.variant === 'number') {
            variantId = item.variant
          }

          if (item.quantity) {
            quotationItems.push({
              product: product.id,
              variant: variantId,
              quantity: item.quantity,
              price, // This is now in dollars
            })
          }
        }
      }

      if (quotationItems.length === 0) {
        return Response.json(
          { error: 'No valid items in cart to quote.' },
          { status: 400 },
        )
      }

      // 3. Create quotation
      const newQuotation = await req.payload.create({
        collection: 'quotations',
        data: {
          user: user.id,
          items: quotationItems,
          
          // --- THIS IS THE FIX ---
          // Also divide the total by 100
          total: (cartData.subtotal || 0) / 100,
          // --- END FIX ---
          
          status: 'draft',
        },
      })

      // 4. Clear user's cart
      await req.payload.update({
        collection: 'carts',
        id: cartData.id,
        data: { items: [] },
      })

      return Response.json(
        {
          message: 'Quotation created successfully!',
          quotation: newQuotation,
        },
        { status: 201 },
      )
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'An error occurred while creating your quotation. Please try again.'

      req.payload.logger.error(`[create-quotation] ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  },
}