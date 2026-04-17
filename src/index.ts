import {createStore} from 'nozuchi';
import type {Subscriber} from 'nozuchi';
import {Fragment, createElement, useEffect, useMemo} from 'react';
import type {BaseSyntheticEvent, ChangeEvent, ReactNode} from 'react';
import type {ZodIssue, ZodType, infer as zodInfer} from 'zod';

import {isChangeEvent, isThennable} from './utils';

/**
 * Base constraint for any form state shape handled by Mayoiga.
 *
 * State is expected to be a flat (shallow) record. Nested objects are not traversed
 * by the built-in change/validation machinery.
 */
export type StateRestriction = Record<string, unknown>;

type FormStatus = {
  isDirty: boolean;
  isValid: boolean;
};

type FormErrors<State extends StateRestriction> = {
  [k in keyof State]: string | null;
};

/**
 * Complete snapshot of a form: the current values, per-field error messages,
 * and top-level status flags.
 *
 * @typeParam State - the pre-validation shape of the form
 */
export type FullFormState<State extends StateRestriction> = FormStatus & {
  value: State;
  errors: FormErrors<State>;
};

/**
 * Signature of the handler used to update a single field value.
 *
 * `Name` is constrained to keys of the state so the value type is inferred
 * from the field being written — invalid field/value pairs fail to type-check.
 *
 * @typeParam State - pre-validation form state
 * @typeParam R - return type of the handler (defaults to `void`; internal
 *   reducer variants return the next form state)
 */
export type HandleChangeAction<State extends StateRestriction, R = void> = <Name extends keyof State>(name: Name, value: State[Name]) => R;

/**
 * Props for the `<Field>` render-prop component.
 *
 * The `children` callback is called with a pre-wired `tool` object (so most inputs
 * can simply spread it: `<input {...tool} />`), the current value, and the current
 * error message for the field. `onChange` is overloaded to accept either a
 * DOM `ChangeEvent` or an explicit `(name, value)` pair — the latter is useful
 * for non-DOM inputs or typed values that do not serialize to strings.
 *
 * @typeParam State - pre-validation form state
 * @typeParam Name - the key of the field being rendered
 */
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

/**
 * Props for the `<Slicer>` render-prop component.
 *
 * Unlike `<Field>`, `<Slicer>` subscribes to an arbitrary derivation of the form
 * state (via `selector`) and only re-renders when the selected tuple changes.
 * Use this when you need to project multiple fields or computed values at once.
 *
 * @typeParam State - pre-validation form state
 * @typeParam Selected - tuple of values returned by the selector
 */
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
    const newErrors = result.error.issues.reduce(
      (buf, iss) => {
        // TODO: should support nested value?
        const shallowPath = iss.path[0];
        if (shallowPath === undefined) {
          return buf;
        }
        buf[shallowPath as StateKeys] = iss.message;
        return buf;
      },
      {...initialErrors} as Err,
    );

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
      const newErrors = issues.reduce(
        (buf, iss) => {
          const shallowPath = iss.path[0];
          if (shallowPath === undefined) {
            return buf;
          }
          buf[shallowPath as StateKeys] = iss.message;
          return buf;
        },
        {...initialErrors} as Err,
      );

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
        isValid: Object.values(allErrors).every((v) => v == null),
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

/**
 * The subset of store actions that are safe to call from application code.
 *
 * Internal reducers are hidden behind this narrower type so consumers only see
 * effects (returning `void`) rather than the underlying reducer functions.
 */
type ActionsCanBePublic<State extends StateRestriction> = {
  /** Reset the form back to its original initial state and clear all errors. */
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
  /**
   * Merge external errors (e.g. server-side validation results) into the form.
   *
   * The validator receives the current value and returns a partial error map;
   * unspecified fields keep their existing error. `isValid` is recomputed from
   * the merged result.
   */
  pushFormErrors: (validator: (state: State) => Partial<FormErrors<State>>) => void;
  /** Update a single field. Triggers schema validation on the next state. */
  handleChange: HandleChangeAction<State>;
  /**
   * Update multiple fields in one commit.
   *
   * The setter receives the current value and returns a partial patch that is
   * merged shallowly before validation runs once over the result.
   */
  handleBulkChange: (setter: (prev: State) => Partial<State>) => void;
};

/**
 * Narrowed public view of a form store.
 *
 * Passing a `Controller` (rather than the full form hook) to reusable components
 * is the recommended way to keep them decoupled from the concrete form instance.
 * See `useFormSlice` and the `<Field>` / `<Slicer>` components in `./component`
 * for consumers of this shape.
 *
 * TODO: more restriction
 */
