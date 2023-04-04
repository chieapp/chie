import {marked} from 'marked';
import {escape} from 'html-escaper';

const renderer = new marked.Renderer();
renderer.code = (code, lang) => {
  const codeToolbar = `
    <div class="toolbar">
      <span>${lang}</span>
      <a class="icon" href="#copy-code" title="Copy code"><i class="icon-copy"></i></a>
    </div>
  `;
  return `<div class="code-block">${codeToolbar}<pre class="unhilighted" lang="${lang}">${escape(code)}</pre></div>`;
};
renderer.html = (html) => {
  // Escape all html tags.
  return escape(html);
};

export function renderMarkdown(str: string) {
  return marked.parse(str, {renderer, breaks: true, silent: true});
}

// The output ChatGPT might be plain text or markdown and there is no way to
// know it before parsing. So we only treat text as markdown if there are some
// very strong indicators that the text is markdown format.
export function veryLikelyMarkdown(str: string) {
  const markdownChars = /[#*-\d.>`[\]()_~]/g;
  return markdownChars.test(str);
}
