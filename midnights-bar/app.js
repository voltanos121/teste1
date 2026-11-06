import { supabase } from './supabase-client.js';

const grid = document.getElementById('public-drink-grid');
const form = document.getElementById('budget-form');
const money = value => Number(value) > 0
  ? Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  : 'Consulte o valor';
const safe = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
);

async function loadDrinks() {
  if (!grid) return;
  grid.innerHTML = '<p>Carregando nossa carta de drinks...</p>';
  const { data, error } = await supabase
    .from('drinks')
    .select('id,name,category,description,price,image_url')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar drinks:', error);
    grid.innerHTML = '<p>Não foi possível carregar o cardápio agora. Tente novamente em instantes.</p>';
    return;
  }
  if (!data?.length) {
    grid.innerHTML = '<p>Nosso cardápio está sendo atualizado. Em breve, novidades!</p>';
    return;
  }
  grid.innerHTML = data.map((d, i) => `
    <article class="drink-card">
      <div class="drink-photo">
        <img src="${safe(d.image_url || 'logo-midnights-bar.png')}" alt="${safe(d.name)}" loading="lazy">
        <span>${String(i + 1).padStart(2, '0')}</span>
      </div>
      <div class="drink-info">
        <small>${safe(d.category || 'Especialidade da casa')}</small>
        <h3>${safe(d.name)}</h3>
        <p>${safe(d.description || '')}</p>
        <strong class="drink-price">${money(d.price)}</strong>
      </div>
    </article>`).join('');
}

async function submitQuote(event) {
  event.preventDefault();
  const button = form.querySelector('[type="submit"]');
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = 'Enviando solicitação...';

  const values = Object.fromEntries(new FormData(form).entries());
  const quote = {
    name: values.name.trim(),
    phone: values.phone.trim(),
    event: values.event,
    event_date: values.date || null,
    guests: values.guests ? Number(values.guests) : null,
    message: values.message?.trim() || null,
    status: 'Novo'
  };

  const { error } = await supabase.from('quotes').insert(quote);
  button.disabled = false;
  button.innerHTML = original;

  if (error) {
    console.error('Erro ao salvar orçamento:', error);
    alert('Não foi possível registrar seu pedido. Tente novamente ou fale conosco pelo WhatsApp.');
    return;
  }

  const message = [
    "Olá! Gostaria de solicitar um orçamento com a Midnight's Bar.",
    `Nome: ${quote.name}`,
    `Telefone: ${quote.phone}`,
    `Evento: ${quote.event}`,
    `Data: ${quote.event_date || 'A definir'}`,
    `Convidados: ${quote.guests || 'A definir'}`,
    `Detalhes: ${quote.message || 'Não informado'}`
  ].join('\n');

  // Troque pelo WhatsApp comercial com DDI + DDD + número, somente dígitos.
  const whatsapp = '5522999999999';
  window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  form.reset();
  alert('Solicitação registrada! Vamos continuar pelo WhatsApp.');
}

document.addEventListener('DOMContentLoaded', () => {
  loadDrinks();
  if (form) form.addEventListener('submit', submitQuote);
});
