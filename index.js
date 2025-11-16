// index.js — ИСПРАВЛЕНО
const extensionName = 'character-infoblock-pro'; // ← ВАЖНО!
let relations = {};
let charName = '';
let userName = 'Ты';
const MAX_REL = 300;

function loadRelations() {
  charName = (this_chid !== undefined && characters[this_chid]) ? characters[this_chid].name : 'Персонаж';
  const key = infoblock_rel_${this_chid || chat_id};
  const saved = localStorage.getItem(key);
  relations = saved ? JSON.parse(saved) : { trust: 0, attraction: 0, love: 0 };
}

function saveRelations() {
  const key = infoblock_rel_${this_chid || chat_id};
  localStorage.setItem(key, JSON.stringify(relations));
}

function getContext(n = 5) {
  const recent = chat.slice(-n);
  const messages = recent.map(m => ${m.name}: ${m.mes}).join('\n');
  const userMessages = recent.filter(m => m.is_user).map(m => m.mes);
  const nicknames = userMessages.flatMap(m => m.match(/\b(котик|малыш|зайчик|душа|милый|солнышко|лапочка)\b/gi) || []).slice(0, 3);
  return { messages, nicknames: [...new Set(nicknames)] };
}

async function generateInfoblock() {
  if (!extensionSettings.infoblock?.enabled) return '';
  loadRelations();
  const { messages, nicknames } = getContext();

  const prompt = 
Ты — внутренний голос персонажа "${charName}". Ответь **ТОЛЬКО JSON**.

Контекст:
${messages}

Прозвища от юзера: ${nicknames.join(', ') || 'нет'}

Текущие отношения:
- Доверие: ${relations.trust}/${MAX_REL}
- Привязанность: ${relations.attraction}/${MAX_REL}
- Любовь: ${relations.love}/${MAX_REL}

Сгенерируй:
1. mood_text — 3-6 слов
2. relation_status — 2-4 слова
3. trust_emoji — 1 эмодзи
4. attraction_emoji — 1 эмодзи
5. love_emoji — 1 эмодзи
6. changes — {trust: ±, attraction: ±, love: ±}
7. dynamic_name — имя
8. thoughts — 1-3 предложения

ВЕРНИ ТОЛЬКО JSON.
.trim();

  try {
    const res = await fetch('/api/chats/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, temperature: 0.75, max_length: 500, quiet: true })
    });
    const data = await res.json();
    const jsonText = data.reply || '';
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return '';

    const info = JSON.parse(jsonMatch[0]);

    for (let key in info.changes) {
      if (relations[key] !== undefined) relations[key] += info.changes[key];
    }
    saveRelations();

    const changeStr = (val) => val !== 0 ?  (${val > 0 ? '+' : ''}${val}) : '';

    return 
<div class="infoblock">
  <div class="header"><strong>${charName}</strong> | <strong>Настроение: ${info.mood_text}</strong></div>
  <hr>
  <div class="relations">
    <strong>${charName}</strong> → <strong>${userName}</strong>: 
    ${info.trust_emoji} <strong>Доверие</strong>: ${relations.trust}/${MAX_REL}${changeStr(info.changes.trust)} | 
    ${info.attraction_emoji} <strong>Привязанность</strong>: ${relations.attraction}/${MAX_REL}${changeStr(info.changes.attraction)} | 
    ${info.love_emoji} <strong>Любовь</strong>: ${relations.love}/${MAX_REL}${changeStr(info.changes.love)}
  </div>
  <div class="status"><em>(статус: ${info.relation_status})</em></div>
  <hr>
  <div class="thoughts"><em><strong>${info.dynamic_name}:</strong> "${info.thoughts}"</em></div>
</div>;
  } catch (e) {
    console.error(e);
    return '';
  }
}

eventSource.on('messageGenerated', async (msg) => {
  if (msg.is_user  !extensionSettings.infoblock?.enabled  msg.name !== charName) return;
  const html = await generateInfoblock();
  if (html) {
    setTimeout(() => $(#chat .mes[mesid="${msg.id}"]).after(html), 150);
  }
});

$(document).ready(() => {
  extensionSettings.infoblock = extensionSettings.infoblock || { enabled: false };
  $('head').append(<link rel="stylesheet" href="/extensions/${extensionName}/style.css">);

  $('#extensions_settings').append(`
  <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header"><b>Character Infoblock Pro</b></div>
      <div class="inline-drawer-content">
        <label class="switch">
          <input type="checkbox" id="infoblock_enabled" ${extensionSettings.infoblock.enabled ? 'checked' : ''}>
          <span class="slider round"></span>
        </label>
        <label for="infoblock_enabled" style="margin-left: 8px;">Включить инфоблок</label>
      </div>
    </div>
  `);

  $('#infoblock_enabled').on('change', function() {
    extensionSettings.infoblock.enabled = this.checked;
    saveSettingsDebounced();
  });

  eventSource.on('chatChanged', loadRelations);
  eventSource.on('characterChanged', loadRelations);
  loadRelations();
});
