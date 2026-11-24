// Original procedural studies. None of these objects represents a client's product.
export const MATERIAL_LIBRARY = Object.freeze({
  polymer: { id: 0, name: 'Матовый полимер', color: [0.14, 0.22, 0.91], roughness: .7, description: 'Мягкий рассеянный свет подчёркивает крупную форму.' },
  metal: { id: 1, name: 'Металл', color: [.62, .69, .78], roughness: .24, description: 'Студийные блики и отражения делают толщину видимой.' },
  glass: { id: 2, name: 'Стекло', color: [.32, .63, .82], roughness: .12, description: 'Прозрачность и краевые блики. Преломление стилизовано, без трассировки лучей.' },
  fabric: { id: 3, name: 'Ткань', color: [.77, .56, .34], roughness: .95, description: 'Процедурное переплетение нитей и рассеянное освещение.' },
  wood: { id: 4, name: 'Дерево', color: [.62, .32, .12], roughness: .65, description: 'Направленные волокна формируются без загружаемых текстур.' },
  glow: { id: 5, name: 'Свечение', color: [1, .39, .1], roughness: .4, description: 'Светящаяся поверхность; это визуальная модель, без расчёта освещения комнаты.' }
});

const shell = (body, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 520" role="img" aria-label="${label}"><defs><linearGradient id="ov-blue" x2="1" y2="1"><stop stop-color="#7888ff"/><stop offset=".5" stop-color="#283bec"/><stop offset="1" stop-color="#111a61"/></linearGradient><linearGradient id="ov-light" x2="0" y2="1"><stop stop-color="#fff4c5"/><stop offset="1" stop-color="#f4853c"/></linearGradient></defs><rect width="640" height="520" fill="#e9e6de"/><ellipse cx="325" cy="434" rx="165" ry="24" fill="#1c203c" opacity=".09"/>${body}</svg>`;

export const SCENE_CATALOG = Object.freeze({
  field: {
    id: 'field', section: '#field', title: 'Поверхность / 01', subtitle: 'Как плоский лист становится пространством.',
    description: 'Изгибающийся лист с видимой кромкой. Поверни его, чтобы увидеть, как одна поверхность формирует глубину без замкнутого объёма.',
    source: 'Оригинальная процедурная иллюстрация MATTER. Не модель реального изделия.',
    material: 'polymer', materials: ['polymer', 'fabric', 'metal', 'wood', 'glass', 'glow'],
    camera: { yaw: -.43, pitch: .2, distance: 5.1 },
    presets: [{ id: 'three', name: 'Объём', yaw: -.43, pitch: .2, distance: 5.1 }, { id: 'front', name: 'Фронт', yaw: 0, pitch: 0, distance: 5.1 }, { id: 'edge', name: 'Кромка', yaw: 1.14, pitch: .12, distance: 4.7 }],
    hotspots: [{ id: 'surface', title: 'Изгиб поверхности', point: [.5, .25, .4], text: 'Глубина возникает из непрерывного изгиба. Это построенная геометрия: её силуэт меняется при вращении.' }, { id: 'edge', title: 'Видимая толщина', point: [1.16, -.7, -.16], text: 'У листа есть лицевая сторона, оборот и соединяющая их кромка. Сетка помогает рассмотреть структуру поверхности.' }],
    fallbackSvg: shell('<path d="M178 130Q314 65 437 137L477 357Q345 432 211 356Z" fill="#151c7b"/><path d="M170 119Q303 53 428 126L468 346Q334 420 202 345Z" fill="url(#ov-blue)"/><path d="M202 345Q334 420 468 346" fill="none" stroke="#7889fa" stroke-width="6"/><g stroke="#bfc8ff" stroke-width="1" fill="none" opacity=".45"><path d="M179 168Q311 110 439 175M187 217Q320 164 448 224M196 269Q327 219 457 274M232 96L266 379M296 85L330 388M363 97L399 378"/></g>', 'Иллюстрация изогнутого листа с толщиной')
  },
  type: {
    id: 'type', section: '#type', title: 'Буква / 02', subtitle: 'Типографика обретает вес.',
    description: 'Объёмная буква A с открытым просветом, боковыми гранями и фасками. Буква остаётся узнаваемой с разных сторон.',
    source: 'Оригинальная процедурная иллюстрация MATTER. Авторская геометрия, не коммерческий шрифт.',
    material: 'metal', materials: ['metal', 'polymer', 'glass', 'fabric', 'wood', 'glow'],
    camera: { yaw: -.42, pitch: .12, distance: 5 },
    presets: [{ id: 'three', name: 'Объём', yaw: -.42, pitch: .12, distance: 5 }, { id: 'front', name: 'Фронт', yaw: 0, pitch: 0, distance: 5 }, { id: 'edge', name: 'Профиль', yaw: 1.12, pitch: .05, distance: 4.7 }],
    hotspots: [{ id: 'counter', title: 'Открытый просвет', point: [0, .4, .3], text: 'Внутри буквы действительно нет геометрии. Сквозной просвет сохраняется при вращении, потому что буква построена из объёмных штрихов.' }, { id: 'bevel', title: 'Грани и фаски', point: [.7, -.65, .28], text: 'Боковые стенки задают толщину, а узкие фаски ловят свет по краю. Материал меняет восприятие одной и той же формы.' }],
    fallbackSvg: shell('<path d="M245 382L351 118L386 136L496 400L435 420L408 342L293 342L270 403Z" fill="#19256e"/><path d="M194 382L301 118H351L456 382H395L371 316H272L249 382ZM292 262H352L323 179Z" fill="url(#ov-blue)" fill-rule="evenodd"/><path d="M351 118L386 136L496 400L456 382Z" fill="#7384ec"/><path d="M292 262L314 279H358L352 262Z" fill="#121947"/>', 'Иллюстрация объёмной буквы A с открытым просветом')
  },
  signal: {
    id: 'signal', section: '#signal', title: 'Резонатор / 03', subtitle: 'Ритм превращается в свет.',
    description: 'Световой объект с основанием, центральным рассеивателем и повторяющимися рёбрами. Ритм конструкции связывает предмет с графическим исследованием сигнала.',
    source: 'Оригинальная концептуальная иллюстрация MATTER. Не готовая лампа и не инженерная спецификация.',
    material: 'wood', materials: ['wood', 'metal', 'polymer', 'glass', 'fabric', 'glow'],
    camera: { yaw: -.32, pitch: .12, distance: 5.1 },
    presets: [{ id: 'three', name: 'Объём', yaw: -.32, pitch: .12, distance: 5.1 }, { id: 'front', name: 'Фронт', yaw: 0, pitch: .03, distance: 5.1 }, { id: 'top', name: 'Сверху', yaw: .35, pitch: .72, distance: 5.2 }],
    hotspots: [{ id: 'ribs', title: 'Ритм рёбер', point: [.64, .48, .4], text: 'Восемнадцать рёбер повторяют один профиль. Между ними остаются реальные промежутки: световой центр виден сквозь конструкцию.' }, { id: 'light', title: 'Световой центр', point: [0, .3, .35], text: 'Внутренний рассеиватель использует отдельный светящийся материал. Смена внешнего материала сохраняет назначение объекта.' }],
    fallbackSvg: shell('<ellipse cx="320" cy="418" rx="96" ry="23" fill="#242849"/><path d="M225 403v15q95 40 190 0v-15" fill="#101831"/><ellipse cx="320" cy="403" rx="95" ry="24" fill="#596176"/><path d="M309 300h22v104h-22" fill="#5a5f76"/><path d="M285 138Q320 117 355 138L368 308Q320 341 272 308Z" fill="url(#ov-light)"/><g fill="none" stroke="#8d5631" stroke-width="11"><path d="M267 120Q220 200 209 307M286 115Q255 207 250 324M310 114L299 334M334 114L342 334M356 118Q393 208 393 322M374 126Q426 212 432 305"/></g><ellipse cx="320" cy="124" rx="55" ry="17" fill="#b07b4d"/><ellipse cx="320" cy="313" rx="113" ry="25" fill="none" stroke="#704323" stroke-width="8"/>', 'Иллюстрация светового резонатора с основанием и рёбрами')
  }
});
export function getScene(id) { return SCENE_CATALOG[id] || SCENE_CATALOG.field; }
