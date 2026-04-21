import type {SliceProps, FieldProps, StateRestriction, Controller} from './index';

type ControlledComponentProps<State extends StateRestriction, Props> = Props & {
  controller: Controller<State>;
};

/**
 * Controller-driven variant of `<Slicer>` for reusable components.
 *
 * Functionally identical to `controller.components.Slicer`, but accepts the
 * `controller` as a prop rather than being bound to a single form instance.
 * Use this when you want to author a shared component (a date range picker,
 * a multi-step section, etc.) that works against any form whose state satisfies
 * its required shape.
 */
export function Slicer<State extends StateRestriction, R extends ReadonlyArray<unknown>>(
  props: ControlledComponentProps<State, SliceProps<State, R>>,
) {
  const {controller, ...restProps} = props;
  const {Slicer: Delegate} = controller.components;
  return <Delegate {...restProps} />;
}

/**
 * Controller-driven variant of `<Field>` for reusable components.
 *
 * Functionally identical to `controller.components.Field`, but accepts the
 * `controller` as a prop so it can be rendered against any compatible form.
 * The `name` prop is still constrained to keys of the controller's state,
 * preserving end-to-end type safety.
 */
export function Field<State extends StateRestriction, Name extends keyof State>(
  props: ControlledComponentProps<State, FieldProps<State, Name>>,
) {
  const {controller, ...restProps} = props;
  const {Field: Delegate} = controller.components;
  return <Delegate {...restProps} />;
}
