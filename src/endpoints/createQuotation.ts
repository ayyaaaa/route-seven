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
          let price = product.priceInMVR || 0
          let variantId: number | null = null

          if (item.variant && typeof item.variant === 'object') {
            price = item.variant.priceInMVR || price
            variantId = item.variant.id
          } else if (typeof item.variant === 'number') {
            variantId = item.variant
          }

          if (item.quantity) {
            quotationItems.push({
              product: product.id,
              variant: variantId,
              quantity: item.quantity,
              price: price / 100, // Convert from cents
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
          total: (cartData.subtotal || 0) / 100, // Convert from cents
          status: 'draft',
        },
      })

      // 4. Clear user's cart
      // (We removed this, the frontend 'clearCart()' handles it)

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