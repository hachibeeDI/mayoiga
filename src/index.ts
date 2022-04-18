import {useEffect, useMemo} from 'react';
import type {BaseSyntheticEvent, ChangeEvent, ChangeEventHandler} from 'react';

import type {infer as zodInfer, SafeParseReturnType, ZodIssue, ZodType} from 'zod';
import {createStore} from 'nozuchi';
import type {Subscriber} from 'nozuchi';


export type StateRestriction = Record<string, any>;

type FormStatus = {
  isDirty: boolean;
  isValid: boolean;
};

type FormErrors<State extends StateRestriction> = {
  [k in keyof State]: string | null;
};

export type FullFormState<State extends StateRestriction> = FormStatus & {value: State; errors: FormErrors<State>};

export type HandleChangeAction<State extends StateRestriction> = <Name extends keyof State>(name: Name, value: State[Name]) => void;

type SliceProps<State extends StateRestriction, R extends ReadonlyArray<unknown>, Children> = {
  selector: (s: FullFormState<State>) => R;
  children: (tool: {handleChange: HandleChangeAction<State>}, ...value: Readonly<R>) => Children;
};

type FormControllerBehavior<StateBeforeValidation> = {
  /** For testing */
  peek: (eyeball: (prev: FullFormState<StateBeforeValidation>) => void) => (prev: FullFormState<StateBeforeValidation>) => FullFormState<StateBeforeValidation>;

  reset: () => () => FullFormState<StateBeforeValidation>;
  init: (
    initialVal: Partial<StateBeforeValidation>,
  ) => (prev: FullFormState<StateBeforeValidation>) => FullFormState<StateBeforeValidation>;
  handleIssues: (issues: ReadonlyArray<ZodIssue>) => (prev: FullFormState<StateBeforeValidation>) => FullFormState<StateBeforeValidation>;
  handleChange: <Name extends keyof StateBeforeValidation>(
    name: Name,
    value: StateBeforeValidation[Name],
  ) => (prev: FullFormState<StateBeforeValidation>) => FullFormState<StateBeforeValidation>;
  reduceFormState: (
    reducer: (prevValue: StateBeforeValidation) => StateBeforeValidation,
  ) => (prev: FullFormState<StateBeforeValidation>) => FullFormState<StateBeforeValidation>;
  handleBulkChange: (
    setter: (prev: StateBeforeValidation) => Partial<StateBeforeValidation>,
  ) => (prev: FullFormState<StateBeforeValidation>) => FullFormState<StateBeforeValidation>;
};

const initialFormState = Object.freeze({isDirty: false, isValid: false});

function createFormStore<StateBeforeValidation extends StateRestriction, Schema extends ZodType<any, any, any>>(
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
    }, {} as any as Err),
  );

  const fullInitialState: FullState = Object.freeze({
    ...initialFormState,
    value: {...initialState},
    errors: {...initialErrors},
  });

  const withValidation = (prev: FullState, newValue: StateBeforeValidation) => {
    const result = schema.safeParse(newValue);
    if (result.success) {
      return {...prev, isDirty: true, isValid: true, value: newValue, errors: initialErrors};
    }
    const newErrors = result.error.issues.reduce((buf, iss) => {
      // TODO: should support nested value?
      const shallowPath = iss.path[0];
      if (shallowPath === undefined) {
        return buf;
      }
      buf[shallowPath as any as StateKeys] = iss.message;
      return buf;
    }, {} as any as Err);

    return {...prev, isDirty: true, isValid: false, errors: newErrors, value: newValue};
  };

  return createStore(fullInitialState, {
    peek: (eyeball) => (prev) => {
      eyeball(prev);
      return prev;
    },

    reset: () => () => fullInitialState,
    init: (initialVal) => (prev) => ({
      ...prev,
      value: {...prev.value, ...initialVal},
      errors: {...initialErrors},
    }),
    handleIssues: (issues) => (prev) => {
      // FIXME: handle duplication
      const newErrors = issues.reduce((buf, iss) => {
        const shallowPath = iss.path[0];
        if (shallowPath === undefined) {
          return buf;
        }
        buf[shallowPath as any as StateKeys] = iss.message;
        return buf;
      }, {} as any as Err);

      return {...prev, isDirty: true, isValid: false, errors: newErrors};
    },
    handleChange:
      <Name extends keyof StateBeforeValidation>(name: Name, value: StateBeforeValidation[Name]) =>
      (prev: FullState) => {
        const newValue = {...prev.value, [name]: value};
        return withValidation(prev, newValue);
      },
    reduceFormState: (reducer) => (prev) => {
      const reducedState = reducer(prev.value);
      return withValidation(prev, reducedState);
    },
    handleBulkChange: (setter) => (prev) => {
      const mergedNewState = {...prev.value, ...setter(prev.value)};
      return withValidation(prev, mergedNewState);
    },
  });
}

