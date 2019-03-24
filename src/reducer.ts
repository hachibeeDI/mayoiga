import {useReducer} from 'react';

import {FSA} from './actions';

type StateCond = {[key: string]: any};

type Errors<StateKeys extends string> = {[K in StateKeys]: ReadonlyArray<string>};
type Touched<StateKeys extends string> = {[K in StateKeys]: boolean};

export type Store<S extends {[key: string]: any}> = {
  errors: Errors<Extract<keyof S, string>>;
  formData: S;
  touched: Touched<Extract<keyof S, string>>;
};

const createFormInitialState = <S extends StateCond>(initialState: S) => {
  const stateKeys = Object.keys(initialState);
  return {
    formData: initialState,
    errors: stateKeys.reduce(
      (buf, k) => {
        buf[k] = [];
        return buf;
      },
      {} as Store<S>['errors']
    ),
    touched: stateKeys.reduce(
      (buf, k) => {
        buf[k] = false;
        return buf;
      },
      {} as Store<S>['touched']
    ),
  };
};

export const useFormReducer = <S>(initialState: S, onSubmit: (val: S) => void) =>
  useReducer((state: Store<S>, action: FSA<S>) => {
    switch (action.type) {
      case 'CHANGE': {
        const {name, value} = action.payload;
        return {
          ...state,
          formData: {
            ...state.formData,
            [name]: value,
          },
          touched: {
            ...state.touched,
            [name]: true,
          },
        };
      }
      case 'SUBMIT': {
        // I should repent my sin. I called side effect in reducer...
        onSubmit(state.formData);
        return state;
      }
      case 'ERROR': {
        const {name, value} = action.payload;
        // FIXME: This is super type unsafe dirty hack. Need separate reducer to fix it.
        return {
          ...state,
          errors: {
            ...state.errors,
            [name]: value,
          },
        };
      }
      default:
        return state;
    }
  }, createFormInitialState(initialState));