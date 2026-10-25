export const TOKEN_SLOTS = [
  'comment',
  'keyword',
  'string',
  'number',
  'function',
  'type',
  'property',
  'operator',
  'punctuation',
] as const;

export type TokenSlot = (typeof TOKEN_SLOTS)[number];
export type Slot = 'background' | 'text' | TokenSlot;

/** Every color is `#rrggbb`, so it round-trips through `<input type="color">`. */
export type Palette = Record<Slot, string>;

export const SLOTS: Slot[] = ['background', 'text', ...TOKEN_SLOTS];

export const SLOT_LABELS: Record<Slot, string> = {
  background: 'Background',
  text: 'Text',
  comment: 'Comment',
  keyword: 'Keyword',
  string: 'String',
  number: 'Number',
  function: 'Function',
  type: 'Type',
  property: 'Property',
  operator: 'Operator',
  punctuation: 'Punctuation',
};

export interface Theme {
  id: string;
  name: string;
  dark: boolean;
  colors: Palette;
}

export const CUSTOM_THEME = 'custom';

export const THEMES: Theme[] = [
  {
    id: 'one-dark',
    name: 'One Dark',
    dark: true,
    colors: {
      background: '#282c34',
      text: '#abb2bf',
      comment: '#7f848e',
      keyword: '#c678dd',
      string: '#98c379',
      number: '#d19a66',
      function: '#61afef',
      type: '#e5c07b',
      property: '#e06c75',
      operator: '#56b6c2',
      punctuation: '#abb2bf',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    dark: true,
    colors: {
      background: '#282a36',
      text: '#f8f8f2',
      comment: '#6272a4',
      keyword: '#ff79c6',
      string: '#f1fa8c',
      number: '#bd93f9',
      function: '#50fa7b',
      type: '#8be9fd',
      property: '#8be9fd',
      operator: '#ff79c6',
      punctuation: '#f8f8f2',
    },
  },
  {
    id: 'monokai',
    name: 'Monokai',
    dark: true,
    colors: {
      background: '#272822',
      text: '#f8f8f2',
      comment: '#88846f',
      keyword: '#f92672',
      string: '#e6db74',
      number: '#ae81ff',
      function: '#a6e22e',
      type: '#66d9ef',
      property: '#fd971f',
      operator: '#f92672',
      punctuation: '#f8f8f2',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    dark: true,
    colors: {
      background: '#2e3440',
      text: '#d8dee9',
      comment: '#616e88',
      keyword: '#81a1c1',
      string: '#a3be8c',
      number: '#b48ead',
      function: '#88c0d0',
      type: '#8fbcbb',
      property: '#8fbcbb',
      operator: '#81a1c1',
      punctuation: '#eceff4',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    dark: true,
    colors: {
      background: '#1a1b26',
      text: '#c0caf5',
      comment: '#565f89',
      keyword: '#bb9af7',
      string: '#9ece6a',
      number: '#ff9e64',
      function: '#7aa2f7',
      type: '#2ac3de',
      property: '#73daca',
      operator: '#89ddff',
      punctuation: '#a9b1d6',
    },
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    dark: true,
    colors: {
      background: '#1e1e2e',
      text: '#cdd6f4',
      comment: '#9399b2',
      keyword: '#cba6f7',
      string: '#a6e3a1',
      number: '#fab387',
      function: '#89b4fa',
      type: '#f9e2af',
      property: '#b4befe',
      operator: '#89dceb',
      punctuation: '#9399b2',
    },
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    dark: true,
    colors: {
      background: '#282828',
      text: '#ebdbb2',
      comment: '#928374',
      keyword: '#fb4934',
      string: '#b8bb26',
      number: '#d3869b',
      function: '#fabd2f',
      type: '#8ec07c',
      property: '#83a598',
      operator: '#fe8019',
      punctuation: '#ebdbb2',
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    dark: true,
    colors: {
      background: '#0d1117',
      text: '#e6edf3',
      comment: '#8b949e',
      keyword: '#ff7b72',
      string: '#a5d6ff',
      number: '#79c0ff',
      function: '#d2a8ff',
      type: '#ffa657',
      property: '#79c0ff',
      operator: '#ff7b72',
      punctuation: '#e6edf3',
    },
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    dark: false,
    colors: {
      background: '#ffffff',
      text: '#1f2328',
      comment: '#6e7781',
      keyword: '#cf222e',
      string: '#0a3069',
      number: '#0550ae',
      function: '#8250df',
      type: '#953800',
      property: '#0550ae',
      operator: '#cf222e',
      punctuation: '#1f2328',
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    dark: false,
    colors: {
      background: '#fdf6e3',
      text: '#657b83',
      comment: '#93a1a1',
      keyword: '#859900',
      string: '#2aa198',
      number: '#d33682',
      function: '#268bd2',
      type: '#b58900',
      property: '#cb4b16',
      operator: '#859900',
      punctuation: '#657b83',
    },
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    dark: false,
    colors: {
      background: '#eff1f5',
      text: '#4c4f69',
      comment: '#7c7f93',
      keyword: '#8839ef',
      string: '#40a02b',
      number: '#fe640b',
      function: '#1e66f5',
      type: '#df8e1d',
      property: '#7287fd',
      operator: '#04a5e5',
      punctuation: '#7c7f93',
    },
  },
];

export function paletteFor(themeId: string, customColors: Palette): Palette {
  if (themeId === CUSTOM_THEME) return customColors;
  return (THEMES.find((theme) => theme.id === themeId) ?? THEMES[0]).colors;
}

/** Blends two `#rrggbb` colors; `amount` 0 gives `from`, 1 gives `to`. */
export function mixColors(from: string, to: string, amount: number): string {
  const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const a = channels(from);
  const b = channels(to);
  const mixed = a.map((value, i) => Math.round(value + (b[i] - value) * amount));
  return `rgb(${mixed.join(', ')})`;
}
