import * as React from 'react';

import {useCallback, InputHTMLAttributes, SyntheticEvent} from 'react';

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type InputProtocol<S, Name extends keyof S> = Omit<InputHTMLAttributes<any>, 'name' | 'onChange'> & {
  name: Name;
  errors: ReadonlyArray<string>;
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

/** Sample implementation */
export function MappedInputBuilder(mapInputToState: (val: string) => any /** FIXME: fmmmmmm */) {
  return <S, Name extends keyof S>(props: InputProtocol<S, Name>) => {
    const {name, onChange, errors} = props;
    const handleChange = useCallback(
      (e: SyntheticEvent<HTMLInputElement>) => {
        const value = e.currentTarget.value;
        onChange(name, mapInputToState(value));
      },
      [onChange]
    );
    return (
      <>
        <input {...props} name={name as string} onChange={handleChange} />
        {errors.length !== 0 && <div style={{color: 'red'}}>{errors[0]}</div>}
      </>
    );
  };
}

export const Input = MappedInputBuilder(val => val);
export const NumberInput = MappedInputBuilder(val => parseInt(val, 10) || 0);
