// index.js
const extensionName = 'interactive-infoblock';
const extensionFolderPath = extensions/${extensionName};

let relations = {};
let charName = '';
let userName = '';
const MAX_REL = 300;

function loadRelations() {
  // Автоматически берёт имя текущего бота
  charName = (this_chid !== undefined && characters[this_chid])
    ? characters[this_chid].name
    : 'Персонаж';
}

// Загрузка
function loadRelations() {
  charName = (this_chid !== undefined && characters[this_chid]) ? characters[this_chid].name : 'Персонаж';
  const key = infoblock_rel_${this_chid || chat_id};
  const saved = localStorage.getItem(key);
  relations = saved ? JSON.parse(saved) : { trust: 0, attraction: 0, love: 0 };
}

// Сохранение
function saveRelations() {
  const key = infoblock_rel_${this_chid || chat_id};
  localStorage.setItem(key, JSON.stringify(relations));
}

// Контекст
function getContext(n = 5) {
  const recent = chat.slice(-n);
  const messages = recent.map(m => ${m.name}: ${m.mes}).join('\n');
  const userMessages = recent.filter(m => m.is_user).map(m => m.mes);
  const nicknames = userMessages.flatMap(m => m.match(/\b(котик|малыш|зайчик|душа|милый|солнышко|лапочка)\b/gi) || []).slice(0, 3);
  return { messages, nicknames: [...new Set(nicknames)] };
}

// Генерация инфоблока
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
1. mood_text — 3-6 слов: текущее настроение курсивом
2. relation_status — 2-4 слова: статус отношений
3. trust_emoji — **1 эмодзи** для Доверия (по смыслу изменения)
4. attraction_emoji — **1 эмодзи** для Привязанности
5. love_emoji — **1 эмодзи** для Любви
6. changes — изменения: trust, attraction, love (±1 до ±25, редко больше)
7. dynamic_name — твое изменяемое имя
8. thoughts — 1-3 коротких предложения в кавычках курсивом

ВАЖНО:
- Эмодзи выбирай **по смыслу изменения**:
  - Положительное: тепло, близость, радость
  - Отрицательное: холод, разочарование, дистанция
  - Нейтральное: спокойствие, стабильность
- Используй **любой подходящий эмодзи**, не ограничивайся, а в некоторых случаях необычный, но которому ты придашь смысл

Пример JSON:
{
  "mood_text": "задумчив, испытывает благодарность и легкое смущение",
  "relation_status": "зарождающийся романтический интерес",
  "trust_emoji": "handshake",
  "attraction_emoji": "flushed face",
  "love_emoji": "smiling face with hearts",
  "changes": {"trust": 10, "attraction": 6, "love": 4},
  "dynamic_name": "Особенный",
  "thoughts": "Она видит то, чего не замечал я тысячелетиями. Это странное, теплое чувство... Кажется, она начинает мне нравиться."
}
.trim();

  try {
    const res = await fetch('/api/chats/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        temperature: 0.75,
        max_length: 500,
        quiet: true
      })
    });
    const data = await res.json();
    const jsonText = data.reply  data.response  '';
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return '';

    const info = JSON.parse(jsonMatch[0]);

    // Применяем изменения (без общего лимита)
    for (let key in info.changes) {
      if (relations[key] !== undefined) {
        relations[key] += info.changes[key];
      }
    }
    saveRelations();

    // === ЭМОДЗИ ВЫБИРАЕТ БОТ САМ ===
    const relEmojis = {};
    for (let key in info.changes) {
      const change = info.changes[key];
      const pool = EMOJI_POOLS[key];
      const abs = Math.abs(change);
      const intensity = abs > 15 ? 0.9 : abs > 8 ? 0.6 : 0.3;
      const index = Math.floor(Math.random() * pool.length * (0.5 + intensity));
      relEmojis[key] = pool[index % pool.length];
    }

    // HTML
    const relHtml = ['trust', 'attraction', 'love'].map(key => {
      const v = relations[key];
      const c = info.changes[key] || 0;
      const e = relEmojis[key];
      const changeStr = c !== 0 ?  (${c > 0 ? '+' : ''}${c}) : '';
      return ${e} <strong>${key === 'trust' ? 'Доверие' : key === 'attraction' ? 'Привязанность' : 'Любовь'}</strong>: ${v}/${MAX_REL}${changeStr};
    }).join(' | ');
return 
<div class="infoblock">
  <div class="header">
    <strong>${charName}</strong> | <strong>Настроение: ${info.mood_text}</strong>
  </div>
  <hr>
  <div class="relations">
    <strong>${charName}</strong> → <strong>${userName}</strong>: ${relHtml}
  </div>
  <div class="status"><em>(статус: ${info.relation_status})</em></div>
  <hr>
  <div class="thoughts">
    <em><strong>${info.dynamic_name}:</strong> "${info.thoughts}"</em>
  </div>
</div>;
  } catch (e) {
    console.error(e);
    return '';
  }
}

// Хук
eventSource.on('messageGenerated', async (msg) => {
  if (msg.is_user || !extensionSettings.infoblock?.enabled) return;
  if (msg.name !== charName) return;

  const html = await generateInfoblock();
  if (html) {
    setTimeout(() => {
      const $mes = $(#chat .mes[mesid="${msg.id}"]);
      if ($mes.length) $mes.after(html);
    }, 150);
  }
});

// Инициализация
$(document).ready(() => {
  extensionSettings.infoblock = extensionSettings.infoblock || { enabled: false };

  $('head').append(<link rel="stylesheet" href="${extensionFolderPath}/style.css">);
  
  // Ползунок (on/off switch)
  $('#extensions_settings').append(
    <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <b>Character Infoblock Pro</b>
      </div>
      <div class="inline-drawer-content">
        <div class="flex-container">
          <div class="flex-item">
            <label class="switch">
              <input type="checkbox" id="infoblock_enabled" ${extensionSettings.infoblock.enabled ? 'checked' : ''}>
              <span class="slider round"></span>
            </label>
            <label for="infoblock_enabled" style="margin-left: 8px;">Включить инфоблок</label>
          </div>
        </div>
      </div>
    </div>
  );

  $('#infoblock_enabled').on('change', function() {
    extensionSettings.infoblock.enabled = this.checked;
    saveSettingsDebounced();
  });

  eventSource.on('chatChanged', loadRelations);
  eventSource.on('characterChanged', loadRelations);
  loadRelations();
});