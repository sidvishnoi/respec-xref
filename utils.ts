import { createHash } from 'crypto';
import { exec, ProcessEnvOptions } from 'child_process';

/**
 * Generate intelligent variations of the term
 * Source: https://github.com/tabatkins/bikeshed/blob/682218b6/bikeshed/refs/utils.py#L52 💖
 */
/* istanbul ignore next */
export function* textVariations(term: string) {
  const len = term.length;
  const last1 = len >= 1 ? term.slice(-1) : null;
  const last2 = len >= 2 ? term.slice(-2) : null;
  const last3 = len >= 3 ? term.slice(-3) : null;

  // carrot <-> carrots
  if (last1 === 's') yield term.slice(0, -1);
  else yield `${term}s`;

  // snapped <-> snap
  if (last2 === 'ed' && len >= 4 && term.substr(-3, 1) === term.substr(-4, 1)) {
    yield term.slice(0, -3);
  } else if ('bdfgklmnprstvz'.includes(last1 as string)) {
    yield `${term + last1}ed`;
  }

  // zeroed <-> zero
  if (last2 === 'ed') yield term.slice(0, -2);
  else yield `${term}ed`;

  // generated <-> generate
  if (last1 === 'd') yield term.slice(0, -1);
  else yield `${term}d`;

  // parsing <-> parse
  if (last3 === 'ing') {
    yield term.slice(0, -3);
    yield `${term.slice(0, -3)}e`;
  } else if (last1 === 'e') {
    yield `${term.slice(0, -1)}ing`;
  } else {
    yield `${term}ing`;
  }

  // snapping <-> snap
  if (
    last3 === 'ing' &&
    len >= 5 &&
    term.substr(-4, 1) === term.substr(-5, 1)
  ) {
    yield term.slice(0, -4);
  } else if ('bdfgkmnprstvz'.includes(last1 as string)) {
    yield `${term + last1}ing`;
  }

  // zeroes <-> zero
  if (last2 === 'es') yield term.slice(0, -2);
  else yield `${term}es`;

  // berries <-> berry
  if (last3 === 'ies') yield `${term.slice(0, -3)}y`;
  if (last1 === 'y') yield `${term.slice(0, -1)}ies`;

  // stringified <-> stringify
  if (last3 === 'ied') yield `${term.slice(0, -3)}y`;
  if (last1 === 'y') yield `${term.slice(0, -1)}ied`;
}

export function pickFields<T>(item: T, fields: (keyof T)[]) {
  const result: Partial<T> = {};
  for (const field of fields) {
    result[field] = item[field];
  }
  return result;
}

export function objectHash(obj: object): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  return createHash('sha1')
    .update(str)
    .digest('hex');
}

export function uniq<T>(items: T[]) {
  const unique = new Set(items.map(entry => JSON.stringify(entry)));
  const result = [...unique].map(str => JSON.parse(str) as typeof items[0]);
  return result;
}

export class Cache<K, V> {
  #ttl = 0;
  #map = new Map<K, { time: number; value: V }>();

  constructor(ttl: number) {
    this.#ttl = ttl;
  }

  set(key: K, value: V) {
    this.#map.set(key, { time: Date.now(), value });
  }

  get(key: K) {
    const entry = this.#map.get(key);
    if (!entry) return;
    const { time, value } = entry;
    if (Date.now() - time < this.#ttl) {
      return value;
    }
    this.#map.delete(key);
  }

  invalidate() {
    for (const [key, { time }] of this.#map.entries()) {
      if (Date.now() - time > this.#ttl) {
        this.#map.delete(key);
      }
    }
  }

  clear() {
    this.#map.clear();
  }
}

interface ShOptions extends ProcessEnvOptions {
  output?: 'buffer' | 'stream' | 'silent';
}
/**
 * Asynchronously run a shell command and get its result.
 * @throws {Promise<{ stdout: string, stderr: string, code: number }>}
 */
export function sh(command: string, options: ShOptions = {}) {
  const BOLD = '\x1b[1m';
  const RESET = '\x1b[22m';
  const { output, ...execOptions } = options;

  if (output !== 'silent') {
    console.group(`${BOLD}$ ${command}${RESET}`);
  }

  try {
    return new Promise<string>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      const child = exec(command, { encoding: 'utf-8', ...execOptions });
      child.stdout!.on('data', chunk => {
        if (output === 'stream') process.stdout.write(chunk);
        stdout += chunk;
      });
      child.stderr!.on('data', chunk => {
        if (output === 'stream') process.stderr.write(chunk);
        stderr += chunk;
      });
      child.on('exit', code => {
        stdout = stdout.trim();
        stderr = stderr.trim();
        if (output === 'buffer') {
          if (stdout) console.log(stdout);
          if (stderr) console.error(stderr);
        }
        if (output && output !== 'silent') {
          console.log();
        }
        code === 0 ? resolve(stdout) : reject({ stdout, stderr, code });
      });
    });
  } finally {
    if (output !== 'silent') {
      console.groupEnd();
    }
  }
}
