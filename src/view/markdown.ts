import hljs from 'highlight.js';
import {marked} from 'marked';
import {escape} from 'html-escaper';

export function renderMarkdown(str: string, options: {highlight?: boolean} = {}) {
  const renderer = new marked.Renderer();
  renderer.code = (text, lang) => {
    const code = options.highlight ? highlightCode(text, lang) : {html: escape(text), lang};
    const codeToolbar = `
      <div class="toolbar">
        <span>${code.lang}</span>
        <a class="icon" href="#copy-code" title="Copy code"><i class="icon-copy"></i></a>
      </div>
    `;
    return `<div class="code-block">${codeToolbar}<pre class="unhilighted" lang="${code.lang}">${code.html}</pre></div>`;
  };
  renderer.html = escape;  // escape all html tags
  return marked.parse(str, {renderer, breaks: true, silent: true});
}

// The output ChatGPT might be plain text or markdown and there is no way to
// know it before parsing. So we only treat text as markdown if there are some
// very strong indicators that the text is markdown format.
export function veryLikelyMarkdown(str: string) {
  const markdownChars = /[#*-\d.>`[\]()_~]/g;
  return markdownChars.test(str);
}

// Code highlight.
export function highlightCode(text: string, language: string) {
  const code = language ?
    hljs.highlight(text, {language, ignoreIllegals: true}) :
    hljs.highlightAuto(text);
  return {html: code.value, lang: code.language};
}

// Escape the special HTML characters in plain text message.
export function escapeText(str: string) {
  if (!str)
    return '';
  return escape(str).replaceAll('\n', '<br/>');
}
