import { Node, mergeAttributes } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import { Plugin, PluginKey } from "prosemirror-state";
import React from "react";
import { NodeViewWrapper } from "@tiptap/react";

export interface AnnotationOptions {
  HTMLAttributes: Record<string, any>;
  onAnnotationClick?: (number: number) => void;
  highlightedAnnotation?: number | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    annotation: {
      insertAnnotation: (number: number) => ReturnType;
      updateAnnotation: (oldNumber: number, newNumber: number) => ReturnType;
      removeAnnotation: (number: number) => ReturnType;
    };
  }
}

export const Annotation = Node.create<AnnotationOptions>({
  name: "annotation",

  addOptions() {
    return {
      HTMLAttributes: {},
      onAnnotationClick: undefined,
      highlightedAnnotation: null,
    };
  },

  group: "inline",

  inline: true,

  atom: true,

  addAttributes() {
    return {
      number: {
        default: 1,
        parseHTML: (element) => {
          const number = element.getAttribute("data-number");
          return number ? parseInt(number, 10) : 1;
        },
        renderHTML: (attributes) => {
          return {
            "data-number": attributes.number,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="annotation"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const number = node.attrs.number;
    const isHighlighted = this.options.highlightedAnnotation === number;
    
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "annotation",
        "data-number": number,
        class: `inline-flex items-center justify-center px-2 py-1 mx-1 text-xs font-bold rounded-full bg-blue-600 text-white cursor-pointer hover:bg-blue-700 transition-colors ${
          isHighlighted ? "ring-2 ring-yellow-400 ring-offset-2" : ""
        }`,
        contenteditable: "false",
      }),
      String(number),
    ];
  },

  addCommands() {
    return {
      insertAnnotation:
        (number: number) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { number },
          });
        },
      updateAnnotation:
        (oldNumber: number, newNumber: number) =>
        ({ tr, state }) => {
          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs.number === oldNumber) {
              tr.setNodeMarkup(pos, undefined, { number: newNumber });
            }
          });
          return true;
        },
      removeAnnotation:
        (number: number) =>
        ({ tr, state }) => {
          const positions: Array<{ pos: number; size: number }> = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs.number === number) {
              positions.push({ pos, size: node.nodeSize });
            }
          });

          positions.reverse().forEach(({ pos, size }) => {
            tr.delete(pos, pos + size);
          });

          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("annotation"),
        props: {
          handleClick: (view, pos, event) => {
            const node = view.state.doc.nodeAt(pos);
            if (node && node.type.name === this.name) {
              const number = node.attrs.number;
              this.options.onAnnotationClick?.(number);
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});

