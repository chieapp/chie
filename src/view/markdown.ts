import {marked} from 'marked';
import {escape} from 'html-escaper';

const renderer = new marked.Renderer();
renderer.code = (code, lang) => {
  return `<pre class="unhilighted" lang="${lang}">${escape(code)}</pre>`
};

export function renderMarkdown(str: string) {
  return marked.parse(str, {renderer, breaks: true, silent: true});
}

// The output ChatGPT might be plain text or markdown and there is no way to
// know it before parsing. So we only treat text as markdown if there are some
// very strong indicators that the text is markdown format.
// Note that <> are not strong indicators, sometimes ChatGPT may output plain
// text "<p>" and we don't want to parse it as markdown since it would be
// treated as raw html tags.
export function veryLikelyMarkdown(str: string) {
  return str.indexOf('`') != -1;
}
