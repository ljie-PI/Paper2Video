import path from 'path';

export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;
export const DEFAULT_STYLE = 'academic';

export const REVEAL_DIST = path.join(
  process.cwd(),
  'node_modules',
  'reveal.js',
  'dist'
);
export const SHARED_REVEAL_DIST = path.join(
  process.cwd(),
  'storage',
  'reveal',
  'dist'
);
export const TEMPLATE_PATH = path.join(
  process.cwd(),
  'lib',
  'templates',
  'reveal',
  'deck.html'
);
export const STYLES_DIR = path.join(
  process.cwd(),
  'lib',
  'templates',
  'reveal',
  'styles'
);

type SlotKind = 'text' | 'html' | 'image';
type LayoutSchema = {
  id: string;
  templateFile: string;
  slots: Array<{ name: string; required: boolean; kind: SlotKind }>;
};

export const LAYOUT_SCHEMAS: Record<string, LayoutSchema> = {
  'text-focus': {
    id: 'text-focus',
    templateFile: 'text-focus.html',
    slots: [
      { name: 'title', required: true, kind: 'text' },
      { name: 'body', required: true, kind: 'html' }
    ]
  },
  'image-right': {
    id: 'image-right',
    templateFile: 'image-right.html',
    slots: [
      { name: 'title', required: true, kind: 'text' },
      { name: 'body', required: true, kind: 'html' },
      { name: 'image', required: true, kind: 'image' }
    ]
  },
  'image-bottom': {
    id: 'image-bottom',
    templateFile: 'image-bottom.html',
    slots: [
      { name: 'title', required: true, kind: 'text' },
      { name: 'body', required: true, kind: 'html' },
      { name: 'image', required: true, kind: 'image' }
    ]
  },
  'table-focus': {
    id: 'table-focus',
    templateFile: 'table-focus.html',
    slots: [
      { name: 'title', required: true, kind: 'text' },
      { name: 'table', required: true, kind: 'html' },
      { name: 'note', required: false, kind: 'html' }
    ]
  },
  'two-columns': {
    id: 'two-columns',
    templateFile: 'two-columns.html',
    slots: [
      { name: 'title', required: true, kind: 'text' },
      { name: 'left', required: true, kind: 'html' },
      { name: 'right', required: true, kind: 'html' }
    ]
  },
  'image-left': {
    id: 'image-left',
    templateFile: 'image-left.html',
    slots: [
      { name: 'title', required: true, kind: 'text' },
      { name: 'body', required: true, kind: 'html' },
      { name: 'image', required: true, kind: 'image' }
    ]
  },
  'table-and-figure': {
    id: 'table-and-figure',
    templateFile: 'table-and-figure.html',
    slots: [
      { name: 'title', required: true, kind: 'text' },
      { name: 'table', required: true, kind: 'html' },
      { name: 'image', required: true, kind: 'image' },
      { name: 'note', required: false, kind: 'html' }
    ]
  }
};
