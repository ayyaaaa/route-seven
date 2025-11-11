import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; // <-- Import plugin
import type { Endpoint, PayloadRequest } from 'payload';
import type { Address, Quotation, User } from '../payload-types';

// Helper function for consistent styling
const addSection = (
  doc: jsPDF,
  title: string,
  yPos: number,
  content: () => number,
): number => {
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100); // Muted gray for section title
  doc.text(title.toUpperCase(), 20, yPos);
  doc.setDrawColor(228, 228, 231); // Shadcn border color (zinc-200)
  doc.line(20, yPos + 2, 190, yPos + 2); // Thin line separator
  
  const newY = content();
  return newY + 5; // Return new Y position with padding
};

export const downloadQuotation: Endpoint = {
  path: '/download-quotation',
  method: 'get',

  handler: async (req: PayloadRequest) => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url || '', 'http://localhost');
    const id = url.searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Quotation ID is required' }, { status: 400 });
    }

    const user = req.user as User;

    try {
      // 1. Find the quotation
      const quotation = (await req.payload.findByID({
        collection: 'quotations',
        id: id,
        depth: 2,
      })) as Quotation;

      // 2. Security Check
      if (typeof quotation.user !== 'object' || quotation.user?.id !== user.id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      // 3. Find addresses
      const { docs: addresses } = await req.payload.find({
        collection: 'addresses',
        where: { customer: { equals: user.id } },
        limit: 1,
      });
      const address: Partial<Address> = addresses[0] || {};

      // --- 4. Create the PDF ---
      const doc = new jsPDF();
      let y = 20;
      const xStart = 20;
      const xEnd = 190; // Page width - margin

      // === HEADER ===
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('QUOTATION', xStart, y);

      // --- Your Company Info (Hardcoded, but you could fetch this) ---
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Route-Seven', xEnd, y - 10, { align: 'right' });
      doc.text('Maafushi, Maldives', xEnd, y - 5, { align: 'right' });
      doc.text('contact@route-seven.com', xEnd, y, { align: 'right' });
      y += 10;

      // === DOCUMENT INFO ===
      const infoY = y;
      addSection(doc, 'Customer', infoY, () => {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(user.name || 'N/A', xStart, infoY + 8);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(user.email, xStart, infoY + 13);
        doc.text(address.addressLine1 || 'No address on file', xStart, infoY + 18);
        return infoY + 18;
      });
      
      // --- Quotation Info ---
      const quotY = y;
      addSection(doc, 'Quotation Details', quotY, () => {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);

        // Using autoTable for simple key-value pairs makes alignment easy
        autoTable(doc, {
          startY: quotY + 8,
          body: [
            ['Quotation ID:', quotation.id],
            ['Date Issued:', new Date(quotation.createdAt).toLocaleDateString()],
            ['Status:', quotation.status || 'Pending'],
          ],
          theme: 'plain', // No lines
          styles: {
            fontSize: 10,
            cellPadding: { top: 0.5, right: 0, bottom: 0.5, left: 0 },
          },
          columnStyles: {
            0: { fontStyle: 'bold' },
          },
          // This ensures the table starts at the right side
          margin: { left: 100 }, 
        });
        
        // We have to return a Y-pos, so we'll just guess based on 3 rows
        return quotY + 20;
      });

      y = 80; // Set a fixed start Y for the main table

      // === ITEMS TABLE ===
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('QUOTED ITEMS', xStart, y);
      doc.setDrawColor(228, 228, 231);
      doc.line(xStart, y + 2, xEnd, y + 2);
      y += 5;

      const tableData =
        quotation.items?.map(item => {
          if (typeof item.product === 'object' && item.product !== null) {
            const price = item.price || 0;
            const subtotal = (item.quantity || 0) * price;
            return [
              item.product.title,
              item.product.id || 'N/A',
              item.quantity,
              `MVR ${price.toFixed(2)}`,
              `MVR ${subtotal.toFixed(2)}`,
            ];
          }
          return [];
        }) || [];

      autoTable(doc, {
        startY: y,
        head: [['Item', 'SKU', 'Qty', 'Unit Price', 'Subtotal']],
        body: tableData,
        theme: 'grid', // This gives the clean line look
        headStyles: {
          fillColor: [244, 244, 245], // Shadcn muted-foreground (zinc-100)
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 10,
        },
        styles: {
          font: 'Helvetica',
          fontSize: 10,
          cellPadding: 2,
        },
        columnStyles: {
          // Right-align currency columns
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
        },
        // 'autoTable' returns the table object,
        // 'finalY' is the Y position after the table
        didDrawPage: (data) => {
          // === TOTALS ===
          const tableY = data.cursor?.y || y + 20; // Get Y pos after table
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(10);
          
          const total = quotation.total || 0;
          
          // Draw a line above the total
          doc.setDrawColor(228, 228, 231);
          doc.line(120, tableY + 5, xEnd, tableY + 5);
          
          doc.text('Total:', 120, tableY + 10);
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(12);
          doc.text(`MVR ${total.toFixed(2)}`, xEnd, tableY + 10, { align: 'right' });
        }
      });
      // --- End PDF Content ---

      // 5. Serialize PDF
      const pdfBytes = doc.output('arraybuffer');

      // 6. Send Response
      return new Response(pdfBytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="quotation-${quotation.id}.pdf"`,
        },
        status: 200,
      });
    } catch (error: unknown) {
      // ... your error handling
      const message = error instanceof Error ? error.message : 'Error generating PDF';
      req.payload.logger.error(`[download-quotation] ${message}`);
      return Response.json({ error: message }, { status: 500 });
    }
  },
};