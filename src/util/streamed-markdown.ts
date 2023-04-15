import hljs from 'highlight.js';
import {escape} from 'html-escaper';
import {marked} from 'marked';

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

  appendText(text: string): {html: string, back?: number} {
    this.isMarkdown = this.isMarkdown || veryLikelyMarkdown(text);
    this.text += text;
    const fullHtml = this.isMarkdown ?
      marked.parse(this.text, {renderer: this.renderer, breaks: true, silent: true}) :
      escapeText(this.text);
    let result;
    if (this.html) {
      // Return delta of html.
      const pos = findStartOfDifference(this.html, fullHtml);
      result = {html: fullHtml.substr(pos), back: this.html.length - pos};
    } else {
      result = {html: fullHtml};
    }
    this.html = fullHtml;
    return result;
  }
}

// Escape the special HTML characters in plain text message.
export function escapeText(str: string) {
  if (!str)
    return '';
  return '<p>' + escape(str.trim()).replaceAll('\n', '<br/>') + '</p>';
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
  const markdownChars = /[#*-\d.>`[\]()_~]/g;
  return markdownChars.test(str);
}

// Find the common prefix of two strings.
function findStartOfDifference(a: string, b: string) {
  const max = Math.min(a.length, b.length);
  for (let i = 0; i < max; ++i) {
    if (a[i] != b[i])
      return i;
  }
  return max;
}