/**
 * @typeParam InitialState should be shallow
 */
export function createFormHook<StateBeforeValidation, Schema extends ZodType<any, any, any>>(
  initialState: StateBeforeValidation,
  schema: Schema,
) {
  const store = createFormStore(initialState, schema);

  /**
   * これより型安全を捨てる！！
   */
  function defaultChangeHandler(e: ChangeEvent<HTMLElement>, none: undefined): void;
  function defaultChangeHandler(name: keyof StateBeforeValidation, value: StateBeforeValidation[keyof StateBeforeValidation]): void;
  function defaultChangeHandler(x: any, y: any) {
    if (x in initialState) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      store.actions.handleChange(x, y);
      return;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const target = x.currentTarget;
      // TODO: checkbox
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      store.actions.handleChange(target.name, target.value);
    }
  }

  function Field<Name extends keyof StateBeforeValidation, Children>(props: {
    name: Name;
    children: (
      tool: {name: Name; onChange: ChangeEventHandler<HTMLElement>},
      value: StateBeforeValidation[Name],
      errorMessage: string | null,
    ) => Children;
  }) {
    const {name, children} = props;
    const [value, errMsg] = store.useSelector((s) => [s.value[name], s.errors[name]] as const);
    return useMemo(() => children({name, onChange: defaultChangeHandler as any}, value, errMsg), [value, errMsg]);
  }

  function Slicer<R extends ReadonlyArray<unknown>, Children>(props: SliceProps<StateBeforeValidation, R, Children>) {
    const {selector, children} = props;
    const value = store.useSelector(selector);
    return useMemo(() => children({handleChange: store.actions.handleChange}, ...value), value);
  }

  const handleSubmit = (handler: (e: BaseSyntheticEvent) => (val: {success: true, data: zodInfer<Schema>} | {success: false, err: readonly ZodIssue[]}) => void | Promise<void>) => {
    return (e: BaseSyntheticEvent) => {
      const eventHandled = handler(e);
      const value = store.getState().value;
      return schema.safeParseAsync(value).then((result: SafeParseReturnType<StateBeforeValidation, zodInfer<typeof schema>>) => {
        if (result.success) {
          // FIXME: why zod does not provide a type info?
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          return eventHandled({success: true, data: result.data});
        }
        eventHandled({success: false, err: result.error.issues});
        store.actions.handleIssues(result.error.issues);
      });
    };
  };

  return {
    controller: store as Controller<StateBeforeValidation>,
    useInitialize: (initialValue: Partial<StateBeforeValidation>) => {
      useEffect(() => {
        store.actions.init(initialValue);
      }, []);
    },
    useSelector: store.useSelector,
    Field,
    Slicer,
    handleSubmit,
    actions: store.actions,
  };
}

/**
 * A one variation of from store
 */
export type Controller<State extends StateRestriction> = {
  useSelector: <R>(selector: (state: FullFormState<State>) => R, isEqual?: (prev: R, current: R) => boolean) => R;
  actions: {
    handleChange: <Name extends keyof State>(name: Name, value: State[Name]) => void;
    handleBulkChange: (setter: (prev: State) => Partial<State>) => void;
  };
};

export function useFormSlice<State extends StateRestriction, Sliced>(
  formController: Controller<State>,
  selector: (s: FullFormState<State>) => Sliced,
) {
  const sliced = formController.useSelector((s) => selector(s));
  return [sliced, formController.actions] as const;
}
