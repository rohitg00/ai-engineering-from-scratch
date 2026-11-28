/**
 * Plain-text math.
 *
 * The lessons write inline and block math in LaTeX. The app has no typesetting
 * dependency, so this module rewrites the common subset into Unicode and ASCII
 * that reads correctly in a monospace panel:
 *
 *   \frac{a}{b}        -> a/b
 *   \sqrt{d_k}         -> √d_k
 *   \sum_{i=1}^{N}     -> Σ_i=1^N
 *   \mathbb{E}_{x}     -> E_x
 *   \nabla_\theta      -> ∇_θ
 *
 * Unknown commands lose the backslash and keep their name, so nothing is ever
 * dropped silently. The content build and the browser share this file, which
 * keeps objectives, prose, and cards consistent.
 */

const GREEK = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ',
  tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
  Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

const BLACKBOARD = { E: 'E', R: 'R', N: 'N', Z: 'Z', Q: 'Q', C: 'C', P: 'P', '1': '1' };

const OPERATORS = {
  cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', equiv: '≡',
  to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', Leftarrow: '⇐',
  leftrightarrow: '↔', mapsto: '↦',
  infty: '∞', sum: 'Σ', prod: '∏', int: '∫', partial: '∂', nabla: '∇',
  in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', cup: '∪', cap: '∩',
  forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨',
  sim: '~', propto: '∝', perp: '⊥', parallel: '∥', angle: '∠', degree: '°',
  ldots: '…', dots: '…', cdots: '⋯', mid: '|', lvert: '|', rvert: '|', vert: '|',
};

const WORDS = {
  max: 'max', min: 'min', log: 'log', ln: 'ln', exp: 'exp', arg: 'arg',
  argmax: 'arg max', argmin: 'arg min', softmax: 'softmax', det: 'det', dim: 'dim',
  lim: 'lim', sup: 'sup', inf: 'inf', sin: 'sin', cos: 'cos', tan: 'tan',
  tanh: 'tanh', sigmoid: 'sigmoid', relu: 'relu',
};

const SPACING = /\\[,;:! ]|\\quad|\\qquad/g;

const ACCENTS = { hat: '\u0302', bar: '\u0304', tilde: '\u0303', vec: '\u20d7', dot: '\u0307' };

function unwrap(source) {
  let text = source;
  let previous;

  // Resolve the nested groups that carry the actual letters first.
  do {
    previous = text;
    text = text
      .replace(/\\mathbb\{([^{}]*)\}/g, (_, name) => BLACKBOARD[name] ?? name)
      .replace(/\\mathrm\{([^{}]*)\}/g, '$1')
      .replace(/\\mathbf\{([^{}]*)\}/g, '$1')
      .replace(/\\text\{([^{}]*)\}/g, '$1')
      .replace(/\\operatorname\{([^{}]*)\}/g, '$1')
      .replace(/\\(hat|bar|tilde|vec|dot)\{([^{}]*)\}/g, (_, accent, name) =>
        name + (ACCENTS[accent] ?? ''),
      );
  } while (text !== previous);

  return text;
}

export function plainMath(source) {
  if (!source) return '';

  let text = unwrap(String(source));

  text = text
    .replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, '$1√($2)')
    .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/\\binom\{([^{}]*)\}\{([^{}]*)\}/g, 'C($1,$2)');

  // Fold away size and delimiter commands before symbol lookup.
  text = text.replace(/\\(left|right|big|Big|bigg|Bigg)[.]?/g, '');
  text = text.replace(SPACING, ' ');

  text = text.replace(/\\([a-zA-Z]+)/g, (_, name) =>
    GREEK[name] ?? OPERATORS[name] ?? WORDS[name] ?? name,
  );

  // Groups become flat identifiers: x_{t+1} -> x_(t+1), W^{T} -> W^T.
  const group = (body) => {
    if (/^[A-Za-z0-9'′]+$/.test(body) || /^\(.*\)$/.test(body)) return body;
    return `(${body})`;
  };

  text = text
    .replace(/\^\{([^{}]*)\}/g, (_, body) => `^${group(body)}`)
    .replace(/_\{([^{}]*)\}/g, (_, body) => `_${group(body)}`)
    .replace(/[{}]/g, '')
    .replace(/\\[,;:!]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return text;
}
