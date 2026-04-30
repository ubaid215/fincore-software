'use client';
import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter }             from 'next/navigation';
import { toast }                            from 'sonner';
import { User, Building2, Settings2, X, Plus } from 'lucide-react';
import { contactsApi }                      from '../../../../../lib/contacts-api';
import { PageHeader }                       from '../../../../../components/shared/PageHeader';
import { Btn }                              from '../../../../../components/shared/index';
import type { ContactType, CustomFieldDef } from '../../../../../types/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const CONTACT_TYPES: { value: ContactType; label: string }[] = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'VENDOR',   label: 'Vendor' },
  { value: 'BOTH',     label: 'Customer & Vendor' },
  { value: 'LEAD',     label: 'Lead' },
  { value: 'PARTNER',  label: 'Partner' },
  { value: 'INTERNAL', label: 'Internal' },
];

const FIELD_TYPES = [
  { value: 'TEXT',         label: 'Text' },
  { value: 'NUMBER',       label: 'Number' },
  { value: 'DATE',         label: 'Date' },
  { value: 'BOOLEAN',      label: 'Yes / No' },
  { value: 'SELECT',       label: 'Dropdown (Single)' },
  { value: 'MULTI_SELECT', label: 'Dropdown (Multi)' },
  { value: 'EMAIL',        label: 'Email' },
  { value: 'PHONE',        label: 'Phone' },
  { value: 'URL',          label: 'URL' },
];

