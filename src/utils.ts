import type {ChangeEvent} from 'react';

export function isChangeEvent<T>(x: any): x is ChangeEvent<T> {
  if (typeof x !== 'object') {
    return false;
  }
  return 'target' in x;
}
