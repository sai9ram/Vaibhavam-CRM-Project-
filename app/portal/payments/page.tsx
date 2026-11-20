'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, CheckCircle2, Clock, DollarSign, Receipt, FileSignature, Eye } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/format';
import { InvoicePreviewDialog } from '@/components/invoice-preview-dialog';
import { AgreementPreviewDialog } from '@/components/agreement-preview-dialog';
import { toast } from 'sonner';
import type { Payment, Project, Client, Invoice, Agreement } from '@/types/database';

export default function PortalPaymentsPage() {
  const { profile, studio } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewAgreement, setPreviewAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (profile) loadData(); }, [profile]);

  async function loadData() {
    const { data: clientData } = await supabase.from('clients').select('*').eq('user_id', profile!.id).maybeSingle();
    if (!clientData) { setLoading(false); return; }
    setClient(clientData);

    const { data: projData } = await supabase.from('projects').select('*').eq('client_id', clientData.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (projData) {
      setProject(projData);
      const [{ data: payData }, { data: invData }, { data: agrData }] = await Promise.all([
        supabase.from('payments').select('*').eq('project_id', projData.id).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('project_id', projData.id).order('created_at', { ascending: false }),
        supabase.from('agreements').select('*').eq('project_id', projData.id).order('created_at', { ascending: false }),
      ]);
      setPayments(payData || []);
      setInvoices((invData as Invoice[]) || []);
      setAgreements((agrData as Agreement[]) || []);
    }
    setLoading(false);
  }

  async function handleSignAgreement(signerName: string, signatureDataUrl: string) {
    if (!previewAgreement) return;
    const { data: updated, error } = await supabase
      .from('agreements')
      .update({
        client_signer_name: signerName,
        signature_data_url: signatureDataUrl,
        signed_at: new Date().toISOString(),
        status: 'signed',
      })
      .eq('id', previewAgreement.id)
      .select()
      .single();

    if (error || !updated) {
      toast.error(error?.message || 'Could not save signature. Please try again.');
    } else {
      toast.success('Agreement signed! You can download a copy anytime.');
      setPreviewAgreement(updated as Agreement);
      loadData();
    }
  }

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0);
  const currency = studio?.currency || 'INR';

  if (loading) return <div className="p-8 animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-32 bg-muted rounded-xl" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in space-y-6">
      <PageHeader title="Payments, Invoices &amp; Agreement" description="View your payment schedule, download invoices, and sign your service agreement" />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="w-3.5 h-3.5" /> Package Total</div>
          <p className="font-serif text-2xl">{formatCurrency(project?.package_amount || 0, currency)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-success text-xs mb-1"><CheckCircle2 className="w-3.5 h-3.5" /> Total Paid</div>
          <p className="font-serif text-2xl text-success">{formatCurrency(totalPaid, currency)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-warning text-xs mb-1"><Clock className="w-3.5 h-3.5" /> Pending</div>
          <p className="font-serif text-2xl text-warning">{formatCurrency(totalPending, currency)}</p>
        </Card>
      </div>

      {/* Service Agreements */}
      {agreements.length > 0 && (
        <Card className="p-5">
          <h3 className="font-serif text-lg mb-4">Service Agreement</h3>
          <div className="space-y-3">
            {agreements.map(agr => (
              <div key={agr.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${agr.status === 'signed' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                    <FileSignature className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{agr.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {agr.status === 'signed'
                        ? `Signed by ${agr.client_signer_name} on ${formatDate(agr.signed_at)}`
                        : 'Please review and sign this agreement'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={agr.status === 'signed' ? 'default' : 'outline'} className="capitalize">
                    {agr.status === 'signed' ? 'Signed' : 'Action Needed'}
                  </Badge>
                  <Button
                    size="sm"
                    onClick={() => setPreviewAgreement(agr)}
                    className={agr.status === 'sent' ? 'bg-gradient-luxe text-white h-8 text-xs' : 'h-8 text-xs'}
                    variant={agr.status === 'sent' ? 'default' : 'outline'}
                  >
                    {agr.status === 'sent' ? 'Review & Sign' : 'View / PDF'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Invoices */}
      {invoices.length > 0 && (
        <Card className="p-5">
          <h3 className="font-serif text-lg mb-4">Invoices</h3>
          <div className="space-y-3">
            {invoices.map(inv => (
              <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm font-mono">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">
                      Issued {formatDate(inv.issued_at)} {inv.due_date ? `· Due ${formatDate(inv.due_date)}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-serif text-lg">{formatCurrency(inv.total_amount, currency)}</span>
                  <Badge variant={inv.status === 'paid' ? 'default' : 'outline'} className="capitalize">{inv.status}</Badge>
                  <Button size="sm" variant="outline" onClick={() => setPreviewInvoice(inv)} className="h-8 text-xs">
                    <Eye className="w-3.5 h-3.5 mr-1" /> View / PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Payment list */}
      {payments.length === 0 ? (
        <Card className="p-12 text-center">
          <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <h3 className="font-serif text-lg mb-2">No payment records</h3>
          <p className="text-muted-foreground text-sm">Your payment records will appear here once they are added by the studio.</p>
        </Card>
      ) : (
        <Card className="p-5">
          <h3 className="font-serif text-lg mb-4">Payment History</h3>
          <div className="space-y-3">
            {payments.map(pay => (
              <div key={pay.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${pay.status === 'paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm capitalize">{pay.payment_type} Payment</p>
                    <p className="text-xs text-muted-foreground">
                      {pay.status === 'paid' ? `Paid on ${formatDate(pay.paid_at)}` : pay.due_date ? `Due ${formatDate(pay.due_date)}` : 'Pending'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-serif text-lg">{formatCurrency(pay.amount, currency)}</span>
                  <Badge variant={pay.status === 'paid' ? 'default' : 'outline'}>{pay.status === 'paid' ? 'Paid' : 'Pending'}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <InvoicePreviewDialog
        invoice={previewInvoice}
        open={!!previewInvoice}
        onOpenChange={(o) => { if (!o) setPreviewInvoice(null); }}
        studio={studio}
        client={client}
        project={project}
      />

      <AgreementPreviewDialog
        agreement={previewAgreement}
        open={!!previewAgreement}
        onOpenChange={(o) => { if (!o) setPreviewAgreement(null); }}
        studio={studio}
        client={client}
        project={project}
        canSign={previewAgreement?.status === 'sent'}
        onSign={handleSignAgreement}
      />
    </div>
  );
}
