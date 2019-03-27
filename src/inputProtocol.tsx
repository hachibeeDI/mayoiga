import * as React from 'react';

import {useCallback, InputHTMLAttributes, SyntheticEvent} from 'react';

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type InputProtocol<S, Name extends keyof S> = Omit<InputHTMLAttributes<any>, 'name' | 'onChange' | 'value'> & {
  name: Name;
  value: S[Name];
  errors: ReadonlyArray<string>;
  touched: boolean;
  onChange(name: Name, value: S[Name]): void;
};

// TODO: How's the below?
// type Primitive = 'string' | 'number' | 'boolean';
// type FieldType<FT> = FT extends string
//   ? 'string'
//   : FT extends number
//   ? 'number'
//   : FT extends boolean
//   ? 'boolean'
//   : ((domVal: string) => FT);
// const PRIMITIVE_CONVERT_DEF = {
//   string: (val: string) => val,
//   number: (val: string) => parseInt(val, 10) || 0,
//   boolean: (val: string) => val === 'true',
// };

// function fieldConverter<FT>(dataType: FieldType<FT>, value: string): FT {
//   const def = (PRIMITIVE_CONVERT_DEF as any)[dataType as any];
//   if (def) {
//     return def(value);
//   }
//   return (dataType as any)(value);
// }
