import hljs from 'highlight.js';
import {escape} from 'html-escaper';
import {marked} from 'marked';

export interface MarkdownHtmlDelta {
  type: 'append' | 'insert' | 'reset';
  html: string;
  insertDepth?: number;
  deleteText?: number;
}

// Provide an interface to parse markdown from streamed data, and output minimal
// html changes.
// Note that we are using marked.js which is not a streaming library, we should
// migrate to use tree-sitter in future.
export default class StreamedMarkdown {
  text: string = '';
  isMarkdown: boolean = false;
  html: string;

  renderer: marked.Renderer;

  constructor(options: {highlight?: boolean} = {}) {
    this.renderer = new marked.Renderer();
    // Add toolbar and code highlight for code blocks.
    this.renderer.code = (text, lang) => {
      const code = options.highlight ? highlightCode(text, lang) : {html: escape(text), lang};
      const codeToolbar = `
        <div class="toolbar">
          <span>${code.lang}</span>
          <a class="icon" href="#copy-code" title="Copy code"><i class="icon-copy"></i></a>
        </div>
      `;
      return `<div class="code-block">${codeToolbar}<pre class="unhilighted" lang="${code.lang}">${code.html}</pre></div>`;
    };
    // Do not add h1 tags as they are disturbing the chat.
    this.renderer.heading = (text: string, level: number) => {
      return `<h4>${'#'.repeat(level)} ${text}</h4>`;
    };
    // Escape all html tags.
    this.renderer.html = escape;
  }

  appendText(text: string): MarkdownHtmlDelta {
    this.isMarkdown = this.isMarkdown || veryLikelyMarkdown(text);
    this.text += text;
    const html = this.isMarkdown ?
      marked.parse(this.text, {renderer: this.renderer, breaks: true, silent: true}) :
      escapeText(this.text);
    const result = computeHtmlDelta(this.html, html);
    if (!result)  // essentially no change
      return {type: 'append', html: ''};
    this.html = html;
    return result;
  }
}

// Escape the special HTML characters in plain text message.
export function escapeText(str: string) {
  if (!str)
    return '';
  return '<p>' + escape(str.trim()).replaceAll('\n', '<br>') + '</p>';
}

// Code highlight.
export function highlightCode(text: string, language: string) {
  let code;
  try {
    if (language)
      code = hljs.highlight(text, {language, ignoreIllegals: true});
  } catch(error) {
    // Ignore error.
  }
  if (!code)
    code = hljs.highlightAuto(text);
  return {html: code.value, lang: code.language};
}

// The output ChatGPT might be plain text or markdown and there is no way to
// know it before parsing. So we only treat text as markdown if there are some
// very strong indicators that the text is markdown format.
function veryLikelyMarkdown(str: string) {
  const markdownChars = /[#*`[\]()]/g;
  return markdownChars.test(str);
}

// Compare 2 htmls and return the minimal operaion needed for updating.
function computeHtmlDelta(before: string | null, after: string): MarkdownHtmlDelta | null{
  if (!before)
    return {type: 'append', html: after};
  const pos = findStartOfDifference(before, after);
  const oldTail = before.slice(pos).trimRight();
  const newTail = after.slice(pos).trimRight();
  // The change is append only.
  if (oldTail.length == 0)
    return {type: 'append', html: newTail};
  // If the tail is something like "sometext</p>", then we can insert directly
  // into last child instead of updating whole html.
  const match = oldTail.match(/^([^<>]*)(<\/\w+>[\s]*)+$/);
  if (match) {
    const deleteText = match[1].length;
    const tail = oldTail.slice(deleteText);
    if (newTail.endsWith(tail)) {
      // Count how many closing tags.
      const depth = (oldTail.match(/\//g) || []).length;
      return {type: 'insert', html: newTail.slice(0, -tail.length), insertDepth: depth, deleteText};
    }
  }
  // Fallback to updating the whole HTML.
  return {type: 'reset', html: after};
}

// Find the common prefix of two strings.
function findStartOfDifference(a: string, b: string) {
  const max = Math.min(a.length, b.length);
  let i = 0;
  for (; i < max; ++i) {
    if (a[i] != b[i])
      break;
  }
  // When there is change of trailing tag, like from "</p>" to "<br></p>",
  // or from "</p>" to </pre></p>", we would like to match the whole tag instead
  // of the minimum difference like "/p>".
  if (i > 2 && a.slice(i - 2, i) == '</')
    return i - 2;
  if (i > 1 && a.slice(i - 1, i) == '<')
    return i - 1;
  return i;
}