export type Controller<State extends StateRestriction> = {
  /**
   * Effect hook that seeds the form with `initialValue` on mount.
   * Intended to be called once per form instance at the top of a component.
   */
  useInitialize: (initialValue: Partial<State>) => void;
  /**
   * Subscribe to a derived slice of form state. The component re-renders only
   * when the selected value changes according to `isEqual` (defaults to
   * reference equality, as provided by the underlying store).
   */
  useSelector: <R>(selector: (state: FullFormState<State>) => R, isEqual?: (prev: R, current: R) => boolean) => R;

  actions: ActionsCanBePublic<State>;
  components: {
    Field: <Name extends keyof State>(props: FieldProps<State, Name>) => ReactNode;
    Slicer: <Selected extends ReadonlyArray<unknown>>(props: SliceProps<State, Selected>) => ReactNode;
  };
};

/**
 * The full return value of {@link createFormHook}.
 *
 * Embeds a {@link Controller} for sharing with child components, plus the
 * top-level `handleSubmit` helper and the raw store `api` for advanced use
 * cases (e.g. reading state outside React, composing with other stores).
 *
 * For convenience the controller members are also spread onto the root, so
 * `form.useSelector(...)` and `form.controller.useSelector(...)` behave
 * identically.
 */
type FormHook<State extends StateRestriction, Schema extends ZodType<unknown>> = {
  controller: Controller<State>;

  /**
   * Build a submit handler that runs schema validation before invoking
   * the user-supplied logic.
   *
   * The outer callback receives the DOM event so the caller can call
   * `e.preventDefault()` or inspect it before validation; the inner callback
   * then receives a discriminated result with either the parsed data (on
   * success) or the collected Zod issues (on failure). On failure the issues
   * are also pushed into form errors so fields light up automatically.
   *
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

  /**
   * Low-level handle to the underlying store (from `nozuchi`).
   *
   * Exposed for advanced integrations — reading/writing state outside React,
   * subscribing imperatively, or composing this form with other stores.
   * Prefer the hook-based API (`useSelector`, `actions`, `components`) for
   * ordinary component code.
   */
  api: Subscriber<FullFormState<State>, FormControllerBehavior<State>>;
} & Controller<State>;

/**
 * Create a self-contained form instance backed by a Zod schema.
 *
 * Mayoiga keeps two distinct state types in mind:
 *
 * 1. the **pre-validation** shape (what the UI edits, typically loose — nullable
 *    fields, string inputs for numbers, etc.), inferred from `initialState`.
 * 2. the **post-validation** shape, inferred from `schema` and surfaced through
 *    `handleSubmit`. Zod transforms (e.g. `z.string().transform(Number)`) apply
 *    here, so `data` in the submit callback can have a narrower/coerced type
 *    than the editable state.
 *
 * The returned object exposes hooks (`useSelector`, `useInitialize`), actions
 * (`handleChange`, `reset`, …), render-prop components (`Field`, `Slicer`),
 * a `handleSubmit` builder, and the raw store `api` for advanced use.
 *
 * @param initialState - default values for every field; shape drives the
 *   pre-validation type inference
 * @param schema - Zod schema used for field-level and submit-time validation
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
          // biome-ignore lint/correctness/useExhaustiveDependencies: deps array is conditionally spread; Biome cannot statically verify it.
          deps ? [...slicedValues, ...deps] : slicedValues,
        );
      },
      Field<Name extends keyof StateBeforeValidation>(props: FieldProps<StateBeforeValidation, Name>) {
        const {name, children, deps} = props;
        const [value, errMsg] = store.useSelector((s) => [s.value[name], s.errors[name]] as const);
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
          // biome-ignore lint/correctness/useExhaustiveDependencies: deps array is conditionally spread; Biome cannot statically verify it.
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

/**
 * Convenience hook that reads a derived slice of state and returns it alongside
 * the controller's actions — mirroring the `[state, dispatch]` shape familiar
 * from `useReducer`.
 *
 * Prefer this over calling `useSelector` and pulling `actions` separately when
 * a component consumes both in the same render.
 *
 * @param formController - the controller obtained from {@link createFormHook}
 *   (or passed down as a prop)
 * @param selector - projection function from full form state to the needed slice
 * @returns a tuple of `[slicedValue, actions]`
 */
export function useFormSlice<State extends StateRestriction, Sliced>(
  formController: Controller<State>,
  selector: (s: FullFormState<State>) => Sliced,
) {
  const sliced = formController.useSelector((s) => selector(s));
  return [sliced, formController.actions] as const;
}
