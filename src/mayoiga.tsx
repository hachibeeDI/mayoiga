import * as React from 'react';

import {memo, useEffect, useState, useContext, useReducer, useCallback, useMemo, createContext} from 'react';
import {SyntheticEvent, Dispatch, Context, ReactNode, FC} from 'react';

import {FSA, swap, submitValue, changeField, sendErrors} from './actions';
import {Store, useFormReducer} from './reducer';
import {InputProtocol} from './inputProtocol';

const EMPTY_ERRORS: ReadonlyArray<string> = [];

type MayoigaContextValue<S> = {
  state: Store<S>;
  dispatch: Dispatch<FSA<S>>;
};

type Validator<S, Name extends keyof S> = (target: S[Name], record: S) => undefined | string;

type FormProps<S> = {
  onSubmit?(value: S): void;
  // TODO: should support onChange handler and effect on Form level?
  // onChange?(value: S, action: ACT): void;
  children: ReactNode;
};

type FieldProps<S, Name extends keyof S, ComponentProps> = {
  name: Name;
  onChange?(name: Name, value: S[Name]): void;
  validations?: ReadonlyArray<Validator<S, Name>>;

  componentProps?: ComponentProps; // FIXME:
  component: FC<InputProtocol<S, Name, ComponentProps>>;
};

type MayoigaProps<S> = {
  initialState: S;
  onSubmit(hasErrors: boolean, value: S, formInfo: {errors: Store<S>['errors']; touched: boolean}): void;
};

type ScopedComponentProps<S> = {
  touched: boolean;
  errors: Store<S>['errors'];
  formState: S;
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

        // TODO: I assumed useReducer is re-render if initialState was changed but doesn't. Need investigation though, I'll address by the useEffect for the time being.
        useEffect(() => dispatch(swap(initialState)), [initialState]);

        const touchedAll = Object.values<boolean>(state.touched).every(v => v);
        return useMemo(
          () => (
            <Ctx.Provider value={{state, dispatch}}>
              <ConnectedComponent {...props} formState={state.formData} touched={touchedAll} errors={state.errors} />
            </Ctx.Provider>
          ),
          [state.formData, touchedAll, state.errors]
        );
      };
    },
  };
}

export function useForm<S>(formScope: Context<MayoigaContextValue<S>>) {
  return useMemo(
    () => ({
      Form: memo((props: FormProps<S>) => {
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
      }),
      Field: <Name extends Extract<keyof S, string>, ComponentProps = undefined>(props: FieldProps<S, Name, ComponentProps>) => {
        const {state, dispatch} = useContext(formScope);
        const {component, name, validations, onChange} = props;

        const validate = useCallback(
          target => {
            if (validations !== undefined) {
              const errors = validations.map(v => v(target, state.formData)).filter((result): result is string => !!result);
              dispatch(sendErrors(name, errors.length === 0 ? EMPTY_ERRORS : errors));
            }
          },
          [validations]
        );

        const handleChange = useCallback(
          (name: Name, value: S[Name]) => {
            dispatch(changeField(name, value));
            if (onChange) {
              onChange(name, value as any);
            }
            validate(value);
          },
          [name, state]
        );

        const value = state.formData[name];
        const errors = state.errors[name];
        const touched = state.touched[name];
        useEffect(() => validate(value), [state.formData]);

        const Component = component;
        return (
          <Component
            name={name}
            value={value as any /** FIXME: */}
            onChange={handleChange}
            errors={errors}
            touched={touched}
            delegatedProps={props.componentProps!}
          />
        );
      },
    }),
    [formScope]
  );
}
