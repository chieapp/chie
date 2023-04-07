import hljs from 'highlight.js';
import {marked} from 'marked';
import {escape} from 'html-escaper';

export function renderMarkdown(str: string, options: {highlight?: boolean} = {}) {
  const renderer = new marked.Renderer();
  // Add toolbar and code highlight for code blocks.
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
  // Do not add h1 tags as they are disturbing the chat.
  renderer.heading = (text: string, level: number) => {
    return `<h4>${'#'.repeat(level)} ${text}</h4>`;
  };
  // Escape all html tags.
  renderer.html = escape;
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

// Escape the special HTML characters in plain text message.
export function escapeText(str: string) {
  if (!str)
    return '';
  return '<p>' + escape(str.trim()).replaceAll('\n', '<br/>') + '</p>';
}
