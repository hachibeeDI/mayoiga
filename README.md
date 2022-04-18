[![Lint Check](https://github.com/hachibeeDI/mayoiga/actions/workflows/checker.yml/badge.svg)](https://github.com/hachibeeDI/mayoiga/actions/workflows/checker.yml)

# Mayoiga

The React Hook based form library. Of course it is TypeScript friendly.


## Supported functionality

- TypeScript oriented
- Form level validation
- Submit level validation
- Less learning cost
- Cooperate with any component library (Bootstarap, MaterialDesign, ant-design or whatever )

With less boilerplate code!!

You can see more working demo [under the example directory](example/src/demo-app.tsx) .


## How to use

### API you should see

There are only two functions which you should know to use Mayoiga.

- [useForm](https://hachibeedi.github.io/mayoiga/modules/_mayoiga_.html#useform)
- [createFormScope](https://hachibeedi.github.io/mayoiga/modules/_mayoiga_.html#createformscope)

And if you would like to bring it to production, you need to know how to about [InputProtocol](https://hachibeedi.github.io/mayoiga/modules/_inputprotocol_.html#inputprotocol).
To know about that, `mayoiga/lib/forms` can be a good example.

There is a short article which explains Mayoiga https://dev.to/hachibeedi/react-use-form-type-safe-react-hooks-based-form-utility-4k5h.


### Minimum example:

```typeScript

import * as React from 'react';
import {FC} from 'react';

import {useForm, createFormScope} from 'mayoiga';
import {Input, NumberInput} from 'mayoiga/lib/forms';

const required = (target: string) => (target.length === 0 ? 'required' : undefined);

const between = (min: number, max: number) => (target: number) => {
  if (target < min) {
    return `more than ${min}`;
  }
  if (target > max) {
    return `less than ${max}`;
  }
};

const choice = function<T>(...candidates: Array<T>) {
  return (target: T) => (candidates.includes(target) ? undefined : 'You should choose from the candidates.');
};

const INITIAL_FORM_STATE = {
  name: '',
  age: 13,
  seed: 'fish',
};

const {context, scope} = createFormScope<typeof INITIAL_FORM_STATE>();

const DemoForm = scope(props => {
  const {Form, Field} = useForm(context);
  return (
    <Form onSubmit={value => console.log(value)}>
      <Field name="name" component={Input} validations={[required]} />
      <Field name="age" component={NumberInput} validations={[between(5, 20)]} />
      <Field name="seed" component={Input} validations={[choice('fish', 'squid', 'octopus')]} />

      <button disabled={!props.touched || Object.values(props.errors).some(e => !!e.length)}>submit</button>
    </Form>
  );
});

export default function DemoApp() {
  return <DemoForm initialState={INITIAL_FORM_STATE} onSubmit={value => alert(`submit ${JSON.stringify(value)}`)} />;
}

```
