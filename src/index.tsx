import * as React from 'react';

import {memo, useState, useContext, useReducer, useCallback, useMemo, createContext} from 'react';
import {SyntheticEvent, Dispatch, Context, ReactNode, FC} from 'react';

import {FSA, submitValue, changeField} from './actions';
import {Store, useFormReducer} from './reducer';
import {InputProtocol} from './inputProtocol';

type MayoigaContextValue<S> = {
  state: Store<S>;
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

type MayoigaProps<S> = {
  initialState: S;
  onSubmit(value: S): void;
};

type ScopedComponentProps<S> = {
  touched: boolean;
  errors: Store<S>['errors'];
};

// TODO: need `mapChanged(value: S): S;` ?
export function createFormScope<S>() {
  const Ctx = createContext((null as any) as MayoigaContextValue<S>);

  return {
    context: Ctx,
    scope: function<OwnProps = {}>(ConnectedComponent: FC<OwnProps & ScopedComponentProps<S>>) {
      return (props: OwnProps & MayoigaProps<S>) => {
        const {initialState, onSubmit} = props;
        const [state, dispatch] = useFormReducer(initialState, onSubmit);

        return (
          <Ctx.Provider value={{state, dispatch}}>
            <ConnectedComponent {...props} touched={state.touched} errors={state.errors} />
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
                onSubmit(state.formData);
              }
              dispatch(submitValue(state.formData));
            }}
          >
            {props.children}
          </form>
        );
      },
      Field: <Name extends Extract<keyof S, string>>(props: FieldProps<S, Name>) => {
        const {state, dispatch} = useContext(formScope);
        const {component, name, validations, onChange} = props;
        const value = state.formData[name];

        const handleChange = useCallback(
          (name: Name, value: S[Name]) => {
            dispatch(changeField(name, value));
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

        const Component = component;
        return <Component name={name} value={value.toString()} onChange={handleChange} errors={state.errors[name]} />;
      },
    }),
    [formScope]
  );
}
