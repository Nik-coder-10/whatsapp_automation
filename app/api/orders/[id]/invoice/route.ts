import { handleRouteError } from "@/lib/api/errors";
import { getInvoiceData } from "@/lib/invoices/service";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { invoicePdfResponse } from "@/lib/invoices/response";

// pdfkit needs the Node runtime (no Edge).
export const runtime = "nodejs";

/**
 * GET /api/orders/[id]/invoice — the order's tax-invoice PDF.
 *
 * Authorization mirrors the order page exactly: the unguessable order
 * UUID in the PATH is the capability (guest-capable, no login). There
 * is deliberately no `?id=` accessor — query values are ignored, so no
 * alternate probe endpoint exists. Unknown/malformed ids fail closed
 * with 404 (no IDOR oracle); unpaid orders get 409, never a PDF.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const invoice = await getInvoiceData(id);
    const pdf = await renderInvoicePdf(invoice);
    const inline =
      new URL(req.url).searchParams.get("disposition") === "inline";
    return invoicePdfResponse(invoice.invoiceNumber, pdf, inline);
  } catch (error) {
    return handleRouteError(error);
  }
}
