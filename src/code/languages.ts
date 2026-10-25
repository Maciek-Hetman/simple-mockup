import Prism from 'prismjs';
import type { Grammar } from 'prismjs';
// Prism's language files extend the global Prism instance, so they must load in dependency
// order. `prismjs` itself ships markup, CSS, C-like and JavaScript.
import 'prismjs/components/prism-js-extras.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-jsx.js';
import 'prismjs/components/prism-tsx.js';
import 'prismjs/components/prism-markup-templating.js';
import 'prismjs/components/prism-php.js';
import 'prismjs/components/prism-c.js';
import 'prismjs/components/prism-cpp.js';
import 'prismjs/components/prism-csharp.js';
import 'prismjs/components/prism-java.js';
import 'prismjs/components/prism-scala.js';
import 'prismjs/components/prism-kotlin.js';
import 'prismjs/components/prism-go.js';
import 'prismjs/components/prism-dart.js';
import 'prismjs/components/prism-ruby.js';
import 'prismjs/components/prism-scss.js';
import 'prismjs/components/prism-yaml.js';
import 'prismjs/components/prism-markdown.js';
import 'prismjs/components/prism-graphql.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-rust.js';
import 'prismjs/components/prism-swift.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-sql.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-powershell.js';
import 'prismjs/components/prism-lua.js';
import 'prismjs/components/prism-docker.js';
import 'prismjs/components/prism-toml.js';
import 'prismjs/components/prism-haskell.js';
import 'prismjs/components/prism-elixir.js';
import 'prismjs/components/prism-r.js';

export interface Language {
  /** Prism's grammar name, or `plain` for no highlighting. */
  id: string;
  label: string;
  extensions: string[];
}

export const PLAIN_TEXT = 'plain';

export const LANGUAGES: Language[] = [
  { id: PLAIN_TEXT, label: 'Plain text', extensions: ['txt', 'text', 'log'] },
  { id: 'bash', label: 'Bash', extensions: ['sh', 'bash', 'zsh'] },
  { id: 'c', label: 'C', extensions: ['c', 'h'] },
  { id: 'cpp', label: 'C++', extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hh', 'hxx'] },
  { id: 'csharp', label: 'C#', extensions: ['cs'] },
  { id: 'css', label: 'CSS', extensions: ['css'] },
  { id: 'dart', label: 'Dart', extensions: ['dart'] },
  { id: 'docker', label: 'Dockerfile', extensions: ['dockerfile'] },
  { id: 'elixir', label: 'Elixir', extensions: ['ex', 'exs'] },
  { id: 'go', label: 'Go', extensions: ['go'] },
  { id: 'graphql', label: 'GraphQL', extensions: ['graphql', 'gql'] },
  { id: 'haskell', label: 'Haskell', extensions: ['hs'] },
  { id: 'markup', label: 'HTML / XML', extensions: ['html', 'htm', 'xml', 'svg', 'vue', 'svelte'] },
  { id: 'java', label: 'Java', extensions: ['java'] },
  { id: 'javascript', label: 'JavaScript', extensions: ['js', 'mjs', 'cjs'] },
  { id: 'json', label: 'JSON', extensions: ['json'] },
  { id: 'jsx', label: 'JSX', extensions: ['jsx'] },
  { id: 'kotlin', label: 'Kotlin', extensions: ['kt', 'kts'] },
  { id: 'lua', label: 'Lua', extensions: ['lua'] },
  { id: 'markdown', label: 'Markdown', extensions: ['md', 'markdown'] },
  { id: 'php', label: 'PHP', extensions: ['php'] },
  { id: 'powershell', label: 'PowerShell', extensions: ['ps1', 'psm1'] },
  { id: 'python', label: 'Python', extensions: ['py', 'pyw'] },
  { id: 'r', label: 'R', extensions: ['r'] },
  { id: 'ruby', label: 'Ruby', extensions: ['rb'] },
  { id: 'rust', label: 'Rust', extensions: ['rs'] },
  { id: 'scala', label: 'Scala', extensions: ['scala', 'sc'] },
  { id: 'scss', label: 'SCSS', extensions: ['scss'] },
  { id: 'sql', label: 'SQL', extensions: ['sql'] },
  { id: 'swift', label: 'Swift', extensions: ['swift'] },
  { id: 'toml', label: 'TOML', extensions: ['toml'] },
  { id: 'tsx', label: 'TSX', extensions: ['tsx'] },
  { id: 'typescript', label: 'TypeScript', extensions: ['ts', 'mts', 'cts'] },
  { id: 'yaml', label: 'YAML', extensions: ['yml', 'yaml'] },
];

export function grammarFor(language: string): Grammar | undefined {
  return language === PLAIN_TEXT ? undefined : Prism.languages[language];
}

/** Guesses the language from a file name, e.g. `main.rs` or `Dockerfile`. */
export function languageForFile(fileName: string): string | null {
  const name = fileName.toLowerCase();
  const extension = name === 'dockerfile' ? name : (/\.([^.]+)$/.exec(name)?.[1] ?? '');
  return LANGUAGES.find((language) => language.extensions.includes(extension))?.id ?? null;
}
