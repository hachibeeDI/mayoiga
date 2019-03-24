import * as React from 'react';

import {memo, useState, useContext, useReducer, useCallback, useMemo, createContext} from 'react';
import {SyntheticEvent, Dispatch, Context, ReactNode, FC} from 'react';

import {InputProtocol} from './inputProtocol';

const STUPID_ERR_PREFIX = '@@Err';

type FormReducerActionTypes = 'CHANGE' | 'SUBMIT' | 'ERROR';
type FSA<S> = {
  type: FormReducerActionTypes;
  payload: {
    name: keyof S;
    value: S[keyof S];
  };
};

type MayoigaContextValue<S> = {
  state: S;
  dispatch: Dispatch<FSA<S>>;
};

type Validator<S, Name extends keyof S> = (target: S[Name]) => undefined | string;

type FormEffect<S> = {
  getState(): S;
};

type FormProps<S> = {
  onSubmit(value: S): void;
  children: ReactNode;
};

type FieldProps<S, Name extends keyof S> = {
  name: Name;
  onChange?(name: Name, value: S[Name]): void;
  validations?: ReadonlyArray<Validator<S, Name>>;
  component: FC<InputProtocol<S, Name>>;

  // children(props: {value: S[Name]; onChange?(e: SyntheticEvent<unknown>): void}): ReactNode;
};

function fieldChange<S>(name: keyof S, value: S[keyof S]): FSA<S> {
  return {
    type: 'CHANGE',
    payload: {
      name,
      value,
    },
  };
}

function submitValue<S>(state: S): FSA<S> {
  return {
    type: 'SUBMIT',
    payload: {} as any, // FIXME: I know this is wrong but it's mendokusai. Fix FSA later.
  };
}

type MayoigaProps<S> = {
  initialState: S;
  onSubmit(value: S): void;
};

type ScopedComponentProps = {
  pristine: boolean;
  errors: ReadonlyArray<string>;
};

// TODO: need `mapChanged(value: S): S;` ?
export function createFormScope<S>() {
  const Ctx = createContext((null as any) as MayoigaContextValue<S>);

  return {
    context: Ctx,
    scope: function<OwnProps = {}>(ConnectedComponent: FC<OwnProps & ScopedComponentProps>) {
      return (props: OwnProps & MayoigaProps<S>) => {
        const {initialState} = props;
        const [state, dispatch] = useReducer((state: S, action: FSA<S>) => {
          switch (action.type) {
            case 'CHANGE': {
              const {name, value} = action.payload;
              return {...state, [name]: value};
            }
            case 'SUBMIT': {
              // I should repent my sin. I called side effect in reducer...
              props.onSubmit(state);
              return state;
            }
            case 'ERROR': {
              const {name, value} = action.payload;
              // FIXME: This is super type unsafe dirty hack. Need separate reducer to fix it.
              return {...state, [STUPID_ERR_PREFIX]: {[name]: value}};
            }
            default:
              return state;
          }
        }, initialState);

        // FIXME:
        let errors: ReadonlyArray<string> = [];
        if (state) {
          const superSillyErrField = (state as any)[STUPID_ERR_PREFIX];
          if (superSillyErrField) {
            errors = Object.values((state as any)[STUPID_ERR_PREFIX]).flat();
          }
        }
        return (
          <Ctx.Provider value={{state, dispatch}}>
            <ConnectedComponent {...props} pristine={state === initialState} errors={errors} />
          </Ctx.Provider>
        );
      };
    },
  };
}

export function useForm<S>(formScope: Context<MayoigaContextValue<S>>) {
  return useMemo(
    () => ({
      Form: (props: FormProps<S>) => {
        const {state, dispatch} = useContext(formScope);
        const {onSubmit} = props;
        return (
          <form
            onSubmit={e => {
              e.preventDefault();
              if (onSubmit) {
                onSubmit(state);
              }
              dispatch(submitValue(state));
            }}
          >
            {props.children}
          </form>
        );
      },
      Field: <Name extends keyof S>(props: FieldProps<S, Name>) => {
        const {state, dispatch} = useContext(formScope);
        const {component, name, validations, onChange} = props;
        const value = state[name];

        const handleChange = useCallback(
          (name: Name, value: S[Name]) => {
            dispatch(fieldChange(name, value));
            if (onChange) {
              onChange(name, value as any);
            }

            if (validations !== undefined) {
              const errors = validations.map(v => v(value)).filter((result): result is string => !!result);
              dispatch({
                type: 'ERROR',
                payload: {
                  name,
                  value: errors,
                } as any, // FIXME: same
              });
            }
          },
          [name, state]
        );

        let err: ReadonlyArray<string> = [];
        const superSillyErrField = (state as any)[STUPID_ERR_PREFIX];
        if (superSillyErrField) {
          err = superSillyErrField[name] || [];
        }
        const Component = component;
        return <Component name={name} value={value.toString()} onChange={handleChange} errors={err} />;
      },
    }),
    [formScope]
  );
}
