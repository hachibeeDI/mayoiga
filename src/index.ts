import {createStore} from 'nozuchi';
import type {Subscriber} from 'nozuchi';
import {Fragment, createElement, useEffect, useMemo} from 'react';
import type {BaseSyntheticEvent, ChangeEvent, ReactNode} from 'react';
import type {ZodIssue, ZodType, infer as zodInfer} from 'zod';

import {isChangeEvent, isThennable} from './utils';

export type StateRestriction = Record<string, unknown>;

type FormStatus = {
  isDirty: boolean;
  isValid: boolean;
};

type FormErrors<State extends StateRestriction> = {
  [k in keyof State]: string | null;
};

export type FullFormState<State extends StateRestriction> = FormStatus & {
  value: State;
  errors: FormErrors<State>;
};

export type HandleChangeAction<State extends StateRestriction, R = void> = <Name extends keyof State>(name: Name, value: State[Name]) => R;

export type FieldProps<State extends StateRestriction, Name extends keyof State> = {
  name: Name;
  children: (
    tool: {
      name: Name;
      value: State[Name];
      onChange(this: void, name: Name, value: State[Name]): void;
      onChange(this: void, e: ChangeEvent<HTMLElement>): void;
    },
    value: State[Name],
    errorMessage: string | null,
  ) => ReactNode;

  /**
   * Mayoiga Field will memoize the result of renderProps for performance.
   * If your renderProps depends on external variables, you should apply those on deps
   */
  deps?: ReadonlyArray<unknown>;
};

export type SliceProps<State extends StateRestriction, Selected extends ReadonlyArray<unknown>> = {
  selector: (s: FullFormState<State>) => Selected;
  children: (
    tool: {
      handleChange: HandleChangeAction<State>;
    },
    ...value: Readonly<Selected>
  ) => ReactNode;
  /**
   * Mayoiga Slicer will memoize the result of renderProps for performance.
   * If your renderProps depends on external variables, you should apply those on deps
   *
   * ```typescript
   * <Slicer selector={s => [s.value.selected]} deps={[selection]}>{(tools, selected: string) => <AwesomeSelection value={selected} options={selection} />}</Slicer>
   * ```
   */
  deps?: ReadonlyArray<unknown>;
};

type FormControllerBehavior<StateBeforeValidation extends StateRestriction> = {
  /** For testing */
  peek: (
    eyeball: (prev: FullFormState<StateBeforeValidation>) => void,
  ) => (prev: FullFormState<StateBeforeValidation>) => FullFormState<StateBeforeValidation>;

  reset: () => () => FullFormState<StateBeforeValidation>;

  /**
   * Initialize form state without validation.
   *
   * @param initialVal value to initialize form state
   * @param opts.cleanup if true, form state is become pristine (which means, `form.isDirty` is going to be false) .
   */
  initializeForm: (
    initialVal: Partial<StateBeforeValidation>,
    opts?: {
      cleanup?: true;
    },
  ) => (prev: FullFormState<StateBeforeValidation>) => FullFormState<StateBeforeValidation>;

  /**
   * Handle issue that zod reported
   */
  handleIssues: (issues: ReadonlyArray<ZodIssue>) => (prev: FullFormState<StateBeforeValidation>) => FullFormState<StateBeforeValidation>;

  /**
   * You can handle server side or other external error via this action.
   */
  pushFormErrors: (
    validator: (state: StateBeforeValidation) => Partial<FormErrors<StateBeforeValidation>>,
  ) => (prev: FullFormState<StateBeforeValidation>) => FullFormState<StateBeforeValidation>;

  reduceFormErrors: (
    reducer: (prev: FormErrors<StateBeforeValidation>) => FormErrors<StateBeforeValidation>,
  ) => (prev: FullFormState<StateBeforeValidation>) => FullFormState<StateBeforeValidation>;

  /**
   */
  handleChange: HandleChangeAction<
    StateBeforeValidation,
    (prev: FullFormState<StateBeforeValidation>) => FullFormState<StateBeforeValidation>
  >;

  reduceFormState: (
    reducer: (prevValue: StateBeforeValidation) => StateBeforeValidation,
  ) => (prev: FullFormState<StateBeforeValidation>) => FullFormState<StateBeforeValidation>;
  handleBulkChange: (
    setter: (prev: StateBeforeValidation) => Partial<StateBeforeValidation>,
  ) => (prev: FullFormState<StateBeforeValidation>) => FullFormState<StateBeforeValidation>;
};

const initialFormState = Object.freeze({
  isDirty: false,
  isValid: false,
});

