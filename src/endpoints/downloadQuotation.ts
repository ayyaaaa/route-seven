import { jsPDF } from 'jspdf';
import type { Endpoint, PayloadRequest } from 'payload';
import type { Address, Quotation, User } from '../payload-types';

export const downloadQuotation: Endpoint = {
  path: '/download-quotation', // CHANGED: Removed /:id
  method: 'get',
  
  handler: async (req: PayloadRequest) => {
    
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CHANGED: Extract ID from query parameters
    const url = new URL(req.url || '', 'http://localhost')
    const id = url.searchParams.get('id')
    
    if (!id) {
      return Response.json({ error: 'Quotation ID is required' }, { status: 400 })
    }
    
    const user = req.user as User

    try {
      // 1. Find the quotation
      const quotation = (await req.payload.findByID({
        collection: 'quotations',
        id: id,
        depth: 2, // Populate products
      })) as Quotation

      // 2. Security Check
      if (typeof quotation.user !== 'object' || quotation.user?.id !== user.id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }

      // 3. Find the user's addresses
      const { docs: addresses } = await req.payload.find({
        collection: 'addresses',
        where: {
          customer: { equals: user.id },
        },
        limit: 1,
      })
      const address: Partial<Address> = addresses[0] || {}

      // 4. Create the PDF with jsPDF
      const doc = new jsPDF();
      let y = 30; // jsPDF starts Y from the top
      const x = 20;
      const lineSpacing = 8;

      // --- Add PDF Content ---
      doc.setFontSize(18);
      doc.text('Quotation Request', x, y);
      y += lineSpacing * 2;
      
      doc.setFontSize(12);
      doc.text(`Quotation ID: ${quotation.id}`, x, y);
      y += lineSpacing;
      doc.text(`Date: ${new Date(quotation.createdAt).toLocaleDateString()}`, x, y);
      y += lineSpacing * 2;

      // Customer Details
      doc.setFontSize(14);
      doc.text('Customer Details:', x, y);
      y += lineSpacing;
      
      doc.setFontSize(12);
      doc.text(`Name: ${user.name || 'N/A'}`, x, y);
      y += lineSpacing;
      doc.text(`Email: ${user.email}`, x, y);
      y += lineSpacing;
      doc.text(`Address: ${address.addressLine1 || 'No address on file'}`, x, y);
      y += lineSpacing * 2;

      // Items
      doc.setFontSize(14);
      doc.text('Quoted Items:', x, y);
      y += lineSpacing;
      
      doc.setFontSize(12);
      quotation.items?.forEach(item => {
        if (typeof item.product === 'object' && item.product !== null) {
          const price = item.price || 0
          const line = `${item.quantity} x ${item.product.title} - MVR${price.toFixed(2)} each`;
          doc.text(line, x, y);
          y += lineSpacing;
        }
      });

      y += lineSpacing; // Extra space
      doc.setFontSize(16);
      const total = quotation.total || 0
      doc.text(`Total: MVR ${total.toFixed(2)}`, x, y);
      // --- End PDF Content ---

      // 5. Serialize the PDF to bytes
      const pdfBytes = doc.output('arraybuffer');

      // 6. Send the PDF as a Response
      return new Response(pdfBytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="quotation-${quotation.id}.pdf"`,
        },
        status: 200,
      });

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error generating PDF';
      req.payload.logger.error(`[download-quotation] ${message}`);
      return Response.json({ error: message }, { status: 500 });
    }
  },
}