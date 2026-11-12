/**
 * Guesses a snippet's language from its content. Each language has weighted patterns; a pattern
 * counts once per matching line, up to three times, so one repeated construct can't win alone.
 *
 * Some languages extend others: TypeScript and JSX are JavaScript plus their own syntax, SCSS is
 * CSS plus its own, C++ is C plus its own. A variant scores its base plus its extras, and only
 * counts when it has extras, so plain JavaScript stays JavaScript.
 */

type Rule = [pattern: RegExp, weight: number];

const MAX_HITS = 3;
/** Long files don't need reading in full to be told apart. */
const MAX_LINES = 400;
/** Nor long lines: anything past this is usually minified, and slow to run patterns over. */
const MAX_LINE_LENGTH = 300;
/** Below this the code is too short or too generic to call. */
const MIN_SCORE = 4;

/** Lines that end with a brace or semicolon: rare in languages without them. */
const BRACES_OR_SEMICOLONS = /[{};]\s*$/;

const RULES: Record<string, Rule[]> = {
  bash: [
    [/^#!.*\b(ba|z)?sh\b/, 20],
    [/^\s*(if|while|until) \[\[? /, 5],
    [/^\s*(fi|done|esac)\b/, 5],
    [/\bthen\s*$/, 2],
    [/^\s*(export )?[A-Za-z_]\w*=\S/, 2],
    [/\$\{?\w+\}?/, 1],
    [/\$\(/, 3],
    [/^\s*(echo|sudo|apt(-get)?|npm|npx|yarn|pnpm|git|cd|ls|mkdir|rm|cp|mv|curl|wget|chmod|chown|brew|pip3?|docker|kubectl|cargo|source|exit|set -\w+) /, 3],
    [/\|\s*(grep|sed|awk|xargs|head|tail|sort|uniq|wc|tee|cut|tr)\b/, 4],
    [/2>&1|>\s*\/dev\/null/, 5],
    [/\s--?[a-z][\w-]*/, 1],
    [/^\s*[\w-]+\(\)\s*\{/, 2],
  ],
  c: [
    [/^\s*#include\s*<\w+\.h>/, 6],
    [/^\s*#include\s*"/, 3],
    [/^\s*#(define|ifn?def|endif|pragma)\b/, 3],
    [/\b(printf|fprintf|scanf|malloc|calloc|free|strcmp|strlen|memcpy|memset)\(/, 4],
    [/\bint main\(/, 3],
    [/\b(unsigned|size_t|u?int\d+_t|typedef)\b/, 3],
    [/\bchar\s*\*/, 3],
    [/\bNULL\b/, 2],
    [/\bstruct \w+\s*[{*]/, 2],
    [/\b(void|int|char|float|double|long) \*?\w+\(/, 2],
    [/^\s*(int|char|float|double|long|short|unsigned) \*?\w+\s*[=;,[]/, 2],
    [/^\s*\*\w+\s*=/, 3],
  ],
  cpp: [
    [/^\s*#include\s*<[a-z_]+>/, 6],
    [/\bstd::/, 6],
    [/\b(cout|cin|endl|cerr)\b/, 5],
    [/\btemplate\s*</, 5],
    [/\b(public|private|protected):/, 4],
    [/\b(nullptr|constexpr|noexcept)\b/, 5],
    [/\bauto\b/, 2],
    [/\bconst \w+(<.*>)?\s*&/, 3],
    [/\bclass \w+( : public \w+)?\s*\{?$/, 2],
    [/\w::\w/, 1],
  ],
  csharp: [
    [/^\s*using System(\.[\w.]+)?;/, 8],
    [/^\s*using [\w.]+;/, 3],
    [/^\s*namespace [\w.]+/, 3],
    [/\{ get; (private |init; )?(set; )?\}|\bget;|\bset;/, 6],
    [/\bConsole\.Write/, 8],
    [/\basync Task\b|\bTask</, 5],
    [/\b(public|private|protected|internal)( static| async| override| virtual| readonly)* [\w<>\[\]?]+ [A-Z]\w*\s*[({]/, 4],
    [/\bstring \w+\s*[=;,)]/, 3],
    [/\bforeach \(var\b/, 5],
    [/\.(Where|Select|FirstOrDefault|ToList|Any)\(/, 3],
    [/^\s*\[\w+(\(.*\))?\]\s*$/, 2],
    [/\bvar \w+ = new \w+/, 1],
  ],
  css: [
    [/^\s*([.#][\w-]+|[a-z]+[.:#[][\w-]+|(html|body|div|span|a|p|h[1-6]|ul|ol|li|img|button|input|section|header|footer|nav|main|table|form|label|\*|:root))[^{}();=]*\{\s*$/, 4],
    [/(^|[{;])\s*(color|background(-[\w-]+)?|margin(-\w+)?|padding(-\w+)?|display|font(-\w+)?|width|height|min-\w+|max-\w+|border(-[\w-]+)?|position|box-\w+|letter-spacing|top|left|right|bottom|flex(-\w+)?|grid(-[\w-]+)?|align-\w+|justify-\w+|text-\w+|z-index|opacity|transition|transform|box-shadow|overflow(-\w)?|cursor|gap|line-height|content|outline|animation|--[\w-]+)\s*:\s*[^;{}:]+(;|\s*\}|$)/, 4],
    [/\b\d*\.?\d+(px|rem|em|vh|vw|vmin|ms|deg|fr)\b/, 2],
    [/#[0-9a-fA-F]{3,8}\b/, 1],
    [/@(media|import|keyframes|font-face|supports|layer)\b/, 5],
    [/!important/, 3],
    [/\bvar\(--[\w-]+\)/, 4],
  ],
  scss: [
    [/^\s*\$[\w-]+\s*:/, 7],
    [/@(mixin|include|extend|use|forward|function|each|if|else|return)\b/, 7],
    [/^\s*&[:.\-_\w[]/, 5],
    [/#\{\$/, 6],
  ],
  dart: [
    [/^\s*import '(package:|dart:|[\w/.]+\.dart')/, 10],
    [/\bWidget build\(/, 9],
    [/\b(StatelessWidget|StatefulWidget|BuildContext|setState)\b/, 7],
    [/\)\s*async\s*\{/, 4],
    [/\bFuture<\w*>/, 3],
    [/\b(late|required) (this\.)?\w+/, 5],
    [/@override\b/, 4],
    [/\bfinal \w+ = /, 3],
    [/\bvoid main\(\)/, 3],
  ],
  docker: [
    [/^FROM \S+/, 4],
    [/^(RUN|CMD|COPY|ADD|WORKDIR|ENV|EXPOSE|ENTRYPOINT|ARG|LABEL|USER|VOLUME|HEALTHCHECK) /, 5],
  ],
  elixir: [
    [/^\s*defmodule [\w.]+ do/, 10],
    [/^\s*defp? \w+.*\bdo\s*$/, 5],
    [/^\s*defp? \w+.*, do:/, 5],
    [/\|>/, 2],
    [/%\{/, 3],
    [/[{(]:(ok|error)\b/, 4],
    [/^\s*@(doc|moduledoc|spec|impl)\b/, 6],
    [/\bfn .*->/, 3],
    [/\b(IO|Enum|Map|String|GenServer)\.\w+/, 3],
    [/^\s*end\s*$/, 1],
  ],
  go: [
    [/^package \w+\s*$/, 4],
    [/^import (\(|")/, 6],
    [/^func (\(\w+ \*?\w+\) )?\w+\(/, 4],
    [/^func \(\w+ \*?\w+\)/, 5],
    [/:=/, 3],
    [/\bfmt\.\w+/, 8],
    [/\berr != nil\b/, 9],
    [/\b(chan|defer|go func)\b/, 5],
    [/\[\][\w*]/, 3],
    [/\btype \w+ (struct|interface) \{/, 8],
    [/\bmap\[\w+\]/, 5],
  ],
  graphql: [
    [/^\s*(query|mutation|subscription)(\s+\w+)?\s*(\(.*\))?\s*\{/, 8],
    [/^\s*fragment \w+ on \w+/, 10],
    [/^\s*(type|input|interface) \w+( implements [\w& ]+)? \{\s*$/, 4],
    [/^\s*(scalar|union|directive) /, 4],
    [/:\s*\[?[A-Z]\w*!/, 6],
    [/\$\w+: \[?\w+/, 3],
    [/\.\.\. ?on \w+/, 7],
  ],
  haskell: [
    [/^\s*module [\w.]+( \(.*\))? where/, 10],
    [/^import (qualified )?[A-Z][\w.]*/, 4],
    [/^\w+ :: /, 7],
    [/\bwhere\s*$/, 3],
    [/\bdata \w+ = /, 6],
    [/\bderiving\b/, 8],
    [/\b(putStrLn|mapM_|foldr|foldl)\b|\bmain = do\b/, 8],
    [/^instance \w+/, 4],
    [/\b(Just|Nothing)\b/, 3],
    [/\w \$ \w/, 3],
    [/<-/, 1],
  ],
  java: [
    [/^\s*import java(x)?\./, 8],
    [/^\s*package [\w.]+;/, 6],
    [/\bSystem\.(out|err)\.print/, 8],
    [/\bpublic static void main\(/, 6],
    [/@Override\b/, 5],
    [/\bthrows \w+/, 5],
    [/\b(public|private|protected)( static)?( final)? [\w<>\[\],]+ [a-z]\w*\s*[(=;]/, 3],
    [/\bString \w+\s*[=;,)]/, 3],
    [/\bboolean \w+/, 3],
    [/\bnew (ArrayList|HashMap|HashSet)\b/, 4],
    [/\.stream\(\)|\bCollectors\.|\bOptional</, 6],
    [/^\s*(final )?[A-Z]\w*(<[\w<>, ?]+>)?(\[\])? [a-z]\w* = /, 3],
    [/\b(extends|implements) [A-Z]\w*/, 1],
    [/\((final )?([A-Z][\w<>[\]]*|int|long|boolean|double) [a-z]\w*(, (final )?([A-Z][\w<>[\]]*|int|long|boolean|double) [a-z]\w*)*\)/, 3],
    [/^\s*(public |private |protected |abstract |static |default )*[\w<>[\], ]+ [a-z]\w*\([^)]*\);\s*$/, 3],
  ],
  javascript: [
    [/^#!.*\bnode\b/, 20],
    [/\b(const|let|var) [\w${}[\], ]+\s*=/, 2],
    [/\bfunction\b\s*\*?\s*\w*\s*\(/, 3],
    [/(\)|\w) =>/, 2],
    [/\.(forEach|map|filter|reduce|includes|push|splice|indexOf|addEventListener|querySelector(All)?|getElementById|toFixed|then|catch)\(/, 2],
    [/\bnew [A-Z]\w*\(/, 1],
    [/\b(true|false|null)\b/, 1],
    [/\bconsole\.\w+\(/, 6],
    [/\brequire\(['"]|\bmodule\.exports\b/, 5],
    [/^\s*import .* from ['"]/, 6],
    [/^\s*export (default |const |function |class |async |\{)/, 6],
    [/[!=]==/, 5],
    [/\b(document|window)\.\w+/, 4],
    [/\basync (function|\(|\w+ =>)|\bawait\b/, 2],
    [/\bundefined\b/, 4],
    [/\.then\(|\bnew Promise\b/, 3],
    [/\bthis\.\w+/, 1],
  ],
  typescript: [
    [/\binterface \w+(<.*>)? (extends [\w, <>.]+ )?\{/, 6],
    [/^\s*(export )?type \w+(<.*>)? = /, 6],
    [/:\s*(string|number|boolean|any|void|unknown|never|bigint)\b/, 5],
    [/\bas (const|string|number|any|unknown)\b/, 5],
    [/\w\?: /, 5],
    [/\): [\w.]+(<.*>)?(\[\])? (=>|\{)/, 4],
    [/\bimport type\b/, 6],
    [/\b(private|public|protected|readonly) \w+\s*[:;=(]/, 2],
    [/^\s*(export )?(const )?enum \w+ \{/, 3],
    [/: (React\.\w+|[A-Z]\w*(<.*>)?(\[\])?)\s*[=;,)]/, 1],
  ],
  jsx: [
    [/<\/[\w.]*>/, 4],
    // Not `Map<T>` or `<T>(x: T) =>`: tags follow an operator, bracket or space.
    [/(^|[\s(={}?:&|,])<[A-Z][\w.]*(\s+\w+=[{"']|\s*\/?>(?!\())/, 4],
    [/\bclassName=/, 7],
    [/\bon[A-Z]\w+=\{/, 6],
    [/\w=\{/, 2],
    [/\buse(State|Effect|Ref|Memo|Callback|Context|Reducer)\b/, 4],
    [/^\s*<>\s*$|^\s*<\/>/, 5],
  ],
  kotlin: [
    [/\bfun \w+/, 6],
    [/\b(override |private |internal |suspend |inline )+fun\b/, 4],
    [/\bval \w+(:\s*\w+)?\s*=/, 3],
    [/\bvar \w+:\s*[A-Z]\w*/, 2],
    [/^\s*package [\w.]+\s*$/, 2],
    [/\bdata class\b/, 7],
    [/\bcompanion object\b/, 7],
    [/\bwhen\s*(\(.*\))?\s*\{/, 4],
    [/\b(listOf|mapOf|setOf|mutableListOf|mutableMapOf|arrayOf)\(/, 5],
    [/\bprintln\(/, 2],
    [/: [A-Z][\w<>]*\?(\s|$|,|\)| =)/, 3],
    [/\bit\.\w+/, 2],
  ],
  lua: [
    [/\blocal function\b/, 6],
    [/\blocal \w+(, \w+)*\s*=/, 4],
    [/^\s*function [\w.:]+\(.*\)\s*$/, 3],
    [/\bthen\s*$/, 2],
    [/\belseif\b/, 3],
    [/~=/, 3],
    [/\b(i?pairs|tostring|tonumber|setmetatable)\(/, 5],
    [/^\s*end\s*$/, 1],
    [/^\s*--/, 1],
  ],
  markdown: [
    [/^#{1,6} \S/, 2],
    [/^\s*[-*+] \S/, 1],
    [/^\s*\d+\. \S/, 2],
    [/\[[^\]]+\]\([^)\s]+\)/, 4],
    [/^```/, 6],
    [/\*\*\w[^*]*\w\*\*/, 3],
    [/^>\s/, 2],
    [/^\|.*\|\s*$/, 2],
  ],
  markup: [
    [/^\s*<!DOCTYPE|^\s*<\?xml/i, 20],
    [/<(html|head|body|meta|link|title|svg)\b/, 6],
    [/<\/?[a-z][\w:-]*(\s+[\w:-]+(="[^"]*"|='[^']*')?)*\s*\/?>/, 2],
    [/\sclass="/, 3],
    [/<!--/, 4],
  ],
  php: [
    [/<\?php/, 20],
    [/\$this->/, 6],
    [/\$\w+->\w+/, 5],
    [/^\s*(namespace|use) [\w\\]+\\\w+;/, 6],
    [/\bfunction \w+\(.*\$\w+/, 5],
    [/\$\w+\s*=[^=>]/, 1],
    [/\becho\b.*;/, 2],
  ],
  powershell: [
    [/\b(Get|Set|New|Remove|Write|Invoke|Start|Stop|Import|Export|Test|Add|Select|Where|ForEach|Out|Format|Convert(To|From))-[A-Z]\w+/, 6],
    [/\s-(eq|ne|gt|lt|ge|le|like|match|and|or|not|contains)\s/, 4],
    [/\[(string|int|bool|switch|Parameter|CmdletBinding)\b/, 4],
    [/\bparam\s*\(/, 3],
    [/\$(_|PSItem|true|false|null|env:\w+)\b/, 5],
  ],
  python: [
    [/^#!.*\bpython/, 20],
    [/^\s*(async )?def \w+\(.*\)\s*(->\s*[^:]+)?:\s*$/, 6],
    [/^\s*from [\w.]+ import /, 6],
    [/^\s*import [\w.]+(\s+as \w+)?(, [\w.]+)*\s*$/, 1],
    [/^\s*(if|elif|while|for|with|try|except|else|finally|class)\b[^{;]*:\s*$/, 3],
    [/\belif\b/, 4],
    [/^\s*(async )?with .+ as \w+:\s*$/, 3],
    [/\bself\.\w+/, 2],
    [/__\w+__/, 3],
    [/\blambda \w*:/, 3],
    [/"""|'''/, 2],
    [/\b(not in|is not|is None)\b/, 3],
    [/\b(None|True|False)\b/, 1],
    [/\bprint\(/, 1],
    [/\bf"[^"]*\{|\bf'[^']*\{/, 4],
    [/\[.* for \w+(, \w+)* in .*\]/, 4],
    [/\b(range|len|enumerate|isinstance|zip|sorted)\(/, 2],
    [/^\s*@\w+(\.\w+)*(\(.*\))?\s*$/, 1],
    [BRACES_OR_SEMICOLONS, -2],
  ],
  r: [
    [/<-/, 4],
    [/<- function\s*\(/, 9],
    [/\blibrary\(\w+\)/, 9],
    [/%>%|%in%|\|> \w+\(/, 6],
    [/\w\$\w/, 4],
    [/\bc\(/, 3],
    [/\b(TRUE|FALSE|NA)\b/, 1],
    [/\b(data\.frame|ggplot|aes|mutate|summarise|filter|read\.csv)\(/, 6],
  ],
  ruby: [
    [/^#!.*\bruby\b/, 20],
    [/^\s*def (self\.)?\w+[?!]?(\(.*\))?\s*$/, 4],
    [/^\s*class \w+( < [\w:]+)?\s*$/, 4],
    [/^\s*module \w+\s*$/, 3],
    [/^\s*end\s*$/, 2],
    [/\bputs\b/, 3],
    [/\bdo( \|[\w, ]+\|)?\s*$/, 3],
    [/^\s*require(_relative)? ['"]/, 3],
    [/\battr_(accessor|reader|writer)\b/, 6],
    [/:\w+ =>|\b\w+: :\w+/, 3],
    [/\b(unless|elsif)\b/, 3],
    [/@\w+/, 1],
    [/\.each\b/, 2],
    [BRACES_OR_SEMICOLONS, -1],
  ],
  rust: [
    [/\bfn \w+(<.*>)?\(/, 6],
    [/\blet mut\b/, 8],
    [/^\s*impl\b/, 5],
    [/\bpub (fn|struct|enum|mod|trait|use|const|crate)\b/, 6],
    [/^\s*use [\w:]+(::\{[^}]*\}|::\*)?;/, 6],
    [/\b(println|print|format|vec|panic|assert(_eq)?|macro_rules|write(ln)?)!/, 7],
    [/&mut\b|&self\b|&str\b|&'\w/, 6],
    [/\b(Vec|Box|Rc|Arc|HashMap)</, 4],
    [/#\[derive\(/, 9],
    [/\.unwrap\(\)|\?;/, 4],
    [/\b(i8|i16|i32|i64|u8|u16|u32|u64|usize|f32|f64)\b/, 4],
    [/\bmatch \w[\w.]*\s*\{/, 3],
    [/^\s*mod \w+;/, 5],
  ],
  scala: [
    [/\bdef \w+(\[.*\])?(\(.*\))*\s*(:\s*[\w\[\], ]+)?\s*=/, 6],
    [/\bobject \w+( extends \w+)?\s*\{/, 6],
    [/\bcase class\b/, 7],
    [/\btrait \w+/, 2],
    [/\bcase \w+(\(.*\))?( if .*)? =>/, 4],
    [/\bval \w+/, 2],
    [/\bimplicit\b/, 6],
    [/^\s*import [\w.]+\.(_|\{)/, 6],
    [/\bextends App\b/, 6],
    [/\b[A-Z]\w*\[[A-Z]\w*\]/, 2],
  ],
  sql: [
    [/^\s*(SELECT|INSERT INTO|UPDATE \w+ SET|DELETE FROM|CREATE (TABLE|INDEX|VIEW|DATABASE|OR REPLACE|UNIQUE)|ALTER TABLE|DROP (TABLE|INDEX|VIEW)|WITH \w+ AS)\b/i, 6],
    [/\b(GROUP BY|ORDER BY|INNER JOIN|LEFT JOIN|PRIMARY KEY|NOT NULL|FOREIGN KEY|REFERENCES|VALUES\s*\()\b/i, 4],
    [/\b(FROM|WHERE|JOIN|LIMIT|HAVING|AND|OR)\b/, 2],
    [/\b(VARCHAR|INTEGER|SERIAL|TIMESTAMP|BOOLEAN|TEXT|BIGINT)\b/i, 3],
    [/^\s*--/, 1],
  ],
  swift: [
    [/^\s*import (UIKit|SwiftUI|Foundation|Combine|XCTest)\b/, 10],
    [/\bfunc \w+(<.*>)?\(/, 4],
    [/\bfunc \w+(<.*>)?\(.*\w+: \w+/, 3],
    [/\b(guard|if) (let|var)\b/, 7],
    [/@(State|Published|Binding|objc|IBOutlet|IBAction|main|escaping|MainActor|ObservedObject)\b/, 6],
    [/\b(protocol|extension) \w+/, 4],
    [/-> some View\b/, 8],
    [/\\\(\w/, 4],
    [/\binit\(/, 3],
    [/\blet \w+(:\s*[A-Z]\w*)?\s*=/, 1],
    [/^\s*(struct|class|enum) \w+: \w+/, 4],
    [/^\s*(let|var) \w+: [A-Z][\w<>[\]]*[?!]?\s*$/, 3],
    [/\bvar \w+:\s*[A-Z]\w*/, 2],
  ],
  toml: [
    [/^\[[\w.-]+\]\s*$/, 5],
    [/^\[\[[\w.-]+\]\]\s*$/, 8],
    [/^[\w.-]+\s*=\s*("|'|\d|true\b|false\b|\[|\{)/, 2],
  ],
  yaml: [
    [/^[\w.-]+:(\s+[^\s{,;=][^,;{]*)?\s*$/, 2],
    [/^\s+[\w.-]+:\s+[^\s{,;=(][^,;{(]*$/, 1],
    [/^\s*- [\w.-]+:(\s|$)/, 4],
    [/^---\s*$/, 3],
    [/^\s*- \S/, 1],
    [BRACES_OR_SEMICOLONS, -2],
  ],
};

/** Only for text that opens like JSON but doesn't parse, e.g. a cut-off excerpt. */
const JSON_RULES: Rule[] = [[/^\s*"[^"]+":\s*["{[\d\-tfn]/, 3]];

/** Variants and the language they build on. */
const BASES: Record<string, string> = { typescript: 'javascript', jsx: 'javascript', tsx: 'javascript', scss: 'css', cpp: 'c' };

function score(lines: string[], rules: Rule[] | undefined): number {
  let total = 0;
  for (const [pattern, weight] of rules ?? []) {
    let hits = 0;
    for (const line of lines) {
      if (pattern.test(line) && ++hits === MAX_HITS) break;
    }
    total += hits * weight;
  }
  return total;
}

function isJson(text: string): boolean {
  if (!/^[[{]/.test(text)) return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** The most likely Prism language id for `code`, or `null` when there's no clear winner. */
export function detectLanguage(code: string): string | null {
  const text = code.trim();
  if (!text) return null;
  if (isJson(text)) return 'json';
  const lines = text
    .split(/\r?\n/, MAX_LINES)
    .map((line) => line.slice(0, MAX_LINE_LENGTH))
    .join('\n')
    // Doc comments quote other syntax, like `@param {(x: string) => void}` in plain JavaScript.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => line.trim());

  const scores = new Map<string, number>();
  for (const id of Object.keys(RULES)) {
    if (!(id in BASES) && id !== 'jsx') scores.set(id, score(lines, RULES[id]));
  }
  const extra = (id: string) => score(lines, RULES[id]);
  const js = scores.get('javascript')!;
  const ts = extra('typescript');
  const jsx = extra('jsx');
  if (ts > 0) scores.set('typescript', js + ts);
  // JSX needs some script around it; tags alone are HTML.
  if (jsx > 0 && js + ts > 0) scores.set(ts > 0 ? 'tsx' : 'jsx', js + ts + jsx);
  const scss = extra('scss');
  if (scss > 0) scores.set('scss', scores.get('css')! + scss);
  const cpp = extra('cpp');
  if (cpp > 0) scores.set('cpp', scores.get('c')! + cpp);

  // Quoted keys alone could be a dict or object literal; it's JSON if it opens like JSON.
  if (/^[[{]/.test(text)) scores.set('json', score(lines, JSON_RULES));

  let best: string | null = null;
  let bestScore = MIN_SCORE - 1;
  for (const [id, value] of scores) {
    if (value > bestScore) {
      best = id;
      bestScore = value;
    }
  }
  return best;
}
