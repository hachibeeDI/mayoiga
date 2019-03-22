import * as React from 'react';

import {memo, useContext, useReducer, useCallback, useMemo, createContext} from 'react';
import {SyntheticEvent, Dispatch, Context, ReactNode, FC} from 'react';

import {Form, Field, connectForm} from './forms';

export {Form, Field, connectForm};
export default {Form, Field, connectForm};

type FormReducerActionTypes = 'CHANGE';
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

type FormEffect<S> = {
  getState(): S;
};

type FormProps<S> = {
  onSubmit(value: S): void;
  mapChanged(value: S): S;
  children: ReactNode;
};

type FieldProps<S, Name extends keyof S> = {
  name: Name;
  onChange?(name: Name, value: S[Name]): void;
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

type MayoigaProps<S> = {
  initialState: S;
};

export function createFormScope<S>() {
  const Ctx = createContext((null as any) as MayoigaContextValue<S>);

  return {
    context: Ctx,
    scope: function<OwnProps>(ConnectedComponent: FC<OwnProps>) {
      return (props: OwnProps & MayoigaProps<S>) => {
        const {initialState} = props;
        const [state, dispatch] = useReducer((state: S, action: FSA<S>) => {
          switch (action.type) {
            case 'CHANGE': {
              const {name, value} = action.payload;
              return {...state, [name]: value};
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
        const {state} = useContext(formScope);
        return (
          <form
            onSubmit={e => {
              e.preventDefault();
              props.onSubmit(state);
            }}
          >
            {props.children}
          </form>
        );
      },
      Field: <Name extends keyof S>(props: FieldProps<S, Name>) => {
        const {state, dispatch} = useContext(formScope);
        const {name, onChange} = props;
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

        return (
          <>
            <input key={name as string} name={name as string} value={value.toString()} onChange={handleChange} />
          </>
        );
      },
    }),
    [formScope]
  );
}
