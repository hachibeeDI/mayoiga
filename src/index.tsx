import * as React from 'react';

import {memo, useContext, useReducer, useCallback, useMemo, createContext} from 'react';
import {SyntheticEvent, Dispatch, Context, ReactNode, FC} from 'react';

import {Form, Field, connectForm} from './forms';

export {Form, Field, connectForm};
export default {Form, Field, connectForm};

type FormReducerActionTypes = 'CHANGE' | 'SUBMIT';
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

// TODO: need `mapChanged(value: S): S;` ?
export function createFormScope<S>() {
  const Ctx = createContext((null as any) as MayoigaContextValue<S>);

  return {
    context: Ctx,
    scope: function<OwnProps = {}>(ConnectedComponent: FC<OwnProps>) {
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
            default:
              return state;
          }
        }, initialState);

        return (
          <Ctx.Provider value={{state, dispatch}}>
            <ConnectedComponent {...props} />
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
        const {name, validations, onChange} = props;
        const value = state[name];

        const handleChange = useCallback(
          (e: SyntheticEvent<HTMLInputElement>) => {
            const value: any = e.currentTarget.value;
            dispatch(fieldChange(name, value));
            if (onChange) {
              onChange(name, value as any);
            }
          },
          [name, state]
        );

        let err: string | undefined;
        if (validations !== undefined) {
          err = validations.map(v => v(value)).find(result => !!result);
        }

        return (
          <>
            <input key={name as string} name={name as string} value={value.toString()} onChange={handleChange} />
            {err && <div style={{color: 'red'}}>{err}</div>}
          </>
        );
      },
    }),
    [formScope]
  );
}
