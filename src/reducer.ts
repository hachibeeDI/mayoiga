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
        // NOTE: because typedoc is using old version of TypeScript.
        (buf as any)[k] = [];
        return buf;
      },
      {} as Store<S>['errors']
    ),
    touched: stateKeys.reduce(
      (buf, k) => {
        // NOTE: same as above. Hey! should I make the code dirty because of document automation???
        (buf as any)[k] = false;
        return buf;
      },
      {} as Store<S>['touched']
    ),
  };
};

export const useFormReducer = <S>(
  initialState: S,
  onSubmit: (hasErrors: boolean, value: S, formInfo: {errors: Store<S>['errors']; touched: boolean}) => void
) =>
  useReducer(
    (state: Store<S>, action: FSA<S>) => {
      // TODO: logging functionality
      // console.log(action);
      switch (action.type) {
        case 'SWAP': {
          return createFormInitialState(action.payload);
        }
        case 'SET_STATE': {
          return {
            ...state,
            formData: {
              ...state.formData,
              ...action.payload,
            },
          };
        }
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
          // FIXME: :thinking_face:
          const haveTouchedAll = (Object.values(state.touched) as ReadonlyArray<boolean>).every(v => v);
          const hasAnyError = (Object.values(state.errors) as ReadonlyArray<string>).some(errs => errs.length !== 0);
          // I should repent my sin. I called side effect in reducer...
          onSubmit(hasAnyError, state.formData, {
            errors: state.errors,
            touched: haveTouchedAll,
          });
          return state;
        }
        case 'ERROR': {
          const {name, value} = action.payload;
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
    },
    initialState,
    createFormInitialState
  );
