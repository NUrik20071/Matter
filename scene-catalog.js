// Original procedural studies. None of these objects represents a client's product.
export const MATERIAL_LIBRARY = Object.freeze({
  polymer: { id: 0, name: 'Матовый полимер', color: [0.14, 0.22, 0.91], roughness: .7, description: 'Мягкий рассеянный свет подчёркивает крупную форму.' },
  metal: { id: 1, name: 'Металл', color: [.62, .69, .78], roughness: .24, description: 'Студийные блики и отражения делают толщину видимой.' },
  glass: { id: 2, name: 'Стекло', color: [.32, .63, .82], roughness: .12, description: 'Прозрачность и краевые блики. Преломление стилизовано, без трассировки лучей.' },
  fabric: { id: 3, name: 'Ткань', color: [.77, .56, .34], roughness: .95, description: 'Процедурное переплетение нитей и рассеянное освещение.' },
  wood: { id: 4, name: 'Дерево', color: [.62, .32, .12], roughness: .65, description: 'Направленные волокна формируются без загружаемых текстур.' },
  glow: { id: 5, name: 'Свечение', color: [1, .39, .1], roughness: .4, description: 'Светящаяся поверхность; это визуальная модель, без расчёта освещения комнаты.' }
});


export const SCENE_CATALOG = Object.freeze({
  field: {
    id: 'field', section: '#field', title: 'Поверхность / 01', subtitle: 'Как плоский лист становится пространством.',
    description: 'Изгибающийся лист с видимой кромкой. Поверни его, чтобы увидеть, как одна поверхность формирует глубину без замкнутого объёма.',
    source: 'Оригинальная процедурная иллюстрация MATTER. Не модель реального изделия.',
    material: 'polymer', materials: ['polymer', 'fabric', 'metal', 'wood', 'glass', 'glow'],
    camera: { yaw: -.43, pitch: .2, distance: 5.1 },
    presets: [{ id: 'three', name: 'Объём', yaw: -.43, pitch: .2, distance: 5.1 }, { id: 'front', name: 'Фронт', yaw: 0, pitch: 0, distance: 5.1 }, { id: 'edge', name: 'Кромка', yaw: 1.14, pitch: .12, distance: 4.7 }],
    hotspots: [{ id: 'surface', title: 'Изгиб поверхности', point: [.5, .25, .4], text: 'Глубина возникает из непрерывного изгиба. Это построенная геометрия: её силуэт меняется при вращении.' }, { id: 'edge', title: 'Видимая толщина', point: [1.16, -.7, -.16], text: 'У листа есть лицевая сторона, оборот и соединяющая их кромка. Сетка помогает рассмотреть структуру поверхности.' }],
  },
  type: {
    id: 'type', section: '#type', title: 'Буква / 02', subtitle: 'Типографика обретает вес.',
    description: 'Объёмная буква A с открытым просветом, боковыми гранями и фасками. Буква остаётся узнаваемой с разных сторон.',
    source: 'Оригинальная процедурная иллюстрация MATTER. Авторская геометрия, не коммерческий шрифт.',
    material: 'metal', materials: ['metal', 'polymer', 'glass', 'fabric', 'wood', 'glow'],
    camera: { yaw: -.42, pitch: .12, distance: 5 },
    presets: [{ id: 'three', name: 'Объём', yaw: -.42, pitch: .12, distance: 5 }, { id: 'front', name: 'Фронт', yaw: 0, pitch: 0, distance: 5 }, { id: 'edge', name: 'Профиль', yaw: 1.12, pitch: .05, distance: 4.7 }],
    hotspots: [{ id: 'counter', title: 'Открытый просвет', point: [0, .4, .3], text: 'Внутри буквы действительно нет геометрии. Сквозной просвет сохраняется при вращении, потому что буква построена из объёмных штрихов.' }, { id: 'bevel', title: 'Грани и фаски', point: [.7, -.65, .28], text: 'Боковые стенки задают толщину, а узкие фаски ловят свет по краю. Материал меняет восприятие одной и той же формы.' }],
  },
  signal: {
    id: 'signal', section: '#signal', title: 'Резонатор / 03', subtitle: 'Ритм превращается в свет.',
    description: 'Световой объект с основанием, центральным рассеивателем и повторяющимися рёбрами. Ритм конструкции связывает предмет с графическим исследованием сигнала.',
    source: 'Оригинальная концептуальная иллюстрация MATTER. Не готовая лампа и не инженерная спецификация.',
    material: 'wood', materials: ['wood', 'metal', 'polymer', 'glass', 'fabric', 'glow'],
    camera: { yaw: -.32, pitch: .12, distance: 5.1 },
    presets: [{ id: 'three', name: 'Объём', yaw: -.32, pitch: .12, distance: 5.1 }, { id: 'front', name: 'Фронт', yaw: 0, pitch: .03, distance: 5.1 }, { id: 'top', name: 'Сверху', yaw: .35, pitch: .72, distance: 5.2 }],
    hotspots: [{ id: 'ribs', title: 'Ритм рёбер', point: [.64, .48, .4], text: 'Восемнадцать рёбер повторяют один профиль. Между ними остаются реальные промежутки: световой центр виден сквозь конструкцию.' }, { id: 'light', title: 'Световой центр', point: [0, .3, .35], text: 'Внутренний рассеиватель использует отдельный светящийся материал. Смена внешнего материала сохраняет назначение объекта.' }],
  }
});
export function getScene(id) { return SCENE_CATALOG[id] || SCENE_CATALOG.field; }