function toSlug(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// ── Shared form primitives ────────────────────────────────────────────────────

function FormInput({ label, name, type = 'text', value, onChange, required, hint, placeholder }: {
  label: string; name: string; type?: string; value: string;
  onChange: (v: string) => void; required?: boolean; hint?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
        {label}{required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
      </label>
      <input
        type={type} name={name} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 px-3 text-sm rounded-lg border focus:outline-none focus:ring-1 focus:ring-[--color-accent]"
        style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
      />
      {hint && <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

// ── Custom Fields slide-over panel ────────────────────────────────────────────

function CustomFieldsPanel({ orgId, open, onClose, onSaved }: {
  orgId: string; open: boolean; onClose: () => void;
  onSaved: (defs: CustomFieldDef[]) => void;
}) {
  const [defs,    setDefs]    = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding,  setAdding]  = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [newField, setNewField] = useState({
    label: '', fieldKey: '', fieldType: 'TEXT', isRequired: false,
  });

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    contactsApi.getFieldDefs(orgId)
      .then((d) => { setDefs(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [open, orgId]);

  const handleLabelChange = (label: string) =>
    setNewField((f) => ({ ...f, label, fieldKey: f.fieldKey || toSlug(label) }));

  const handleSaveField = async () => {
    if (!newField.label.trim() || !newField.fieldKey.trim()) {
      toast.error('Label and key are required'); return;
    }
    setSaving(true);
    try {
      await contactsApi.createFieldDef(orgId, {
        label:      newField.label.trim(),
        fieldKey:   newField.fieldKey.trim(),
        fieldType:  newField.fieldType,
        isRequired: newField.isRequired,
      });
      const updated = await contactsApi.getFieldDefs(orgId);
      setDefs(updated);
      onSaved(updated);
      setAdding(false);
      setNewField({ label: '', fieldKey: '', fieldType: 'TEXT', isRequired: false });
      toast.success('Custom field added');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to add field');
    } finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative flex flex-col w-80 h-full shadow-2xl"
        style={{ background: 'var(--color-white)', borderLeft: '1px solid var(--color-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Custom Fields</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Extend contacts with extra data</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[--color-surface] transition-colors"
          >
            <X className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
          </button>
        </div>

        {/* Field list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <p className="text-xs py-6 text-center" style={{ color: 'var(--color-text-tertiary)' }}>Loading…</p>
          )}
          {!loading && defs.length === 0 && !adding && (
            <p className="text-xs py-8 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              No custom fields yet.<br />Add one below.
            </p>
          )}
          {defs.map((d) => (
            <div
              key={d.id}
              className="p-3 rounded-lg"
              style={{ background: 'var(--color-surface)' }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{d.label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                <span className="font-mono">{d.fieldKey}</span>
                {' · '}{d.fieldType}
                {d.isRequired ? ' · required' : ''}
              </p>
            </div>
          ))}

          {/* Add form */}
          {adding && (
            <div className="space-y-3 p-3 rounded-lg border mt-2" style={{ borderColor: 'var(--color-border)' }}>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Label *</label>
                <input
                  autoFocus
                  value={newField.label}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  placeholder="e.g. Customer Priority"
                  className="w-full h-8 px-2.5 text-sm rounded-lg border"
                  style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Key *</label>
                <input
                  value={newField.fieldKey}
                  onChange={(e) => setNewField((f) => ({ ...f, fieldKey: e.target.value }))}
                  placeholder="customer_priority"
                  className="w-full h-8 px-2.5 text-sm rounded-lg border font-mono"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Type</label>
                <select
                  value={newField.fieldType}
                  onChange={(e) => setNewField((f) => ({ ...f, fieldType: e.target.value }))}
                  className="w-full h-8 px-2.5 text-sm rounded-lg border"
                  style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newField.isRequired}
                  onChange={(e) => setNewField((f) => ({ ...f, isRequired: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Required field</span>
              </label>
              <div className="flex gap-2">
                <Btn size="sm" loading={saving} onClick={handleSaveField}>Save</Btn>
                <Btn size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Btn>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!adding && (
          <div className="p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <button
              onClick={() => setAdding(true)}
              className="w-full h-9 flex items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors hover:bg-[--color-surface]"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <Plus className="w-4 h-4" /> Add Field
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewContactPage() {
  const params = useParams<{ orgId: string }>();
  const router = useRouter();

  const [entity,       setEntity]       = useState<'person' | 'company'>('person');
  const [saving,       setSaving]       = useState(false);
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [fieldDefs,    setFieldDefs]    = useState<CustomFieldDef[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Record<string, string>>({
    contactType: 'CUSTOMER',
    country:     'PK',
    currency:    'PKR',
  });

  // Load custom field definitions on mount
  useEffect(() => {
    contactsApi.getFieldDefs(params.orgId).then(setFieldDefs).catch(() => {});
  }, [params.orgId]);

  // Field setter — auto-computes displayName in person mode
  const set = useCallback((key: string) => (val: string) => {
    setForm((f) => {
      const next = { ...f, [key]: val };
      if (entity === 'person' && (key === 'firstName' || key === 'lastName')) {
        const first = key === 'firstName' ? val : (f.firstName ?? '');
        const last  = key === 'lastName'  ? val : (f.lastName  ?? '');
        if (!f._manualName) next.displayName = [first, last].filter(Boolean).join(' ');
      }
      if (entity === 'company' && key === 'companyName') {
        next.displayName = val;
      }
      return next;
    });
  }, [entity]);

  const handleEntitySwitch = (e: 'person' | 'company') => {
    setEntity(e);
    setForm((f) => {
      const next = { ...f, _manualName: '' };
      if (e === 'company') next.displayName = f.companyName ?? '';
      else next.displayName = [f.firstName, f.lastName].filter(Boolean).join(' ');
      return next;
    });
  };

  const handleSubmit = useCallback(async (ev: React.FormEvent) => {
    ev.preventDefault();

    if (entity === 'person' && !form.displayName?.trim()) {
      toast.error('Enter a first name or display name'); return;
    }
    if (entity === 'company' && !form.companyName?.trim()) {
      toast.error('Company name is required'); return;
    }

    setSaving(true);
    try {
      const { _manualName, ...rest } = form;
      const payload: Record<string, any> = { ...rest };
      if (payload.paymentTerms) payload.paymentTerms = Number(payload.paymentTerms);
      if (payload.creditLimit)  payload.creditLimit  = Number(payload.creditLimit);
      if (payload.tags)         payload.tags = payload.tags.split(',').map((t: string) => t.trim()).filter(Boolean);

      const contact = await contactsApi.create(params.orgId, payload);

      // Save any filled custom field values
      const fields = fieldDefs
        .filter((d) => customValues[d.id] !== undefined && customValues[d.id] !== '')
        .map((d) => ({ fieldDefId: d.id, value: customValues[d.id] }));
      if (fields.length > 0) {
        await contactsApi.setFieldValues(params.orgId, contact.id, fields);
      }

      toast.success('Contact created');
      router.push(`/${params.orgId}/contacts/${contact.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create contact');
      setSaving(false);
    }
  }, [form, entity, customValues, fieldDefs, params.orgId, router]);

  return (
    <>
      <CustomFieldsPanel
        orgId={params.orgId}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSaved={setFieldDefs}
      />

      <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
        <PageHeader
          title="New Contact"
          breadcrumbs={[
            { label: 'Contacts', href: `/${params.orgId}/contacts` },
            { label: 'New' },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                title="Custom Fields"
                onClick={() => setPanelOpen(true)}
                className="h-9 w-9 flex items-center justify-center rounded-lg border transition-colors hover:bg-[--color-surface]"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}
              >
                <Settings2 className="w-4 h-4" />
              </button>
              <Btn type="button" variant="outline" onClick={() => router.back()}>Cancel</Btn>
              <Btn type="submit" loading={saving}>Save Contact</Btn>
            </div>
          }
        />

        {/* ── Person / Company toggle ───────────────────────────────── */}
        <div className="card space-y-3">
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Contact is a…</p>
          <div className="flex gap-2">
            {([
              { key: 'person',  label: 'Person',  Icon: User },
              { key: 'company', label: 'Company', Icon: Building2 },
            ] as const).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleEntitySwitch(key)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg border text-sm font-medium transition-all"
                style={{
                  background:  entity === key ? 'var(--color-accent)'   : 'var(--color-white)',
                  borderColor: entity === key ? 'var(--color-accent)'   : 'var(--color-border)',
                  color:       entity === key ? '#ffffff'               : 'var(--color-text-secondary)',
                }}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Person fields ─────────────────────────────────────────── */}
        {entity === 'person' && (
          <Section title="Person Details">
            <FormInput label="First Name" name="firstName" value={form.firstName ?? ''} onChange={set('firstName')} required />
            <FormInput label="Last Name"  name="lastName"  value={form.lastName  ?? ''} onChange={set('lastName')} />
            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs font-medium tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                Display Name <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                value={form.displayName ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value, _manualName: 'yes' }))}
                placeholder="Auto-computed from first + last name"
                className="w-full h-9 px-3 text-sm rounded-lg border focus:outline-none focus:ring-1 focus:ring-[--color-accent]"
                style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>
            <FormInput label="S/O Name (Father / Spouse)" name="soName"       value={form.soName      ?? ''} onChange={set('soName')} />
            <FormInput label="CNIC"                        name="cnic"         value={form.cnic        ?? ''} onChange={set('cnic')}  hint="e.g. 42101-1234567-1" />
            <FormInput label="Date of Birth"               name="dateOfBirth"  type="date" value={form.dateOfBirth  ?? ''} onChange={set('dateOfBirth')} />
            <FormInput label="CNIC Expiry"                 name="dateOfExpire" type="date" value={form.dateOfExpire ?? ''} onChange={set('dateOfExpire')} />
            <FormInput label="Job Title"    name="jobTitle"    value={form.jobTitle    ?? ''} onChange={set('jobTitle')} />
            <FormInput label="Company"      name="companyName" value={form.companyName ?? ''} onChange={set('companyName')} hint="Employer / organisation" />
          </Section>
        )}

        {/* ── Company fields ────────────────────────────────────────── */}
        {entity === 'company' && (
          <Section title="Company Details">
            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs font-medium tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                Company Name <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                value={form.companyName ?? ''}
                onChange={(e) => set('companyName')(e.target.value)}
                placeholder="Acme Corporation"
                className="w-full h-9 px-3 text-sm rounded-lg border focus:outline-none focus:ring-1 focus:ring-[--color-accent]"
                style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>
            <FormInput label="NTN / Tax ID"      name="taxId"     value={form.taxId    ?? ''} onChange={set('taxId')}    hint="e.g. 1234567-8" />
            <FormInput label="Website"            name="website"   type="url" value={form.website  ?? ''} onChange={set('website')} />
            <FormInput label="Primary Contact"    name="firstName" value={form.firstName ?? ''} onChange={set('firstName')} hint="Contact person first name" />
            <FormInput label="Contact Last Name"  name="lastName"  value={form.lastName  ?? ''} onChange={set('lastName')} />
          </Section>
        )}

        {/* ── Classification ────────────────────────────────────────── */}
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Classification</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Type</label>
              <select
                value={form.contactType ?? 'CUSTOMER'}
                onChange={(e) => set('contactType')(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border"
                style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                {CONTACT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <FormInput label="Tags (comma-separated)" name="tags" value={form.tags ?? ''} onChange={set('tags')} hint="e.g. VIP, B2B, Retail" />
          </div>
        </div>

        {/* ── Contact details ───────────────────────────────────────── */}
        <Section title="Contact Details">
          <FormInput label="Email"    name="email"    type="email" value={form.email    ?? ''} onChange={set('email')} />
          <FormInput label="Email 2"  name="email2"   type="email" value={form.email2   ?? ''} onChange={set('email2')} />
          <FormInput label="Phone"    name="phone"    type="tel"   value={form.phone    ?? ''} onChange={set('phone')} />
          <FormInput label="Phone 2"  name="phone2"   type="tel"   value={form.phone2   ?? ''} onChange={set('phone2')} />
          <FormInput label="WhatsApp" name="whatsapp" type="tel"   value={form.whatsapp ?? ''} onChange={set('whatsapp')} />
          {entity === 'person' && (
            <FormInput label="Website" name="website" type="url" value={form.website ?? ''} onChange={set('website')} />
          )}
        </Section>

        {/* ── Address ──────────────────────────────────────────────── */}
        <Section title="Address">
          <div className="sm:col-span-2">
            <FormInput label="Address Line 1" name="addressLine1" value={form.addressLine1 ?? ''} onChange={set('addressLine1')} />
          </div>
          <div className="sm:col-span-2">
            <FormInput label="Address Line 2" name="addressLine2" value={form.addressLine2 ?? ''} onChange={set('addressLine2')} />
          </div>
          <FormInput label="City"              name="city"       value={form.city       ?? ''} onChange={set('city')} />
          <FormInput label="State / Province"  name="state"      value={form.state      ?? ''} onChange={set('state')} />
          <FormInput label="Postal Code"       name="postalCode" value={form.postalCode ?? ''} onChange={set('postalCode')} />
          <FormInput label="Country (ISO)"     name="country"    value={form.country    ?? 'PK'} onChange={set('country')} hint="e.g. PK, US, GB" />
        </Section>

        {/* ── Finance & Banking ────────────────────────────────────── */}
        <Section title="Finance & Banking">
          <FormInput label="Currency (ISO)"        name="currency"     value={form.currency     ?? 'PKR'} onChange={set('currency')}     hint="e.g. PKR, USD" />
          <FormInput label="Payment Terms (days)"  name="paymentTerms" type="number" value={form.paymentTerms ?? ''} onChange={set('paymentTerms')} hint="0 = immediate" />
          <FormInput label="Credit Limit"          name="creditLimit"  type="number" value={form.creditLimit  ?? ''} onChange={set('creditLimit')} />
          <FormInput label="Bank Name"             name="bankName"     value={form.bankName     ?? ''} onChange={set('bankName')} />
          <div className="sm:col-span-2">
            <FormInput label="IBAN" name="bankIban" value={form.bankIban ?? ''} onChange={set('bankIban')} />
          </div>
        </Section>

        {/* ── Custom fields (if any defined) ───────────────────────── */}
        {fieldDefs.length > 0 && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Custom Fields</h3>
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="flex items-center gap-1 text-xs transition-colors hover:underline"
                style={{ color: 'var(--color-accent)' }}
              >
                <Settings2 className="w-3 h-3" /> Manage
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fieldDefs.map((def) => (
                <div key={def.id} className="space-y-1">
                  <label className="block text-xs font-medium tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                    {def.label}{def.isRequired && <span style={{ color: 'var(--color-danger)' }}> *</span>}
                  </label>
                  {def.fieldType === 'BOOLEAN' ? (
                    <label className="flex items-center gap-2 h-9 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customValues[def.id] === 'true'}
                        onChange={(e) =>
                          setCustomValues((cv) => ({ ...cv, [def.id]: e.target.checked ? 'true' : 'false' }))
                        }
                        className="rounded"
                      />
                      <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Yes</span>
                    </label>
                  ) : (
                    <input
                      type={
                        def.fieldType === 'NUMBER' ? 'number'
                          : def.fieldType === 'DATE'   ? 'date'
                          : def.fieldType === 'EMAIL'  ? 'email'
                          : def.fieldType === 'PHONE'  ? 'tel'
                          : def.fieldType === 'URL'    ? 'url'
                          : 'text'
                      }
                      value={customValues[def.id] ?? ''}
                      required={def.isRequired}
                      onChange={(e) => setCustomValues((cv) => ({ ...cv, [def.id]: e.target.value }))}
                      className="w-full h-9 px-3 text-sm rounded-lg border"
                      style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pb-8">
          <Btn type="button" variant="outline" onClick={() => router.back()}>Cancel</Btn>
          <Btn type="submit" loading={saving}>Save Contact</Btn>
        </div>
      </form>
    </>
  );
}
