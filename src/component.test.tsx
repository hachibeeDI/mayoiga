import {expect, test, vi} from 'vitest';

import {screen} from '@testing-library/dom';
import {render} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {act, useState} from 'react';
import * as zod from 'zod';

import {Field, Slicer} from './component';
import {createFormHook} from './index';
import {createTestHook} from './test-fixture';
import type {Controller} from './index';

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
  await userEvent.type(screen.getByTestId('age-input'), INPUT_AGE);

  const ageInput: HTMLInputElement = screen.getByTestId('age-input');
  expect(ageInput.value).toBe(INPUT_AGE);
  const state = TestFormHook.api.getState();
  expect(state.value.age).toBe(INPUT_AGE);
  expect(state.errors.age).toBeNull();
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
  await userEvent.type(screen.getByTestId('age-input'), INPUT_AGE);

  const ageInput: HTMLInputElement = screen.getByTestId('age-input');
  expect(ageInput.value).toBe(INPUT_AGE);
  const state = TestFormHook.api.getState();
  expect(state.value.age).toBe(INPUT_AGE);
  expect(state.errors.age).toBeNull();
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
        {(_tool, age: string) => (
          <button
            type="button"
            onClick={(_e) => {
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
  await userEvent.type(screen.getByTestId('age-input'), INPUT_AGE);
  await userEvent.click(screen.getByRole('button'));

  const ageInput: HTMLInputElement = screen.getByTestId('age-input');
  expect(ageInput.value).toBe(INPUT_AGE);
  const state = TestFormHook.api.getState();
  expect(state.value.age).toBe(INPUT_AGE);
  expect(state.errors.age).toBe('yes!!!');
});

test('Field onChange throws when called with neither a string name nor a ChangeEvent', () => {
  const TestFormHook = createTestHook();
  let captured: ((x: unknown) => void) | undefined;

  const Top = () => (
    <Field controller={TestFormHook.controller} name="age">
      {(tool) => {
        // Capture the overloaded onChange so we can invoke it with an
        // unexpected argument shape outside of React's render cycle.
        captured = tool.onChange as unknown as (x: unknown) => void;
        return <input data-testid="age-input" {...tool} />;
      }}
    </Field>
  );
  render(<Top />);

  expect(captured).toBeDefined();
  // A number is neither a string (name path) nor an object with `target`
  // (ChangeEvent path), so the onChange must fall through to the throw.
  expect(() => captured?.(42)).toThrow('`handleChange` handles unexpected formed object.');
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
  expect(screen.getByTestId(DATA_ID_RE_RENDER_BY_DEPS).textContent).toBe('go home');

  await userEvent.clear(screen.getByTestId('minAgeInput'));
  await userEvent.type(screen.getByTestId('minAgeInput'), '10');

  expect(screen.getByTestId(DATA_ID_RE_RENDER_BY_DEPS).textContent, 'Slicer should re-execute renderProps if `deps` are changed').toBe(
    'You can buy this content',
  );
  expect(
    screen.getByTestId(DATA_ID_NOT_RERENDER_NO_DEPS).textContent,
    'Same logic but would not refresh because external dependencies are not applied',
  ).toBe('go home');
});

test('Field onChange accepts an explicit (name, value) pair', () => {
  const TestFormHook = createTestHook();
  let captured: ((name: 'age', value: string) => void) | undefined;

  render(
    <Field controller={TestFormHook.controller} name="age">
      {(tool) => {
        captured = tool.onChange;
        return <input data-testid="age-input" {...tool} />;
      }}
    </Field>,
  );

  act(() => {
    captured?.('age', '7');
  });

  expect(TestFormHook.api.getState().value.age).toBe('7');
  expect((screen.getByTestId('age-input') as HTMLInputElement).value).toBe('7');
});

test('Field re-runs its render prop only when its own value/error changes, or when deps change', async () => {
  const TestFormHook = createTestHook();
  // start from a valid state so unrelated edits do not touch this field's error
  TestFormHook.actions.handleBulkChange(() => ({name: 'n', description: 'd', age: '1', marked: true}));

  const memoized = vi.fn();
  const withDeps = vi.fn();

  function App() {
    const [tick, setTick] = useState(0);
    return (
      <div>
        <button type="button" data-testid="rerender" onClick={() => setTick(tick + 1)} />
        <Field controller={TestFormHook.controller} name="age">
          {(tool) => {
            memoized();
            return <input data-testid="age-input" {...tool} />;
          }}
        </Field>
        <Field controller={TestFormHook.controller} name="age" deps={[tick]}>
          {(_tool, value) => {
            withDeps();
            return <span>{value}</span>;
          }}
        </Field>
      </div>
    );
  }

  render(<App />);
  expect(memoized).toHaveBeenCalledTimes(1);
  expect(withDeps).toHaveBeenCalledTimes(1);

  // parent re-render: only the Field with deps re-runs
  await userEvent.click(screen.getByTestId('rerender'));
  expect(memoized).toHaveBeenCalledTimes(1);
  expect(withDeps).toHaveBeenCalledTimes(2);

  // unrelated field change: neither re-runs
  act(() => {
    TestFormHook.actions.handleChange('name', 'other');
  });
  expect(memoized).toHaveBeenCalledTimes(1);
  expect(withDeps).toHaveBeenCalledTimes(2);

  // own field change: both re-run
  act(() => {
    TestFormHook.actions.handleChange('age', '2');
  });
  expect(memoized).toHaveBeenCalledTimes(2);
  expect(withDeps).toHaveBeenCalledTimes(3);
});

test('Slicer re-runs its render prop only when the selected tuple changes', async () => {
  const TestFormHook = createTestHook();
  TestFormHook.actions.handleBulkChange(() => ({name: 'n', description: 'd', age: '1', marked: true}));

  const renderProp = vi.fn();

  function App() {
    const [tick, setTick] = useState(0);
    return (
      <div>
        <button type="button" data-testid="rerender" onClick={() => setTick(tick + 1)} />
        <Slicer controller={TestFormHook.controller} selector={(s) => [s.value.age, s.isValid] as const}>
          {(_tool, age: string, isValid: boolean) => {
            renderProp();
            return <span>{`${age}:${isValid}`}</span>;
          }}
        </Slicer>
      </div>
    );
  }

  render(<App />);
  expect(renderProp).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getByTestId('rerender'));
  expect(renderProp).toHaveBeenCalledTimes(1);

  act(() => {
    TestFormHook.actions.handleChange('description', 'changed');
  });
  expect(renderProp).toHaveBeenCalledTimes(1);

  act(() => {
    TestFormHook.actions.handleChange('age', '2');
  });
  expect(renderProp).toHaveBeenCalledTimes(2);
});
