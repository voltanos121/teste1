import { supabase } from './supabase-client.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
);
const money = n => Number(n || 0).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
let currentImagePath = null;
let selectedFile = null;

async function isAdmin(user) {
  if (!user) return false;
  const { data, error } = await supabase
    .from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  return !error && !!data;
}

function showLogin(message = '') {
  $('login-screen').hidden = false;
  $('dashboard').hidden = true;
  $('logout-btn').hidden = true;
  $('login-error').textContent = message;
}

async function showDashboard(user) {
  const allowed = await isAdmin(user);
  if (!allowed) {
    await supabase.auth.signOut();
    showLogin('Este usuário não tem permissão administrativa.');
    return;
  }
  $('login-screen').hidden = true;
  $('dashboard').hidden = false;
  $('logout-btn').hidden = false;
  await refresh();
}

$('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  const { data, error } = await supabase.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value
  });
  button.disabled = false;
  if (error) return showLogin('Não foi possível entrar. Verifique seu e-mail e senha.');
  await showDashboard(data.user);
});

$('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  showLogin();
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) setTimeout(() => showDashboard(session.user), 0);
  else showLogin();
});

document.querySelectorAll('.admin-tab').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(x => x.classList.remove('active'));
    button.classList.add('active');
    $(button.dataset.tab).classList.add('active');
  });
});

async function refresh() {
  await Promise.all([renderDrinks(), renderQuotes()]);
}

async function renderDrinks() {
  const list = $('drink-admin-list');
  const { data, error } = await supabase.from('drinks').select('*').order('created_at', {ascending:false});
  if (error) { list.innerHTML = '<div class="admin-empty">Erro ao carregar drinks. Confira as políticas do banco.</div>'; return; }
  $('stat-drinks').textContent = data.length;
  list.innerHTML = data.length ? data.map(d => `
    <article class="admin-item">
      <img src="${esc(d.image_url || 'logo-midnights-bar.png')}" alt="">
      <div><h3>${esc(d.name)} ${d.active ? '' : '(oculto)'}</h3><p>${esc(d.category || '')} · ${money(d.price)}</p></div>
      <div class="admin-item-actions">
        <button data-edit="${d.id}">Editar</button>
        <button data-toggle="${d.id}">${d.active ? 'Ocultar' : 'Exibir'}</button>
        <button data-delete="${d.id}">Excluir</button>
      </div>
    </article>`).join('') : '<div class="admin-empty">Nenhum drink cadastrado.</div>';

  list.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editDrink(b.dataset.edit));
  list.querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => {
    const item = data.find(d => String(d.id) === b.dataset.toggle);
    const { error } = await supabase.from('drinks').update({active:!item.active}).eq('id', item.id);
    if (error) alert('Não foi possível alterar a visibilidade.');
    await refresh();
  });
  list.querySelectorAll('[data-delete]').forEach(b => b.onclick = async () => {
    if (!confirm('Excluir este drink?')) return;
    const item = data.find(d => String(d.id) === b.dataset.delete);
    if (item.image_path) await supabase.storage.from('drinks-images').remove([item.image_path]);
    const { error } = await supabase.from('drinks').delete().eq('id', item.id);
    if (error) alert('Não foi possível excluir o drink.');
    await refresh();
  });
}

async function editDrink(id) {
  const { data, error } = await supabase.from('drinks').select('*').eq('id', id).single();
  if (error) return alert('Não foi possível abrir esse drink.');
  $('drink-id').value = data.id;
  $('drink-name').value = data.name;
  $('drink-category').value = data.category || '';
  $('drink-price').value = data.price || 0;
  $('drink-description').value = data.description || '';
  $('drink-active').checked = !!data.active;
  currentImagePath = data.image_path || null;
  selectedFile = null;
  $('drink-form-title').textContent = 'Editar drink';
  window.scrollTo({top:0,behavior:'smooth'});
}

function resetForm() {
  $('drink-form').reset();
  $('drink-id').value = '';
  $('drink-active').checked = true;
  currentImagePath = null;
  selectedFile = null;
  $('drink-form-title').textContent = 'Cadastrar novo drink';
  $('drink-feedback').textContent = '';
}
$('cancel-edit').onclick = resetForm;
$('drink-image-file').addEventListener('change', e => { selectedFile = e.target.files[0] || null; });

