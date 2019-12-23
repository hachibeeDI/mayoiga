import {InputHTMLAttributes} from 'react';

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

type MayoigaConnectedInputProtocol<S, Name extends keyof S, DelegatedProps> = {
  name: Name;
  value: S[Name];
  /** Errors which generated by mayoiga validation */
  errors: ReadonlyArray<string>;
  /** Validation is running even if it is first renderd. `touched` can be useful if you would like to suppress error indication until user touched the input. */
  touched: boolean;
  onChange(name: Name, value: S[Name]): void;
  /**
   * Props which passed via `componentProps` of {@link FieldProps}.
   */
  delegatedProps: DelegatedProps;
};
export type InputProtocol<S, Name extends keyof S, DelegatedProps> = MayoigaConnectedInputProtocol<S, Name, DelegatedProps> &
  Omit<InputHTMLAttributes<any>, 'name' | 'onChange' | 'value'>;

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
