import { Node, mergeAttributes } from '@tiptap/core';
import katex from 'katex';

export interface MathOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathFormula: {
      insertMathFormula: (latex: string) => ReturnType;
    };
  }
}

export const MathFormula = Node.create<MathOptions>({
  name: 'mathFormula',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: 'E = mc^2',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-inkora-math]',
        getAttrs: (el) => {
          if (typeof el === 'string') return false;
          return { latex: el.getAttribute('data-latex') || '' };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const latex = String(HTMLAttributes.latex || '');
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, {
        'data-inkora-math': 'true',
        'data-latex': latex,
        class: 'inkora-math-block my-3 p-3 rounded-xl bg-indigo-50/60 border border-indigo-200 text-center',
      }),
      latex,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className =
        'my-3 px-4 py-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/70 text-center overflow-x-auto select-none';
      dom.setAttribute('data-inkora-math', 'true');
      const latex = String(node.attrs.latex || '');
      dom.setAttribute('data-latex', latex);

      try {
        dom.innerHTML = katex.renderToString(latex, {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        dom.textContent = latex;
      }

      return { dom };
    };
  },

  addCommands() {
    return {
      insertMathFormula:
        (latex: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { latex },
          });
        },
    };
  },
});