$('drink-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  $('drink-feedback').textContent = 'Salvando...';
  let imagePath = currentImagePath;
  let imageUrl = null;

  if (selectedFile) {
    if (selectedFile.size > 4 * 1024 * 1024) {
      $('drink-feedback').textContent = 'A imagem deve ter até 4 MB.';
      button.disabled = false; return;
    }
    const ext = (selectedFile.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('drinks-images').upload(path, selectedFile, {
      cacheControl: '3600', upsert: false, contentType: selectedFile.type
    });
    if (uploadError) {
      $('drink-feedback').textContent = 'Falha no upload. Confira o bucket e as políticas do Storage.';
      button.disabled = false; return;
    }
    imagePath = path;
  }

  if (imagePath) {
    const { data } = supabase.storage.from('drinks-images').getPublicUrl(imagePath);
    imageUrl = data.publicUrl;
  }

  const payload = {
    name: $('drink-name').value.trim(),
    category: $('drink-category').value.trim() || null,
    price: Number($('drink-price').value) || 0,
    description: $('drink-description').value.trim() || null,
    active: $('drink-active').checked,
    image_path: imagePath,
    image_url: imageUrl
  };
  const id = $('drink-id').value;
  const query = id
    ? supabase.from('drinks').update(payload).eq('id', id)
    : supabase.from('drinks').insert(payload);
  const { error } = await query;
  button.disabled = false;
  if (error) {
    $('drink-feedback').textContent = `Erro ao salvar: ${error.message}`;
    return;
  }
  $('drink-feedback').textContent = 'Drink salvo com sucesso!';
  resetForm();
  await refresh();
});

async function renderQuotes() {
  const list = $('quote-list');
  const { data, error } = await supabase.from('quotes').select('*').order('created_at', {ascending:false});
  if (error) { list.innerHTML = '<div class="admin-empty">Erro ao carregar pedidos. Confira as políticas do banco.</div>'; return; }
  $('stat-quotes').textContent = data.length;
  $('stat-new').textContent = data.filter(q => q.status === 'Novo').length;
  list.innerHTML = data.length ? data.map(q => `
    <article class="quote-card">
      <div class="quote-top"><div><h3>${esc(q.name)} <span class="status">${esc(q.status)}</span></h3>
      <p>${esc(q.event || '')} · ${esc(q.event_date || 'Data a definir')} · ${esc(q.guests ?? 'Nº não informado')} convidados</p></div>
      <select data-status="${q.id}">
        ${['Novo','Em atendimento','Concluído','Cancelado'].map(s=>`<option ${q.status===s?'selected':''}>${s}</option>`).join('')}
      </select></div>
      <p><b>Telefone:</b> ${esc(q.phone)}<br><b>Detalhes:</b> ${esc(q.message || 'Não informado')}<br><b>Recebido:</b> ${new Date(q.created_at).toLocaleString('pt-BR')}</p>
      <div class="admin-actions"><a class="admin-btn gold" target="_blank" rel="noopener" href="https://wa.me/${esc(q.phone.replace(/\D/g,''))}">Conversar no WhatsApp ↗</a>
      <button class="admin-btn danger" data-remove="${q.id}">Excluir pedido</button></div>
    </article>`).join('') : '<div class="admin-empty">Nenhum orçamento recebido ainda.</div>';

  list.querySelectorAll('[data-status]').forEach(s => s.onchange = async () => {
    const { error } = await supabase.from('quotes').update({status:s.value}).eq('id', s.dataset.status);
    if (error) alert('Não foi possível atualizar o status.');
    await refresh();
  });
  list.querySelectorAll('[data-remove]').forEach(b => b.onclick = async () => {
    if (!confirm('Excluir este pedido?')) return;
    const { error } = await supabase.from('quotes').delete().eq('id', b.dataset.remove);
    if (error) alert('Não foi possível excluir o pedido.');
    await refresh();
  });
}

const { data: { session } } = await supabase.auth.getSession();
if (session?.user) await showDashboard(session.user);
else showLogin();
