import type { ExpenseCategory } from '../types';

export function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

// 'YYYY-MM' -> 'Agosto de 2026'
export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} de ${y}`;
}

// Mês atual no formato 'YYYY-MM' (fuso local).
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Rótulos amigáveis das categorias de despesa (o backend guarda em minúsculo).
export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  luz: 'Luz',
  condominio: 'Condomínio',
  internet: 'Internet',
  funcionaria: 'Funcionária',
  outro: 'Outro',
};

export const CATEGORY_ORDER: ExpenseCategory[] = [
  'luz',
  'condominio',
  'internet',
  'funcionaria',
  'outro',
];
