'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Camera } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Invoice, Client, Project, Studio } from '@/types/database';

interface InvoicePreviewDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studio: Studio | null;
  client: Client | null;
  project: Project | null;
}

export function InvoicePreviewDialog({
  invoice,
  open,
  onOpenChange,
  studio,
  client,
  project,
}: InvoicePreviewDialogProps) {
  if (!invoice) return null;

  const currency = studio?.currency || 'INR';
  const brandColor = studio?.brand_color || '#82172f';
  const studioName = studio?.name || 'SureShotz';
  const clientName = client ? `${client.bride_name} & ${client.groom_name}` : 'Client';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto print:shadow-none print:border-none">
        <DialogHeader className="print:hidden">
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="font-serif text-xl">Invoice {invoice.invoice_number}</DialogTitle>
            <Button size="sm" onClick={() => window.print()} className="bg-gradient-luxe text-white">
              <Printer className="w-4 h-4 mr-1.5" /> Print / Save PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="p-6 rounded-xl border border-border bg-white text-slate-900 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-3">
              {studio?.logo_url ? (
                <img src={studio.logo_url} alt={studioName} className="w-12 h-12 rounded-lg object-cover border" />
              ) : (
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: brandColor }}>
                  <Camera className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <h2 className="font-serif text-xl font-semibold">{studioName}</h2>
                <p className="text-xs text-slate-500">Photography &amp; Film Studio</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-slate-500">Invoice</div>
              <div className="font-mono font-semibold text-base">{invoice.invoice_number}</div>
              <Badge
                className="mt-1 capitalize"
                variant={invoice.status === 'paid' ? 'default' : 'outline'}
              >
                {invoice.status}
              </Badge>
            </div>
          </div>

          {/* Client & Dates */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs uppercase text-slate-500 mb-1">Billed To</div>
              <div className="font-medium">{clientName}</div>
              {client?.email && <div className="text-xs text-slate-600">{client.email}</div>}
              {client?.phone && <div className="text-xs text-slate-600">{client.phone}</div>}
              {project?.title && <div className="text-xs text-slate-600 mt-1">Project: {project.title}</div>}
            </div>
            <div className="text-right space-y-1">
              <div>
                <span className="text-xs text-slate-500">Issued: </span>
                <span className="font-medium">{formatDate(invoice.issued_at)}</span>
              </div>
              {invoice.due_date && (
                <div>
                  <span className="text-xs text-slate-500">Due Date: </span>
                  <span className="font-medium">{formatDate(invoice.due_date)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Description</th>
                  <th className="text-right p-3">Qty</th>
                  <th className="text-right p-3">Price</th>
                  <th className="text-right p-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(invoice.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-3">{item.description}</td>
                    <td className="p-3 text-right">{item.quantity}</td>
                    <td className="p-3 text-right">{formatCurrency(item.unit_price, currency)}</td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(item.quantity * item.unit_price, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{formatCurrency(invoice.subtotal, currency)}</span>
              </div>
              {Number(invoice.tax_rate) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Tax ({invoice.tax_rate}%)</span>
                  <span>{formatCurrency(invoice.tax_amount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-serif text-lg font-semibold pt-2 border-t border-slate-200">
                <span>Total</span>
                <span style={{ color: brandColor }}>{formatCurrency(invoice.total_amount, currency)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
              <span className="font-medium text-slate-800">Notes: </span>
              {invoice.notes}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
