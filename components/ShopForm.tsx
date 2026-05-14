'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  getShopStatus,
  updateShopSettings,
  disconnectStripe,
  listProducts,
  upsertProduct,
  deleteProduct,
  listOrders,
  markOrderFulfilled,
  type ShopStripeStatus,
  type ShopSettings,
  type ProductRow,
  type OrderRow,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { confirm } from '@/store/confirmStore';
import { Button } from './ui/Button';
import { FormRow } from './ui/FormSection';
import { Spinner } from './ui/Spinner';
import { StatusPill, StatusBanner } from './ui/Status';

type Channel = { id: string; name: string };
type Role = { id: string; name: string; color: number };

function formatPrice(cents: number, currency: string): string {
  const value = (cents / 100).toFixed(2);
  const cur = currency.toUpperCase();
  if (cur === 'EUR') return `${value.replace('.', ',')} €`;
  if (cur === 'USD') return `$${value}`;
  return `${value} ${cur}`;
}

export function ShopForm({
  guildId,
  channels,
  roles,
}: {
  guildId: string;
  channels: Channel[];
  roles: Role[];
}) {
  const [tab, setTab] = useState<'setup' | 'products' | 'orders'>('setup');
  const [stripe, setStripe] = useState<ShopStripeStatus | null>(null);
  const [settings, setSettings] = useState<ShopSettings | null>(null);

  useEffect(() => {
    getShopStatus(guildId).then((r) => {
      if (r.ok) {
        setStripe(r.stripe ?? null);
        setSettings(r.settings ?? null);
      }
    });
  }, [guildId]);

  return (
    <div className="space-y-5">
      <StatusBanner kind="warning">
        <strong>⚠️ Wichtig:</strong> Beim Bestellsystem agierst <em>du als Server-Owner</em> als
        Händler. Du brauchst <strong>eigene AGB, Datenschutz, Impressum, MwSt-Pflicht-Klärung</strong> und
        ein verifiziertes Stripe-Konto. kanbanly ist nur die technische Plattform und
        haftet nicht für deine Verkäufe. Bei Fragen: Steuerberater.
      </StatusBanner>

      <div className="flex items-center gap-1 border-b border-line">
        <TabBtn active={tab === 'setup'} onClick={() => setTab('setup')}>
          Stripe-Setup
        </TabBtn>
        <TabBtn active={tab === 'products'} onClick={() => setTab('products')}>
          Produkte
        </TabBtn>
        <TabBtn active={tab === 'orders'} onClick={() => setTab('orders')}>
          Bestellungen
        </TabBtn>
      </div>

      {tab === 'setup' && stripe && settings && (
        <SetupTab
          guildId={guildId}
          channels={channels}
          roles={roles}
          stripe={stripe}
          settings={settings}
          onSettings={setSettings}
          onDisconnect={() =>
            setStripe({
              connected: false,
              chargesEnabled: false,
              detailsSubmitted: false,
              accountId: null,
            })
          }
        />
      )}
      {tab === 'products' && <ProductsTab guildId={guildId} />}
      {tab === 'orders' && <OrdersTab guildId={guildId} />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-colors -mb-px ${
        active
          ? 'border-accent text-fg'
          : 'border-transparent text-muted hover:text-fg-soft'
      }`}
    >
      {children}
    </button>
  );
}

function SetupTab({
  guildId,
  channels,
  roles,
  stripe,
  settings,
  onSettings,
  onDisconnect,
}: {
  guildId: string;
  channels: Channel[];
  roles: Role[];
  stripe: ShopStripeStatus;
  settings: ShopSettings;
  onSettings: (s: ShopSettings) => void;
  onDisconnect: () => void;
}) {
  const [categoryId, setCategoryId] = useState(settings.orderCategoryId ?? '');
  const [staffRoleId, setStaffRoleId] = useState(settings.staffRoleId ?? '');
  const [currency, setCurrency] = useState(settings.currency);
  const [pending, startTransition] = useTransition();

  const saveSettings = () => {
    startTransition(async () => {
      const r = await updateShopSettings(guildId, {
        orderCategoryId: categoryId || null,
        staffRoleId: staffRoleId || null,
        currency,
      });
      if (r.ok) {
        onSettings({ ...settings, orderCategoryId: categoryId || null, staffRoleId: staffRoleId || null, currency });
        toast.success('Einstellungen gespeichert');
      } else toast.error('Fehler', r.error);
    });
  };

  const disconnect = async () => {
    const ok = await confirm({
      title: 'Stripe-Konto trennen?',
      description: 'Bestehende Bestellungen bleiben erhalten. Neue Bestellungen sind dann nicht mehr möglich.',
      confirmLabel: 'Trennen',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await disconnectStripe(guildId);
      if (r.ok) {
        onDisconnect();
        toast.success('Stripe getrennt');
      } else toast.error('Fehler', r.error);
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-[14px] font-semibold text-fg">Stripe-Verbindung</div>
            <div className="text-[12px] text-muted mt-0.5">
              Server-Owner verbindet sein Stripe-Konto via Stripe Connect.
            </div>
          </div>
          {stripe.connected ? (
            stripe.chargesEnabled ? (
              <StatusPill kind="success" dot>
                Aktiv
              </StatusPill>
            ) : (
              <StatusPill kind="warning" dot>
                Onboarding offen
              </StatusPill>
            )
          ) : (
            <StatusPill kind="neutral">Nicht verbunden</StatusPill>
          )}
        </div>

        {!stripe.connected ? (
          <a
            href={`/api/stripe/connect?guild_id=${guildId}`}
            className="inline-flex items-center gap-2 rounded-md bg-[#635BFF] hover:bg-[#5046E5] text-white text-sm font-semibold px-5 py-2.5 transition-colors"
          >
            Mit Stripe verbinden
          </a>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-[11px] rounded bg-elev px-2 py-1 text-fg-soft font-mono">
              {stripe.accountId}
            </code>
            {!stripe.chargesEnabled && (
              <a
                href={`/api/stripe/connect?guild_id=${guildId}`}
                className="text-[12px] rounded-md border border-line-strong hover:border-fg-soft bg-surface px-3 py-1.5 text-fg-soft hover:text-fg transition-colors"
              >
                Onboarding fortsetzen
              </a>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={disconnect} disabled={pending}>
              Trennen
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
        <div className="text-[14px] font-semibold text-fg">Order-Channel-Einstellungen</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormRow label="Order-Channel-Kategorie">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            >
              <option value="">— Kategorie wählen —</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Staff-Rolle (sieht alle Bestellungen)">
            <select
              value={staffRoleId}
              onChange={(e) => setStaffRoleId(e.target.value)}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            >
              <option value="">— Rolle wählen —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </FormRow>
        </div>
        <FormRow label="Währung" hint="ISO-Code, 3 Buchstaben (eur, usd, gbp, …)">
          <input
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toLowerCase().slice(0, 3))}
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          />
        </FormRow>
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="primary" onClick={saveSettings} loading={pending}>
            Speichern
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProductsTab({ guildId }: { guildId: string }) {
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listProducts(guildId).then((r) => {
      if (r.ok && r.products) setProducts(r.products);
    });
  }, [guildId]);

  if (products === null) {
    return (
      <div className="flex items-center gap-2 text-[12.5px] text-subtle py-6">
        <Spinner size="xs" /> Lade Produkte…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {products.length > 0 && (
        <ul className="space-y-2">
          {products.map((p) => {
            const open = editingId === p.id;
            return (
              <li key={p.id} className="rounded-lg border border-line bg-surface overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <div className="min-w-0 flex items-center gap-3">
                    {p.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="h-10 w-10 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-elev border border-line shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium text-fg truncate">
                        {p.name}
                        {!p.active && (
                          <span className="ml-2 text-[10.5px] text-subtle">(inaktiv)</span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-accent-soft font-mono">
                        {formatPrice(p.priceCents, p.currency)}
                        {p.stock != null && (
                          <span className="text-muted ml-2">· {p.stock} auf Lager</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(open ? null : p.id)}
                    >
                      {open ? 'Schließen' : 'Bearbeiten'}
                    </Button>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Produkt löschen?',
                          confirmLabel: 'Löschen',
                          danger: true,
                        });
                        if (!ok) return;
                        const r = await deleteProduct(guildId, p.id);
                        if (r.ok) {
                          setProducts((prev) => (prev ?? []).filter((x) => x.id !== p.id));
                          toast.success('Gelöscht');
                        } else toast.error('Fehler', r.error);
                      }}
                      className="text-[11px] text-muted hover:text-danger px-2"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="p-3 border-t border-line">
                    <ProductEditor
                      guildId={guildId}
                      initial={p}
                      onSaved={(u) => {
                        setProducts((prev) =>
                          (prev ?? []).map((x) => (x.id === u.id ? u : x)),
                        );
                        setEditingId(null);
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {creating ? (
        <div className="rounded-lg border border-line bg-elev/30 p-4">
          <ProductEditor
            guildId={guildId}
            initial={null}
            onSaved={(u) => {
              setProducts((prev) => [...(prev ?? []), u]);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full rounded-lg border border-dashed border-line-strong hover:border-accent hover:bg-elev/40 py-3 text-sm text-muted hover:text-fg transition-colors"
        >
          + Neues Produkt
        </button>
      )}
    </div>
  );
}

function ProductEditor({
  guildId,
  initial,
  onSaved,
  onCancel,
}: {
  guildId: string;
  initial: ProductRow | null;
  onSaved: (p: ProductRow) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priceEuros, setPriceEuros] = useState(
    initial ? ((initial.priceCents) / 100).toFixed(2).replace('.', ',') : '',
  );
  const [currency, setCurrency] = useState(initial?.currency ?? 'eur');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [stock, setStock] = useState(initial?.stock != null ? String(initial.stock) : '');
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!name.trim()) {
      toast.error('Name nötig');
      return;
    }
    const normalized = priceEuros.replace(',', '.').trim();
    const priceFloat = Number(normalized);
    if (!Number.isFinite(priceFloat) || priceFloat < 0) {
      toast.error('Ungültiger Preis');
      return;
    }
    const priceCents = Math.round(priceFloat * 100);
    const stockNum = stock.trim() === '' ? null : Math.max(0, Math.floor(Number(stock)));
    const payload = {
      name,
      description,
      priceCents,
      currency,
      imageUrl: imageUrl || null,
      active,
      stock: stockNum,
    };
    startTransition(async () => {
      const r = await upsertProduct(guildId, initial?.id ?? null, payload);
      if (r.ok && r.id) {
        onSaved({ id: r.id, position: initial?.position ?? 0, ...payload });
        toast.success(initial ? 'Aktualisiert' : 'Angelegt');
      } else toast.error('Fehler', r.error);
    });
  };

  return (
    <div className="space-y-3">
      <FormRow label="Name" required>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 200))}
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg"
        />
      </FormRow>
      <FormRow label="Beschreibung">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 4000))}
          rows={3}
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono resize-y"
        />
      </FormRow>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormRow label="Preis" required>
          <input
            type="text"
            value={priceEuros}
            onChange={(e) => setPriceEuros(e.target.value.slice(0, 12))}
            placeholder="9,99"
            inputMode="decimal"
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono"
          />
        </FormRow>
        <FormRow label="Währung">
          <input
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toLowerCase().slice(0, 3))}
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono"
          />
        </FormRow>
        <FormRow label="Lager (leer = ∞)">
          <input
            type="number"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg"
          />
        </FormRow>
      </div>
      <FormRow label="Bild-URL">
        <input
          type="text"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value.trim())}
          placeholder="https://…"
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle"
        />
      </FormRow>
      <label className="flex items-center gap-2 text-sm text-fg-soft">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Aktiv (im Shop kaufbar)
      </label>
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Abbrechen
          </Button>
        )}
        <Button type="button" size="sm" variant="primary" onClick={submit} loading={pending}>
          {initial ? 'Speichern' : 'Anlegen'}
        </Button>
      </div>
    </div>
  );
}

function OrdersTab({ guildId }: { guildId: string }) {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    listOrders(guildId).then((r) => {
      if (r.ok && r.orders) setOrders(r.orders);
    });
  }, [guildId]);

  if (orders === null) {
    return (
      <div className="flex items-center gap-2 text-[12.5px] text-subtle py-6">
        <Spinner size="xs" /> Lade Bestellungen…
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong p-10 text-center text-sm text-subtle">
        Noch keine Bestellungen.
      </div>
    );
  }

  const fulfill = (id: string) => {
    startTransition(async () => {
      const r = await markOrderFulfilled(guildId, id);
      if (r.ok) {
        setOrders((prev) =>
          (prev ?? []).map((o) =>
            o.id === id ? { ...o, status: 'fulfilled', fulfilledAt: new Date().toISOString() } : o,
          ),
        );
        toast.success('Als erledigt markiert');
      } else toast.error('Fehler', r.error);
    });
  };

  return (
    <ul className="space-y-2">
      {orders.map((o) => (
        <li
          key={o.id}
          className="rounded-lg border border-line bg-surface px-3 py-2.5 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium text-fg truncate">
              {o.productName}
            </div>
            <div className="text-[11px] text-muted mt-0.5">
              <span className="font-mono">{formatPrice(o.amountCents, o.currency)}</span>
              {' · '}
              <span>{new Date(o.createdAt).toLocaleString('de-DE')}</span>
              {' · '}
              User: <code className="font-mono">{o.userId.slice(-6)}</code>
              {o.ticketChannelId && (
                <>
                  {' · '}
                  <a
                    href={`https://discord.com/channels/@me/${o.ticketChannelId}`}
                    className="text-accent-soft hover:underline"
                  >
                    Channel
                  </a>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <OrderStatusPill status={o.status} />
            {o.status === 'paid' && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => fulfill(o.id)}
                disabled={pending}
              >
                Erledigt
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function OrderStatusPill({ status }: { status: OrderRow['status'] }) {
  const map: Record<
    OrderRow['status'],
    { label: string; kind: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }
  > = {
    pending: { label: 'Offen', kind: 'warning' },
    paid: { label: 'Bezahlt', kind: 'info' },
    fulfilled: { label: 'Erledigt', kind: 'success' },
    cancelled: { label: 'Storniert', kind: 'neutral' },
    refunded: { label: 'Erstattet', kind: 'neutral' },
    failed: { label: 'Fehler', kind: 'danger' },
  };
  const m = map[status];
  return <StatusPill kind={m.kind}>{m.label}</StatusPill>;
}
