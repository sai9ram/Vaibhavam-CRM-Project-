'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/format';
import type { Payment, Project } from '@/types/database';

export default function PortalPaymentsPage() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (profile) loadData(); }, [profile]);

  async function loadData() {
    const { data: clientData } = await supabase.from('clients').select('*').eq('user_id', profile!.id).maybeSingle();
    if (!clientData) { setLoading(false); return; }
    const { data: projData } = await supabase.from('projects').select('*').eq('client_id', clientData.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (projData) {
      setProject(projData);
      const { data: payData } = await supabase.from('payments').select('*').eq('project_id', projData.id).order('created_at', { ascending: false });
      setPayments(payData || []);
    }
    setLoading(false);
  }

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0);

  if (loading) return <div className="p-8 animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-32 bg-muted rounded-xl" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">
      <PageHeader title="Payments" description="Your payment history and status" />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="w-3.5 h-3.5" /> Package Total</div>
          <p className="font-serif text-2xl">{formatCurrency(project?.package_amount || 0)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-success text-xs mb-1"><CheckCircle2 className="w-3.5 h-3.5" /> Total Paid</div>
          <p className="font-serif text-2xl text-success">{formatCurrency(totalPaid)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-warning text-xs mb-1"><Clock className="w-3.5 h-3.5" /> Pending</div>
          <p className="font-serif text-2xl text-warning">{formatCurrency(totalPending)}</p>
        </Card>
      </div>

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
                  <span className="font-serif text-lg">{formatCurrency(pay.amount)}</span>
                  <Badge variant={pay.status === 'paid' ? 'default' : 'outline'}>{pay.status === 'paid' ? 'Paid' : 'Pending'}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