function createFormStore<StateBeforeValidation extends StateRestriction, Schema extends ZodType<unknown>>(
  initialState: StateBeforeValidation,
  schema: Schema,
): Subscriber<FullFormState<StateBeforeValidation>, FormControllerBehavior<StateBeforeValidation>> {
  type FullState = FullFormState<StateBeforeValidation>;
  type Err = FormErrors<StateBeforeValidation>;
  type StateKeys = keyof StateBeforeValidation;

  const initialErrors = Object.freeze(
    Object.keys(initialState).reduce((buf, k) => {
      buf[k as StateKeys] = null;
      return buf;
    }, {} as Err),
  );

  const fullInitialState: FullState = Object.freeze({
    ...initialFormState,
    value: {...initialState},
    errors: {...initialErrors},
  });

  const withValidation = (prev: FullState, newValue: StateBeforeValidation) => {
    const result = schema.safeParse(newValue);
    if (result.success) {
      return {
        ...prev,
        isDirty: true,
        isValid: true,
        value: newValue,
        errors: initialErrors,
      };
    }
    const newErrors = result.error.issues.reduce((buf, iss) => {
      // TODO: should support nested value?
      const shallowPath = iss.path[0];
      if (shallowPath === undefined) {
        return buf;
      }
      buf[shallowPath as StateKeys] = iss.message;
      return buf;
    }, {} as Err);

    return {
      ...prev,
      isDirty: true,
      isValid: false,
      errors: newErrors,
      value: newValue,
    };
  };

  return createStore(fullInitialState, {
    peek: (eyeball) => (prev) => {
      eyeball(prev);
      return prev;
    },

    reset: () => () => fullInitialState,
    initializeForm: (initialVal, opts) => (prev) => ({
      ...prev,
      value: {
        ...prev.value,
        ...initialVal,
      },
      errors: {...initialErrors},
      isDirty: opts?.cleanup === true ? false : prev.isDirty,
    }),
    handleIssues: (issues) => (prev) => {
      // FIXME: handle duplication
      const newErrors = issues.reduce((buf, iss) => {
        const shallowPath = iss.path[0];
        if (shallowPath === undefined) {
          return buf;
        }
        buf[shallowPath as StateKeys] = iss.message;
        return buf;
      }, {} as Err);

      return {
        ...prev,
        isDirty: true,
        isValid: false,
        errors: newErrors,
      };
    },
    pushFormErrors: (validator) => (prev) => {
      const pushedErrors = validator(prev.value);
      const allErrors = {
        ...prev.errors,
        ...pushedErrors,
      };
      return {
        ...prev,
        isValid: Object.keys(allErrors).length === 0,
        errors: allErrors,
      };
    },
    reduceFormErrors: (reducer) => (prev) => {
      return {
        ...prev,
        errors: reducer(prev.errors),
      };
    },
    handleChange: (name, value) => (prev) => {
      if (name in prev.value === false) {
        return prev;
      }
      const newValue = {
        ...prev.value,
        [name]: value,
      };
      return withValidation(prev, newValue);
    },
    reduceFormState: (reducer) => (prev) => {
      const reducedState = reducer(prev.value);
      return withValidation(prev, reducedState);
    },
    handleBulkChange: (setter) => (prev) => {
      const mergedNewState = {
        ...prev.value,
        ...setter(prev.value),
      };
      return withValidation(prev, mergedNewState);
    },
  });
}

type ActionsCanBePublic<State extends StateRestriction> = {
  reset: VoidFunction;

  /**
   * Initialize form state without validation.
   *
   * @param initialVal value to initialize form state
   * @param opts.cleanup if true, form state is become pristine (which means, `form.isDirty` is going to be false) .
   */
  initializeForm: (
    initial: Partial<State>,
    opts?: {
      cleanup?: true;
    },
  ) => void;
  pushFormErrors: (validator: (state: State) => Partial<FormErrors<State>>) => void;
  handleChange: HandleChangeAction<State>;
  handleBulkChange: (setter: (prev: State) => Partial<State>) => void;
};

/**
 * Restricted type interface of the form store
 * TODO: more restriction
 */
export type Controller<State extends StateRestriction> = {
  useInitialize: (initialValue: Partial<State>) => void;
  useSelector: <R>(selector: (state: FullFormState<State>) => R, isEqual?: (prev: R, current: R) => boolean) => R;

  actions: ActionsCanBePublic<State>;
  components: {
    Field: <Name extends keyof State>(props: FieldProps<State, Name>) => ReactNode;
    Slicer: <Selected extends ReadonlyArray<unknown>>(props: SliceProps<State, Selected>) => ReactNode;
  };
};

