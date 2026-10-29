/**
 * Lektionerna – på plats, utan nätverk.
 *
 * Varje lektion visar en bit *riktig* kod ur den här appen, ordagrant kopierad, och kopplar den
 * till barnets egen värld. `lessons.test.ts` läser källfilerna och kontrollerar att citaten finns
 * kvar, så att en lektion aldrig kan beskriva kod som har ändrats.
 */
import { worldKey } from './progress';
import { biomeById, goalById, heroById, obstacleById, treasureById } from './lexicon';
import { reachableTiles } from './validate';
import type { PlayableWorld } from './types';

export interface LessonExample {
  label: string;
  value: string;
}

export interface LessonQuiz {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  /** Varför lektionen finns, i en mening. */
  idea: string;
  /** Var koden bor och vilket namn den har. */
  source: { file: string; symbol: string };
  /** Koden, kopierad ordagrant ur källfilen. */
  code: string;
  /** Vad koden gör, i två till tre steg. */
  points: string[];
  /** Barnets egen värld, som exempel bredvid koden. */
  example: (world: PlayableWorld) => LessonExample[];
  quiz: LessonQuiz;
}

export const LESSONS: readonly Lesson[] = [
  {
    id: 'ord-blir-en-varld',
    title: 'Ord blir en värld',
    idea: 'Appen läser dina ord och skriver om dem till en beskrivning med namn och siffror.',
    source: { file: 'src/lib/learn/describe.ts', symbol: 'describeWorld' },
    code: [
      '  const spec: WorldSpec = {',
      '    name: explicitName ?? `${biome.title} med ${hero.label}`,',
      '    seed: options.seed ?? seedFromText(text || biome.id),',
      '    biome: biome.id,',
      '    hero: hero.id,',
      '    treasure: treasure.id,',
      '    obstacle: obstacle.id,',
      '    goal: goal.id,',
      '    target: target?.value ?? DEFAULTS.target,',
      '    cols: size?.cols ?? 15,',
      '    rows: size?.rows ?? 11,',
      '    mood: mood?.mood ?? DEFAULTS.mood,',
      '  };',
    ].join('\n'),
    points: [
      'Varje ord slås upp i en ordlista och blir en sak i världen: en plats, en hjälte, en skatt.',
      '`??` betyder "annars": hittar koden inget ord tar den standardvärdet efter strecken.',
      '`seed` räknas fram ur texten, så att samma mening alltid ger samma karta.',
    ],
    example: (world) => [
      { label: 'Plats', value: biomeById(world.spec.biome).label },
      { label: 'Hjälte', value: heroById(world.spec.hero).label },
      { label: 'Skatt', value: `${world.spec.target} ${treasureById(world.spec.treasure).plural}` },
      { label: 'Frö', value: String(world.spec.seed) },
    ],
    quiz: {
      question: 'Du skriver "en skog med en katt". Vad blir katten?',
      options: ['Hjälten som du styr', 'En skatt att plocka upp', 'En vägg som stoppar'],
      answer: 0,
      explanation: 'Ordet "katt" finns i hjältelistan, och därför blir katten hjälten i din värld.',
    },
  },
  {
    id: 'kartan-maste-ga-att-spela',
    title: 'Kartan måste gå att spela',
    idea: 'Innan du får spela kontrolleras kartan. Går det inte att nå målet får du veta det.',
    source: { file: 'src/lib/learn/validate.ts', symbol: 'validateWorld' },
    code: [
      '  const reachable = reachableTiles(world);',
      "  if (inside(goal) && tileAt(goal) === 'floor' && !reachable.has(goal.y * cols + goal.x)) {",
      '    issues.push(',
      '      issue(',
      "        'goal-unreachable',",
      "        'error',",
      "        'Det finns ingen väg från hjälten fram till målet.',",
      "        'Prova en annan mening, eller be om en mindre värld. Jag kan också bygga en ny karta.',",
      "        'goal',",
      '      ),',
      '    );',
      '  }',
    ].join('\n'),
    points: [
      '`reachableTiles` samlar alla rutor som går att gå till från starten.',
      'Om målet inte finns bland dem är kartan inte spelbar – då blir det ett fel, inte ett spel.',
      'Felet skrivs som en mening till dig, med ett förslag på vad du kan göra i stället.',
    ],
    example: (world) => {
      const reachable = reachableTiles(world);
      const floors = world.terrain.filter((tile) => tile === 'floor').length;
      return [
        { label: 'Kartan', value: `${world.cols} × ${world.rows} rutor` },
        { label: 'Rutor att gå på', value: String(floors) },
        { label: 'Rutor som går att nå', value: String(reachable.size) },
        { label: 'Målet', value: `${goalById(world.spec.goal).label} på (${world.goal.x}, ${world.goal.y})` },
      ];
    },
    quiz: {
      question: 'Varför kontrollerar appen kartan innan du får spela?',
      options: [
        'Så att du aldrig fastnar i en värld som inte går att klara',
        'För att räkna hur många färger kartan har',
        'För att spara kartan på en server',
      ],
      answer: 0,
      explanation:
        'Kontrollen letar efter en väg från start till mål. Hittar den ingen väg byggs en ny karta i stället.',
    },
  },
  {
    id: 'sa-hittas-vagen',
    title: 'Så hittas vägen',
    idea: 'Koden letar sig fram ruta för ruta och kommer ihåg var den redan har varit.',
    source: { file: 'src/lib/learn/validate.ts', symbol: 'reachableTiles' },
    code: [
      '  while (queue.length > 0) {',
      '    const current = queue.shift() as number;',
      '    const x = current % cols;',
      '    const y = Math.floor(current / cols);',
      '    const neighbours = [',
      '      { x: x + 1, y },',
      '      { x: x - 1, y },',
      '      { x, y: y + 1 },',
      '      { x, y: y - 1 },',
      '    ];',
    ].join('\n'),
    points: [
      'Varje ruta sparas som ett enda tal. `%` och `Math.floor` gör om talet till x och y igen.',
      'Grannarna är de fyra rutor som ligger intill – upp, ner, vänster och höger.',
      'De nya rutorna läggs sist i kön, så koden letar sig vidare där den inte har varit.',
    ],
    example: (world) => [
      { label: 'Kön börjar med', value: `start (${world.start.x}, ${world.start.y})` },
      { label: 'Antal skatter att hitta', value: String(world.treasures.length) },
      { label: 'Hinder som stoppar', value: obstacleById(world.spec.obstacle).label },
    ],
    quiz: {
      question: 'Vad betyder det att nya rutor läggs sist i kön?',
      options: [
        'Att koden letar vidare från rutor den redan har hittat',
        'Att koden slutar leta när kön är tom i början',
        'Att koden hoppar över hinder automatiskt',
      ],
      answer: 0,
      explanation: 'Kön gör att letandet sprider sig utåt, som ringar på vattnet, tills inget nytt hittas.',
    },
  },
  {
    id: 'en-ruta-i-taget',
    title: 'En ruta i taget',
    idea: 'Hjälten flyttar sig bara om rutan framför är golv. Hinder stoppar men dödar inte.',
    source: { file: 'src/lib/learn/game.ts', symbol: 'move' },
    code: [
      "  if (tile === 'wall' || tile === 'outside') {",
      "    return { state, events: ['blocked'] };",
      '  }',
      '',
      "  if (tile === 'hazard') {",
      '    return {',
      '      state: { ...state, stumbles: state.stumbles + 1 },',
      "      events: ['blocked'],",
      '    };',
      '  }',
    ].join('\n'),
    points: [
      'Koden tittar på rutan framför innan den flyttar något.',
      '`{ ...state }` gör en kopia med ett nytt värde, så att det gamla tillståndet finns kvar.',
      'Ett hinder ger en snubbling i stället för game over – du kan alltid fortsätta.',
    ],
    example: (world) => [
      { label: 'Hjälten', value: heroById(world.spec.hero).label },
      { label: 'Startar på', value: `(${world.start.x}, ${world.start.y})` },
      { label: 'Målet', value: goalById(world.spec.goal).label },
      { label: 'Skatter kvar att hämta', value: String(world.treasures.length) },
    ],
    quiz: {
      question: 'Du går rakt in i ett hinder. Vad händer?',
      options: [
        'Hjälten stannar och en snubbling räknas',
        'Hjälten förlorar ett liv',
        'Hela världen börjar om från början',
      ],
      answer: 0,
      explanation: 'Hinder är inte golv, så hjälten stannar. Snubblingen syns i resultatet efter rundan.',
    },
  },
  {
    id: 'sa-ritas-varlden',
    title: 'Så ritas världen',
    idea: 'Kartan är ett rutnät. Varje ruta ritas för sig, och därför kan varje värld se olika ut.',
    source: { file: 'src/lib/learn/render.ts', symbol: 'drawWorld' },
    code: [
      '  for (let row = 0; row < world.rows; row += 1) {',
      '    for (let column = 0; column < world.cols; column += 1) {',
      '      const index = row * world.cols + column;',
      '      const tile: Terrain = world.terrain[index];',
      '      const x = column * TILE;',
      '      const y = row * TILE;',
      '      const edge = row === 0 || column === 0 || row === world.rows - 1 || column === world.cols - 1;',
      '',
      "      if (tile === 'wall') {",
      '        drawWall(ctx, x, y, palette, edge);',
      '        continue;',
      '      }',
    ].join('\n'),
    points: [
      'Rutans plats i listan räknas ut som `rad * bredd + kolumn`.',
      'Pixelplatsen blir `kolumn * TILE`, där `TILE` är rutans storlek i pixlar.',
      'Färgerna kommer från platsens palett, så skogen och rymden får olika känsla.',
    ],
    example: (world) => [
      { label: 'Plats', value: biomeById(world.spec.biome).label },
      { label: 'Rutor att rita', value: String(world.cols * world.rows) },
      { label: 'Rutans storlek', value: '40 × 40 pixlar' },
    ],
    quiz: {
      question: 'Varför ritas kartan ruta för ruta?',
      options: [
        'För att varje ruta kan ha sin egen sorts mark och sitt eget innehåll',
        'För att det ska ta längre tid att ladda sidan',
        'För att bilden ska bli suddig',
      ],
      answer: 0,
      explanation: 'Golv, väggar och hinder är olika sorters rutor, och då behöver varje ruta ritas själv.',
    },
  },
  {
    id: 'rekordet-stannar-har',
    title: 'Rekordet stannar här',
    idea: 'Ditt rekord sparas i webbläsaren. Det finns ingen server som får veta något.',
    source: { file: 'src/lib/learn/progress.ts', symbol: 'writeProgress' },
    code: [
      'export function writeProgress(',
      '  storage: ProgressStorage | null | undefined,',
      '  progress: LearnProgress,',
      '): boolean {',
      '  if (!storage) return false;',
      '  try {',
      '    storage.setItem(STORAGE_KEY, JSON.stringify(progress));',
      '    return true;',
      '  } catch {',
      '    return false;',
      '  }',
      '}',
    ].join('\n'),
    points: [
      '`JSON.stringify` gör om rekordet till text som webbläsaren kan spara.',
      '`try` och `catch` fångar det som kan gå fel, till exempel i privat läge.',
      'Om sparandet inte går att göra fortsätter spelet ändå – det är bara rekordet som inte sparas.',
    ],
    example: (world) => [
      { label: 'Nyckel för din värld', value: worldKey(world.spec) },
      { label: 'Var det sparas', value: 'localStorage i din webbläsare' },
      { label: 'Skickas till', value: 'ingen – det finns ingen server' },
    ],
    quiz: {
      question: 'Var finns ditt rekord efter att du stängt fliken?',
      options: [
        'Bara i din egen webbläsare',
        'På Freevobes server',
        'I en delad topplista som alla kan se',
      ],
      answer: 0,
      explanation:
        'Rekordet ligger i localStorage på din dator. Sidan har ingen server och skickar inget vidare.',
    },
  },
] as const;

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}

export function lessonCount(): number {
  return LESSONS.length;
}
