import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Check } from 'lucide-react';
import type { Settings } from '../types';
import * as api from '../api';
import { btnPrimary, cardCls, inputCls, labelCls } from '../lib/ui';
import Collapse from '../components/Collapse';

export default function Configuracoes() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [hostSplitPercent, setHostSplitPercent] = useState('30');
  const [ownerName, setOwnerName] = useState('');
  const [icalUrl, setIcalUrl] = useState('');

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setHostSplitPercent(String(s.hostSplitPercent));
        setOwnerName(s.ownerName);
        setIcalUrl(s.icalUrl ?? '');
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const splitNumber = Number(hostSplitPercent);
  const ownerPercent = Number.isFinite(splitNumber) ? 100 - splitNumber : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const patch: Partial<Settings> = {
        hostSplitPercent: splitNumber,
        ownerName: ownerName.trim(),
        icalUrl: icalUrl.trim() || null,
      };
      const saved = await api.updateSettings(patch);
      setHostSplitPercent(String(saved.hostSplitPercent));
      setOwnerName(saved.ownerName);
      setIcalUrl(saved.icalUrl ?? '');
      setMessage('Configurações salvas.');
    } catch (e2) {
      setError((e2 as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-muted">Carregando…</p>;

  return (
    <section>
      <h2 className="text-lg font-semibold">Configurações</h2>

      <Collapse
        show={!!message}
        className="my-2 rounded-xl bg-success/12 px-3.5 py-2.5 text-sm text-success"
      >
        {message}
      </Collapse>
      <Collapse
        show={!!error}
        className="my-2 rounded-xl bg-danger/12 px-3.5 py-2.5 text-sm text-danger"
      >
        {error}
      </Collapse>

      <form className={`mt-3 ${cardCls}`} onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 font-semibold">Divisão do fechamento</h3>
            <div className="flex flex-wrap items-end gap-3">
              <label className={`${labelCls} w-40`}>
                Seu percentual (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  className={inputCls}
                  value={hostSplitPercent}
                  onChange={(e) => setHostSplitPercent(e.target.value)}
                  required
                />
              </label>
              {ownerPercent !== null && ownerPercent >= 0 && ownerPercent <= 100 && (
                <p className="pb-2.5 text-sm text-muted">
                  O dono fica com <span className="font-medium text-content">{ownerPercent}%</span> do
                  saldo.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className={`${labelCls} max-w-sm`}>
              Nome do dono do imóvel
              <input
                className={inputCls}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="ex.: Pai"
                required
              />
            </label>
          </div>

          <div>
            <label className={labelCls}>
              URL do iCal do Airbnb
              <input
                className={inputCls}
                value={icalUrl}
                onChange={(e) => setIcalUrl(e.target.value)}
                placeholder="https://www.airbnb.com/calendar/ical/....ics"
              />
            </label>
            <p className="mt-1 text-xs text-muted">
              No Airbnb: Calendário → Disponibilidade → Conectar outro site / Exportar calendário.
              Usada pelo botão “Sincronizar com Airbnb” na tela de Reservas.
            </p>
          </div>
        </div>

        <button type="submit" className={`mt-5 ${btnPrimary}`} disabled={saving}>
          <Check className="h-4 w-4" />
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </section>
  );
}
