import {screen} from '@testing-library/dom';
import {render} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, {act} from 'react';

import {test, expect} from 'vitest';

import * as zod from 'zod';

import {Field, Slicer} from './component';

import {createFormHook} from './index';

import type {Controller} from './index';

const testSchema = zod.object({
  name: zod.string(),
  description: zod.string(),
  age: zod
    .string()
    .transform((val) => Number(val))
    .refine((val) => (Number.isNaN(val) ? 0 : val)),
  marked: zod.boolean(),
});

// every fields are optional for test
type FormStateBeforeValidation = {
  name: string;
  description: string;
  age: string;
  marked: boolean;
};

const createTestHook = () =>
  createFormHook(
    {
      name: '',
      description: '',
      age: '',
      marked: false,
    } as FormStateBeforeValidation,
    testSchema,
  );

// afterEach(cleanup);

test('Field component works fine in basic usage.', async () => {
  const TestFormHook = createTestHook();

  const Top = () => {
    return (
      <div>
        <Field controller={TestFormHook.controller} name="age">
          {(tool) => <input data-testid="age-input" {...tool} />}
        </Field>
      </div>
    );
  };

  render(<Top />);

  const INPUT_AGE = '42';

  // calling `userEvent` in here will cause race condition...
  await userEvent.type(screen.getByTestId('age-input'), INPUT_AGE);

  await act(() => {
    const ageInput: HTMLInputElement = screen.getByTestId('age-input');
    expect(ageInput.value).toBe(INPUT_AGE);
    TestFormHook.api.actions.peek((s) => {
      expect(s.value.age).toBe(INPUT_AGE);
      expect(s.errors.age).toBeNull();
    });
  });
});

test('Slice component works fine in basic usage.', async () => {
  const TestFormHook = createTestHook();

  const Top = () => {
    return (
      <div>
        <Slicer controller={TestFormHook.controller} selector={(s) => [s.value.age] as const}>
          {(tool, age: string) => (
            <input data-testid="age-input" name="age" value={age} onChange={(e) => tool.handleChange('age' as const, e.target.value)} />
          )}
        </Slicer>
      </div>
    );
  };

  render(<Top />);

  const INPUT_AGE = '42';

  // calling `userEvent` in here will cause race condition...
  await userEvent.type(screen.getByTestId('age-input'), INPUT_AGE);

  await act(() => {
    const ageInput: HTMLInputElement = screen.getByTestId('age-input');
    expect(ageInput.value).toBe(INPUT_AGE);
    TestFormHook.api.actions.peek((s) => {
      expect(s.value.age).toBe(INPUT_AGE);
      expect(s.errors.age).toBeNull();
    });
  });
});

test('A user able to create a reusable component', async () => {
  const TestFormHook = createTestHook();

  function NarrowTypedExpected(props: {
    controller: Controller<{
      age: string;
    }>;
  }) {
    return (
      <Field controller={props.controller} name="age">
        {(tool) => <input data-testid="age-input" {...tool} />}
      </Field>
    );
  }

  function ErrorDisplayer(props: {
    controller: Controller<{
      age: string;
    }>;
  }) {
    const {controller} = props;
    return (
      <Slicer controller={controller} selector={(s) => [s.value.age] as const}>
        {(tool, age: string) => (
          <button
            onClick={(e) => {
              controller.actions.pushFormErrors((_state) => ({
                age: age === '42' ? 'yes!!!' : 'noooo',
              }));
            }}
          />
        )}
      </Slicer>
    );
  }

  render(
    <div>
      <NarrowTypedExpected controller={TestFormHook.controller} />
      <ErrorDisplayer controller={TestFormHook.controller} />
    </div>,
  );

  const INPUT_AGE = '42';

  // calling `userEvent` in here will cause race condition...
  await userEvent.type(screen.getByTestId('age-input'), INPUT_AGE);
  await userEvent.click(screen.getByRole('button'));

  await act(() => {
    const ageInput: HTMLInputElement = screen.getByTestId('age-input');
    expect(ageInput.value).toBe(INPUT_AGE);
    TestFormHook.api.actions.peek((s) => {
      expect(s.value.age).toBe(INPUT_AGE);
      expect(s.errors.age).toBe('yes!!!');
    });
  });
});

test('`deps` field could destruct memoization', async () => {
  const TestFormHook = createTestHook();
  // intentional sample to replicate the situation
  const OtherFormHook = createFormHook(
    {minAge: '30'},
    zod.object({
      minAge: zod.string(),
    }),
  );

  const DATA_ID_RE_RENDER_BY_DEPS = 'refresh-by-deps';
  const DATA_ID_NOT_RERENDER_NO_DEPS = 'no-refersh-no-deps';

  function App() {
    const minAge = OtherFormHook.useSelector((s) => Number(s.value.minAge));

    return (
      <div>
        <Field controller={OtherFormHook.controller} name="minAge">
          {(tool) => <input data-testid="minAgeInput" type="number" {...tool} />}
        </Field>
        <Field controller={TestFormHook.controller} name="age">
          {(tool) => <input data-testid="ageInput" type="number" {...tool} />}
        </Field>
        <Slicer controller={TestFormHook.controller} selector={(s) => [Number(s.value.age)]} deps={[minAge]}>
          {(_tool, age: number) => (
            <div data-testid={DATA_ID_RE_RENDER_BY_DEPS}>{age >= minAge ? 'You can buy this content' : 'go home'}</div>
          )}
        </Slicer>
        <Slicer controller={TestFormHook.controller} selector={(s) => [Number(s.value.age)]}>
          {(_tool, age: number) => (
            <div data-testid={DATA_ID_NOT_RERENDER_NO_DEPS}>{age >= minAge ? 'You can buy this content' : 'go home'}</div>
          )}
        </Slicer>
      </div>
    );
  }

  render(<App />);

  await userEvent.type(screen.getByTestId('ageInput'), '16');

  await act(() => {
    expect(screen.getByTestId(DATA_ID_RE_RENDER_BY_DEPS).textContent).toBe('go home');
    // expect(await screen.findByText('You can buy this content')).toBeDefined();
  });

  await userEvent.clear(screen.getByTestId('minAgeInput'));
  await userEvent.type(screen.getByTestId('minAgeInput'), '10');

  await act(() => {
    expect(screen.getByTestId(DATA_ID_RE_RENDER_BY_DEPS).textContent, 'Slicer should re-execute renderProps if `deps` are changed').toBe(
      'You can buy this content',
    );
  });
  await act(() => {
    expect(
      screen.getByTestId(DATA_ID_NOT_RERENDER_NO_DEPS).textContent,
      'Same logic but would not refresh because external dependencies are not applied',
    ).toBe('go home');
  });
});
