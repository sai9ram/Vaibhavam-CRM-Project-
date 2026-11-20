'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SignaturePad } from '@/components/signature-pad';
import { Printer, Camera, CheckCircle2, FileSignature } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { Agreement, Studio, Client, Project } from '@/types/database';

interface AgreementPreviewDialogProps {
  agreement: Agreement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studio: Studio | null;
  client: Client | null;
  project: Project | null;
  canSign?: boolean;
  onSign?: (signerName: string, signatureDataUrl: string) => Promise<void>;
}

export function AgreementPreviewDialog({
  agreement,
  open,
  onOpenChange,
  studio,
  client,
  project,
  canSign = false,
  onSign,
}: AgreementPreviewDialogProps) {
  const [signerName, setSignerName] = useState(
    client ? `${client.bride_name} & ${client.groom_name}`.replace(/^ & | & $/g, '') : ''
  );
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!agreement) return null;

  const brandColor = studio?.brand_color || '#82172f';
  const studioName = studio?.name || 'SureShotz';

  async function handleConfirmSign() {
    if (!onSign) return;
    if (!signerName.trim() || !signatureDataUrl) return;
    setSubmitting(true);
    await onSign(signerName.trim(), signatureDataUrl);
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto print:shadow-none print:border-none">
        <DialogHeader className="print:hidden">
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="font-serif text-xl">{agreement.title}</DialogTitle>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1.5" /> Print / Save PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="p-6 rounded-xl border border-border bg-white text-slate-900 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              {studio?.logo_url ? (
                <img src={studio.logo_url} alt={studioName} className="w-11 h-11 rounded-lg object-cover border" />
              ) : (
                <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: brandColor }}>
                  <Camera className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <h2 className="font-serif text-lg font-semibold">{studioName}</h2>
                <p className="text-xs text-slate-500">{agreement.title}</p>
              </div>
            </div>
            <Badge variant={agreement.status === 'signed' ? 'default' : 'outline'} className="capitalize">
              {agreement.status === 'signed' ? 'Signed' : agreement.status}
            </Badge>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded-lg">
            <div>
              <div className="text-slate-500">Studio</div>
              <div className="font-medium text-slate-900">{studioName}</div>
              {agreement.studio_signer_name && <div className="text-slate-600">Rep: {agreement.studio_signer_name}</div>}
            </div>
            <div>
              <div className="text-slate-500">Client &amp; Event</div>
              <div className="font-medium text-slate-900">
                {client ? `${client.bride_name} & ${client.groom_name}` : 'Client'}
              </div>
              {project && (
                <div className="text-slate-600">
                  {project.title} {project.event_date ? `· ${formatDate(project.event_date)}` : ''}
                </div>
              )}
            </div>
          </div>

          {/* Agreement Terms */}
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700 border border-slate-200 rounded-lg p-4 max-h-72 overflow-y-auto print:max-h-none">
            {agreement.terms_text}
          </div>

          {/* Signed Signature Display */}
          {agreement.status === 'signed' && agreement.signature_data_url && (
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> Digitally Signed &amp; Locked
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <div className="text-xs text-slate-500">Signed By</div>
                  <div className="font-medium text-sm">{agreement.client_signer_name}</div>
                  {agreement.signed_at && (
                    <div className="text-xs text-slate-500 mt-0.5">Date: {formatDate(agreement.signed_at)}</div>
                  )}
                </div>
                <div className="bg-white rounded-lg border border-emerald-200 p-2 flex items-center justify-center">
                  <img
                    src={agreement.signature_data_url}
                    alt="Client Digital Signature"
                    className="max-h-20 object-contain"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Client Interactive Signing */}
          {canSign && agreement.status === 'sent' && onSign && (
            <div className="pt-2 border-t border-slate-200 space-y-4 print:hidden">
              <div className="space-y-1.5">
                <Label htmlFor="signerName" className="text-slate-800">Your Full Name</Label>
                <Input
                  id="signerName"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  placeholder="Enter your full name"
                  className="bg-white text-slate-900"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-800">Digital Signature</Label>
                <SignaturePad onChange={setSignatureDataUrl} />
              </div>

              <Button
                onClick={handleConfirmSign}
                disabled={submitting || !signerName.trim() || !signatureDataUrl}
                className="w-full bg-gradient-luxe text-white"
              >
                <FileSignature className="w-4 h-4 mr-2" />
                {submitting ? 'Saving Signature...' : 'I Agree & Sign Document'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
