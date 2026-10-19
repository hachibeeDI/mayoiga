import {expectTypeOf, test} from 'vitest';
import * as zod from 'zod';

import {Field, Slicer} from './component';
import {createFormHook, useFormSlice} from './index';
import type {Controller, FullFormState} from './index';

/**
 * Type-level contract of the public API.
 *
 * `expectTypeOf` assertions are no-ops at runtime; they fail under
 * `tsc --noEmit` (check:type), as do the `@ts-expect-error` lines when the
 * line below them unexpectedly compiles.
 */

const schema = zod.object({
  name: zod.string(),
  age: zod.string().transform((v) => Number(v)),
  marked: zod.literal(true),
});

const form = createFormHook({name: '', age: '', marked: false as boolean}, schema);

test('handleChange constrains the value type by the field name', () => {
  form.actions.handleChange('name', 'ok');
  form.actions.handleChange('marked', true);

  // @ts-expect-error value type must match the field type
  form.actions.handleChange('name', 1);
  // @ts-expect-error unknown field name
  form.actions.handleChange('doesNotExist', 'x');
});

test('handleSubmit data is the post-validation (transformed) type', () => {
  form.handleSubmit(() => (result) => {
    if (result.success) {
      expectTypeOf(result.data).toEqualTypeOf<{name: string; age: number; marked: true}>();
      expectTypeOf(result.error).toEqualTypeOf<undefined>();
    } else {
      expectTypeOf(result.success).toEqualTypeOf<false>();
      expectTypeOf(result.error).toExtend<ReadonlyArray<{path: ReadonlyArray<PropertyKey>; message: string}>>();
    }
  });

  const submit = form.handleSubmit(() => () => 42);
  expectTypeOf(submit).returns.toEqualTypeOf<Promise<number>>();

  // An async handler is flattened at runtime. The static return type is
  // Promise<Promise<string>> because R is inferred as Promise<string>, which
  // awaits to the same value, so the contract is checked through Awaited.
  const asyncSubmit = form.handleSubmit(() => async () => 'done');
  expectTypeOf<Awaited<ReturnType<typeof asyncSubmit>>>().toEqualTypeOf<string>();
});

test('useSelector infers the selected type and FullFormState exposes value/errors/status', () => {
  function Component() {
    const age = form.useSelector((s) => s.value.age);
    expectTypeOf(age).toEqualTypeOf<string>();

    const err = form.useSelector((s) => s.errors.marked);
    expectTypeOf(err).toEqualTypeOf<string | null>();

    const [slice, actions] = useFormSlice(form.controller, (s) => [s.isDirty, s.isValid] as const);
    expectTypeOf(slice).toEqualTypeOf<readonly [boolean, boolean]>();
    expectTypeOf(actions).toEqualTypeOf<typeof form.actions>();
    return null;
  }
  expectTypeOf(Component).returns.toEqualTypeOf<null>();

  expectTypeOf<FullFormState<{a: number}>['errors']>().toEqualTypeOf<{a: string | null}>();
  expectTypeOf<FullFormState<{a: number}>>().toExtend<{isDirty: boolean; isValid: boolean; value: {a: number}}>();
});

test('Field and Slicer render props receive values typed from the state', () => {
  const field = (
    <Field controller={form.controller} name="age">
      {(tool, value, errorMessage) => {
        expectTypeOf(tool.name).toEqualTypeOf<'age'>();
        expectTypeOf(tool.value).toEqualTypeOf<string>();
        expectTypeOf(value).toEqualTypeOf<string>();
        expectTypeOf(errorMessage).toEqualTypeOf<string | null>();
        tool.onChange('age', 'typed');
        // @ts-expect-error onChange(name, value) must match the field type
        tool.onChange('age', 1);
        return null;
      }}
    </Field>
  );
  expectTypeOf(field).not.toBeAny();

  const unknownField = {controller: form.controller, name: 'nope', children: () => null} as const;
  // @ts-expect-error `name` must be a key of the form state
  const invalid = <Field {...unknownField} />;
  expectTypeOf(invalid).not.toBeAny();

  const slicer = (
    <Slicer controller={form.controller} selector={(s) => [s.value.name, s.value.marked] as const}>
      {(tool, name, marked) => {
        expectTypeOf(name).toEqualTypeOf<string>();
        expectTypeOf(marked).toEqualTypeOf<boolean>();
        expectTypeOf(tool.handleChange).toEqualTypeOf<typeof form.actions.handleChange>();
        return null;
      }}
    </Slicer>
  );
  expectTypeOf(slicer).not.toBeAny();
});

test('a controller can be narrowed to the subset of state a reusable component needs', () => {
  const narrow: Controller<{age: string}> = form.controller;
  expectTypeOf(narrow.actions.handleChange).parameter(0).toEqualTypeOf<'age'>();

  // @ts-expect-error the form has no `missing` field, so it cannot satisfy this controller shape
  const mismatch: Controller<{missing: number}> = form.controller;
  expectTypeOf(mismatch).not.toBeAny();
});