type FormHook<State extends StateRestriction, Schema extends ZodType<unknown>> = {
  controller: Controller<State>;

  /**
   * @param handler handling logic
   * @returns created handler is always return Promise, because of the schema validation run it asynchronously.
   */
  handleSubmit: <R>(
    handler: (e: BaseSyntheticEvent) => (
      val:
        | {
            success: true;
            data: zodInfer<Schema>;
            error: undefined;
          }
        | {
            success: false;
            error: ReadonlyArray<ZodIssue>;
          },
    ) => R,
  ) => (e: BaseSyntheticEvent) => Promise<R>;

  api: Subscriber<FullFormState<State>, FormControllerBehavior<State>>;
} & Controller<State>;

/**
 * @typeParam InitialState should be shallow
 */
export function createFormHook<StateBeforeValidation extends StateRestriction, Schema extends ZodType<unknown>>(
  initialState: StateBeforeValidation,
  schema: Schema,
): FormHook<StateBeforeValidation, Schema> {
  const store = createFormStore(initialState, schema);

  const formHook = {
    useInitialize: (initialValue: Partial<StateBeforeValidation>) => {
      // biome-ignore lint/correctness/useExhaustiveDependencies: on init effect
      useEffect(() => {
        store.actions.initializeForm(initialValue);
      }, []);
    },
    useSelector: store.useSelector,
    handleSubmit: <R>(
      handler: (e: BaseSyntheticEvent) => (
        val:
          | {
              success: true;
              data: zodInfer<Schema>;
              error: undefined;
            }
          | {
              success: false;
              error: ReadonlyArray<ZodIssue>;
            },
      ) => R | Promise<R>,
    ) => {
      return (e: BaseSyntheticEvent) => {
        const eventHandled = handler(e);
        const value = store.getState().value;
        return schema.safeParseAsync(value).then((result) => {
          if (result.success) {
            return eventHandled({
              success: true,
              data: result.data,
              error: undefined,
            });
          }

          const handled = eventHandled({
            success: false,
            error: result.error.issues,
          });
          if (isThennable<R>(handled)) {
            return handled.then((x) => {
              store.actions.handleIssues(result.error.issues);
              return x;
            });
          }
          store.actions.handleIssues(result.error.issues);
          return handled;
        });
      };
    },

    components: {
      Slicer<R extends ReadonlyArray<unknown>>(props: SliceProps<StateBeforeValidation, R>) {
        const {selector, children, deps} = props;
        const slicedValues = formHook.useSelector(selector);
        // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
        return useMemo(
          () => {
            const renderContent = children(
              {
                handleChange: formHook.actions.handleChange,
              },
              ...slicedValues,
            );
            return createElement(Fragment, {}, renderContent);
          },
          deps ? [...slicedValues, ...deps] : slicedValues,
        );
      },
      Field<Name extends keyof StateBeforeValidation>(props: FieldProps<StateBeforeValidation, Name>) {
        const {name, children, deps} = props;
        const [value, errMsg] = store.useSelector((s) => [s.value[name], s.errors[name]] as const);
        // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
        return useMemo(
          () => {
            const renderContent = children(
              {
                name,
                value,
                onChange: (name_or_event: unknown, value_or_none?: unknown) => {
                  if (typeof name_or_event === 'string') {
                    // assumes name is valid if it's string
                    // biome-ignore lint/suspicious/noExplicitAny: has to be safe
                    return store.actions.handleChange(name_or_event as Name, value_or_none as any);
                  }
                  if (isChangeEvent(name_or_event)) {
                    const target = name_or_event.currentTarget || name_or_event.target;
                    // biome-ignore lint/suspicious/noExplicitAny: FIXME
                    return store.actions.handleChange(target.name, (target as any).value);
                  }
                  throw new Error('`handleChange` handles unexpected formed object.');
                },
              },
              value,
              errMsg,
            );
            return createElement(Fragment, {}, renderContent);
          },
          deps ? [value, errMsg, ...deps] : [value, errMsg],
        );
      },
    },
    actions: store.actions,
  };

  return {
    controller: formHook,
    api: store,
    ...formHook,
  };
}

export function useFormSlice<State extends StateRestriction, Sliced>(
  formController: Controller<State>,
  selector: (s: FullFormState<State>) => Sliced,
) {
  const sliced = formController.useSelector((s) => selector(s));
  return [sliced, formController.actions] as const;
}
