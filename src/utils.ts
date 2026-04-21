import type {ChangeEvent} from 'react';

// biome-ignore lint/suspicious/noExplicitAny: "unsafe" type guard
export function isChangeEvent<T extends HTMLInputElement>(x: any): x is ChangeEvent<T> {
  if (typeof x !== 'object') {
    return false;
  }
  return 'target' in x;
}

// biome-ignore lint/suspicious/noExplicitAny: "unsafe" type guard
export function isThennable<T>(x: any): x is Promise<T> {
  return x != null && typeof x.then === 'function';
}
