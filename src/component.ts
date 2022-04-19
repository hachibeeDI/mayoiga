import {useMemo} from 'react';

import type {StateRestriction, HandleChangeAction, Controller, FullFormState} from './index';
import type {ChangeEvent} from 'react';

type SlicerProps<State extends StateRestriction, R extends ReadonlyArray<unknown>, Children> = {
  controller: Controller<State>;
  selector: (s: FullFormState<State>) => R;
  children: (tool: {handleChange: HandleChangeAction<State>}, ...sliced: Readonly<R>) => Children;
};

export function Slicer<State extends StateRestriction, R extends ReadonlyArray<unknown>, Children>(props: SlicerProps<State, R, Children>) {
  const {controller, selector, children} = props;
  const sliced = controller.useSelector(selector);
  return useMemo(() => children({handleChange: controller.actions.handleChange}, ...sliced), sliced);
}

function isChangeEvent<T>(x: any): x is ChangeEvent<T> {
  if (typeof x !== 'object') {
    return false;
  }
  return 'target' in x;
}

export function Field<State extends StateRestriction, Name extends keyof State, Children>(props: {
  controller: Controller<State>;
  name: Name;
  children: (
    tool: {
      name: Name;
      value: State[Name];
      onChange(name: Name, value: State[Name]): void;
      onChange(e: ChangeEvent<HTMLElement>): void;
    },
    value: State[Name],
    errorMessage: string | null,
  ) => Children;
}) {
  const {controller, name, children} = props;
  const [value, errMsg] = controller.useSelector((s) => [s.value[name], s.errors[name]] as const);
  return useMemo(
    () =>
      children(
        {
          name,
          value,
          onChange: (e_or_name, value_or_none?) => {
            if (isChangeEvent(e_or_name)) {
              return controller.actions.handleChange(
                name,
                // TODO: Checkbox
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                (e_or_name.currentTarget as any)?.value,
              );
            }
            controller.actions.handleChange(e_or_name, value_or_none as State[Name]);
          },
        },
        value,
        errMsg,
      ),
    [value, errMsg],
  );
}
