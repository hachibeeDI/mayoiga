/**
 * This is just a sample implementation.
 * You can make to fit any component library that you are using.
 *
 */

import * as React from 'react';

import {useCallback, InputHTMLAttributes, SyntheticEvent} from 'react';

import {InputProtocol} from './inputProtocol';

// TODO: mapStateToValue (val: S[Name]) => string
export function MappedInputFactory(mapInputToState: (val: string) => any = val => val /** FIXME: fmmmmmm */) {
  return <S, Name extends keyof S>(props: InputProtocol<S, Name, undefined>) => {
    const {name, value, onChange, errors, touched, delegatedProps = {}, ...restProps} = props;
    const handleChange = useCallback(
      (e: SyntheticEvent<HTMLInputElement>) => {
        const value = e.currentTarget.value;
        onChange(name, mapInputToState(value));
      },
      [onChange]
    );
    return (
      <>
        <input {...restProps} {...delegatedProps} value={value ? value.toString() : ''} name={name as string} onChange={handleChange} />
        {touched && errors.length !== 0 && <div style={{color: 'red'}}>{errors[0]}</div>}
      </>
    );
  };
}

export const Input = MappedInputFactory();
export const NumberInput = MappedInputFactory(val => parseInt(val, 10) || 0);

export function MappedRadioFactory(
  candidates: ReadonlyArray<{label: string; value: any}>,
  /** FIXME: fmmmmmm, I think I can write infer which returns `never` if type is invalid but... */
  mapInputToState: (val: string) => any = val => val
) {
  return <S, Name extends keyof S>(props: InputProtocol<S, Name, undefined>) => {
    const {name, onChange, errors, touched, delegatedProps = {}, ...restProps} = props;
    const handleChange = useCallback(
      (e: SyntheticEvent<HTMLInputElement>) => {
        const value = e.currentTarget.value;
        onChange(name, mapInputToState(value));
      },
      [onChange]
    );
    return (
      <>
        {candidates.map(({label, value}) => (
          <label key={value}>
            <input
              {...restProps}
              {...delegatedProps}
              type="radio"
              name={name as string}
              value={value}
              checked={value === props.value}
              onChange={handleChange}
            />
            {label}
          </label>
        ))}
        {touched && errors.length !== 0 && <div style={{color: 'red'}}>{errors[0]}</div>}
      </>
    );
  };
}

export function MappedSelectFactory(
  options: ReadonlyArray<{label: string; value: any; disabled?: boolean}>,
  mapInputToState: (val: string) => any = val => val
) {
  return <S, Name extends keyof S>(props: InputProtocol<S, Name, undefined>) => {
    const {value, name, onChange, errors, touched, delegatedProps = {}, ...restProps} = props;
    const handleChange = useCallback(
      (e: SyntheticEvent<HTMLSelectElement>) => {
        const value = e.currentTarget.value;
        onChange(name, mapInputToState(value));
      },
      [onChange]
    );
    return (
      <>
        <select {...restProps} {...delegatedProps} name={name as string} value={value ? value.toString() : ''} onChange={handleChange}>
          <option value="" disabled={true}>
            Please select
          </option>
          {options.map(({label, value, disabled}) => (
            <option key={value} value={value} disabled={disabled}>
              {label}
            </option>
          ))}
        </select>
        {touched && errors.length !== 0 && <div style={{color: 'red'}}>{errors[0]}</div>}
      </>
    );
  };
}
